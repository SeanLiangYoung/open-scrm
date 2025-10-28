import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 创建群发任务DTO
 */
export class CreateMassTaskDto {
  @Rule(RuleType.string().required())
  taskName: string;

  @Rule(RuleType.number().valid(1, 2, 3).required())
  taskType: number;

  @Rule(RuleType.number().valid(1, 2, 3).required())
  targetType: number;

  @Rule(RuleType.array().items(RuleType.number()).min(1).required())
  targetIds: number[];

  @Rule(RuleType.string().optional())
  messageContent?: string;

  @Rule(RuleType.number().optional())
  messageType?: number;

  @Rule(RuleType.any().optional())
  actionData?: any;

  @Rule(RuleType.date().optional())
  scheduledTime?: Date;
}

/**
 * 更新群发任务DTO
 */
export class UpdateMassTaskDto {
  @Rule(RuleType.string().optional())
  taskName?: string;

  @Rule(RuleType.string().optional())
  messageContent?: string;

  @Rule(RuleType.any().optional())
  actionData?: any;

  @Rule(RuleType.date().optional())
  scheduledTime?: Date;
}

/**
 * 查询群发任务DTO
 */
export class QueryMassTaskDto {
  @Rule(RuleType.string().optional())
  taskName?: string;

  @Rule(RuleType.number().optional())
  taskType?: number;

  @Rule(RuleType.number().optional())
  targetType?: number;

  @Rule(RuleType.number().valid(0, 1, 2, 3, 4).optional())
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
 * 执行群发任务DTO
 */
export class ExecuteMassTaskDto {
  @Rule(RuleType.number().required())
  taskId: number;

  @Rule(RuleType.boolean().optional())
  immediate?: boolean;
}

