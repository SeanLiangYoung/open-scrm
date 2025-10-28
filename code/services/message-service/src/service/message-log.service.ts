import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { MessageLogEntity } from '../entity/message-log.entity';
import { QueryMessageLogDto } from '../dto/message-log.dto';

/**
 * 消息日志服务
 */
@Provide()
export class MessageLogService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(MessageLogEntity)
  messageLogRepository!: Repository<MessageLogEntity>;

  /**
   * 查询消息日志
   */
  async queryLogs(corpId: number, query: QueryMessageLogDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.messageLogRepository
      .createQueryBuilder('log')
      .where('log.corpId = :corpId', { corpId });

    if (query.messageType !== undefined) {
      queryBuilder.andWhere('log.messageType = :messageType', {
        messageType: query.messageType,
      });
    }

    if (query.targetType !== undefined) {
      queryBuilder.andWhere('log.targetType = :targetType', {
        targetType: query.targetType,
      });
    }

    if (query.targetId !== undefined) {
      queryBuilder.andWhere('log.targetId = :targetId', {
        targetId: query.targetId,
      });
    }

    if (query.sendStatus !== undefined) {
      queryBuilder.andWhere('log.sendStatus = :sendStatus', {
        sendStatus: query.sendStatus,
      });
    }

    if (query.startTime) {
      queryBuilder.andWhere('log.createTime >= :startTime', {
        startTime: query.startTime,
      });
    }

    if (query.endTime) {
      queryBuilder.andWhere('log.createTime <= :endTime', {
        endTime: query.endTime,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('log.createTime', 'DESC');

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
   * 获取消息日志详情
   */
  async getLog(id: number, corpId: number): Promise<MessageLogEntity | null> {
    return await this.messageLogRepository.findOne({
      where: { id, corpId },
    });
  }

  /**
   * 获取发送统计
   */
  async getStatistics(corpId: number, startTime?: Date, endTime?: Date) {
    const queryBuilder = this.messageLogRepository
      .createQueryBuilder('log')
      .where('log.corpId = :corpId', { corpId });

    if (startTime) {
      queryBuilder.andWhere('log.createTime >= :startTime', { startTime });
    }

    if (endTime) {
      queryBuilder.andWhere('log.createTime <= :endTime', { endTime });
    }

    const [total, success, failed] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.clone().andWhere('log.sendStatus = 1').getCount(),
      queryBuilder.clone().andWhere('log.sendStatus = 2').getCount(),
    ]);

    return {
      total,
      success,
      failed,
      pending: total - success - failed,
      successRate: total > 0 ? ((success / total) * 100).toFixed(2) + '%' : '0%',
    };
  }
}

