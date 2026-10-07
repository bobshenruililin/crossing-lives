import { expect, type BrowserContext, type Page } from '@playwright/test';

type Event = { area: string; operation: string };
type Audit = { ready: boolean; events: Event[]; pending: Promise<unknown>[]; canaries: () => Record<string, string | null> };
const CANARIES = {
  'between-journal-v1': '{"version":1,"syntheticWorldIsolationCanary":"keep exact bytes: 香港 · 001"}',
  'crossing-decision-canary': '  prior decision bytes\nleave unchanged  ',
};

/** Isolated, synthetic context only. Native references are held by this test
 * instrumentation, not exposed to the application. This observes acquisitions
 * and prototype calls; it is not an exhaustive guarantee about final unload. */
export async function auditWorldStorage(context: BrowserContext) {
  const reports: (Event & { url: string })[] = [];
  await context.exposeBinding('__reportWorldStorage', ({ frame }, event: Event) => { reports.push({ ...event, url: frame.url() }); });
  await context.addInitScript(({ canaries }) => {
    const w = window as typeof window & { __worldStorageAudit: Audit; __reportWorldStorage: (event: Event) => Promise<unknown> };
    const nativeGet = Storage.prototype.getItem, nativeSet = Storage.prototype.setItem;
    // These are fresh browser contexts; none of the user's actual saves is opened.
    const local = window.localStorage, session = window.sessionStorage;
    for (const storage of [local, session]) for (const [key, value] of Object.entries(canaries)) {
      if (nativeGet.call(storage, key) === null) nativeSet.call(storage, key, value);
    }
    const audit: Audit = {
      ready: false, events: [], pending: [],
      canaries: () => Object.fromEntries([['localStorage', local], ['sessionStorage', session]].flatMap(([area, storage]) =>
        Object.keys(canaries).map(key => [`${area}:${key}`, nativeGet.call(storage as Storage, key)]))),
    };
    w.__worldStorageAudit = audit;
    const block = (area: string, operation: string): never => {
      const event = { area, operation }; audit.events.push(event);
      audit.pending.push(w.__reportWorldStorage(event).catch(() => undefined));
      throw new DOMException('World storage audit blocked access.', 'SecurityError');
    };
    for (const area of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
      Object.defineProperty(window, area, { configurable: true, get: () => block(area, 'acquire') });
    }
    for (const operation of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
      Object.defineProperty(Storage.prototype, operation, { configurable: true, writable: true, value: () => block('Storage', operation) });
    }
    Object.defineProperty(Storage.prototype, 'length', { configurable: true, get: () => block('Storage', 'length') });
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => block('cookie', 'read'), set: () => block('cookie', 'write') });
    audit.ready = true;
  }, { canaries: CANARIES });
  const expectedCanaries = Object.fromEntries(['localStorage', 'sessionStorage'].flatMap(area => Object.entries(CANARIES).map(([key, value]) => [`${area}:${key}`, value])));
  const read = (page: Page) => page.evaluate(async () => {
    const audit = (window as typeof window & { __worldStorageAudit: Audit }).__worldStorageAudit;
    await Promise.all(audit.pending);
    return { ready: audit.ready, events: audit.events, canaries: audit.canaries() };
  });
  return {
    reports,
    async expectZero(page: Page) {
      const result = await read(page);
      expect(result.ready).toBe(true);
      expect(result.events, 'The active world must not acquire any persistent/private storage.').toEqual([]);
      expect(reports, 'Host-side observations also include earlier active documents.').toEqual([]);
      expect(result.canaries, 'Exact synthetic prior-save bytes must be preserved.').toEqual(expectedCanaries);
    },
    async proveNegativeControl(page: Page) {
      const previous = (await read(page)).events.length;
      await page.evaluate(() => {
        for (const area of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
          try { Reflect.get(window, area); } catch { /* Deliberate attempt must be observed and blocked. */ }
        }
        try { Storage.prototype.getItem.call({} as Storage, 'between-journal-v1'); } catch { /* Prototype escape must be observed too. */ }
      });
      const result = await read(page);
      expect(result.events.slice(previous)).toEqual([
        ...['localStorage', 'sessionStorage', 'indexedDB', 'caches'].map(area => ({ area, operation: 'acquire' })),
        { area: 'Storage', operation: 'getItem' },
      ]);
      expect(reports.slice(-5).map(({ area, operation }) => ({ area, operation }))).toEqual(result.events.slice(previous));
      expect(result.canaries).toEqual(expectedCanaries);
    },
  };
}
