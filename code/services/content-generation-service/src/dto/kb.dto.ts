import { Rule, RuleType } from '@midwayjs/validate';

export class KbSearchDto {
  @Rule(RuleType.string().min(1).max(500).required())
  query!: string;

  @Rule(RuleType.number().min(1).max(50).optional())
  topK?: number;

  @Rule(RuleType.boolean().optional())
  includeContent?: boolean;

  @Rule(RuleType.string().max(255).optional())
  projectId?: string;
}
