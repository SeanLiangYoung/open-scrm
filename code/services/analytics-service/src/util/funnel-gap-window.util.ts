const MAX_RANGE_DAYS = 93;
const DEFAULT_RANGE_DAYS = 31;

function parseYmd(s: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${label} 须为 YYYY-MM-DD`);
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new Error(`${label} 日期无效`);
  }
  return d;
}

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const t = d.getTime() + days * 86400000;
  return new Date(t);
}

/**
 * 漏斗归因查询时间窗：[start, endExclusive)，UTC 日历日；最长 93 天。
 */
export function resolveFunnelGapWindow(
  input: { startDate?: string; endDate?: string },
  now: Date = new Date()
): { start: Date; endExclusive: Date } {
  const todayStart = utcDayStart(now);

  if ((input.startDate !== undefined) !== (input.endDate !== undefined)) {
    throw new Error('startDate 与 endDate 须成对出现，或同时省略');
  }

  if (input.startDate !== undefined && input.endDate !== undefined) {
    const start = parseYmd(input.startDate, 'startDate');
    const endDay = parseYmd(input.endDate, 'endDate');
    const endExclusive = addUtcDays(endDay, 1);
    const spanDays = (endExclusive.getTime() - start.getTime()) / 86400000;
    if (spanDays > MAX_RANGE_DAYS || spanDays < 1) {
      throw new Error(`查询窗口须在 1–${MAX_RANGE_DAYS} 天之间`);
    }
    return { start, endExclusive };
  }

  const endExclusive = addUtcDays(todayStart, 1);
  const start = addUtcDays(endExclusive, -DEFAULT_RANGE_DAYS);
  return { start, endExclusive };
}
