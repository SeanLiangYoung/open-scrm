import { Rule, RuleType } from '@midwayjs/validate';

export class CreateTagDto {
  @Rule(RuleType.string().trim().min(1).max(50).required())
  tagName: string;

  @Rule(RuleType.number().integer().min(1).max(4).strict().optional())
  tagType?: number = 1;

  @Rule(RuleType.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional())
  tagColor?: string;

  @Rule(RuleType.number().integer().min(0).max(2147483647).strict().optional())
  parentId?: number = 0;

  @Rule(RuleType.number().integer().min(0).max(2147483647).strict().optional())
  sort?: number = 0;

  @Rule(RuleType.number().integer().min(0).max(1).strict().optional())
  isAuto?: number = 0;
}

