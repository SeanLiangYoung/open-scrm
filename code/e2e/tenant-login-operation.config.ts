import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  metadata: { loginApp: 'operation' },
  testDir: './tests',
  testMatch: 'tenant-login-contracts.spec.ts',
  timeout: 15_000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/tenant-login-operation',
  use: { baseURL: 'http://127.0.0.1:3108', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3108 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'),
    url: 'http://127.0.0.1:3108',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
