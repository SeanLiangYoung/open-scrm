import { Rule, RuleType } from '@midwayjs/validate';

export class UpdateCodMockStateDto {
  @Rule(
    RuleType.string()
      .valid('intent', 'awaiting_payment_proof', 'shipped', 'delivered')
      .required()
  )
  state!: string;
}
