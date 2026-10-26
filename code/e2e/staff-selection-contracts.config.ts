import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests',
  testMatch: 'staff-selection-contracts.spec.ts',
  timeout: 20_000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/staff-selection-contracts',
  use: { baseURL: 'http://127.0.0.1:3106', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3106 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'),
    url: 'http://127.0.0.1:3106',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
