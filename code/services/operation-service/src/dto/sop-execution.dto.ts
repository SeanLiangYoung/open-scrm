import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 触发SOP执行DTO
 */
export class TriggerSopExecutionDto {
  @Rule(RuleType.number().required())
  templateId: number;

  @Rule(RuleType.number().valid(1, 2).required())
  targetType: number;

  @Rule(RuleType.alternatives().try(
    RuleType.number(),
    RuleType.array().items(RuleType.number())
  ).required())
  targetIds: number | number[];
}

/**
 * 查询SOP执行记录DTO
 */
export class QuerySopExecutionDto {
  @Rule(RuleType.number().optional())
  templateId?: number;

  @Rule(RuleType.number().optional())
  targetType?: number;

  @Rule(RuleType.number().optional())
  customerId?: number;

  @Rule(RuleType.number().optional())
  groupId?: number;

  @Rule(RuleType.number().valid(0, 1, 2, 3).optional())
  status?: number;

  @Rule(RuleType.date().optional())
  startTime?: Date;

  @Rule(RuleType.date().optional())
  endTime?: Date;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

/**
 * 控制执行DTO
 */
export class ControlExecutionDto {
  @Rule(RuleType.alternatives().try(
    RuleType.number(),
    RuleType.array().items(RuleType.number())
  ).required())
  executionIds: number | number[];

  @Rule(RuleType.string().valid('pause', 'resume', 'cancel').required())
  action: string;
}

