import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', {open:'never'}]],
  use: {baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot:'only-on-failure', launchOptions: process.env.CROSSING_CHROMIUM_PATH ? {executablePath:process.env.CROSSING_CHROMIUM_PATH, chromiumSandbox:true} : {chromiumSandbox:true}},
  projects: [{name:'desktop',use:{...devices['Desktop Chrome']}}],
  webServer: {command:'npm run dev',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000},
});
