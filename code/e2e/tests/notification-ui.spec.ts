import { test, expect, type Page } from '@playwright/test';
// Actual UI/login/directory/message persistence; no route interception or injected tokens.
test.beforeEach(() =>
  test.skip(
    process.env.NOTIFICATION_UI_DISPOSABLE !== '1',
    'Requires isolated notification UI harness'
  )
);
async function login(page: Page, username: string, corpId = 1) {
  await page.goto('/login');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('Admin@123');
  await page.getByPlaceholder('企业编号（同名账号需填写，可选）').fill(String(corpId));
  const response = page.waitForResponse(
    r => new URL(r.url()).pathname === '/api/v1/auth/login' && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: '登 录' }).click();
  const loggedIn = await response;
  expect(loggedIn.status(), await loggedIn.text()).toBe(200);
  await expect(page.locator('.uname')).toHaveText(username);
  await page.goto('/notifications');
  return (await loggedIn.json()).accessToken as string;
}
async function openDraft(page: Page, title: string) {
  await page.getByRole('button', { name: '发送通知', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '发送通知', exact: true });
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^标题/ })
    .getByRole('textbox')
    .fill(title);
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^内容/ })
    .getByRole('textbox')
    .fill('真实同事通知正文');
  const directoryResponse = page.waitForResponse(
    r => new URL(r.url()).pathname === '/api/v1/staff'
  );
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  const directory = await directoryResponse;
  expect(directory.status()).toBe(200);
  const ids = (await directory.json()).data.list.map((staff: { id: string }) => staff.id);
  expect(ids).toContain('9203');
  expect(ids).not.toContain('9204');
  expect(ids).not.toContain('9205');
  await page.getByRole('option', { name: '通知同事（notify_peer）', exact: true }).click();
  await page.keyboard.press('Escape');
  return dialog;
}
test('real employee selector sends to a same-enterprise peer who reads the persisted notification', async ({
  page,
  browser
}) => {
  await login(page, 'admin');
  const dialog = await openDraft(page, 'overnight-notification-peer');
  await page.screenshot({
    path: test.info().outputPath('real-notification-compose.png'),
    fullPage: true,
    animations: 'disabled'
  });
  const response = page.waitForResponse(
    r =>
      new URL(r.url()).pathname.replace(/\/$/, '') === '/api/notification' &&
      r.request().method() === 'POST'
  );
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  const created = await response;
  expect(created.status(), await created.text()).toBe(200);
  expect(created.request().postDataJSON()).toEqual({
    userIds: [9203],
    notificationType: 1,
    title: 'overnight-notification-peer',
    content: '真实同事通知正文'
  });
  await expect(dialog).not.toBeVisible();
  const context = await browser.newContext({ baseURL: process.env.NOTIFICATION_UI_BASE_URL });
  try {
    const recipient = await context.newPage();
    await login(recipient, 'notify_peer');
    const row = recipient.getByRole('row').filter({ hasText: 'overnight-notification-peer' });
    await expect(row).toBeVisible();
    const marked = recipient.waitForResponse(
      r => new URL(r.url()).pathname === '/api/notification/read'
    );
    await row.getByRole('button', { name: '标记已读', exact: true }).click();
    const read = await marked;
    expect(read.status(), await read.text()).toBe(200);
    expect((await read.json()).data.count).toBe(1);
    await expect(row.getByText('已读', { exact: true })).toBeVisible();
    await recipient.reload();
    await expect(
      recipient
        .getByRole('row')
        .filter({ hasText: 'overnight-notification-peer' })
        .getByText('已读', { exact: true })
    ).toBeVisible();
    await recipient.screenshot({
      path: test.info().outputPath('real-peer-read.png'),
      fullPage: true,
      animations: 'disabled'
    });
  } finally {
    await context.close();
  }
});
test('another enterprise sees no peer notifications and cannot mark its IDs read', async ({
  page
}) => {
  const token = await login(page, 'notify_foreign', 902);
  await expect(
    page.getByRole('row').filter({ hasText: 'notification-foreign-boundary-fixture' })
  ).toHaveCount(0);
  await expect(
    page.getByRole('row').filter({ hasText: 'overnight-notification-peer' })
  ).toHaveCount(0);
  const mark = await page.request.put('/api/notification/read', {
    headers: { Authorization: `Bearer ${token}` },
    data: { notificationIds: [92001] }
  });
  expect(mark.status(), await mark.text()).toBe(200);
  expect((await mark.json()).data.count).toBe(0);
  const count = await page.request.get('/api/notification/unread/count', {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect((await count.json()).data.count).toBe(0);
});
test('recipient disabled after directory selection is rejected atomically and draft remains editable', async ({
  page,
  request
}) => {
  await login(page, 'admin');
  const dialog = await openDraft(page, 'overnight-notification-disabled-draft');
  const disabled = await request.post(
    `${process.env.NOTIFICATION_FIXTURE_URL}/__fixture/disable-notification-peer`,
    { headers: { 'x-fixture-key': process.env.NOTIFICATION_FIXTURE_KEY || '' } }
  );
  expect(disabled.status(), await disabled.text()).toBe(200);
  const response = page.waitForResponse(
    r =>
      new URL(r.url()).pathname.replace(/\/$/, '') === '/api/notification' &&
      r.request().method() === 'POST'
  );
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  const rejected = await response;
  expect(rejected.status(), await rejected.text()).toBe(400);
  await expect(
    page.getByText('通知接收人必须全部属于本企业且为启用员工', { exact: true })
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator('.el-form-item').filter({ hasText: /^标题/ }).getByRole('textbox')
  ).toHaveValue('overnight-notification-disabled-draft');
  await expect(dialog.locator('.tenant-staff-select')).toContainText('通知同事（notify_peer）');
  await expect(dialog.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
});
