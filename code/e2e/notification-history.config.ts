import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests', testMatch: 'notification-history.spec.ts', timeout: 10_000,
  expect: { timeout: 2_000 }, workers: 1, reporter: 'list', outputDir: './test-results/notification-history',
  use: { baseURL: 'http://127.0.0.1:3115', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3115 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'), url: 'http://127.0.0.1:3115',
    reuseExistingServer: false, timeout: 30_000
  }
});
