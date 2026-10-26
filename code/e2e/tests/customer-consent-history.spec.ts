import { test, expect, type Page, type Route } from '@playwright/test';

const time = '2026-10-26T00:00:00.000Z';
function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    customerId: '10',
    purpose: 'marketing',
    observedAt: time,
    hasActiveMarketingConsent: true,
    activeCount: 2,
    revokedCount: 1,
    total: 3,
    page: 1,
    pageSize: 20,
    list: [
      {
        id: '41',
        purpose: 'marketing',
        policyVersion: 'evidence-v1',
        channel: 'web',
        locale: 'zh-CN',
        createdAt: time,
        revokedAt: null
      }
    ],
    ...overrides
  };
}
let data = snapshot();
let readError = false;
let reads: URL[] = [];
let onRead: ((route: Route, url: URL) => Promise<void>) | undefined;
let afterWrite: (() => void) | undefined;
const region = (page: Page) => page.getByRole('region', { name: '营销授权读取快照' });
const reply = (route: Route, value: unknown) =>
  route.fulfill({ json: { success: true, data: value } });
test.beforeEach(async ({ page }) => {
  data = snapshot();
  readError = false;
  reads = [];
  onRead = undefined;
  afterWrite = undefined;
  await page.addInitScript(() => {
    localStorage.setItem('token', 'history-mock');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  await page.route('**/api/**', async route => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.includes('/consents/customer/')) {
      reads.push(url);
      if (onRead) return onRead(route, url);
      if (readError) return route.fulfill({ status: 503, json: { message: '读取暂不可用' } });
      return reply(route, { ...data, page: Number(url.searchParams.get('page') || '1') });
    }
    if (url.pathname.endsWith('/consents/grant') || url.pathname.endsWith('/consents/revoke')) {
      afterWrite?.();
      return reply(
        route,
        url.pathname.endsWith('/grant')
          ? { id: '42', policyVersion: 'v2', channel: 'web', locale: 'zh-CN' }
          : { revokedCount: 0 }
      );
    }
    return reply(
      route,
      url.pathname.startsWith('/api/v1/customers/')
        ? { id: url.pathname.split('/').pop(), name: '测试客户', gender: 0, status: 1, tags: [] }
        : { list: [] }
    );
  });
});
async function open(page: Page) {
  await page.goto('/customers/10');
  await expect(region(page)).toBeVisible();
}
async function draft(page: Page) {
  await page.getByPlaceholder('填写实际授权政策版本').fill('v2');
  await page.locator('.el-form-item').filter({ hasText: '证据渠道' }).locator('.el-select').click();
  await page.getByRole('option', { name: 'Web', exact: true }).click();
  await page.getByPlaceholder('例如 zh-CN').fill('zh-CN');
}
const refresh = (page: Page) =>
  page.getByRole('button', { name: '刷新授权记录', exact: true }).click();
const pageNumber = (page: Page, value: number) =>
  region(page)
    .locator('.el-pager li')
    .filter({ hasText: new RegExp(`^${value}$`) })
    .click();

test('loads exact scoped path and real counts with database observation time', async ({ page }) => {
  await open(page);
  await expect(region(page)).toContainText('未撤回证据 2 条');
  await expect(region(page)).toContainText('已撤回 1 条');
  await expect(region(page).locator(`time[datetime="${time}"]`)).toBeVisible();
  expect(reads[0].pathname).toBe('/api/v1/messages/consents/customer/10');
  expect(Object.fromEntries(reads[0].searchParams)).toEqual({ page: '1', pageSize: '20' });
});
test('observed zero is explicit and is not invented before loading', async ({ page }) => {
  data = snapshot({
    hasActiveMarketingConsent: false,
    activeCount: 0,
    revokedCount: 0,
    total: 0,
    list: []
  });
  await open(page);
  await expect(region(page)).toContainText('未撤回证据 0 条');
  await expect(region(page)).toContainText('尚无营销授权证据记录');
});
test('initial failure is not zero and manual refresh recovers', async ({ page }) => {
  readError = true;
  await open(page);
  await expect(region(page)).toContainText('读取暂不可用');
  await expect(region(page)).not.toContainText('未撤回证据 0 条');
  readError = false;
  await refresh(page);
  await expect(region(page)).toContainText('未撤回证据 2 条');
});
test('paging preserves full counts, exact bigint and nullable evidence', async ({ page }) => {
  data = snapshot({ total: 21, revokedCount: 19 });
  await open(page);
  await expect(region(page)).toContainText('共 21 条');
  data = snapshot({
    total: 21,
    revokedCount: 19,
    list: [
      {
        id: '9007199254740993',
        purpose: 'marketing',
        policyVersion: null,
        channel: null,
        locale: null,
        createdAt: time,
        revokedAt: time
      }
    ]
  });
  await pageNumber(page, 2);
  await expect(region(page)).toContainText('9007199254740993');
  await expect(region(page)).toContainText('未记录');
  expect(reads.at(-1)?.searchParams.get('page')).toBe('2');
  await expect(region(page)).toContainText('未撤回证据 2 条');
});
test('grant success refreshes the read model independently of operation result', async ({
  page
}) => {
  await open(page);
  await expect(region(page)).toContainText('未撤回证据 2 条');
  afterWrite = () => {
    data = snapshot({ activeCount: 3, total: 4 });
  };
  await draft(page);
  await page.getByRole('button', { name: '登记授权证据', exact: true }).click();
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次登记');
  await expect(region(page)).toContainText('未撤回证据 3 条');
  expect(reads.length).toBe(2);
});
test('zero revoke result still refreshes and does not infer state from the write count', async ({
  page
}) => {
  await open(page);
  afterWrite = () => {
    data = snapshot({ activeCount: 0, revokedCount: 3, hasActiveMarketingConsent: false });
  };
  await page.getByRole('button', { name: '撤回营销授权', exact: true }).click();
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次撤回 0 条');
  await expect(region(page)).toContainText('未撤回证据 0 条');
});
test('write success survives read failure with draft and stale snapshot retained', async ({
  page
}) => {
  await open(page);
  await expect(region(page)).toContainText('未撤回证据 2 条');
  afterWrite = () => {
    readError = true;
  };
  await draft(page);
  await page.getByRole('button', { name: '登记授权证据', exact: true }).click();
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次登记');
  await expect(region(page)).toContainText('读取暂不可用');
  await expect(region(page)).toContainText('上次读取快照');
  await expect(page.getByPlaceholder('填写实际授权政策版本')).toHaveValue('v2');
});
for (const failOld of [false, true])
  test(`older page ${failOld ? 'failure' : 'success'} cannot override a newer snapshot`, async ({
    page
  }) => {
    data = snapshot({ total: 61, revokedCount: 59 });
    await open(page);
    await expect(region(page)).toContainText('共 61 条');
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    onRead = async (route, url) => {
      const p = Number(url.searchParams.get('page'));
      if (p === 2) {
        await gate;
        return failOld
          ? route.fulfill({ status: 503, json: { message: 'old read failed' } })
          : reply(route, snapshot({ page: 2, total: 61, revokedCount: 59 }));
      }
      return reply(
        route,
        snapshot({
          page: 3,
          activeCount: 3,
          total: 61,
          revokedCount: 58,
          observedAt: '2026-10-26T01:00:00.000Z'
        })
      );
    };
    await pageNumber(page, 2);
    await expect.poll(() => reads.length).toBe(2);
    await pageNumber(page, 3);
    await expect(region(page)).toContainText('未撤回证据 3 条');
    const response = page.waitForResponse(r => new URL(r.url()).searchParams.get('page') === '2');
    release();
    await (await response).finished();
    await page.evaluate(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    await expect(region(page)).toContainText('未撤回证据 3 条');
    await expect(region(page)).not.toContainText('old read failed');
  });
test('write invalidates a pre-write pending read', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let count = 0;
  onRead = async route => {
    if (++count === 1) {
      await gate;
      return reply(route, snapshot());
    }
    return reply(route, snapshot({ activeCount: 3, total: 4 }));
  };
  await open(page);
  await expect.poll(() => reads.length).toBe(1);
  await draft(page);
  await page.getByRole('button', { name: '登记授权证据', exact: true }).click();
  await expect(region(page)).toContainText('未撤回证据 3 条');
  const response = page.waitForResponse(r => r.url().includes('/consents/customer/'));
  release();
  await (await response).finished();
  await expect(region(page)).toContainText('未撤回证据 3 条');
});
test('unsafe customer does not read or write a rounded identifier', async ({ page }) => {
  await page.goto('/customers/9007199254740993');
  await expect(region(page)).toContainText('客户编号');
  expect(reads).toHaveLength(0);
  await page.getByRole('button', { name: '撤回营销授权', exact: true }).click();
  expect(reads).toHaveLength(0);
});
test('manual history refresh never clears evidence inputs', async ({ page }) => {
  await open(page);
  await expect(region(page)).toContainText('未撤回证据 2 条');
  await draft(page);
  await refresh(page);
  await expect(page.getByPlaceholder('填写实际授权政策版本')).toHaveValue('v2');
});

for (const invalid of [
  { total: '3' },
  { observedAt: 'not-a-time' },
  { customerId: '11' }
]) test(`invalid snapshot is not rendered as valid: ${JSON.stringify(invalid)}`, async ({ page }) => {
  data = snapshot(invalid);
  await open(page);
  await expect(region(page)).toContainText('读取授权记录失败');
  await expect(region(page)).not.toContainText('未撤回证据 0 条');
  await expect(region(page)).not.toContainText('未撤回证据 2 条');
});

test('a pending initial read does not invent a zero state', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  onRead = async route => { await gate; return reply(route, snapshot()); };
  await open(page);
  await expect(region(page)).toContainText('正在读取授权记录');
  await expect(region(page)).not.toContainText('未撤回证据 0 条');
  release();
  await expect(region(page)).toContainText('未撤回证据 2 条');
});

test('failed navigation preserves the last displayed page and snapshot', async ({ page }) => {
  data = snapshot({ total: 21, revokedCount: 19 });
  await open(page);
  await expect(region(page)).toContainText('共 21 条');
  readError = true;
  await pageNumber(page, 2);
  await expect(region(page)).toContainText('读取暂不可用');
  await expect(region(page).locator('.el-pager .is-active')).toHaveText('1');
  await expect(region(page)).toContainText('evidence-v1');
  await expect(region(page)).toContainText('上次读取快照');
});
