import { defineConfig } from '@playwright/test';

// One additive production capture. The original dev-server suite is unchanged.
const channel = process.env.CROSSING_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined;
const executablePath = process.env.CROSSING_CHROMIUM_PATH;
export default defineConfig({
  testDir: './tests/production',
  testMatch: 'scene-readiness.spec.ts',
  outputDir: './test-results/production-capture',
  fullyParallel: false,
  workers: 1,
  retries: 0, // A measurement must not silently select a faster retry.
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 30_000 }, // Functional failure guard, not a performance budget.
  reporter: [['list']], // Do not overwrite or duplicate the original HTML report.
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel,
    launchOptions: { chromiumSandbox: true, ...(executablePath ? { executablePath } : {}) },
  },
  projects: [{ name: 'production-mobile-profile' }],
  webServer: {
    command: 'npm run preview -- --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
