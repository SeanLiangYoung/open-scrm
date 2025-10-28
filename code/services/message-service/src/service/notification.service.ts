import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { NotificationEntity } from '../entity/notification.entity';
import { CreateNotificationDto, QueryNotificationDto } from '../dto/notification.dto';

/**
 * 通知服务
 */
@Provide()
export class NotificationService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(NotificationEntity)
  notificationRepository!: Repository<NotificationEntity>;

  @Config('message.notification')
  notificationConfig: any;

  /**
   * 创建通知
   */
  async createNotification(corpId: number, dto: CreateNotificationDto) {
    const userIds = Array.isArray(dto.userIds) ? dto.userIds : [dto.userIds];
    const expireDays = dto.expireDays || this.notificationConfig.defaultExpireDays || 30;
    const expireTime = new Date();
    expireTime.setDate(expireTime.getDate() + expireDays);

    const notifications = userIds.map(userId => 
      this.notificationRepository.create({
        corpId,
        userId,
        notificationType: dto.notificationType,
        title: dto.title,
        content: dto.content,
        linkUrl: dto.linkUrl,
        extra: dto.extra,
        expireTime,
      })
    );

    await this.notificationRepository.save(notifications);

    return {
      success: true,
      count: notifications.length,
    };
  }

  /**
   * 查询用户通知列表
   */
  async queryNotifications(userId: number, corpId: number, query: QueryNotificationDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.corpId = :corpId', { corpId });

    if (query.notificationType !== undefined) {
      queryBuilder.andWhere('notification.notificationType = :notificationType', {
        notificationType: query.notificationType,
      });
    }

    if (query.isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', {
        isRead: query.isRead,
      });
    }

    if (query.startTime) {
      queryBuilder.andWhere('notification.createTime >= :startTime', {
        startTime: query.startTime,
      });
    }

    if (query.endTime) {
      queryBuilder.andWhere('notification.createTime <= :endTime', {
        endTime: query.endTime,
      });
    }

    // 只查询未过期的
    queryBuilder.andWhere('(notification.expireTime IS NULL OR notification.expireTime > NOW())');

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('notification.createTime', 'DESC');

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
   * 标记已读
   */
  async markAsRead(userId: number, corpId: number, notificationIds: number | number[]) {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    
    const result = await this.notificationRepository.update(
      {
        id: In(ids),
        userId,
        corpId,
        isRead: 0,
      },
      {
        isRead: 1,
        readTime: new Date(),
      }
    );

    return {
      success: true,
      count: result.affected || 0,
    };
  }

  /**
   * 全部标记已读
   */
  async markAllAsRead(userId: number, corpId: number) {
    const result = await this.notificationRepository.update(
      {
        userId,
        corpId,
        isRead: 0,
      },
      {
        isRead: 1,
        readTime: new Date(),
      }
    );

    return {
      success: true,
      count: result.affected || 0,
    };
  }

  /**
   * 获取未读数量
   */
  async getUnreadCount(userId: number, corpId: number): Promise<number> {
    return await this.notificationRepository.count({
      where: {
        userId,
        corpId,
        isRead: 0,
      },
    });
  }

  /**
   * 删除通知
   */
  async deleteNotification(id: number, userId: number, corpId: number) {
    const result = await this.notificationRepository.delete({
      id,
      userId,
      corpId,
    });

    if (result.affected === 0) {
      throw new Error('通知不存在');
    }

    return { success: true };
  }

  /**
   * 清理过期通知（定时任务）
   */
  async cleanExpiredNotifications() {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .where('expireTime IS NOT NULL')
      .andWhere('expireTime < NOW()')
      .execute();

    return {
      success: true,
      count: result.affected || 0,
    };
  }
}

