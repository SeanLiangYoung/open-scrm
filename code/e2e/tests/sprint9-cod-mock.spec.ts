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

test.describe('Sprint 9 — operation COD mock（内存状态）', () => {
  test('GET 默认 intent，POST 更新后 GET 可读', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const g1 = await request.get(`${GATEWAY}/api/v1/operation/cod-mock/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (g1.status() === 404) {
      test.skip(true, 'operation 路由未转发或未启动 operation-service');
    }
    expect(g1.ok(), await g1.text()).toBeTruthy();
    const j1 = await g1.json();
    expect(j1.success).toBeTruthy();
    expect(j1.data.state).toBe('intent');

    const post = await request.post(`${GATEWAY}/api/v1/operation/cod-mock/state`, {
      headers: auth,
      data: { state: 'shipped' },
    });
    if (post.status() === 404) {
      test.skip(true, 'operation 路由未转发');
    }
    expect(post.ok(), await post.text()).toBeTruthy();
    const j2 = await post.json();
    expect(j2.data.state).toBe('shipped');

    const g2 = await request.get(`${GATEWAY}/api/v1/operation/cod-mock/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(g2.ok(), await g2.text()).toBeTruthy();
    const j3 = await g2.json();
    expect(j3.data.state).toBe('shipped');
  });
});
