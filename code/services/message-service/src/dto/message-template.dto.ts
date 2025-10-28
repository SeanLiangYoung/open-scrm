import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 创建消息模板DTO
 */
export class CreateMessageTemplateDto {
  @Rule(RuleType.string().required())
  templateName: string;

  @Rule(RuleType.number().valid(1, 2, 3, 4, 5).required())
  templateType: number;

  @Rule(RuleType.number().valid(1, 2, 3, 4).required())
  messageType: number;

  @Rule(RuleType.string().required())
  content: string;

  @Rule(RuleType.any().optional())
  extra?: any;
}

/**
 * 更新消息模板DTO
 */
export class UpdateMessageTemplateDto {
  @Rule(RuleType.string().optional())
  templateName?: string;

  @Rule(RuleType.number().valid(1, 2, 3, 4, 5).optional())
  templateType?: number;

  @Rule(RuleType.string().optional())
  content?: string;

  @Rule(RuleType.any().optional())
  extra?: any;

  @Rule(RuleType.number().valid(0, 1).optional())
  status?: number;
}

/**
 * 查询消息模板DTO
 */
export class QueryMessageTemplateDto {
  @Rule(RuleType.string().optional())
  templateName?: string;

  @Rule(RuleType.number().optional())
  templateType?: number;

  @Rule(RuleType.number().optional())
  messageType?: number;

  @Rule(RuleType.number().optional())
  status?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

