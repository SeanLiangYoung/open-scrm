import { Rule, RuleType } from '@midwayjs/validate';

export class QueryDailyStatDto {
  @Rule(RuleType.string().required())
  startDate: string;

  @Rule(RuleType.string().required())
  endDate: string;
}

export class QueryChannelStatDto {
  @Rule(RuleType.string().required())
  startDate: string;

  @Rule(RuleType.string().required())
  endDate: string;

  @Rule(RuleType.string().optional())
  channel?: string;
}

export class QueryStaffStatDto {
  @Rule(RuleType.string().required())
  startDate: string;

  @Rule(RuleType.string().required())
  endDate: string;

  @Rule(RuleType.number().optional())
  staffId?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

/** GET /funnel-gap-placeholder 可选查询窗（UTC 日历日） */
export class QueryFunnelGapDto {
  @Rule(RuleType.string().optional())
  startDate?: string;

  @Rule(RuleType.string().optional())
  endDate?: string;
}

export class OverviewStatDto {
  @Rule(RuleType.string().optional())
  date?: string;
}

/** 手动触发日聚合（仅当前登录企业） */
export class AggregateDailyDto {
  @Rule(RuleType.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional())
  statDate?: string;
}

