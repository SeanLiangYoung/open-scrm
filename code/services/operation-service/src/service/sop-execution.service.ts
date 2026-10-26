import { Provide, Inject, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { SopExecutionEntity } from '../entity/sop-execution.entity';
import { SopTemplateService } from './sop-template.service';
import { TriggerSopExecutionDto, QuerySopExecutionDto } from '../dto/sop-execution.dto';
import { sopIdList, sopInt32Id } from '../util/sop-action-validation';

import { SopScheduleStore } from './sop-schedule-store.service';

/**
 * SOP执行服务
 */
@Provide()
export class SopExecutionService {
  @Inject()
  scheduleStore!: SopScheduleStore;

  @InjectEntityModel(SopExecutionEntity)
  executionRepository!: Repository<SopExecutionEntity>;

  @Inject()
  sopTemplateService!: SopTemplateService;

  /**
   * 触发SOP执行
   */
  async triggerExecution(corpId: number, dto: TriggerSopExecutionDto) {
    const template = await this.sopTemplateService.getTemplate(sopInt32Id(dto.templateId), corpId);
    
    if (!template) {
      throw new Error('SOP模板不存在');
    }

    if (template.status !== 1) {
      throw new Error('SOP模板已禁用');
    }

    if (![1, 2].includes(dto.targetType) || template.templateType !== dto.targetType) {
      throw new httpError.BadRequestError('SOP模板类型与执行目标类型不匹配');
    }
    const targetIds = sopIdList(Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds]);
    const executions = [];

    for (const targetId of targetIds) {
      const execution = await this.scheduleStore.enqueue({
        corpId,
        templateId: template.id,
        templateName: template.templateName,
        targetType: dto.targetType,
        customerId: dto.targetType === 1 ? targetId : undefined,
        groupId: dto.targetType === 2 ? targetId : undefined,
        totalSteps: template.steps?.length || 0,
        status: 0,
        startTime: new Date(),
      }, template.steps || []);
      executions.push(execution);


    }

    return {
      success: true,
      count: executions.length,
      executions,
    };
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

    if (action === 'resume') {
      const paused = await this.executionRepository.find({
        where: { id: In(ids), corpId, status: 2 },
      });
      let count = 0;
      for (const execution of paused) {
        const template = await this.sopTemplateService.getTemplate(execution.templateId, corpId);
        if (!template || template.status !== 1) {
          throw new Error('恢复执行需要存在且已启用的SOP模板');
        }
        if (template.templateType !== execution.targetType) throw new httpError.BadRequestError('恢复执行的模板与目标类型不匹配');
        const result = await this.scheduleStore.resume(execution.id, corpId);
        if (!result.affected) continue;
        count += result.affected;

      }
      return { success: true, count };
    }
    
    let newStatus: number;
    switch (action) {
      case 'pause':
        newStatus = 2;
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

}
