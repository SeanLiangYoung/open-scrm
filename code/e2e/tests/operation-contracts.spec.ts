import { test, expect } from '@playwright/test';
/** Browser request-shape regressions with mocked APIs; no backend or real messages. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'mock-contract-token');
    localStorage.setItem('user', JSON.stringify({ id: '7', username: 'operator', corpId: '2' }));
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { list: [] };
    if (path === '/api/v1/tags') data = [{ id: 11, tagName: '已预约', tagType: 1 }];
    if (path === '/api/v1/customers/10') data = { id: 10, name: '测试客户', gender: 0, status: 1, channel: 'wechat', createTime: '2026-10-25T00:00:00Z', tags: [] };
    if (path === '/api/sop/templates') data = { list: [{ id: 3, templateName: '欢迎流程', templateType: 1, triggerType: 4, status: 1 }] };
    await route.fulfill({ json: { success: true, data } });
  });
});
test('customer tags submit numeric tagIds array', async ({ page }) => {
  await page.goto('/customers/10');
  await page.getByRole('button', { name: '添加标签', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.el-select').click();
  await page.getByRole('option', { name: '已预约' }).click();
  await page.keyboard.press('Escape');
  const request = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/v1/customers/10/tags'));
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ tagIds: [11] });
});
test('SOP disable submits status zero', async ({ page }) => {
  await page.goto('/sop');
  const request = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/api/sop/template/3'));
  await page.getByRole('button', { name: '停用', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ status: 0 });
});
test('SOP tag step saves selected numeric IDs', async ({ page }) => {
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('标签流程');
  await page.getByRole('button', { name: '添加步骤' }).click();
  const step = page.locator('.step-item');
  await step.locator('.el-select').first().click();
  await page.getByRole('option', { name: '打标签', exact: true }).click();
  await step.locator('.el-select').nth(1).click();
  await page.getByRole('option', { name: '已预约', exact: true }).click();
  await page.keyboard.press('Escape');
  const request = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/sop/template'));
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  expect((await request).postDataJSON().steps[0]).toEqual({ stepOrder: 1, stepName: '步骤 1', stepType: 2, actionType: 2, actionContent: { tagIds: [11] }, delayTime: 0, delayUnit: 'minute' });
});
test('SOP reminder saves explicit current employee recipient', async ({ page }) => {
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('提醒流程');
  await page.getByRole('button', { name: '添加步骤' }).click();
  const step = page.locator('.step-item');
  await step.locator('.el-select').first().click();
  await page.getByRole('option', { name: '提醒员工', exact: true }).click();
  await step.getByPlaceholder('消息文本内容').fill('记得跟进');
  await step.locator('.el-checkbox').filter({ hasText: '提醒当前登录员工' }).click();
  await expect(step.getByRole('checkbox', { name: /提醒当前登录员工/ })).toBeChecked();
  const request = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/sop/template'));
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  expect((await request).postDataJSON().steps[0]).toEqual({ stepOrder: 1, stepName: '步骤 1', stepType: 5, actionType: 5, actionContent: { userIds: [7], content: '记得跟进' }, delayTime: 0, delayUnit: 'minute' });
});

test('editing an existing content action updates content and retains extra metadata', async ({ page }) => {
  await page.route('**/api/sop/template/3', route => route.fulfill({ json: { success: true, data: {
    id: 3, templateName: '已有流程', templateType: 1, triggerType: 4,
    steps: [{ stepName: '欢迎', stepType: 1, delayTime: 0, delayUnit: 'minute', actionContent: { content: '旧正文', extra: { campaign: 'fixture' } } }]
  } } }));
  await page.goto('/sop/3/edit');
  await page.getByPlaceholder('消息文本内容').fill('新正文');
  const request = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/sop/steps/batch'));
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  expect((await request).postDataJSON().steps[0].actionContent).toEqual({ content: '新正文', extra: { campaign: 'fixture' } });
});

test('tag step without a selected tag is blocked before API submission', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('未配置标签');
  await page.getByRole('button', { name: '添加步骤' }).click();
  await page.locator('.step-item .el-select').first().click();
  await page.getByRole('option', { name: '打标签', exact: true }).click();
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  await expect(page.getByText('请为打标签步骤选择标签', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('follow-up save submits UTC datetime and refreshes the timeline', async ({ page }) => {
  let saved = false;
  let reads = 0;
  await page.route('**/api/v1/follow-ups/customer/10', async route => {
    reads++;
    await route.fulfill({ json: { code: 200, data: { list: saved ? [{ id: 50, followType: 2, content: '确认下次预约', createTime: '2026-10-25T00:00:00Z', nextFollowTime: '2026-11-01T01:30:00.000Z' }] : [] } } });
  });
  await page.route('**/api/v1/follow-ups', async route => {
    expect(route.request().postDataJSON()).toEqual({ customerId: 10, followType: 2, content: '确认下次预约', nextFollowTime: '2026-11-01T01:30:00.000Z' });
    saved = true;
    await route.fulfill({ json: { code: 200, data: { id: 50 } } });
  });
  await page.goto('/customers/10');
  await page.getByRole('button', { name: '添加跟进', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '添加跟进记录', exact: true });
  await dialog.getByPlaceholder('记录跟进内容...').fill('确认下次预约');
  await dialog.getByPlaceholder('选择下次跟进时间').fill('2026-11-01 09:30:00');
  await dialog.getByPlaceholder('选择下次跟进时间').press('Enter');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('跟进记录已添加', { exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.el-timeline')).toContainText('确认下次预约');
  await expect(page.getByText('跟进记录 (1)', { exact: true })).toBeVisible();
  expect(reads).toBeGreaterThanOrEqual(2);
});

test('failed follow-up save retains content and exposes the API error', async ({ page }) => {
  await page.route('**/api/v1/follow-ups', route => route.fulfill({ status: 400, json: { message: '跟进保存失败，请重试' } }));
  await page.goto('/customers/10');
  await page.getByRole('button', { name: '添加跟进', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '添加跟进记录', exact: true });
  await dialog.getByPlaceholder('记录跟进内容...').fill('失败后保留的草稿');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('跟进保存失败，请重试', { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder('记录跟进内容...')).toHaveValue('失败后保留的草稿');
  await expect(dialog.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
});

test('dashboard names normal customer snapshots and shows their observation timestamp', async ({ page }) => {
  await page.route('**/api/v1/analytics/overview?**', route => route.fulfill({ json: { success: true, data: {
    totalCustomerCount: 25, normalCustomerCount: 17, activeCustomerCount: 999,
    messageSendCount: 3, messageSuccessRate: 100, sopExecuteCount: 2, sopSuccessRate: 50,
    snapshotObservedAt: '2026-10-25T00:00:00.000Z'
  } } }));
  await page.goto('/');
  const snapshot = page.locator('.el-descriptions');
  await expect(snapshot.getByText('正常状态客户（日表快照）', { exact: true })).toBeVisible();
  await expect(snapshot.getByText('17', { exact: true })).toBeVisible();
  await expect(snapshot.getByText('999', { exact: true })).toHaveCount(0);
  await expect(snapshot.getByText('快照采集时间', { exact: true })).toBeVisible();
  await expect(snapshot.getByText('2026/10/25 08:00:00', { exact: true })).toBeVisible();
  await expect(page.getByText('活跃客户', { exact: true })).toHaveCount(0);
  await expect(page.getByText('当日流失', { exact: true })).toHaveCount(0);
});

for (const legacy of [
  { name: 'tag alias', stepType: 2, raw: { tags: [11], extra: { source: 'legacy' } }, expected: { tagIds: [11], extra: { source: 'legacy' } } },
  { name: 'JSON reminder singleton', stepType: 5, raw: JSON.stringify({ userId: 7, text: '旧提醒', title: '待办' }), expected: { userIds: [7], text: '旧提醒', content: '旧提醒', title: '待办' } },
  { name: 'JSON message', stepType: 1, raw: JSON.stringify({ content: '原始消息', extra: { source: 'legacy' } }), expected: { content: '原始消息', extra: { source: 'legacy' } } },
  { name: 'plain message', stepType: 1, raw: '纯文本消息', expected: { content: '纯文本消息' } },
]) {
  test(`renaming a SOP retains legacy ${legacy.name} action semantics`, async ({ page }) => {
    await page.route('**/api/sop/template/3', route => route.fulfill({ json: { success: true, data: {
      id: 3, templateName: '旧版流程', templateType: 1, triggerType: 4,
      steps: [{ stepName: '旧步骤', stepType: legacy.stepType, delayTime: 0, delayUnit: 'minute', actionContent: legacy.raw }]
    } } }));
    await page.goto('/sop/3/edit');
    await page.getByPlaceholder('如：新客欢迎SOP').fill('仅修改流程名称');
    const request = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/sop/steps/batch'));
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    expect((await request).postDataJSON().steps[0].actionContent).toEqual(legacy.expected);
  });
}
