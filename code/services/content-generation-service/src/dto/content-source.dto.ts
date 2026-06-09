import { Rule, RuleType } from '@midwayjs/validate';

export class KbCitationDto {
  @Rule(RuleType.string().max(500).required())
  path!: string;

  @Rule(RuleType.string().max(255).required())
  title!: string;

  @Rule(RuleType.string().max(2000).optional())
  snippet?: string;
}

export class CreateContentSourceDto {
  @Rule(RuleType.string().max(255).required())
  title!: string;

  @Rule(RuleType.string().allow('').optional())
  body?: string;

  @Rule(RuleType.string().allow('').optional())
  summary?: string;

  @Rule(RuleType.array().items(RuleType.string()).optional())
  keywords?: string[];

  @Rule(RuleType.string().max(100).allow('').optional())
  tone?: string;

  @Rule(RuleType.string().max(255).allow('').optional())
  targetAudience?: string;

  @Rule(RuleType.boolean().optional())
  kbEnabled?: boolean;

  @Rule(RuleType.string().max(500).allow('').optional())
  kbQuery?: string;

  @Rule(RuleType.string().max(255).optional())
  kbProjectId?: string;

  @Rule(RuleType.array().items(RuleType.string().max(500)).optional())
  kbSelectedPaths?: string[];

  @Rule(RuleType.array().items(RuleType.object().keys({
    path: RuleType.string().max(500).required(),
    title: RuleType.string().max(255).required(),
    snippet: RuleType.string().max(2000).optional(),
  })).optional())
  kbCitations?: KbCitationDto[];

  @Rule(RuleType.string().valid('draft', 'composed', 'finalized').optional())
  composeStatus?: 'draft' | 'composed' | 'finalized';
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

  @Rule(RuleType.string().max(100).allow('').optional())
  tone?: string;

  @Rule(RuleType.string().max(255).allow('').optional())
  targetAudience?: string;

  @Rule(RuleType.boolean().optional())
  kbEnabled?: boolean;

  @Rule(RuleType.string().max(500).allow('').optional())
  kbQuery?: string;

  @Rule(RuleType.string().max(255).optional())
  kbProjectId?: string;

  @Rule(RuleType.array().items(RuleType.string().max(500)).optional())
  kbSelectedPaths?: string[];

  @Rule(RuleType.array().items(RuleType.object().keys({
    path: RuleType.string().max(500).required(),
    title: RuleType.string().max(255).required(),
    snippet: RuleType.string().max(2000).optional(),
  })).optional())
  kbCitations?: KbCitationDto[];

  @Rule(RuleType.string().valid('draft', 'composed', 'finalized').optional())
  composeStatus?: 'draft' | 'composed' | 'finalized';
}

export class ListContentSourceQueryDto {
  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}
