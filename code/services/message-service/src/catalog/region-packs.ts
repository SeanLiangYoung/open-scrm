/**
 * Sprint 8：RegionPack 静态目录（可被 message-service 与其它模块 import；后续可换 DB/配置中心）
 * 与 docs/facts/outbound-private-domain-region-matrix.md 对齐的最小字段。
 */
/** 本地时间 HH:mm（24h），跨日静默用 start > end 的语义在策略函数中解析 */
export type SilentLocalHours = { start: string; end: string };

export interface RegionPack {
  id: string;
  countryCode: string;
  city?: string;
  defaultIm: string;
  timezone: string;
  marketingConsentMode: 'relaxed' | 'strict_opt_in';
  /** 每接收方每自然日（按 timezone 切日）营销发送上限 */
  maxMarketingSendsPerRecipientPerDay: number;
  /** 本地静默：如 22:00–08:00 表示跨夜不可发 */
  silentLocalHours: SilentLocalHours;
}

export const REGION_PACKS: readonly RegionPack[] = [
  {
    id: 'th-bangkok',
    countryCode: 'TH',
    city: 'Bangkok',
    defaultIm: 'LINE_OA',
    timezone: 'Asia/Bangkok',
    marketingConsentMode: 'relaxed',
    maxMarketingSendsPerRecipientPerDay: 10,
    silentLocalHours: { start: '22:00', end: '08:00' },
  },
  {
    id: 'de-berlin',
    countryCode: 'DE',
    city: 'Berlin',
    defaultIm: 'WHATSAPP',
    timezone: 'Europe/Berlin',
    marketingConsentMode: 'strict_opt_in',
    maxMarketingSendsPerRecipientPerDay: 3,
    silentLocalHours: { start: '21:00', end: '07:00' },
  },
  /** E2E / 自动化：静默窗关闭（start===end 时不生效），日频控=3 便于断言第 4 次 429 */
  {
    id: 'test-e2e-policy',
    countryCode: 'XX',
    city: 'Test',
    defaultIm: 'MOCK',
    timezone: 'UTC',
    marketingConsentMode: 'relaxed',
    maxMarketingSendsPerRecipientPerDay: 3,
    silentLocalHours: { start: '00:00', end: '00:00' },
  },
] as const;

export function getRegionPackById(id: string): RegionPack | undefined {
  return REGION_PACKS.find(p => p.id === id);
}

export function listRegionPackIds(): string[] {
  return [...new Set(REGION_PACKS.map(p => p.id))];
}
