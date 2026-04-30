import { describe, it, expect } from 'vitest';
import { evaluateOutboundSendPolicy } from './outbound-send-policy.util';
import { getRegionPackById } from '../catalog/region-packs';

describe('evaluateOutboundSendPolicy', () => {
  const th = getRegionPackById('th-bangkok')!;

  it('当日已发次数达到上限时拒绝 frequency_cap', () => {
    const r = evaluateOutboundSendPolicy({
      now: new Date('2026-06-15T08:00:00.000Z'),
      pack: th,
      localSendCountForDay: th.maxMarketingSendsPerRecipientPerDay,
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe('frequency_cap');
  });

  it('未达上限且非静默窗时允许', () => {
    const r = evaluateOutboundSendPolicy({
      now: new Date('2026-06-15T08:00:00.000Z'),
      pack: th,
      localSendCountForDay: th.maxMarketingSendsPerRecipientPerDay - 1,
    });
    expect(r.allowed).toBe(true);
    expect(r.reasonCode).toBeUndefined();
  });

  it('落在本地静默窗内时拒绝 silent_hours（Asia/Bangkok 22:30）', () => {
    const r = evaluateOutboundSendPolicy({
      now: new Date('2026-06-15T15:30:00.000Z'),
      pack: th,
      localSendCountForDay: 0,
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe('silent_hours');
  });
});
