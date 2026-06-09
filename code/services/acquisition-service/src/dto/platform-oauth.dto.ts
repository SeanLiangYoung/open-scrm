import { Rule, RuleType } from '@midwayjs/validate';

export class ConnectPlatformAccountDto {
  @Rule(RuleType.string().max(500).required())
  accessToken!: string;

  @Rule(RuleType.string().max(500).optional())
  refreshToken?: string;

  @Rule(RuleType.date().optional())
  expiresTime?: Date;
}
