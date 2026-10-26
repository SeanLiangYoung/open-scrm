import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests',
  testMatch: ['operation-contracts.spec.ts', 'operation-editor-boundaries.spec.ts'],
  timeout: 15_000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/operation-contracts',
  use: {
    baseURL: 'http://127.0.0.1:3103',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Shanghai'
  },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3103 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'),
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
