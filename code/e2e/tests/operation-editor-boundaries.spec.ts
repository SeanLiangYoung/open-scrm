import { test, expect } from '@playwright/test';
/** Browser contract boundaries against mocked HTTP only; no live operations. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'mock-boundary-token');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let data: unknown = {};
    if (url.pathname === '/api/v1/tags') data = [];
    if (url.pathname === '/api/sop/templates')
      data = {
        list: [{ id: 3, templateName: '已载入模板', templateType: 1, status: 1 }],
        total: 123
      };
    if (url.pathname === '/api/sop/executions')
      data = {
        list: [{ id: 1, status: 0 }],
        total: url.searchParams.get('status') === '0' ? 57 : 300
      };
    if (url.pathname === '/api/v1/customers/statistics/overview')
      data = { total: 200, active: 150 };
    if (url.pathname === '/api/v1/customers')
      data = { list: [{ channel: 'wechat', status: 1 }], total: 1000 };
    if (url.pathname === '/api/v1/analytics/overview')
      data = {
        snapshotAvailable: true,
        totalCustomerCount: 25,
        normalCustomerCount: 17,
        messageSendCount: 3,
        messageSuccessRate: 100,
        sopExecuteCount: 2,
        sopSuccessRate: 50,
        snapshotObservedAt: null
      };
    await route.fulfill({ json: { success: true, data } });
  });
});
async function existingStep(
  page: import('@playwright/test').Page,
  stepType: number,
  actionContent: unknown
) {
  await page.route('**/api/sop/template/3', route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: 3,
          templateName: '已有流程',
          templateType: 1,
          triggerType: 4,
          steps: [
            { stepName: '原步骤', stepType, delayTime: 0, delayUnit: 'minute', actionContent }
          ]
        }
      }
    })
  );
  await page.goto('/sop/3/edit');
}
test('material step captures a supported URL and preserves metadata on edit', async ({ page }) => {
  await existingStep(page, 3, { assetUrl: 'https://example.com/old', extra: { campaign: 'keep' } });
  await page.getByPlaceholder('素材链接 URL').fill('https://example.com/new');
  await page.getByPlaceholder('素材说明（可选）').fill('素材介绍');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && r.url().endsWith('/api/sop/steps/batch')
  );
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  expect((await request).postDataJSON().steps[0].actionContent).toEqual({
    url: 'https://example.com/new',
    content: '素材介绍',
    extra: { campaign: 'keep' }
  });
});
test('new material step cannot submit without a URL or content', async ({ page }) => {
  let writes = 0;
  page.on('request', r => {
    if (['POST', 'PUT'].includes(r.method())) writes++;
  });
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('素材流程');
  await page.getByRole('button', { name: '添加步骤' }).click();
  await page.locator('.step-item .el-select').first().click();
  await page.getByRole('option', { name: '推送素材', exact: true }).click();
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  await expect(page.getByText('请为素材步骤填写链接或说明', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
test('customer assignment is available through the tenant employee selector', async ({ page }) => {
  await page.goto('/sop/create');
  await page.getByRole('button', { name: '添加步骤' }).click();
  await page.locator('.step-item .el-select').first().click();
  await page.getByRole('option', { name: '分配客户', exact: true }).click();
  await expect(page.locator('.step-item .tenant-staff-select')).toBeVisible();
});
test('existing assignment target and metadata survive canonicalization during a name-only edit', async ({ page }) => {
  await existingStep(page, 4, { staffId: 19, extra: { origin: 'preserve' } });
  await expect(page.locator('.step-item .tenant-staff-select')).toBeVisible();
  await page.getByPlaceholder('如：新客欢迎SOP').fill('只改名字');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && r.url().endsWith('/api/sop/steps/batch')
  );
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  expect((await request).postDataJSON().steps[0].actionContent).toEqual({
    followUserId: 19,
    extra: { origin: 'preserve' }
  });
});
test('removing every existing step cannot silently save template metadata', async ({ page }) => {
  await existingStep(page, 1, { content: '原动作' });
  let writes = 0;
  page.on('request', r => {
    if (['POST', 'PUT'].includes(r.method())) writes++;
  });
  await page.locator('.step-header button').click();
  await page.getByPlaceholder('如：新客欢迎SOP').fill('不应部分保存');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(
    page.getByText('至少保留一个步骤，当前不支持清空已有 SOP', { exact: true })
  ).toBeVisible();
  expect(writes).toBe(0);
});
test('dashboard uses paginated totals and an explicitly filtered running count', async ({
  page
}) => {
  const request = page.waitForRequest(
    r =>
      new URL(r.url()).pathname === '/api/sop/executions' &&
      new URL(r.url()).searchParams.get('status') === '0'
  );
  await page.goto('/');
  await request;
  await expect(
    page.locator('.stat-card').filter({ hasText: 'SOP 模板' }).locator('.stat-value')
  ).toHaveText('123');
  await expect(
    page.locator('.stat-card').filter({ hasText: '执行中' }).locator('.stat-value')
  ).toHaveText('57');
  await expect(
    page.getByText('客户来源分布（最近最多100位客户样本）', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('客户状态分布（最近最多100位客户样本）', { exact: true })
  ).toBeVisible();
});
test('dashboard reports partial failures while keeping successfully loaded cards', async ({
  page
}) => {
  await page.route('**/api/v1/customers/statistics/overview', route =>
    route.fulfill({ status: 503, json: { message: '统计暂不可用' } })
  );
  await page.goto('/');
  await expect(page.getByText('部分看板数据加载失败：客户统计', { exact: true })).toBeVisible();
  await expect(
    page.locator('.stat-card').filter({ hasText: 'SOP 模板' }).locator('.stat-value')
  ).toHaveText('123');
  await expect(
    page.locator('.stat-card').filter({ hasText: '客户总数' }).locator('.stat-value')
  ).toHaveText('-');
});
test('explicitly unavailable daily snapshot is not displayed as observed zero metrics', async ({
  page
}) => {
  await page.route('**/api/v1/analytics/overview?**', route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          snapshotAvailable: false,
          totalCustomerCount: 0,
          normalCustomerCount: 0,
          snapshotObservedAt: null
        }
      }
    })
  );
  await page.goto('/');
  await expect(page.getByText('当日尚无聚合快照', { exact: true })).toBeVisible();
  await expect(page.locator('.el-descriptions')).toHaveCount(0);
});
test('a legacy snapshot lacking availability and observation time retains valid counts', async ({
  page
}) => {
  await page.route('**/api/v1/analytics/overview?**', route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          totalCustomerCount: 25,
          normalCustomerCount: 17,
          messageSendCount: 3,
          messageSuccessRate: 100,
          sopExecuteCount: 2,
          sopSuccessRate: 50,
          snapshotObservedAt: null
        }
      }
    })
  );
  await page.goto('/');
  await expect(page.locator('.el-descriptions').getByText('17', { exact: true })).toBeVisible();
  await expect(page.locator('.el-descriptions').getByText('未提供', { exact: true })).toBeVisible();
});

test('group SOP disables selecting a customer-only tag action', async ({ page }) => {
  await page.goto('/sop/create');
  await page
    .locator('.el-radio')
    .filter({ hasText: /^群SOP$/ })
    .click();
  await page.getByRole('button', { name: '添加步骤' }).click();
  await page.locator('.step-item .el-select').first().click();
  await expect(page.getByRole('option', { name: '打标签', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
});
test('switching an existing tagged customer SOP to group blocks every write and preserves the step', async ({
  page
}) => {
  await existingStep(page, 2, { tagIds: [11], extra: { keep: true } });
  let writes = 0;
  page.on('request', request => {
    if (['PUT', 'POST'].includes(request.method())) writes++;
  });
  await page
    .locator('.el-radio')
    .filter({ hasText: /^群SOP$/ })
    .click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(
    page.getByText('群 SOP 不支持客户打标签或分配步骤，请明确移除或更改该步骤', { exact: true })
  ).toBeVisible();
  expect(writes).toBe(0);
  await expect(page.locator('.step-item')).toHaveCount(1);
});
test('group message template creation uses numeric group template type and retains message step', async ({
  page
}) => {
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('群消息流程');
  await page
    .locator('.el-radio')
    .filter({ hasText: /^群SOP$/ })
    .click();
  await page.getByRole('button', { name: '添加步骤' }).click();
  await page.getByPlaceholder('消息文本内容').fill('群消息正文');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && r.url().endsWith('/api/sop/template')
  );
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  const body = (await request).postDataJSON();
  expect(body.templateType).toBe(2);
  expect(body).not.toHaveProperty('targetType');
  expect(body.steps[0]).toMatchObject({
    stepType: 1,
    actionType: 1,
    actionContent: { content: '群消息正文' }
  });
});
