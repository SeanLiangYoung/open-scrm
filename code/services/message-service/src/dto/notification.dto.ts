import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 创建通知DTO
 */
export class CreateNotificationDto {
  @Rule(RuleType.alternatives().try(
    RuleType.number(),
    RuleType.array().items(RuleType.number())
  ).required())
  userIds: number | number[];

  @Rule(RuleType.number().valid(1, 2, 3).required())
  notificationType: number;

  @Rule(RuleType.string().max(200).required())
  title: string;

  @Rule(RuleType.string().required())
  content: string;

  @Rule(RuleType.string().uri().optional())
  linkUrl?: string;

  @Rule(RuleType.any().optional())
  extra?: any;

  @Rule(RuleType.number().optional())
  expireDays?: number;
}

/**
 * 查询通知DTO
 */
export class QueryNotificationDto {
  @Rule(RuleType.number().optional())
  notificationType?: number;

  @Rule(RuleType.number().valid(0, 1).optional())
  isRead?: number;

  @Rule(RuleType.date().optional())
  startTime?: Date;

  @Rule(RuleType.date().optional())
  endTime?: Date;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

/**
 * 标记已读DTO
 */
export class MarkReadDto {
  @Rule(RuleType.alternatives().try(
    RuleType.number(),
    RuleType.array().items(RuleType.number())
  ).required())
  notificationIds: number | number[];
}

