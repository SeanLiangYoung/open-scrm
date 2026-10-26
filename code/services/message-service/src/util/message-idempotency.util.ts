/** Sprint 3：HTTP Idempotency-Key 规范化（与企微无关） */
export function normalizeIdempotencyKey(raw: string | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const t = String(raw).trim();
  if (t.length === 0 || t.length > 128) {
    return null;
  }
  return t;
}

export type IdempotentReplaySnapshot = {
  id: number;
  corpId: number | string;
  sendStatus: number;
  content: string;
  failReason: string | null;
  externalId: string | null;
};

export type IdempotentReplayResult = {
  kind: 'replay';
  messageLogId: number;
  sendStatus: number;
  content: string;
  failReason: string | null;
  externalId: string | null;
};

/** PostgreSQL bigint columns hydrate as decimal strings; never round them through Number. */
function canonicalTenantId(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : null;
}

/**
 * 若库中已有同 corp + 幂等键记录，则本次请求应「重放」该结果，不再次执行通道发送。
 */
export function resolveIdempotentReplay(
  corpId: number | string,
  key: string | null,
  existing: IdempotentReplaySnapshot | null
): IdempotentReplayResult | null {
  if (key === null || key === '') {
    return null;
  }
  if (!existing) {
    return null;
  }
  const tenant = canonicalTenantId(corpId);
  if (tenant === null || canonicalTenantId(existing.corpId) !== tenant) {
    return null;
  }
  return {
    kind: 'replay',
    messageLogId: existing.id,
    sendStatus: existing.sendStatus,
    content: existing.content,
    failReason: existing.failReason,
    externalId: existing.externalId,
  };
}
