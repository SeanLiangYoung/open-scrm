import { Rule, RuleType } from '@midwayjs/validate';

export class ComposeContentSourceDto {
  @Rule(RuleType.array().items(RuleType.string().max(500)).min(1).max(5).optional())
  paths?: string[];

  @Rule(RuleType.string().max(100).allow('').optional())
  tone?: string;

  @Rule(RuleType.string().max(255).allow('').optional())
  targetAudience?: string;

  @Rule(RuleType.string().max(2000).allow('').optional())
  instruction?: string;
}
