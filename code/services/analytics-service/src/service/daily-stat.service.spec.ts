import { describe, expect, it, vi } from 'vitest';
import { DailyStatService } from './daily-stat.service';

describe('daily statistics semantics', () => {
  const row = {
    statDate: '2026-04-01',
    newCustomerCount: 1,
    lostCustomerCount: 2,
    activeCustomerCount: 8,
    totalCustomerCount: 10,
    activeStaffCount: 3,
    totalStaffCount: 4,
    messageSendCount: 0,
    messageSuccessCount: 0,
    sopExecuteCount: 0,
    sopSuccessCount: 0,
    updateTime: new Date('2026-04-02T03:00:00Z')
  };

  it('labels current-state counts as normal/deleted/enabled instead of behavioral activity', async () => {
    const service = new DailyStatService();
    const query = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(row)
    };
    Object.assign(service, { dailyStatRepository: { createQueryBuilder: () => query } });
    const result = await service.getOverview(2, '2026-04-01');
    expect(result).toMatchObject({
      normalCustomerCount: 8,
      deletedCustomerCount: 2,
      enabledStaffCount: 3,
      snapshotAvailable: true,
      snapshotObservedAt: row.updateTime
    });
    expect(result).toHaveProperty('metricSemantics.customerCounts', 'current_state_at_aggregation');
  });

  it('marks an absent daily snapshot instead of pretending an observation was taken', async () => {
    const service = new DailyStatService();
    const query = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(null)
    };
    Object.assign(service, { dailyStatRepository: { createQueryBuilder: () => query } });
    expect(await service.getOverview(2)).toMatchObject({ snapshotAvailable: false, snapshotObservedAt: null });
  });

  it('distinguishes an existing legacy snapshot without an observation timestamp from a missing row', async () => {
    const service = new DailyStatService();
    const query = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({ ...row, updateTime: null })
    };
    Object.assign(service, { dailyStatRepository: { createQueryBuilder: () => query } });
    expect(await service.getOverview(2)).toMatchObject({
      snapshotAvailable: true, snapshotObservedAt: null, totalCustomerCount: 10
    });
  });
});
