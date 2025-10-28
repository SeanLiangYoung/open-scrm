import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { MassTaskEntity } from '../entity/mass-task.entity';
import { CreateMassTaskDto, QueryMassTaskDto } from '../dto/mass-task.dto';

/**
 * 群发任务服务
 */
@Provide()
export class MassTaskService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(MassTaskEntity)
  taskRepository!: Repository<MassTaskEntity>;

  @Inject()
  httpService!: HttpService;

  @Config('operation.massTask')
  massTaskConfig: any;

  @Config('operation.services')
  servicesConfig: any;

  /**
   * 创建群发任务
   */
  async createTask(corpId: number, userId: number, dto: CreateMassTaskDto): Promise<MassTaskEntity> {
    const task = this.taskRepository.create({
      corpId,
      createUserId: userId,
      taskName: dto.taskName,
      taskType: dto.taskType,
      targetType: dto.targetType,
      targetIds: dto.targetIds,
      targetCount: dto.targetIds.length,
      messageContent: dto.messageContent,
      messageType: dto.messageType,
      actionData: dto.actionData,
      scheduledTime: dto.scheduledTime,
      status: dto.scheduledTime ? 0 : 0, // 0-待执行
    });

    return await this.taskRepository.save(task);
  }

  /**
   * 执行群发任务
   */
  async executeTask(taskId: number, corpId: number): Promise<any> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, corpId },
    });

    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status !== 0) {
      throw new Error('任务状态不允许执行');
    }

    // 更新状态为执行中
    task.status = 1;
    task.startTime = new Date();
    await this.taskRepository.save(task);

    try {
      let result;
      switch (task.taskType) {
        case 1: // 群发消息
          result = await this.sendBatchMessages(task);
          break;
        case 2: // 批量打标签
          result = await this.batchAddTags(task);
          break;
        case 3: // 批量分配
          result = await this.batchAssign(task);
          break;
        default:
          throw new Error('不支持的任务类型');
      }

      // 更新任务状态
      task.status = 2; // 已完成
      task.successCount = result.success || 0;
      task.failCount = result.failed || 0;
      task.completeTime = new Date();
      await this.taskRepository.save(task);

      return result;
    } catch (error: any) {
      task.status = 3; // 失败
      task.errorMessage = error?.message;
      task.completeTime = new Date();
      await this.taskRepository.save(task);
      
      throw error;
    }
  }

  /**
   * 批量发送消息
   */
  private async sendBatchMessages(task: MassTaskEntity) {
    const batchSize = this.massTaskConfig.batchSize || 100;
    let successCount = 0;
    let failCount = 0;

    const targetIds = task.targetIds as number[];

    for (let i = 0; i < targetIds.length; i += batchSize) {
      const batch = targetIds.slice(i, i + batchSize);

      try {
        // TODO: 调用 message-service
        const response = await this.httpService.post(
          `${this.servicesConfig.message}/api/message/send/batch`,
          {
            messageType: task.messageType,
            targetType: task.targetType,
            targetIds: batch,
            content: task.messageContent,
          }
        );

        if (response.data.success) {
          successCount += response.data.data.success || 0;
          failCount += response.data.data.failed || 0;
        }
      } catch (error: any) {
        console.error('批量发送失败:', error);
        failCount += batch.length;
      }

      // 批次间隔
      if (i + batchSize < targetIds.length) {
        await this.delay(this.massTaskConfig.batchInterval || 1000);
      }
    }

    return { success: successCount, failed: failCount };
  }

  /**
   * 批量打标签
   */
  private async batchAddTags(task: MassTaskEntity) {
    // TODO: 调用 customer-service
    console.log('批量打标签:', task);
    return { success: task.targetCount, failed: 0 };
  }

  /**
   * 批量分配
   */
  private async batchAssign(task: MassTaskEntity) {
    // TODO: 调用 customer-service
    console.log('批量分配:', task);
    return { success: task.targetCount, failed: 0 };
  }

  /**
   * 查询任务列表
   */
  async queryTasks(corpId: number, query: QueryMassTaskDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.taskRepository
      .createQueryBuilder('task')
      .where('task.corpId = :corpId', { corpId });

    if (query.taskName) {
      queryBuilder.andWhere('task.taskName LIKE :taskName', {
        taskName: `%${query.taskName}%`,
      });
    }

    if (query.taskType !== undefined) {
      queryBuilder.andWhere('task.taskType = :taskType', {
        taskType: query.taskType,
      });
    }

    if (query.targetType !== undefined) {
      queryBuilder.andWhere('task.targetType = :targetType', {
        targetType: query.targetType,
      });
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('task.status = :status', {
        status: query.status,
      });
    }

    if (query.startTime) {
      queryBuilder.andWhere('task.createTime >= :startTime', {
        startTime: query.startTime,
      });
    }

    if (query.endTime) {
      queryBuilder.andWhere('task.createTime <= :endTime', {
        endTime: query.endTime,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('task.createTime', 'DESC');

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: number, corpId: number) {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, corpId },
    });

    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status !== 0) {
      throw new Error('任务状态不允许取消');
    }

    task.status = 4; // 已取消
    await this.taskRepository.save(task);

    return { success: true };
  }

  /**
   * 延时函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

