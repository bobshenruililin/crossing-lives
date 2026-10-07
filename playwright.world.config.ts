import { defineConfig } from '@playwright/test';

// Additive production-world gates. Run only in the authorized artifact-only CI.
// Local browser execution is blocked; do not weaken the Chrome sandbox to bypass it.
const channel = process.env.CROSSING_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined;
const executablePath = process.env.CROSSING_CHROMIUM_PATH;
const port = 4177;
export default defineConfig({
  testDir: './tests/world-browser',
  outputDir: './test-results/world',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/world/playwright-results.json' }],
    ['html', { outputFolder: 'playwright-report/world', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { chromiumSandbox: true, ...(executablePath ? { executablePath } : {}) },
  },
  projects: [{ name: 'world-production' }],
  webServer: {
    command: 'npm run export:world && npm run preview:world -- --port 4177 --strictPort',
    url: `http://127.0.0.1:${port}/world.html`,
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
