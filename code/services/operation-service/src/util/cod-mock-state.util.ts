/**
 * COD 轻闭环占位状态（与 docs/plans/2026-04-28-cod-light-loop-states.md 一致）。
 * 无持久化，仅 mock API 使用。
 */
export const COD_MOCK_STATES = [
  'intent',
  'awaiting_payment_proof',
  'shipped',
  'delivered',
] as const;

export type CodMockState = (typeof COD_MOCK_STATES)[number];

export function isCodMockState(s: string): s is CodMockState {
  return (COD_MOCK_STATES as readonly string[]).includes(s);
}
