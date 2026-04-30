import { describe, it, expect } from 'vitest';
import { computeAttributionGapMetrics } from './funnel-gap.util';

describe('computeAttributionGapMetrics', () => {
  it('总量为 0 时两率为 0', () => {
    expect(
      computeAttributionGapMetrics({
        sendsTotal: 0,
        sendsWithTouchHint: 0,
        customersTotal: 0,
        customersWithAttribution: 0,
      })
    ).toEqual({ messageAttributionGapRate: 0, customerUnlinkedRate: 0 });
  });

  it('按占位公式计算缺口率', () => {
    expect(
      computeAttributionGapMetrics({
        sendsTotal: 10,
        sendsWithTouchHint: 8,
        customersTotal: 100,
        customersWithAttribution: 90,
      })
    ).toEqual({
      messageAttributionGapRate: 0.2,
      customerUnlinkedRate: 0.1,
    });
  });
});
