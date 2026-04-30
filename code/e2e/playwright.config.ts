import { defineConfig, devices } from '@playwright/test';

/**
 * 默认网关地址：Docker Compose 映射为宿主机 17000（避免 macOS AirPlay 占用 7000）。
 * 本地 `mw dev` 网关在本机 7000 时：GATEWAY_URL=http://127.0.0.1:7000 pnpm test:e2e
 */
const gatewayUrl =
  process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  /**
   * 不在此自动拉起 Vite（易超时）。完整流程请用仓库根 `pnpm test:e2e` → e2e/run-full-e2e.sh。
   * 若已手动启动两个前端，可：PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm --filter @scrm/e2e exec playwright test
   */
  projects: [
    {
      name: 'sprint1-api',
      testMatch: /sprint1-api\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint2-integration',
      testMatch: /sprint2-integration\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint3-messages',
      testMatch: /sprint3-messages\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint8-outbound',
      testMatch: /sprint8-outbound\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint9-sea-policy',
      testMatch: /sprint9-sea-policy\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint9-acquisition',
      testMatch: /sprint9-acquisition-attribution\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint9-funnel-gap',
      testMatch: /sprint9-funnel-gap\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint9-cod-mock',
      testMatch: /sprint9-cod-mock\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint4-analytics',
      testMatch: /sprint4-analytics\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint5-acquisition',
      testMatch: /sprint5-acquisition\.spec\.ts/,
      use: {
        baseURL: gatewayUrl,
      },
    },
    {
      name: 'sprint1-admin',
      testMatch: /sprint1-admin\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.ADMIN_BASE_URL || 'http://localhost:3001',
      },
    },
    {
      name: 'sprint1-operation',
      testMatch: /sprint1-operation\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.OPERATION_BASE_URL || 'http://localhost:3003',
      },
    },
    {
      name: 'sprint6-official',
      testMatch: /sprint6-official\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.OFFICIAL_BASE_URL || 'http://127.0.0.1:3010',
      },
    },
  ],
});
