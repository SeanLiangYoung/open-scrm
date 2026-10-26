import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({testDir:'./tests',testMatch:'customer-consent.spec.ts',workers:1,timeout:10000,expect:{timeout:2000},reporter:'list',outputDir:'./test-results/customer-consent',use:{baseURL:'http://127.0.0.1:3114',headless:true},webServer:{command:'./node_modules/.bin/vite --host 127.0.0.1 --port 3114 --strictPort',cwd:resolve(__dirname,'../apps/operation-platform'),url:'http://127.0.0.1:3114',reuseExistingServer:false,timeout:30000}});
