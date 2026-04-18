import { test, expect } from '@playwright/test';

const GATEWAY =
  process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

test.describe('Sprint 1 — 管理平台浏览器 E2E', () => {
  test.beforeEach(async ({ request }) => {
    const h = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!h?.ok(), 'Gateway 未启动');
  });

  test('登录后进入仪表盘', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('Admin@123');
    await page.getByRole('button', { name: '登 录' }).click();

    await expect(page.getByText('客户总数')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test('可打开用户管理与服务监控', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('Admin@123');
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page.getByText('客户总数')).toBeVisible({ timeout: 30_000 });

    const aside = page.locator('.layout-aside');
    // 仅点侧边栏菜单，避免与顶栏等「用户管理」文案冲突（strict mode）
    await aside.locator('.el-menu-item').filter({ hasText: /^用户管理$/ }).click();
    await expect(page).toHaveURL(/\/users$/);

    await aside.locator('.el-menu-item').filter({ hasText: /^服务监控$/ }).click();
    await expect(page).toHaveURL(/\/monitor$/);
  });
});
