import { test, expect, type Page } from '@playwright/test';
import { selectStoryOption } from '../../src/story/engine';
import { junWords } from './story-fixtures';
import {
  chooseDinner, chooseWalk, closeDialogue, depart, dialogue, expectHomeScene,
  expectNoClippedText, expectNoOverflow, expectUnscrolledDialogueActions,
  openAction, openOptions, readStorySave, returnHome, showcase, startStory, storyClock,
} from './story-helpers';

const storageBytes = (page: Page) => page.evaluate(() => {
  const entries = (storage: Storage) => Object.keys(storage).sort().map(key => [key, storage.getItem(key)]);
  return { local: entries(localStorage), session: entries(sessionStorage) };
});

async function expectAuthoredNote(page: Page, words: string) {
  await expect(dialogue(page).getByRole('heading', { name: 'From Jun', exact: true })).toBeVisible();
  await expect(page.locator('.phone-note-label')).toHaveText('Authored fictional story message');
  await expect(page.locator('.authored-phone-note .spoken-line')).toHaveText(words);
  await expectHomeScene(page);
  await expect(page.getByRole('textbox', { includeHidden: true })).toHaveCount(0);
  await expect(page.locator('.authored-phone-note input, .authored-phone-note textarea, .authored-phone-note [contenteditable="true"], .authored-phone-note [role="log"], .authored-phone-note [role="feed"], .authored-phone-note [role="list"]')).toHaveCount(0);
  await expect(page.locator('.playable-evening [class*="unread"], .playable-evening [class*="badge"], .playable-evening [data-unread]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /reply|save.*message|mark.*read|message history/i, includeHidden: true })).toHaveCount(0);
  await expectUnscrolledDialogueActions(page, ['Check the journey', 'Put the phone away', 'Return to the scene']);
  await expectNoClippedText(dialogue(page));
  await expectNoOverflow(page);
}

for (const width of [390, 360]) {
  for (const city of ['hk', 'sz'] as const) {
    test(`Jun callback ${city} ${width}px: short, long and direct endings stay optional and leave no read state`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/'); await startStory(page);
      await depart(page, city === 'hk' ? 'Hong Kong' : 'Shenzhen');
      await chooseDinner(page, 'simple');
      await expect(dialogue(page).locator('.spoken-line')).toHaveText('That hit the spot. Dinner ran half an hour longer than expected.');
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '18:15' : '19:45');
      await expect(page.locator('.play-event-note')).toContainText('added 30 minutes once');
      for (const walk of ['short', 'long', 'none'] as const) {
        if (walk === 'none') {
          await openAction(page, 'Step outside');
          await page.getByRole('button', { name: /^Let’s head home now\./ }).click();
        } else {
          await chooseWalk(page, walk);
          await expect(dialogue(page).locator('.spoken-line').first()).toHaveText(junWords.walk[city][walk]);
          await returnHome(page);
        }
        await expectHomeScene(page);
        await expectUnscrolledDialogueActions(page, ['Finish the evening', 'Return to the scene']);
        const homeTime = city === 'hk' ? walk === 'short' ? '18:45' : walk === 'long' ? '19:15' : '18:30'
          : walk === 'short' ? '21:45' : walk === 'long' ? '22:15' : '21:30';
        await expect(storyClock(page)).toHaveText(homeTime);
        await page.getByRole('button', { name: 'Finish the evening', exact: true }).click();
        await expect(dialogue(page)).not.toBeVisible();
        const saved = await readStorySave(page);
        expect(saved.currentAttempt.walkChoice).toBe(walk);
        expect(selectStoryOption(saved)?.perPersonHKD).toBe(city === 'hk' ? 304 : 260.22);
        const before = await storageBytes(page);
        // Exercise both the named alternative and the physical phone, including
        // a genuine reopen and keyboard Escape. No helper skips the new note.
        const trigger = page.getByRole('button', { name: walk === 'long' ? 'Open phone in the illustration' : 'Open phone', exact: true });
        await trigger.click();
        await expect(dialogue(page).getByRole('heading', { name: 'From Jun', exact: true })).toBeFocused();
        const words = walk === 'none' ? junWords.direct : junWords.home[city][walk];
        await expectAuthoredNote(page, words);
        if (walk === 'none') await expect(page.locator('.authored-phone-note .spoken-line')).not.toContainText(/walk|water|lights|familiar corner/i);
        await showcase(page, `home-note-${city}-${walk}-${width}`);
        const journey = page.getByRole('button', { name: 'Check the journey', exact: true });
        await journey.click();
        await expect(dialogue(page).getByRole('heading', { name: 'Out and home', exact: true })).toBeFocused();
        await expect(page.locator('.route-note-condition')).toHaveText('Completed in this model');
        await expect(page.locator('.route-note-forecast')).toContainText(`Home ${homeTime}`);
        await expect(page.getByRole('button', { name: /^Going out/ })).toContainText('completed');
        await expect(page.getByRole('button', { name: /^Coming home/ })).toContainText('completed');
        await expect(page.getByRole('radio')).toHaveCount(0);
        await page.getByRole('button', { name: 'Back to the message', exact: true }).click();
        await expect(journey).toBeFocused();
        await expectAuthoredNote(page, words);
        expect(await storageBytes(page)).toEqual(before);
        await page.getByRole('button', { name: 'Put the phone away', exact: true }).click();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expectAuthoredNote(page, words);
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        expect(await storageBytes(page)).toEqual(before);
        await expect(storyClock(page)).toHaveText(homeTime);
        if (walk !== 'none') {
          await openOptions(page);
          await page.getByRole('button', { name: 'Reconsider the walk', exact: true }).click();
          await closeDialogue(page);
        }
      }
      await page.reload();
      await expect(page.locator('.world-dialogue')).not.toBeVisible();
      await openAction(page, 'Open phone');
      await expectAuthoredNote(page, junWords.direct);
    });
  }
}
