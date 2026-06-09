import { Rule, RuleType } from '@midwayjs/validate';

export class CreateContentSourceDto {
  @Rule(RuleType.string().max(255).required())
  title!: string;

  @Rule(RuleType.string().allow('').optional())
  body?: string;

  @Rule(RuleType.string().allow('').optional())
  summary?: string;

  @Rule(RuleType.array().items(RuleType.string()).optional())
  keywords?: string[];

  @Rule(RuleType.string().max(100).optional())
  tone?: string;

  @Rule(RuleType.string().max(255).optional())
  targetAudience?: string;

  @Rule(RuleType.boolean().optional())
  kbEnabled?: boolean;

  @Rule(RuleType.string().max(500).allow('').optional())
  kbQuery?: string;

  @Rule(RuleType.string().max(255).optional())
  kbProjectId?: string;
}

export class UpdateContentSourceDto {
  @Rule(RuleType.string().max(255).optional())
  title?: string;

  @Rule(RuleType.string().allow('').optional())
  body?: string;

  @Rule(RuleType.string().allow('').optional())
  summary?: string;

  @Rule(RuleType.array().items(RuleType.string()).optional())
  keywords?: string[];

  @Rule(RuleType.string().max(100).optional())
  tone?: string;

  @Rule(RuleType.string().max(255).optional())
  targetAudience?: string;

  @Rule(RuleType.boolean().optional())
  kbEnabled?: boolean;

  @Rule(RuleType.string().max(500).allow('').optional())
  kbQuery?: string;

  @Rule(RuleType.string().max(255).optional())
  kbProjectId?: string;
}

export class ListContentSourceQueryDto {
  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}
