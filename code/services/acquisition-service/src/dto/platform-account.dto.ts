import { Rule, RuleType } from '@midwayjs/validate';

export class CreatePlatformAccountDto {
  @Rule(RuleType.string().valid('douyin', 'xiaohongshu').required())
  platform: string;

  @Rule(RuleType.string().optional())
  accountName?: string;

  @Rule(RuleType.string().optional())
  accountId?: string;

  @Rule(RuleType.string().optional())
  accessToken?: string;

  @Rule(RuleType.string().optional())
  refreshToken?: string;
}

export class QueryPlatformAccountDto {
  @Rule(RuleType.string().optional())
  platform?: string;

  @Rule(RuleType.number().optional())
  status?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

