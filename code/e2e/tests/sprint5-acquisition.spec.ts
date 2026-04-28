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

test.describe('Sprint 5 — 获客 × 集成（创建活码 + integration 测试入口回写）', () => {
  test('创建 channel-code → integration/test 扫码 → acquisition 可见；幂等 eventId', async ({
    request,
  }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const name = `s5-e2e-${Date.now()}`;
    const create = await request.post(`${GATEWAY}/api/v1/acquisition/channel-codes`, {
      headers: auth,
      data: { codeName: name, channel: 'douyin' },
    });
    if (create.status() >= 500 || create.status() === 503) {
      test.skip(true, 'acquisition 或下游不可用');
    }
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    expect(created.success).toBeTruthy();
    expect(created.data.configId).toBeUndefined();
    const id = created.data.id as number;
    expect(id).toBeGreaterThan(0);

    const g0 = await request.get(`${GATEWAY}/api/v1/acquisition/channel-codes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(g0.ok()).toBeTruthy();
    const j0 = await g0.json();
    expect(j0.data.scanCount).toBe(0);

    const scan1 = await request.post(`${GATEWAY}/api/v1/integration/test/acquisition-channel-scan`, {
      headers: auth,
      data: { channelCodeId: id },
    });
    if (scan1.status() === 404) {
      test.skip(true, 'integration 测试路由未开放（非 production 默认可用；或设 ENABLE_INTEGRATION_TEST_ROUTES=1）');
    }
    expect(scan1.ok(), await scan1.text()).toBeTruthy();

    const g1 = await request.get(`${GATEWAY}/api/v1/acquisition/channel-codes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(((await g1.json()) as { data: { scanCount: number } }).data.scanCount).toBe(1);

    await request.post(`${GATEWAY}/api/v1/integration/test/acquisition-channel-scan`, {
      headers: auth,
      data: { channelCodeId: id },
    });
    const g2 = await request.get(`${GATEWAY}/api/v1/acquisition/channel-codes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(((await g2.json()) as { data: { scanCount: number } }).data.scanCount).toBe(2);

    const ev = `evt-${id}-same`;
    const s3 = await request.post(`${GATEWAY}/api/v1/integration/test/acquisition-channel-scan`, {
      headers: auth,
      data: { channelCodeId: id, externalEventId: ev },
    });
    expect(s3.ok()).toBeTruthy();
    expect(((await s3.json()) as { data: { replayed: boolean } }).data.replayed).toBe(false);

    const s4 = await request.post(`${GATEWAY}/api/v1/integration/test/acquisition-channel-scan`, {
      headers: auth,
      data: { channelCodeId: id, externalEventId: ev },
    });
    expect(s4.ok()).toBeTruthy();
    expect(((await s4.json()) as { data: { replayed: boolean } }).data.replayed).toBe(true);

    const g3 = await request.get(`${GATEWAY}/api/v1/acquisition/channel-codes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(((await g3.json()) as { data: { scanCount: number } }).data.scanCount).toBe(3);
  });
});
