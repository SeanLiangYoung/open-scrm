import { test, expect, type Page } from '@playwright/test';
const own = {
  id: 21,
  corpId: '2',
  tagName: '已有标签',
  tagType: 3,
  tagColor: '#123456',
  parentId: 22,
  sort: 8,
  isAuto: 1,
  status: 1
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'tag-mock');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  await page.route('**/api/**', route => {
    const r = route.request(),
      url = new URL(r.url());
    let data: unknown = [];
    if (url.pathname === '/api/v1/tags')
      data =
        r.method() === 'GET'
          ? [own, { id: 22, tagName: '父分组', tagType: 1, parentId: 0 }]
          : { id: 23, ...r.postDataJSON() };
    if (url.pathname === '/api/v1/tags/21') data = { ...own, ...r.postDataJSON() };
    return route.fulfill({ json: { code: 200, data } });
  });
});
async function create(page: Page) {
  await page.goto('/tags');
  await page.getByRole('button', { name: '新建标签', exact: true }).click();
  return page.getByRole('dialog', { name: '新建标签', exact: true });
}
async function edit(page: Page) {
  await page.goto('/tags');
  await page
    .getByRole('row')
    .filter({ hasText: '已有标签' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  return page.getByRole('dialog', { name: '编辑标签', exact: true });
}
const nameInput = (page: Page) =>
  page
    .getByRole('dialog')
    .locator('.el-form-item')
    .filter({ hasText: /^标签名/ })
    .getByRole('textbox');
test('company2 creates with only supported editable fields and no fake identity', async ({
  page
}) => {
  const dialog = await create(page);
  await nameInput(page).fill('  新标签  ');
  const posted = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/tags'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await posted).postDataJSON()).toEqual({ tagName: '新标签', tagColor: '#409EFF' });
});
test('editing preserves type parent order automatic metadata by omitting unchanged fields', async ({
  page
}) => {
  const dialog = await edit(page);
  await nameInput(page).fill('编辑后标签');
  const posted = page.waitForRequest(r => r.method() === 'PUT');
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await posted).postDataJSON()).toEqual({ tagName: '编辑后标签', tagColor: '#123456' });
});
test('fake unsaved group input is absent and actual existing parent is read only', async ({
  page
}) => {
  const dialog = await edit(page);
  await expect(dialog.getByPlaceholder('如：意向度、渠道、等级')).toHaveCount(0);
  await expect(dialog).toContainText('父分组');
  await expect(dialog).toContainText('保留');
});
test('update backend rejection preserves draft without reporting success', async ({ page }) => {
  const dialog = await edit(page);
  await nameInput(page).fill('失败后草稿');
  await page.route('**/api/v1/tags/21', r =>
    r.fulfill({ status: 400, json: { message: '标签参数无效' } })
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByText('标签参数无效', { exact: true })).toBeVisible();
  await expect(nameInput(page)).toHaveValue('失败后草稿');
  await expect(dialog).toBeVisible();
});
test('unsafe PostgreSQL INTEGER row ID cannot open an edit or send a write', async ({ page }) => {
  await page.route('**/api/v1/tags', r =>
    r.fulfill({ json: { code: 200, data: [{ ...own, id: '2147483648' }] } })
  );
  await page.goto('/tags');
  await page
    .getByRole('row')
    .filter({ hasText: '已有标签' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  await expect(page.getByText('标签编号超出支持范围', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('blank tag name blocks writes before API', async ({ page }) => {
  let writes = 0;
  page.on('request', r => {
    if (r.method() === 'POST') writes++;
  });
  const dialog = await create(page);
  await nameInput(page).fill('   ');
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByText('请输入标签名', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
test('pending create prevents closing and reopening another draft', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(r => {
    release = r;
  });
  await page.route('**/api/v1/tags', async r => {
    if (r.request().method() !== 'POST') return r.fallback();
    await gate;
    await r.fulfill({ json: { code: 200, data: { id: 23 } } });
  });
  const dialog = await create(page);
  await nameInput(page).fill('等待草稿');
  const request = page.waitForRequest(r => r.method() === 'POST');
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await request;
  try {
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
    await expect(dialog.locator('.el-dialog__headerbtn')).toHaveCount(0);
    await expect(nameInput(page)).toBeDisabled();
  } finally {
    release();
  }
});
test('late initial tag list cannot erase the refreshed list after create', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(r => {
    release = r;
  });
  let reads = 0;
  await page.route('**/api/v1/tags', async r => {
    if (r.request().method() !== 'GET') return r.fallback();
    const first = ++reads === 1;
    if (first) await gate;
    await r.fulfill({
      json: { code: 200, data: first ? [own] : [own, { ...own, id: 23, tagName: '新标签保持' }] }
    });
  });
  try {
    const dialog = await create(page);
    await nameInput(page).fill('新标签保持');
    await dialog.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: '新标签保持' })).toBeVisible();
    const old = page.waitForResponse(
      r => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/v1/tags'
    );
    release();
    await (await old).finished();
    await page.evaluate(
      () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    );
    await expect(page.getByRole('row').filter({ hasText: '新标签保持' })).toBeVisible();
  } finally {
    release();
  }
});
