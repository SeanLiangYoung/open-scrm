import { describe, it, expect } from 'vitest';
import { summarizeDailyStatRange } from './daily-stat-summary.util';

describe('summarizeDailyStatRange', () => {
  it('空数组返回零 additive 且无 snapshot', () => {
    const r = summarizeDailyStatRange([]);
    expect(r.additive.messageSendCount).toBe(0);
    expect(r.snapshotAtEnd).toBeNull();
  });

  it('累加可加指标并以最后一日为快照', () => {
    const r = summarizeDailyStatRange(
      [
        {
          statDate: '2026-04-01',
          newCustomerCount: 1,
          lostCustomerCount: 0,
          activeCustomerCount: 5,
          totalCustomerCount: 10,
          activeStaffCount: 1,
          totalStaffCount: 5,
          messageSendCount: 2,
          messageSuccessCount: 2,
          messageFailCount: 0,
          sopExecuteCount: 1,
          sopSuccessCount: 1,
        },
        {
          statDate: '2026-04-02',
          newCustomerCount: 3,
          lostCustomerCount: 1,
          activeCustomerCount: 7,
          totalCustomerCount: 12,
          activeStaffCount: 2,
          totalStaffCount: 8,
          messageSendCount: 4,
          messageSuccessCount: 3,
          messageFailCount: 1,
          sopExecuteCount: 0,
          sopSuccessCount: 0,
        },
      ]
    );
    expect(r.additive.newCustomerCount).toBe(4);
    expect(r.additive.messageSendCount).toBe(6);
    expect(r.additive.messageSuccessCount).toBe(5);
    expect(r.snapshotAtEnd?.totalCustomerCount).toBe(12);
    expect(r.snapshotAtEnd?.statDate).toBe('2026-04-02');
    expect(r.snapshotAtEnd?.activeStaffCount).toBe(2);
    expect(r.snapshotAtEnd?.totalStaffCount).toBe(8);
  });
});
