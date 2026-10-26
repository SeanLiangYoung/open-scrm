import { Rule, RuleType } from '@midwayjs/validate';
import { validateSavedSopStep, validateSopTemplateName } from '../util/sop-action-validation';

/**
 * 创建SOP模板DTO
 */
export class CreateSopTemplateDto {
  @Rule(RuleType.string().custom((value, helpers) => { try { validateSopTemplateName(value); return value; } catch { return helpers.error('any.invalid'); } }).required())
  templateName: string;

  @Rule(RuleType.number().valid(1, 2).required())
  templateType: number;

  @Rule(RuleType.number().valid(1, 2, 3, 4).required())
  triggerType: number;

  @Rule(RuleType.any().optional())
  triggerCondition?: any;

  @Rule(RuleType.string().optional())
  description?: string;

  @Rule(RuleType.array().items(RuleType.object().unknown(true).custom((value, helpers) => { try { validateSavedSopStep(value); if (helpers.state.ancestors[1]?.templateType === 2 && [2, 4].includes(value.stepType)) return helpers.error('any.invalid'); return value; } catch { return helpers.error('any.invalid'); } })).min(1).optional())
  steps?: any[];
}

/**
 * 更新SOP模板DTO
 */
export class UpdateSopTemplateDto {
  @Rule(RuleType.string().custom((value, helpers) => { try { validateSopTemplateName(value); return value; } catch { return helpers.error('any.invalid'); } }).optional())
  templateName?: string;

  @Rule(RuleType.number().valid(1, 2).optional())
  templateType?: number;

  @Rule(RuleType.number().valid(1, 2, 3, 4).optional())
  triggerType?: number;

  @Rule(RuleType.any().optional())
  triggerCondition?: any;

  @Rule(RuleType.string().allow(null).optional())
  description?: string | null;

  @Rule(RuleType.number().valid(0, 1).optional())
  status?: number;
}

/**
 * 查询SOP模板DTO
 */
export class QuerySopTemplateDto {
  @Rule(RuleType.string().custom((value, helpers) => { try { validateSopTemplateName(value); return value; } catch { return helpers.error('any.invalid'); } }).optional())
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

