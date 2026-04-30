/**
 * 群发任务走 message-service「经网关契约一致」的 /api/v1/messages/send 时的 URL 与幂等键工具（S3-F7 / S7）。
 */

export function buildMessageServiceV1SendUrl(messageBaseUrl: string): string {
  const b = (messageBaseUrl || '').trim().replace(/\/$/, '');
  return `${b}/api/v1/messages/send`;
}

/** 每接收方一条幂等键，便于任务重跑时安全重放 */
export function buildMassTaskIdempotencyKey(taskId: number, targetId: number): string {
  return `mass-task-${taskId}-tgt-${targetId}`;
}

/**
 * 将 DB 中 message_content 规范为 send API 所需 string。
 * 兼容前端曾写入的 JSON：`{"text":"..."}`。
 */
export function normalizeMassTaskTextContent(raw: string | undefined | null): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (s.startsWith('{') && s.includes('"text"')) {
    try {
      const o = JSON.parse(s) as { text?: unknown };
      if (o && typeof o.text === 'string') return o.text;
    } catch {
      /* ignore */
    }
  }
  return s;
}
