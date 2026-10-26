import { Provide, Inject, Config, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { SopExecutionEntity } from '../entity/sop-execution.entity';
import { SopTemplateService } from './sop-template.service';
import { TriggerSopExecutionDto, QuerySopExecutionDto } from '../dto/sop-execution.dto';
import { sopDelayMs, sopIdList, sopInt32Id, sopPositiveId, validateSopAction } from '../util/sop-action-validation';

/**
 * SOP执行服务
 */
@Provide()
export class SopExecutionService {
  /** Process-local guard; providers may be instantiated for separate requests. */
  private static readonly runners = new Map<number, Promise<void>>();

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
      this.startSteps(execution.id, template.steps || []).catch(err => {
        console.error(`SOP执行失败:`, err);
      });
    }

    return {
      success: true,
      count: executions.length,
      executions,
    };
  }

  private startSteps(executionId: number, steps: any[]): Promise<void> {
    const existing = SopExecutionService.runners.get(executionId);
    if (existing) return existing;
    const runner = this.executeSteps(executionId, steps).finally(() => {
      if (SopExecutionService.runners.get(executionId) === runner) {
        SopExecutionService.runners.delete(executionId);
      }
    });
    SopExecutionService.runners.set(executionId, runner);
    return runner;
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

    const executionLog = Array.isArray(execution.executionLog) ? [...execution.executionLog] : [];

    for (let i = execution.currentStep || 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        const beforeWait = await this.executionRepository.findOne({
          where: { id: executionId, corpId: execution.corpId },
        });
        if (!beforeWait || beforeWait.status !== 0) return;

        validateSopAction(step);
        // 计算延迟时间
        if (step.delayTime > 0) {
          const delayMs = this.calculateDelay(step.delayTime, step.delayUnit);
          await this.delay(delayMs);
        }

        // Re-check after the delay: control requests may have paused/cancelled us.
        const current = await this.executionRepository.findOne({
          where: { id: executionId, corpId: execution.corpId },
        });
        if (!current || current.status !== 0) return;
        await this.executeStep(current, step);

        // 更新进度
        execution.currentStep = i + 1;
        executionLog.push({
          step: i + 1,
          stepName: step.stepName,
          status: 'success',
          time: new Date(),
        });

        // An in-flight request cannot be recalled. Record its completed progress
        // without overwriting a concurrent pause/cancel with stale status=0.
        await this.executionRepository.update(
          { id: executionId, corpId: execution.corpId },
          { currentStep: i + 1, executionLog }
        );
      } catch (error: any) {
        executionLog.push({
          step: i + 1,
          stepName: step.stepName,
          status: 'failed',
          error: error?.message,
          time: new Date(),
        });

        await this.executionRepository.update(
          { id: executionId, corpId: execution.corpId },
          { errorMessage: error?.message, executionLog }
        );
        await this.executionRepository.update(
          { id: executionId, corpId: execution.corpId, status: 0 }, { status: 3 }
        );
        return;
      }
    }

    // 全部完成
    await this.executionRepository.update(
      { id: executionId, corpId: execution.corpId, status: 0 },
      { status: 1, completeTime: new Date(), executionLog }
    );
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(execution: SopExecutionEntity, step: any) {
    validateSopAction(step);
    this.validateExecutionTarget(execution);
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

  private validateExecutionTarget(execution: SopExecutionEntity): void {
    if (execution.targetType === 1 && execution.groupId == null) {
      sopPositiveId(execution.customerId);
    } else if (execution.targetType === 2 && execution.customerId == null) {
      sopPositiveId(execution.groupId);
    } else {
      throw new Error('SOP目标类型与客户/群编号不一致');
    }
  }

  private parseStepAction(step: any): Record<string, any> {
    return validateSopAction(step);
  }

  private requireSuccessfulMessage(response: { data?: unknown }): void {
    const body = response.data as {
      success?: boolean;
      data?: { success?: number; failed?: number };
    } | undefined;
    // HTTP 200 is an envelope: the sender reports per-recipient failures inside it.
    if (body?.success !== true || body.data?.success !== 1 || body.data?.failed !== 0) {
      throw new Error('消息服务未确认成功发送');
    }
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
    const response = await this.httpService.post(
      `${this.servicesConfig.message}/api/message/send`,
      {
        messageType: act.messageType ?? 1,
        ...(act.templateId !== undefined ? { templateId: act.templateId } : {}),
        // SOP uses 2 for groups; the message service uses 3 (2 means employee).
        targetType: execution.targetType === 2 ? 3 : execution.targetType,
        targetIds: targetId,
        content,
        extra: act.extra,
      },
      { headers: this.execHeaders(execution) }
    );
    this.requireSuccessfulMessage(response);
  }

  /**
   * 打标签
   */
  private async addTag(execution: SopExecutionEntity, step: any) {
    if (execution.targetType !== 1 || !execution.customerId || execution.groupId != null) {
      throw new Error('SOP 步骤「打标签」仅支持客户目标');
    }
    const act = this.parseStepAction(step);
    const tagIds = act.tagIds ?? act.tags;
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      throw new Error('SOP 步骤缺少 tagIds（数组）');
    }
    const response = await this.httpService.post(
      `${this.servicesConfig.customer}/api/v1/customers/${execution.customerId}/tags`,
      { tagIds },
      { headers: this.execHeaders(execution) }
    );
    if (response.data?.code !== 200 || response.data?.success === false) throw new Error('客户服务未确认打标签成功');
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
    const response = await this.httpService.post(
      `${this.servicesConfig.message}/api/message/send`,
      {
        messageType: act.messageType ?? 1,
        ...(act.templateId !== undefined ? { templateId: act.templateId } : {}),
        targetType: execution.targetType === 2 ? 3 : execution.targetType,
        targetIds: targetId,
        content: text,
        extra: act.extra,
      },
      { headers: this.execHeaders(execution) }
    );
    this.requireSuccessfulMessage(response);
  }

  /**
   * 分配客户
   */
  private async assignCustomer(execution: SopExecutionEntity, step: any) {
    if (execution.targetType !== 1 || !execution.customerId || execution.groupId != null) {
      throw new Error('SOP 步骤「分配客户」需要客户目标');
    }
    const act = this.parseStepAction(step);
    const followUserId = act.followUserId ?? act.staffId;
    if (followUserId == null) {
      throw new Error('SOP 步骤缺少 followUserId 或 staffId');
    }
    const response = await this.httpService.put(
      `${this.servicesConfig.customer}/api/v1/customers/${execution.customerId}`,
      { followUserId: sopPositiveId(followUserId) },
      { headers: this.execHeaders(execution) }
    );
    if (response.data?.code !== 200 || response.data?.success === false ||
      sopPositiveId(response.data?.data?.id) !== sopPositiveId(execution.customerId) ||
      sopPositiveId(response.data?.data?.followUserId) !== sopPositiveId(followUserId)) {
      throw new Error('客户服务未确认目标客户分配成功');
    }
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
    const response = await this.httpService.post(
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
    if (response.data?.success !== true || response.data?.data?.success !== true || response.data?.data?.count !== userIds.length) {
      throw new Error('通知服务未确认全部接收人成功');
    }
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
        const result = await this.executionRepository.update(
          { id: execution.id, corpId, status: 2 }, { status: 0 }
        );
        if (!result.affected) continue;
        count += result.affected;
        const active = SopExecutionService.runners.get(execution.id);
        // If pause/resume raced a waiting or in-flight worker, let it leave
        // before starting again. startSteps also guards concurrent requests.
        const resume = async () => {
          if (active) {
            try {
              await active;
            } catch (error) {
              // A failed prior worker must not strand an accepted resume in
              // status=0. Restart from the progress persisted in the database.
              console.error('SOP原执行链结束失败，尝试恢复:', error);
            }
          }
          await this.startSteps(execution.id, template.steps || []);
        };
        resume().catch(err => console.error('SOP恢复执行失败:', err));
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

  /**
   * 计算延迟时间（毫秒）
   */
  private calculateDelay(time: number, unit: string): number {
    return sopDelayMs(time, unit);
  }

  /**
   * 延时函数
   */
  private async delay(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error('SOP步骤延时必须为有限的非负数');
    }
    // Node clamps timers above this limit to 1ms. Keep long SOP waits in
    // supported chunks so a month-long delay cannot send immediately.
    const maxTimerMs = 2_147_483_647;
    let remaining = ms;
    while (remaining > 0) {
      const chunk = Math.min(remaining, maxTimerMs);
      await new Promise<void>(resolve => setTimeout(resolve, chunk));
      remaining -= chunk;
    }
  }
}

