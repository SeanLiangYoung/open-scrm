import { describe, it, expect, vi } from 'vitest';
import { FunnelGapQueryService } from './funnel-gap-query.service';

describe('FunnelGapQueryService', () => {
  it('aggregateOltp 将单行聚合结果规范为数字', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        sendsTotal: 10,
        sendsWithTouchHint: 8,
        customersTotal: 100,
        customersWithAttribution: 90,
        channelScanTouchCount: 3,
      },
    ]);
    const svc = new FunnelGapQueryService();
    (svc as unknown as { dataSource: { query: typeof query } }).dataSource = { query };

    const row = await svc.aggregateOltp(1, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z'));

    expect(query).toHaveBeenCalledTimes(1);
    expect(row).toEqual({
      sendsTotal: 10,
      sendsWithTouchHint: 8,
      customersTotal: 100,
      customersWithAttribution: 90,
      channelScanTouchCount: 3,
    });
  });

  it('空结果时归零', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const svc = new FunnelGapQueryService();
    (svc as unknown as { dataSource: { query: typeof query } }).dataSource = { query };
    const row = await svc.aggregateOltp(1, new Date(), new Date());
    expect(row.sendsTotal).toBe(0);
    expect(row.channelScanTouchCount).toBe(0);
  });
});
