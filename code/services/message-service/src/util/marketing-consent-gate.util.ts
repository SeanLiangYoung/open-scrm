import type { SendMessageDto } from '../dto/send-message.dto';

/** 由 ConsentRecordService 或单测注入：是否对客户存在未撤回的 marketing 同意 */
export type MarketingConsentChecker = (
  corpId: number,
  customerId: number
) => Promise<boolean>;

/**
 * consentPurpose=marketing 时：仅支持客户 target；逐客户校验同意，不满足则返回 HTTP 状态与响应体。
 */
export async function resolveMarketingConsentGate(
  corpId: number,
  dto: Pick<SendMessageDto, 'consentPurpose' | 'targetType' | 'targetIds'>,
  check: MarketingConsentChecker
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  if (dto.consentPurpose !== 'marketing') {
    return null;
  }
  if (dto.targetType !== 1) {
    return {
      status: 400,
      body: {
        success: false,
        message: '营销同意校验仅支持 targetType=客户(1)',
      },
    };
  }
  const ids = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
  for (const customerId of ids) {
    const ok = await check(corpId, customerId);
    if (!ok) {
      return {
        status: 403,
        body: {
          success: false,
          message: '无有效营销同意（consent_record 中无未撤回的 marketing 记录）',
        },
      };
    }
  }
  return null;
}
