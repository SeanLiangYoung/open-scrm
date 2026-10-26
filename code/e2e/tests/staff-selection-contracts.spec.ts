import { test, expect } from '@playwright/test';
// Mock-browser request contracts only. No real staff directory or messages.
const colleague = { id: '8', username: 'colleague', realName: '同事甲' };
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'staff-mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { list: [], total: 0 };
    if (path === '/api/v1/staff')
      data = {
        list: [
          colleague,
          { id: '7', username: 'operator', realName: '当前员工' },
          { id: '9007199254740993', username: 'too-big', realName: '超大编号' }
        ],
        total: 3,
        page: 1,
        pageSize: 20
      };
    if (path === '/api/v1/customers')
      data = {
        list: [
          {
            id: 10,
            name: '原客户',
            gender: 0,
            status: 1,
            channel: 'wechat',
            followUserId: '99',
            createTime: '2026-10-26T00:00:00Z'
          }
        ],
        total: 1
      };
    if (path === '/api/sop/template/3')
      data = {
        id: 3,
        templateName: '已有提醒',
        templateType: 1,
        triggerType: 4,
        steps: [
          {
            stepName: '提醒',
            stepType: 5,
            delayTime: 0,
            delayUnit: 'minute',
            actionContent: { content: '原提醒', userIds: [99], extra: { keep: true } }
          }
        ]
      };
    return route.fulfill({ json: { success: true, data } });
  });
});
test('customer create selects a colleague and sends safe numeric assignment without global user requests', async ({
  page
}) => {
  const globalUsers: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/users'))
      globalUsers.push(request.url());
  });
  await page.goto('/customers');
  await page.getByRole('button', { name: '新建客户', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建客户', exact: true });
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^姓名/ })
    .getByRole('textbox')
    .fill('已分配客户');
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  await page.getByRole('option', { name: '同事甲（colleague）', exact: true }).click();
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/customers'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  const body = (await request).postDataJSON();
  expect(body.followUserId).toBe(8);
  expect(body).not.toHaveProperty('corpId');
  expect(globalUsers).toEqual([]);
});
test('customer edit retains existing assignment not present in search results without resubmitting it', async ({
  page
}) => {
  await page.goto('/customers');
  await page
    .getByRole('row')
    .filter({ hasText: '原客户' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '编辑客户', exact: true });
  await expect(dialog.getByText('已配置员工 #99', { exact: true })).toBeVisible();
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  await expect(
    page.getByRole('option', { name: '同事甲（colleague）', exact: true })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  const request = page.waitForRequest(
    r => r.method() === 'PUT' && new URL(r.url()).pathname === '/api/v1/customers/10'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON()).not.toHaveProperty('followUserId');
});
test('SOP reminders preserve existing recipients and metadata while adding colleague and self without duplicates', async ({
  page
}) => {
  await page.goto('/sop/3/edit');
  const step = page.locator('.step-item');
  await expect(step.getByText('已配置员工 #99', { exact: true })).toBeVisible();
  await step.locator('.el-checkbox').filter({ hasText: '提醒当前登录员工' }).click();
  await expect(step.getByRole('checkbox', { name: /提醒当前登录员工/ })).toBeChecked();
  await step.locator('.tenant-staff-select').getByRole('combobox').click();
  await page.getByRole('option', { name: '同事甲（colleague）', exact: true }).click();
  await page.getByRole('option', { name: '当前员工（operator）', exact: true }).click();
  await page.keyboard.press('Escape');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/sop/steps/batch'
  );
  await page.getByPlaceholder('如：新客欢迎SOP').focus();
  await page.getByRole('button', { name: '保存修改', exact: true }).press('Enter');
  const action = (await request).postDataJSON().steps[0].actionContent;
  expect(action.userIds).toEqual([99, 8, 7]);
  expect(action.extra).toEqual({ keep: true });
});
test('customer assignment SOP step is enabled and submits selected numeric employee', async ({
  page
}) => {
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('分配流程');
  await page.getByRole('button', { name: '添加步骤', exact: true }).click();
  const step = page.locator('.step-item');
  await step.locator('.el-select').first().click();
  await page.getByRole('option', { name: '分配客户', exact: true }).click();
  await step.locator('.tenant-staff-select').getByRole('combobox').click();
  await page.getByRole('option', { name: '同事甲（colleague）', exact: true }).click();
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/sop/template'
  );
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  expect((await request).postDataJSON().steps[0].actionContent).toEqual({ followUserId: 8 });
});
test('failed staff search gives feedback and preserves existing selected employee', async ({
  page
}) => {
  await page.route('**/api/v1/staff?**', route =>
    route.fulfill({ status: 503, json: { message: '员工搜索暂不可用' } })
  );
  await page.goto('/customers');
  await page
    .getByRole('row')
    .filter({ hasText: '原客户' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '编辑客户', exact: true });
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  await expect(dialog.getByText('员工搜索暂不可用', { exact: true })).toBeVisible();
  await expect(dialog.getByText('已配置员工 #99', { exact: true })).toBeVisible();
});
test('unsafe staff IDs are disabled and unsafe existing SOP recipient blocks writes without rounding', async ({
  page
}) => {
  let writes = 0;
  page.on('request', request => {
    if (['POST', 'PUT'].includes(request.method())) writes++;
  });
  await page.route('**/api/sop/template/3', route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: 3,
          templateName: '超大接收人',
          templateType: 1,
          triggerType: 4,
          steps: [
            {
              stepName: '提醒',
              stepType: 5,
              delayTime: 0,
              delayUnit: 'minute',
              actionContent: { content: '正文', userIds: ['9007199254740993'] }
            }
          ]
        }
      }
    })
  );
  await page.goto('/sop/3/edit');
  const step = page.locator('.step-item');
  await expect(step.getByText('已配置员工 #9007199254740993', { exact: true })).toBeVisible();
  await step.locator('.tenant-staff-select').getByRole('combobox').click();
  await expect(
    page.getByRole('option', { name: '超大编号（too-big）', exact: true })
  ).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(
    page.getByText('员工编号超出支持范围，请重新选择员工', { exact: true })
  ).toBeVisible();
  expect(writes).toBe(0);
});
test('out-of-order staff searches keep the newest result', async ({ page }) => {
  await page.route('**/api/v1/staff?**', async route => {
    const keyword = new URL(route.request().url()).searchParams.get('keyword');
    if (keyword === 'old') await new Promise(resolve => setTimeout(resolve, 800));
    await route.fulfill({
      json: {
        success: true,
        data: {
          list: [
            {
              id: keyword === 'old' ? '81' : '82',
              username: keyword || 'empty',
              realName: keyword === 'old' ? '过期结果' : '最新结果'
            }
          ],
          total: 1,
          page: 1,
          pageSize: 20
        }
      }
    });
  });
  await page.goto('/customers');
  await page.getByRole('button', { name: '新建客户', exact: true }).click();
  const input = page.getByRole('dialog').locator('.tenant-staff-select').getByRole('combobox');
  await input.fill('old');
  await page.waitForRequest(r => new URL(r.url()).searchParams.get('keyword') === 'old');
  await input.fill('new');
  await expect(page.getByRole('option', { name: '最新结果（new）', exact: true })).toBeVisible();
  await page.waitForResponse(r => new URL(r.url()).searchParams.get('keyword') === 'old');
  await expect(page.getByRole('option', { name: '过期结果（old）', exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: '最新结果（new）', exact: true })).toBeVisible();
});
test('customer edit can replace an existing employee with a safe numeric colleague ID', async ({
  page
}) => {
  await page.goto('/customers');
  await page
    .getByRole('row')
    .filter({ hasText: '原客户' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '编辑客户', exact: true });
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  await page.getByRole('option', { name: '同事甲（colleague）', exact: true }).click();
  const request = page.waitForRequest(
    r => r.method() === 'PUT' && new URL(r.url()).pathname === '/api/v1/customers/10'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON().followUserId).toBe(8);
});
test('whitespace message steps are rejected before template or step writes', async ({ page }) => {
  let writes = 0;
  page.on('request', request => {
    if (['POST', 'PUT'].includes(request.method())) writes++;
  });
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('消息校验');
  await page.getByRole('button', { name: '添加步骤', exact: true }).click();
  await page.getByPlaceholder('消息文本内容').fill('   ');
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  await expect(page.getByText('请为消息步骤填写内容', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
test('whitespace-only template names are rejected before writes', async ({ page }) => {
  let writes = 0;
  page.on('request', request => {
    if (['POST', 'PUT'].includes(request.method())) writes++;
  });
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('   ');
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  await expect(page.getByText('请输入 SOP 名称', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
test('a named new draft without steps remains allowed', async ({ page }) => {
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('待配置草稿');
  const request = page.waitForRequest(
    r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/sop/template'
  );
  await page.getByRole('button', { name: '创建 SOP', exact: true }).click();
  const body = (await request).postDataJSON();
  expect(body.steps).toEqual([]);
  expect(body).not.toHaveProperty('description');
});
test('clearing an existing SOP description sends explicit null', async ({ page }) => {
  await page.route('**/api/sop/template/3', route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: 3,
          templateName: '可清空描述',
          description: '已有描述',
          templateType: 1,
          triggerType: 4,
          steps: [
            {
              stepName: '消息',
              stepType: 1,
              delayTime: 0,
              delayUnit: 'minute',
              actionContent: { content: '保留正文' }
            }
          ]
        }
      }
    })
  );
  await page.goto('/sop/3/edit');
  const description = page.getByPlaceholder('描述此SOP的用途和目标');
  await expect(description).toHaveValue('已有描述');
  await description.fill('');
  const request = page.waitForRequest(
    r => r.method() === 'PUT' && new URL(r.url()).pathname === '/api/sop/template/3'
  );
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  expect((await request).postDataJSON().description).toBeNull();
});

test('clearing an existing customer assignment sends explicit null', async ({ page }) => {
  await page.goto('/customers');
  await page
    .getByRole('row')
    .filter({ hasText: '原客户' })
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '编辑客户', exact: true });
  const selector = dialog.locator('.tenant-staff-select');
  await selector.hover();
  await selector.locator('.el-select__clear').click();
  const request = page.waitForRequest(
    r => r.method() === 'PUT' && new URL(r.url()).pathname === '/api/v1/customers/10'
  );
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  expect((await request).postDataJSON().followUserId).toBeNull();
});
