import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 触发同步DTO
 */
export class TriggerSyncDto {
  @Rule(RuleType.string().valid('department', 'user', 'customer', 'full').required())
  syncType: 'department' | 'user' | 'customer' | 'full';

  @Rule(RuleType.boolean().optional())
  force?: boolean;
}

/**
 * 查询同步日志DTO
 */
export class QuerySyncLogDto {
  @Rule(RuleType.string().optional())
  syncType?: string;

  @Rule(RuleType.string().optional())
  status?: string;

  @Rule(RuleType.date().optional())
  startTime?: Date;

  @Rule(RuleType.date().optional())
  endTime?: Date;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

