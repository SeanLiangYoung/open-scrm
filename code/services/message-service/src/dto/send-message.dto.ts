import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 发送消息DTO
 */
export class SendMessageDto {
  @Rule(RuleType.number().valid(1, 2, 3, 4).required())
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

