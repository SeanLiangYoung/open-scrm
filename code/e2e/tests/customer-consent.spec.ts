import { test, expect, type Page } from '@playwright/test';
const writes: Array<{ path: string; body: any }> = [];
const calls: string[] = [];
let fail = false,
  revokedCount = 2;
test.beforeEach(async ({ page }) => {
  writes.length = 0;
  calls.length = 0;
  fail = false;
  revokedCount = 2;
  await page.addInitScript(() => {
    localStorage.setItem('token', 'consent-mock');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  await page.route('**/api/**', async route => {
    const r = route.request(),
      path = new URL(r.url()).pathname;
    calls.push(path);
    if (path.includes('/consents/customer/'))
      return route.fulfill({
        json: {
          success: true,
          data: {
            customerId: path.split('/').pop(),
            purpose: 'marketing',
            observedAt: '2026-10-26T00:00:00.000Z',
            hasActiveMarketingConsent: false,
            activeCount: 0,
            revokedCount: 0,
            total: 0,
            page: Number(new URL(r.url()).searchParams.get('page') || 1),
            pageSize: 20,
            list: []
          }
        }
      });
    if (path.includes('/consents/')) {
      writes.push({ path, body: r.postDataJSON() });
      if (fail) return route.fulfill({ status: 400, json: { message: '授权证据参数无效' } });
      return route.fulfill({
        json: {
          success: true,
          data: path.endsWith('/grant')
            ? { id: '41', policyVersion: 'policy-v1', channel: 'web', locale: 'zh-CN' }
            : { revokedCount }
        }
      });
    }
    const data = path.startsWith('/api/v1/customers/')
      ? { id: path.split('/').pop(), name: '测试客户', gender: 0, status: 1, tags: [] }
      : { list: [] };
    await route.fulfill({ json: { success: true, data } });
  });
});
async function draft(page: Page) {
  await page.getByPlaceholder('填写实际授权政策版本').fill(' policy-v1 ');
  await page.locator('.el-form-item').filter({ hasText: '证据渠道' }).locator('.el-select').click();
  await page.getByRole('option', { name: 'Web', exact: true }).click();
  await page.getByPlaceholder('例如 zh-CN').fill('zh-CN');
}
const grant = (p: Page) => p.getByRole('button', { name: '登记授权证据', exact: true }).click();
const revoke = (p: Page) => p.getByRole('button', { name: '撤回营销授权', exact: true }).click();
test('exact grant evidence without invented tenant identity', async ({ page }) => {
  await page.goto('/customers/10');
  await draft(page);
  await grant(page);
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次登记');
  expect(writes).toEqual([
    {
      path: '/api/v1/messages/consents/grant',
      body: {
        customerId: 10,
        purpose: 'marketing',
        policyVersion: 'policy-v1',
        channel: 'web',
        locale: 'zh-CN'
      }
    }
  ]);
});
test('exact revoke body and positive count', async ({ page }) => {
  await page.goto('/customers/10');
  await revoke(page);
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次撤回 2 条');
  expect(writes).toEqual([
    { path: '/api/v1/messages/consents/revoke', body: { customerId: 10, purpose: 'marketing' } }
  ]);
});
test('empty policy blocks writes', async ({ page }) => {
  await page.goto('/customers/10');
  await draft(page);
  await page.getByPlaceholder('填写实际授权政策版本').fill(' ');
  await grant(page);
  await expect(page.getByText('请填写实际授权政策版本', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});
test('channel and locale require explicit evidence', async ({ page }) => {
  await page.goto('/customers/10');
  await page.getByPlaceholder('填写实际授权政策版本').fill('v1');
  await grant(page);
  await expect(page.getByText('请选择实际证据渠道并填写语言地区', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});
test('invalid locale preserves draft with no writes', async ({ page }) => {
  await page.goto('/customers/10');
  await draft(page);
  await page.getByPlaceholder('例如 zh-CN').fill('bad_locale');
  await grant(page);
  await expect(page.getByText('语言地区格式无效', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('例如 zh-CN')).toHaveValue('bad_locale');
  expect(writes).toHaveLength(0);
});
test('unsafe customer ID blocks both writes without rounding', async ({ page }) => {
  await page.goto('/customers/9007199254740993');
  await draft(page);
  await grant(page);
  await revoke(page);
  await expect(
    page.getByText('客户编号无效，无法提交授权操作', { exact: true }).first()
  ).toBeVisible();
  expect(writes).toHaveLength(0);
});
test('grant failure preserves evidence and reports no success', async ({ page }) => {
  fail = true;
  await page.goto('/customers/10');
  await draft(page);
  await grant(page);
  await expect(page.getByText('授权证据参数无效', { exact: true }).first()).toBeVisible();
  await expect(page.getByPlaceholder('填写实际授权政策版本')).toHaveValue(' policy-v1 ');
  await expect(page.getByTestId('consent-operation-result')).not.toBeVisible();
});
test('zero count is actual zero', async ({ page }) => {
  revokedCount = 0;
  await page.goto('/customers/10');
  await revoke(page);
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次撤回 0 条');
});
test('reload reads a real snapshot without cached operation results or global identity queries', async ({
  page
}) => {
  await page.goto('/customers/10');
  await draft(page);
  await grant(page);
  await expect(page.getByTestId('consent-operation-result')).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('授权快照仅反映读取时的证据记录，不代表持续实时状态。', { exact: true })
  ).toBeVisible();
  await expect(page.getByTestId('consent-operation-result')).not.toBeVisible();
  expect(calls.filter(p => /users|companies|consents\/(history|status)/.test(p))).toEqual([]);
});
test('revoke failure retains prior result and draft', async ({ page }) => {
  await page.goto('/customers/10');
  await draft(page);
  await grant(page);
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次登记');
  fail = true;
  await revoke(page);
  await expect(page.getByText('授权证据参数无效', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次登记');
  await expect(page.getByPlaceholder('例如 zh-CN')).toHaveValue('zh-CN');
});
