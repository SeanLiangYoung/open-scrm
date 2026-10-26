import { test, expect } from '@playwright/test';
/** Mock API browser contracts only: never connects to a backend or sends a real message. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'mock-mass-task-token');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  const tasks = [0, 1, 2, 3, 4].map((status, i) => ({
    id: String(i + 1),
    taskName: `任务${i + 1}`,
    taskType: 1,
    targetType: (i % 3) + 1,
    messageType: 5,
    status,
    targetCount: 10,
    successCount: 6,
    failCount: 2
  }));
  tasks.push({
    id: '6',
    taskName: '旧渠道任务',
    taskType: 1,
    targetType: 1,
    messageType: 1,
    status: 0,
    targetCount: 1,
    successCount: 0,
    failCount: 0
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    let data: unknown = { list: [] };
    if (url.pathname === '/api/mass-task/list') {
      const status = url.searchParams.get('status');
      const targetType = url.searchParams.get('targetType');
      const name = url.searchParams.get('taskName');
      const list = tasks.filter(
        t =>
          (status === null || t.status === Number(status)) &&
          (targetType === null || t.targetType === Number(targetType)) &&
          (!name || t.taskName.includes(name))
      );
      data = { list, total: list.length, page: 1, pageSize: 20 };
    } else if (url.pathname === '/api/mass-task' && request.method() === 'POST') {
      const body = request.postDataJSON();
      data = {
        ...body,
        id: 99,
        status: 0,
        targetCount: body.targetIds?.length || 0,
        successCount: 0,
        failCount: 0
      };
    } else if (url.pathname === '/api/mass-task/execute') data = { success: 1, failed: 0 };
    else if (/\/api\/mass-task\/\d+\/cancel/.test(url.pathname)) data = { success: true };
    await route.fulfill({ json: { success: true, data } });
  });
});
test('numeric status, target and counters display backend fields and supported actions', async ({
  page
}) => {
  await page.goto('/mass-task');
  for (const label of ['待执行', '执行中', '已完成', '已失败', '已取消'])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: '任务1' });
  await expect(row.getByRole('cell', { name: '客户', exact: true })).toBeVisible();
  await expect(row.getByRole('cell', { name: '6', exact: true })).toBeVisible();
  await expect(row.getByRole('cell', { name: '2', exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: '执行', exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: '取消', exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: '任务2' })
      .getByRole('button', { name: '取消', exact: true })
  ).toHaveCount(0);
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: '旧渠道任务' })
      .getByRole('button', { name: '执行', exact: true })
  ).toHaveCount(0);
  await expect(page.getByText(/当前仅支持模拟消息任务/)).toBeVisible();
});
test('create submits numeric targets and supported backend fields without tenant injection', async ({
  page
}) => {
  await page.goto('/mass-task');
  await page.getByRole('button', { name: '新建群发' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('任务名称').fill(' 模拟欢迎 ');
  await dialog.locator('.el-radio').filter({ hasText: /^群$/ }).click();
  await expect(dialog.getByRole('radio', { name: '群', exact: true })).toBeChecked();
  await dialog.getByPlaceholder('多个 ID 用逗号分隔').fill('10, 11，10');
  await dialog.getByPlaceholder('输入群发消息内容').fill(' 模拟正文 ');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/mass-task'
  );
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({
    taskName: '模拟欢迎',
    taskType: 1,
    targetType: 3,
    targetIds: [10, 11],
    messageContent: '模拟正文',
    messageType: 5
  });
});
for (const ids of ['', '0', 'abc', '1.5', '9007199254740992'])
  test(`invalid recipient IDs blocked: ${ids || 'empty'}`, async ({ page }) => {
    let writes = 0;
    page.on('request', r => {
      if (r.method() === 'POST') writes++;
    });
    await page.goto('/mass-task');
    await page.getByRole('button', { name: '新建群发' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('任务名称').fill('测试');
    await dialog.getByPlaceholder('多个 ID 用逗号分隔').fill(ids);
    await dialog.getByPlaceholder('输入群发消息内容').fill('测试正文');
    await dialog.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page.getByText('请输入有效的正整数目标 ID')).toBeVisible();
    expect(writes).toBe(0);
  });
test('filters submit supported names and preserve numeric zero status', async ({ page }) => {
  await page.goto('/mass-task');
  await page.getByPlaceholder('按任务名称搜索').fill('任务');
  await page.locator('.filters .el-select').nth(0).click();
  await page.getByRole('option', { name: '待执行', exact: true }).click();
  await page.locator('.filters .el-select').nth(1).click();
  await page.getByRole('option', { name: '客户', exact: true }).click();
  const request = page.waitForRequest(
    r =>
      new URL(r.url()).pathname === '/api/mass-task/list' &&
      new URL(r.url()).searchParams.get('status') === '0'
  );
  await page.getByRole('button', { name: '查询', exact: true }).click();
  const query = new URL((await request).url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({
    taskName: '任务',
    status: '0',
    targetType: '1',
    page: '1',
    pageSize: '20'
  });
});
test('pending mock execution uses execute contract after confirmation', async ({ page }) => {
  await page.goto('/mass-task');
  await page
    .getByRole('row')
    .filter({ hasText: '任务1' })
    .getByRole('button', { name: '执行', exact: true })
    .click();
  const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/mass-task/execute');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ taskId: 1 });
});
test('pending cancellation uses ID path; dismissing execution does not write', async ({ page }) => {
  let executeWrites = 0;
  page.on('request', r => {
    if (r.url().endsWith('/api/mass-task/execute')) executeWrites++;
  });
  await page.goto('/mass-task');
  const row = page.getByRole('row').filter({ hasText: '任务1' });
  await row.getByRole('button', { name: '执行', exact: true }).click();
  await page.locator('.el-message-box').getByRole('button', { name: '取消', exact: true }).click();
  expect(executeWrites).toBe(0);
  const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/mass-task/1/cancel');
  await row.getByRole('button', { name: '取消', exact: true }).click();
  expect((await request).method()).toBe('POST');
});
for (const emptyField of ['taskName', 'messageContent'])
  test(`missing ${emptyField} is blocked before submission`, async ({ page }) => {
    let writes = 0;
    page.on('request', request => {
      if (request.method() === 'POST') writes++;
    });
    await page.goto('/mass-task');
    await page.getByRole('button', { name: '新建群发' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('任务名称').fill(emptyField === 'taskName' ? '  ' : '模拟任务');
    await dialog.getByPlaceholder('多个 ID 用逗号分隔').fill('10');
    await dialog
      .getByPlaceholder('输入群发消息内容')
      .fill(emptyField === 'messageContent' ? '  ' : '正文');
    await dialog.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page.getByText('请填写任务名称和发送内容')).toBeVisible();
    expect(writes).toBe(0);
  });
test('list pagination submits page number and fixed supported page size', async ({ page }) => {
  await page.route('**/api/mass-task/list?**', route =>
    route.fulfill({ json: { success: true, data: { list: [], total: 45 } } })
  );
  await page.goto('/mass-task');
  const request = page.waitForRequest(r => new URL(r.url()).searchParams.get('page') === '2');
  await page.locator('.el-pagination .el-pager .number').filter({ hasText: /^2$/ }).click();
  const query = new URL((await request).url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({ page: '2', pageSize: '20' });
});
for (const id of ['9007199254740993', '1e1'])
  test(`unsafe or ambiguous cancellation ID is rejected without a write: ${id}`, async ({
    page
  }) => {
    let writes = 0;
    page.on('request', request => {
      if (request.method() === 'POST') writes++;
    });
    await page.route('**/api/mass-task/list?**', route =>
      route.fulfill({
        json: {
          success: true,
          data: {
            list: [
              {
                id,
                taskName: '无效任务ID',
                taskType: 1,
                targetType: 1,
                messageType: 5,
                status: 0,
                targetCount: 1,
                successCount: 0,
                failCount: 0
              }
            ],
            total: 1
          }
        }
      })
    );
    await page.goto('/mass-task');
    await page
      .getByRole('row')
      .filter({ hasText: '无效任务ID' })
      .getByRole('button', { name: '取消', exact: true })
      .click();
    await expect(page.getByText('任务 ID 无效', { exact: true })).toBeVisible();
    expect(writes).toBe(0);
  });
