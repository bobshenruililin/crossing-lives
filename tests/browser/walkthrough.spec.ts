import { junWords } from './story-fixtures';
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  cityPreview, closeDialogue, dialogue, expectJun, expectHomeScene, expectPhase, expectSceneAssets,
  openAction, readStorySave, storyClock, expectUnscrolledDialogueActions,
} from './story-helpers';

test('record one real complete evening from invitation through dinner, walk, return route and shared home', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(210_000);
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
    await expect(dialogue(page).locator('.spoken-line')).toHaveText(junWords.invitation);
    await expectUnscrolledDialogueActions(page, ['Let’s stay nearby.', 'Let’s cross for dinner.', 'Look around first']);
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
    await expect(page.locator('.route-note-condition')).toHaveText('Conditional plan');
    await hold('Unfold the compact out-and-back route: the conditional home time is 19:15 while the actual clock remains 16:30.', 7000);
    await page.getByRole('button', { name: 'Evening assumptions', exact: true }).click();
    const assumptions = page.locator('.route-note-detail');
    await expect(assumptions).toBeVisible();
    await expect(assumptions).toContainText('60-minute simple dinner · assumed, still to choose');
    await expect(assumptions).toContainText('45-minute walk · assumed, still to choose');
    await expect(assumptions).toContainText('Includes the disclosed 30-minute dinner delay.');
    await assumptions.getByRole('heading', { name: 'Evening assumptions', exact: true }).scrollIntoViewIfNeeded();
    await hold('Open Evening assumptions to read the dinner, walk and disclosed delay included in that forecast.', 9000);
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
    await expect(dialogue(page).locator('.spoken-line')).toHaveText(junWords.table.hk);
    await expectUnscrolledDialogueActions(page, ['Read the menu']);
    await hold('The first real commitment advances time and changes the setting to the close table scene with Jun.', 6000);
    await page.getByRole('button', { name: 'Read the menu', exact: true }).click();
    await expectJun(page);
    await hold('Read the menu at the actual table and compare the two dinner choices.', 10000);
    await page.getByRole('button', { name: /^Let’s have one more dish\./ }).click();
    await expectPhase(page, 'afterDinner');
    await expect(storyClock(page)).toHaveText('18:45');
    await expect(page.locator('.play-event-note')).toContainText('added 30 minutes once');
    await hold('A shared dessert and the disclosed delay bring the story clock to 18:45.', 8000);
    await page.getByRole('button', { name: 'Step outside', exact: true }).click();
    await hold('Choose a short loop, a longer walk or a direct return with the consequences visible.', 9000);
    await page.getByRole('button', { name: /^Let’s take the longer walk\./ }).click();
    await expectPhase(page, 'walk');
    await expect(storyClock(page)).toHaveText('19:30');
    await expectSceneAssets(page, 'hk-evening-night.webp');
    await expect(dialogue(page).locator('.spoken-line').first()).toHaveText(junWords.walk.hk.long);
    await hold('The wider harbor view brings back Jun’s memory of the restaurant lights.', 7000);
    await page.getByRole('button', { name: 'Look around', exact: true }).click();
    await hold('Take in the night view with the dialogue out of the way.', 5000);
    await openAction(page, 'Head home');
    await hold('Decide to return with the complete home journey still visible.', 5000);
    await page.getByRole('button', { name: 'Check the return route', exact: true }).click();
    await expect(page.locator('.route-loop-directions > button').first()).toHaveAccessibleName(/^Coming home/);
    await expect(page.getByRole('button', { name: /^Coming home/ })).toContainText('19:30–19:45');
    await hold('Unfold the return-first route: the local journey gets us home at 19:45.', 9000);
    await page.getByRole('button', { name: /^Coming home/ }).click();
    await expect(page.locator('.route-note-legs')).toContainText('Local return journey');
    await hold('The optional leg detail spells out the return allowance.', 5000);
    await page.getByRole('button', { name: 'Back to Jun', exact: true }).click();
    await page.getByRole('button', { name: 'Follow the return journey', exact: true }).click();
    await expectHomeScene(page);
    await expect(storyClock(page)).toHaveText('19:45');
    await hold('Arrive at the shared home entryway. The destination and in-person companion stay behind.', 8000);
    await page.getByRole('button', { name: 'Finish the evening', exact: true }).click();
    await expectHomeScene(page);
    await hold('A quiet home ending, with optional practical tools and no recording or collection prompt.', 6000);
    const finished = await readStorySave(page);
    await openAction(page, 'Open phone');
    await expect(dialogue(page).getByRole('heading', { name: 'From Jun', exact: true })).toBeFocused();
    await expect(page.locator('.phone-note-label')).toHaveText('Authored fictional story message');
    await expect(page.locator('.authored-phone-note .spoken-line')).toHaveText(junWords.home.hk.long);
    await hold('Optionally read one authored fictional callback from Jun. It is not a live message or a task to complete.', 11000);
    await page.getByRole('button', { name: 'Put the phone away', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open phone', exact: true })).toBeFocused();
    expect(await readStorySave(page)).toEqual(finished);
    await hold('Put the phone away. The completed evening and quiet room remain unchanged.', 4000);
    expect(errors).toEqual([]);
    complete = true;
  } finally {
    await context.close();
    const basename = `complete-evening-${commit ?? 'local-unidentified'}`;
    const videoPath = path.join(dir, `${basename}.webm`);
    await video.saveAs(videoPath);
    const metadataPath = path.join(dir, `${basename}.json`);
    writeFileSync(metadataPath, JSON.stringify({
      commit, complete, test: testInfo.title,
      viewport: { width: 1440, height: 900 },
      recording: 'Playwright BrowserContext recordVideo; actual browser interactions and original animations',
      scope: 'Complete evening: invitation, inspection, money and route, dinner, walk, return map, shared home and an optional authored fictional callback',
      readingPausesMs: beats.reduce((total, beat) => total + beat.pauseMs, 0),
      elapsedMs: Date.now() - started,
      browserVersion: browser.version(),
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      project: testInfo.project.name, beats, errors,
    }, null, 2));
    await testInfo.attach('Complete evening, recorded in the browser', { path: videoPath, contentType: 'video/webm' });
    await testInfo.attach('Exact commit and complete-evening beats', { path: metadataPath, contentType: 'application/json' });
  }
});
