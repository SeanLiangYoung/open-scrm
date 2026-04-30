import { test, expect } from '@playwright/test';

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

const idemKey = () => `test-sprint9-policy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function loginAccessToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post(`${GATEWAY}/api/v1/auth/login`, {
    data: { username: 'admin', password: 'Admin@123' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

test.describe('Sprint 9 — RegionPack 营销日频控（test-e2e-policy max=3，静默关闭）', () => {
  test('第 4 次营销发送返回 429 frequency_cap', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);

    const baseBody = {
      messageType: 5,
      targetType: 1,
      targetIds: [1],
      content: 'S9 policy E2E',
      consentPurpose: 'marketing',
      regionPackId: 'test-e2e-policy',
    };

    for (let i = 0; i < 3; i++) {
      const res = await request.post(`${GATEWAY}/api/v1/messages/send`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idemKey(),
        },
        data: baseBody,
      });
      if (res.status() >= 500 || res.status() === 503) {
        test.skip(true, 'message-service 或下游不可用');
      }
      expect(res.ok(), `第 ${i + 1} 次应成功: ${await res.text()}`).toBeTruthy();
    }

    const fourth = await request.post(`${GATEWAY}/api/v1/messages/send`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idemKey(),
      },
      data: baseBody,
    });
    if (fourth.status() >= 500 || fourth.status() === 503) {
      test.skip(true, 'message-service 或下游不可用');
    }
    expect(fourth.status()).toBe(429);
    const body = await fourth.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('frequency_cap');
  });

  test('未知 regionPackId 返回 400', async ({ request }) => {
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
        content: 'x',
        consentPurpose: 'marketing',
        regionPackId: 'no-such-pack',
      },
    });
    if (res.status() >= 500) test.skip(true, '下游不可用');
    expect(res.status()).toBe(400);
  });
});
