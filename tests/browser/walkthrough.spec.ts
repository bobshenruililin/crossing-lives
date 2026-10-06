import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  cityPreview, closeDialogue, dialogue, expectJun, expectPhase, expectSceneAssets,
  openAction, storyClock,
} from './story-helpers';

test('record a real 60–90 second world-first opening from invitation to an ordinary decision', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_COMMIT_SHA ?? null;
  if (process.env.CI) expect(commit, 'CI footage must identify its exact source commit.').toMatch(/^[a-f0-9]{40}$/i);
  const dir = path.resolve('artifacts/walkthrough');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: testInfo.outputPath('recording'), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const video = page.video()!;
  const errors: string[] = [];
  const beats: { label: string; elapsedMs: number; pauseMs: number }[] = [];
  const started = Date.now();
  page.on('pageerror', error => errors.push(error.message));
  // These pauses create readable, real-browser footage. State is always checked
  // with normal assertions; original rendering, timing and animations remain intact.
  const hold = async (label: string, pauseMs: number) => {
    beats.push({ label, elapsedMs: Date.now() - started, pauseMs });
    await page.waitForTimeout(pauseMs);
  };
  let complete = false;
  try {
    await page.goto('/');
    await page.evaluate(async () => { await document.fonts.ready; });
    await expectSceneAssets(page, 'hong-kong-evening.webp');
    await expect(dialogue(page).getByRole('heading', { name: 'Dinner, then a walk?', exact: true })).toBeVisible();
    await expectJun(page);
    await expect(page.getByRole('button', { name: 'Let’s stay nearby.', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Let’s cross for dinner.', exact: true })).toBeVisible();
    await hold('Jun invites us out. We can stay nearby, cross for dinner or freely look around first.', 13000);
    await page.getByRole('button', { name: 'Look around first', exact: true }).click();
    await hold('The dialogue clears and the scene becomes the interface.', 4000);
    await cityPreview(page, 'Hong Kong').click();
    await expectSceneAssets(page, 'hong-kong-evening.webp');
    await hold('Look toward the nearby table without spending any story time.', 4000);
    await page.getByRole('button', { name: 'Look at the table', exact: true }).click();
    await expectJun(page);
    await hold('A short observation about the table, placed over the world.', 7000);
    await page.getByRole('button', { name: 'Continue dialogue', exact: true }).click();
    await hold('The menu is only an illustrative allowance; looking remains free.', 8000);
    await closeDialogue(page);
    await openAction(page, 'Open wallet');
    await expect(dialogue(page)).toContainText('HK$304.00');
    await hold('Check the spending allowance and the whole-outing estimate when it becomes relevant.', 10000);
    await closeDialogue(page);
    await openAction(page, 'Open phone');
    await expect(storyClock(page)).toHaveText('16:30');
    await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeVisible();
    await expect(page.locator('.route-note-forecast')).toContainText('modeled home 19:15');
    await expect(dialogue(page)).toContainText('30-minute dinner delay');
    await hold('Unfold the out-and-back route: the conditional 19:15 home forecast includes the disclosed delay while the actual clock remains 16:30.', 12000);
    await closeDialogue(page);
    await hold('Put the phone away and return to the scene.', 3000);
    await openAction(page, 'Talk about dinner');
    await expectJun(page);
    await expect(page.getByRole('button', { name: 'Head to the table', exact: true })).toBeVisible();
    await hold('Talk with Jun and choose an ordinary dinner plan, with its consequences visible.', 9000);
    await page.getByRole('button', { name: 'Head to the table', exact: true }).click();
    await expectPhase(page, 'arrival');
    await expectSceneAssets(page, 'hong-kong-table.webp');
    await expectJun(page);
    await expect(storyClock(page)).toHaveText('16:45');
    await expect(dialogue(page).getByRole('heading', { name: 'At the table', exact: true })).toBeFocused();
    await hold('The first real commitment advances time and changes the setting to the close table scene with Jun.', 6000);
    expect(errors).toEqual([]);
    complete = true;
  } finally {
    await context.close();
    const basename = `world-first-opening-${commit ?? 'local-unidentified'}`;
    const videoPath = path.join(dir, `${basename}.webm`);
    await video.saveAs(videoPath);
    const metadataPath = path.join(dir, `${basename}.json`);
    writeFileSync(metadataPath, JSON.stringify({
      commit, complete, test: testInfo.title,
      viewport: { width: 1440, height: 900 },
      recording: 'Playwright BrowserContext recordVideo; actual browser interactions and original animations',
      requestedLengthSeconds: [60, 90],
      readingPausesMs: beats.reduce((total, beat) => total + beat.pauseMs, 0),
      elapsedMs: Date.now() - started,
      browserVersion: browser.version(),
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      project: testInfo.project.name, beats, errors,
    }, null, 2));
    await testInfo.attach('World-first opening, recorded in the browser', { path: videoPath, contentType: 'video/webm' });
    await testInfo.attach('Exact commit and readable opening beats', { path: metadataPath, contentType: 'application/json' });
  }
});
