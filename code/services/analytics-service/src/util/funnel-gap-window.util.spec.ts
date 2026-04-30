import { describe, it, expect } from 'vitest';
import { resolveFunnelGapWindow } from './funnel-gap-window.util';

describe('resolveFunnelGapWindow', () => {
  const fixed = new Date('2026-04-15T12:00:00.000Z');

  it('未传参时默认约 31 天窗口，end 为「次日 0 点 UTC」排他上界', () => {
    const { start, endExclusive } = resolveFunnelGapWindow({}, fixed);
    expect(endExclusive.toISOString()).toBe('2026-04-16T00:00:00.000Z');
    const days = (endExclusive.getTime() - start.getTime()) / 86400000;
    expect(days).toBe(31);
  });

  it('显式 startDate/endDate 解析为 UTC 日界', () => {
    const { start, endExclusive } = resolveFunnelGapWindow(
      { startDate: '2026-04-01', endDate: '2026-04-03' },
      fixed
    );
    expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-04-04T00:00:00.000Z');
  });

  it('窗口超过 93 天抛错', () => {
    expect(() =>
      resolveFunnelGapWindow(
        { startDate: '2026-01-01', endDate: '2026-04-15' },
        fixed
      )
    ).toThrow(/93/);
  });

  it('仅传 start 或仅传 end 抛错', () => {
    expect(() => resolveFunnelGapWindow({ startDate: '2026-04-01' }, fixed)).toThrow(/成对/);
    expect(() => resolveFunnelGapWindow({ endDate: '2026-04-01' }, fixed)).toThrow(/成对/);
  });
});
