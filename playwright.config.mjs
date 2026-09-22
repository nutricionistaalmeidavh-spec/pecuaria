import {defineConfig} from '@playwright/test';

const requestedWorkers=Number(process.env.PLAYWRIGHT_WORKERS??'');
const workers=Number.isInteger(requestedWorkers)&&requestedWorkers>0?requestedWorkers:undefined;

export default defineConfig({
  testDir:'tests/e2e',
  workers,
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  webServer:{
    command:'npm run preview:web',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:true
  },
  reporter:[['list'],['html',{outputFolder:'qa-artifacts/playwright-report',open:'never'}]]
});