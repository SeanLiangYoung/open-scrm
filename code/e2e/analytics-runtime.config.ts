import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'analytics-runtime.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'line',
  use: { baseURL: process.env.GATEWAY_URL || 'http://127.0.0.1:17000' },
});
