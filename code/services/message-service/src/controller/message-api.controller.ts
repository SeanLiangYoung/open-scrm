import { Controller, Post, Get, Body, Headers, Param, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessageSendService } from '../service/message-send.service';
import { MessageLogService } from '../service/message-log.service';
import { ConsentRecordService } from '../service/consent-record.service';
import { normalizeIdempotencyKey } from '../util/message-idempotency.util';
import { resolveMarketingConsentGate } from '../util/marketing-consent-gate.util';

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

  @Post('/send')
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
    const log = await this.messageLogService.getLog(parseInt(id, 10), corpId);
    return {
      success: true,
      data: log,
    };
  }
}
