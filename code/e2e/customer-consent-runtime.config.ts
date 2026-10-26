import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'customer-consent-runtime.spec.ts',timeout:30000,workers:1,reporter:'list',use:{baseURL:process.env.CUSTOMER_CONSENT_BASE_URL,headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'}});
