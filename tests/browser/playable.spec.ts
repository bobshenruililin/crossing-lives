import { createStoryState, selectStoryOption, storyReducer } from '../../src/story/engine';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { junWords, legacyCompletedStory, seedStory, seedStoryRaw, STORY_KEY } from './story-fixtures';
import {
  chooseDinner, chooseWalk, cityPreview, closeDialogue, depart, dialogue,
  expectClock, expectJun, expectHomeScene, expectFictionCaption, expectNoClippedText, expectNoOverflow, expectPhase, expectSceneAssets, expectUnscrolledDialogueActions, expectWorldViewport,
  openAction, openOptions, openPlanner, openResearch, readStorySave, returnHome, showcase, startStory,
} from './story-helpers';

async function expectBill(page: Parameters<typeof openAction>[0], perPerson: string, group?: string) {
  await openAction(page, 'Open wallet');
  await expect(dialogue(page)).toContainText(perPerson);
  if (group) expect(selectStoryOption(await readStorySave(page))?.groupHKD).toBe(Number(group.replace(/[^0-9.]/g, '')));
  await closeDialogue(page);
}

async function rewind(page: Parameters<typeof openOptions>[0], label: string, phase: Parameters<typeof expectPhase>[1]) {
  await openOptions(page);
  await page.getByRole('button', { name: label, exact: true }).click();
  await expectPhase(page, phase);
  await closeDialogue(page);
}


for (const width of [1440, 390, 360]) {
  test(`world ${width}px: contextual choices, exact costs and both real night assets`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto('/');
    await expect(dialogue(page).getByRole('heading', { name: 'Dinner, then a walk?', exact: true })).toBeFocused();
    await expectJun(page);
    await expect(dialogue(page).locator('.spoken-line')).toHaveText(junWords.invitation);
    await expectUnscrolledDialogueActions(page, ['Let’s stay nearby.', 'Let’s cross for dinner.', 'Look around first', 'Return to the scene']);
    await expectNoClippedText(dialogue(page));
    await showcase(page, `initial-invitation-${width}`);
    await startStory(page);
    await expectPhase(page, 'fork');
    await expectSceneAssets(page, 'hong-kong-evening.webp');
    await expectWorldViewport(page, `exploration-${width}`);
    await expectClock(page, '16:30');
    await cityPreview(page, 'Hong Kong').click();
    await closeDialogue(page);
    await expectSceneAssets(page, 'hong-kong-evening.webp');
    await expectWorldViewport(page, `world-hk-preview-${width}`);
    await depart(page, 'Hong Kong');
    await expectClock(page, '16:45');
    await expectWorldViewport(page, `world-hk-arrival-${width}`);
    await openAction(page, 'Read the menu');
    await expectJun(page);
    const simpleMeal = page.getByRole('button', { name: /^Let’s keep dinner simple\./ });
    const sharedMeal = page.getByRole('button', { name: /^Let’s have one more dish\./ });
    await expect(simpleMeal).toContainText('60 minutes');
    await expect(simpleMeal).toContainText('about HK$304/person');
    await expect(sharedMeal).toContainText('90 minutes');
    await expect(sharedMeal).toContainText('about HK$336/person');
    await showcase(page, `world-hk-menu-${width}`);
    await page.getByRole('button', { name: /^Let’s have one more dish\./ }).click();
    await expectPhase(page, 'afterDinner');
    await expectClock(page, '18:45');
    await expectBill(page, 'HK$336.00', 'HK$672.00');
    await openAction(page, 'Step outside');
    await expectJun(page);
    await expect(page.getByRole('button', { name: /^A short loop sounds good\./ })).toContainText('Home 19:15');
    await expect(page.getByRole('button', { name: /^A short loop sounds good\./ })).toContainText('15 minutes');
    await expect(page.getByRole('button', { name: /^A short loop sounds good\./ })).toContainText('about HK$336/person');
    await expect(page.getByRole('button', { name: /^Let’s take the longer walk\./ })).toContainText('Home 19:45');
    await expect(page.getByRole('button', { name: /^Let’s take the longer walk\./ })).toContainText('45 minutes');
    await expect(page.getByRole('button', { name: /^Let’s take the longer walk\./ })).toContainText('about HK$336/person');
    await showcase(page, `world-hk-after-dinner-${width}`);
    await page.getByRole('button', { name: /^Let’s take the longer walk\./ }).click();
    await expectPhase(page, 'walk');
    await expectClock(page, '19:30');
    await expectSceneAssets(page, 'hk-evening-night.webp');
    await expectWorldViewport(page, `world-hk-night-${width}`);
    await returnHome(page);
    await expectHomeScene(page);
    await expectFictionCaption(page);
    await expectUnscrolledDialogueActions(page, ['Finish the evening', 'Return to the scene']);
    await showcase(page, `home-arrival-from-hk-${width}`);
    await expectClock(page, '19:45');
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /memento|Remember the conversation|Keep the view/i })).toHaveCount(0);
    const firstAttempt = (await readStorySave(page)).currentAttempt;
    const firstInputs = (await readStorySave(page)).baseInputs;

    await page.getByRole('button', { name: 'Try the other evening', exact: true }).click();
    await expectPhase(page, 'fork');
    await expectClock(page, '16:30');
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt });
    expect((await readStorySave(page)).baseInputs).toEqual(firstInputs);
    await expectSceneAssets(page, 'shenzhen-evening.webp');
    await expectWorldViewport(page, `world-sz-preview-${width}`);
    await depart(page, 'Shenzhen');
    await expectClock(page, '18:15');
    await expectWorldViewport(page, `world-sz-arrival-${width}`);
    await openAction(page, 'Read the menu');
    await expect(page.getByRole('button', { name: /^Let’s keep dinner simple\./ })).toContainText('60 minutes');
    await expect(page.getByRole('button', { name: /^Let’s keep dinner simple\./ })).toContainText('about HK$260/person');
    await expect(page.getByRole('button', { name: /^Let’s have one more dish\./ })).toContainText('90 minutes');
    await expect(page.getByRole('button', { name: /^Let’s have one more dish\./ })).toContainText('about HK$292/person');
    await page.getByRole('button', { name: /^Let’s keep dinner simple\./ }).click();
    await expectPhase(page, 'afterDinner');
    await expect(dialogue(page).getByRole('heading', { level: 2 })).toBeFocused();
    await expectClock(page, '19:45');
    await expectBill(page, 'HK$260.22', 'HK$520.44');
    await openAction(page, 'Step outside');
    await showcase(page, `world-sz-after-dinner-${width}`);
    await closeDialogue(page);
    await chooseWalk(page, 'short');
    await expectClock(page, '20:00');
    await expectSceneAssets(page, 'sz-evening-night.webp');
    await expectWorldViewport(page, `world-sz-night-${width}`);
    await returnHome(page);
    await expectHomeScene(page);
    await expectFictionCaption(page);
    await expectUnscrolledDialogueActions(page, ['Finish the evening', 'Return to the scene']);
    await showcase(page, `home-arrival-from-sz-${width}`);
    await expectClock(page, '21:45');
    await openAction(page, 'Open phone');
    await page.getByRole('button', { name: 'Check the journey', exact: true }).click();
    await expect(page.locator('.route-note-uncertainty')).toContainText(/entry.*unconfirmed|entry.*unverified|verify.*entry/i);
    await closeDialogue(page);
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt });
    await page.reload();
    await startStory(page);
    await expectPhase(page, 'home');
    await expectClock(page, '21:45');
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt, baseInputs: firstInputs });
    await rewind(page, 'Reconsider the walk', 'afterDinner');
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt });
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  });
}

test('each committed phase quietly resumes and rewinds with exact clock and no repeated delay', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  // Inspect the first arrival before the convenience helper can dismiss anything.
  await expect(dialogue(page).getByRole('heading', { name: 'Dinner, then a walk?', exact: true })).toBeFocused();
  await expectJun(page);
  await expect(page.getByRole('button', { name: 'Let’s stay nearby.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Let’s cross for dinner.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Look around first', exact: true })).toBeVisible();
  await startStory(page);
  await cityPreview(page, 'Hong Kong').click();
  await closeDialogue(page);
  const restore = async (phase: Parameters<typeof expectPhase>[1], clock: string) => {
    await page.reload();
    await expectPhase(page, phase);
    // A stored phase resumes quietly; do not let startStory hide a regressed invitation.
    await expect(page.locator('.world-dialogue')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dinner, then a walk?', exact: true })).toHaveCount(0);
    await startStory(page);
    await expectClock(page, clock);
    if (phase === 'home') {
      // At the shared origin the phone remains useful; Jun is no longer present.
      await openAction(page, 'Open phone');
      await expect(dialogue(page).getByRole('heading', { name: 'From Jun', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Check the journey', exact: true }).click();
      await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeFocused();
      await expectHomeScene(page);
    } else {
      await openAction(page, phase === 'arrival' || phase === 'afterDinner' ? 'Talk with Jun in the illustration' : 'Talk with Jun');
      const titles = { fork: 'Shall we eat here?', arrival: 'The menu', afterDinner: 'A little walk?', walk: 'Time to head back?' };
      await expect(dialogue(page).getByRole('heading', { name: titles[phase], exact: true })).toBeFocused();
      await expectJun(page);
    }
    await closeDialogue(page);
  };
  await restore('fork', '16:30');
  await depart(page, 'Hong Kong');
  await restore('arrival', '16:45');
  await chooseDinner(page, 'simple');
  await restore('afterDinner', '18:15');
  await chooseWalk(page, 'long');
  await restore('walk', '19:00');
  await returnHome(page);
  await restore('home', '19:15');
  await rewind(page, 'Reconsider the walk', 'afterDinner');
  await expectClock(page, '18:15');
  await expect.poll(async () => (await readStorySave(page)).currentAttempt).toMatchObject({ dinnerChoice: 'simple', walkChoice: null, memento: null, journalNote: '' });
  await chooseWalk(page, 'short');
  await returnHome(page);
  await expectClock(page, '18:45');
  await rewind(page, 'Reconsider dinner', 'arrival');
  await expectClock(page, '16:45');
  await chooseDinner(page, 'linger');
  await expectClock(page, '18:45');
  await expectBill(page, 'HK$336.00', 'HK$672.00');
  await rewind(page, 'Rewind to the fork', 'fork');
  await expectClock(page, '16:30');
  await expect.poll(async () => (await readStorySave(page)).currentAttempt).toMatchObject({ city: null, dinnerChoice: null, walkChoice: null, memento: null, journalNote: '' });
});

test('short-evening warning stays tentative and an ordinary rewind recovers thirty minutes', async ({ page }) => {
  await page.goto('/');
  await startStory(page);
  await openOptions(page);
  await page.locator('.story-setup > summary').click();
  await page.getByRole('button', { name: /^A short evening/ }).click();
  await expect(page.locator('.story-setup')).toContainText('17:00–20:00');
  await expect.poll(async () => (await readStorySave(page)).presetId).toBe('short');
  await closeDialogue(page);
  await expectClock(page, '17:00');
  await depart(page, 'Hong Kong');
  await openAction(page, 'Read the menu');
  const linger = page.getByRole('button', { name: /^Let’s have one more dish\./ });
  await expect(linger).toContainText('15 min beyond the home deadline');
  await expect(linger).toBeEnabled();
  await linger.click();
  await chooseWalk(page, 'long');
  await returnHome(page);
  await expectClock(page, '20:15');
  await openAction(page, 'Open phone');
  await page.getByRole('button', { name: 'Check the journey', exact: true }).click();
  await expect(page.locator('.route-note-warnings')).toContainText(/15.*after|15.*beyond/);
  await closeDialogue(page);
  await rewind(page, 'Reconsider the walk', 'afterDinner');
  await expectClock(page, '19:15');
  await openAction(page, 'Step outside');
  const short = page.getByRole('button', { name: /^A short loop sounds good\./ });
  await expect(short).toContainText('Home 19:45');
  await expect(short).toContainText('15 minutes');
  await expect(short).toContainText('about HK$336/person');
  await expect(page.getByRole('button', { name: /^Let’s take the longer walk\./ })).toContainText('about HK$336/person');
  await short.click();
  await returnHome(page);
  await expectClock(page, '19:45');
  await expectBill(page, 'HK$336.00', 'HK$672.00');
  expect(selectStoryOption(await readStorySave(page))?.homeFeasible).toBe(true);
});

test('explicit story-to-planner transfer copies route and familiarity but never attests entry', async ({ page }) => {
  let state = createStoryState();
  state = storyReducer(state, { type: 'SET_FAMILIARITY', city: 'sz', activity: 'dinner', value: 'new' });
  await seedStory(page, state);
  await page.goto('/');
  await startStory(page);
  await openPlanner(page);
  const entry = page.getByRole('checkbox', { name: /everyone in this group/ });
  await entry.check();
  await expect(entry).toBeChecked();
  await startStory(page);
  await cityPreview(page, 'Shenzhen').click();
  await closeDialogue(page);
  await openAction(page, 'Talk about dinner');
  await page.getByRole('button', { name: 'Change route', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Rail via Lo Wu', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: /^Going out/ })).toContainText('1h 45m');
  await page.getByRole('radio', { name: 'Bus via Lok Ma Chau road crossing', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Bus via Lok Ma Chau road crossing', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: /^Going out/ })).toContainText('2h 15m');
  await expect(page.locator('.route-note-forecast')).toContainText('modeled home 23:15');
  await page.getByRole('button', { name: 'Back to Jun', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change route', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Take the road route', exact: true }).click();
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await returnHome(page);
  await expectClock(page, '22:45');
  await openPlanner(page, true);
  await expect(entry).not.toBeChecked();
  await expect(page.getByLabel('Leave at', { exact: true })).toHaveValue('16:30');
  await expect(page.locator('.party-field output')).toHaveText('2');
  await expect(page.locator('.option-sz .option-route')).toContainText('Lok Ma Chau road crossing');
  await expect(page.locator('.option-sz .option-reasons')).toContainText('Entry eligibility is unconfirmed');
  await page.locator('.option-sz .outing-settings > summary').click();
  await expect(page.getByLabel('Dinner in Shenzhen · minutes', { exact: true })).toHaveValue('60');
  await expect(page.getByLabel('Wander in Shenzhen · minutes', { exact: true })).toHaveValue('15');
  await expect(page.getByLabel('Authored scenario delay · minutes', { exact: true })).toHaveValue('30');
  await expect(page.getByRole('checkbox', { name: 'Include one optional shared order of dishes', exact: true })).not.toBeChecked();
  await expect(page.locator('.option-sz').getByRole('combobox', { name: 'This dinner feels', exact: true })).toHaveValue('new');
  await expect(page.locator('.option-sz').getByRole('combobox', { name: 'This wander feels', exact: true })).toHaveValue('unsure');
  await page.reload();
  await startStory(page);
  await expectPhase(page, 'home');
  await expectClock(page, '22:45');
  await openPlanner(page);
  await expect(entry).not.toBeChecked();
});

test('older completed notes quietly survive reload and navigation; reset still requires confirmation', async ({ page }) => {
  const old = legacyCompletedStory();
  await seedStory(page, old);
  await page.goto('/');
  await startStory(page);
  await expectPhase(page, 'home');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText(old.currentAttempt.journalNote, { exact: true })).toHaveCount(0);
  await openPlanner(page);
  await page.getByLabel('Budget per person').fill('500');
  await startStory(page);
  expect((await readStorySave(page)).currentAttempt).toEqual(old.currentAttempt);
  await page.reload();
  await startStory(page);
  expect((await readStorySave(page)).currentAttempt).toEqual(old.currentAttempt);
  await openOptions(page);
  await page.getByRole('button', { name: 'Start a fresh evening', exact: true }).click();
  await expect(dialogue(page)).toContainText('Begin a fresh evening?');
  await page.getByRole('button', { name: 'Keep this evening', exact: true }).click();
  expect((await readStorySave(page)).currentAttempt).toEqual(old.currentAttempt);
  await openOptions(page);
  await page.getByRole('button', { name: 'Start a fresh evening', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Story options', exact: true })).toBeFocused();
  expect((await readStorySave(page)).currentAttempt).toEqual(old.currentAttempt);
  await openOptions(page);
  await page.getByRole('button', { name: 'Start a fresh evening', exact: true }).click();
  await page.getByRole('button', { name: 'Start a fresh story', exact: true }).click();
  await expectPhase(page, 'fork');
  await expectClock(page, '16:30');
  await expect.poll(async () => (await readStorySave(page)).previousAttempt).toBeNull();
  await openPlanner(page);
  await expect(page.getByLabel('Budget per person')).toHaveValue('500');
});

test('corrupt story bytes survive play while independent valid planner inputs remain accessible', async ({ page }) => {
  await seedStoryRaw(page, 'not valid JSON');
  await page.goto('/');
  await startStory(page);
  await openPlanner(page);
  await page.getByLabel('Budget per person').fill('500');
  await startStory(page);
  await openOptions(page);
  await expect(dialogue(page)).toContainText('original saved data is untouched');
  await closeDialogue(page);
  await depart(page, 'Hong Kong');
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await returnHome(page);
  await openPlanner(page);
  await expect(page.getByLabel('Budget per person')).toHaveValue('500');
  expect(await page.evaluate(key => localStorage.getItem(key), STORY_KEY)).toBe('not valid JSON');
});

test('blocked storage retains both in-tab endings through planner, research and home navigation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await startStory(page);
  await depart(page, 'Hong Kong');
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await returnHome(page);
  for (const destination of ['research', 'planner', 'home']) {
    if (destination === 'research') await openResearch(page);
    else {
      await openPlanner(page);
      if (destination === 'home') await page.getByRole('button', { name: 'Between home', exact: true }).click();
    }
    await startStory(page);
    await expectPhase(page, 'home');
    await expectClock(page, '18:45');
    await expectBill(page, 'HK$304.00');
  }
  await page.getByRole('button', { name: 'Try the other evening', exact: true }).click();
  await depart(page, 'Shenzhen');
  await chooseDinner(page, 'linger');
  await chooseWalk(page, 'long');
  await returnHome(page);
  await expectClock(page, '22:45');
  await openOptions(page);
  await expect(dialogue(page)).toContainText('reloading or closing it will lose these pages');
  await closeDialogue(page);
  await page.reload();
  await startStory(page);
  await expectPhase(page, 'fork');
  await expectClock(page, '16:30');
});

test('world and contextual dialogue phases have no critical or serious accessibility violations', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await startStory(page);
  const audit = async (phase: string) => {
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter(violation => ['critical', 'serious'].includes(violation.impact ?? '')), `Accessibility violations in ${phase}`).toEqual([]);
  };
  await audit('quiet world');
  await cityPreview(page, 'Hong Kong').click();
  await closeDialogue(page);
  await openAction(page, 'Talk about dinner');
  await audit('destination conversation');
  await page.getByRole('button', { name: 'Head to the table', exact: true }).click();
  await openAction(page, 'Read the menu');
  await audit('meal conversation');
  await page.getByRole('button', { name: /^Let’s have one more dish\./ }).click();
  await openAction(page, 'Step outside');
  await audit('walk conversation');
  await page.getByRole('button', { name: /^Let’s take the longer walk\./ }).click();
  await openAction(page, 'Head home');
  await audit('return conversation');
  await page.getByRole('button', { name: 'Follow the return journey', exact: true }).click();
  await audit('ordinary home ending');
});

test('future-version story bytes remain unchanged until explicit fresh-story reset', async ({ page }) => {
  const futureRaw = JSON.stringify({ ...createStoryState(), version: 3, importantFutureNote: 'Keep these original bytes' });
  await seedStoryRaw(page, futureRaw);
  await page.goto('/');
  await startStory(page);
  await depart(page, 'Hong Kong');
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await returnHome(page);
  await openResearch(page);
  await startStory(page);
  await expectPhase(page, 'home');
  expect(await page.evaluate(key => localStorage.getItem(key), STORY_KEY)).toBe(futureRaw);
  await openOptions(page);
  await expect(dialogue(page)).toContainText('original saved data is untouched');
  await page.getByRole('button', { name: 'Start a fresh evening', exact: true }).click();
  await page.getByRole('button', { name: 'Start a fresh story', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect.poll(async () => (await readStorySave(page)).version).toBe(2);
});

test('next-day deadline remains explicitly labelled in the optional phone view', async ({ page }) => {
  await seedStory(page, createStoryState('wander', { baseInputs: { departureMinutes: 23 * 60, homeByMinutes: 60 } }));
  await page.goto('/');
  await startStory(page);
  // The schematic needs a selected city; the actual next-day deadline is unchanged.
  await cityPreview(page, 'Hong Kong').click();
  await openAction(page, 'Open phone');
  await expect(dialogue(page)).toContainText('01:00 (+1d)');
});

test('an empty-string story save is preserved as corrupt data rather than treated as absent', async ({ page }) => {
  await seedStoryRaw(page, '');
  await page.goto('/');
  await startStory(page);
  await openOptions(page);
  await expect(dialogue(page)).toContainText('original saved data is untouched');
  await closeDialogue(page);
  await cityPreview(page, 'Hong Kong').click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORY_KEY)).toBe('');
});

test('explicit app reset wins in this tab when removal fails without destroying old saved note bytes', async ({ page }) => {
  const old = legacyCompletedStory({ dinner: 'simple', walk: 'short', note: 'The older saved page.' });
  await seedStory(page, old);
  await page.addInitScript(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key: string) {
      if (key === 'between-playable-v2') throw new DOMException('Removal blocked', 'SecurityError');
      return original.call(this, key);
    };
  });
  await page.goto('/');
  await startStory(page);
  await openPlanner(page);
  await page.getByRole('button', { name: 'Replay the story', exact: true }).click();
  await page.getByRole('button', { name: 'Reset and replay', exact: true }).click();
  await startStory(page);
  await expectPhase(page, 'fork');
  await expectClock(page, '16:30');
  await openOptions(page);
  await expect(dialogue(page)).toContainText('could not clear its saved copy');
  await closeDialogue(page);
  expect((await readStorySave(page)).currentAttempt.journalNote).toBe(old.currentAttempt.journalNote);
  await openResearch(page);
  await startStory(page);
  await expectPhase(page, 'fork');
  await openOptions(page);
  await expect(dialogue(page)).toContainText('older copy may return after a reload');
});

for (const city of ['Hong Kong', 'Shenzhen'] as const) {
  test(`${city}: free observations follow committed dinner and walk, then home leaves the destination behind`, async ({ page }) => {
    await page.goto('/');
    await startStory(page);
    await depart(page, city);
    const inspect = async (place: string, first: RegExp, second: RegExp) => {
      await closeDialogue(page);
      const before = await readStorySave(page);
      const bill = selectStoryOption(before)?.perPersonHKD;
      const clock = await page.getByLabel('Story clock', { exact: true }).innerText();
      await page.getByRole('button', { name: `Look at ${place}`, exact: true }).click();
      await expect(dialogue(page).locator('.spoken-line')).toHaveText(first);
      await expectJun(page);
      await page.getByRole('button', { name: 'Continue dialogue', exact: true }).click();
      await expect(dialogue(page).locator('.spoken-line')).toHaveText(second);
      await expect(dialogue(page)).not.toContainText('There’s no need to decide yet.');
      await expect(dialogue(page)).not.toContainText('when you sit down');
      await expect(page.getByLabel('Story clock', { exact: true })).toHaveText(clock);
      await closeDialogue(page);
      const after = await readStorySave(page);
      expect({ ...after.currentAttempt, inspectedHotspots: [] }).toEqual({ ...before.currentAttempt, inspectedHotspots: [] });
      expect(after.baseInputs).toEqual(before.baseInputs);
      expect(selectStoryOption(after)?.perPersonHKD).toBe(bill);
      expect(after.openHotspot).toBeNull();
    };
    await chooseDinner(page, 'linger');
    await inspect('the table', city === 'Hong Kong' ? /We stayed for one shared dessert\./ : /We stayed for a shared order\./, /The dinner choice was 90 minutes, plus the fictional 30-minute delay\./);
    await chooseWalk(page, 'long');
    const shore = city === 'Hong Kong' ? 'harbor' : 'avenue';
    await inspect(`the ${shore}`, new RegExp(`We took the 45-minute walk along the ${shore}\\.`), /We can head back when you’re ready\./);
    await returnHome(page);
    // Destination table/harbor/avenue observations no longer exist at home.
    // Keep the committed observation checks above and verify truthful continuity.
    await expectHomeScene(page);
    await expect(page.getByLabel('Story clock', { exact: true })).toHaveText(city === 'Hong Kong' ? '19:45' : '22:45');
    await showcase(page, `home-after-observations-${city === 'Hong Kong' ? 'hk' : 'sz'}`);
    await expectBill(page, city === 'Hong Kong' ? 'HK$336.00' : 'HK$291.83');
  });
}

test('calm short Shenzhen evening never promises spare walking time after the deadline is already lost', async ({ page }) => {
  await page.goto('/');
  await startStory(page);
  await openOptions(page);
  await page.locator('.story-setup > summary').click();
  await page.getByRole('button', { name: /^A short evening/ }).click();
  await page.getByRole('checkbox', { name: 'Include one fictional 30-minute dinner delay', exact: true }).uncheck();
  await expect.poll(async () => (await readStorySave(page)).delayScenario).toBe('none');
  await closeDialogue(page);
  await depart(page, 'Shenzhen');
  await chooseDinner(page, 'simple');
  await expect(page.getByLabel('Story clock', { exact: true })).toHaveText('19:45');
  await expect(dialogue(page)).not.toContainText('There’s still time for a walk.');
  // Jun's approved dinner response replaces the former step-outside line, but
  // must still avoid claiming spare time when even direct return is late.
  await expect(dialogue(page).locator('.spoken-line')).toHaveText('That hit the spot.');
  await expect(page.locator('.play-event-note')).toContainText('No fictional delay is applied.');
  await openAction(page, 'Step outside');
  const short = page.getByRole('button', { name: /^A short loop sounds good\./ });
  const long = page.getByRole('button', { name: /^Let’s take the longer walk\./ });
  await expect(short).toContainText('Home 21:45');
  await expect(short).toContainText('105 min beyond the home deadline');
  await expect(long).toContainText('Home 22:15');
  await expect(long).toContainText('135 min beyond the home deadline');
  await expect(short).toContainText('15 minutes');
  await expect(long).toContainText('45 minutes');
  await expect(short).toContainText('about HK$260/person');
  await expect(long).toContainText('about HK$260/person');
  const direct = page.getByRole('button', { name: /^Let’s head home now\./ });
  await expect(direct).toContainText('Home 21:30');
  await expect(direct).toContainText('90 min beyond the home deadline');
  await expect(direct).toContainText('about HK$260/person');
  await expect(direct.locator('.choice-warning')).toBeVisible();
  await expect(short).toBeEnabled();
  await expect(long).toBeEnabled();
  await expect(short.locator('.choice-warning')).toBeVisible();
  await expect(long.locator('.choice-warning')).toBeVisible();
  await showcase(page, 'world-calm-short-shenzhen-late-choices');
  await short.click();
  await returnHome(page);
  await expectClock(page, '21:45');
  await rewind(page, 'Reconsider the walk', 'afterDinner');
  await openAction(page, 'Step outside');
  await page.getByRole('button', { name: /^Let’s head home now\./ }).click();
  await expectPhase(page, 'home');
  await expectClock(page, '21:30');
});

for (const city of ['Hong Kong', 'Shenzhen'] as const) {
  test(`${city}: returning directly after dinner skips the walk, keeps the bill and can be reconsidered`, async ({ page }) => {
    await page.goto('/');
    await startStory(page);
    await depart(page, city);
    await chooseDinner(page, 'simple');
    const before = await readStorySave(page);
    const beforeOption = selectStoryOption(before)!;
    const directHome = city === 'Hong Kong' ? '18:30' : '21:30';
    const shortHome = city === 'Hong Kong' ? '18:45' : '21:45';
    const direct = page.getByRole('button', { name: /^Let’s head home now\./ });
    await expect(direct).toContainText(`Home ${directHome}`);
    await expect(direct).toContainText('No walk');
    await expect(direct).toContainText(city === 'Hong Kong' ? 'about HK$304/person' : 'about HK$260/person');
    if (city === 'Shenzhen') await expect(direct).toContainText('Real entry eligibility');
    await direct.click();
    await expectPhase(page, 'home');
    await expect(dialogue(page).getByRole('heading', { name: 'Back home', exact: true })).toBeFocused();
    await expectClock(page, directHome);
    const after = await readStorySave(page);
    const option = selectStoryOption(after)!;
    expect(after.currentAttempt.walkChoice).toBe('none');
    expect(option.walkMinutes).toBe(0);
    expect(option.storyDelayMinutes).toBe(30);
    expect(option.perPersonHKD).toBe(beforeOption.perPersonHKD);
    expect(option.groupHKD).toBe(beforeOption.groupHKD);
    await expectBill(page, city === 'Hong Kong' ? 'HK$304.00' : 'HK$260.22');
    await expectHomeScene(page);
    const homePhone = page.getByRole('button', { name: 'Open phone in the illustration', exact: true });
    await homePhone.click();
    await expect(dialogue(page).getByRole('heading', { name: 'From Jun', exact: true })).toBeFocused();
    await expect(dialogue(page).locator('.authored-phone-note .spoken-line')).toHaveText(junWords.direct);
    await page.getByRole('button', { name: 'Check the journey', exact: true }).click();
    await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Whole-outing cost detail', exact: true }).click();
    await expect(page.locator('.route-note-detail')).toContainText('No walk · chosen direct return');
    await closeDialogue(page);
    await expect(homePhone).toBeFocused();
    await page.reload();
    await expectPhase(page, 'home');
    await expect(page.locator('.world-dialogue')).not.toBeVisible();
    await expectClock(page, directHome);
    await expectHomeScene(page);
    expect((await readStorySave(page)).currentAttempt.walkChoice).toBe('none');
    await rewind(page, 'Reconsider the walk', 'afterDinner');
    expect((await readStorySave(page)).currentAttempt.walkChoice).toBeNull();
    await chooseWalk(page, 'short');
    await returnHome(page);
    await expectClock(page, shortHome);
    await expectBill(page, city === 'Hong Kong' ? 'HK$304.00' : 'HK$260.22');
  });
}

test('rewinding an older saved detail requires confirmation and cancel preserves exact state', async ({ page }) => {
  const old = legacyCompletedStory({ note: 'An older detail that must survive a canceled rewind.' });
  await seedStory(page, old);
  await page.goto('/');
  await startStory(page);
  for (const cancel of ['keep', 'close', 'escape']) {
    await openOptions(page);
    await page.getByRole('button', { name: 'Reconsider the walk', exact: true }).click();
    await expect(dialogue(page).getByRole('heading', { name: 'Clear an older saved detail?', exact: true })).toBeFocused();
    await expect(dialogue(page)).toContainText('Rewinding will clear an older saved note or detail');
    if (cancel === 'keep') await page.getByRole('button', { name: 'Keep this evening', exact: true }).click();
    else if (cancel === 'close') await page.getByRole('button', { name: 'Return to the scene', exact: true }).click();
    else await page.keyboard.press('Escape');
    await expect(dialogue(page).getByRole('heading', { name: 'Story options', exact: true })).toBeVisible();
    expect(await readStorySave(page)).toEqual(old);
  }
  await page.getByRole('button', { name: 'Reconsider the walk', exact: true }).click();
  await page.getByRole('button', { name: 'Clear older detail and continue', exact: true }).click();
  await expectPhase(page, 'afterDinner');
  await expect.poll(async () => (await readStorySave(page)).currentAttempt).toMatchObject({ dinnerChoice: 'linger', walkChoice: null, journalNote: '', memento: null });
  await expectClock(page, '18:45');
});

test('replacing a previous legacy detail is explicit while cancel leaves both evenings intact', async ({ page }) => {
  let state = storyReducer(legacyCompletedStory({ note: 'The previous page must not disappear silently.' }), { type: 'TRY_OTHER_CITY' });
  state = storyReducer(state, { type: 'COMMIT_DEPARTURE', city: 'sz' });
  state = storyReducer(state, { type: 'COMMIT_DINNER', choice: 'simple' });
  state = storyReducer(state, { type: 'RETURN_AFTER_DINNER' });
  await seedStory(page, state);
  await page.goto('/');
  await startStory(page);
  const again = page.getByRole('button', { name: 'Try the other evening', exact: true });
  await again.click();
  await expect(dialogue(page)).toContainText('Continuing will replace an older saved note or detail from the previous evening.');
  await page.keyboard.press('Escape');
  await expect(again).toBeFocused();
  expect(await readStorySave(page)).toEqual(state);
  await again.click();
  await page.getByRole('button', { name: 'Keep this evening', exact: true }).click();
  await expect(again).toBeFocused();
  expect(await readStorySave(page)).toEqual(state);
  await again.click();
  await page.getByRole('button', { name: 'Clear older detail and continue', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...state.currentAttempt });
  expect((await readStorySave(page)).currentAttempt.id).toBe(state.currentAttempt.id + 1);
});
