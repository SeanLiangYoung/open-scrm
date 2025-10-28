import { Controller, Post, Get, Put, Del, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { NotificationService } from '../service/notification.service';
import { CreateNotificationDto, QueryNotificationDto, MarkReadDto } from '../dto/notification.dto';

/**
 * 通知控制器
 */
@Controller('/api/notification')
export class NotificationController {
  @Inject()
  ctx!: Context;

  @Inject()
  notificationService!: NotificationService;

  /**
   * 创建通知
   */
  @Post('/')
  @Validate()
  async createNotification(@Body() dto: CreateNotificationDto) {
    const corpId = 1; // TODO: 从JWT获取
    
    const result = await this.notificationService.createNotification(corpId, dto);
    return {
      success: true,
      data: result,
      message: '通知创建成功',
    };
  }

  /**
   * 获取用户通知列表
   */
  @Get('/list')
  @Validate()
  async queryNotifications(@Query() query: QueryNotificationDto) {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取
    
    const result = await this.notificationService.queryNotifications(userId, corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 标记已读
   */
  @Put('/read')
  @Validate()
  async markAsRead(@Body() dto: MarkReadDto) {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取
    
    const result = await this.notificationService.markAsRead(userId, corpId, dto.notificationIds);
    return {
      success: true,
      data: result,
      message: '标记成功',
    };
  }

  /**
   * 全部标记已读
   */
  @Put('/read/all')
  async markAllAsRead() {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取
    
    const result = await this.notificationService.markAllAsRead(userId, corpId);
    return {
      success: true,
      data: result,
      message: '全部标记成功',
    };
  }

  /**
   * 获取未读数量
   */
  @Get('/unread/count')
  async getUnreadCount() {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取
    
    const count = await this.notificationService.getUnreadCount(userId, corpId);
    return {
      success: true,
      data: { count },
    };
  }

  /**
   * 删除通知
   */
  @Del('/:id')
  async deleteNotification(@Param('id') id: string) {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取
    
    const result = await this.notificationService.deleteNotification(parseInt(id), userId, corpId);
    return {
      success: true,
      data: result,
      message: '删除成功',
    };
  }
}

