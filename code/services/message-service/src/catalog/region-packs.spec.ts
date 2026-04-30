import { describe, it, expect } from 'vitest';
import { getRegionPackById, listRegionPackIds, REGION_PACKS } from './region-packs';

describe('region-packs catalog', () => {
  it('至少包含 th-bangkok 与 de-berlin', () => {
    const ids = listRegionPackIds();
    expect(ids).toContain('th-bangkok');
    expect(ids).toContain('de-berlin');
    expect(REGION_PACKS.length).toBeGreaterThanOrEqual(2);
  });

  it('getRegionPackById 返回对应 Pack 与合规模式', () => {
    const th = getRegionPackById('th-bangkok');
    expect(th?.countryCode).toBe('TH');
    expect(th?.defaultIm).toBe('LINE_OA');
    const de = getRegionPackById('de-berlin');
    expect(de?.marketingConsentMode).toBe('strict_opt_in');
  });

  it('th-bangkok 含营销日频控与本地静默窗', () => {
    const th = getRegionPackById('th-bangkok');
    expect(th?.maxMarketingSendsPerRecipientPerDay).toBe(10);
    expect(th?.silentLocalHours).toEqual({ start: '22:00', end: '08:00' });
  });

  it('de-berlin 默认更严的日频控', () => {
    const de = getRegionPackById('de-berlin');
    expect(de?.maxMarketingSendsPerRecipientPerDay).toBe(3);
    expect(de?.silentLocalHours).toEqual({ start: '21:00', end: '07:00' });
  });

  it('test-e2e-policy 供 Sprint9 频控 E2E（UTC、低 cap、静默关闭）', () => {
    const p = getRegionPackById('test-e2e-policy');
    expect(p).toBeTruthy();
    expect(p?.timezone).toBe('UTC');
    expect(p?.maxMarketingSendsPerRecipientPerDay).toBe(3);
    expect(p?.silentLocalHours).toEqual({ start: '00:00', end: '00:00' });
  });
});
