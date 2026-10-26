import { httpError, Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In, QueryFailedError } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { requireMessageNumber, requireTemplateNumber } from '../util/message-identity.util';
import { MessageLogEntity } from '../entity/message-log.entity';
import { MessageTemplateService } from './message-template.service';
import { SendMessageDto, BatchSendMessageDto, SendByTemplateDto } from '../dto/send-message.dto';
import {
  normalizeIdempotencyKey,
  resolveIdempotentReplay,
  type IdempotentReplayResult,
  type IdempotentReplaySnapshot,
} from '../util/message-idempotency.util';

/**
 * 消息发送服务
 */
@Provide()
export class MessageSendService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(MessageLogEntity)
  messageLogRepository!: Repository<MessageLogEntity>;

  @Inject()
  messageTemplateService!: MessageTemplateService;

  @Inject()
  httpService!: HttpService;

  @Config('message')
  messageConfig: any;

  /**
   * 发送单条消息（可选幂等键：仅支持单 target；同 corp + 键重放已有 message_log 结果）
   */
  async sendMessage(corpId: number, dto: SendMessageDto) {
    await this.assertTemplateReference(corpId, dto.templateId);
    this.assertChannelAvailable(dto.messageType);
    const idemKey = normalizeIdempotencyKey(dto.idempotencyKey);
    const targetIds = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];

    if (idemKey !== null && targetIds.length !== 1) {
      throw new Error('使用幂等键时 targetIds 只能包含 1 个接收方');
    }

    if (idemKey !== null) {
      const existing = await this.messageLogRepository.findOne({
        where: { corpId, idempotencyKey: idemKey },
      });
      if (existing) this.assertChannelAvailable(existing.messageType);
      const replay = resolveIdempotentReplay(
        corpId,
        idemKey,
        existing ? this.logEntityToSnapshot(existing) : null
      );
      if (replay) {
        return this.buildIdempotentSendResult(replay, targetIds[0]);
      }
    }

    const results: Array<{
      targetId: number;
      success: boolean;
      messageLogId?: number;
      idempotentReplay?: boolean;
      error?: string;
    }> = [];

    for (const targetId of targetIds) {
      const log = this.messageLogRepository.create({
        corpId,
        templateId: dto.templateId,
        messageType: dto.messageType,
        targetType: dto.targetType,
        targetId,
        content: dto.content,
        extra: dto.extra,
        sendStatus: 0,
        ...(idemKey !== null ? { idempotencyKey: idemKey } : {}),
      });

      let saved: MessageLogEntity;
      try {
        saved = await this.messageLogRepository.save(log);
      } catch (err) {
        if (idemKey !== null && this.isUniqueIdempotencyViolation(err)) {
          const raced = await this.messageLogRepository.findOne({
            where: { corpId, idempotencyKey: idemKey },
          });
          if (raced) this.assertChannelAvailable(raced.messageType);
          const racedReplay = resolveIdempotentReplay(
            corpId,
            idemKey,
            raced ? this.logEntityToSnapshot(raced) : null
          );
          if (racedReplay) {
            results.push({
              targetId,
              success: racedReplay.sendStatus === 1,
              messageLogId: racedReplay.messageLogId,
              idempotentReplay: true,
              ...(racedReplay.sendStatus !== 1 && racedReplay.failReason
                ? { error: racedReplay.failReason }
                : {}),
            });
            continue;
          }
        }
        throw err;
      }

      try {
        await this.doSendMessage(saved);
        saved.sendStatus = 1;
        saved.sendTime = new Date();
        await this.messageLogRepository.save(saved);
        results.push({ targetId, success: true, messageLogId: saved.id });
      } catch (error: any) {
        saved.sendStatus = 2;
        saved.failReason = error?.message || 'Unknown error';
        saved.retryCount++;
        await this.messageLogRepository.save(saved);
        results.push({ targetId, success: false, messageLogId: saved.id, error: error?.message });
      }
    }

    return {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results,
    };
  }

  private logEntityToSnapshot(log: MessageLogEntity): IdempotentReplaySnapshot {
    return {
      id: log.id,
      corpId: log.corpId,
      sendStatus: log.sendStatus,
      content: log.content,
      failReason: log.failReason ?? null,
      externalId: log.externalId ?? null,
    };
  }

  private buildIdempotentSendResult(replay: IdempotentReplayResult, targetId: number) {
    const ok = replay.sendStatus === 1;
    const failed = replay.sendStatus === 2;
    const pending = replay.sendStatus === 0;
    return {
      idempotentReplay: true,
      messageLogId: replay.messageLogId,
      sendStatus: replay.sendStatus,
      content: replay.content,
      failReason: replay.failReason,
      externalId: replay.externalId,
      total: 1,
      success: ok ? 1 : 0,
      failed: failed ? 1 : 0,
      pending: pending ? 1 : 0,
      details: [
        {
          targetId,
          success: ok,
          messageLogId: replay.messageLogId,
          idempotentReplay: true,
        },
      ],
    };
  }

  private isUniqueIdempotencyViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) {
      return false;
    }
    const code = (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
    return code === '23505';
  }

  /**
   * 批量发送消息
   */
  async batchSendMessage(corpId: number, dto: BatchSendMessageDto) {
    await this.assertTemplateReference(corpId, dto.templateId);
    this.assertChannelAvailable(dto.messageType);
    const batchSize = this.messageConfig.batchSize || 100;
    const results = [];

    // 分批处理
    for (let i = 0; i < dto.targetIds.length; i += batchSize) {
      const batch = dto.targetIds.slice(i, i + batchSize);
      
      for (const targetId of batch) {
        const content = dto.content || '';
        
        const log = this.messageLogRepository.create({
          corpId,
          templateId: dto.templateId,
          messageType: dto.messageType,
          targetType: dto.targetType,
          targetId,
          content,
          extra: dto.extra,
          sendStatus: 0,
        });

        await this.messageLogRepository.save(log);

        try {
          await this.doSendMessage(log);
          
          log.sendStatus = 1;
          log.sendTime = new Date();
          await this.messageLogRepository.save(log);

          results.push({ targetId, success: true });
        } catch (error: any) {
          log.sendStatus = 2;
          log.failReason = error?.message || 'Unknown error';
          await this.messageLogRepository.save(log);

          results.push({ targetId, success: false, error: error?.message });
        }
      }

      // 批次间隔
      if (i + batchSize < dto.targetIds.length) {
        await this.delay(this.messageConfig.batchInterval || 1000);
      }
    }

    return {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results,
    };
  }

  /**
   * 根据模板发送消息
   */
  async sendByTemplate(corpId: number, dto: SendByTemplateDto) {
    const template = await this.messageTemplateService.getTemplate(dto.templateId, corpId);
    
    if (!template) {
      throw new Error('模板不存在');
    }

    if (template.status !== 1) {
      throw new Error('模板已禁用');
    }

    // 渲染模板内容
    const content = this.messageTemplateService.renderTemplate(
      template.content,
      dto.variables
    );

    const targetIds = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];

    return await this.sendMessage(corpId, {
      messageType: template.messageType,
      targetType: dto.targetType,
      targetIds,
      content,
      templateId: template.id,
      extra: { ...template.extra, ...dto.extra },
    });
  }

  /**
   * 执行实际的消息发送
   */
  private async doSendMessage(log: MessageLogEntity) {
    this.assertChannelAvailable(log.messageType);
    // Explicit Mock5 intentionally has no external side effect.
  }

  assertChannelAvailable(messageType: number) {
    if (messageType !== 5) {
      throw new httpError.BadRequestError('消息渠道尚未接通；请使用明确的模拟渠道5，真实站内通知请使用通知接口');
    }
  }

  private async assertTemplateReference(corpId: number, templateId: unknown) {
    if (templateId === undefined) return;
    const id = requireTemplateNumber(templateId);
    requireMessageNumber(corpId);
    const template = await this.messageTemplateService.getTemplate(id, corpId);
    if (!template) throw new httpError.NotFoundError('模板不存在');
    // Optional references identify provenance only; explicit content/channel remain unchanged.
  }

  async assertSendAvailable(corpId: number, dto: SendMessageDto) {
    await this.assertTemplateReference(corpId, dto.templateId);
    this.assertChannelAvailable(dto.messageType);
    const idempotencyKey = normalizeIdempotencyKey(dto.idempotencyKey);
    if (idempotencyKey !== null) {
      const existing = await this.messageLogRepository.findOne({
        where: { corpId, idempotencyKey },
      });
      if (existing) this.assertChannelAvailable(existing.messageType);
    }
  }

  /**
   * 重试发送失败的消息
   */
  async retryFailedMessages(corpId: number, logIds: number | number[]) {
    if (!Number.isSafeInteger(corpId) || corpId <= 0) {
      throw new httpError.UnauthorizedError('缺少有效企业身份');
    }
    const inputIds = Array.isArray(logIds) ? logIds : [logIds];
    if (inputIds.length < 1 || inputIds.length > 100 ||
      !inputIds.every(id => Number.isSafeInteger(id) && id > 0)) {
      throw new httpError.BadRequestError('logIds须为1至100个正安全整数');
    }
    const ids = [...new Set(inputIds)];
    const logs = await this.messageLogRepository.find({
      where: { corpId, id: In(ids), sendStatus: 2 },
    });

    const results = [];

    for (const log of logs) {
      if (log.retryCount >= (this.messageConfig.maxRetries || 3)) {
        results.push({ id: log.id, success: false, error: '超过最大重试次数' });
        continue;
      }

      try {
        await this.doSendMessage(log);
        
        log.sendStatus = 1;
        log.sendTime = new Date();
        log.retryCount++;
        await this.messageLogRepository.save(log);

        results.push({ id: log.id, success: true });
      } catch (error: any) {
        log.failReason = error?.message || 'Unknown error';
        log.retryCount++;
        await this.messageLogRepository.save(log);

        results.push({ id: log.id, success: false, error: error?.message });
      }
    }

    return {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results,
    };
  }

  /**
   * 延时函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

