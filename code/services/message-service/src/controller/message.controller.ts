import { httpError, Controller, Post, Get, Put, Del, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { MessageTemplateService } from '../service/message-template.service';
import { MessageSendService } from '../service/message-send.service';
import { MessageLogService } from '../service/message-log.service';
import { 
  CreateMessageTemplateDto, 
  UpdateMessageTemplateDto, 
  QueryMessageTemplateDto 
} from '../dto/message-template.dto';
import { 
  SendMessageDto, 
  BatchSendMessageDto, 
  SendByTemplateDto 
} from '../dto/send-message.dto';
import { QueryMessageLogDto, RetryMessageDto } from '../dto/message-log.dto';
import { getTenantContext } from '@scrm/server-common';
import { parseMessagePathId, parseTemplatePathId } from '../util/message-identity.util';
import { TemplateReferenceInputMiddleware } from '../middleware/template-reference-input.middleware';

/**
 * 消息控制器
 */
@Controller('/api/message')
export class MessageController {
  @Inject()
  ctx!: Context;

  @Inject()
  messageTemplateService!: MessageTemplateService;

  @Inject()
  messageSendService!: MessageSendService;

  @Inject()
  messageLogService!: MessageLogService;

  /**
   * 创建消息模板
   */
  @Post('/template')
  @Validate()
  async createTemplate(@Body() dto: CreateMessageTemplateDto) {
    const { corpId, userId } = getTenantContext(this.ctx);

    const template = await this.messageTemplateService.createTemplate(corpId, userId, dto);
    return {
      success: true,
      data: template,
      message: '模板创建成功',
    };
  }

  /**
   * 更新消息模板
   */
  @Put('/template/:id')
  @Validate()
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateMessageTemplateDto) {
    const { corpId } = getTenantContext(this.ctx);

    const template = await this.messageTemplateService.updateTemplate(parseTemplatePathId(id), corpId, dto);
    return {
      success: true,
      data: template,
      message: '模板更新成功',
    };
  }

  /**
   * 删除消息模板
   */
  @Del('/template/:id')
  async deleteTemplate(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    await this.messageTemplateService.deleteTemplate(parseTemplatePathId(id), corpId);
    return {
      success: true,
      message: '模板删除成功',
    };
  }

  /**
   * 获取模板详情
   */
  @Get('/template/:id')
  async getTemplate(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    const template = await this.messageTemplateService.getTemplate(parseTemplatePathId(id), corpId);
    return {
      success: true,
      data: template,
    };
  }

  /**
   * 查询模板列表
   */
  @Get('/templates')
  @Validate()
  async queryTemplates(@Query() query: QueryMessageTemplateDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.messageTemplateService.queryTemplates(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 发送消息
   */
  @Post('/send', { middleware: [TemplateReferenceInputMiddleware] })
  @Validate()
  async sendMessage(@Body() dto: SendMessageDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.messageSendService.sendMessage(corpId, dto);
    return {
      success: true,
      data: result,
      message: '消息发送完成',
    };
  }

  /**
   * 批量发送消息
   */
  @Post('/send/batch', { middleware: [TemplateReferenceInputMiddleware] })
  @Validate()
  async batchSendMessage(@Body() dto: BatchSendMessageDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.messageSendService.batchSendMessage(corpId, dto);
    return {
      success: true,
      data: result,
      message: '批量消息发送完成',
    };
  }

  /**
   * 根据模板发送消息
   */
  @Post('/send/template')
  @Validate()
  async sendByTemplate(@Body() dto: SendByTemplateDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.messageSendService.sendByTemplate(corpId, dto);
    return {
      success: true,
      data: result,
      message: '消息发送完成',
    };
  }

  /**
   * 重试发送
   */
  @Post('/retry')
  @Validate({ errorStatus: 400 })
  async retryMessage(@Body() dto: RetryMessageDto) {
    const header = this.ctx.get('x-corp-id');
    const identity = header
      ? { corpId: header, userId: this.ctx.get('x-user-id') }
      : this.ctx.state?.user;
    if (!identity || ![identity.corpId, identity.userId].every(value =>
      ['number', 'string'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
    )) throw new httpError.UnauthorizedError('缺少有效企业与操作者身份，请通过网关访问');
    const result = await this.messageSendService.retryFailedMessages(Number(identity.corpId), dto.logIds);
    return {
      success: true,
      data: result,
      message: '重试完成',
    };
  }

  /**
   * 查询消息日志
   */
  @Get('/logs')
  @Validate()
  async queryLogs(@Query() query: QueryMessageLogDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.messageLogService.queryLogs(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取消息日志详情
   */
  @Get('/log/:id')
  async getLog(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    const log = await this.messageLogService.getLog(parseMessagePathId(id), corpId);
    return {
      success: true,
      data: log,
    };
  }

  /**
   * 获取发送统计
   */
  @Get('/statistics')
  async getStatistics(@Query('startTime') startTime?: string, @Query('endTime') endTime?: string) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.messageLogService.getStatistics(
      corpId,
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined
    );
    return {
      success: true,
      data: result,
    };
  }
}

