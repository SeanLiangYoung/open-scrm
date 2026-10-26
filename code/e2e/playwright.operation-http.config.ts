import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'operation-http.spec.ts', timeout: 30_000,
  workers: 1, reporter: 'list',
  use: { baseURL: process.env.GATEWAY_URL, trace: 'retain-on-failure' },
});
