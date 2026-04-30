import type { RegionPack, SilentLocalHours } from '../catalog/region-packs';

export type OutboundPolicyReason = 'silent_hours' | 'frequency_cap';

export type OutboundPolicyResult =
  | { allowed: true; reasonCode?: undefined }
  | { allowed: false; reasonCode: OutboundPolicyReason };

function parseHHmm(s: string): { hour: number; minute: number } {
  const [h, m] = s.trim().split(':').map(x => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error(`Invalid HH:mm: ${s}`);
  }
  return { hour: h, minute: m };
}

/** 0..1439 分钟，基于 IANA 时区的墙上时钟 */
function localMinutesSinceMidnight(now: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  return hour * 60 + minute;
}

/**
 * 本地静默：start/end 为 HH:mm。
 * - 若 start < end：同日区间 [start, end)
 * - 若 start > end：跨日 [start, 24:00) ∪ [00:00, end)
 */
export function isWithinSilentLocalHours(now: Date, timeZone: string, silent: SilentLocalHours): boolean {
  const { hour: sh, minute: sm } = parseHHmm(silent.start);
  const { hour: eh, minute: em } = parseHHmm(silent.end);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  const cur = localMinutesSinceMidnight(now, timeZone);
  if (startM === endM) {
    return false;
  }
  if (startM < endM) {
    return cur >= startM && cur < endM;
  }
  return cur >= startM || cur < endM;
}

/**
 * 纯策略：静默优先于频控；`localSendCountForDay` 为当前自然日（按 pack.timezone 计日）已发送次数，不含本次。
 */
export function evaluateOutboundSendPolicy(input: {
  now: Date;
  pack: RegionPack;
  localSendCountForDay: number;
}): OutboundPolicyResult {
  const { now, pack, localSendCountForDay } = input;
  if (isWithinSilentLocalHours(now, pack.timezone, pack.silentLocalHours)) {
    return { allowed: false, reasonCode: 'silent_hours' };
  }
  if (localSendCountForDay >= pack.maxMarketingSendsPerRecipientPerDay) {
    return { allowed: false, reasonCode: 'frequency_cap' };
  }
  return { allowed: true };
}
