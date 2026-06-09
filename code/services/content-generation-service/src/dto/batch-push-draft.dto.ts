import { Rule, RuleType } from '@midwayjs/validate';

export class PushDraftItemDto {
  @Rule(RuleType.number().integer().min(1).required())
  variantId!: number;

  @Rule(RuleType.string().max(20).required())
  platform!: string;

  @Rule(RuleType.number().integer().min(1).required())
  accountId!: number;

  @Rule(RuleType.number().integer().valid(1, 2).required())
  contentType!: number;
}

export class BatchPushDraftsDto {
  @Rule(RuleType.array().items(RuleType.object().keys({
    variantId: RuleType.number().integer().min(1).required(),
    platform: RuleType.string().max(20).required(),
    accountId: RuleType.number().integer().min(1).required(),
    contentType: RuleType.number().integer().valid(1, 2).required(),
  })).min(1).required())
  items!: PushDraftItemDto[];
}
