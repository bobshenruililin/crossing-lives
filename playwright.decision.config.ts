import { defineConfig } from '@playwright/test';

// Additive decision-entry verification. Never changes the existing story suite.
// Real execution is authorized only in the private Ubuntu artifact-only CI job.
const channel = process.env.CROSSING_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined;
const executablePath = process.env.CROSSING_CHROMIUM_PATH;
const port = 4175;
export default defineConfig({
  testDir: './tests/decision-browser',
  outputDir: './test-results/decision',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/decision', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { chromiumSandbox: true, ...(executablePath ? { executablePath } : {}) },
  },
  projects: [{ name: 'decision-production' }],
  webServer: {
    command: 'npm run preview:decision -- --port 4175 --strictPort',
    url: `http://127.0.0.1:${port}/decision.html`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
