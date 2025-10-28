import { Rule, RuleType } from '@midwayjs/validate';

export class QueryCustomerDto {
  @Rule(RuleType.number().integer().min(1).optional())
  page?: number = 1;

  @Rule(RuleType.number().integer().min(1).max(100).optional())
  pageSize?: number = 20;

  @Rule(RuleType.string().optional())
  keyword?: string;

  @Rule(RuleType.number().integer().min(0).max(2).optional())
  status?: number;

  @Rule(RuleType.number().integer().min(1).max(2).optional())
  type?: number;

  @Rule(RuleType.number().integer().positive().optional())
  followUserId?: number;

  @Rule(RuleType.string().optional())
  channel?: string;

  @Rule(RuleType.array().items(RuleType.number().integer()).optional())
  tagIds?: number[];

  @Rule(RuleType.date().optional())
  startTime?: Date;

  @Rule(RuleType.date().optional())
  endTime?: Date;
}

