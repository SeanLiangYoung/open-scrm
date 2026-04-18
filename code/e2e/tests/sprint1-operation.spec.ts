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
});
