import { test, expect } from '@playwright/test';

const GATEWAY =
  process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

test.describe('Sprint 1 — 运营平台浏览器 E2E', () => {
  test.beforeEach(async ({ request }) => {
    const h = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!h?.ok(), 'Gateway 未启动');
  });

  test('登录后看板可见', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('Admin@123');
    await page.getByRole('button', { name: '登 录' }).click();

    await expect(page.getByText('客户增长趋势', { exact: false })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('客户列表、SOP、群发任务页面可打开', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('Admin@123');
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page.getByText('客户增长趋势', { exact: false })).toBeVisible({
      timeout: 30_000,
    });

    const aside = page.locator('.layout-aside');
    // Element Plus 子菜单：先展开分组，再点子项（折叠时无可用 menuitem）
    await aside.locator('.el-sub-menu').filter({ hasText: '客户管理' }).locator('.el-sub-menu__title').click();
    await aside.locator('.el-menu-item').filter({ hasText: /^客户列表$/ }).click();
    await expect(page).toHaveURL(/\/customers$/);

    await aside.locator('.el-sub-menu').filter({ hasText: '运营工具' }).locator('.el-sub-menu__title').click();
    await aside.locator('.el-menu-item').filter({ hasText: /^SOP 管理$/ }).click();
    await expect(page).toHaveURL(/\/sop$/);

    await aside.locator('.el-menu-item').filter({ hasText: /^群发任务$/ }).click();
    await expect(page).toHaveURL(/\/mass-task$/);
  });

  /** Sprint 6：与迭代计划 §8.2「登录 + 一条业务操作」对齐（获客活码经网关 acquisition） */
  test('Sprint6：渠道管理新建一条活码', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('Admin@123');
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page.getByText('客户增长趋势', { exact: false })).toBeVisible({
      timeout: 30_000,
    });

    const aside = page.locator('.layout-aside');
    await aside.locator('.el-menu-item').filter({ hasText: '渠道管理' }).click();
    await expect(page).toHaveURL(/\/channels$/);
    await expect(page.getByText('渠道活码管理')).toBeVisible();

    await page.getByRole('button', { name: /新建活码/ }).click();
    const unique = `e2e-s6-${Date.now()}`;
    const dlg = page.locator('.el-dialog').filter({ hasText: '新建活码' });
    await dlg.getByRole('textbox').first().fill(unique);
    await dlg.getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('操作成功')).toBeVisible({ timeout: 20_000 });
  });
});
