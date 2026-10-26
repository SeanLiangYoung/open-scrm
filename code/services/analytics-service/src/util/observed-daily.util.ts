export type ObservedWindow = { startDate: string; endDate: string; dates: string[] };
const dayMs = 86_400_000;
/** UTC arithmetic labels calendar days; it does not claim historical event timezone. */
export function parseObservedWindow(query: unknown): ObservedWindow {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new Error('日期查询无效');
  const fields = query as Record<string, unknown>;
  if (Object.keys(fields).some(key => !['startDate', 'endDate'].includes(key))) throw new Error('不支持的查询字段');
  function parse(value: unknown): number {
    if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) throw new Error('日期须为 YYYY-MM-DD');
    const time = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('日期不存在');
    return time;
  }
  const start = parse(fields.startDate), end = parse(fields.endDate);
  const days = (end - start) / dayMs + 1;
  if (days < 1 || days > 31) throw new Error('日期范围须为1至31天');
  return { startDate: fields.startDate as string, endDate: fields.endDate as string,
    dates: Array.from({ length: days }, (_, index) => new Date(start + index * dayMs).toISOString().slice(0, 10)) };
}
export type ObservedRow = {
  date: string; observedAt: string | Date | null;
  newCustomerRecords: number; messageLogRecords: number; sopExecutionRecords: number;
  totalCustomers: number; normalCustomers: number; deletedCustomers: number;
};
export function projectObservedDaily(window: ObservedWindow, rows: readonly ObservedRow[]) {
  const byDate = new Map(rows.map(row => [row.date, row]));
  return { startDate: window.startDate, endDate: window.endDate,
    dateBasis: 'stored_daily_stat_date' as const, eventDayTimezone: null,
    points: window.dates.map(date => {
      const row = byDate.get(date);
      return { date, observed: !!row, snapshotObservedAt: row?.observedAt ?? null,
        events: { newCustomerRecords: row?.newCustomerRecords ?? null, messageLogRecords: row?.messageLogRecords ?? null, sopExecutionRecords: row?.sopExecutionRecords ?? null },
        inventory: { totalCustomers: row?.totalCustomers ?? null, normalCustomers: row?.normalCustomers ?? null, deletedCustomers: row?.deletedCustomers ?? null } };
    }) };
}
