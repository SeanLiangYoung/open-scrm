import { test, expect } from '@playwright/test';

const gateway = process.env.GATEWAY_URL;

// Fresh dedicated fixtures are created and destroyed by the companion harness.
test('follow-up HTTP: authenticated tenant writes, lists, rejects spoofing and cross-tenant access', async ({ request }) => {
  test.skip(process.env.CUSTOMER_HTTP_DISPOSABLE !== '1' || !gateway,
    'Run overnight-customer-http.cjs against its disposable stack');
  const endpoint = `${gateway}/api/v1/follow-ups`;
  const ownCustomer = 9101;
  const otherCustomer = 9102;
  let tokenA: string;
  let tokenB: string;
  let adminUserId: number | string;
  let tenantBUserId: number | string;

  await test.step('both real tenant accounts log in through auth and gateway', async () => {
    const login = async (username: string) => {
      const response = await request.post(`${gateway}/api/v1/auth/login`, {
        data: { username, password: 'Admin@123' }
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      const data = await response.json();
      expect(typeof data.accessToken).toBe('string');
      return data;
    };
    const a = await login('admin');
    const b = await login('overnight_tenant_b');
    expect(String(a.user.corpId)).toBe('1');
    expect(String(b.user.corpId)).toBe('902');
    tokenA = a.accessToken;
    tokenB = b.accessToken;
    adminUserId = a.user.id;
    tenantBUserId = b.user.id;
  });
  const headersA = () => ({ Authorization: `Bearer ${tokenA}` });
  const headersB = () => ({ Authorization: `Bearer ${tokenB}` });

  await test.step('anonymous writes and lists remain unauthorized even with forged identity headers', async () => {
    const headers = { 'x-corp-id': '1', 'x-user-id': '1' };
    const create = await request.post(endpoint, { headers, data: { customerId: ownCustomer, content: '禁止匿名写入' } });
    expect(create.status(), await create.text()).toBe(401);
    const list = await request.get(`${endpoint}/customer/${ownCustomer}`, { headers });
    expect(list.status(), await list.text()).toBe(401);
  });

  await test.step('authenticated create ignores forged body identity', async () => {
    const response = await request.post(endpoint, {
      headers: headersA(), data: { customerId: ownCustomer, content: '企业A正文身份验证', corpId: 902, userId: 9102 }
    });
    expect(response.status(), await response.text()).toBe(200);
    const { data } = await response.json();
    expect(String(data.corpId)).toBe('1');
    expect(String(data.userId)).toBe(String(adminUserId));
    expect(data.followType).toBe(1);
    expect(data.nextFollowTime).toBeNull();
  });

  await test.step('gateway overwrites forged identity headers with actual JWT identity', async () => {
    const response = await request.post(endpoint, {
      headers: { ...headersA(), 'x-corp-id': '902', 'x-user-id': '9102' },
      data: { customerId: ownCustomer, content: '企业A头身份验证', followType: 4, nextFollowTime: '2028-02-29T08:00:00.000Z' }
    });
    expect(response.status(), await response.text()).toBe(200);
    const { data } = await response.json();
    expect(String(data.corpId)).toBe('1');
    expect(String(data.userId)).toBe(String(adminUserId));
    expect(data.followType).toBe(4);
    expect(data.nextFollowTime).toBe('2028-02-29T08:00:00.000Z');
  });

  await test.step('second authenticated tenant creates only its own customer follow-up', async () => {
    const response = await request.post(endpoint, {
      headers: headersB(), data: { customerId: otherCustomer, content: '企业B记录' }
    });
    expect(response.status(), await response.text()).toBe(200);
    const { data } = await response.json();
    expect(String(data.corpId)).toBe('902');
    expect(String(data.userId)).toBe(String(tenantBUserId));
  });

  await test.step('both tenants list only their own records; pagination total excludes polluted fixture', async () => {
    const response = await request.get(`${endpoint}/customer/${ownCustomer}`, { headers: headersA() });
    expect(response.status(), await response.text()).toBe(200);
    const { data } = await response.json();
    expect(data.total).toBe(2);
    expect(data.list).toHaveLength(2);
    expect(data.list.every((row: { corpId: number | string }) => String(row.corpId) === '1')).toBeTruthy();
    const page = await request.get(`${endpoint}/customer/${ownCustomer}?page=2&pageSize=1`, { headers: headersA() });
    expect(page.status(), await page.text()).toBe(200);
    expect((await page.json()).data).toMatchObject({ total: 2, page: 2, pageSize: 1, list: [expect.any(Object)] });
    const second = await request.get(`${endpoint}/customer/${otherCustomer}`, { headers: headersB() });
    expect(second.status(), await second.text()).toBe(200);
    expect((await second.json()).data).toMatchObject({ total: 1 });
  });

  await test.step('cross-tenant reads and writes return 404 in both directions, including forged headers', async () => {
    for (const [customerId, headers] of [
      [otherCustomer, { ...headersA(), 'x-corp-id': '902', 'x-user-id': '9102' }],
      [ownCustomer, { ...headersB(), 'x-corp-id': '1', 'x-user-id': '1' }]
    ] as const) {
      const list = await request.get(`${endpoint}/customer/${customerId}`, { headers });
      expect(list.status(), await list.text()).toBe(404);
      const create = await request.post(endpoint, { headers, data: { customerId, content: '禁止跨企业写入' } });
      expect(create.status(), await create.text()).toBe(404);
    }
  });

  await test.step('malformed bodies, content, enums, dates and pagination return HTTP400', async () => {
    for (const body of [
      null, [], { customerId: ownCustomer, content: '  ' },
      { customerId: ownCustomer, content: {} },
      { customerId: ownCustomer, content: '禁止', followType: 0 },
      { customerId: ownCustomer, content: '禁止', nextFollowTime: '2026-02-30T10:00:00.000Z' }
    ]) {
      const response = await request.post(endpoint, { headers: headersA(), data: body });
      expect(response.status(), await response.text()).toBe(400);
    }
    for (const suffix of ['1e1', `${ownCustomer}?page=0`, `${ownCustomer}?pageSize=101`, `${ownCustomer}?page=${Number.MAX_SAFE_INTEGER}&pageSize=100`]) {
      const response = await request.get(`${endpoint}/customer/${suffix}`, { headers: headersA() });
      expect(response.status(), await response.text()).toBe(400);
    }
  });
});
