import { Rule, RuleType } from '@midwayjs/validate';

export class CreateCategoryDto {
  @Rule(RuleType.string().required())
  name: string;

  @Rule(RuleType.number().integer().min(0).max(2147483647).strict().optional())
  parentId?: number;

  @Rule(RuleType.number().optional())
  sort?: number;
}

export class UpdateCategoryDto {
  @Rule(RuleType.string().optional())
  name?: string;

  @Rule(RuleType.number().integer().min(0).max(2147483647).strict().optional())
  parentId?: number;

  @Rule(RuleType.number().optional())
  sort?: number;
}
