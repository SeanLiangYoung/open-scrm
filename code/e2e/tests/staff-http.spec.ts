import { test, expect, type APIRequestContext } from '@playwright/test';
// Real authenticated gateway HTTP against isolated PostgreSQL16; no external messages.
test.beforeEach(() => test.skip(process.env.STAFF_HTTP_DISPOSABLE !== '1', 'Requires disposable staff HTTP harness'));
async function login(request: APIRequestContext, tenant: 'a' | 'b') {
  const result = await request.post('/api/v1/auth/login', { data: { username: `staffoperator${tenant}`, password: 'Admin@123' } });
  expect(result.ok(), await result.text()).toBeTruthy();
  const body = await result.json();
  expect(Number(body.user.corpId)).toBe(tenant === 'a' ? 901 : 902);
  expect(Number(body.user.isAdmin)).toBe(0);
  return { Authorization: `Bearer ${body.accessToken}` };
}
async function directory(request: APIRequestContext, headers: Record<string, string>, params: Record<string, string | number> = {}) {
  const result = await request.get('/api/v1/staff', { headers, params });
  expect(result.ok(), await result.text()).toBeTruthy();
  const body = await result.json();
  expect(body.success).toBe(true);
  for (const row of body.data.list) {
    expect(Object.keys(row).sort()).toEqual(['id', 'realName', 'username']);
    expect(typeof row.id).toBe('string');
    expect(row.id).toMatch(/^[1-9]\d*$/);
    expect(typeof row.username).toBe('string');
    expect(row.realName === null || typeof row.realName === 'string').toBe(true);
  }
  return body.data;
}

test('ordinary employees see only active own-company public fields with exact bigint IDs', async ({ request }) => {
  expect((await request.get('/api/v1/staff')).status()).toBe(401);
  const a = await login(request, 'a');
  const b = await login(request, 'b');
  const ownA = await directory(request, a);
  const ownB = await directory(request, b);
  expect(ownA.total).toBe(7);
  expect(ownB.total).toBe(3);
  expect(ownA.list.map((row: { id: string }) => row.id).sort()).toEqual(['9201', '9203', '9204', '9209', '9210', '9211', '9007199254740993'].sort());
  expect(ownB.list.map((row: { id: string }) => row.id).sort()).toEqual(['9202', '9206', '9207'].sort());
  expect(ownA.list.find((row: { id: string }) => row.id === '9007199254740993')).toEqual({ id: '9007199254740993', username: 'largemember', realName: null });
  expect((await request.get('/api/v1/users/', { headers: a })).status()).toBe(403);
  const spoofed = await directory(request, { ...a, 'x-corp-id': '902', 'x-user-id': '9202' });
  expect(spoofed).toEqual(ownA);
  expect((await directory(request, a, { keyword: 'shared' })).list).toEqual([{ id: '9203', username: 'shared', realName: '甲同名员工' }]);
  expect((await directory(request, b, { keyword: 'shared' })).list).toEqual([{ id: '9206', username: 'shared', realName: '乙同名员工' }]);
});

test('literal keyword search escapes SQL wildcards and pagination has stable totals', async ({ request }) => {
  const headers = await login(request, 'a');
  for (const [keyword, id] of [['%', '9204'], ['_', '9209'], ['\\', '9210'], ['mixedcase', '9211']]) {
    const result = await directory(request, headers, { keyword });
    expect(result.total).toBe(1);
    expect(result.list[0].id).toBe(id);
  }
  expect((await directory(request, headers, { keyword: "' OR 1=1 --" })).total).toBe(0);
  const all = await directory(request, headers);
  const paged = [];
  for (let page = 1; page <= 4; page++) {
    const result = await directory(request, headers, { page, pageSize: 2 });
    expect(result).toMatchObject({ total: 7, page, pageSize: 2 });
    paged.push(...result.list);
  }
  expect(paged).toEqual(all.list);
  const end = await directory(request, headers, { page: 5, pageSize: 2 });
  expect(end).toMatchObject({ list: [], total: 7, page: 5, pageSize: 2 });
});

test('strict query rejects tenant injection and ambiguous paging over real HTTP', async ({ request }) => {
  const headers = await login(request, 'a');
  for (const query of ['corpId=902', 'status=0', 'page=0', 'page=2junk', 'page=1e1', 'page=1&page=2', 'pageSize=101', 'keyword[]=shared', `keyword=${'x'.repeat(51)}`, 'page=9007199254740991&pageSize=100']) {
    const result = await request.get(`/api/v1/staff?${query}`, { headers });
    expect(result.status(), `${query}: ${await result.text()}`).toBe(400);
  }
});

test('actual notification writes validate the entire own-company active recipient set', async ({ request }) => {
  const a = await login(request, 'a');
  const b = await login(request, 'b');
  const body = { notificationType: 1, title: 'staff-http-valid', content: 'Internal database notification only' };
  // Well-formed IDs reach the service's complete recipient-set validation.
  for (const userIds of [[9202], [9205], [999999], [9201, 9202]]) {
    const result = await request.post('/api/notification/', { headers: a, data: { ...body, title: 'staff-http-invalid', userIds } });
    expect(result.status(), await result.text()).toBe(400);
  }
  // Invalid shapes are rejected earlier by the strict DTO, using Midway's 422.
  for (const userIds of [[], [0], [-1]]) {
    const result = await request.post('/api/notification/', { headers: a, data: { ...body, title: 'staff-http-invalid', userIds } });
    expect(result.status(), await result.text()).toBe(422);
  }
  const own = await request.post('/api/notification/', { headers: { ...a, 'x-corp-id': '902' }, data: { ...body, userIds: [9201, 9203, 9201] } });
  expect(own.ok(), await own.text()).toBeTruthy();
  expect((await own.json()).data).toEqual({ success: true, count: 2 });
  const other = await request.post('/api/notification/', { headers: b, data: { ...body, userIds: 9202 } });
  expect(other.ok(), await other.text()).toBeTruthy();
  expect((await other.json()).data).toEqual({ success: true, count: 1 });
});
