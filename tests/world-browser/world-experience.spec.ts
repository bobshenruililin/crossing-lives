import { test, expect } from '@playwright/test';
import { CASES, SCENES, isDecisionScene, nameFor } from './world-fixtures';
import { approvedArtHash, capture, choiceAttribute, closePoint, expectFacts, expectNoOverflow, expectScene, expectUnknown, geometryFingerprint, insight, mapTo, openPoint, player, position, renderedArtHash, selectChoice, startWorld, takeExit, walkToEntrance, world } from './world-helpers';
import { expectVisibleSprite, expectVisibleWorldTargets, expectWorldDominant, observeFrames, readFrames } from './world-geometry';
import { checkRegionalDiscovery } from './world-regional';
import { decisionGeometry, expectInitialDecision, expectMapPlan, expectParcelResult, expectTakenDecision, setDeadlineWithNativeKeys, takeSceneDecision } from './world-decision-paths';
import { auditWorldStorage } from './world-storage';

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 360, height: 844 }]) {
  test(`cold one-click Play, visible body and real movement at ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }, info) => {
    const touch = viewport.width !== 1440;
    const context = await browser.newContext({ baseURL, viewport, hasTouch: touch, reducedMotion: 'no-preference' });
    const audit = await auditWorldStorage(context), page = await context.newPage();
    try {
      const started = Date.now();
      await startWorld(page, undefined, touch);
      expect(Date.now() - started, 'One click reaches a decoded playable world promptly from a cold context.').toBeLessThan(5_000);
      await expectVisibleSprite(page); await expectWorldDominant(page); await expectVisibleWorldTargets(page); await expectNoOverflow(page);
      await capture(page, info, 'first-play');
      const before = await position(page);
      const screenBefore = await player(page).evaluate(el => { const r = el.getBoundingClientRect(), p = document.querySelector('.world-plane')!.getBoundingClientRect(); return r.left - p.left; });
      if (touch) await page.getByRole('button', { name: 'Walk right', exact: true }).tap(); else await page.keyboard.press('ArrowRight');
      await expect(player(page)).toHaveAttribute('data-walking', 'true');
      await expect.poll(() => player(page).locator('.world-sprite-crop').evaluate(el => getComputedStyle(el).animationName)).not.toBe('none');
      await expect(player(page)).toHaveAttribute('data-walking', 'false');
      expect((await position(page)).x - before.x).toBeGreaterThan(80);
      const screenAfter = await player(page).evaluate(el => { const r = el.getBoundingClientRect(), p = document.querySelector('.world-plane')!.getBoundingClientRect(); return r.left - p.left; });
      expect(screenAfter - screenBefore, 'The actual rendered sprite moves relative to the illustrated world.').toBeGreaterThan(60);
      await capture(page, info, 'after-visible-movement');
      for (const id of ['metro-carriage', 'rental-home'] as const) {
        await mapTo(page, id); await expectVisibleSprite(page); await expectVisibleWorldTargets(page); await expectWorldDominant(page); await expectNoOverflow(page);
        await capture(page, info, `${id}-body-and-controls`);
      }
      await audit.expectZero(page);
    } finally { await context.close(); }
  });
}

test('walk to a real entrance, press Enter, and commit scene and decoded artwork together', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startWorld(page);
  await walkToEntrance(page, 'hk-home', 'metro-carriage');
  await capture(page, info, 'marked-entrance-before-enter');
  await observeFrames(page);
  await page.keyboard.press('Enter');
  await expectScene(page, 'metro-carriage');
  await page.waitForTimeout(50); // Sample at least one animation callback after arrival.
  const frames = await readFrames(page);
  expect(frames.some(frame => frame.scene === 'hk-home' && frame.travel === 'metro-carriage')).toBe(true);
  expect(frames.some(frame => frame.scene === 'metro-carriage')).toBe(true);
  for (const frame of frames) {
    expect(frame.loadedImage || frame.schematic, 'Every sampled DOM state has a loaded image or explicit schematic.').toBe(true);
    expect(frame.status).toBe('ready'); expect(frame.source).toMatch(new RegExp(`${frame.scene}\\.webp$`));
  }
  await expectVisibleSprite(page); await capture(page, info, 'inside-actual-carriage');
});

test('all twelve places have distinct decoded art and distinct working visual mechanisms; revisits conserve local choices', async ({ browser, baseURL }, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const audit = await auditWorldStorage(context), page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const approved = new Set<string>(), rendered = new Set<string>(), mechanisms = new Set<string>(), shapes = new Set<string>();
  try {
    await startWorld(page);
    for (const [index, id] of SCENES.entries()) {
      if (index) await takeExit(page, SCENES[index - 1], id);
      await expectScene(page, id); await expectVisibleSprite(page); await expectWorldDominant(page);
      approved.add(await approvedArtHash(id)); rendered.add(await renderedArtHash(page));
      await capture(page, info, `${index + 1}-${id}-world`);
      await openPoint(page, id);
      if (isDecisionScene(id)) {
        const decision = await takeSceneDecision(page, id);
        shapes.add(decision.before); mechanisms.add(decision.mechanism);
        await openPoint(page, id); await expectTakenDecision(page, id);
        await capture(page, info, `${index + 1}-${id}-taken-decision`);
        await expectUnknown(page, id); await closePoint(page);
        continue;
      }
      await expect(insight(page, id)).toHaveAttribute(choiceAttribute(id), CASES[id].choices[0].value);
      await expectFacts(page, id, 0); const before = await geometryFingerprint(page, id);
      await selectChoice(page, id, 1); await expectFacts(page, id, 1);
      const after = await geometryFingerprint(page, id);
      expect(after, `${id} must change SVG geometry or actual paint, not just text/radio state.`).not.toBe(before);
      shapes.add(before); mechanisms.add(id === 'planning-museum' ? 'regional-geography' : (await insight(page, id).locator('figure').getAttribute('data-mechanism'))!);
      await capture(page, info, `${index + 1}-${id}-changed-mechanism`);
      await expectUnknown(page, id);
      await selectChoice(page, id, 0); await expectFacts(page, id, 0);
      expect(await geometryFingerprint(page, id), `${id} first control restores the visible mechanism.`).toBe(before);
      if (id === 'planning-museum') await checkRegionalDiscovery(page);
      await selectChoice(page, id, 1);
      await closePoint(page);
    }
    expect(approved.size).toBe(12); expect(rendered.size).toBe(12); expect(mechanisms.size).toBe(12); expect(shapes.size).toBe(12);
    // Revisit all twelve through real map buttons; no direct reducer/state injection.
    for (const id of SCENES) {
      await mapTo(page, id); await openPoint(page, id, 'key');
      if (isDecisionScene(id)) { await expectTakenDecision(page, id); await closePoint(page); continue; }
      await expect(insight(page, id)).toHaveAttribute(choiceAttribute(id), CASES[id].choices[1].value);
      await expectFacts(page, id, 1); await closePoint(page);
    }
    await page.getByRole('button', { name: 'Open world map', exact: true }).click(); await expectMapPlan(page); await page.keyboard.press('Escape');
    await mapTo(page, 'hk-home'); await openPoint(page, 'hk-home', 'key'); await setDeadlineWithNativeKeys(page, 'later');
    await insight(page, 'hk-home').getByRole('button', { name: 'Take this plan', exact: true }).click();
    await mapTo(page, 'parcel-counter'); await openPoint(page, 'parcel-counter', 'key'); await expectTakenDecision(page, 'parcel-counter'); await closePoint(page);
    await mapTo(page, 'rental-home'); await openPoint(page, 'rental-home', 'key'); await expectTakenDecision(page, 'rental-home'); await closePoint(page);
    await audit.expectZero(page); expect(errors).toEqual([]);
    await page.reload(); await page.getByRole('button', { name: 'Play', exact: true }).click(); await expectScene(page, 'hk-home');
    await openPoint(page, 'hk-home', 'key'); await expectInitialDecision(page, 'hk-home');
    await audit.expectZero(page); await audit.proveNegativeControl(page);
  } finally { await context.close(); }
});

test('optional people, day and scenario controls change the cast and route without inventing fares', async ({ page }, info) => {
  await page.goto('/world.html');
  await page.getByRole('button', { name: 'Change people or day' }).click();
  await page.getByRole('combobox', { name: 'People', exact: true }).selectOption('family');
  await page.getByRole('combobox', { name: 'Day', exact: true }).selectOption('weekday');
  await page.getByRole('combobox', { name: 'Day in mind', exact: true }).selectOption('housing');
  await expect(page.getByText('Fictional cast: two adults and one child. Child fares and eligibility are unknown.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectScene(page, 'neighborhood-lane');
  await expect(world(page)).toHaveAttribute('data-party', 'family');
  await expect(page.locator('.world-sprite')).toHaveCount(3);
  await expect(page.getByTestId('world-child')).toBeVisible();
  await expect(page.locator('.world-route-cue')).toContainText(nameFor('rental-home'));
  await page.getByRole('button', { name: 'Open world map', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'World map', exact: true })).toContainText('Illustrative connections, not geographic directions');
  await expect(page.locator('.world-map-canvas .in-route')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await mapTo(page, 'parcel-counter'); await openPoint(page, 'parcel-counter', 'key');
  await insight(page, 'parcel-counter').getByRole('button', { name: /^Already going/ }).click();
  await insight(page, 'parcel-counter').getByRole('button', { name: /^Collect it/ }).click();
  await expectParcelResult(page, 'collection', 'already-going'); const familyGeometry = await decisionGeometry(page, 'parcel-counter');
  await insight(page, 'parcel-counter').getByRole('button', { name: 'Use collection', exact: true }).click();
  for (const [party, count] of [['solo', 1], ['couple', 2], ['older-couple', 2], ['family', 3]] as const) {
    await page.getByRole('button', { name: 'Change people and day', exact: true }).click();
    await page.getByRole('combobox', { name: 'People', exact: true }).selectOption(party);
    await page.getByRole('combobox', { name: 'Day', exact: true }).selectOption('weekend');
    await expect(page.getByRole('dialog')).toContainText('Day is authored context, not live opening hours or queues.');
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    await expect(page.locator('.world-sprite')).toHaveCount(count);
    await expect(page.getByRole('button', { name: 'Change people and day', exact: true })).toContainText(String(count));
    await openPoint(page, 'parcel-counter', 'key'); await expectParcelResult(page, 'collection', 'already-going');
    expect(await decisionGeometry(page, 'parcel-counter')).toBe(familyGeometry);
    await expect(insight(page, 'parcel-counter')).not.toContainText(/family total|child fare:\s*\d|full outing total/i); await closePoint(page);
  }
  await capture(page, info, 'family-visible-without-fabricated-fare');
  // Another cold start demonstrates the different daily-life start and focused route.
  await page.reload(); await page.getByRole('button', { name: 'Change people or day' }).click();
  await page.getByRole('combobox', { name: 'Day in mind', exact: true }).selectOption('daily-life'); await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectScene(page, 'hk-home'); await expect(page.locator('.world-route-cue')).toContainText(nameFor('metro-carriage'));
});
