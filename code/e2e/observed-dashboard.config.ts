import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests', testMatch: 'observed-dashboard.spec.ts', timeout: 15_000, workers: 1, reporter: 'list',
  outputDir: './test-results/observed-dashboard',
  use: { baseURL: 'http://127.0.0.1:3116', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: './node_modules/.bin/vite --host 127.0.0.1 --port 3116 --strictPort',
    cwd: resolve(__dirname, '../apps/operation-platform'), url: 'http://127.0.0.1:3116', reuseExistingServer: false, timeout: 30_000 },
});
