import { test, expect, type Page } from '@playwright/test';
const peer = { id: '8', username: 'colleague', realName: '同事甲' };
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'notification-contract-token');
    localStorage.setItem('user', JSON.stringify({ id: '7', corpId: '2', username: 'operator' }));
  });
  let read = false;
  await page.route('**/api/**', route => {
    const request = route.request(),
      url = new URL(request.url());
    let data: unknown = { list: [], total: 0 };
    if (url.pathname === '/api/v1/staff')
      data = {
        list: [
          peer,
          peer,
          { id: '7', username: 'operator', realName: '当前员工' },
          { id: '9007199254740993', username: 'unsafe', realName: '超大编号' }
        ],
        total: 4,
        page: 1,
        pageSize: 20
      };
    if (url.pathname === '/api/notification/list')
      data = {
        list: [
          {
            id: 11,
            title: '待处理通知',
            content: '原通知',
            notificationType: 2,
            isRead: read,
            createTime: '2026-10-26T00:00:00Z'
          }
        ],
        total: 1
      };
    if (url.pathname === '/api/notification/read') {
      read = true;
      data = { affected: 1 };
    }
    if (url.pathname === '/api/notification/unread/count') data = { count: read ? 0 : 1 };
    if (url.pathname === '/api/notification' && request.method() === 'POST')
      data = { success: true, count: request.postDataJSON().userIds.length };
    return route.fulfill({ json: { success: true, data } });
  });
});
async function open(page: Page) {
  await page.goto('/notifications');
  await page.getByRole('button', { name: '发送通知', exact: true }).click();
  return page.getByRole('dialog', { name: '发送通知', exact: true });
}
async function title(page: Page, value = '新通知') {
  const dialog = await open(page);
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^标题/ })
    .getByRole('textbox')
    .fill(value);
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^内容/ })
    .getByRole('textbox')
    .fill('通知正文');
  return dialog;
}
async function selectPeer(page: Page) {
  await page.getByRole('dialog').locator('.tenant-staff-select').getByRole('combobox').click();
  await page.getByRole('option', { name: '同事甲（colleague）', exact: true }).click();
  await page.keyboard.press('Escape');
}
test('empty selection never sends to a fabricated default employee', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => {
    if (r.method() === 'POST') writes.push(r.url());
  });
  const dialog = await title(page);
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('请选择至少一名接收员工', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await expect(dialog.getByText('管理员 (ID:1)', { exact: true })).toHaveCount(0);
});
test('directory colleague submits exact safe array and no fake identity', async ({ page }) => {
  const global: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/api/v1/users')) global.push(r.url());
  });
  const dialog = await title(page, '  同事通知  ');
  await selectPeer(page);
  const requested = page.waitForRequest(
    r => new URL(r.url()).pathname === '/api/notification' && r.method() === 'POST'
  );
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  expect((await requested).postDataJSON()).toEqual({
    userIds: [8],
    notificationType: 1,
    title: '同事通知',
    content: '通知正文'
  });
  expect(global).toEqual([]);
});
test('directory duplicates and explicit self selection deduplicate numeric recipients', async ({
  page
}) => {
  const dialog = await title(page);
  await selectPeer(page);
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  await expect(page.getByRole('option', { name: '同事甲（colleague）', exact: true })).toHaveCount(
    1
  );
  await page.getByRole('option', { name: '当前员工（operator）', exact: true }).click();
  await page.keyboard.press('Escape');
  await dialog.getByText('同时通知我', { exact: true }).click();
  const requested = page.waitForRequest(
    r => new URL(r.url()).pathname === '/api/notification' && r.method() === 'POST'
  );
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  expect((await requested).postDataJSON().userIds).toEqual([8, 7]);
});
test('unsafe directory IDs cannot be selected or produce writes', async ({ page }) => {
  let writes = 0;
  page.on('request', r => {
    if (r.method() === 'POST') writes++;
  });
  const dialog = await title(page);
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  await expect(
    page.getByRole('option', { name: '超大编号（unsafe）', exact: true })
  ).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('请选择至少一名接收员工', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
test('search failure preserves selected employee and editable draft', async ({ page }) => {
  const dialog = await title(page, '保留搜索草稿');
  await selectPeer(page);
  await page.route('**/api/v1/staff**', route =>
    route.fulfill({ status: 503, json: { message: '目录暂不可用' } })
  );
  await dialog.locator('.tenant-staff-select').getByRole('combobox').click();
  await expect(dialog.getByText('目录暂不可用', { exact: true })).toBeVisible();
  await expect(dialog.locator('.tenant-staff-select')).toContainText('同事甲（colleague）');
  await expect(
    dialog.locator('.el-form-item').filter({ hasText: /^标题/ }).getByRole('textbox')
  ).toHaveValue('保留搜索草稿');
});
test('backend disabled-recipient rejection preserves selection and draft', async ({ page }) => {
  const dialog = await title(page, '停用后重试草稿');
  await selectPeer(page);
  await page.route('**/api/notification', route =>
    route.fulfill({ status: 400, json: { message: '通知接收人必须全部属于本企业且为启用员工' } })
  );
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(
    page.getByText('通知接收人必须全部属于本企业且为启用员工', { exact: true })
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.tenant-staff-select')).toContainText('同事甲（colleague）');
  await expect(dialog.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await expect(
    dialog.locator('.el-form-item').filter({ hasText: /^标题/ }).getByRole('textbox')
  ).toHaveValue('停用后重试草稿');
});
test('successful send resets draft and leaves next dialog without selected recipients', async ({
  page
}) => {
  const dialog = await title(page, '发送后清空');
  await selectPeer(page);
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '发送通知', exact: true }).click();
  await expect(
    dialog.locator('.el-form-item').filter({ hasText: /^标题/ }).getByRole('textbox')
  ).toHaveValue('');
  await expect(dialog.locator('.tenant-staff-select .el-tag')).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: '同时通知我', exact: true })).not.toBeChecked();
});
test('whitespace-only title blocks writes even with a selected employee', async ({ page }) => {
  let writes = 0;
  page.on('request', r => {
    if (r.method() === 'POST') writes++;
  });
  const dialog = await title(page, '   ');
  await selectPeer(page);
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('请输入标题', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
test('marking read refreshes list and unread count using existing endpoints', async ({ page }) => {
  await page.goto('/notifications');
  const row = page.getByRole('row').filter({ hasText: '待处理通知' });
  const requested = page.waitForRequest(
    r => new URL(r.url()).pathname === '/api/notification/read'
  );
  await row.getByRole('button', { name: '标记已读', exact: true }).click();
  expect((await requested).postDataJSON()).toEqual({ notificationIds: [11] });
  await expect(row.getByText('已读', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '全部已读', exact: true })).toBeDisabled();
});

test('whitespace-only content blocks writes with recipients selected', async ({ page }) => {
  let writes = 0;
  page.on('request', r => {
    if (r.method() === 'POST') writes++;
  });
  const dialog = await title(page);
  await selectPeer(page);
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^内容/ })
    .getByRole('textbox')
    .fill('   ');
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('请输入通知内容', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
test('failed unread refresh preserves last known count and displays an error', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page.getByRole('button', { name: '全部已读', exact: true })).toBeEnabled();
  await page.route('**/api/notification/unread/count', route =>
    route.fulfill({ status: 503, json: { message: '计数暂不可用' } })
  );
  await page.getByRole('button', { name: '标记已读', exact: true }).click();
  await expect(page.getByText('未读数量加载失败，请重试', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '全部已读', exact: true })).toBeEnabled();
});
test('unsafe notification row IDs cannot produce rounded mark-read writes', async ({ page }) => {
  await page.route('**/api/notification/list**', route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          list: [
            {
              id: '9007199254740993',
              title: '超大通知ID',
              content: '正文',
              isRead: false,
              notificationType: 1
            }
          ],
          total: 1
        }
      }
    })
  );
  let writes = 0;
  page.on('request', r => {
    if (r.method() === 'PUT') writes++;
  });
  await page.goto('/notifications');
  await page
    .getByRole('row')
    .filter({ hasText: '超大通知ID' })
    .getByRole('button', { name: '标记已读', exact: true })
    .click();
  await expect(page.getByText('通知编号超出支持范围', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});

for (const failed of [false, true]) {
  test(`pending send locks draft and blocks cancel/reopen until ${failed ? 'error' : 'success'} response`, async ({
    page
  }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    await page.route('**/api/notification', async route => {
      await gate;
      await route.fulfill(
        failed
          ? { status: 400, json: { message: '延迟发送失败' } }
          : { json: { success: true, data: { count: 1 } } }
      );
    });
    const dialog = await title(page, '等待中的原草稿');
    await selectPeer(page);
    const posted = page.waitForRequest(
      r => new URL(r.url()).pathname === '/api/notification' && r.method() === 'POST'
    );
    await dialog.getByRole('button', { name: '发送', exact: true }).click();
    await posted;
    try {
      await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
      await expect(dialog.locator('.el-dialog__headerbtn')).toHaveCount(0);
      await expect(
        dialog.locator('.el-form-item').filter({ hasText: /^标题/ }).getByRole('textbox')
      ).toBeDisabled();
      await expect(page.getByRole('button', { name: '发送通知', exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
    } finally {
      release();
    }
    if (failed) {
      await expect(page.getByText('延迟发送失败', { exact: true })).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator('.el-form-item').filter({ hasText: /^标题/ }).getByRole('textbox')
      ).toHaveValue('等待中的原草稿');
      await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeEnabled();
    } else {
      await expect(dialog).not.toBeVisible();
    }
  });
}
async function sendFromCurrentPage(page: Page) {
  await page.getByRole('button', { name: '发送通知', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '发送通知', exact: true });
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^标题/ })
    .getByRole('textbox')
    .fill('刷新触发通知');
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: /^内容/ })
    .getByRole('textbox')
    .fill('刷新正文');
  await selectPeer(page);
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
for (const failed of [false, true]) {
  test(`older list ${failed ? 'failure' : 'success'} cannot overwrite a newer post-send refresh`, async ({
    page
  }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let calls = 0;
    await page.route('**/api/notification/list**', async route => {
      const first = ++calls === 1;
      if (first) await gate;
      const row = {
        id: first ? 21 : 22,
        title: first ? '过期列表通知' : '最新列表通知',
        content: '正文',
        notificationType: 1,
        isRead: !first
      };
      await route.fulfill(
        first && failed
          ? { status: 503, json: { message: '过期查询错误' } }
          : { json: { success: true, data: { list: [row], total: 1 } } }
      );
    });
    await page.goto('/notifications');
    try {
      await sendFromCurrentPage(page);
      await expect(page.getByRole('row').filter({ hasText: '最新列表通知' })).toBeVisible();
      const stale = page.waitForResponse(
        r => new URL(r.url()).pathname === '/api/notification/list'
      );
      release();
      await (await stale).finished();
      await page.evaluate(
        () =>
          new Promise<void>(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      await expect(page.getByRole('row').filter({ hasText: '最新列表通知' })).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: '过期列表通知' })).toHaveCount(0);
      expect(await page.getByText('获取通知列表失败', { exact: true }).count()).toBe(0);
    } finally {
      release();
    }
  });
}
for (const failed of [false, true]) {
  test(`older unread-count ${failed ? 'failure' : 'success'} cannot undo a newer mark-read refresh`, async ({
    page
  }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let calls = 0;
    await page.route('**/api/notification/unread/count', async route => {
      const first = ++calls === 1;
      if (first) await gate;
      await route.fulfill(
        first && failed
          ? { status: 503, json: { message: '过期计数错误' } }
          : { json: { success: true, data: { count: first ? 99 : 0 } } }
      );
    });
    await page.goto('/notifications');
    try {
      await page.getByRole('button', { name: '标记已读', exact: true }).click();
      await expect.poll(() => calls).toBe(2);
      await expect(page.getByRole('button', { name: '全部已读', exact: true })).toBeDisabled();
      const stale = page.waitForResponse(
        r => new URL(r.url()).pathname === '/api/notification/unread/count'
      );
      release();
      await stale;
      await expect(page.getByRole('button', { name: '全部已读', exact: true })).toBeDisabled();
      expect(await page.getByText('未读数量加载失败，请重试', { exact: true }).count()).toBe(0);
    } finally {
      release();
    }
  });
}
