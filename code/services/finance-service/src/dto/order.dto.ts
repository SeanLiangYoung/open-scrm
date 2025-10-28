import { Rule, RuleType } from '@midwayjs/validate';

export class CreateOrderDto {
  @Rule(RuleType.string().required())
  productName: string;

  @Rule(RuleType.number().valid(1, 2).required())
  productType: number; // 1-套餐 2-增值服务

  @Rule(RuleType.number().positive().required())
  amount: number;

  @Rule(RuleType.number().min(0).optional())
  discountAmount?: number;

  @Rule(RuleType.object().optional())
  detail?: any;

  @Rule(RuleType.string().optional())
  remark?: string;
}

export class QueryOrderDto {
  @Rule(RuleType.string().optional())
  orderNo?: string;

  @Rule(RuleType.number().optional())
  status?: number;

  @Rule(RuleType.string().optional())
  startTime?: string;

  @Rule(RuleType.string().optional())
  endTime?: string;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

export class CancelOrderDto {
  @Rule(RuleType.string().optional())
  reason?: string;
}

