import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests',
  testMatch: 'mass-task-contracts.spec.ts',
  timeout: 15_000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/mass-task-contracts',
  use: { baseURL: 'http://127.0.0.1:3104', headless: true },
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 3104 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'),
    url: 'http://127.0.0.1:3104',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
