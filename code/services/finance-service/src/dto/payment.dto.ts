import { Rule, RuleType } from '@midwayjs/validate';

export class CreatePaymentDto {
  @Rule(RuleType.number().required())
  orderId: number;

  @Rule(RuleType.string().valid('wechat', 'alipay').required())
  paymentMethod: string;
}

export class PaymentCallbackDto {
  @Rule(RuleType.string().required())
  orderNo: string;

  @Rule(RuleType.string().required())
  transactionId: string;

  @Rule(RuleType.object().optional())
  detail?: any;
}

export class RefundDto {
  @Rule(RuleType.number().required())
  orderId: number;

  @Rule(RuleType.number().positive().required())
  refundAmount: number;

  @Rule(RuleType.string().optional())
  reason?: string;
}

