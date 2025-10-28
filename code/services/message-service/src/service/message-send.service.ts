import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { MessageLogEntity } from '../entity/message-log.entity';
import { MessageTemplateService } from './message-template.service';
import { SendMessageDto, BatchSendMessageDto, SendByTemplateDto } from '../dto/send-message.dto';

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
   * 发送单条消息
   */
  async sendMessage(corpId: number, dto: SendMessageDto) {
    const targetIds = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
    const results = [];

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
      });

      await this.messageLogRepository.save(log);

      try {
        // 根据消息类型发送
        await this.doSendMessage(log);
        
        log.sendStatus = 1;
        log.sendTime = new Date();
        await this.messageLogRepository.save(log);

        results.push({ targetId, success: true });
      } catch (error: any) {
        log.sendStatus = 2;
        log.failReason = error?.message || 'Unknown error';
        log.retryCount++;
        await this.messageLogRepository.save(log);

        results.push({ targetId, success: false, error: error?.message });
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

