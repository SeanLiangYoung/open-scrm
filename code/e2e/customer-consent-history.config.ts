import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests',
  testMatch: 'customer-consent-history.spec.ts',
  workers: 1,
  timeout: 12_000,
  expect: { timeout: 1800 },
  reporter: 'list',
  outputDir: './test-results/customer-consent-history',
  use: { baseURL: 'http://127.0.0.1:3117', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3117 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'),
    url: 'http://127.0.0.1:3117',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
