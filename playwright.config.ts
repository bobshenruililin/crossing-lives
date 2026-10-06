import { defineConfig, devices } from '@playwright/test';

// CI uses the runner's installed Chrome stable, covered by Ubuntu's existing
// AppArmor profile. No sandbox or operating-system security feature is disabled.
const channel = process.env.CROSSING_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined;
const executablePath = process.env.CROSSING_CHROMIUM_PATH;
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { chromiumSandbox: true, ...(executablePath ? { executablePath } : {}) },
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
