/**
 * Sprint 8：RegionPack 静态目录（可被 message-service 与其它模块 import；后续可换 DB/配置中心）
 * 与 docs/facts/outbound-private-domain-region-matrix.md 对齐的最小字段。
 */
export interface RegionPack {
  id: string;
  countryCode: string;
  city?: string;
  defaultIm: string;
  timezone: string;
  marketingConsentMode: 'relaxed' | 'strict_opt_in';
}

export const REGION_PACKS: readonly RegionPack[] = [
  {
    id: 'th-bangkok',
    countryCode: 'TH',
    city: 'Bangkok',
    defaultIm: 'LINE_OA',
    timezone: 'Asia/Bangkok',
    marketingConsentMode: 'relaxed',
  },
  {
    id: 'de-berlin',
    countryCode: 'DE',
    city: 'Berlin',
    defaultIm: 'WHATSAPP',
    timezone: 'Europe/Berlin',
    marketingConsentMode: 'strict_opt_in',
  },
] as const;

export function getRegionPackById(id: string): RegionPack | undefined {
  return REGION_PACKS.find(p => p.id === id);
}

export function listRegionPackIds(): string[] {
  return [...new Set(REGION_PACKS.map(p => p.id))];
}
