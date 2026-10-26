import { test, expect, type Page } from '@playwright/test';
const queries: Array<Record<string, string>> = [];
test.beforeEach(async ({ page }) => {
  queries.length = 0;
  await page.addInitScript(() => {
    localStorage.setItem('token', 'notification-history-mock');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  const rows = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    title: `通知${String(i + 1).padStart(2, '0')}`,
    content: '历史正文',
    isRead: i >= 25,
    notificationType: 1
  }));
  await page.route('**/api/**', route => {
    const request = route.request(),
      url = new URL(request.url());
    let data: unknown = {};
    if (url.pathname === '/api/notification/list') {
      const query = Object.fromEntries(url.searchParams);
      queries.push(query);
      const pageNumber = Number(query.page || 1),
        pageSize = Number(query.pageSize || 20);
      const selected =
        query.isRead === undefined
          ? rows
          : rows.filter(row => Number(row.isRead) === Number(query.isRead));
      data = {
        list: selected.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        total: selected.length,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(selected.length / pageSize)
      };
    }
    if (url.pathname === '/api/notification/unread/count')
      data = { count: rows.filter(row => !row.isRead).length };
    if (url.pathname === '/api/notification/read') {
      for (const id of request.postDataJSON().notificationIds) {
        const row = rows.find(row => row.id === id);
        if (row) row.isRead = true;
      }
      data = { count: 1 };
    }
    return route.fulfill({ json: { success: true, data } });
  });
});
const next = (page: Page) => page.locator('.el-pagination .btn-next');
async function filter(page: Page, label: string) {
  await page
    .locator('.el-select')
    .filter({ has: page.getByRole('combobox', { name: '通知状态', exact: true }) })
    .click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
const last = () => queries.at(-1);
test('initial request explicitly uses safe page1/size20 without an isRead filter', async ({
  page
}) => {
  await page.goto('/notifications');
  await expect(page.getByRole('row').filter({ hasText: '通知01' })).toBeVisible();
  expect(last()).toEqual({ page: '1', pageSize: '20' });
  await expect(page.locator('.el-pagination')).toContainText('30');
});
test('second page exposes older notifications beyond the first20', async ({ page }) => {
  await page.goto('/notifications');
  await next(page).click();
  await expect(page.getByRole('row').filter({ hasText: '通知21' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '通知01' })).toHaveCount(0);
  expect(last()).toEqual({ page: '2', pageSize: '20' });
});
test('unread filter preserves numeric zero and resets page2 to page1', async ({ page }) => {
  await page.goto('/notifications');
  await next(page).click();
  await filter(page, '未读');
  await expect.poll(last).toEqual({ page: '1', pageSize: '20', isRead: '0' });
  await expect(page.locator('.el-pagination')).toContainText('25');
});
test('read filter uses1 and all filter removes the parameter', async ({ page }) => {
  await page.goto('/notifications');
  await filter(page, '已读');
  await expect.poll(last).toEqual({ page: '1', pageSize: '20', isRead: '1' });
  await expect(page.getByRole('row').filter({ hasText: '通知26' })).toBeVisible();
  await filter(page, '全部');
  await expect.poll(last).toEqual({ page: '1', pageSize: '20' });
});
test('marking read on unread page2 reloads the same safe page and filtered total', async ({
  page
}) => {
  await page.goto('/notifications');
  await filter(page, '未读');
  await next(page).click();
  await page
    .getByRole('row')
    .filter({ hasText: '通知25' })
    .getByRole('button', { name: '标记已读', exact: true })
    .click();
  await expect(page.getByRole('row').filter({ hasText: '通知25' })).toHaveCount(0);
  await expect(page.locator('.el-pagination')).toContainText('24');
  expect(last()).toEqual({ page: '2', pageSize: '20', isRead: '0' });
});
test('failed page navigation preserves the committed page and allows retry', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page.getByRole('row').filter({ hasText: '通知01' })).toBeVisible();
  let fail = true;
  await page.route('**/api/notification/list**', route =>
    fail && new URL(route.request().url()).searchParams.get('page') === '2'
      ? route.fulfill({ status: 503, json: { message: '历史页暂不可用' } })
      : route.fallback()
  );
  await next(page).click();
  await expect(page.getByText('获取通知列表失败', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '通知01' })).toBeVisible();
  await expect(page.locator('.el-pagination .el-pager .is-active')).toHaveText('1');
  fail = false;
  await next(page).click();
  await expect(page.getByRole('row').filter({ hasText: '通知21' })).toBeVisible();
});
for (const invalidTotal of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`unsafe server total ${invalidTotal} never drives unsafe pagination`, async ({ page }) => {
    await page.route('**/api/notification/list**', route =>
      route.fulfill({ json: { success: true, data: { list: [], total: invalidTotal } } })
    );
    await page.goto('/notifications');
    await expect(page.getByText('通知列表响应无效，请重试', { exact: true })).toBeVisible();
    await expect(next(page)).toBeDisabled();
    expect(queries).toEqual([]);
  });
}
test('late old-filter response cannot replace a newer read filter', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page.getByRole('row').filter({ hasText: '通知01' })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route('**/api/notification/list**', async route => {
    if (new URL(route.request().url()).searchParams.get('isRead') !== '0') return route.fallback();
    await gate;
    return route.fulfill({
      json: {
        success: true,
        data: { list: [{ id: 99, title: '过期未读结果', isRead: false }], total: 1 }
      }
    });
  });
  try {
    await filter(page, '未读');
    await filter(page, '已读');
    await expect(page.getByRole('row').filter({ hasText: '通知26' })).toBeVisible();
    const stale = page.waitForResponse(r => new URL(r.url()).searchParams.get('isRead') === '0');
    release();
    await (await stale).finished();
    await page.evaluate(
      () =>
        new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    await expect(page.getByRole('row').filter({ hasText: '通知26' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '过期未读结果' })).toHaveCount(0);
  } finally {
    release();
  }
});

test('marking the only unread row on the last page retreats once to the valid previous page', async ({
  page
}) => {
  let count = 21;
  const pages: number[] = [];
  await page.route('**/api/notification/list**', route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page') || 1);
    pages.push(pageNumber);
    const rows = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `末页通知${i + 1}`,
      content: '正文',
      isRead: false,
      notificationType: 1
    }));
    return route.fulfill({
      json: {
        success: true,
        data: { list: rows.slice((pageNumber - 1) * 20, pageNumber * 20), total: count }
      }
    });
  });
  await page.route('**/api/notification/read', route => {
    count = 20;
    return route.fulfill({ json: { success: true, data: { count: 1 } } });
  });
  await page.goto('/notifications');
  await filter(page, '未读');
  await next(page).click();
  await page
    .getByRole('row')
    .filter({ hasText: '末页通知21' })
    .getByRole('button', { name: '标记已读', exact: true })
    .click();
  await expect(page.locator('.el-pagination .el-pager .is-active')).toHaveText('1');
  await expect(page.getByRole('row').filter({ hasText: '末页通知20' })).toBeVisible();
  expect(pages.slice(-2)).toEqual([2, 1]);
});
test('stale filter failure cannot report an error after the newer read filter succeeds', async ({
  page
}) => {
  await page.goto('/notifications');
  await expect(page.getByRole('row').filter({ hasText: '通知01' })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route('**/api/notification/list**', async route => {
    if (new URL(route.request().url()).searchParams.get('isRead') !== '0') return route.fallback();
    await gate;
    return route.fulfill({ status: 503, json: { message: '过期筛选失败' } });
  });
  try {
    await filter(page, '未读');
    await filter(page, '已读');
    await expect(page.getByRole('row').filter({ hasText: '通知26' })).toBeVisible();
    const stale = page.waitForResponse(r => new URL(r.url()).searchParams.get('isRead') === '0');
    release();
    await (await stale).finished();
    await page.evaluate(
      () =>
        new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    expect(await page.getByText('获取通知列表失败', { exact: true }).count()).toBe(0);
    await expect(page.getByRole('row').filter({ hasText: '通知26' })).toBeVisible();
  } finally {
    release();
  }
});
