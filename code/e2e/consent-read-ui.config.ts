import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'consent-read-ui.spec.ts',timeout:30000,workers:1,reporter:'list',use:{baseURL:process.env.CONSENT_READ_UI_BASE_URL,headless:true,trace:'retain-on-failure',screenshot:'only-on-failure',viewport:{width:1600,height:1200}}});
