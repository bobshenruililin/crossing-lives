import { defineConfig } from '@playwright/test';
/** Independent diagnosis: this never changes the existing offline-file smoke result. */
export default defineConfig({
  testDir: './tests/world-webkit-diagnostics', testMatch: '**/*.spec.ts',
  outputDir: './test-results/world-webkit/diagnostics', workers: 1, retries: 0,
  forbidOnly: !!process.env.CI, timeout: 60_000, expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'artifacts/world-webkit/diagnostics/playwright-results.json' }]],
  use: { browserName: 'webkit', baseURL: 'http://127.0.0.1:4183', viewport: { width: 390, height: 844 },
    contextOptions: { screen: { width: 390, height: 844 } }, hasTouch: true, isMobile: true,
    deviceScaleFactor: 1, offline: false, reducedMotion: 'no-preference', screenshot: 'only-on-failure' },
  projects: [{ name: 'linux-webkit-navigation-diagnostics' }],
  webServer: { command: 'node scripts/serve-webkit-diagnostic.mjs', url: 'http://127.0.0.1:4183/__diagnostic-ready', reuseExistingServer: false, timeout: 30_000 },
});
