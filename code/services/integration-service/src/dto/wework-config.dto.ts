import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 创建企业微信配置DTO
 */
export class CreateWeworkConfigDto {
  @Rule(RuleType.string().required())
  corpId: string;

  @Rule(RuleType.string().required())
  corpSecret: string;

  @Rule(RuleType.number().required())
  agentId: number;

  @Rule(RuleType.string().optional())
  token?: string;

  @Rule(RuleType.string().optional())
  encodingAesKey?: string;

  @Rule(RuleType.boolean().optional())
  enabled?: boolean;
}

/**
 * 更新企业微信配置DTO
 */
export class UpdateWeworkConfigDto {
  @Rule(RuleType.string().optional())
  corpSecret?: string;

  @Rule(RuleType.number().optional())
  agentId?: number;

  @Rule(RuleType.string().optional())
  token?: string;

  @Rule(RuleType.string().optional())
  encodingAesKey?: string;

  @Rule(RuleType.boolean().optional())
  enabled?: boolean;
}

