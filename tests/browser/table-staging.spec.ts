import { test, expect, type Locator, type Page } from '@playwright/test';
import { tableObjects, tableScenes } from '../../src/data/scene-art';
import {
  chooseDinner, closeDialogue, depart, dialogue, expectJun, expectNoClippedText,
  expectNoOverflow, expectPhase, expectSceneAssets, expectTouchTarget, openAction,
  readStorySave, showcase, startStory, story, storyClock,
} from './story-helpers';

type TableObject = keyof typeof tableObjects;
// Bounds inspected in both original WebPs: the face or actual prop, not merely
// an interaction anchor. Secondary Jun may be outside a prop-focused composition.
const subjects: Record<TableObject, { left: number; top: number; right: number; bottom: number }> = {
  jun: { left: .456, top: .12, right: .606, bottom: .42 },
  menu: { left: .13, top: .74, right: .532, bottom: .955 },
  phone: { left: .544, top: .752, right: .658, bottom: .865 },
  wallet: { left: .654, top: .803, right: .84, bottom: .974 },
};

async function readSubjectGeometry(page: Page, object: TableObject) {
  return page.locator('.play-world-image').evaluate((image: HTMLImageElement, subject) => {
    const imageBox = image.getBoundingClientRect();
    const scroller = image.closest('.world-scroller')!.getBoundingClientRect();
    const dialogue = document.querySelector('dialog[open]')!.getBoundingClientRect();
    const scale = Math.min(imageBox.width / image.naturalWidth, imageBox.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const left = imageBox.left + (imageBox.width - width) / 2;
    const top = imageBox.top + (imageBox.height - height) / 2;
    const bounds = { left: left + width * subject.left, top: top + height * subject.top, right: left + width * subject.right, bottom: top + height * subject.bottom };
    const visible = { left: Math.max(0, scroller.left, bounds.left), top: Math.max(0, scroller.top, bounds.top), right: Math.min(innerWidth, scroller.right, bounds.right), bottom: Math.min(innerHeight, scroller.bottom, bounds.bottom) };
    const area = (rect: typeof bounds) => Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
    const overlap = { left: Math.max(visible.left, dialogue.left), top: Math.max(visible.top, dialogue.top), right: Math.min(visible.right, dialogue.right), bottom: Math.min(visible.bottom, dialogue.bottom) };
    return { visibleFraction: area(visible) / area(bounds), dialogueOverlapFraction: area(overlap) / area(bounds) };
  }, subjects[object]);
}

async function captureAttention(page: Page, object: TableObject, filename: string) {
  await expect(story(page)).toHaveAttribute('data-attended-object', object);
  await expect(dialogue(page)).toHaveClass(/\btable-dialogue\b/);
  await expect(page.locator('.play-world-image')).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('.jun-avatar')).toHaveCount(0);
  await expect.poll(async () => {
    const geometry = await readSubjectGeometry(page, object);
    return geometry.visibleFraction >= .95 && geometry.dialogueOverlapFraction <= .01;
  }, { message: `The attended ${object === 'jun' ? 'face' : object} must remain visible and uncovered by its dialogue.` }).toBe(true);
  const geometry = await readSubjectGeometry(page, object);
  expect(geometry.visibleFraction).toBeGreaterThanOrEqual(.95);
  expect(geometry.dialogueOverlapFraction).toBeLessThanOrEqual(.01);
  await expectNoClippedText(dialogue(page));
  await expectNoOverflow(page);
  await showcase(page, filename);
}

async function expectPhysicalControl(page: Page, object: TableObject) {
  const control = page.locator(`[data-scene-object="${object}"]`);
  await expectTouchTarget(control);
  await expect(control).toBeInViewport({ ratio: .99 });
  const measured = await control.evaluate((element, anchor) => {
    const image = element.closest('.play-world')!.querySelector('img')!;
    const imageBox = image.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const scale = Math.min(imageBox.width / image.naturalWidth, imageBox.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const left = imageBox.left + (imageBox.width - width) / 2;
    const top = imageBox.top + (imageBox.height - height) / 2;
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { dx: x - (left + width * anchor.x / 100), dy: y - (top + height * anchor.y / 100), reachable: hit !== null && element.contains(hit) };
  }, tableObjects[object]);
  expect(Math.abs(measured.dx)).toBeLessThanOrEqual(2);
  expect(Math.abs(measured.dy)).toBeLessThanOrEqual(2);
  expect(measured.reachable, 'The physical table control must not be covered by the named controls.').toBe(true);
  return control;
}

for (const width of [1440, 390, 360]) {
  for (const city of ['hk', 'sz'] as const) {
    test(`table staging ${city} ${width}px: arrival, menu, wallet and phone attend the actual painted subject`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto('/');
      await startStory(page);
      await depart(page, city === 'hk' ? 'Hong Kong' : 'Shenzhen');
      await expectSceneAssets(page, tableScenes[city].image);
      await expectJun(page);
      const before = await readStorySave(page);
      await captureAttention(page, 'jun', `table-arrival-${city}-${width}`);
      await page.getByRole('button', { name: 'Read the menu', exact: true }).click();
      await captureAttention(page, 'menu', `table-menu-${city}-${width}`);
      await closeDialogue(page);
      await expect(story(page)).not.toHaveAttribute('data-table-framed', 'true');
      await (await expectPhysicalControl(page, 'menu')).click();
      await expect(dialogue(page).getByRole('heading', { name: 'The menu', exact: true })).toBeFocused();
      await closeDialogue(page);
      for (const object of ['wallet', 'phone'] as const) {
        await openAction(page, `Open ${object}`);
        await captureAttention(page, object, `table-${object}-${city}-${width}`);
        if (object === 'wallet') await expect(dialogue(page)).toContainText(city === 'hk' ? 'HK$304.00' : 'HK$260.22');
        await closeDialogue(page);
        await expect(story(page)).not.toHaveAttribute('data-table-framed', 'true');
        await (await expectPhysicalControl(page, object)).click();
        await expect(story(page)).toHaveAttribute('data-attended-object', object);
        await closeDialogue(page);
      }
      await openAction(page, 'Talk with Jun');
      await closeDialogue(page);
      await (await expectPhysicalControl(page, 'jun')).click();
      await expect(story(page)).toHaveAttribute('data-attended-object', 'jun');
      await closeDialogue(page);
      expect(await readStorySave(page)).toEqual(before);
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '16:45' : '18:15');
      await chooseDinner(page, 'simple');
      await expectSceneAssets(page, tableScenes[city].image);
      await expectJun(page);
      await captureAttention(page, 'jun', `table-after-dinner-${city}-${width}`);
    });
  }
}

async function expectImmediatelyUsable(control: Locator) {
  // Check current state before retrying assertions or screenshots can conceal
  // a timer-based disable. An image animation must not gate the next action.
  expect(await control.isEnabled()).toBe(true);
  expect(await control.evaluate(element => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (node.hasAttribute('inert') || node.getAttribute('aria-disabled') === 'true' || getComputedStyle(node).pointerEvents === 'none') return false;
    }
    return true;
  })).toBe(true);
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`scene transition ${reducedMotion}: short visual change never gates the next physical action`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    await startStory(page);
    await depart(page, 'Hong Kong');
    const menu = page.getByRole('button', { name: 'Read the menu', exact: true });
    await expectImmediatelyUsable(menu);
    const motion = await page.locator('.play-world').evaluate(element => {
      const style = getComputedStyle(element);
      return { name: style.animationName, duration: Math.max(...style.animationDuration.split(',').map(value => Number.parseFloat(value))) };
    });
    if (reducedMotion === 'reduce') {
      expect(motion.name).toBe('none');
      expect(motion.duration).toBe(0);
      await expect(page.locator('.world-scroller')).toHaveCSS('scroll-behavior', 'auto');
    } else expect(motion.duration).toBeLessThanOrEqual(.3);
    await menu.click();
    const simple = page.getByRole('button', { name: /^Let’s keep dinner simple\./ });
    await expectImmediatelyUsable(simple);
    await simple.click();
    const outside = page.getByRole('button', { name: 'Step outside', exact: true });
    await expectImmediatelyUsable(outside);
    await outside.click();
    await page.getByRole('button', { name: /^A short loop sounds good\./ }).click();
    await expectPhase(page, 'walk');
    const look = page.getByRole('button', { name: 'Look around', exact: true });
    await expectImmediatelyUsable(look);
    await look.click();
    await expectSceneAssets(page, 'hk-evening-night.webp');
    await openAction(page, 'Head home');
    const home = page.getByRole('button', { name: 'Follow the return journey', exact: true });
    await expectImmediatelyUsable(home);
    await home.click();
    await expectPhase(page, 'home');
    await expect(storyClock(page)).toHaveText('18:45');
  });
}
