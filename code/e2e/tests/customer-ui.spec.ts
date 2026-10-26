import { test, expect, type Page } from '@playwright/test';
// Real browser + Vite + authenticated gateway + customer/auth + disposable PostgreSQL16.
// No request routing, mocked customer/auth responses, storage-token injection or real messages.
test.beforeEach(() => test.skip(process.env.CUSTOMER_UI_DISPOSABLE !== '1', 'Requires disposable customer UI harness'));
async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('用户名').fill('admin');
  await page.getByPlaceholder('密码').fill('Admin@123');
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '登 录' }).click();
  const result = await response;
  expect(result.status(), await result.text()).toBe(200);
  await expect(page.getByRole('button', { name: 'admin', exact: true })).toBeVisible();
}

test('real UI login creates a customer and persists a follow-up with refreshed timeline', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: '客户管理', exact: true }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await page.getByRole('button', { name: '新建客户', exact: true }).click();
  const customerDialog = page.getByRole('dialog', { name: '新建客户', exact: true });
  await customerDialog.locator('.el-form-item').filter({ hasText: '姓名' }).getByRole('textbox').fill('overnight-customer-ui-created');
  await customerDialog.locator('.el-form-item').filter({ hasText: '手机号' }).getByRole('textbox').fill('13800006666');
  await customerDialog.locator('.el-form-item').filter({ hasText: '备注' }).getByRole('textbox').fill('真实浏览器创建');
  const createResponse = page.waitForResponse(r => new URL(r.url()).pathname.replace(/\/$/, '') === '/api/v1/customers' && r.request().method() === 'POST');
  await customerDialog.getByRole('button', { name: '确定', exact: true }).click();
  const created = await createResponse;
  expect(created.status(), await created.text()).toBe(200);
  const createBody = created.request().postDataJSON();
  expect(createBody).toEqual({ externalUserid: expect.stringMatching(/^ext_\d+$/), name: 'overnight-customer-ui-created', gender: 0, channel: 'wechat', mobile: '13800006666', remark: '真实浏览器创建' });
  const customer = (await created.json()).data;
  const customerId = Number(customer.id);
  expect(Number(customer.corpId)).toBe(1);
  await expect(customerDialog).not.toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'overnight-customer-ui-created' });
  await expect(row).toBeVisible();
  await row.getByText('overnight-customer-ui-created', { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/customers/${customerId}$`));
  await page.getByRole('button', { name: '添加跟进', exact: true }).first().click();
  const followDialog = page.getByRole('dialog', { name: '添加跟进记录', exact: true });
  await followDialog.getByPlaceholder('记录跟进内容...').fill('真实浏览器跟进记录');
  await followDialog.getByPlaceholder('选择下次跟进时间').fill('2026-11-02 09:45:00');
  await followDialog.getByPlaceholder('选择下次跟进时间').press('Enter');
  const followResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/follow-ups' && r.request().method() === 'POST');
  await followDialog.getByRole('button', { name: '保存', exact: true }).click();
  const saved = await followResponse;
  expect(saved.status(), await saved.text()).toBe(200);
  expect(saved.request().postDataJSON()).toEqual({ customerId, followType: 2, content: '真实浏览器跟进记录', nextFollowTime: '2026-11-02T01:45:00.000Z' });
  await expect(followDialog).not.toBeVisible();
  await expect(page.locator('.el-timeline')).toContainText('真实浏览器跟进记录');
  await expect(page.getByText('跟进记录 (1)', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.el-timeline')).toContainText('真实浏览器跟进记录');
  await page.screenshot({ path: test.info().outputPath('persisted-customer-follow-up.png'), fullPage: true, animations: 'disabled' });
  await test.info().attach('actual-http-evidence', { body: Buffer.from(JSON.stringify({ customerId, createStatus: created.status(), followUpStatus: saved.status(), createBody, followBody: saved.request().postDataJSON() }, null, 2)), contentType: 'application/json' });
});

test('real backend validation rejects whitespace follow-up while preserving editable draft', async ({ page }) => {
  await login(page);
  await page.goto('/customers/9101');
  await page.getByRole('button', { name: '添加跟进', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '添加跟进记录', exact: true });
  await dialog.getByPlaceholder('记录跟进内容...').fill('   ');
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/follow-ups' && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  const rejected = await response;
  expect(rejected.status(), await rejected.text()).toBe(400);
  await expect(page.getByText('content 必须为非空字符串', { exact: true })).toBeVisible();
  await expect(dialog.getByPlaceholder('记录跟进内容...')).toHaveValue('   ');
  await expect(dialog.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await dialog.getByPlaceholder('记录跟进内容...').fill('失败后继续编辑的草稿');
  await page.screenshot({ path: test.info().outputPath('real-validation-keeps-draft.png'), fullPage: true, animations: 'disabled' });
  await test.info().attach('actual-validation-evidence', { body: Buffer.from(JSON.stringify({ status: rejected.status(), requestBody: rejected.request().postDataJSON(), responseBody: await rejected.json() }, null, 2)), contentType: 'application/json' });
});

test('real staff search selects an active teammate and persists customer assignment', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: '客户管理', exact: true }).click();
  await page.getByRole('button', { name: '新建客户', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建客户', exact: true });
  await dialog.locator('.el-form-item').filter({ hasText: '姓名' }).getByRole('textbox').fill('overnight-customer-ui-assigned');
  const staffResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/staff');
  const picker = dialog.locator('.tenant-staff-select');
  await picker.locator('.el-select').click();
  const initial = await staffResponse;
  expect(initial.status(), await initial.text()).toBe(200);
  const initialStaff = (await initial.json()).data.list.map((row: { id: string }) => row.id);
  expect(initialStaff).toContain('9103');
  expect(initialStaff).not.toContain('9104');
  expect(initialStaff).not.toContain('9105');
  const searchResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/staff' && new URL(r.url()).searchParams.get('keyword') === 'ui_teammate');
  await picker.getByRole('combobox').fill('ui_teammate');
  const searched = await searchResponse;
  expect(searched.status(), await searched.text()).toBe(200);
  expect((await searched.json()).data.list).toEqual([{ id: '9103', username: 'ui_teammate', realName: '界面同事' }]);
  await page.getByRole('option', { name: '界面同事（ui_teammate）', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('real-active-staff-selection.png'), fullPage: true, animations: 'disabled' });
  const response = page.waitForResponse(r => new URL(r.url()).pathname.replace(/\/$/, '') === '/api/v1/customers' && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  const created = await response;
  expect(created.status(), await created.text()).toBe(200);
  expect(created.request().postDataJSON()).toEqual({ name: 'overnight-customer-ui-assigned', gender: 0, followUserId: 9103, externalUserid: expect.stringMatching(/^ext_\d+$/), channel: 'wechat' });
  expect(Number((await created.json()).data.followUserId)).toBe(9103);
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'overnight-customer-ui-assigned' })).toBeVisible();
  await test.info().attach('actual-staff-assignment-evidence', { body: Buffer.from(JSON.stringify({ directoryStatus: initial.status(), searchStatus: searched.status(), createStatus: created.status(), createBody: created.request().postDataJSON() }, null, 2)), contentType: 'application/json' });
});
