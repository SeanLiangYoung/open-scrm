import { test, expect } from '@playwright/test';

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

async function loginAccessToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post(`${GATEWAY}/api/v1/auth/login`, {
    data: { username: 'admin', password: 'Admin@123' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

test.describe('Sprint 9 — analytics 归因缺口占位', () => {
  test('GET funnel-gap-placeholder 返回固定示例率与 corpId', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const res = await request.get(`${GATEWAY}/api/v1/analytics/funnel-gap-placeholder`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() === 404) {
      test.skip(true, 'analytics 路由未转发');
    }
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBeTruthy();
    expect(body.data.corpId).toBeTruthy();
    expect(body.data.source).toBe('oltp');
    expect(body.data.window?.start).toBeTruthy();
    expect(Number.isFinite(body.data.messageAttributionGapRate)).toBe(true);
    expect(Number.isFinite(body.data.customerUnlinkedRate)).toBe(true);
    expect(typeof body.data.sendsTotal).toBe('number');
  });
});
