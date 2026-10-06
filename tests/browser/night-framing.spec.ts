import { test, expect, type Page } from '@playwright/test';
import { selectStoryOption } from '../../src/story/engine';
import {
  chooseDinner, chooseWalk, closeDialogue, depart, dialogue, expectJun, expectHomeScene,
  expectNoOverflow, expectPhase, expectSceneAssets, expectSingleLineMoney,
  expectTouchTarget, openAction, openOptions, readStorySave, showcase, startStory,
  story, storyClock,
} from './story-helpers';

type City = 'hk' | 'sz';
type Framing = 'nearby' | 'wider';
// Inspected regions of the original night paintings: the nearby restaurant,
// harbor water/skyline, or avenue. These are actual artwork bounds, not UI labels.
const regions = {
  hk: {
    nearby: { left: .20, top: .45, right: .35, bottom: .68 },
    wider: { left: .70, top: .38, right: .88, bottom: .60 },
  },
  sz: {
    nearby: { left: .20, top: .49, right: .35, bottom: .69 },
    wider: { left: .52, top: .52, right: .66, bottom: .68 },
  },
} as const;

async function readNightGeometry(page: Page, city: City, framing: Framing) {
  return page.locator('.play-world-image').evaluate((image: HTMLImageElement, region) => {
    const box = image.getBoundingClientRect();
    const scroller = image.closest('.world-scroller')!;
    const viewport = scroller.getBoundingClientRect();
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    const left = box.left + (box.width - width) / 2, top = box.top + (box.height - height) / 2;
    const subject = { left: left + width * region.left, top: top + height * region.top, right: left + width * region.right, bottom: top + height * region.bottom };
    const visible = { left: Math.max(0, viewport.left, subject.left), top: Math.max(0, viewport.top, subject.top), right: Math.min(innerWidth, viewport.right, subject.right), bottom: Math.min(innerHeight, viewport.bottom, subject.bottom) };
    const area = (rect: typeof subject) => Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
    const panel = document.querySelector('dialog[open]')?.getBoundingClientRect();
    const overlap = panel ? area({ left: Math.max(visible.left, panel.left), top: Math.max(visible.top, panel.top), right: Math.min(visible.right, panel.right), bottom: Math.min(visible.bottom, panel.bottom) }) : 0;
    return { imageWidth: width, imageHeight: height, scrollLeft: scroller.scrollLeft, visibleFraction: area(visible) / area(subject), overlapFraction: overlap / area(subject) };
  }, regions[city][framing]);
}

async function captureNight(page: Page, city: City, framing: Framing, filename: string) {
  await expectSceneAssets(page, city === 'hk' ? 'hk-evening-night.webp' : 'sz-evening-night.webp');
  await expectJun(page);
  await expect(story(page)).toHaveAttribute('data-camera', framing);
  await expect(story(page)).toHaveAttribute('data-camera-anchor-x', framing === 'nearby' ? '28' : city === 'hk' ? '79' : '58');
  await expect(page.locator('.play-world-image')).toHaveCSS('object-fit', 'contain');
  await expect.poll(async () => {
    const geometry = await readNightGeometry(page, city, framing);
    return geometry.visibleFraction >= .95 && geometry.overlapFraction <= .01;
  }, { message: 'The attended part of the actual night artwork must be visible and unobscured by the dialogue.' }).toBe(true);
  await expect(page.locator('.play-world')).toHaveCSS('animation-name', 'none');
  await expectNoOverflow(page);
  await showcase(page, filename);
  return readNightGeometry(page, city, framing);
}

async function checkBill(page: Page, amount: string, group: number) {
  await openAction(page, 'Open wallet');
  await expect(dialogue(page).locator('.pocket-facts dd')).toHaveText(['HK$400.00', amount]);
  await expectSingleLineMoney(dialogue(page).locator('.pocket-facts dd'));
  expect(selectStoryOption(await readStorySave(page))?.groupHKD).toBe(group);
  await closeDialogue(page);
}

async function reconsider(page: Page, label: string) {
  await openOptions(page);
  await page.getByRole('button', { name: label, exact: true }).click();
  await closeDialogue(page);
}

async function inspectPhysicalNightSubject(page: Page, city: City) {
  const place = city === 'hk' ? 'the harbor' : 'the avenue';
  const named = page.getByRole('button', { name: `Look at ${place}`, exact: true });
  await named.click();
  await closeDialogue(page);
  await expect(named).toBeFocused();
  const physical = page.getByRole('button', { name: `Look at ${place} in the illustration`, exact: true });
  await expectTouchTarget(physical);
  await expect(physical).toBeInViewport({ ratio: .99 });
  const geometry = await physical.evaluate(element => {
    const image = element.closest('.play-world')!.querySelector('img')!;
    const imageBox = image.getBoundingClientRect(), button = element.getBoundingClientRect();
    const scale = Math.min(imageBox.width / image.naturalWidth, imageBox.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    const x = button.left + button.width / 2, y = button.top + button.height / 2;
    const expectedX = imageBox.left + (imageBox.width - width) / 2 + width * Number(element.getAttribute('data-anchor-x')) / 100;
    const expectedY = imageBox.top + (imageBox.height - height) / 2 + height * Number(element.getAttribute('data-anchor-y')) / 100;
    const hit = document.elementFromPoint(x, y);
    return { dx: x - expectedX, dy: y - expectedY, reachable: hit !== null && element.contains(hit) };
  });
  expect(Math.abs(geometry.dx)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.dy)).toBeLessThanOrEqual(2);
  expect(geometry.reachable).toBe(true);
  await physical.click();
  await expect(dialogue(page).getByRole('heading', { name: city === 'hk' ? 'By the harbor' : 'Along the avenue', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(physical).toBeFocused();
}

for (const width of [1440, 390]) {
  for (const city of ['hk', 'sz'] as const) {
    test(`night framing ${city} ${width}px: nearby and longer walks change the real view and remember the dinner choice`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/'); await startStory(page);
      await depart(page, city === 'hk' ? 'Hong Kong' : 'Shenzhen');
      await chooseDinner(page, 'simple'); await chooseWalk(page, 'short');
      await expect(dialogue(page).getByRole('heading', { name: 'Just outside', exact: true })).toBeFocused();
      await expect(dialogue(page).locator('.spoken-line').first()).toHaveText('A simple dinner, then a small loop nearby.');
      await expect(dialogue(page).locator('.secondary-line')).toHaveText('We can head back from here.');
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '18:30' : '20:00');
      const short = await captureNight(page, city, 'nearby', `night-short-${city}-${width}`);
      await checkBill(page, city === 'hk' ? 'HK$304.00' : 'HK$260.22', city === 'hk' ? 608 : 520.44);
      await page.reload();
      await expectPhase(page, 'walk');
      await expect(page.locator('.world-dialogue')).not.toBeVisible();
      await expectSceneAssets(page, city === 'hk' ? 'hk-evening-night.webp' : 'sz-evening-night.webp');
      await expect.poll(async () => {
        const restored = await readNightGeometry(page, city, 'nearby');
        return Math.abs(restored.imageWidth - short.imageWidth) + Math.abs(restored.scrollLeft - short.scrollLeft);
      }).toBeLessThanOrEqual(2);
      await reconsider(page, 'Reconsider the walk');
      await chooseWalk(page, 'long');
      const longHeading = city === 'hk' ? 'By the water' : 'On the avenue';
      const longWords = city === 'hk' ? 'the longer way by the water.' : 'the longer walk along the avenue.';
      await expect(dialogue(page).getByRole('heading', { name: longHeading, exact: true })).toBeFocused();
      await expect(dialogue(page).locator('.spoken-line').first()).toHaveText(`A simple dinner, then ${longWords}`);
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '19:00' : '20:30');
      const long = await captureNight(page, city, 'wider', `night-long-${city}-${width}`);
      expect(short.imageWidth / long.imageWidth, 'The short loop must use a genuinely closer rendered scale.').toBeGreaterThan(1.04);
      expect(Math.abs(short.scrollLeft - long.scrollLeft), 'The view must actually pan toward the different subject.').toBeGreaterThan(1);
      await checkBill(page, city === 'hk' ? 'HK$304.00' : 'HK$260.22', city === 'hk' ? 608 : 520.44);
      await inspectPhysicalNightSubject(page, city);
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '19:00' : '20:30');
      await reconsider(page, 'Reconsider dinner');
      await chooseDinner(page, 'linger'); await chooseWalk(page, 'long');
      await expect(dialogue(page).locator('.spoken-line').first()).toHaveText(`${city === 'hk' ? 'A shared dessert' : 'One more dish'}, then ${longWords}`);
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '19:30' : '21:00');
      await captureNight(page, city, 'wider', `night-shared-dinner-long-${city}-${width}`);
      await checkBill(page, city === 'hk' ? 'HK$336.00' : 'HK$291.83', city === 'hk' ? 672 : 583.66);
      await reconsider(page, 'Reconsider the walk');
      await openAction(page, 'Step outside');
      await page.getByRole('button', { name: /^Let’s head home now\./ }).click();
      await expectPhase(page, 'home');
      await expect(dialogue(page).getByRole('heading', { name: 'Back home', exact: true })).toBeFocused();
      await expect(dialogue(page).locator('.spoken-line')).not.toContainText(/small loop|longer way|longer walk|we took/i);
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '19:00' : '22:00');
      const direct = await readStorySave(page);
      expect(direct.currentAttempt.walkChoice).toBe('none');
      expect(selectStoryOption(direct)?.walkMinutes).toBe(0);
      expect(selectStoryOption(direct)?.perPersonHKD).toBe(city === 'hk' ? 336 : 291.83);
      // The approved shared-origin ending replaces the destination painting.
      await expectHomeScene(page);
    });
  }
}
