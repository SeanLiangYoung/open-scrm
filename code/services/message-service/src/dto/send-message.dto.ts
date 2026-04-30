import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 发送消息DTO
 */
export class SendMessageDto {
  @Rule(RuleType.number().valid(1, 2, 3, 4, 5).required())
  messageType: number;

  @Rule(RuleType.number().valid(1, 2, 3).required())
  targetType: number;

  @Rule(RuleType.alternatives().try(
    RuleType.number(),
    RuleType.array().items(RuleType.number())
  ).required())
  targetIds: number | number[];

  @Rule(RuleType.string().required())
  content: string;

  @Rule(RuleType.number().optional())
  templateId?: number;

  @Rule(RuleType.any().optional())
  extra?: any;

  /** 可选；与请求头 `Idempotency-Key` 二选一或同时提供（头优先，见 MessageApiController） */
  @Rule(RuleType.string().max(128).optional())
  idempotencyKey?: string;

  /** 为 marketing 时，对客户类发送走 consent_record 闸门（Sprint 8） */
  @Rule(RuleType.string().valid('transactional', 'marketing').optional())
  consentPurpose?: 'transactional' | 'marketing';

  /** 可选；缺省为 `th-bangkok`（开发期约定）。与 RegionPack 策略（静默/日频控）绑定 */
  @Rule(RuleType.string().max(64).optional())
  regionPackId?: string;
}

/**
 * 批量发送消息DTO
 */
export class BatchSendMessageDto {
  @Rule(RuleType.number().valid(1, 2, 3, 4).required())
  messageType: number;

  @Rule(RuleType.number().valid(1, 2, 3).required())
  targetType: number;

  @Rule(RuleType.array().items(RuleType.number()).min(1).required())
  targetIds: number[];

  @Rule(RuleType.number().optional())
  templateId?: number;

  @Rule(RuleType.string().optional())
  content?: string;

  @Rule(RuleType.any().optional())
  extra?: any;
}

/**
 * 根据模板发送消息DTO
 */
export class SendByTemplateDto {
  @Rule(RuleType.number().required())
  templateId: number;

  @Rule(RuleType.number().valid(1, 2, 3).required())
  targetType: number;

  @Rule(RuleType.alternatives().try(
    RuleType.number(),
    RuleType.array().items(RuleType.number())
  ).required())
  targetIds: number | number[];

  @Rule(RuleType.object().optional())
  variables?: Record<string, string>;

  @Rule(RuleType.any().optional())
  extra?: any;
}

