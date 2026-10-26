import { test, expect, type Page } from '@playwright/test';
// Actual Vite/gateway/auth/message/PostgreSQL; synthetic seed history, no routed APIs.
test.beforeEach(() => test.skip(process.env.MESSAGE_LOGS_UI_DISPOSABLE !== '1', 'Requires disposable logs harness'));
async function login(page: Page, username = 'logoperatora') {
  await page.goto('/login');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('Admin@123');
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/auth/login');
  await page.getByRole('button', { name: '登 录' }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('button', { name: username, exact: true })).toBeVisible();
  await page.goto('/message-logs');
  await expect(page.getByRole('heading', { name: '消息日志' })).toBeVisible();
}
async function retry(page: Page, id: number, spoof = false) {
  return page.evaluate(async ({ id, spoof }) => {
    const res = await fetch('/api/message/retry', { method: 'POST', headers: {
      'content-type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}`,
      ...(spoof ? { 'x-corp-id': '1201', 'x-user-id': '12101' } : {}),
    }, body: JSON.stringify({ logIds: [id] }) });
    return { status: res.status, body: await res.json() };
  }, { id, spoof });
}
test('real failed Mock retry refreshes successful record without claiming delivery', async ({ page }) => {
  await login(page);
  const row = page.getByRole('row').filter({ hasText: '日志A失败模拟' });
  await row.getByRole('button', { name: '重试模拟消息', exact: true }).click();
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/message/retry');
  await page.getByRole('button', { name: '确认重试', exact: true }).click();
  const result = await response;
  expect(result.request().postDataJSON()).toEqual({ logIds: [62001] });
  expect((await result.json()).data).toMatchObject({ total: 1, success: 1, failed: 0 });
  await expect(page.getByText('模拟重试成功，不代表真实送达', { exact: true })).toBeVisible();
  await expect(row).toContainText('记录成功');
  await expect(row).toContainText('模拟（不会真实送达）');
  await expect(row).toContainText('原模拟失败原因');
  await page.screenshot({ path: test.info().outputPath('real-message-logs-mock-result.png'), fullPage: true, animations: 'disabled' });
});
test('second tenant cannot list or retry first tenant logs even with forged headers', async ({ page }) => {
  await login(page, 'logoperatorb');
  await expect(page.getByRole('row').filter({ hasText: '日志B失败模拟' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '跨企保护的A模拟' })).toHaveCount(0);
  const result = await retry(page, 62005, true);
  expect(result.status).toBe(200);
  expect(result.body.data).toEqual({ total: 0, success: 0, failed: 0, details: [] });
});
test('successful history has no UI retry and repeated API request matches no failed record', async ({ page }) => {
  await login(page);
  const row = page.getByRole('row').filter({ hasText: '日志A成功模拟' });
  await expect(row).toBeVisible();
  await expect(row.getByRole('button', { name: '重试模拟消息', exact: true })).toHaveCount(0);
  expect((await retry(page, 62002)).body.data).toEqual({ total: 0, success: 0, failed: 0, details: [] });
});
test('unconnected channel offers no retry and direct negative boundary remains failed', async ({ page }) => {
  await login(page);
  const row = page.getByRole('row').filter({ hasText: '日志A未接通短信' });
  await expect(row).toContainText('尚未接通');
  await expect(row.getByRole('button', { name: '重试模拟消息', exact: true })).toHaveCount(0);
  const result = await retry(page, 62004);
  expect(result.status).toBe(200);
  expect(result.body.data).toMatchObject({ total: 1, success: 0, failed: 1 });
  expect(JSON.stringify(result.body.data.details)).toContain('尚未接通');
});
