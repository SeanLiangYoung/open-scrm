import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests', testMatch: 'notification-staff.spec.ts', timeout: 12_000,
  workers: 1, reporter: 'list', outputDir: './test-results/notification-staff',
  use: { baseURL: 'http://127.0.0.1:3112', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3112 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'), url: 'http://127.0.0.1:3112',
    reuseExistingServer: false, timeout: 30_000
  }
});
