import { test, expect } from '@playwright/test';
import { background, capture, expectFacts, expectScene, mapTo, openPoint, player, selectChoice, startWorld, world } from './world-helpers';
import { observeFrames, readFrames } from './world-geometry';

function homeExit(page: import('@playwright/test').Page) {
  return page.getByTestId('exit-metro-carriage');
}

test('cold failed artwork reaches an explicit playable schematic and recovers at the next real place', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let failedRequests = 0;
  await page.route('**/art/metro-carriage.webp', async route => { failedRequests++; await route.abort('failed'); });
  await startWorld(page); await observeFrames(page);
  await homeExit(page).click();
  await expect(world(page)).toHaveAttribute('data-scene', 'metro-carriage');
  await expect(world(page)).toHaveAttribute('data-travel', 'none'); await expect(world(page)).toHaveAttribute('data-art-status', 'fallback');
  expect(failedRequests, 'The failure route really intercepted a cold target-art request.').toBeGreaterThan(0);
  await expect(page.locator('.world-schematic')).toBeVisible();
  await expect(page.locator('.world-art-status')).toHaveText('Illustration unavailable · functional schematic');
  await expect(background(page)).toHaveCount(0); await expect(player(page).locator('img')).toBeVisible();
  await page.waitForTimeout(50);
  for (const frame of await readFrames(page)) expect(frame.loadedImage || frame.schematic, 'Every sampled failure state retains a loaded image or explicit schematic.').toBe(true);
  await openPoint(page, 'metro-carriage', 'key'); await selectChoice(page, 'metro-carriage', 1); await expectFacts(page, 'metro-carriage', 1);
  await page.keyboard.press('Escape'); await capture(page, info, 'failed-art-functional-schematic');
  await mapTo(page, 'border-arrival'); await expectScene(page, 'border-arrival'); await capture(page, info, 'recovered-decoded-arrival');
});

test('cold delayed art preserves the outgoing world; Escape and newer map navigation cancel stale arrival', async ({ page }, info) => {
  test.setTimeout(40_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void; const requestSeen = new Promise<void>(resolve => { requested = resolve; });
  let intercepted = 0;
  await page.route('**/art/metro-carriage.webp', async route => { intercepted++; requested(); await held; await route.continue().catch(() => undefined); });
  try {
    await startWorld(page); await observeFrames(page);
    await homeExit(page).click(); await requestSeen;
    await expect(world(page)).toHaveAttribute('data-travel', 'metro-carriage');
    await expect(player(page)).toHaveAttribute('data-walking', 'false');
    await expect(page.getByRole('button', { name: 'Use schematic', exact: true })).toBeVisible();
    await expect(world(page)).toHaveAttribute('data-scene', 'hk-home');
    await expect(background(page)).toHaveAttribute('src', /hk-home\.webp$/);
    await capture(page, info, 'cold-decode-wait-keeps-home');
    await page.keyboard.press('Escape');
    await expect(world(page)).toHaveAttribute('data-travel', 'none'); await expectScene(page, 'hk-home');
    // Start another pending exit, then genuinely supersede it through the world map.
    await homeExit(page).click(); await expect(world(page)).toHaveAttribute('data-travel', 'metro-carriage');
    await mapTo(page, 'border-arrival');
    release(); await page.waitForTimeout(350);
    await expectScene(page, 'border-arrival');
    expect(intercepted).toBeGreaterThanOrEqual(1);
    const frames = await readFrames(page);
    expect(frames.some(frame => frame.scene === 'metro-carriage'), 'Canceled decoded completion cannot commit the old destination.').toBe(false);
    for (const frame of frames) { expect(frame.loadedImage || frame.schematic).toBe(true); if (frame.status === 'ready') expect(frame.source).toMatch(new RegExp(`${frame.scene}\\.webp$`)); }
    await capture(page, info, 'newer-navigation-wins');
  } finally { release(); }
});
