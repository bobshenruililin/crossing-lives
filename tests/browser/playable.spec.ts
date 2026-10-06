import { createStoryState } from '../../src/story/engine';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  chooseDinner, chooseWalk, cityPreview, depart, expectNoOverflow,
  expectPhase, expectSceneAssets, readStorySave, returnHome, showcase,
  startStory, storyClock,
} from './story-helpers';

for (const width of [1440, 390, 360]) {
  test(`playable ${width}px: both city endings, real scene assets and preserved previous page`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await startStory(page);
    await expect(storyClock(page)).toHaveText('16:30');
    await expect(page.locator('.play-topline')).toContainText('Room to wander · two fictional adults');
    await expect(page.locator('.play-setup > summary')).toContainText('Includes one fictional 30-minute dinner delay');
    await expectSceneAssets(page, 'two-shores.webp');
    await showcase(page, `gameplay-fork-${width}`);

    await depart(page, 'Hong Kong');
    await expect(storyClock(page)).toHaveText('16:45');
    await expect(page.getByRole('heading', { name: 'How much evening belongs to the table?' })).toBeFocused();
    await expect(page.getByRole('button', { name: /^Dinner, then out\./ })).toContainText('HK$304.00 / person');
    await expect(page.getByRole('button', { name: /^Stay for one more dish\./ })).toContainText('+HK$32.00/person');
    await chooseDinner(page, 'linger');
    await expect(storyClock(page)).toHaveText('18:45');
    await expect(page.locator('.play-event-note')).toHaveText('The disclosed dinner delay has added 30 minutes once. It adds no extra charge.');
    await expect(page.locator('.play-hud')).toContainText('HK$336.00');
    await expectSceneAssets(page, 'hong-kong-evening.webp');
    await showcase(page, `gameplay-committed-meal-${width}`);

    await chooseWalk(page, 'long');
    await expect(storyClock(page)).toHaveText('19:30');
    await expectSceneAssets(page, 'hk-evening-night.webp');
    await page.getByRole('button', { name: 'Remember the conversation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remember the conversation', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await showcase(page, `gameplay-hk-night-${width}`);
    await returnHome(page);
    await expect(storyClock(page)).toHaveText('19:45');
    await expect(page.locator('.play-journal-facts')).toContainText('HK$672.00');
    await expect(page.locator('.play-journal-entries')).toContainText('You left 90 minutes for dinner and added one shared order for the group.');
    await expect(page.locator('.play-journal-entries')).toContainText('You chose to remember the conversation.');
    await page.getByLabel('One sentence to keep').fill('A shared dessert, and a longer walk by the harbor.');
    await expect.poll(async () => (await readStorySave(page)).currentAttempt.journalNote).toBe('A shared dessert, and a longer walk by the harbor.');
    const firstAttempt = (await readStorySave(page)).currentAttempt;
    const firstScenario = (await readStorySave(page)).baseInputs;
    await expectSceneAssets(page, 'hk-evening-night.webp');
    await showcase(page, `gameplay-hk-journal-${width}`);

    await page.getByRole('button', { name: 'Try the other evening from the fork', exact: true }).click();
    await expectPhase(page, 'fork');
    await expect(storyClock(page)).toHaveText('16:30');
    await expect(cityPreview(page, 'Shenzhen')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.play-returning-note')).toContainText('The first evening stays in your notebook.');
    await expect(page.locator('.play-setup')).toHaveCount(0);
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt });
    expect((await readStorySave(page)).baseInputs).toEqual(firstScenario);
    await expectSceneAssets(page, 'shenzhen-evening.webp');
    await showcase(page, `gameplay-other-city-${width}`);

    await page.getByRole('button', { name: 'Make Shenzhen our evening', exact: true }).click();
    await expectPhase(page, 'arrival');
    await expect(storyClock(page)).toHaveText('18:15');
    await chooseDinner(page, 'simple');
    await expect(storyClock(page)).toHaveText('19:45');
    await expect(page.locator('.play-hud')).toContainText('HK$260.22');
    await chooseWalk(page, 'short');
    await expect(storyClock(page)).toHaveText('20:00');
    await expectSceneAssets(page, 'sz-evening-night.webp');
    await page.getByRole('button', { name: 'Keep the view', exact: true }).click();
    await showcase(page, `gameplay-sz-night-${width}`);
    await returnHome(page);
    await expect(storyClock(page)).toHaveText('21:45');
    await expect(page.locator('.play-journal-facts')).toContainText('HK$520.44');
    await expect(page.locator('.play-unresolved')).toContainText('Entry eligibility is unconfirmed');
    await expect(page.getByRole('heading', { name: 'Different choices. Kept side by side.' })).toBeVisible();
    const previousPage = page.locator('.play-attempt-comparison article').filter({ has: page.getByRole('heading', { name: 'Hong Kong', exact: true }) });
    const currentPage = page.locator('.play-attempt-comparison article').filter({ has: page.getByRole('heading', { name: 'Shenzhen', exact: true }) });
    await expect(previousPage).toContainText('90 min + shared order');
    await expect(previousPage).toContainText('45 minutes');
    await expect(previousPage).toContainText('19:45');
    await expect(previousPage).toContainText('HK$336.00');
    await expect(currentPage).toContainText('60 min, no shared order');
    await expect(currentPage).toContainText('15 minutes');
    await expect(currentPage).toContainText('HK$260.22');
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt });
    await expectSceneAssets(page, 'sz-evening-night.webp');
    await showcase(page, `gameplay-two-journals-${width}`);

    // The previous attempt includes its own commitments, note and scenario, even after reload and rewind.
    await page.reload();
    await page.getByRole('button', { name: 'Continue your saved evening', exact: true }).click();
    await expectPhase(page, 'home');
    await expect(previousPage).toContainText('HK$336.00');
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt, baseInputs: firstScenario });
    await page.getByRole('button', { name: 'Reconsider the walk', exact: true }).click();
    await expectPhase(page, 'afterDinner');
    await expect.poll(async () => (await readStorySave(page)).previousAttempt).toMatchObject({ ...firstAttempt });
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  });
}

test('each committed phase reloads and rewinds with exact clock and no repeated delay', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await startStory(page);
  await cityPreview(page, 'Hong Kong').click();
  await page.getByRole('button', { name: 'Inspect the harbor in the illustration', exact: true }).click();
  const restore = async (phase: Parameters<typeof expectPhase>[1], clock: string) => {
    await page.reload();
    await page.getByRole('button', { name: 'Continue your saved evening', exact: true }).click();
    await expectPhase(page, phase);
    await expect(storyClock(page)).toHaveText(clock);
  };
  await restore('fork', '16:30');
  await expect(page.getByRole('region', { name: 'Scene detail' })).toContainText('Leave a little room for the water.');
  await page.getByRole('button', { name: 'Make Hong Kong our evening', exact: true }).click();
  await restore('arrival', '16:45');
  await chooseDinner(page, 'simple');
  await restore('afterDinner', '18:15');
  await expect(page.locator('.play-event-note')).toContainText('added 30 minutes once');
  await chooseWalk(page, 'long');
  await page.getByRole('button', { name: 'Keep the view', exact: true }).click();
  await restore('walk', '19:00');
  await expect(page.getByRole('button', { name: 'Keep the view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await returnHome(page);
  await page.getByLabel('One sentence to keep').fill('Keep this first version until I rewind.');
  await restore('home', '19:15');
  await expect(page.getByLabel('One sentence to keep')).toHaveValue('Keep this first version until I rewind.');
  await expect(page.locator('.play-journal-entries li').filter({ hasText: 'The fictional dinner ran 30 minutes longer' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Reconsider the walk', exact: true }).click();
  await expectPhase(page, 'afterDinner');
  await expect(storyClock(page)).toHaveText('18:15');
  await expect.poll(async () => (await readStorySave(page)).currentAttempt).toMatchObject({ dinnerChoice: 'simple', walkChoice: null, memento: null, journalNote: '' });
  await chooseWalk(page, 'short');
  await returnHome(page);
  await expect(storyClock(page)).toHaveText('18:45');
  await expect(page.getByLabel('One sentence to keep')).toHaveValue('');
  await page.getByRole('button', { name: 'Reconsider dinner', exact: true }).click();
  await expectPhase(page, 'arrival');
  await expect(storyClock(page)).toHaveText('16:45');
  await chooseDinner(page, 'linger');
  await expect(storyClock(page)).toHaveText('18:45');
  await expect(page.locator('.play-hud')).toContainText('HK$336.00');
  await page.getByRole('button', { name: 'Rewind to the fork', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect(storyClock(page)).toHaveText('16:30');
  await expect.poll(async () => (await readStorySave(page)).currentAttempt).toMatchObject({ city: null, dinnerChoice: null, walkChoice: null, memento: null, journalNote: '' });
  await expect(cityPreview(page, 'Hong Kong')).toHaveAttribute('aria-pressed', 'true');
});

test('short-evening deadline remains a tentative ending and a rewind recovers 30 minutes', async ({ page }) => {
  await page.goto('/');
  await startStory(page);
  await page.locator('.play-setup > summary').click();
  await page.getByRole('button', { name: /^A short evening/ }).click();
  await expect(page.locator('.play-setup > summary')).toContainText('17:00–20:00');
  await depart(page, 'Hong Kong');
  const linger = page.getByRole('button', { name: /^Stay for one more dish\./ });
  await expect(linger).toContainText('15 min beyond the home deadline.');
  await expect(linger).toBeEnabled();
  await chooseDinner(page, 'linger');
  await chooseWalk(page, 'long');
  await expect(page.locator('.play-projection')).toContainText('15 minutes beyond this story’s deadline.');
  await returnHome(page);
  await expect(storyClock(page)).toHaveText('20:15');
  await expect(page.locator('.play-unresolved')).toContainText('Home at 20:15, 15 minutes after the deadline.');
  await expect(page.locator('.play-journal-entries')).toContainText('15 minutes after the chosen home deadline.');
  await page.getByRole('button', { name: 'Reconsider the walk', exact: true }).click();
  await expect(storyClock(page)).toHaveText('19:15');
  const shortWalk = page.getByRole('button', { name: /^Make it a small loop\./ });
  await expect(shortWalk).toContainText('Home 19:45');
  await expect(shortWalk).toContainText('Same bill');
  await chooseWalk(page, 'short');
  await expect(page.locator('.play-projection')).toContainText('15 minutes inside this story’s deadline.');
  await returnHome(page);
  await expect(storyClock(page)).toHaveText('19:45');
  await expect(page.locator('.play-hud')).toContainText('HK$336.00');
  await expect(page.locator('.play-unresolved')).toHaveCount(0);
});

test('keyboard scene inspection is free, skip link is offscreen unless focused, reduced motion completes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  const hiddenBounds = (await skip.boundingBox())!;
  expect(hiddenBounds.y + hiddenBounds.height).toBeLessThanOrEqual(0);
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Between home', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'The story', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expectPhase(page, 'fork');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await cityPreview(page, 'Hong Kong').focus();
  await page.keyboard.press('Enter');
  const tableHotspot = page.getByRole('button', { name: 'Inspect the table in the illustration', exact: true });
  await expect(page.locator('.play-hud > span:nth-child(3) strong')).toHaveText('HK$304.00');
  await tableHotspot.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Scene detail' })).toContainText('A table, and a choice.');
  await expect(storyClock(page)).toHaveText('16:30');
  await expectPhase(page, 'fork');
  await expect(tableHotspot).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.play-hud > span:nth-child(3) strong')).toHaveText('HK$304.00');
  await cityPreview(page, 'Shenzhen').focus();
  await page.keyboard.press('Enter');
  const homeInspection = page.getByRole('group', { name: 'Scene inspections' }).getByRole('button', { name: 'The way home', exact: true });
  await homeInspection.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Scene detail' })).toContainText('Real entry eligibility, transport services and queues remain unverified.');
  await expect(storyClock(page)).toHaveText('16:30');
  await expect.poll(async () => (await readStorySave(page)).currentAttempt.inspectedHotspots).toEqual(['hk:table', 'sz:home']);
  await page.getByRole('button', { name: 'Make Shenzhen our evening', exact: true }).click();
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await expectSceneAssets(page, 'sz-evening-night.webp');
  await returnHome(page);
  await expect(page.locator('.play-journal-entries')).toContainText('Still to verify before real travel: entry eligibility');
});

test('story route and explicit familiarity copy to planner while real entry stays unchecked', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Your evening', exact: true }).click();
  const entry = page.getByRole('checkbox', { name: /everyone in this group/ });
  await entry.check();
  await expect(entry).toBeChecked();
  await startStory(page);
  await cityPreview(page, 'Shenzhen').click();
  const routes = page.getByRole('group', { name: 'Shenzhen crossing route' });
  await expect(routes.getByRole('button', { name: /^Rail · Lo Wu/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(routes.getByRole('button', { name: /^Rail · Lo Wu/ })).toContainText('1h 45m out');
  await routes.getByRole('button', { name: /^Road · Lok Ma Chau/ }).click();
  await expect(routes.getByRole('button', { name: /^Road · Lok Ma Chau/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.play-departure-preview')).toContainText('Arrival 18:45');
  await expect(storyClock(page)).toHaveText('16:30');
  await page.locator('.play-familiarity > summary').click();
  await expect(page.getByRole('combobox',{name:'This dinner in Shenzhen',exact:true})).toHaveValue('unsure');
  await expect(page.getByRole('combobox',{name:'This wander in Shenzhen',exact:true})).toHaveValue('unsure');
  await page.getByRole('combobox',{name:'This dinner in Shenzhen',exact:true}).selectOption('new');
  await page.getByRole('button', { name: 'Make Shenzhen our evening', exact: true }).click();
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await returnHome(page);
  await expect(storyClock(page)).toHaveText('22:45');
  await expect(page.locator('.play-unresolved')).toContainText('Entry eligibility is unconfirmed');
  await page.getByRole('button', { name: 'Inspect this model in the practical planner', exact: true }).click();
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
  await expect(page.locator('.option-sz').getByRole('combobox',{name:'This dinner feels',exact:true})).toHaveValue('new');
  await expect(page.locator('.option-sz').getByRole('combobox',{name:'This wander feels',exact:true})).toHaveValue('unsure');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your saved evening', exact: true }).click();
  await expect(entry).not.toBeChecked();
  await page.getByRole('button', { name: 'The story', exact: true }).click();
  await expectPhase(page, 'home');
  await expect(storyClock(page)).toHaveText('22:45');
});

test('fresh-story dialog can cancel, and confirmed reset keeps the separate planner intact', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Your evening', exact: true }).click();
  await page.getByLabel('Budget per person').fill('500');
  await startStory(page);
  await depart(page, 'Hong Kong');
  await chooseDinner(page, 'linger');
  await chooseWalk(page, 'long');
  await returnHome(page);
  await page.getByLabel('One sentence to keep').fill('Only reset this after confirmation.');
  const startFresh = page.getByRole('button', { name: 'Start a fresh evening', exact: true });
  await startFresh.click();
  const dialog = page.getByRole('dialog', { name: 'Begin a fresh story?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep these pages', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('One sentence to keep')).toHaveValue('Only reset this after confirmation.');
  await startFresh.click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(startFresh).toBeFocused();
  await startFresh.click();
  await dialog.getByRole('button', { name: 'Start a fresh story', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect(storyClock(page)).toHaveText('16:30');
  await expect.poll(async () => (await readStorySave(page)).previousAttempt).toBeNull();
  await page.getByRole('button', { name: 'Your evening', exact: true }).click();
  await expect(page.getByLabel('Budget per person')).toHaveValue('500');
});

test('corrupt playable save recovers separately from the valid planner', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Your evening', exact: true }).click();
  await page.getByLabel('Budget per person').fill('500');
  await page.evaluate(() => localStorage.setItem('between-playable-v2', 'not valid JSON'));
  await startStory(page);
  await expect(page.locator('.play-storage-notice')).toContainText('This saved story could not be restored.');
  expect(await page.evaluate(()=>localStorage.getItem('between-playable-v2'))).toBe('not valid JSON');
  await expectPhase(page, 'fork');
  await depart(page, 'Hong Kong');
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await returnHome(page);
  await page.getByRole('button', { name: 'Your evening', exact: true }).click();
  await expect(page.getByLabel('Budget per person')).toHaveValue('500');
  expect(await page.evaluate(()=>localStorage.getItem('between-playable-v2'))).toBe('not valid JSON');
});

test('unavailable story storage keeps both endings usable and warns without claiming a save', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await startStory(page);
  await expect(page.locator('.play-storage-notice')).toContainText('This browser cannot save the story.');
  await depart(page, 'Hong Kong');
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await returnHome(page);
  await page.getByLabel('One sentence to keep').fill('An in-tab page still works.');
  // In-tab navigation must retain the whole attempt even when persistence is unavailable.
  for (const destination of ['Research desk', 'Your evening', 'Back to the cover']) {
    await page.getByRole('button', {name: destination==='Research desk' ? /^Research desk/ : destination, exact: destination!=='Research desk'}).click();
    await page.getByRole('button', {name:'The story',exact:true}).click();
    await expectPhase(page,'home');
    await expect(storyClock(page)).toHaveText('18:45');
    await expect(page.getByLabel('One sentence to keep')).toHaveValue('An in-tab page still works.');
    await expect(page.locator('.play-journal-facts')).toContainText('HK$608.00');
  }

  await page.getByRole('button', { name: 'Try the other evening from the fork', exact: true }).click();
  await depart(page, 'Shenzhen');
  await chooseDinner(page, 'linger');
  await chooseWalk(page, 'long');
  await returnHome(page);
  await expect(page.getByRole('heading', { name: 'Different choices. Kept side by side.' })).toBeVisible();
  await expect(page.locator('.play-storage-notice')).toContainText('reloading or closing it will lose these pages.');
  await page.reload();
  await startStory(page);
  await expectPhase(page,'fork');
  await expect(storyClock(page)).toHaveText('16:30');
  await expect(page.locator('.play-returning-note')).toHaveCount(0);
});

test('new playable phases have no critical or serious accessibility violations', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await startStory(page);
  const audit = async (phase: string) => {
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter(violation => ['critical', 'serious'].includes(violation.impact ?? '')), `Accessibility violations in ${phase}`).toEqual([]);
  };
  await audit('fork');
  await depart(page, 'Hong Kong');
  await audit('arrival');
  await chooseDinner(page, 'linger');
  await audit('after dinner');
  await chooseWalk(page, 'long');
  await audit('walk');
  await returnHome(page);
  await audit('home');
});


test('future-version story bytes are preserved until an explicit fresh-story reset', async ({page}) => {
  const futureRaw=JSON.stringify({...createStoryState(),version:3,importantFutureNote:'Keep these original bytes'});
  await page.addInitScript(raw=>localStorage.setItem('between-playable-v2',raw),futureRaw);
  await page.goto('/');
  await startStory(page);
  await expect(page.locator('.play-storage-notice')).toContainText('The original saved data is untouched.');
  expect(await page.evaluate(()=>localStorage.getItem('between-playable-v2'))).toBe(futureRaw);
  await depart(page,'Hong Kong');
  await chooseDinner(page,'simple');
  await chooseWalk(page,'short');
  await returnHome(page);
  await page.getByLabel('One sentence to keep').fill('This is a temporary in-tab page.');
  await page.getByRole('button',{name:/^Research desk/}).click();
  await page.getByRole('button',{name:'The story',exact:true}).click();
  await expectPhase(page,'home');
  await expect(page.getByLabel('One sentence to keep')).toHaveValue('This is a temporary in-tab page.');
  expect(await page.evaluate(()=>localStorage.getItem('between-playable-v2'))).toBe(futureRaw);
  await page.getByRole('button',{name:'Start a fresh evening',exact:true}).click();
  await page.getByRole('dialog',{name:'Begin a fresh story?'}).getByRole('button',{name:'Start a fresh story',exact:true}).click();
  await expectPhase(page,'fork');
  await expect.poll(async()=>JSON.parse((await page.evaluate(()=>localStorage.getItem('between-playable-v2')))!).version).toBe(2);
  await expect(page.locator('.play-storage-notice')).toHaveCount(0);
});

test('a restored next-day deadline is labelled consistently in the story HUD',async({page})=>{
  const nextDay=createStoryState('wander',{baseInputs:{departureMinutes:23*60,homeByMinutes:60}});
  await page.addInitScript(saved=>localStorage.setItem('between-playable-v2',JSON.stringify(saved)),nextDay);
  await page.goto('/');
  await startStory(page);
  await expect(page.locator('.play-deadline')).toContainText('Home by 01:00 (+1d)');
  await expect(page.locator('.play-setup > summary')).toContainText('23:00–01:00 (+1d)');
});
