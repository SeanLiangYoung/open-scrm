import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 查询消息日志DTO
 */
export class QueryMessageLogDto {
  @Rule(RuleType.number().optional())
  messageType?: number;

  @Rule(RuleType.number().optional())
  targetType?: number;

  @Rule(RuleType.number().optional())
  targetId?: number;

  @Rule(RuleType.number().valid(0, 1, 2).optional())
  sendStatus?: number;

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
 * 重试发送DTO
 */
export class RetryMessageDto {
  @Rule(RuleType.alternatives().try(
    RuleType.number(),
    RuleType.array().items(RuleType.number())
  ).required())
  logIds: number | number[];
}

