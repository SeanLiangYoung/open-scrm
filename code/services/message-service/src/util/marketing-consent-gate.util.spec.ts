import { describe, it, expect, vi } from 'vitest';
import { resolveMarketingConsentGate } from './marketing-consent-gate.util';

describe('resolveMarketingConsentGate', () => {
  it('consentPurpose 缺省或非 marketing 时不拦截', async () => {
    const check = vi.fn();
    expect(
      await resolveMarketingConsentGate(1, { targetType: 1, targetIds: [1] }, check)
    ).toBeNull();
    expect(
      await resolveMarketingConsentGate(
        1,
        { consentPurpose: 'transactional', targetType: 1, targetIds: [1] },
        check
      )
    ).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it('marketing 且 targetType 非 1 时返回 400', async () => {
    const r = await resolveMarketingConsentGate(
      1,
      { consentPurpose: 'marketing', targetType: 2, targetIds: [1] },
      vi.fn()
    );
    expect(r?.status).toBe(400);
    expect(r?.body.success).toBe(false);
  });

  it('marketing 且任一客户无同意时返回 403', async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const r = await resolveMarketingConsentGate(
      1,
      { consentPurpose: 'marketing', targetType: 1, targetIds: [1, 2] },
      check
    );
    expect(r?.status).toBe(403);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('marketing 且全部客户有同意时返回 null', async () => {
    const check = vi.fn().mockResolvedValue(true);
    const r = await resolveMarketingConsentGate(
      1,
      { consentPurpose: 'marketing', targetType: 1, targetIds: 3 },
      check
    );
    expect(r).toBeNull();
    expect(check).toHaveBeenCalledWith(1, 3);
  });
});
