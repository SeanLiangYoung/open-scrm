import { Rule, RuleType } from '@midwayjs/validate';

export class CreateTagDto {
  @Rule(RuleType.string().required().max(50))
  tagName: string;

  @Rule(RuleType.number().integer().min(1).max(4).optional())
  tagType?: number = 1;

  @Rule(RuleType.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional())
  tagColor?: string;

  @Rule(RuleType.number().integer().min(0).optional())
  parentId?: number = 0;

  @Rule(RuleType.number().integer().min(0).optional())
  sort?: number = 0;

  @Rule(RuleType.number().integer().min(0).max(1).optional())
  isAuto?: number = 0;
}

