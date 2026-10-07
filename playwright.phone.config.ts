import { defineConfig } from '@playwright/test';

// Separate authorized CI gate; never a local-browser or sandbox workaround.
export default defineConfig({
  testDir: './tests/world-phone', testMatch: '**/*.spec.ts',
  outputDir: './test-results/world-phone', workers: 1, fullyParallel: false,
  retries: 0, forbidOnly: !!process.env.CI, timeout: 540_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'artifacts/world-phone/playwright-results.json' }],
    ['html', { outputFolder: 'playwright-report/world-phone', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4181', browserName: 'chromium',
    channel: process.env.CROSSING_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined,
    launchOptions: { chromiumSandbox: true }, screenshot: 'only-on-failure' },
  projects: [{ name: 'world-phone-touch' }],
  webServer: { command: 'npm run export:world && npm run preview:world -- --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181/world.html', reuseExistingServer: false, timeout: 90_000 },
});
