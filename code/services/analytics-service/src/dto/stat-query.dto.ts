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

export class OverviewStatDto {
  @Rule(RuleType.string().optional())
  date?: string;
}

