import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In, QueryFailedError } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
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
    const idemKey = normalizeIdempotencyKey(dto.idempotencyKey);
    const targetIds = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];

    if (idemKey !== null && targetIds.length !== 1) {
      throw new Error('使用幂等键时 targetIds 只能包含 1 个接收方');
    }

    if (idemKey !== null) {
      const existing = await this.messageLogRepository.findOne({
        where: { corpId, idempotencyKey: idemKey },
      });
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
    switch (log.messageType) {
      case 1: // 企业微信消息
        await this.sendWeworkMessage(log);
        break;
      case 2: // 站内通知 (由NotificationService处理)
        break;
      case 3: // 短信
        await this.sendSmsMessage(log);
        break;
      case 4: // 邮件
        await this.sendEmailMessage(log);
        break;
      default:
        throw new Error('不支持的消息类型');
    }
  }

  /**
   * 发送企业微信消息
   */
  private async sendWeworkMessage(log: MessageLogEntity) {
    // TODO: 调用 integration-service 发送企业微信消息
    // 这里暂时模拟发送
    console.log('发送企业微信消息:', log);
    
    // 实际应该调用:
    // const response = await this.httpService.post(
    //   'http://integration-service:7007/api/wework/message/send',
    //   {
    //     targetType: log.targetType,
    //     targetId: log.targetId,
    //     content: log.content,
    //     extra: log.extra,
    //   }
    // );
  }

  /**
   * 发送短信
   */
  private async sendSmsMessage(log: MessageLogEntity) {
    // TODO: 集成短信服务商
    console.log('发送短信:', log);
  }

  /**
   * 发送邮件
   */
  private async sendEmailMessage(log: MessageLogEntity) {
    // TODO: 集成邮件服务
    console.log('发送邮件:', log);
  }

  /**
   * 重试发送失败的消息
   */
  async retryFailedMessages(logIds: number | number[]) {
    const ids = Array.isArray(logIds) ? logIds : [logIds];
    const logs = await this.messageLogRepository.find({
      where: { id: In(ids), sendStatus: 2 },
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

