import { test, expect } from '@playwright/test';

const GATEWAY =
  process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

test.describe('Sprint 2 — 集成服务经网关探测', () => {
  test('GET /api/v1/integration/health', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const res = await request.get(`${GATEWAY}/api/v1/integration/health`);
    if (!res.ok()) {
      console.error('integration health failed:', res.status(), await res.text());
    }
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({
      status: 'ok',
      service: 'integration-service',
      database: 'connected',
    });
  });
});
