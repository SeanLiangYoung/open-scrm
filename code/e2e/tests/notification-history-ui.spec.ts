import { test, expect, type Page } from '@playwright/test';
test.beforeEach(() =>
  test.skip(
    process.env.NOTIFICATION_HISTORY_UI_DISPOSABLE !== '1',
    'Requires dedicated history UI harness'
  )
);
async function login(page: Page, username = 'admin', corpId = 1) {
  await page.goto('/login');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('Admin@123');
  await page.getByPlaceholder('企业编号（同名账号需填写，可选）').fill(String(corpId));
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/auth/login');
  await page.getByRole('button', { name: '登 录' }).click();
  const auth = await response;
  expect(auth.status(), await auth.text()).toBe(200);
  await expect(page.locator('.uname')).toHaveText(username);
  const list = page.waitForResponse(r => new URL(r.url()).pathname === '/api/notification/list');
  await page.goto('/notifications');
  const loaded = await list;
  expect(loaded.status(), await loaded.text()).toBe(200);
  return { token: (await auth.json()).accessToken as string, data: (await loaded.json()).data };
}
async function filter(page: Page, label: string, value: string) {
  const response = page.waitForResponse(
    r =>
      new URL(r.url()).pathname === '/api/notification/list' &&
      new URL(r.url()).searchParams.get('isRead') === value
  );
  await page
    .locator('.el-select')
    .filter({ has: page.getByRole('combobox', { name: '通知状态', exact: true }) })
    .click();
  await page.getByRole('option', { name: label, exact: true }).click();
  const result = await response;
  expect(result.status(), await result.text()).toBe(200);
  return (await result.json()).data;
}
test('actual page1/page2 reaches all30 owned visible rows while expired unread never appears in badge or list', async ({
  page
}) => {
  const first = await login(page);
  expect(first.data.total).toBe(30);
  expect(first.data.list).toHaveLength(20);
  await expect(page.locator('.el-badge__content')).toHaveText('25');
  await expect(page.getByRole('row')).toHaveCount(21);
  const response = page.waitForResponse(
    r =>
      new URL(r.url()).pathname === '/api/notification/list' &&
      new URL(r.url()).searchParams.get('page') === '2'
  );
  await page.locator('.el-pagination .btn-next').click();
  const second = await response;
  expect(second.status()).toBe(200);
  const data = (await second.json()).data;
  expect(data.total).toBe(30);
  expect(data.list).toHaveLength(10);
  const ids = [...first.data.list, ...data.list].map((row: { id: string }) => row.id);
  expect(new Set(ids).size).toBe(30);
  await expect(page.getByRole('row').filter({ hasText: 'history-A-25' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'history-expired-' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'history-peer-' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'history-foreign-' })).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath('real-notification-history-page2.png'),
    fullPage: true,
    animations: 'disabled'
  });
  await page.locator('.el-pagination .btn-prev').click();
  await expect(page.getByRole('row').filter({ hasText: 'history-A-1' }).first()).toBeVisible();
  await expect(page.locator('.el-pagination .el-pager .is-active')).toHaveText('1');
});
test('same-enterprise peer and another enterprise see only own history and cannot mark admin IDs', async ({
  page
}) => {
  for (const [username, corpId, count] of [
    ['history_peer', 1, 3],
    ['history_foreign', 902, 2]
  ] as const) {
    const loaded = await login(page, username, corpId);
    expect(loaded.data.total).toBe(count);
    expect(loaded.data.list).toHaveLength(count);
    await expect(page.getByRole('row').filter({ hasText: 'history-A-' })).toHaveCount(0);
    const marked = await page.request.put('/api/notification/read', {
      headers: { Authorization: `Bearer ${loaded.token}` },
      data: { notificationIds: [93125] }
    });
    expect(marked.status(), await marked.text()).toBe(200);
    expect((await marked.json()).data.count).toBe(0);
  }
});
test('unread page2 mark persists24 unread and6 read after reload with global badge independent of filter', async ({
  page
}) => {
  await login(page);
  const unread = await filter(page, '未读', '0');
  expect(unread.total).toBe(25);
  const page2 = page.waitForResponse(
    r =>
      new URL(r.url()).pathname === '/api/notification/list' &&
      new URL(r.url()).searchParams.get('page') === '2'
  );
  await page.locator('.el-pagination .btn-next').click();
  expect((await (await page2).json()).data.list).toHaveLength(5);
  const marked = page.waitForResponse(r => new URL(r.url()).pathname === '/api/notification/read');
  await page
    .getByRole('row')
    .filter({ hasText: 'history-A-25' })
    .getByRole('button', { name: '标记已读', exact: true })
    .click();
  const result = await marked;
  expect(result.status(), await result.text()).toBe(200);
  expect((await result.json()).data.count).toBe(1);
  await expect(page.getByRole('row').filter({ hasText: 'history-A-25' })).toHaveCount(0);
  await expect(page.locator('.el-pagination')).toContainText('24');
  await expect(page.getByRole('row')).toHaveCount(5);
  await expect(page.locator('.el-badge__content')).toHaveText('24');
  const read = await filter(page, '已读', '1');
  expect(read.total).toBe(6);
  await expect(page.locator('.el-badge__content')).toHaveText('24');
  await page.reload();
  await expect(page.locator('.el-badge__content')).toHaveText('24');
  expect((await filter(page, '已读', '1')).total).toBe(6);
  await expect(
    page.getByRole('row').filter({ hasText: 'history-A-25' }).getByText('已读', { exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('real-notification-filtered-read.png'),
    fullPage: true,
    animations: 'disabled'
  });
});
