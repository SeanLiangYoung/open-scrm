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

export class IngestChannelScanDto {
  /** 外部事件唯一标识，用于幂等（如企微 EventKey + CreateTime） */
  @Rule(RuleType.string().max(128).optional())
  externalEventId?: string;

  @Rule(RuleType.string().max(255).optional())
  utm_campaign?: string;

  @Rule(RuleType.string().max(128).optional())
  creative_id?: string;

  @Rule(RuleType.string().max(64).optional())
  region_pack_id?: string;

  @Rule(RuleType.string().max(64).optional())
  utm_source?: string;

  @Rule(RuleType.string().max(64).optional())
  utm_medium?: string;
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

