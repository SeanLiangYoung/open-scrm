import { test, expect, type APIRequestContext } from '@playwright/test';
// Real HTTP + Chromium/Vite with isolated auth/gateway/PostgreSQL16; no API mocks.
test.beforeEach(() => test.skip(process.env.TENANT_LOGIN_DISPOSABLE !== '1', 'Requires disposable tenant login harness'));
const username = 'duplicate_operator';
const credentials = { a: { username, password: 'TenantA@123', corpId: 1001 }, b: { username, password: 'TenantB@123', corpId: 1002 } };
function claims(token: string) { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
function noCredentials(body: Record<string, unknown>) {
  for (const field of ['accessToken', 'refreshToken', 'user', 'candidates', 'corpIds', 'password', 'roles']) expect(body).not.toHaveProperty(field);
}
async function login(request: APIRequestContext, tenant: 'a' | 'b') {
  const result = await request.post('/api/v1/auth/login', { data: credentials[tenant] });
  expect(result.status(), await result.text()).toBe(200);
  const body = await result.json();
  expect(Object.keys(body.user).sort()).toEqual(['corpId', 'id', 'isAdmin', 'username']);
  expect(Number(body.user.corpId)).toBe(credentials[tenant].corpId);
  expect(Number(body.user.isAdmin)).toBe(0);
  expect(Number(claims(body.accessToken).corpId)).toBe(credentials[tenant].corpId);
  return body;
}
async function assertStaffScope(request: APIRequestContext, accessToken: string, ids: string[]) {
  const result = await request.get('/api/v1/staff', { headers: { Authorization: `Bearer ${accessToken}` } });
  expect(result.status(), await result.text()).toBe(200);
  expect((await result.json()).data.list.map((row: { id: string }) => row.id).sort()).toEqual([...ids].sort());
}

test('ambiguous omitted company never trusts forged headers or query company', async ({ request }) => {
  for (const options of [
    { url: '/api/v1/auth/login', headers: {} },
    { url: '/api/v1/auth/login', headers: { 'x-corp-id': '1001', 'x-user-id': '11001' } },
    { url: '/api/v1/auth/login?corpId=1002', headers: { 'x-corp-id': '1002', 'x-user-id': '11002' } },
  ]) {
    const result = await request.post(options.url, { headers: options.headers, data: { username, password: 'TenantA@123' } });
    expect(result.status(), await result.text()).toBe(400);
    const body = await result.json();
    expect(body.message).toBe('同名账号存在多个企业，请填写企业编号');
    noCredentials(body);
  }
});

test('explicit company scopes each password and unique-name compatibility remains', async ({ request }) => {
  const a = await login(request, 'a');
  const b = await login(request, 'b');
  await assertStaffScope(request, a.accessToken, ['11001', '11004']);
  await assertStaffScope(request, b.accessToken, ['11002']);
  const unique = await request.post('/api/v1/auth/login', { data: { username: 'unique_operator', password: 'TenantA@123' } });
  expect(unique.status(), await unique.text()).toBe(200);
  expect(Number((await unique.json()).user.corpId)).toBe(1001);
  for (const data of [
    { ...credentials.a, corpId: 9999 }, { ...credentials.a, password: 'TenantB@123' },
    { ...credentials.b, password: 'TenantA@123' }, { ...credentials.a, username: 'disabled_operator' },
    { ...credentials.a, username: 'does-not-exist' },
  ]) {
    const result = await request.post('/api/v1/auth/login', { data });
    expect(result.status(), await result.text()).toBe(401);
    const body = await result.json();
    expect(body.message).toBe('账号或密码错误');
    noCredentials(body);
  }
});

test('company input must be a positive safe JSON number', async ({ request }) => {
  for (const corpId of ['1001', '1e3', 0, -1, 1.5, null, false, [], {}, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await request.post('/api/v1/auth/login', { data: { ...credentials.a, corpId } });
    expect(result.status(), await result.text()).toBe(400);
    noCredentials(await result.json());
  }
});

test('refresh authenticates its own token and never grants refresh-token Bearer access', async ({ request }) => {
  const a = await login(request, 'a');
  const b = await login(request, 'b');
  for (const [account, corpId, ids] of [[a, 1001, ['11001', '11004']], [b, 1002, ['11002']]] as const) {
    const refreshed = await request.post('/api/v1/auth/refresh-token', { data: { refreshToken: account.refreshToken } });
    expect(refreshed.status(), await refreshed.text()).toBe(200);
    const accessToken = (await refreshed.json()).accessToken;
    expect(Number(claims(accessToken).corpId)).toBe(corpId);
    await assertStaffScope(request, accessToken, [...ids]);
    const wrongPurpose = await request.get('/api/v1/staff', { headers: { Authorization: `Bearer ${account.refreshToken}` } });
    expect(wrongPurpose.status()).toBe(401);
    noCredentials(await wrongPurpose.json());
  }
  const withExpiredAccess = await request.post('/api/v1/auth/refresh-token', {
    headers: { Authorization: `Bearer ${process.env.TENANT_LOGIN_EXPIRED_ACCESS}` }, data: { refreshToken: a.refreshToken },
  });
  expect(withExpiredAccess.status(), await withExpiredAccess.text()).toBe(200);
  expect(Number(claims((await withExpiredAccess.json()).accessToken).corpId)).toBe(1001);
  for (const refreshToken of ['invalid-token', a.accessToken, process.env.TENANT_LOGIN_EXPIRED_REFRESH, process.env.TENANT_LOGIN_DISABLED_REFRESH]) {
    const result = await request.post('/api/v1/auth/refresh-token', { data: { refreshToken } });
    expect(result.status(), await result.text()).toBe(401);
    noCredentials(await result.json());
  }
  for (const data of [{}, { refreshToken: [] }, { refreshToken: 123 }]) {
    const result = await request.post('/api/v1/auth/refresh-token', { data });
    expect(result.status(), await result.text()).toBe(400);
  }
  const prefix = await request.post('/api/v1/auth/refresh-token/extra', { data: { refreshToken: a.refreshToken } });
  expect(prefix.status()).toBe(401);
});

test('real operation login preserves ambiguity input then selects company B explicitly', async ({ page }) => {
  await page.goto(`${process.env.TENANT_LOGIN_UI_URL}/login`);
  await page.getByPlaceholder('用户名', { exact: true }).fill(username);
  await page.getByPlaceholder('密码', { exact: true }).fill('TenantA@123');
  let response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '登 录' }).click();
  expect((await response).status()).toBe(400);
  await expect(page.getByText('同名账号存在多个企业，请填写企业编号', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('用户名', { exact: true })).toHaveValue(username);
  await expect(page.getByPlaceholder('密码', { exact: true })).toHaveValue('TenantA@123');
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.getByPlaceholder('企业编号（同名账号需填写，可选）').fill('1002');
  response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '登 录' }).click();
  expect((await response).status()).toBe(401);
  await expect(page.getByText('账号或密码错误', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.screenshot({ path: test.info().outputPath('wrong-company-password-keeps-input.png'), fullPage: true, animations: 'disabled' });
  await page.getByPlaceholder('密码', { exact: true }).fill('TenantB@123');
  response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '登 录' }).click();
  const success = await response;
  expect(success.status(), await success.text()).toBe(200);
  expect(success.request().postDataJSON()).toEqual(credentials.b);
  await expect(page.getByRole('button', { name: username, exact: true })).toBeVisible();
  const storedUser = await page.evaluate(() => JSON.parse(localStorage.getItem('user') || 'null'));
  expect(Number(storedUser.corpId)).toBe(1002);
  const staff = await page.evaluate(async () => {
    const result = await fetch('/api/v1/staff', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    return { status: result.status, body: await result.json() };
  });
  expect(staff.status).toBe(200);
  expect(staff.body.data.list).toEqual([{ id: '11002', username, realName: '同名乙员工' }]);
  await page.screenshot({ path: test.info().outputPath('company-b-authenticated-ui.png'), fullPage: true, animations: 'disabled' });
});
