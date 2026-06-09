import { Rule, RuleType } from '@midwayjs/validate';

export class CreateContentDto {
  @Rule(RuleType.number().integer().min(1).required())
  accountId!: number;

  @Rule(RuleType.string().max(20).required())
  platform!: string;

  @Rule(RuleType.number().integer().valid(1, 2).required())
  contentType!: number;

  @Rule(RuleType.string().max(255).optional())
  title?: string;

  @Rule(RuleType.string().allow('').optional())
  content?: string;

  @Rule(RuleType.array().items(RuleType.string()).optional())
  topics?: string[];

  @Rule(RuleType.array().items(RuleType.string()).optional())
  mediaUrls?: string[];

  @Rule(RuleType.string().max(255).optional())
  coverUrl?: string;
}

export class QueryContentDto {
  @Rule(RuleType.string().optional())
  platform?: string;

  @Rule(RuleType.number().integer().valid(0, 1, 2, 3).optional())
  status?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}
