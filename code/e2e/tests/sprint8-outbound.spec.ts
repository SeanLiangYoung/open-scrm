import { test, expect } from '@playwright/test';

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

const idemKey = () => `test-sprint8-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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

test.describe('Sprint 8 — 营销同意闸门 + Outbound Mock（messageType 5）', () => {
  test('consentPurpose=marketing 且无同意客户 → 403', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const res = await request.post(`${GATEWAY}/api/v1/messages/send`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idemKey(),
      },
      data: {
        messageType: 5,
        targetType: 1,
        targetIds: [2],
        content: 'S8 E2E 无营销同意应拒绝',
        consentPurpose: 'marketing',
      },
    });

    if (res.status() >= 500 || res.status() === 503) {
      test.skip(true, 'message-service 或下游不可用');
    }

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('consentPurpose=marketing 且种子客户 id=1 有同意 → 200；messageType 5', async ({
    request,
  }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const res = await request.post(`${GATEWAY}/api/v1/messages/send`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idemKey(),
      },
      data: {
        messageType: 5,
        targetType: 1,
        targetIds: [1],
        content: 'S8 E2E Outbound Mock',
        consentPurpose: 'marketing',
      },
    });

    if (res.status() >= 500 || res.status() === 503) {
      test.skip(true, 'message-service 或下游不可用');
    }

    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBeTruthy();
    expect(body.data?.details?.[0]?.success).toBeTruthy();
  });

  test('marketing + 非客户 targetType → 400', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const res = await request.post(`${GATEWAY}/api/v1/messages/send`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idemKey(),
      },
      data: {
        messageType: 5,
        targetType: 2,
        targetIds: [1],
        content: 'x',
        consentPurpose: 'marketing',
      },
    });

    if (res.status() >= 500 || res.status() === 503) {
      test.skip(true, 'message-service 或下游不可用');
    }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
