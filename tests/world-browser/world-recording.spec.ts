import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCENES, CASES } from './world-fixtures';
import { capture, closePoint, expectFacts, expectScene, openPoint, player, selectChoice, stage, startWorld, takeExit, walkToEntrance, world } from './world-helpers';
import { auditWorldStorage } from './world-storage';

/** Actual browser video from a cold context; real controls and reading pauses.
 * No warm-up images, state seed, trace restart, overlays, edited or trimmed film. */
test('record the complete cold world walkthrough with twelve places and readable choices', async ({ browser, baseURL }, info) => {
  test.setTimeout(330_000);
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_WORLD_COMMIT;
  expect(commit, 'A recording must identify the exact tested commit.').toMatch(/^[a-f0-9]{40}$/);
  const viewport = { width: 1440, height: 900 };
  const directory = resolve('artifacts/world/walkthrough'); await mkdir(directory, { recursive: true });
  const canonicalVideo = resolve(directory, 'crossing-lives-whole-world-1440x900.webm');
  const reportPath = resolve(directory, 'whole-world-recording.json');
  const context = await browser.newContext({ baseURL, viewport, reducedMotion: 'no-preference', recordVideo: { dir: info.outputPath('recording'), size: viewport } });
  const audit = await auditWorldStorage(context), page = await context.newPage(), video = page.video();
  const started = Date.now(); let completed = false;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const actions: { action: string; startedMs: number; finishedMs: number; requestedPauseMs: number; scene: string | null; art: string | null; choice: string | null }[] = [];
  const chapter = async (action: string, pause: number, run?: () => Promise<void>) => {
    const startedMs = Date.now() - started;
    if (run) await run();
    await page.waitForTimeout(pause); // Intentional human reading time, not a loading/performance gate.
    actions.push({ action, startedMs, finishedMs: Date.now() - started, requestedPauseMs: pause,
      scene: await world(page).getAttribute('data-scene'), art: await world(page).getAttribute('data-art-status'), choice: await page.locator('.world-insight').count() ? await page.locator('.world-insight').getAttribute('data-choice') : await page.getByTestId('regional-map-discovery').count() ? `${await page.getByTestId('regional-map-discovery').getAttribute('data-region')}/${await page.getByTestId('regional-map-discovery').getAttribute('data-chapter')}` : null });
  };
  try {
    await chapter('Cold opening; click the single default Play control.', 3_000, () => startWorld(page));
    await chapter('Walk visibly right using the keyboard.', 3_000, async () => { await page.keyboard.press('ArrowRight'); await expect(player(page)).toHaveAttribute('data-walking', 'false'); });
    for (const [index, id] of SCENES.entries()) {
      if (index === 1) {
        await chapter('Walk from the clock to the marked home door. Arriving alone does not enter.', 3_000, async () => {
          // Closing the clock returns focus to its physical point. Walk back
          // through the native tab order to the stage, without injected focus.
          for (let tab = 0; tab < 6 && !(await stage(page).evaluate(el => el === document.activeElement)); tab++) await page.keyboard.press('Shift+Tab');
          await expect(stage(page)).toBeFocused();
          await walkToEntrance(page, 'hk-home', 'metro-carriage');
        });
        await chapter('Press Enter and physically leave home for the decoded train carriage.', 4_000, async () => { await page.keyboard.press('Enter'); await expectScene(page, id); });
      } else if (index) {
        await chapter(`Walk through the real entrance into ${id}.`, 3_000, () => takeExit(page, SCENES[index - 1], id));
      }
      await chapter(`Explore ${id}: ${CASES[id].choices[0].label}.`, 5_000, async () => { await openPoint(page, id); await expectFacts(page, id, 0); });
      if (id === 'planning-museum') {
        for (const index of [1, 2, 3]) await chapter(`Museum geographic chapter ${index + 1}: select its real place anchor.`, 2_000, async () => {
          await page.getByTestId('regional-map-discovery').locator(`[data-chapter-index="${index}"]`).click();
          await expect(page.getByTestId('regional-active-label')).toBeVisible();
        });
      }
      await chapter(`Change ${id} with the real control: ${CASES[id].choices[1].label}.`, 6_000, async () => { await selectChoice(page, id, 1); await expectFacts(page, id, 1); });
      if (['parcel-counter', 'rental-home', 'luxury-home', 'office-floor', 'learning-center', 'planning-museum'].includes(id)) {
        await capture(page, info, `film-${id}-visible-consequence`);
      }
      await closePoint(page);
    }
    await chapter('Open the connected-world map; its links are illustrative, not city geography.', 7_000, async () => {
      await page.getByRole('button', { name: 'Open world map', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'World map', exact: true })).toContainText('Illustrative connections, not geographic directions.');
    });
    await chapter('Close the map and finish inside the planning museum.', 4_000, async () => { await page.keyboard.press('Escape'); await expectScene(page, 'planning-museum'); });
    await audit.expectZero(page); expect(errors).toEqual([]);
    const duration = Date.now() - started;
    expect(duration, 'The continuous film includes at least three minutes of actual play and reading.').toBeGreaterThanOrEqual(180_000);
    expect(duration, 'The requested human-readable walkthrough stays within four minutes.').toBeLessThanOrEqual(240_000);
    completed = true;
  } finally {
    // Save the complete video even when a gate interrupts the tour. The runner owns tracing.
    await context.close();
    if (video) { await video.saveAs(canonicalVideo); await video.delete(); }
    await writeFile(reportPath, JSON.stringify({ commit, viewport, entry: `${baseURL}/world.html`, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started,
      completed, videoPresent: Boolean(video), reducedMotion: false, coldContext: true, input: 'real keyboard and pointer controls',
      artifact: 'artifacts/world/walkthrough/crossing-lives-whole-world-1440x900.webm', actions, errors }, null, 2));
    await info.attach('whole-world-recording-report', { path: reportPath, contentType: 'application/json' });
    expect(video, 'A missing actual browser video is a failure, never replaced by still-frame animation.').not.toBeNull();
  }
});
