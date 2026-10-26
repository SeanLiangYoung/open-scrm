import { defineConfig } from '@playwright/test';

// Dedicated API-only verification; no shared project configuration changes.
export default defineConfig({
  testDir: './tests',
  testMatch: /customer-followup-http\.spec\.ts/,
  timeout: 90_000,
  retries: 0,
  workers: 1,
  forbidOnly: true,
  reporter: 'line',
  use: { trace: 'retain-on-failure' }
});
