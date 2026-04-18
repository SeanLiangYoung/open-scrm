import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { SopExecutionEntity } from '../entity/sop-execution.entity';
import { SopTemplateService } from './sop-template.service';
import { TriggerSopExecutionDto, QuerySopExecutionDto } from '../dto/sop-execution.dto';

/**
 * SOP执行服务
 */
@Provide()
export class SopExecutionService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(SopExecutionEntity)
  executionRepository!: Repository<SopExecutionEntity>;

  @Inject()
  sopTemplateService!: SopTemplateService;

  @Inject()
  httpService!: HttpService;

  @Config('operation.services')
  servicesConfig: {
    customer: string;
    message: string;
    integration: string;
  };

  /**
   * 触发SOP执行
   */
  async triggerExecution(corpId: number, dto: TriggerSopExecutionDto) {
    const template = await this.sopTemplateService.getTemplate(dto.templateId, corpId);
    
    if (!template) {
      throw new Error('SOP模板不存在');
    }

    if (template.status !== 1) {
      throw new Error('SOP模板已禁用');
    }

    const targetIds = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
    const executions = [];

    for (const targetId of targetIds) {
      const execution = this.executionRepository.create({
        corpId,
        templateId: template.id,
        templateName: template.templateName,
        targetType: dto.targetType,
        customerId: dto.targetType === 1 ? targetId : undefined,
        groupId: dto.targetType === 2 ? targetId : undefined,
        totalSteps: template.steps?.length || 0,
        status: 0,
        startTime: new Date(),
      });

      await this.executionRepository.save(execution);
      executions.push(execution);

      // 异步执行SOP（实际应该放入队列）
      this.executeSteps(execution.id, template.steps).catch(err => {
        console.error(`SOP执行失败:`, err);
      });
    }

    return {
      success: true,
      count: executions.length,
      executions,
    };
  }

  /**
   * 执行SOP步骤
   */
  private async executeSteps(executionId: number, steps: any[]) {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
    });

    if (!execution || execution.status !== 0) {
      return;
    }

    const executionLog = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        // 计算延迟时间
        if (step.delayTime > 0) {
          const delayMs = this.calculateDelay(step.delayTime, step.delayUnit);
          await this.delay(delayMs);
        }

        // 执行步骤
        await this.executeStep(execution, step);

        // 更新进度
        execution.currentStep = i + 1;
        executionLog.push({
          step: i + 1,
          stepName: step.stepName,
          status: 'success',
          time: new Date(),
        });

        await this.executionRepository.save(execution);
      } catch (error: any) {
        executionLog.push({
          step: i + 1,
          stepName: step.stepName,
          status: 'failed',
          error: error?.message,
          time: new Date(),
        });

        execution.status = 3; // 失败
        execution.errorMessage = error?.message;
        execution.executionLog = executionLog;
        await this.executionRepository.save(execution);
        return;
      }
    }

    // 全部完成
    execution.status = 1;
    execution.completeTime = new Date();
    execution.executionLog = executionLog;
    await this.executionRepository.save(execution);
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(execution: SopExecutionEntity, step: any) {
    switch (step.stepType) {
      case 1: // 发消息
        await this.sendMessage(execution, step);
        break;
      case 2: // 打标签
        await this.addTag(execution, step);
        break;
      case 3: // 推送素材
        await this.pushMaterial(execution, step);
        break;
      case 4: // 分配客户
        await this.assignCustomer(execution, step);
        break;
      case 5: // 提醒员工
        await this.notifyEmployee(execution, step);
        break;
      default:
        throw new Error('不支持的步骤类型');
    }
  }

  private execHeaders(execution: SopExecutionEntity): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-corp-id': String(execution.corpId),
      'x-user-id': '1',
    };
  }

  /** 解析步骤配置（支持 JSON 对象或 JSON 字符串） */
  private parseStepAction(step: any): Record<string, any> {
    const raw = step?.actionContent;
    if (raw == null) {
      return {};
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : { content: raw };
      } catch {
        return { content: raw };
      }
    }
    if (typeof raw === 'object') {
      return raw;
    }
    return { content: String(raw) };
  }

  /**
   * 发送消息
   */
  private async sendMessage(execution: SopExecutionEntity, step: any) {
    const targetId = execution.customerId || execution.groupId;
    if (!targetId) {
      throw new Error('SOP 步骤「发消息」需要客户或群目标');
    }
    const act = this.parseStepAction(step);
    const content = act.content ?? act.text ?? '';
    if (!content) {
      throw new Error('SOP 步骤缺少消息内容（actionContent.content）');
    }
    await this.httpService.post(
      `${this.servicesConfig.message}/api/message/send`,
      {
        messageType: act.messageType ?? 1,
        targetType: execution.targetType,
        targetIds: targetId,
        content,
        extra: act.extra,
      },
      { headers: this.execHeaders(execution) }
    );
  }

  /**
   * 打标签
   */
  private async addTag(execution: SopExecutionEntity, step: any) {
    if (!execution.customerId) {
      throw new Error('SOP 步骤「打标签」仅支持客户目标');
    }
    const act = this.parseStepAction(step);
    const tagIds = act.tagIds ?? act.tags;
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      throw new Error('SOP 步骤缺少 tagIds（数组）');
    }
    await this.httpService.post(
      `${this.servicesConfig.customer}/api/v1/customers/${execution.customerId}/tags`,
      { tagIds },
      { headers: this.execHeaders(execution) }
    );
  }

  /**
   * 推送素材
   */
  private async pushMaterial(execution: SopExecutionEntity, step: any) {
    const act = this.parseStepAction(step);
    const url = act.url || act.assetUrl || act.link;
    const text = act.content || (url ? `素材链接：${url}` : '');
    if (!text) {
      throw new Error('推送素材需要 actionContent.url 或 content');
    }
    const targetId = execution.customerId || execution.groupId;
    if (!targetId) {
      throw new Error('推送素材需要客户或群目标');
    }
    await this.httpService.post(
      `${this.servicesConfig.message}/api/message/send`,
      {
        messageType: act.messageType ?? 1,
        targetType: execution.targetType,
        targetIds: targetId,
        content: text,
        extra: act.extra,
      },
      { headers: this.execHeaders(execution) }
    );
  }

  /**
   * 分配客户
   */
  private async assignCustomer(execution: SopExecutionEntity, step: any) {
    if (!execution.customerId) {
      throw new Error('SOP 步骤「分配客户」需要客户目标');
    }
    const act = this.parseStepAction(step);
    const followUserId = act.followUserId ?? act.staffId;
    if (followUserId == null || !Number.isFinite(Number(followUserId))) {
      throw new Error('SOP 步骤缺少 followUserId 或 staffId');
    }
    await this.httpService.put(
      `${this.servicesConfig.customer}/api/v1/customers/${execution.customerId}`,
      { followUserId: Number(followUserId) },
      { headers: this.execHeaders(execution) }
    );
  }

  /**
   * 提醒员工
   */
  private async notifyEmployee(execution: SopExecutionEntity, step: any) {
    const act = this.parseStepAction(step);
    const userIds = act.userIds ?? (act.userId != null ? [act.userId] : []);
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('提醒员工需要 actionContent.userIds 或 userId');
    }
    await this.httpService.post(
      `${this.servicesConfig.message}/api/notification/`,
      {
        userIds,
        notificationType: act.notificationType ?? 1,
        title: act.title || 'SOP 提醒',
        content: act.content || act.text || '',
        linkUrl: act.linkUrl,
      },
      { headers: this.execHeaders(execution) }
    );
  }

  /**
   * 查询执行记录
   */
  async queryExecutions(corpId: number, query: QuerySopExecutionDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.executionRepository
      .createQueryBuilder('execution')
      .where('execution.corpId = :corpId', { corpId });

    if (query.templateId !== undefined) {
      queryBuilder.andWhere('execution.templateId = :templateId', {
        templateId: query.templateId,
      });
    }

    if (query.targetType !== undefined) {
      queryBuilder.andWhere('execution.targetType = :targetType', {
        targetType: query.targetType,
      });
    }

    if (query.customerId !== undefined) {
      queryBuilder.andWhere('execution.customerId = :customerId', {
        customerId: query.customerId,
      });
    }

    if (query.groupId !== undefined) {
      queryBuilder.andWhere('execution.groupId = :groupId', {
        groupId: query.groupId,
      });
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('execution.status = :status', {
        status: query.status,
      });
    }

    if (query.startTime) {
      queryBuilder.andWhere('execution.createTime >= :startTime', {
        startTime: query.startTime,
      });
    }

    if (query.endTime) {
      queryBuilder.andWhere('execution.createTime <= :endTime', {
        endTime: query.endTime,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('execution.createTime', 'DESC');

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
   * 暂停/恢复/取消执行
   */
  async controlExecution(corpId: number, executionIds: number | number[], action: string) {
    const ids = Array.isArray(executionIds) ? executionIds : [executionIds];
    
    let newStatus: number;
    switch (action) {
      case 'pause':
        newStatus = 2;
        break;
      case 'resume':
        newStatus = 0;
        break;
      case 'cancel':
        newStatus = 3;
        break;
      default:
        throw new Error('不支持的操作');
    }

    const result = await this.executionRepository.update(
      { id: In(ids), corpId, status: In([0, 2]) },
      { status: newStatus }
    );

    return {
      success: true,
      count: result.affected || 0,
    };
  }

  /**
   * 计算延迟时间（毫秒）
   */
  private calculateDelay(time: number, unit: string): number {
    switch (unit) {
      case 'minute':
        return time * 60 * 1000;
      case 'hour':
        return time * 60 * 60 * 1000;
      case 'day':
        return time * 24 * 60 * 60 * 1000;
      default:
        return time * 60 * 1000;
    }
  }

  /**
   * 延时函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

