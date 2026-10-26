import { Rule, RuleType } from '@midwayjs/validate';
/** No create defaults: omitted metadata must remain unchanged. */
export class UpdateTagDto {
  @Rule(RuleType.string().trim().min(1).max(50).optional())
  tagName?: string;
  @Rule(RuleType.number().integer().min(1).max(4).strict().optional())
  tagType?: number;
  @Rule(RuleType.string().pattern(/^#[0-9A-Fa-f]{6}$/).allow(null).optional())
  tagColor?: string | null;
  @Rule(RuleType.number().integer().min(0).max(2147483647).strict().optional())
  parentId?: number;
  @Rule(RuleType.number().integer().min(0).max(2147483647).strict().optional())
  sort?: number;
  @Rule(RuleType.number().integer().min(0).max(1).strict().optional())
  isAuto?: number;
}
