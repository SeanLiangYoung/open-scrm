import { test, expect } from '@playwright/test';

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

/** 每次运行唯一，避免历史库中已有同键导致「首请求即重放」 */
const idemKey = () => `test-sprint3-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function loginAccessToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post(`${GATEWAY}/api/v1/auth/login`, {
    data: { username: 'admin', password: 'Admin@123' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  expect(body.accessToken).toBeTruthy();
  return body.accessToken as string;
}

test.describe('Sprint 3 — message-service 经网关（幂等 + 查状态）', () => {
  test('POST /api/v1/messages/send 两次相同幂等键：第二次重放；GET /logs/:id 可查', async ({
    request,
  }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);

    const sendBody = {
      messageType: 2,
      targetType: 2,
      targetIds: [1],
      content: 'Sprint3 E2E 站内通知（Mock 通道，无外部副作用）',
    };

    const key = idemKey();
    const h = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': key,
    };

    const first = await request.post(`${GATEWAY}/api/v1/messages/send`, {
      headers: h,
      data: sendBody,
    });

    if (first.status() >= 500 || first.status() === 503) {
      test.skip(true, 'message-service 或下游不可用');
    }

    expect(first.ok(), await first.text()).toBeTruthy();
    const firstJson = await first.json();
    expect(firstJson.success).toBeTruthy();
    const d1 = firstJson.data;
    expect(d1.idempotentReplay).toBeFalsy();
    const logId = d1.details?.[0]?.messageLogId ?? d1.messageLogId;
    expect(typeof logId).toBe('number');
    expect(logId).toBeGreaterThan(0);

    const second = await request.post(`${GATEWAY}/api/v1/messages/send`, {
      headers: h,
      data: sendBody,
    });
    expect(second.ok(), await second.text()).toBeTruthy();
    const secondJson = await second.json();
    expect(secondJson.data.idempotentReplay).toBe(true);
    expect(secondJson.data.messageLogId).toBe(logId);

    const logRes = await request.get(`${GATEWAY}/api/v1/messages/logs/${logId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logRes.ok(), await logRes.text()).toBeTruthy();
    const logJson = await logRes.json();
    expect(logJson.data.id).toBe(logId);
    expect(logJson.data.sendStatus).toBe(1);
  });
});
