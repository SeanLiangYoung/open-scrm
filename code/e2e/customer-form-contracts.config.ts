import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests',
  testMatch: 'customer-form-contracts.spec.ts',
  timeout: 15_000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/customer-form-contracts',
  use: { baseURL: 'http://127.0.0.1:3105', headless: true },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3105 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'),
    url: 'http://127.0.0.1:3105',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
