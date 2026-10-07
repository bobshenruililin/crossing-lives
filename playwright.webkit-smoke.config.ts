import { defineConfig } from '@playwright/test';
/** Linux WebKit smoke only; neither physical iPhone nor Safari certification. */
export default defineConfig({
  testDir: './tests/world-webkit', testMatch: '**/*.spec.ts', outputDir: './test-results/world-webkit',
  workers: 1, retries: 0, forbidOnly: !!process.env.CI, timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'artifacts/world-webkit/playwright-results.json' }]],
  use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, contextOptions: { screen: { width: 390, height: 844 } },
    hasTouch: true, isMobile: true, deviceScaleFactor: 1, offline: true, reducedMotion: 'no-preference', screenshot: 'only-on-failure' },
  projects: [{ name: 'linux-webkit-phone-smoke' }],
});
