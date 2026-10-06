import { test, expect, type Locator, type Page } from '@playwright/test';
import { selectStoryInputs } from '../../src/story/engine';
import { legacyCompletedStory, seedLegacyPlanner, seedStory } from './story-fixtures';
import {
  chooseDinner, chooseWalk, closeDialogue, depart, dialogue, expectHomeScene,
  expectNoClippedText, expectNoOverflow, expectPhase, expectUnscrolledDialogueActions,
  openAction, openPlanner, readStorySave, returnHome, showcase, startStory, storyClock,
} from './story-helpers';

const importButton = (page: Page) => page.getByRole('button', { name: 'Use this evening in planner', exact: true });
const bytes = (page: Page) => page.evaluate(() => ({
  story: localStorage.getItem('between-playable-v2'),
  plan: localStorage.getItem('between-journal-v1'),
  session: Object.keys(sessionStorage).sort().map(key => [key, sessionStorage.getItem(key)]),
}));

async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 16 && !(await target.evaluate(element => element === document.activeElement)); count += 1) await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
}

async function modifyPracticalPlan(page: Page) {
  await openPlanner(page);
  await page.getByLabel('Budget per person').fill('777');
  await page.getByRole('button', { name: 'One more person', exact: true }).click();
  await page.getByLabel('Starting neighborhood').selectOption('island');
  await page.getByLabel('Leave at', { exact: true }).fill('18:00');
  await page.getByLabel('Home by', { exact: true }).fill('22:00');
  await page.locator('.assumptions > summary').click();
  await page.getByLabel('Shenzhen route', { exact: true }).selectOption('bus');
  await page.getByRole('checkbox', { name: /everyone in this group/ }).check();
}

async function expectPracticalInputs(page: Page, imported: boolean) {
  await expect(page.getByRole('heading', { name: 'Shape your evening', exact: true })).toBeVisible();
  await expect(page.getByLabel('Budget per person')).toHaveValue(imported ? '400' : '777');
  await expect(page.locator('.party-field output')).toHaveText(imported ? '2' : '3');
  await expect(page.getByLabel('Starting neighborhood')).toHaveValue(imported ? 'kowloon' : 'island');
  await expect(page.getByLabel('Leave at', { exact: true })).toHaveValue(imported ? '16:30' : '18:00');
  await expect(page.getByLabel('Home by', { exact: true })).toHaveValue(imported ? '23:30' : '22:00');
  if (!(await page.locator('.assumptions').evaluate((element: HTMLDetailsElement) => element.open))) await page.locator('.assumptions > summary').click();
  await expect(page.getByLabel('Shenzhen route', { exact: true })).toHaveValue(imported ? 'rail' : 'bus');
  const eligibility = page.getByRole('checkbox', { name: /everyone in this group/ });
  if (imported) await expect(eligibility).not.toBeChecked();
  else await expect(eligibility).toBeChecked();
  if (imported) {
    await page.locator('.option-sz .outing-settings > summary').click();
    await expect(page.locator('.option-sz').getByLabel('Dinner in Shenzhen · minutes', { exact: true })).toHaveValue('60');
    await expect(page.locator('.option-sz').getByLabel('Wander in Shenzhen · minutes', { exact: true })).toHaveValue('15');
    await expect(page.locator('.option-sz').getByLabel('Authored scenario delay · minutes', { exact: true })).toHaveValue('30');
  }
}

async function expectConsent(page: Page) {
  await expect(dialogue(page).getByRole('heading', { name: 'Use this evening in planner?', exact: true })).toBeFocused();
  await expect(dialogue(page)).toContainText('This replaces your separate plan inputs with this evening’s inputs. Your story and older saved notes stay as they are.');
  await expect(dialogue(page)).toContainText('The planner recalculates the other city from this evening’s starting assumptions, rather than comparing saved playthroughs.');
  await expectUnscrolledDialogueActions(page, ['Replace plan and explore', 'Keep my plan', 'Return to Wallet']);
  await expectNoClippedText(dialogue(page)); await expectNoOverflow(page);
}

async function expectCancelled(page: Page) {
  await expect(dialogue(page).getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();
  await expect(importButton(page)).toBeFocused();
  await expect(importButton(page)).toBeInViewport({ ratio: 1 });
  await expect(storyClock(page)).toHaveText('21:45');
}

for (const width of [360, 390]) {
  test(`planner import ${width}px: every cancel preserves modified plan bytes; only explicit confirmation transfers inputs`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 844 });
    const saved = legacyCompletedStory({ city: 'sz', dinner: 'simple', walk: 'short', note: 'Mock older story note must survive planner import.' });
    const practical = await seedLegacyPlanner(page, 'Mock older practical note must survive replacement of inputs.');
    await seedStory(page, saved);
    await page.goto('/'); await startStory(page);
    await modifyPracticalPlan(page); await expectPracticalInputs(page, false);
    await startStory(page); await openAction(page, 'Open wallet');
    const before = await bytes(page);
    const oldPlan = JSON.parse(before.plan!);
    expect(oldPlan.inputs).toMatchObject({ budgetPerPersonHKD: 777, partySize: 3, origin: 'island', szRoute: 'bus' });
    expect(await readStorySave(page)).toEqual(saved);
    for (const cancel of ['Keep my plan', 'Escape', 'Return to Wallet', 'backdrop']) {
      await tabTo(page, importButton(page));
      await page.keyboard.press('Enter');
      await expectConsent(page);
      expect(await bytes(page)).toEqual(before);
      if (cancel === 'Keep my plan') {
        await showcase(page, `planner-import-confirmation-${width}`);
        await tabTo(page, page.getByRole('button', { name: cancel, exact: true }));
        await page.keyboard.press('Space');
      } else if (cancel === 'Escape') await page.keyboard.press('Escape');
      else if (cancel === 'backdrop') {
        const box = (await dialogue(page).boundingBox())!;
        expect(box.x).toBeGreaterThan(2);
        await page.mouse.click(2, 2);
      } else await page.getByRole('button', { name: cancel, exact: true }).click();
      await expectCancelled(page);
      expect(await bytes(page)).toEqual(before);
      expect(await readStorySave(page)).toEqual(saved);
    }
    await page.keyboard.press('Enter');
    await expectConsent(page);
    await tabTo(page, page.getByRole('button', { name: 'Replace plan and explore', exact: true }));
    await page.keyboard.press('Space');
    await expectPracticalInputs(page, true);
    const after = await bytes(page);
    expect(after.story).toBe(before.story);
    expect(after.session).toEqual(before.session);
    const imported = JSON.parse(after.plan!);
    expect(imported).toEqual({ ...oldPlan, mode: 'explore', inputs: selectStoryInputs(saved) });
    expect(imported.notes).toBe(practical.notes);
    await startStory(page); await expectHomeScene(page);
    await expect(storyClock(page)).toHaveText('21:45');
    expect(await readStorySave(page)).toEqual(saved);
  });
}

test('blocked storage preserves edited practical inputs on cancel and transfers only after explicit confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await page.goto('/'); await startStory(page);
  await modifyPracticalPlan(page); await startStory(page);
  await depart(page, 'Shenzhen'); await chooseDinner(page, 'simple'); await chooseWalk(page, 'short'); await returnHome(page);
  await openAction(page, 'Open wallet');
  await importButton(page).click(); await expectConsent(page);
  await page.keyboard.press('Escape'); await expectCancelled(page);
  await importButton(page).click();
  await page.getByRole('button', { name: 'Keep my plan', exact: true }).click();
  await expectCancelled(page);
  await closeDialogue(page); await openPlanner(page); await expectPracticalInputs(page, false);
  await expect(page.locator('.storage-notice')).toContainText('Saving is unavailable');
  await startStory(page); await expectPhase(page, 'home'); await expect(storyClock(page)).toHaveText('21:45');
  await openAction(page, 'Open wallet');
  await expect(dialogue(page).locator('.pocket-facts dd')).toHaveText(['HK$400.00', 'HK$260.22']);
  await importButton(page).click(); await expectConsent(page);
  await page.getByRole('button', { name: 'Replace plan and explore', exact: true }).click();
  await expectPracticalInputs(page, true);
  await expect(page.locator('.storage-notice')).toContainText('Saving is unavailable');
  await startStory(page); await expectHomeScene(page); await expect(storyClock(page)).toHaveText('21:45');
});
