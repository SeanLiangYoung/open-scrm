import { test, expect, type Page } from '@playwright/test';
// Mock-only UI contracts. No actual message API, retry execution or database writes.
const base = { targetType: 1, targetId: '9001', targetName: '测试目标', createTime: '2026-10-26T00:00:00Z', sendTime: null, extra: { campaign: 'fixture' } };
const fixtures = () => [
  { ...base, id: '101', messageType: 5, sendStatus: 2, retryCount: 1, content: '模拟失败正文', failReason: '原模拟失败原因' },
  { ...base, id: '102', messageType: 5, sendStatus: 1, retryCount: 0, content: '模拟成功正文', failReason: null },
  { ...base, id: '103', messageType: 5, sendStatus: 0, retryCount: 0, content: '待处理正文', failReason: null },
  { ...base, id: '104', messageType: 3, sendStatus: 2, retryCount: 0, content: '尚未接通的短信', failReason: '消息渠道尚未接通' },
];
async function setup(page: Page) {
  const reads: URL[] = [];
  const writes: unknown[] = [];
  const paths: string[] = [];
  let rows = fixtures();
  await page.addInitScript(() => { localStorage.setItem('token', 'message-logs-mock'); localStorage.setItem('user', JSON.stringify({ id: '7', username: 'operator', corpId: '2' })); });
  page.on('request', request => paths.push(new URL(request.url()).pathname));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/message/logs') {
      reads.push(url);
      await route.fulfill({ json: { success: true, data: { list: rows, total: rows.length, page: Number(url.searchParams.get('page') || 1), pageSize: 20 } } });
    } else if (url.pathname === '/api/message/retry') {
      writes.push(route.request().postDataJSON());
      rows = rows.map(row => row.id === '101' ? { ...row, sendStatus: 1, retryCount: 2 } : row);
      await route.fulfill({ json: { success: true, data: { total: 1, success: 1, failed: 0, details: [{ id: '101', success: true }] } } });
    } else await route.fulfill({ json: { success: true, data: { list: [], count: 0 } } });
  });
  return { reads, writes, paths };
}
async function open(page: Page) {
  await page.goto('/message-logs');
  await expect(page.getByRole('heading', { name: '消息日志', exact: true })).toBeVisible();
}
const row = (page: Page, content = '模拟失败正文') => page.getByRole('row').filter({ hasText: content });
async function confirmRetry(page: Page) {
  await row(page).getByRole('button', { name: '重试模拟消息', exact: true }).click();
  await page.getByRole('button', { name: '确认重试', exact: true }).click();
}

test('lists message fields and expands only existing row data', async ({ page }) => {
  const t = await setup(page); await open(page);
  expect(t.reads[0].searchParams.get('page')).toBe('1');
  expect(t.reads[0].searchParams.get('pageSize')).toBe('20');
  await expect(row(page)).toContainText('原模拟失败原因');
  await expect(page.getByText('日志状态包含历史占位/模拟结果，不代表第三方送达', { exact: false }).first()).toBeVisible();
  await row(page).locator('.el-table__expand-icon').click();
  await expect(page.getByText('fixture', { exact: false }).first()).toBeVisible();
  expect(t.paths.some(path => path.startsWith('/api/message/log/'))).toBe(false);
  expect(t.paths.some(path => path.startsWith('/api/v1/users'))).toBe(false);
});
test('empty results show a truthful empty state', async ({ page }) => {
  await setup(page);
  await page.route('**/api/message/logs?**', route => route.fulfill({ json: { success: true, data: { list: [], total: 0, page: 1, pageSize: 20 } } }));
  await open(page);
  await expect(page.getByText('暂无消息日志', { exact: true })).toBeVisible();
});
test('pagination submits controlled page and page size', async ({ page }) => {
  await setup(page);
  await page.route('**/api/message/logs?**', route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({ json: { success: true, data: { list: pageNumber === 2 ? [{ ...fixtures()[0], content: '第二页日志' }] : fixtures(), total: 21, page: pageNumber, pageSize: 20 } } });
  });
  await open(page);
  const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/message/logs' && new URL(r.url()).searchParams.get('page') === '2');
  await page.locator('.el-pagination .btn-next').click();
  expect(new URL((await request).url()).searchParams.get('pageSize')).toBe('20');
  await expect(row(page, '第二页日志')).toBeVisible();
});
test('status zero is retained in the query', async ({ page }) => {
  const t = await setup(page); await open(page);
  await page.locator('.el-select').first().click();
  await page.getByRole('option', { name: '待处理', exact: true }).click();
  await expect.poll(() => t.reads.at(-1)?.searchParams.get('sendStatus')).toBe('0');
});
test('Mock channel filter submits channel five', async ({ page }) => {
  const t = await setup(page); await open(page);
  await page.locator('.el-select').nth(1).click();
  await page.getByRole('option', { name: '模拟', exact: true }).click();
  await expect.poll(() => t.reads.at(-1)?.searchParams.get('messageType')).toBe('5');
});
test('query errors remain errors rather than a successful empty result', async ({ page }) => {
  await setup(page);
  await page.route('**/api/message/logs?**', route => route.fulfill({ status: 503, json: { message: '日志服务不可用' } }));
  await open(page);
  await expect(page.getByText('日志服务不可用', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('暂无消息日志', { exact: true })).toHaveCount(0);
});
test('only a failed Mock row submits one safe numeric log ID after confirmation', async ({ page }) => {
  const t = await setup(page); await open(page);
  await confirmRetry(page);
  await expect.poll(() => t.writes.length).toBe(1);
  expect(t.writes[0]).toEqual({ logIds: [101] });
  await expect(page.getByText('模拟重试成功，不代表真实送达', { exact: true })).toBeVisible();
  await expect.poll(() => t.reads.length).toBeGreaterThanOrEqual(2);
});
test('pending and successful Mock rows have no retry button', async ({ page }) => {
  await setup(page); await open(page);
  await expect(row(page, '待处理正文').getByRole('button', { name: '重试模拟消息' })).toHaveCount(0);
  await expect(row(page, '模拟成功正文').getByRole('button', { name: '重试模拟消息' })).toHaveCount(0);
});
test('unconnected provider rows are clearly labelled and never offer retry', async ({ page }) => {
  await setup(page); await open(page);
  await expect(row(page, '尚未接通的短信')).toContainText('尚未接通');
  await expect(row(page, '尚未接通的短信').getByRole('button', { name: '重试模拟消息' })).toHaveCount(0);
});
test('unsafe bigint row IDs cannot produce a retry write', async ({ page }) => {
  const t = await setup(page);
  await page.route('**/api/message/logs?**', route => route.fulfill({ json: { success: true, data: { list: [{ ...fixtures()[0], id: '9007199254740993' }], total: 1 } } }));
  await open(page);
  await expect(row(page).getByRole('button', { name: '重试模拟消息', exact: true })).toBeDisabled();
  expect(t.writes).toEqual([]);
});
test('HTTP200 with failed detail is never presented as successful retry', async ({ page }) => {
  const t = await setup(page);
  await page.route('**/api/message/retry', route => route.fulfill({ json: { success: true, data: { total: 1, success: 0, failed: 1, details: [{ id: '101', success: false, error: '额度已耗尽' }] } } }));
  await open(page); await confirmRetry(page);
  await expect(page.getByText('模拟重试失败：额度已耗尽', { exact: true })).toBeVisible();
  await expect(page.getByText('模拟重试成功，不代表真实送达', { exact: true })).toHaveCount(0);
  await expect.poll(() => t.reads.length).toBeGreaterThanOrEqual(2);
});
test('cancelled retry confirmation performs no write', async ({ page }) => {
  const t = await setup(page); await open(page);
  await row(page).getByRole('button', { name: '重试模拟消息', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(t.writes).toEqual([]);
});
test('an unmatched retry result is shown as no eligible record, never success', async ({ page }) => {
  await setup(page);
  await page.route('**/api/message/retry', route => route.fulfill({ json: { success: true, data: { total: 0, success: 0, failed: 0, details: [] } } }));
  await open(page); await confirmRetry(page);
  await expect(page.getByText('未匹配到可重试记录，请刷新日志', { exact: true })).toBeVisible();
  await expect(page.getByText('模拟重试成功，不代表真实送达', { exact: true })).toHaveCount(0);
});
test('contradictory retry counts cannot claim success', async ({ page }) => {
  await setup(page);
  await page.route('**/api/message/retry', route => route.fulfill({ json: { success: true, data: { total: 1, success: 1, failed: 1, details: [{ id: '101', success: false }] } } }));
  await open(page); await confirmRetry(page);
  await expect(page.getByText('重试结果未确认，请刷新日志', { exact: true })).toBeVisible();
  await expect(page.getByText('模拟重试成功，不代表真实送达', { exact: true })).toHaveCount(0);
});
