import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 创建SOP模板DTO
 */
export class CreateSopTemplateDto {
  @Rule(RuleType.string().required())
  templateName: string;

  @Rule(RuleType.number().valid(1, 2).required())
  templateType: number;

  @Rule(RuleType.number().valid(1, 2, 3, 4).required())
  triggerType: number;

  @Rule(RuleType.any().optional())
  triggerCondition?: any;

  @Rule(RuleType.string().optional())
  description?: string;

  @Rule(RuleType.array().items(RuleType.object()).optional())
  steps?: any[];
}

/**
 * 更新SOP模板DTO
 */
export class UpdateSopTemplateDto {
  @Rule(RuleType.string().optional())
  templateName?: string;

  @Rule(RuleType.number().valid(1, 2).optional())
  templateType?: number;

  @Rule(RuleType.number().valid(1, 2, 3, 4).optional())
  triggerType?: number;

  @Rule(RuleType.any().optional())
  triggerCondition?: any;

  @Rule(RuleType.string().optional())
  description?: string;

  @Rule(RuleType.number().valid(0, 1).optional())
  status?: number;
}

/**
 * 查询SOP模板DTO
 */
export class QuerySopTemplateDto {
  @Rule(RuleType.string().optional())
  templateName?: string;

  @Rule(RuleType.number().optional())
  templateType?: number;

  @Rule(RuleType.number().optional())
  triggerType?: number;

  @Rule(RuleType.number().optional())
  status?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

