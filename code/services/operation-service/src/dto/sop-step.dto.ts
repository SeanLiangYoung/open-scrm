import { Rule, RuleType } from '@midwayjs/validate';
import { sopInt32Id, validateSavedSopStep } from '../util/sop-action-validation';

/**
 * 创建SOP步骤DTO
 */
export class CreateSopStepDto {
  @Rule(RuleType.any().custom((value, helpers) => { try { return sopInt32Id(value); } catch { return helpers.error('any.invalid'); } }).required())
  templateId: number;

  @Rule(RuleType.number().required())
  stepOrder: number;

  @Rule(RuleType.string().required())
  stepName: string;

  @Rule(RuleType.number().valid(1, 2, 3, 4, 5).required())
  stepType: number;

  @Rule(RuleType.number().min(0).optional())
  delayTime?: number;

  @Rule(RuleType.string().valid('minute', 'hour', 'day').optional())
  delayUnit?: string;

  @Rule(RuleType.number().strict().integer().min(-32768).max(32767).allow(null).optional())
  actionType?: number;

  @Rule(RuleType.any().required())
  actionContent: any;
}

/**
 * 更新SOP步骤DTO
 */
export class UpdateSopStepDto {
  @Rule(RuleType.number().optional())
  stepOrder?: number;

  @Rule(RuleType.string().optional())
  stepName?: string;

  @Rule(RuleType.number().valid(1, 2, 3, 4, 5).optional())
  stepType?: number;

  @Rule(RuleType.number().min(0).optional())
  delayTime?: number;

  @Rule(RuleType.string().valid('minute', 'hour', 'day').optional())
  delayUnit?: string;

  @Rule(RuleType.number().strict().integer().min(-32768).max(32767).allow(null).optional())
  actionType?: number;

  @Rule(RuleType.any().optional())
  actionContent?: any;

  @Rule(RuleType.number().valid(0, 1).optional())
  status?: number;
}

/**
 * 批量创建步骤DTO
 */
export class BatchCreateStepsDto {
  @Rule(RuleType.any().custom((value, helpers) => { try { return sopInt32Id(value); } catch { return helpers.error('any.invalid'); } }).required())
  templateId: number;

  @Rule(RuleType.array().items(RuleType.object().unknown(true).custom((value, helpers) => { try { validateSavedSopStep(value); return value; } catch { return helpers.error('any.invalid'); } })).min(1).required())
  steps: Array<{
    stepOrder: number;
    stepName: string;
    stepType: number;
    delayTime?: number;
    delayUnit?: string;
    actionType?: number;
    actionContent: any;
  }>;
}

