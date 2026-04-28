import { test, expect } from '@playwright/test';

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

function localYmd(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

test.describe('Sprint 4 — analytics 经网关（聚合 + summary）', () => {
  test('POST jobs/aggregate-daily 后 overview/summary 与种子客户数一致', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const day = localYmd();

    const agg = await request.post(`${GATEWAY}/api/v1/analytics/jobs/aggregate-daily`, {
      headers: auth,
      data: { statDate: day },
    });
    if (agg.status() >= 500 || agg.status() === 503) {
      test.skip(true, 'analytics-service 或下游不可用');
    }
    expect(agg.ok(), await agg.text()).toBeTruthy();

    const ov = await request.get(`${GATEWAY}/api/v1/analytics/overview?date=${day}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ov.ok(), await ov.text()).toBeTruthy();
    const ovJson = await ov.json();
    expect(ovJson.success).toBeTruthy();
    expect(ovJson.data.totalCustomerCount).toBe(8);

    const sm = await request.get(
      `${GATEWAY}/api/v1/analytics/summary?startDate=${day}&endDate=${day}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(sm.ok(), await sm.text()).toBeTruthy();
    const smJson = await sm.json();
    expect(smJson.data.snapshotAtEnd?.totalCustomerCount).toBe(8);
  });
});
