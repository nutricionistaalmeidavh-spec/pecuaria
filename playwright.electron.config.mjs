import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e-electron',timeout:60000,workers:1,reporter:[['list'],['html',{outputFolder:'qa-artifacts/playwright-electron-report',open:'never'}]],use:{trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'}});
