import { test, expect } from '@playwright/test';

/**
 * Sprint 6 流程 B（官网）：需已启动 `pnpm --filter @scrm/official-website dev`（默认 3010）。
 * 全量 `pnpm test:e2e` 由 run-full-e2e.sh 拉起官网。
 */
test.describe('Sprint 6 — 官网首页', () => {
  test('首页标题与主导航可见', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Open SCRM/);
    await expect(page.getByRole('heading', { name: '企业私域与客户运营' })).toBeVisible();
    await expect(page.getByRole('link', { name: '功能亮点' })).toBeVisible();
    await expect(page.getByRole('link', { name: '联系' })).toBeVisible();
  });
});
