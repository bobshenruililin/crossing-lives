import { test, expect, type Locator, type Page } from '@playwright/test';
import { createStoryState } from '../../src/story/engine';
import { seedStory } from './story-fixtures';
import {
  advanceDialogue, chooseWalk, cityPreview, closeDialogue, depart, dialogue,
  expectClock, expectJun, expectNoClippedText, expectNoOverflow, expectPhase, expectTouchTarget,
  openAction, openOptions, readStorySave, returnHome, showcase, startStory, story,
} from './story-helpers';

async function expectVisibleTargets(scope: Locator) {
  for (const target of await scope.locator('button:visible, summary:visible, select:visible').all()) await expectTouchTarget(target);
}

async function expectAnchoredHotspot(page: Page, name: string) {
  const hotspot = page.getByRole('button', { name: `Look at ${name} in the illustration`, exact: true });
  await expectTouchTarget(hotspot);
  await expect(hotspot, 'Named place controls pan the corresponding physical hotspot into view.').toBeInViewport({ ratio: 0.99 });
  const geometry = await page.locator('.play-world-image').evaluate((image: HTMLImageElement) => {
    const rect = image.getBoundingClientRect();
    const scale = getComputedStyle(image).objectFit === 'cover'
      ? Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
      : Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
  });
  const rect = (await hotspot.boundingBox())!;
  const x = Number(await hotspot.getAttribute('data-anchor-x')) / 100;
  const y = Number(await hotspot.getAttribute('data-anchor-y')) / 100;
  expect(Math.abs(rect.x + rect.width / 2 - (geometry.x + geometry.width * x)), 'Panning must keep the hotspot on the same point of the artwork.').toBeLessThanOrEqual(2);
  expect(Math.abs(rect.y + rect.height / 2 - (geometry.y + geometry.height * y))).toBeLessThanOrEqual(2);
  expect(await hotspot.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit !== null && element.contains(hit);
  }), 'The revealed hotspot remains reachable rather than covered by another control.').toBe(true);
}

for (const width of [1440, 390, 360]) {
  test(`world controls ${width}px: free observations, focus return, inert utilities and 44px targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await startStory(page);
    await cityPreview(page, 'Hong Kong').click();
    const before = await readStorySave(page);
    await expectVisibleTargets(story(page));
    const inspect = page.getByRole('button', { name: 'Look at the table', exact: true });
    await inspect.click();
    await expect(dialogue(page).getByRole('heading', { name: 'By the table', exact: true })).toBeFocused();
    await expectJun(page);
    await expect(page.locator('.world-interface')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open wallet', exact: true })).toHaveCount(0);
    await expectVisibleTargets(dialogue(page));
    await expectNoClippedText(dialogue(page));
    await advanceDialogue(page);
    await expect(dialogue(page)).toContainText('HK$248');
    for (let count = 0; count < 8; count += 1) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();
      expect(await focused.evaluate(element => element.closest('dialog') !== null)).toBe(true);
      await expect(focused).toBeInViewport();
    }
    await page.keyboard.press('Escape');
    await expect(dialogue(page)).not.toBeVisible();
    await expect(inspect).toBeFocused();
    await expectAnchoredHotspot(page, 'the table');
    await expectClock(page, '16:30');
    expect(await readStorySave(page)).toEqual({ ...before, openHotspot: null, currentAttempt: { ...before.currentAttempt, inspectedHotspots: ['hk:table'] } });

    const harbor = page.getByRole('button', { name: 'Look at the harbor', exact: true });
    await harbor.click();
    await advanceDialogue(page);
    await closeDialogue(page);
    await expect(harbor).toBeFocused();
    await expectAnchoredHotspot(page, 'the harbor');
    await expectClock(page, '16:30');
    const afterLooks = await readStorySave(page);
    await openOptions(page);
    await page.locator('.story-setup > summary').click();
    await expectVisibleTargets(dialogue(page));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Story options', exact: true })).toBeFocused();
    expect(await readStorySave(page)).toEqual(afterLooks);
    await openOptions(page);
    await closeDialogue(page);
    expect(await readStorySave(page)).toEqual(afterLooks);
    await expectPhase(page, 'fork');
    await expectNoOverflow(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

    await cityPreview(page, 'Shenzhen').click();
    const scroller = page.locator('.world-scroller');
    const table = page.getByRole('button', { name: 'Look at the table', exact: true });
    await table.click();
    await closeDialogue(page);
    const tableScroll = await scroller.evaluate(element => element.scrollLeft);
    await expectAnchoredHotspot(page, 'the table');
    await page.getByRole('button', { name: 'Look at the way home', exact: true }).click();
    await advanceDialogue(page);
    await expect(dialogue(page)).toContainText('Real entry eligibility');
    await closeDialogue(page);
    await expectAnchoredHotspot(page, 'the way home');
    const homeScroll = await scroller.evaluate(element => element.scrollLeft);
    if (width < 640) expect(homeScroll, 'The phone scene pans across the same shared artwork plane.').toBeGreaterThan(tableScroll + 50);
    await expectClock(page, '16:30');
    await expectNoOverflow(page);
    await showcase(page, `world-pan-way-home-${width}`);
  });
}

test('200% equivalent reflow preserves naturally scrollable dialogue and essential warnings', async ({ page }) => {
  // 1440×900 at 200% page zoom exposes 720×450 CSS pixels. Testing this layout
  // directly avoids misrepresenting deviceScaleFactor as browser zoom.
  await page.setViewportSize({ width: 720, height: 450 });
  await seedStory(page, createStoryState('short'));
  await page.goto('/');
  await startStory(page);
  await openOptions(page);
  await page.locator('.story-setup > summary').click();
  await expectNoClippedText(dialogue(page));
  await expectNoOverflow(page);
  await closeDialogue(page);
  await depart(page, 'Shenzhen');
  await openAction(page, 'Read the menu');
  const dinner = page.getByRole('button', { name: /^Let’s have one more dish\./ });
  await expect(dinner).toContainText('beyond the home deadline');
  await expectNoClippedText(dinner);
  await expectNoClippedText(dialogue(page));
  await expectNoOverflow(page);
  await dinner.click();
  await expectNoClippedText(page.locator('.play-event-note'));
  await chooseWalk(page, 'long');
  await returnHome(page);
  await expect(dialogue(page)).toContainText('entry eligibility');
  await expectNoClippedText(page.locator('.commit-caveats'));
  await expectNoClippedText(dialogue(page));
  await expectNoOverflow(page);
  await showcase(page, 'world-reflow-200-percent-warning');
  await page.keyboard.press('Escape');
  await expect(dialogue(page)).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Try the other evening', exact: true })).toBeVisible();
  await openOptions(page);
  await page.getByRole('button', { name: 'Reconsider the walk', exact: true }).click();
  await expectPhase(page, 'afterDinner');
  await expect(dialogue(page).getByRole('heading', { name: 'A little walk?', exact: true })).toBeFocused();
  await expectNoOverflow(page);
});
