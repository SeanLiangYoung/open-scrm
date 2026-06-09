import { Rule, RuleType } from '@midwayjs/validate';

export class PushDraftDto {
  @Rule(RuleType.string().max(20).required())
  platform!: string;

  @Rule(RuleType.number().integer().min(1).required())
  accountId!: number;

  @Rule(RuleType.number().integer().valid(1, 2).required())
  contentType!: number;
}
