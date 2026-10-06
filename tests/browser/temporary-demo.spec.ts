import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { legacyCompletedStory, seedLegacyPlanner, seedStory } from './story-fixtures';
import {
  chooseDinner, chooseWalk, cityPreview, closeDialogue, depart, dialogue, expectHomeScene,
  expectNoClippedText, expectNoOverflow, expectPhase, expectSceneAssets, expectTouchTarget,
  expectUnscrolledDialogueActions, openAction, openOptions, openPlanner, openResearch,
  readStorySave, returnHome, showcase, startStory, storyClock,
} from './story-helpers';

const label = 'Temporary demo · changes won’t be saved';
const guidance = 'Close this tab when you’re done. Reloading starts over.';
const normalTitle = 'Between · One evening, two possibilities';
const temporaryTitle = 'Between · Temporary demo';
type StorageEvent = { kind: string; area: string; operation?: string };

/** Installed before the popup exists. It never acquires a Storage object itself.
 * Reports are checked while each document is active. Playwright can drop binding
 * calls during unload/close; original bytes are checked separately after close. */
async function auditTemporaryStorage(context: BrowserContext, throwOnTouch = false, blockOperations = false) {
  const events: Array<StorageEvent & { url: string }> = [];
  await context.exposeBinding('__reportTemporaryStorage', ({ frame }, event: StorageEvent) => { events.push({ ...event, url: frame.url() }); });
  await context.addInitScript(({ throwOnTouch, blockOperations }) => {
    if (new URLSearchParams(location.search).get('temporary-demo') !== '1') return;
    const auditWindow = window as typeof window & {
      __temporaryStorageAudit: { ready: boolean; events: { kind: string; area: string; operation?: string }[]; pending: Promise<unknown>[] };
      __reportTemporaryStorage: (event: { kind: string; area: string; operation?: string }) => Promise<unknown>;
    };
    const audit = { ready: false, events: [] as { kind: string; area: string; operation?: string }[], pending: [] as Promise<unknown>[] };
    auditWindow.__temporaryStorageAudit = audit;
    const areas = new WeakMap<Storage, string>();
    const record = (event: { kind: string; area: string; operation?: string }) => {
      audit.events.push(event);
      audit.pending.push(auditWindow.__reportTemporaryStorage(event).catch(() => undefined));
    };
    for (const area of ['localStorage', 'sessionStorage']) {
      let owner: object | null = window;
      let descriptor: PropertyDescriptor | undefined;
      while (owner && !descriptor) { descriptor = Object.getOwnPropertyDescriptor(owner, area); owner = Object.getPrototypeOf(owner); }
      if (!descriptor?.get) throw new Error(`Cannot instrument ${area} acquisition`);
      const nativeGet = descriptor.get;
      Object.defineProperty(window, area, { configurable: true, enumerable: descriptor.enumerable, get() {
        record({ kind: 'acquire', area });
        if (throwOnTouch) throw new DOMException('Test storage is unavailable', 'SecurityError');
        const storage = nativeGet.call(window) as Storage;
        areas.set(storage, area);
        return storage;
      } });
    }
    for (const operation of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
      const original = Storage.prototype[operation];
      Object.defineProperty(Storage.prototype, operation, { configurable: true, writable: true, value: function (this: Storage, ...args: unknown[]) {
        record({ kind: 'operation', area: areas.get(this) ?? 'unknown-storage', operation });
        if (blockOperations) throw new DOMException('Audit negative-control blocked native storage operation', 'SecurityError');
        return Reflect.apply(original, this, args);
      } });
    }
    const nativeLength = Object.getOwnPropertyDescriptor(Storage.prototype, 'length')!.get!;
    Object.defineProperty(Storage.prototype, 'length', { configurable: true, get: function (this: Storage) {
      record({ kind: 'operation', area: areas.get(this) ?? 'unknown-storage', operation: 'length' });
      if (blockOperations) throw new DOMException('Audit negative-control blocked native storage operation', 'SecurityError');
      return nativeLength.call(this);
    } });
    audit.ready = true;
  }, { throwOnTouch, blockOperations });
  return {
    events,
    async expectZero(demo: Page) {
      const report = await demo.evaluate(async () => {
        const audit = (window as typeof window & { __temporaryStorageAudit: { ready: boolean; events: unknown[]; pending: Promise<unknown>[] } }).__temporaryStorageAudit;
        await Promise.all(audit.pending);
        return { ready: audit.ready, events: audit.events };
      });
      expect(report.ready, 'The storage audit must run before application boot.').toBe(true);
      expect(report.events, 'Temporary pages must never acquire or operate on either storage area.').toEqual([]);
      expect(events, 'The host log retains reports delivered while documents are active.').toEqual([]);
    },
  };
}

/** Only call on the original normal page, never on a temporary page. */
const originalBytes = (original: Page) => original.evaluate(() => {
  const entries = (storage: Storage) => Object.keys(storage).sort().map(key => [key, storage.getItem(key)]);
  return { local: entries(localStorage), session: entries(sessionStorage) };
});

async function launchFromRealLink(original: Page) {
  await expect(original).toHaveTitle(normalTitle);
  await openOptions(original);
  const link = original.getByRole('link', { name: 'Start temporary demo', exact: true });
  await expectTouchTarget(link);
  await expect(link).toHaveAttribute('id', 'start-temporary-demo');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
  await expect(link).toHaveAttribute('rel', /\bnoreferrer\b/);
  await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(link).toHaveAttribute('aria-describedby', 'temporary-demo-opening-note');
  await expect(original.locator('#temporary-demo-opening-note')).toBeVisible();
  await expect(original.locator('#temporary-demo-opening-note')).toContainText('use the link’s browser menu to open it in a new tab');
  const from = new URL(original.url());
  const destination = new URL((await link.getAttribute('href'))!);
  expect(destination.origin).toBe(from.origin);
  expect(destination.pathname).toBe(from.pathname);
  expect(destination.search).toBe('?temporary-demo=1');
  expect(destination.hash).toBe('');
  const opening = original.context().waitForEvent('page');
  await link.click();
  const demo = await opening;
  await demo.waitForLoadState('domcontentloaded');
  await expect(demo).toHaveURL(destination.href);
  await expect(original).toHaveURL(from.href);
  await expect(demo).toHaveTitle(temporaryTitle);
  await expect(original).toHaveTitle(normalTitle);
  expect(await demo.evaluate(() => window.opener === null)).toBe(true);
  expect(await demo.evaluate(() => document.referrer)).toBe('');
  return demo;
}

async function expectTemporaryNotice(page: Page, inDialogue = false) {
  const notice = inDialogue ? dialogue(page).locator('.temporary-demo-dialogue-note') : page.locator('.temporary-demo-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(label);
  await expect(notice.locator('small')).toHaveText(guidance);
  await expect(page.locator('[data-temporary-demo="true"]').first()).toBeVisible();
  const sizes = await notice.evaluate(element => [element, ...element.querySelectorAll('p,small')].map(node => Number.parseFloat(getComputedStyle(node).fontSize)));
  expect(Math.min(...sizes), 'Temporary-mode labels remain readable.').toBeGreaterThanOrEqual(12);
  await expectNoClippedText(notice); await expectNoOverflow(page);
}

async function expectFreshDemo(demo: Page) {
  await expect(demo).toHaveTitle(temporaryTitle);
  await expectPhase(demo, 'fork');
  await expect(storyClock(demo)).toHaveText('16:30');
  await expect(dialogue(demo).getByRole('heading', { name: 'Dinner, then a walk?', exact: true })).toBeFocused();
  await expectTemporaryNotice(demo, true);
  await expectUnscrolledDialogueActions(demo, ['Let’s stay nearby.', 'Let’s cross for dinner.', 'Look around first', 'Return to the scene']);
  await expectSceneAssets(demo, 'hong-kong-evening.webp');
}

async function resetTemporaryStory(demo: Page) {
  await openOptions(demo);
  await demo.getByRole('button', { name: 'Start a fresh evening', exact: true }).click();
  await expect(dialogue(demo)).toContainText('This resets both story attempts in this temporary demo. Your temporary planner and saved evening stay as they are.');
  await expectTemporaryNotice(demo, true);
  await demo.getByRole('button', { name: 'Start a fresh story', exact: true }).click();
  await expectFreshDemo(demo);
}

async function resetTemporaryEverything(demo: Page) {
  await openPlanner(demo);
  await demo.getByRole('button', { name: 'Replay the story', exact: true }).click();
  await expect(dialogue(demo)).toContainText('This resets only this temporary demo’s story and planner. Your saved evening stays as it is.');
  await expectTemporaryNotice(demo, true);
  await demo.getByRole('button', { name: 'Reset and replay', exact: true }).click();
  await expectFreshDemo(demo);
}

test('active-page storage audit detects intentional blocked acquisitions and method attempts', async ({ page: original, context }) => {
  await original.goto('/'); await startStory(original);
  await original.evaluate(() => {
    localStorage.setItem('audit-control-local', 'This must survive every probe.');
    sessionStorage.setItem('audit-control-session', 'This must survive every probe too.');
  });
  const before = await originalBytes(original);
  const audit = await auditTemporaryStorage(context, true, true);
  const demo = await launchFromRealLink(original);
  try {
    await expectFreshDemo(demo); await audit.expectZero(demo);
    // This isolated negative control intentionally probes the monitor. Getters
    // throw before native acquisition; method/length wrappers throw before
    // invoking a native operation, so the probes cannot read or alter data.
    const report = await demo.evaluate(async () => {
      const failures: string[] = [];
      const attempt = (action: () => unknown) => {
        try { action(); failures.push('Unexpected success'); }
        catch (error) { failures.push(error instanceof DOMException ? `${error.name}: ${error.message}` : String(error)); }
      };
      for (const area of ['localStorage', 'sessionStorage']) attempt(() => Reflect.get(window, area));
      const receiver = Object.create(Storage.prototype) as Storage;
      const attempts = [
        ['getItem', ['audit-canary']], ['setItem', ['audit-canary', 'must not be written']],
        ['removeItem', ['audit-canary']], ['clear', []], ['key', [0]],
      ] as const;
      for (const [operation, args] of attempts) attempt(() => Reflect.apply(Storage.prototype[operation], receiver, args));
      attempt(() => receiver.length);
      const audit = (window as typeof window & { __temporaryStorageAudit: { events: unknown[]; pending: Promise<unknown>[] } }).__temporaryStorageAudit;
      await Promise.all(audit.pending);
      return { failures, events: audit.events };
    });
    const expected: StorageEvent[] = [
      { kind: 'acquire', area: 'localStorage' }, { kind: 'acquire', area: 'sessionStorage' },
      ...['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length'].map(operation => ({ kind: 'operation', area: 'unknown-storage', operation })),
    ];
    expect(report.events).toEqual(expected);
    expect(audit.events.map(({ url: _url, ...event }) => event)).toEqual(expected);
    expect(report.failures).toEqual([
      ...Array(2).fill('SecurityError: Test storage is unavailable'),
      ...Array(6).fill('SecurityError: Audit negative-control blocked native storage operation'),
    ]);
    expect(await originalBytes(original)).toEqual(before);
    await demo.close();
    await expect(original).toHaveTitle(normalTitle);
    // This post-close assertion covers durable data preservation, not exhaustive
    // observation of reads/acquisitions during the unload/close interval.
    expect(await originalBytes(original)).toEqual(before);
  } finally { if (!demo.isClosed()) await demo.close(); }
});

for (const width of [360, 390]) {
  test.describe(`temporary demo at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });
    test('new tab ignores personal storage through import, research, both resets and reload', async ({ page: original, context }) => {
      test.setTimeout(120_000);
      const saved = legacyCompletedStory({ note: 'Mock personal story detail stays only in the normal evening.' });
      const plan = await seedLegacyPlanner(original, 'Mock personal planner detail stays only in the normal evening.');
      await seedStory(original, saved);
      await original.addInitScript(() => {
        localStorage.setItem('personal-unrelated-local', 'Original local sentinel');
        sessionStorage.setItem('personal-unrelated-session', 'Original session sentinel');
      });
      await original.goto('/?audience=unused&keep=personal#normal-evening');
      await startStory(original); await openPlanner(original);
      await original.getByLabel('Budget per person').fill('777');
      await original.getByRole('button', { name: 'One more person', exact: true }).click();
      await startStory(original);
      const audit = await auditTemporaryStorage(context, width === 360);
      const before = await originalBytes(original);
      const demo = await launchFromRealLink(original);
      try {
        await expectFreshDemo(demo); await audit.expectZero(demo);
        await expect(demo.locator('body')).not.toContainText(saved.currentAttempt.journalNote);
        await expect(demo.locator('body')).not.toContainText(plan.notes);
        await showcase(demo, `temporary-invitation-${width}`);
        if (width === 390) {
          const result = await new AxeBuilder({ page: demo }).analyze();
          expect(result.violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
        }
        await demo.getByRole('button', { name: 'Look around first', exact: true }).click();
        await expectTemporaryNotice(demo);
        for (const city of ['Hong Kong', 'Shenzhen'] as const) {
          await expectTouchTarget(cityPreview(demo, city));
          await expect(cityPreview(demo, city)).toBeInViewport({ ratio: 1 });
        }
        await showcase(demo, `temporary-world-${width}`);
        await openOptions(demo); await expectTemporaryNotice(demo, true);
        await expect(demo.getByRole('link', { name: 'Start temporary demo', exact: true })).toHaveCount(0);
        await demo.locator('.story-setup > summary').click();
        await expect(demo.locator('.story-setup > p').first()).toContainText('Room to wander · 16:30–23:30 · allowance HK$400.00/person');
        await expect(demo.getByRole('checkbox', { name: 'Include one fictional 30-minute dinner delay', exact: true })).toBeChecked();
        await showcase(demo, `temporary-options-${width}`);
        await closeDialogue(demo); await cityPreview(demo, 'Shenzhen').click();
        await openAction(demo, 'Open phone');
        await expectTemporaryNotice(demo, true);
        await expect(demo.locator('.route-note-forecast')).toContainText('modeled home 22:15');
        await demo.getByRole('button', { name: 'Change route', exact: true }).click();
        await demo.getByRole('radio', { name: 'Bus via Lok Ma Chau road crossing', exact: true }).check();
        await demo.getByRole('radio', { name: 'Rail via Lo Wu', exact: true }).check();
        await expect(storyClock(demo)).toHaveText('16:30');
        await closeDialogue(demo); await depart(demo, 'Shenzhen');
        await expectUnscrolledDialogueActions(demo, ['Read the menu', 'Return to the scene']);
        await chooseDinner(demo, 'simple'); await chooseWalk(demo, 'short'); await returnHome(demo);
        await expectHomeScene(demo); await expect(storyClock(demo)).toHaveText('21:45');
        await audit.expectZero(demo); expect(await originalBytes(original)).toEqual(before);

        // A real edit in the original while the demo is open rules out a later
        // backup/restore scheme that could silently overwrite newer user work.
        await closeDialogue(original); await openPlanner(original);
        await original.getByLabel('Budget per person').fill('888');
        await expect.poll(() => original.evaluate(() => JSON.parse(localStorage.getItem('between-journal-v1')!).inputs.budgetPerPersonHKD)).toBe(888);
        const latest = await originalBytes(original);
        await openPlanner(demo, true); await expectTemporaryNotice(demo);
        await expect(demo.getByLabel('Budget per person')).toHaveValue('400');
        await expect(demo.locator('.party-field output')).toHaveText('2');
        await expect(demo.getByLabel('Leave at', { exact: true })).toHaveValue('16:30');
        await showcase(demo, `temporary-planner-${width}`);
        await demo.getByLabel('Budget per person').fill('900');
        await demo.getByRole('button', { name: 'One more person', exact: true }).click();
        await openResearch(demo); await expectTemporaryNotice(demo);
        await expect(demo.getByRole('heading', { name: 'What do we actually know?', exact: true })).toBeFocused();
        await showcase(demo, `temporary-research-${width}`);
        await demo.getByRole('button', { name: 'Return to your evening', exact: true }).click();
        await expect(demo.getByLabel('Budget per person')).toHaveValue('900');
        await expect(demo.locator('.party-field output')).toHaveText('3');
        await startStory(demo); await expect(storyClock(demo)).toHaveText('21:45');
        await resetTemporaryStory(demo);
        await openPlanner(demo);
        await expect(demo.getByLabel('Budget per person')).toHaveValue('900');
        await expect(demo.locator('.party-field output')).toHaveText('3');
        await resetTemporaryEverything(demo);
        await openPlanner(demo);
        await expect(demo.getByLabel('Budget per person')).toHaveValue('400');
        await expect(demo.locator('.party-field output')).toHaveText('2');
        await demo.getByLabel('Budget per person').fill('950');
        await openOptions(demo); await demo.locator('.story-setup > summary').click();
        await demo.getByRole('button', { name: /^A short evening/ }).click();
        await closeDialogue(demo); await expect(storyClock(demo)).toHaveText('17:00');
        await audit.expectZero(demo); expect(await originalBytes(original)).toEqual(latest);
        await demo.reload(); await expectFreshDemo(demo); await audit.expectZero(demo);
        await openAction(demo, 'Open wallet');
        await expect(dialogue(demo).locator('.pocket-facts dd')).toHaveText(['HK$400.00', 'HK$304.00', 'HK$260.22']);
        await audit.expectZero(demo); expect(await originalBytes(original)).toEqual(latest);
        await demo.close();
        await expect(original).toHaveTitle(normalTitle);
        expect(original.isClosed()).toBe(false);
        await expect(original.getByLabel('Budget per person')).toHaveValue('888');
        await expect(original.locator('.party-field output')).toHaveText('3');
        expect(await originalBytes(original)).toEqual(latest);
        await startStory(original); await expectHomeScene(original);
        await expect(storyClock(original)).toHaveText('19:45');
        expect(await readStorySave(original)).toEqual(saved);
      } finally { if (!demo.isClosed()) await demo.close(); }
    });
  });
}

for (const [kind, raw] of [
  ['corrupt', '{not valid JSON'], ['future', JSON.stringify({ version: 999, note: 'Mock future bytes remain untouched.' })], ['empty', ''],
] as const) {
  test(`temporary demo leaves ${kind} original saves intact without even inspecting storage`, async ({ page: original, context }) => {
    test.setTimeout(60_000);
    await original.addInitScript(value => {
      localStorage.setItem('between-playable-v2', value);
      localStorage.setItem('between-journal-v1', value);
      sessionStorage.setItem('personal-session', 'Keep me too');
    }, raw);
    await original.goto('/?unrelated=discard#keep-original'); await startStory(original);
    const audit = await auditTemporaryStorage(context);
    const before = await originalBytes(original);
    const demo = await launchFromRealLink(original);
    try {
      await expectFreshDemo(demo);
      await depart(demo, 'Hong Kong'); await chooseDinner(demo, 'simple');
      await resetTemporaryStory(demo);
      await resetTemporaryEverything(demo);
      await audit.expectZero(demo);
      await demo.reload(); await expectFreshDemo(demo); await audit.expectZero(demo);
      await demo.close();
      await expect(original).toHaveTitle(normalTitle);
      expect(await originalBytes(original)).toEqual(before);
      await expect(dialogue(original)).toContainText('The original saved data is untouched');
    } finally { if (!demo.isClosed()) await demo.close(); }
  });
}

test('temporary tab also leaves a blocked-storage original’s unsaved story and plan alive', async ({ page: original, context }) => {
  test.setTimeout(90_000);
  await original.setViewportSize({ width: 390, height: 844 });
  await original.addInitScript(() => {
    for (const area of ['localStorage', 'sessionStorage']) Object.defineProperty(window, area, { configurable: true, get() { throw new DOMException('Original storage blocked', 'SecurityError'); } });
  });
  await original.goto('/'); await startStory(original); await openPlanner(original);
  await original.getByLabel('Budget per person').fill('777');
  await original.getByRole('button', { name: 'One more person', exact: true }).click();
  await startStory(original); await depart(original, 'Hong Kong'); await chooseDinner(original, 'simple'); await chooseWalk(original, 'short'); await returnHome(original);
  const audit = await auditTemporaryStorage(context, true);
  const demo = await launchFromRealLink(original);
  try {
    await demo.setViewportSize({ width: 390, height: 844 });
    await expectFreshDemo(demo); await depart(demo, 'Shenzhen'); await chooseDinner(demo, 'simple'); await chooseWalk(demo, 'long'); await returnHome(demo);
    await openPlanner(demo, true); await demo.getByLabel('Budget per person').fill('999');
    await openPlanner(original); await expect(original.getByLabel('Budget per person')).toHaveValue('777');
    await original.getByLabel('Budget per person').fill('888');
    await resetTemporaryEverything(demo); await audit.expectZero(demo);
    await demo.close();
    await expect(original).toHaveTitle(normalTitle);
    await expect(original.getByLabel('Budget per person')).toHaveValue('888');
    await expect(original.locator('.party-field output')).toHaveText('3');
    await expect(original.locator('.storage-notice')).toContainText('Saving is unavailable');
    await startStory(original); await expectHomeScene(original);
    await expect(storyClock(original)).toHaveText('18:45');
    await openAction(original, 'Open wallet');
    await expect(dialogue(original).locator('.pocket-facts dd')).toHaveText(['HK$400.00', 'HK$304.00']);
  } finally { if (!demo.isClosed()) await demo.close(); }
});
