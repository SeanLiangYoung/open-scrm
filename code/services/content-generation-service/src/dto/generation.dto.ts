import { Rule, RuleType } from '@midwayjs/validate';
import { CONTENT_CHANNEL_LIST } from '@scrm/shared-constants';

export class GenerateContentDto {
  @Rule(
    RuleType.array()
      .items(RuleType.string().valid(...CONTENT_CHANNEL_LIST))
      .min(1)
      .required()
  )
  channels!: string[];

  @Rule(RuleType.boolean().optional())
  kbEnabled?: boolean;

  @Rule(RuleType.string().max(500).allow('').optional())
  kbQuery?: string;
}

export class UpdateContentVariantDto {
  @Rule(RuleType.string().max(255).optional())
  title?: string;

  @Rule(RuleType.string().allow('').optional())
  body?: string;

  @Rule(RuleType.object().optional())
  structured?: Record<string, unknown>;
}
