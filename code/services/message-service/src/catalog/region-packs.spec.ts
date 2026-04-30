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
});
