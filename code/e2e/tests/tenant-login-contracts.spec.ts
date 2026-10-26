import { test, expect, type Page, type TestInfo } from '@playwright/test';
// Both UI suites intercept HTTP. No real account login or backend writes.
function inputs(page: Page, info: TestInfo) {
  const admin = info.config.metadata.loginApp === 'admin';
  return {
    username: page.getByPlaceholder(admin ? '请输入用户名' : '用户名', { exact: true }),
    password: page.getByPlaceholder(admin ? '请输入密码' : '密码', { exact: true }),
    corpId: page.getByPlaceholder('企业编号（同名账号需填写，可选）', { exact: true }),
    submit: page.getByRole('button', { name: /登\s*录/ })
  };
}
const success = {
  accessToken: 'login-test-token',
  refreshToken: 'login-refresh',
  user: { id: '7', corpId: '902', username: 'same-user', isAdmin: 1 }
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route =>
    route.fulfill({ json: { code: 200, data: { list: [], total: 0 } } })
  );
});
test('unique username login omits optional enterprise ID and persists only successful response', async ({
  page
}, info) => {
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: success }));
  await page.goto('/login');
  const ui = inputs(page, info);
  await ui.username.fill('unique-user');
  await ui.password.fill('Secret@123');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/auth/login'
  );
  await ui.submit.click();
  expect((await request).postDataJSON()).toEqual({
    username: 'unique-user',
    password: 'Secret@123'
  });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('token')))
    .toBe('login-test-token');
  await expect(page).toHaveURL(/\/$/);
});
test('specified canonical enterprise ID is submitted as a number', async ({ page }, info) => {
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: success }));
  await page.goto('/login');
  const ui = inputs(page, info);
  await ui.username.fill('same-user');
  await ui.password.fill('Secret@123');
  await ui.corpId.fill('902');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/auth/login'
  );
  await ui.submit.click();
  expect((await request).postDataJSON()).toEqual({
    username: 'same-user',
    password: 'Secret@123',
    corpId: 902
  });
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('user') || '{}').corpId))
    .toBe('902');
});
for (const id of ['0', '1e1', '9007199254740993', ' 2 ']) {
  test(`invalid enterprise ID is blocked before login: ${id}`, async ({ page }, info) => {
    let posts = 0;
    page.on('request', request => {
      if (request.method() === 'POST') posts++;
    });
    await page.goto('/login');
    const ui = inputs(page, info);
    await ui.username.fill('same-user');
    await ui.password.fill('Secret@123');
    await ui.corpId.fill(id);
    await ui.submit.click();
    await expect(page.getByText('企业编号必须为安全的十进制正整数', { exact: true })).toBeVisible();
    expect(posts).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
}
test('ambiguous account response retains editable fields and never persists tokens', async ({
  page
}, info) => {
  await page.route('**/api/v1/auth/login', route =>
    route.fulfill({ status: 400, json: { message: '该用户名属于多个企业，请填写企业编号' } })
  );
  await page.goto('/login');
  const ui = inputs(page, info);
  await ui.username.fill('same-user');
  await ui.password.fill('Secret@123');
  await ui.submit.click();
  await expect(
    page.getByText('该用户名属于多个企业，请填写企业编号', { exact: true })
  ).toBeVisible();
  await expect(ui.username).toHaveValue('same-user');
  await expect(ui.password).toHaveValue('Secret@123');
  await expect(ui.corpId).toHaveValue('');
  await expect(ui.corpId).toBeEnabled();
  expect(
    await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      refresh: localStorage.getItem('refreshToken'),
      user: localStorage.getItem('user')
    }))
  ).toEqual({ token: null, refresh: null, user: null });
  await expect(page).toHaveURL(/\/login$/);
});
test('wrong password 401 remains in place and preserves enterprise and credentials without persisting a token', async ({
  page
}, info) => {
  await page.route('**/api/v1/auth/login', route =>
    route.fulfill({ status: 401, json: { message: '账号或密码错误' } })
  );
  await page.goto('/login');
  const ui = inputs(page, info);
  await ui.username.fill('same-user');
  await ui.password.fill('Wrong@123');
  await ui.corpId.fill('902');
  await ui.submit.click();
  await expect(page.getByText('账号或密码错误', { exact: true })).toBeVisible();
  await expect(ui.username).toHaveValue('same-user');
  await expect(ui.password).toHaveValue('Wrong@123');
  await expect(ui.corpId).toHaveValue('902');
  await expect(ui.username).toBeEnabled();
  await expect(ui.corpId).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});
test('protected resource 401 continues to clear authentication and redirect to login', async ({
  page
}, info) => {
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: success }));
  await page.goto('/login');
  const ui = inputs(page, info);
  await ui.username.fill('unique-user');
  await ui.password.fill('Secret@123');
  await ui.submit.click();
  await expect(page).toHaveURL(/\/$/);
  await page.route('**/api/v1/protected-test', route =>
    route.fulfill({ status: 401, json: { message: 'expired' } })
  );
  await page.evaluate(async () => {
    const modulePath = '/src/utils/api.ts';
    const { default: api } = await import(modulePath);
    await api.get('/api/v1/protected-test').catch(() => undefined);
  });
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});
test('late protected 401 from the previous enterprise preserves the new login', async ({ page }, info) => {
  let loginCount = 0;
  await page.route('**/api/v1/auth/login', route => {
    loginCount++;
    return route.fulfill({ json: {
      ...success,
      accessToken: loginCount === 1 ? 'enterprise-A-token' : 'enterprise-B-token',
      user: { ...success.user, corpId: loginCount === 1 ? '901' : '902' }
    } });
  });
  await page.goto('/login');
  const ui = inputs(page, info);
  await ui.username.fill('same-user');
  await ui.password.fill('Secret@123');
  await ui.corpId.fill('901');
  await ui.submit.click();
  await expect(page).toHaveURL(/\/$/);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/previous-enterprise', async route => {
    expect(route.request().headers().authorization).toBe('Bearer enterprise-A-token');
    await held;
    await route.fulfill({ status: 401, json: { message: 'old enterprise access expired' } });
  });
  const oldRequest = page.waitForRequest('**/api/v1/previous-enterprise');
  await page.evaluate(async () => {
    const modulePath = '/src/utils/api.ts';
    const { default: api } = await import(modulePath);
    void api.get('/api/v1/previous-enterprise').catch(() => undefined).finally(() => {
      (window as Window & { previousEnterpriseRequestDone?: boolean }).previousEnterpriseRequestDone = true;
    });
  });
  await oldRequest;
  await page.evaluate(async () => {
    const modulePath = '/src/stores/auth.ts';
    const { useAuthStore } = await import(modulePath);
    const auth = useAuthStore();
    auth.logout();
    await auth.login('same-user', 'Secret@123', 902);
  });
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('enterprise-B-token');
  const oldResponse = page.waitForResponse('**/api/v1/previous-enterprise');
  release();
  await oldResponse;
  await page.waitForFunction(() =>
    (window as Window & { previousEnterpriseRequestDone?: boolean }).previousEnterpriseRequestDone === true
  );
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('enterprise-B-token');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('user') || '{}').corpId)).toBe('902');
  await expect(page).toHaveURL(/\/$/);
});

test('pending login disables inputs and ignores repeated Enter events before the held response', async ({
  page
}, info) => {
  let posts = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route('**/api/v1/auth/login', async route => {
    posts++;
    await gate;
    await route.fulfill({ json: success });
  });
  try {
    await page.goto('/login');
    const ui = inputs(page, info);
    await ui.username.fill('same-user');
    await ui.password.fill('Secret@123');
    await ui.corpId.fill('902');
    await ui.password.press('Enter');
    await expect.poll(() => posts).toBe(1);
    const fieldsDisabled = [
      await ui.username.isDisabled(),
      await ui.password.isDisabled(),
      await ui.corpId.isDisabled()
    ];
    // Normal DOM events exercise both Enter handlers; no component internals or hooks.
    await ui.password.dispatchEvent('keyup', { key: 'Enter', code: 'Enter' });
    await ui.corpId.dispatchEvent('keyup', { key: 'Enter', code: 'Enter' });
    release();
    await expect(page).toHaveURL(/\/$/);
    expect(posts).toBe(1);
    expect(fieldsDisabled).toEqual([true, true, true]);
  } finally {
    release();
  }
});
