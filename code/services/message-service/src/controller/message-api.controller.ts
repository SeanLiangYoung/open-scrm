import { Controller, Post, Get, Body, Headers, Param, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { parseMessagePathId } from '../util/message-identity.util';
import { TemplateReferenceInputMiddleware } from '../middleware/template-reference-input.middleware';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessageSendService } from '../service/message-send.service';
import { MessageLogService } from '../service/message-log.service';
import { ConsentRecordService } from '../service/consent-record.service';
import { normalizeIdempotencyKey } from '../util/message-idempotency.util';
import { resolveMarketingConsentGate } from '../util/marketing-consent-gate.util';
import { getRegionPackById } from '../catalog/region-packs';
import { OutboundPolicyStateService } from '../service/outbound-policy-state.service';

/**
 * Sprint 3：经网关的统一消息 API（/api/v1/messages），支持 Idempotency-Key 头
 */
@Controller('/api/v1/messages')
export class MessageApiController {
  @Inject()
  ctx!: Context;

  @Inject()
  messageSendService!: MessageSendService;

  @Inject()
  messageLogService!: MessageLogService;

  @Inject()
  consentRecordService!: ConsentRecordService;

  @Inject()
  outboundPolicyStateService!: OutboundPolicyStateService;

  @Post('/send', { middleware: [TemplateReferenceInputMiddleware] })
  @Validate()
  async send(
    @Headers('idempotency-key') headerKey: string | undefined,
    @Body() dto: SendMessageDto
  ) {
    const keyFromHeader = normalizeIdempotencyKey(headerKey);
    const keyFromBody = normalizeIdempotencyKey(dto.idempotencyKey);

    if (
      keyFromHeader !== null &&
      keyFromBody !== null &&
      keyFromHeader !== keyFromBody
    ) {
      this.ctx.status = 400;
      return {
        success: false,
        message: 'Idempotency-Key 头与 body idempotencyKey 不一致',
      };
    }

    const merged: SendMessageDto =
      keyFromHeader !== null ? { ...dto, idempotencyKey: keyFromHeader } : dto;

    const { corpId } = getTenantContext(this.ctx);
    await this.messageSendService.assertSendAvailable(corpId, merged);

    const consentBlock = await resolveMarketingConsentGate(
      corpId,
      merged,
      (c, customerId) =>
        this.consentRecordService.hasActiveMarketingConsentForCustomer(c, customerId)
    );
    if (consentBlock) {
      this.ctx.status = consentBlock.status;
      return consentBlock.body;
    }

    const policyBlock = await this.checkOutboundPolicyOrBlock(corpId, merged);
    if (policyBlock) {
      this.ctx.status = policyBlock.status;
      return policyBlock.body;
    }

    const result = await this.messageSendService.sendMessage(corpId, merged);
    return {
      success: true,
      data: result,
      message: '消息发送完成',
    };
  }

  /** 按日志 ID 查询发送状态（租户隔离） */
  @Get('/logs/:id')
  async getLog(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const log = await this.messageLogService.getLog(parseMessagePathId(id), corpId);
    return {
      success: true,
      data: log,
    };
  }

  /**
   * 营销 + 客户类：RegionPack 静默与日频控（Redis）；多目标本阶段直接 400。
   */
  private async checkOutboundPolicyOrBlock(
    corpId: number,
    dto: SendMessageDto
  ): Promise<{ status: number; body: Record<string, unknown> } | null> {
    if (dto.consentPurpose !== 'marketing' || dto.targetType !== 1) {
      return null;
    }
    const ids = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
    if (ids.length !== 1) {
      return {
        status: 400,
        body: {
          success: false,
          message: '营销 RegionPack 策略当前仅支持单接收方（targetIds 长度为 1）',
        },
      };
    }
    const packId = dto.regionPackId?.trim() || 'th-bangkok';
    const pack = getRegionPackById(packId);
    if (!pack) {
      return {
        status: 400,
        body: {
          success: false,
          message: `未知的 regionPackId: ${packId}`,
        },
      };
    }
    const slot = await this.outboundPolicyStateService.tryConsumeMarketingSendSlot({
      corpId,
      pack,
      targetType: dto.targetType,
      targetId: ids[0],
    });
    if (!slot.allowed) {
      return {
        status: 429,
        body: {
          success: false,
          code: slot.reasonCode,
          message:
            slot.reasonCode === 'silent_hours'
              ? '当前处于区域静默时段，营销发送已拦截'
              : '已超过该区域包设定的营销日发送上限',
        },
      };
    }
    return null;
  }
}
