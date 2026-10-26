import { Rule, RuleType } from '@midwayjs/validate';

export class UpdateCustomerDto {
  @Rule(RuleType.string().max(100).optional())
  name?: string;

  @Rule(RuleType.string().pattern(/^1[3-9]\d{9}$/).allow(null).optional())
  mobile?: string | null;

  @Rule(RuleType.string().uri().optional())
  avatar?: string;

  @Rule(RuleType.number().integer().min(0).max(2).optional())
  gender?: number;

  @Rule(RuleType.string().max(50).optional())
  province?: string;

  @Rule(RuleType.string().max(50).optional())
  city?: string;

  @Rule(RuleType.number().integer().positive().max(Number.MAX_SAFE_INTEGER).strict().allow(null).optional())
  followUserId?: number | null;

  @Rule(RuleType.number().integer().min(0).max(2).optional())
  status?: number;

  @Rule(RuleType.string().allow(null).optional())
  remark?: string | null;
}

