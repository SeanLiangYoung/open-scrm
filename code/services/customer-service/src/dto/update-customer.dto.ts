import { Rule, RuleType } from '@midwayjs/validate';

export class UpdateCustomerDto {
  @Rule(RuleType.string().max(100).optional())
  name?: string;

  @Rule(RuleType.string().pattern(/^1[3-9]\d{9}$/).optional())
  mobile?: string;

  @Rule(RuleType.string().uri().optional())
  avatar?: string;

  @Rule(RuleType.number().integer().min(0).max(2).optional())
  gender?: number;

  @Rule(RuleType.string().max(50).optional())
  province?: string;

  @Rule(RuleType.string().max(50).optional())
  city?: string;

  @Rule(RuleType.number().integer().positive().optional())
  followUserId?: number;

  @Rule(RuleType.number().integer().min(0).max(2).optional())
  status?: number;

  @Rule(RuleType.string().optional())
  remark?: string;
}

