/**
 * 将多日 daily_stat 行汇总为「区间摘要」（Sprint 4：与 GET /summary 契约一致，便于单测）
 */
export type DailyStatRowInput = {
  statDate: Date | string;
  newCustomerCount: number;
  lostCustomerCount: number;
  activeCustomerCount: number;
  totalCustomerCount: number;
  activeStaffCount: number;
  totalStaffCount: number;
  messageSendCount: number;
  messageSuccessCount: number;
  messageFailCount: number;
  sopExecuteCount: number;
  sopSuccessCount: number;
};

export type DailyStatRangeSummary = {
  /** 区间内可累加的指标 */
  additive: {
    newCustomerCount: number;
    lostCustomerCount: number;
    messageSendCount: number;
    messageSuccessCount: number;
    messageFailCount: number;
    sopExecuteCount: number;
    sopSuccessCount: number;
  };
  /** 取区间内「最后一日」行的快照型指标（累计客户等） */
  snapshotAtEnd: {
    statDate: string;
    totalCustomerCount: number;
    activeCustomerCount: number;
    activeStaffCount: number;
    totalStaffCount: number;
  } | null;
};

function dayKey(d: Date | string): string {
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  const iso = d.toISOString();
  return iso.slice(0, 10);
}

export function summarizeDailyStatRange(rows: DailyStatRowInput[]): DailyStatRangeSummary {
  if (!rows.length) {
    return {
      additive: {
        newCustomerCount: 0,
        lostCustomerCount: 0,
        messageSendCount: 0,
        messageSuccessCount: 0,
        messageFailCount: 0,
        sopExecuteCount: 0,
        sopSuccessCount: 0,
      },
      snapshotAtEnd: null,
    };
  }

  const sorted = [...rows].sort((a, b) => dayKey(a.statDate).localeCompare(dayKey(b.statDate)));

  const additive = sorted.reduce(
    (acc, r) => ({
      newCustomerCount: acc.newCustomerCount + (r.newCustomerCount || 0),
      lostCustomerCount: acc.lostCustomerCount + (r.lostCustomerCount || 0),
      messageSendCount: acc.messageSendCount + (r.messageSendCount || 0),
      messageSuccessCount: acc.messageSuccessCount + (r.messageSuccessCount || 0),
      messageFailCount: acc.messageFailCount + (r.messageFailCount || 0),
      sopExecuteCount: acc.sopExecuteCount + (r.sopExecuteCount || 0),
      sopSuccessCount: acc.sopSuccessCount + (r.sopSuccessCount || 0),
    }),
    {
      newCustomerCount: 0,
      lostCustomerCount: 0,
      messageSendCount: 0,
      messageSuccessCount: 0,
      messageFailCount: 0,
      sopExecuteCount: 0,
      sopSuccessCount: 0,
    }
  );

  const end = sorted[sorted.length - 1];
  return {
    additive,
    snapshotAtEnd: {
      statDate: dayKey(end.statDate),
      totalCustomerCount: end.totalCustomerCount,
      activeCustomerCount: end.activeCustomerCount,
      activeStaffCount: end.activeStaffCount,
      totalStaffCount: end.totalStaffCount,
    },
  };
}
