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

test.describe('Sprint 9 — 扫码 ingest 归因字段 → channel_scan_touch', () => {
  test('integration 转发 utm 后 GET scan-touches/latest 可读', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const name = `s9-attrib-${Date.now()}`;
    const create = await request.post(`${GATEWAY}/api/v1/acquisition/channel-codes`, {
      headers: auth,
      data: { codeName: name, channel: 'douyin' },
    });
    if (create.status() >= 500 || create.status() === 503) {
      test.skip(true, 'acquisition 不可用');
    }
    expect(create.ok(), await create.text()).toBeTruthy();
    const id = (await create.json()).data.id as number;

    const scan = await request.post(`${GATEWAY}/api/v1/integration/test/acquisition-channel-scan`, {
      headers: auth,
      data: {
        channelCodeId: id,
        externalEventId: `s9-${id}-evt`,
        utm_campaign: 'tiktok_summer',
        creative_id: 'cr_001',
        region_pack_id: 'th-bangkok',
        utm_source: 'tiktok',
        utm_medium: 'paid',
      },
    });
    if (scan.status() === 404) {
      test.skip(true, 'integration 测试路由未开放');
    }
    expect(scan.ok(), await scan.text()).toBeTruthy();

    const latest = await request.get(
      `${GATEWAY}/api/v1/acquisition/channel-codes/${id}/scan-touches/latest`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(latest.ok(), await latest.text()).toBeTruthy();
    const body = await latest.json();
    expect(body.data).toBeTruthy();
    expect(body.data.utmCampaign || body.data.utm_campaign).toBeTruthy();
  });
});
