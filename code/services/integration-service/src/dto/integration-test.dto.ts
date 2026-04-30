import { Rule, RuleType } from '@midwayjs/validate';

/** Sprint 5：经 integration 测试入口转发 acquisition 扫码回写（需 ENABLE_INTEGRATION_TEST_ROUTES=1） */
export class AcquisitionChannelScanTestDto {
  @Rule(RuleType.number().required())
  channelCodeId: number;

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
