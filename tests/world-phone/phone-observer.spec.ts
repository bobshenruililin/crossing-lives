import { test, expect } from '@playwright/test';
import { phoneAudit } from './phone-audit';

/** Independent short control context, without recording. Never runs inside the canonical film. */
test('native storage observer catches exact acquisition and getItem events on page and host', async ({ browser, baseURL }, info) => {
  test.setTimeout(30_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  const audit = await phoneAudit(context), page = await context.newPage();
  try {
    await page.goto('/world.html');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    const before = await audit.active(page);
    // This deliberately exercises the instrumented native API, not the app model.
    const actual = await page.evaluate(() => {
      const local = window.localStorage;
      const localValue = local.getItem('between-journal-v1'), localLength = local.length;
      const session = window.sessionStorage;
      return { localValue, localLength, sessionValue: session.getItem('between-journal-v1'), sessionLength: session.length };
    });
    expect(actual.localValue).toBe(before.canaries['localStorage:between-journal-v1']);
    expect(actual.sessionValue).toBe(before.canaries['sessionStorage:between-journal-v1']);
    expect(actual.localLength).toBe(2); expect(actual.sessionLength).toBe(2);
    const expected = [
      { area: 'localStorage', operation: 'acquire', url: page.url() },
      { area: 'Storage', operation: 'getItem', url: page.url() },
      { area: 'Storage', operation: 'length', url: page.url() },
      { area: 'sessionStorage', operation: 'acquire', url: page.url() },
      { area: 'Storage', operation: 'getItem', url: page.url() },
      { area: 'Storage', operation: 'length', url: page.url() },
    ];
    const after = await audit.snapshot(page);
    expect(after.events.length).toBe(6); expect(after.events).toEqual(expected);
    await expect.poll(() => audit.storage).toEqual(expected);
    expect(audit.storage.length).toBe(6); expect(after.canaries).toEqual(before.canaries);
    await info.attach('native-storage-observer-negative-control', { body: JSON.stringify({ pageEvents: after.events, hostEvents: audit.storage, syntheticCanariesUnchanged: true }), contentType: 'application/json' });
  } finally { await context.close(); }
});
