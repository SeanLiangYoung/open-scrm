import { test, expect } from '@playwright/test';
// Request-shape browser tests with intercepted APIs, no database writes.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'customer-form-mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  await page.route('**/api/**', route =>
    route.fulfill({
      json: {
        code: 200,
        data: {
          list: [
            {
              id: 10,
              name: '原客户',
              gender: 1,
              mobile: '13800138000',
              channel: 'offline',
              remark: '原备注',
              status: 1,
              createTime: '2026-10-26T00:00:00Z'
            }
          ],
          total: 1
        }
      }
    })
  );
});
test('create submits supported DTO fields without invented owner or identity and omits blank optionals', async ({
  page
}) => {
  await page.goto('/customers');
  await page.getByRole('button', { name: '新建客户', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建客户', exact: true });
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^姓名/ })
    .getByRole('textbox')
    .fill('新客户');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/customers'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({
    externalUserid: expect.stringMatching(/^ext_\d+$/),
    name: '新客户',
    gender: 0,
    channel: 'wechat'
  });
  await expect(dialog).not.toBeVisible();
});
test('edit does not offer unsupported channel changes or send create-only fields', async ({
  page
}) => {
  await page.goto('/customers');
  await page
    .getByRole('row')
    .filter({ hasText: '原客户' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '编辑客户', exact: true });
  await expect(dialog.locator('.el-form-item').filter({ hasText: /^邮箱/ })).toHaveCount(0);
  await expect(
    dialog.locator('.el-form-item').filter({ hasText: /^来源/ }).locator('.el-select')
  ).toHaveCount(0);
  await expect(dialog.getByText('线下（仅创建时设置）', { exact: true })).toBeVisible();
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^姓名/ })
    .getByRole('textbox')
    .fill('修改后');
  const request = page.waitForRequest(
    r => r.method() === 'PUT' && new URL(r.url()).pathname === '/api/v1/customers/10'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({
    name: '修改后',
    gender: 1,
    mobile: '13800138000',
    remark: '原备注'
  });
});
test('clearing existing mobile and remark sends explicit null while leaving assignment omitted', async ({
  page
}) => {
  await page.goto('/customers');
  await page
    .getByRole('row')
    .filter({ hasText: '原客户' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '编辑客户', exact: true });
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^手机号/ })
    .getByRole('textbox')
    .fill('');
  await dialog.locator('.el-form-item').filter({ hasText: /^备注/ }).getByRole('textbox').fill('');
  const request = page.waitForRequest(
    r => r.method() === 'PUT' && new URL(r.url()).pathname === '/api/v1/customers/10'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({
    name: '原客户',
    gender: 1,
    mobile: null,
    remark: null
  });
});
test('empty customer name is rejected before a create request', async ({ page }) => {
  let writes = 0;
  page.on('request', request => {
    if (request.method() === 'POST') writes++;
  });
  await page.goto('/customers');
  await page.getByRole('button', { name: '新建客户', exact: true }).click();
  await page
    .getByRole('dialog', { name: '新建客户', exact: true })
    .getByRole('button', { name: '确定', exact: true })
    .click();
  await expect(page.getByText('请输入客户姓名', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
