/** Verify the official runner Chrome and its actual runtime dependencies without
 * changing sandbox or host security policy. This runs only in authorized CI. */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, timeout: 20_000 });
try {
  const page = await browser.newPage();
  await page.goto('about:blank', { timeout: 10_000 });
  console.log(`Sandboxed installed Chrome is usable: ${browser.version()}`);
} finally {
  await browser.close();
}
