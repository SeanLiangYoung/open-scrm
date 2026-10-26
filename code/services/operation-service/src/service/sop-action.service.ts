import { Provide, Inject, Config, Scope, ScopeEnum } from '@midwayjs/core';
import { HttpService } from '@midwayjs/axios';
import { SopExecutionEntity } from '../entity/sop-execution.entity';
import { sopPositiveId, validateSopAction } from '../util/sop-action-validation';

/** Stateless downstream actions; scheduled workers never retain request context. */
@Provide()
@Scope(ScopeEnum.Singleton)
export class SopActionService {
  @Inject() httpService!: HttpService;
  @Config('operation.services') servicesConfig!: { customer: string; message: string; integration: string };
  /**
   * 执行单个步骤
   */
  async executeStep(execution: SopExecutionEntity, step: any) {
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
        idempotencyKey: `sop:${execution.id}:${execution.currentStep + 1}`,
        messageType: act.messageType ?? 1,
        ...(act.templateId !== undefined ? { templateId: act.templateId } : {}),
        // SOP uses 2 for groups; the message service uses 3 (2 means employee).
        targetType: execution.targetType === 2 ? 3 : execution.targetType,
        targetIds: targetId,
        content,
        extra: act.extra,
      },
      { headers: this.execHeaders(execution), timeout: 30_000 }
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
      { headers: this.execHeaders(execution), timeout: 30_000 }
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
        idempotencyKey: `sop:${execution.id}:${execution.currentStep + 1}`,
        messageType: act.messageType ?? 1,
        ...(act.templateId !== undefined ? { templateId: act.templateId } : {}),
        targetType: execution.targetType === 2 ? 3 : execution.targetType,
        targetIds: targetId,
        content: text,
        extra: act.extra,
      },
      { headers: this.execHeaders(execution), timeout: 30_000 }
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
      { headers: this.execHeaders(execution), timeout: 30_000 }
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
      { headers: this.execHeaders(execution), timeout: 30_000 }
    );
    if (response.data?.success !== true || response.data?.data?.success !== true || response.data?.data?.count !== userIds.length) {
      throw new Error('通知服务未确认全部接收人成功');
    }
  }

}
