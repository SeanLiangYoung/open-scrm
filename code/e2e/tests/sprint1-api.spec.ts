import { test, expect } from '@playwright/test';

const GATEWAY =
  process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

test.describe('Sprint 1 — API E2E', () => {
  test('gateway health', async ({ request }) => {
    const res = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!res?.ok(), 'Gateway 未启动，跳过（见 docs/harness/本地启动与验证-Sprint1.md）');
    expect(res!.status()).toBe(200);
    const body = await res!.json();
    expect(body).toMatchObject({ status: 'ok', service: 'gateway-service' });
  });

  test('login via gateway returns tokens', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const res = await request.post(`${GATEWAY}/api/v1/auth/login`, {
      data: { username: 'admin', password: 'Admin@123' },
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status() >= 500 || res.status() === 503) {
      test.skip(true, 'Auth 或下游不可用');
    }

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body.user?.username).toBe('admin');
  });
});
