import { test, expect, type APIRequestContext } from '@playwright/test';
// Actual gateway HTTP against only the companion harness's disposable fixture database.
test.skip(process.env.ANALYTICS_E2E_DISPOSABLE !== '1', 'Requires isolated analytics HTTP harness');
let a: string;
let b: string;
const prefix = '/api/v1/analytics';
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'x-corp-id': token === a ? '1102' : '1101', 'x-user-id': token === a ? '91002' : '91001' });
async function json(request: APIRequestContext, url: string, token: string) {
  const result = await request.get(url, { headers: auth(token) });
  expect(result.ok(), await result.text()).toBeTruthy();
  const body = await result.json();
  expect(body.success).toBe(true);
  return body.data;
}
async function aggregate(request: APIRequestContext, token: string) {
  const result = await request.post(`${prefix}/jobs/aggregate-daily`, { headers: auth(token), data: { statDate: '2026-10-21' } });
  expect(result.ok(), await result.text()).toBeTruthy();
  return (await result.json()).data;
}
test.beforeEach(async ({ request }) => {
  async function login(username: string, corpId: number) {
    const result = await request.post('/api/v1/auth/login', { data: { username, password: 'Admin@123', corpId } });
    expect(result.ok(), await result.text()).toBeTruthy();
    const body = await result.json();
    expect(Number(body.user.corpId)).toBe(corpId);
    expect(body.user.isAdmin).toBe(0);
    return body.accessToken as string;
  }
  a = await login('analytics_a', 1101);
  b = await login('analytics_b', 1102);
});
test('anonymous analytics reads and aggregation reject forged identity headers', async ({ request }) => {
  const headers = { 'x-corp-id': '1101', 'x-user-id': '91001' };
  const read = await request.get(`${prefix}/overview?date=2026-10-21`, { headers });
  expect(read.status()).toBe(401);
  const write = await request.post(`${prefix}/jobs/aggregate-daily`, { headers, data: { statDate: '2026-10-21' } });
  expect(write.status()).toBe(401);
});
test('missing daily overview explicitly reports absence rather than observed zero', async ({ request }) => {
  const data = await json(request, `${prefix}/overview?date=2026-10-23`, a);
  expect(data).toMatchObject({ snapshotAvailable: false, snapshotObservedAt: null, totalCustomerCount: 0, normalCustomerCount: 0 });
});
test('manual aggregate observes current stock and day events under authenticated enterprise', async ({ request }) => {
  expect(await aggregate(request, a)).toEqual({ corpId: 1101, statDate: '2026-10-21' });
  const data = await json(request, `${prefix}/overview?date=2026-10-21`, a);
  expect(data).toMatchObject({ snapshotAvailable: true, newCustomerCount: 2, totalCustomerCount: 3, normalCustomerCount: 2, deletedCustomerCount: 1,
    enabledStaffCount: 1, totalStaffCount: 2, messageSendCount: 7, messageSuccessRate: 85.71, sopExecuteCount: 2, sopSuccessRate: 50 });
  expect(Number.isFinite(Date.parse(data.snapshotObservedAt))).toBe(true);
  expect(data.metricSemantics.customerCounts).toBe('current_state_at_aggregation');
});
test('summary adds events but takes only final stock snapshot', async ({ request }) => {
  await aggregate(request, a);
  const data = await json(request, `${prefix}/summary?startDate=2026-10-20&endDate=2026-10-21`, a);
  expect(data.additive).toEqual({ newCustomerCount: 3, messageSendCount: 8, messageSuccessCount: 7, messageFailCount: 1, sopExecuteCount: 4, sopSuccessCount: 2 });
  expect(data.additive).not.toHaveProperty('lostCustomerCount');
  expect(data.snapshotAtEnd).toMatchObject({ statDate: '2026-10-21', totalCustomerCount: 3, normalCustomerCount: 2, deletedCustomerCount: 1, enabledStaffCount: 1 });
  expect(data.rates).toEqual({ messageSuccessRate: 87.5, sopSuccessRate: 50 });
});
test('second enterprise snapshot remains independent despite forged enterprise headers', async ({ request }) => {
  expect(await aggregate(request, b)).toEqual({ corpId: 1102, statDate: '2026-10-21' });
  const data = await json(request, `${prefix}/overview?date=2026-10-21`, b);
  expect(data).toMatchObject({ snapshotAvailable: true, totalCustomerCount: 1, normalCustomerCount: 1, deletedCustomerCount: 0, enabledStaffCount: 2, messageSendCount: 1, messageSuccessRate: 100 });
  const historical = await json(request, `${prefix}/overview?date=2026-10-20`, b);
  expect(historical.snapshotAvailable).toBe(false);
});
test('funnel counts successful sends separately from deduplicated owned customer attribution', async ({ request }) => {
  const data = await json(request, `${prefix}/funnel-gap-placeholder?startDate=2026-10-21&endDate=2026-10-21`, a);
  expect(data).toMatchObject({ corpId: 1101, source: 'oltp', sendsTotal: 6, sendsWithTouchHint: 5, customersTotal: 3, customersWithAttribution: 1, channelScanTouchCount: 2,
    window: { start: '2026-10-21T00:00:00.000Z', endExclusive: '2026-10-22T00:00:00.000Z' } });
  expect(data.messageAttributionGapRate).toBeCloseTo(1 / 6, 10);
  expect(data.customerUnlinkedRate).toBeCloseTo(2 / 3, 10);
});
test('second enterprise funnel cannot read first enterprise messages or customers', async ({ request }) => {
  const data = await json(request, `${prefix}/funnel-gap-placeholder?startDate=2026-10-21&endDate=2026-10-21`, b);
  expect(data).toMatchObject({ corpId: 1102, sendsTotal: 1, sendsWithTouchHint: 1, customersTotal: 1, customersWithAttribution: 1, channelScanTouchCount: 1,
    messageAttributionGapRate: 0, customerUnlinkedRate: 0 });
});
test('empty event window retains all-customer denominator with explicit zero sends', async ({ request }) => {
  const data = await json(request, `${prefix}/funnel-gap-placeholder?startDate=2026-10-23&endDate=2026-10-23`, a);
  expect(data).toMatchObject({ sendsTotal: 0, sendsWithTouchHint: 0, customersTotal: 3, customersWithAttribution: 0, channelScanTouchCount: 0,
    messageAttributionGapRate: 0, customerUnlinkedRate: 1 });
});
test('adjacent UTC days include their own midnight and exclude the next midnight', async ({ request }) => {
  for (const day of ['2026-10-20', '2026-10-22']) {
    const data = await json(request, `${prefix}/funnel-gap-placeholder?startDate=${day}&endDate=${day}`, a);
    expect(data).toMatchObject({ sendsTotal: 1, sendsWithTouchHint: 1, customersWithAttribution: 1, channelScanTouchCount: 1 });
  }
});
test('manual funnel resolver rejects invalid calendar, missing pairs and oversized windows with400', async ({ request }) => {
  for (const query of ['startDate=2026-02-30&endDate=2026-03-02', 'startDate=2026-04-31&endDate=2026-05-01',
    'startDate=2026-10-21', 'startDate=2026-10-22&endDate=2026-10-21', 'startDate=2026-01-01&endDate=2026-10-21']) {
    const result = await request.get(`${prefix}/funnel-gap-placeholder?${query}`, { headers: auth(a) });
    expect(result.status(), await result.text()).toBe(400);
  }
});
test('legacy analytics DTO failures retain422 and cannot select another enterprise', async ({ request }) => {
  const invalidDate = await request.post(`${prefix}/jobs/aggregate-daily`, { headers: auth(a), data: { statDate: 'not-a-date' } });
  expect(invalidDate.status(), await invalidDate.text()).toBe(422);
  const emptyDates = await request.get(`${prefix}/funnel-gap-placeholder?startDate=&endDate=`, { headers: auth(a) });
  expect(emptyDates.status(), await emptyDates.text()).toBe(422);
  const extraTenant = await request.get(`${prefix}/overview?date=2026-10-21&corpId=1102`, { headers: auth(a) });
  expect(extraTenant.status(), await extraTenant.text()).toBe(422);
});
