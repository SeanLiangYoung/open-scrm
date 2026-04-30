/**
 * 漏斗「归因缺口」占位纯函数（与 docs/facts/funnel-metrics-v0.1.md 口径一致）。
 * 真实 OLTP 聚合见 Phase C+。
 */
export function computeAttributionGapMetrics(input: {
  sendsTotal: number;
  sendsWithTouchHint: number;
  customersTotal: number;
  customersWithAttribution: number;
}): { messageAttributionGapRate: number; customerUnlinkedRate: number } {
  const messageAttributionGapRate =
    input.sendsTotal > 0
      ? (input.sendsTotal - input.sendsWithTouchHint) / input.sendsTotal
      : 0;
  const customerUnlinkedRate =
    input.customersTotal > 0
      ? (input.customersTotal - input.customersWithAttribution) / input.customersTotal
      : 0;
  return { messageAttributionGapRate, customerUnlinkedRate };
}
