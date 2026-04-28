import { Rule, RuleType } from '@midwayjs/validate';

/** Sprint 5：经 integration 测试入口转发 acquisition 扫码回写（需 ENABLE_INTEGRATION_TEST_ROUTES=1） */
export class AcquisitionChannelScanTestDto {
  @Rule(RuleType.number().required())
  channelCodeId: number;

  @Rule(RuleType.string().max(128).optional())
  externalEventId?: string;
}
