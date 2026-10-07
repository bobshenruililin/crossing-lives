import { expect, type BrowserContext, type Page } from '@playwright/test';
export type InputEventRecord = { type: string; trusted: boolean; pointerType: string | null; tag: string; label: string; at: number; mapNavigation: boolean };
type StorageEvent = { area: string; operation: string; url: string };
type ActiveAudit = { events: StorageEvent[]; canaries: () => Record<string, string | null> };
const CANARIES = { 'between-journal-v1': '{"version":1,"syntheticWorldIsolationCanary":"keep exact bytes: 香港 · 001"}', 'crossing-decision-canary': '  prior decision bytes\nleave unchanged  ' };
export async function phoneAudit(context: BrowserContext) {
  const inputs: InputEventRecord[] = [], storage: StorageEvent[] = [];
  await context.exposeBinding('__phoneInputObservation', (_source, event: InputEventRecord) => { inputs.push(event); });
  await context.exposeBinding('__phoneStorageObservation', (_source, event: StorageEvent) => { storage.push(event); });
  await context.addInitScript(({ canaries }) => {
    if (location.pathname !== '/world.html') return; // Do not seed any internal storage-state inspection document.
    const w = window as typeof window & { __phoneInputObservation: (event: InputEventRecord) => Promise<void>; __phoneStorageObservation: (event: StorageEvent) => Promise<void>; __phoneAudit: ActiveAudit };
    const nativeGet = Storage.prototype.getItem, nativeSet = Storage.prototype.setItem;
    const local = window.localStorage, session = window.sessionStorage;
    // Synthetic predecessor-save bytes only. No world keys, choices, routes or player state.
    for (const item of [local, session]) for (const [key, value] of Object.entries(canaries)) nativeSet.call(item, key, value);
    const audit: ActiveAudit = { events: [], canaries: () => Object.fromEntries([['localStorage', local], ['sessionStorage', session]].flatMap(([area, target]) => Object.keys(canaries).map(key => [`${area}:${key}`, nativeGet.call(target as Storage, key)]))) };
    w.__phoneAudit = audit;
    const observe = (area: string, operation: string) => {
      const event = { area, operation, url: location.href }; audit.events.push(event);
      void w.__phoneStorageObservation(event).catch(() => undefined);
    };
    // Passive delegates preserve native storage behavior; any observed app access fails the test.
    for (const area of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
      let owner: object | null = window, descriptor: PropertyDescriptor | undefined;
      while (owner && !descriptor) { descriptor = Object.getOwnPropertyDescriptor(owner, area); owner = Object.getPrototypeOf(owner); }
      if (!descriptor?.get) continue;
      const get = descriptor.get;
      Object.defineProperty(window, area, { configurable: true, get() { observe(area, 'acquire'); return get.call(window); } });
    }
    for (const operation of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
      const native = Storage.prototype[operation];
      Object.defineProperty(Storage.prototype, operation, { configurable: true, writable: true, value: function (this: Storage, ...args: unknown[]) { observe('Storage', operation); return Reflect.apply(native, this, args); } });
    }
    const length = Object.getOwnPropertyDescriptor(Storage.prototype, 'length');
    if (length?.get) Object.defineProperty(Storage.prototype, 'length', { configurable: true, get() { observe('Storage', 'length'); return length.get!.call(this); } });
    let owner: object | null = document, cookie: PropertyDescriptor | undefined;
    while (owner && !cookie) { cookie = Object.getOwnPropertyDescriptor(owner, 'cookie'); owner = Object.getPrototypeOf(owner); }
    if (cookie?.get && cookie?.set) {
      const nativeCookie = cookie;
      Object.defineProperty(document, 'cookie', { configurable: true, get() { observe('cookie', 'read'); return nativeCookie.get!.call(document); }, set(value: string) { observe('cookie', 'write'); nativeCookie.set!.call(document, value); } });
    }
    for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'input', 'change', 'keydown', 'click']) {
      document.addEventListener(type, event => {
        const target = event.target instanceof Element ? event.target : null;
        const record: InputEventRecord = { type: event.type, trusted: event.isTrusted, pointerType: event instanceof PointerEvent ? event.pointerType : null, tag: target?.tagName ?? '', label: target?.getAttribute('aria-label') ?? target?.getAttribute('data-testid') ?? target?.textContent?.slice(0, 180) ?? '', at: performance.now(), mapNavigation: event.type === 'click' && !!target?.closest('.world-map-canvas button') };
        void w.__phoneInputObservation(record).catch(() => undefined);
      }, { capture: true, passive: true });
    }
  }, { canaries: CANARIES });
  const expected = Object.fromEntries(['localStorage', 'sessionStorage'].flatMap(area => Object.entries(CANARIES).map(([key, value]) => [`${area}:${key}`, value])));
  const snapshot = async (page: Page) => page.evaluate(() => { const audit = (window as typeof window & { __phoneAudit: ActiveAudit }).__phoneAudit; return { events: audit.events, canaries: audit.canaries() }; });
  return { inputs, storage, snapshot,
    async active(page: Page) {
      const result = await snapshot(page);
      expect(result.events, 'No app storage acquisitions/operations observed during the active document').toEqual([]);
      expect(storage).toEqual([]); expect(result.canaries).toEqual(expected); return result;
    },
    async durableAfterPageClose() {
      const state = await context.storageState();
      expect(state.cookies).toEqual([]);
      const values = state.origins.flatMap(origin => origin.localStorage);
      expect(values.length).toBe(Object.keys(CANARIES).length);
      for (const [name, value] of Object.entries(CANARIES)) expect(values.find(item => item.name === name)?.value).toBe(value);
      return { cookies: state.cookies, origins: state.origins, scope: 'Durable localStorage bytes after page close; sessionStorage and zero unload-time acquisition are not claimed.' };
    },
  };
}
