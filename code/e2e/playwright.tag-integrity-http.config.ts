import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'tag-integrity-http.spec.ts',timeout:30_000,workers:1,reporter:'list',
 use:{baseURL:process.env.TAG_INTEGRITY_UI_BASE_URL,headless:true,timezoneId:'Asia/Shanghai',trace:'retain-on-failure',screenshot:'only-on-failure',viewport:{width:1440,height:1000}}});
