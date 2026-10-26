import { test, expect, type APIRequestContext } from '@playwright/test';
test.beforeEach(() =>
  test.skip(process.env.TAG_INTEGRITY_UI_DISPOSABLE !== '1', 'Requires dedicated tag HTTP harness')
);
async function login(request: APIRequestContext, username = 'tag_peer', corpId = 2) {
  const r = await request.post('/api/v1/auth/login', {
    data: { username, password: 'Admin@123', corpId }
  });
  expect(r.status(), await r.text()).toBe(200);
  return { Authorization: `Bearer ${(await r.json()).accessToken}` };
}
async function tag(request: APIRequestContext, id: number, headers: Record<string, string>) {
  const r = await request.get(`/api/v1/tags/${id}`, { headers });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).data;
}
test('actual company2 UI creates and edits without fake identity or metadata resets', async ({
  page
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('用户名').fill('tag_peer');
  await page.getByPlaceholder('密码').fill('Admin@123');
  await page.getByPlaceholder('企业编号（同名账号需填写，可选）').fill('2');
  await page.getByRole('button', { name: '登 录' }).click();
  await expect(page.locator('.uname')).toHaveText('tag_peer');
  await page.goto('/tags');
  await page.getByRole('button', { name: '新建标签', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '新建标签', exact: true });
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^标签名/ })
    .getByRole('textbox')
    .fill('tag-http-ui-created');
  const posted = page.waitForResponse(
    r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/tags'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  const created = await posted;
  expect(created.status(), await created.text()).toBe(200);
  expect(created.request().postDataJSON()).toEqual({
    tagName: 'tag-http-ui-created',
    tagColor: '#409EFF'
  });
  expect(Number((await created.json()).data.corpId)).toBe(2);
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: 'tag-http-own' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: '编辑标签', exact: true });
  await expect(dialog).toContainText('tag-http-parent');
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^标签名/ })
    .getByRole('textbox')
    .fill('tag-http-ui-edited');
  const edited = page.waitForResponse(
    r => r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/v1/tags/100021'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  const updated = await edited;
  expect(updated.status(), await updated.text()).toBe(200);
  expect(updated.request().postDataJSON()).toEqual({
    tagName: 'tag-http-ui-edited',
    tagColor: '#123456'
  });
  expect((await updated.json()).data).toMatchObject({
    parentId: 100022,
    tagType: 3,
    sort: 8,
    isAuto: 1
  });
  await expect(dialog).not.toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('real-company2-tag-metadata.png'),
    fullPage: true,
    animations: 'disabled'
  });
});
test('immutable update/create/batch payloads cannot overwrite or move another enterprise tag', async ({
  request
}) => {
  const own = await login(request),
    foreign = await login(request, 'admin', 1),
    before = await tag(request, 100011, foreign);
  for (const [method, path, body] of [
    ['put', '/api/v1/tags/100021', { id: 100011, corpId: 1, tagName: 'tag-http-attack-update' }],
    ['put', '/api/v1/tags/100021', { corpId: 1, tagName: 'tag-http-attack-corp' }],
    ['post', '/api/v1/tags', { id: 100011, tagName: 'tag-http-attack-create' }],
    ['post', '/api/v1/tags/batch', [{ id: 100011, tagName: 'tag-http-attack-batch' }]]
  ] as const) {
    const r = await request[method](path, { headers: own, data: body });
    expect(r.status(), await r.text()).toBe(400);
    expect(await tag(request, 100011, foreign)).toEqual(before);
  }
  const forged = await request.get('/api/v1/tags/100011', {
    headers: { ...own, 'x-corp-id': '1', 'x-user-id': '1' }
  });
  expect(forged.status()).toBe(404);
  const foreignWrite = await request.put('/api/v1/tags/100011', {
    headers: own,
    data: { tagName: 'tag-http-direct-foreign' }
  });
  expect(foreignWrite.status()).toBe(404);
  expect(await tag(request, 100011, foreign)).toEqual(before);
});
test('foreign missing self and descendant parents reject and invalid batch leaves no first item', async ({
  request
}) => {
  const headers = await login(request);
  for (const parentId of [100011, 999999, 100021]) {
    const r = await request.put('/api/v1/tags/100021', { headers, data: { parentId } });
    expect(r.status(), await r.text()).toBe(400);
  }
  const cycle = await request.put('/api/v1/tags/100022', { headers, data: { parentId: 100021 } });
  expect(cycle.status(), await cycle.text()).toBe(400);
  const created = await request.post('/api/v1/tags', {
    headers,
    data: { tagName: 'tag-http-foreign-child', parentId: 100011 }
  });
  expect(created.status(), await created.text()).toBe(400);
  const batch = await request.post('/api/v1/tags/batch', {
    headers,
    data: [
      { tagName: 'tag-http-batch-first', parentId: 0 },
      { tagName: 'tag-http-batch-invalid', parentId: 100011 }
    ]
  });
  expect(batch.status(), await batch.text()).toBe(400);
  const list = await request.get('/api/v1/tags', { headers });
  expect(
    (await list.json()).data.some((row: { tagName: string }) =>
      /batch-first|batch-invalid|foreign-child/.test(row.tagName)
    )
  ).toBe(false);
  const tree = await request.get('/api/v1/tags/tree', { headers });
  expect(tree.status(), await tree.text()).toBe(200);
  const valid = await request.post('/api/v1/tags', {
    headers,
    data: { tagName: 'tag-http-valid-child', parentId: 100022 }
  });
  expect(valid.status(), await valid.text()).toBe(200);
  const id = (await valid.json()).data.id;
  expect((await request.delete(`/api/v1/tags/${id}`, { headers })).status()).toBe(200);
});
test('strict integer path boundaries reject truncation rounding and invalid customer-tag bodies', async ({
  request
}) => {
  const headers = await login(request);
  for (const id of ['100021junk', '100021.5', '0100021', '2147483648', '9007199254740993']) {
    expect((await request.get(`/api/v1/tags/${id}`, { headers })).status()).toBe(400);
    expect(
      (
        await request.put(`/api/v1/tags/${id}`, {
          headers,
          data: { tagName: 'tag-http-invalid-path' }
        })
      ).status()
    ).toBe(400);
    expect((await request.delete(`/api/v1/tags/${id}`, { headers })).status()).toBe(400);
  }
  for (const id of ['100201junk', '100201.5', '0100201', '9007199254740993'])
    expect(
      (
        await request.post(`/api/v1/customers/${id}/tags`, { headers, data: { tagIds: [100021] } })
      ).status()
    ).toBe(400);
  expect(
    (await request.delete('/api/v1/customers/100201/tags/2147483648', { headers })).status()
  ).toBe(400);
});
test('customer tag attachment is all-or-none tenant scoped and repeated valid assignment is idempotent', async ({
  request
}) => {
  const headers = await login(request);
  const customer = async () => {
    const r = await request.get('/api/v1/customers/100201', { headers });
    expect(r.status()).toBe(200);
    return (await r.json()).data;
  };
  for (const tagIds of [[100021, 100011], [100021, 999999], [], ['100021']]) {
    const r = await request.post('/api/v1/customers/100201/tags', { headers, data: { tagIds } });
    expect(r.status(), await r.text()).toBe(400);
    expect((await customer()).tags).toHaveLength(0);
  }
  const foreign = await request.post('/api/v1/customers/100101/tags', {
    headers,
    data: { tagIds: [100021] }
  });
  expect(foreign.status()).toBe(404);
  for (let n = 0; n < 2; n++)
    expect(
      (
        await request.post('/api/v1/customers/100201/tags', {
          headers,
          data: { tagIds: [100021, 100021] }
        })
      ).status()
    ).toBe(200);
  expect((await customer()).tags).toHaveLength(1);
  expect((await request.delete('/api/v1/customers/100201/tags/100021', { headers })).status()).toBe(
    200
  );
  expect((await customer()).tags).toHaveLength(0);
  expect(
    (
      await request.post('/api/v1/customers/100201/tags', { headers, data: { tagIds: [100021] } })
    ).status()
  ).toBe(200);
});
