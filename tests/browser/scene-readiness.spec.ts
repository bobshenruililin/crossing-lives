import { test, expect, type ElementHandle, type Page } from '@playwright/test';
import {
  chooseDinner, chooseWalk, cityPreview, closeDialogue, depart, dialogue,
  expectNoClippedText, expectPhase, expectUnscrolledDialogueActions, openAction,
  readStorySave, showcase, startStory, storyClock,
} from './story-helpers';

const world = (page: Page) => page.locator('.play-world');
const visibleImage = (page: Page) => world(page).locator('img[data-scene-layer="visible"]');
const pendingImage = (page: Page) => world(page).locator('img[data-scene-layer="pending"]');

type DecodeEntry = { id: number; asset: string; nativeDecoded: boolean; settled: 'pending' | 'fulfilled' | 'rejected' };

/** Isolated ordering probe only. Native decoding still runs; this holds the
 * promise returned to the app. Never install it in the production capture. */
async function controlDecode(page: Page, assets: string[]) {
  await page.addInitScript(names => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    const entries: { id: number; asset: string; nativeDecoded: boolean; settled: 'pending' | 'fulfilled' | 'rejected'; release: (outcome: 'resolve' | 'reject') => void }[] = [];
    const policy = new Map<string, 'resolve' | 'reject'>();
    const gate = {
      entries,
      release(asset: string, outcome: 'resolve' | 'reject') {
        policy.set(asset, outcome);
        for (const entry of entries) if (entry.asset === asset && entry.settled === 'pending') entry.release(outcome);
      },
    };
    (window as typeof window & { __sceneDecodeGate: typeof gate }).__sceneDecodeGate = gate;
    HTMLImageElement.prototype.decode = async function () {
      const asset = new URL(this.currentSrc || this.src, location.href).pathname.split('/').pop()!;
      if (!names.includes(asset)) return nativeDecode.call(this);
      let release!: (outcome: 'resolve' | 'reject') => void;
      const held = new Promise<'resolve' | 'reject'>(resolve => { release = resolve; });
      const entry = { id: entries.length, asset, nativeDecoded: false, settled: 'pending' as 'pending' | 'fulfilled' | 'rejected', release };
      entries.push(entry);
      if (policy.has(asset)) release(policy.get(asset)!);
      try {
        await nativeDecode.call(this);
        entry.nativeDecoded = true;
        if (await held === 'reject') throw new DOMException('Controlled readiness decode failure', 'EncodingError');
        entry.settled = 'fulfilled';
      } catch (error) {
        entry.settled = 'rejected';
        throw error;
      }
    };
  }, assets);
}

const decodeEntries = (page: Page): Promise<DecodeEntry[]> => page.evaluate(() =>
  (window as typeof window & { __sceneDecodeGate: { entries: DecodeEntry[] } }).__sceneDecodeGate.entries
    .map(({ id, asset, nativeDecoded, settled }) => ({ id, asset, nativeDecoded, settled })));

async function releaseDecode(page: Page, asset: string, outcome: 'resolve' | 'reject' = 'resolve') {
  await page.evaluate(({ asset, outcome }) => {
    (window as typeof window & { __sceneDecodeGate: { release: (asset: string, outcome: 'resolve' | 'reject') => void } }).__sceneDecodeGate.release(asset, outcome);
  }, { asset, outcome });
  await expect.poll(async () => {
    const entries = (await decodeEntries(page)).filter(entry => entry.asset === asset);
    return entries.length > 0 && entries.every(entry => entry.settled !== 'pending');
  }).toBe(true);
}

async function waitForHeldDecode(page: Page, asset: string) {
  await expect.poll(async () => (await decodeEntries(page)).some(entry => entry.asset === asset && entry.nativeDecoded && entry.settled === 'pending')).toBe(true);
}

/** Canvas verifies real decoded image data, not a placeholder or complete flag.
 * It does not establish compositor paint; the unchanged real film is that evidence. */
async function decodedBitmap(image: ElementHandle<HTMLImageElement>) {
  return image.evaluate(element => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.drawImage(element, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    const colors = new Set<string>();
    let hash = 2166136261, opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 255) opaque += 1;
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`);
    }
    for (const value of pixels) hash = Math.imul(hash ^ value, 16777619) >>> 0;
    let nonzeroOpacity = true;
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (Number.parseFloat(getComputedStyle(node).opacity) === 0) nonzeroOpacity = false;
    }
    const box = element.getBoundingClientRect();
    return { hash, opaque, colors: colors.size, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight,
      connected: element.isConnected, currentVisibleNode: element === document.querySelector('.play-world img[data-scene-layer="visible"]'),
      nonzeroOpacity, width: box.width, height: box.height, src: element.currentSrc };
  });
}

async function expectReady(page: Page, asset: string) {
  await expect(world(page)).toHaveAttribute('data-scene-requested', asset);
  await expect(world(page)).toHaveAttribute('data-scene-state', 'ready');
  await expect(world(page)).toHaveAttribute('aria-busy', 'false');
  await expect(world(page)).toHaveAttribute('data-scene-visible', asset);
  await expect(visibleImage(page)).toHaveCount(1);
  await expect(visibleImage(page)).toBeVisible();
  await expect(visibleImage(page)).toBeInViewport();
  await expect(visibleImage(page)).toHaveAttribute('data-art', asset);
  await expect(pendingImage(page)).toHaveCount(0);
  await expect(page.locator('.play-image-fallback')).toHaveCount(0);
  const node = await visibleImage(page).elementHandle() as ElementHandle<HTMLImageElement>;
  const bitmap = await decodedBitmap(node);
  expect(bitmap.naturalWidth).toBeGreaterThan(0); expect(bitmap.naturalHeight).toBeGreaterThan(0);
  expect(bitmap.opaque).toBeGreaterThan(0); expect(bitmap.colors).toBeGreaterThan(8);
  expect(bitmap.connected && bitmap.currentVisibleNode && bitmap.nonzeroOpacity).toBe(true);
  expect(bitmap.width).toBeGreaterThan(0); expect(bitmap.height).toBeGreaterThan(0);
  return { node, bitmap };
}

async function expectRetained(page: Page, previous: Awaited<ReturnType<typeof expectReady>>, incoming: string) {
  await expect(world(page)).toHaveAttribute('data-scene-state', 'loading');
  await expect(world(page)).toHaveAttribute('data-scene-requested', incoming);
  await expect(world(page)).toHaveAttribute('aria-busy', 'true');
  await expect(visibleImage(page)).toHaveCount(1); await expect(visibleImage(page)).toBeVisible();
  await expect(visibleImage(page)).toBeInViewport();
  const current = await decodedBitmap(previous.node);
  expect(current.connected && current.currentVisibleNode && current.nonzeroOpacity, 'The same outgoing decoded DOM image remains visible.').toBe(true);
  expect(current.hash).toBe(previous.bitmap.hash);
  expect(current.src).toBe(previous.bitmap.src);
  expect(current.naturalWidth).toBe(previous.bitmap.naturalWidth);
  await expect(pendingImage(page)).toHaveCount(1);
  await expect(pendingImage(page)).toHaveAttribute('data-art', incoming);
  await expect(pendingImage(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(pendingImage(page)).toHaveCSS('visibility', 'hidden');
  await expect(pendingImage(page)).toBeHidden();
  await expect(page.locator('.scene-load-status')).toHaveText('Loading scene…');
  await expect(world(page).locator('button:visible')).toHaveCount(0);
  await expect(world(page).getByRole('button')).toHaveCount(0);
}

for (const [motion, width] of [['no-preference', 390], ['reduce', 360]] as const) {
  test(`scene readiness ${motion} ${width}px: retain the same decoded image through fetch and decode without gating choices`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: motion });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await controlDecode(page, ['hong-kong-table.webp']);
    let openNetwork!: () => void, sawRequest!: () => void;
    const networkGate = new Promise<void>(resolve => { openNetwork = resolve; });
    const requested = new Promise<void>(resolve => { sawRequest = resolve; });
    await page.route('**/hong-kong-table.webp', async route => { sawRequest(); await networkGate; await route.continue(); });
    try {
      await page.goto('/'); await startStory(page);
      const outgoing = await expectReady(page, 'hong-kong-evening.webp');
      await depart(page, 'Hong Kong'); await requested;
      await expectPhase(page, 'arrival'); await expect(storyClock(page)).toHaveText('16:45');
      await expectRetained(page, outgoing, 'hong-kong-table.webp');
      await page.getByRole('button', { name: 'Read the menu', exact: true }).click();
      const simple = page.getByRole('button', { name: /^Let’s keep dinner simple\./ });
      await expect(simple).toBeEnabled(); await expect(simple).toContainText('60 minutes');
      await expect(simple).toContainText('Home 19:15'); await expect(simple).toContainText('about HK$304/person');
      await simple.click();
      await expectPhase(page, 'afterDinner'); await expect(storyClock(page)).toHaveText('18:15');
      await expect(page.locator('.play-event-note')).toContainText('added 30 minutes once');
      await closeDialogue(page);
      await expect(page.getByRole('button', { name: 'Step outside', exact: true })).toBeEnabled();
      await expectRetained(page, outgoing, 'hong-kong-table.webp');
      await showcase(page, `readiness-held-fetch-${width}`);
      openNetwork();
      await waitForHeldDecode(page, 'hong-kong-table.webp');
      await expectRetained(page, outgoing, 'hong-kong-table.webp');
      // A complete loaded bitmap still cannot be exposed before the promise the
      // application awaits has resolved. This is deliberately not a speed metric.
      const incoming = await pendingImage(page).elementHandle() as ElementHandle<HTMLImageElement>;
      expect(await incoming.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await showcase(page, `readiness-held-decode-${width}`);
      await releaseDecode(page, 'hong-kong-table.webp');
      await expectReady(page, 'hong-kong-table.webp');
      expect(await incoming.evaluate(image => image === document.querySelector('.play-world img[data-scene-layer="visible"]')), 'The decoded incoming node is promoted without remounting.').toBe(true);
      expect(await outgoing.node.evaluate(image => image.isConnected)).toBe(false);
      await expect(storyClock(page)).toHaveText('18:15');
      await expect(world(page).locator('button:visible')).toHaveCount(4);
      await openAction(page, 'Open wallet');
      await expect(dialogue(page).locator('.pocket-facts dd')).toHaveText(['HK$400.00', 'HK$304.00']);
      await closeDialogue(page);
      if (motion === 'reduce') {
        await expect(world(page)).toHaveCSS('animation-name', 'none');
        await expect(world(page)).toHaveCSS('transition-duration', '0s');
        await expect(page.locator('.world-scroller')).toHaveCSS('scroll-behavior', 'auto');
      }
      await showcase(page, `readiness-decoded-target-${width}`);
      expect(errors).toEqual([]);
    } finally { openNetwork(); }
  });
}

test('desktop table-to-night readiness avoids a second Jun portrait until the retained table is replaced', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await controlDecode(page, ['hk-evening-night.webp']);
  await page.goto('/'); await startStory(page);
  await depart(page, 'Hong Kong'); await chooseDinner(page, 'simple');
  await expect(storyClock(page)).toHaveText('18:15');
  const outgoing = await expectReady(page, 'hong-kong-table.webp');
  await chooseWalk(page, 'long');
  await waitForHeldDecode(page, 'hk-evening-night.webp');
  await expectRetained(page, outgoing, 'hk-evening-night.webp');
  await expect(world(page)).toHaveAttribute('data-scene-visible', 'hong-kong-table.webp');
  await expectPhase(page, 'walk'); await expect(storyClock(page)).toHaveText('19:00');
  const committed = await readStorySave(page);
  expect(committed.currentAttempt).toMatchObject({ city: 'hk', dinnerChoice: 'simple', walkChoice: 'long', phase: 'walk' });
  const heading = dialogue(page).getByRole('heading', { name: 'By the water', exact: true });
  await expect(heading).toBeFocused(); await expect(heading).toBeInViewport({ ratio: 1 });
  const spoken = dialogue(page).locator('.spoken-line');
  await expect(spoken).toHaveText(['I’d forgotten how the restaurant lights look from down here.', 'Shall we head back?']);
  for (const line of await spoken.all()) {
    await expect(line).toBeVisible(); await expect(line).toBeInViewport({ ratio: 1 });
    await expectNoClippedText(line);
  }
  await expectUnscrolledDialogueActions(page, ['Look around', 'Return to the scene']);
  const portrait = dialogue(page).locator('.dialogue-portrait');
  await expect(portrait).toHaveCount(1);
  await expect(portrait).toHaveCSS('visibility', 'hidden'); await expect(portrait).toBeHidden();
  const incoming = await pendingImage(page).elementHandle() as ElementHandle<HTMLImageElement>;
  await showcase(page, 'readiness-table-night-pending-1440');

  await releaseDecode(page, 'hk-evening-night.webp');
  await expectReady(page, 'hk-evening-night.webp');
  expect(await incoming.evaluate(image => image === document.querySelector('.play-world img[data-scene-layer="visible"]'))).toBe(true);
  expect(await outgoing.node.evaluate(image => image.isConnected)).toBe(false);
  await expect(portrait).toHaveCSS('visibility', 'visible'); await expect(portrait).toBeVisible();
  await expect(portrait).toBeInViewport({ ratio: 1 });
  await expect(portrait.locator('img[data-art="jun-portrait.webp"]')).toBeVisible();
  await expectPhase(page, 'walk'); await expect(storyClock(page)).toHaveText('19:00');
  expect(await readStorySave(page)).toEqual(committed);
  await expect(heading).toBeFocused();
  await expectUnscrolledDialogueActions(page, ['Look around', 'Return to the scene']);
  await showcase(page, 'readiness-table-night-settled-1440');
  expect(errors).toEqual([]);
});

test('rapid free previews ignore an older completed decode and retain the latest requested city', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await controlDecode(page, ['shenzhen-evening.webp']);
  await page.goto('/'); await startStory(page);
  const outgoing = await expectReady(page, 'hong-kong-evening.webp');
  const initial = await readStorySave(page);
  await cityPreview(page, 'Shenzhen').click(); await waitForHeldDecode(page, 'shenzhen-evening.webp');
  await expectRetained(page, outgoing, 'shenzhen-evening.webp');
  await cityPreview(page, 'Hong Kong').click();
  await cityPreview(page, 'Shenzhen').click();
  await cityPreview(page, 'Hong Kong').click();
  await expectReady(page, 'hong-kong-evening.webp');
  const selected = await readStorySave(page);
  expect(selected).toEqual({ ...initial, previewCity: 'hk' });
  await releaseDecode(page, 'shenzhen-evening.webp');
  // Allow state updates from that explicit completion to render, without a
  // time-based guess about how quickly network or decoding ought to finish.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expectReady(page, 'hong-kong-evening.webp');
  expect(await outgoing.node.evaluate(image => image === document.querySelector('.play-world-image'))).toBe(true);
  await expect(world(page).locator('img[data-art="shenzhen-evening.webp"]')).toHaveCount(0);
  await expect(storyClock(page)).toHaveText('16:30');
  expect(await readStorySave(page)).toEqual(selected);
  await showcase(page, 'readiness-stale-preview-390');
  expect(errors).toEqual([]);
});

for (const failure of ['network', 'decode'] as const) {
  test(`scene ${failure} failure exposes the honest fallback while named decisions remain usable`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: failure === 'decode' ? 'reduce' : 'no-preference' });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    if (failure === 'network') await page.route('**/hong-kong-table.webp', route => route.abort('failed'));
    else await controlDecode(page, ['hong-kong-table.webp']);
    await page.goto('/'); await startStory(page);
    const outgoing = await expectReady(page, 'hong-kong-evening.webp');
    await depart(page, 'Hong Kong');
    if (failure === 'decode') {
      await waitForHeldDecode(page, 'hong-kong-table.webp');
      await expectRetained(page, outgoing, 'hong-kong-table.webp');
      await releaseDecode(page, 'hong-kong-table.webp', 'reject');
    }
    await expect(world(page)).toHaveAttribute('data-scene-state', 'failed');
    await expect(world(page)).toHaveAttribute('aria-busy', 'false');
    expect(await world(page).getAttribute('data-scene-visible')).toBeNull();
    await expect(world(page).locator('img')).toHaveCount(0);
    expect(await outgoing.node.evaluate(image => image.isConnected)).toBe(false);
    await expect(page.getByRole('img', { name: 'Illustrated scene unavailable', exact: true })).toBeVisible();
    await expect(page.locator('.play-image-fallback')).toContainText('make every choice using the named place controls');
    await expect(page.locator('.scene-load-status')).toHaveText('Scene unavailable');
    await expect(storyClock(page)).toHaveText('16:45');
    await closeDialogue(page);
    await expect(world(page).locator('button:visible')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Read the menu', exact: true })).toBeEnabled();
    await showcase(page, `readiness-fallback-${failure}-390`);
    await chooseDinner(page, 'simple'); await expect(storyClock(page)).toHaveText('18:15');
    await chooseWalk(page, 'short'); await expect(storyClock(page)).toHaveText('18:30');
    await expectReady(page, 'hk-evening-night.webp');
    expect(errors).toEqual([]);
  });
}
