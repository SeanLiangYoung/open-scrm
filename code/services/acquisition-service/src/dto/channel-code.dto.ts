import { Rule, RuleType } from '@midwayjs/validate';

export class CreateChannelCodeDto {
  @Rule(RuleType.string().required())
  codeName: string;

  @Rule(RuleType.string().required())
  channel: string;

  @Rule(RuleType.array().items(RuleType.number()).optional())
  staffIds?: number[];

  @Rule(RuleType.string().optional())
  welcomeMsg?: string;

  @Rule(RuleType.array().items(RuleType.number()).optional())
  autoTagIds?: number[];
}

export class QueryChannelCodeDto {
  @Rule(RuleType.string().optional())
  codeName?: string;

  @Rule(RuleType.string().optional())
  channel?: string;

  @Rule(RuleType.number().optional())
  status?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

