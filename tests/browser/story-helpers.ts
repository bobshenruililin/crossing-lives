import { expect, type Locator, type Page } from '@playwright/test';
import type { StoryPhase, StoryState } from '../../src/story/model';

export const story = (page: Page) => page.getByRole('region', { name: 'Play an illustrative evening', includeHidden: true });
export const dialogue = (page: Page) => page.getByRole('dialog');
export const storyClock = (page: Page) => page.getByLabel('Story clock', { exact: true });
export const cityPreview = (page: Page, city: 'Hong Kong' | 'Shenzhen') =>
  page.getByRole('button', { name: `Look at ${city}`, exact: true });

export async function expectPhase(page: Page, phase: StoryPhase) {
  await expect(story(page)).toHaveClass(new RegExp(`\\bplay-phase-${phase}\\b`));
}

export async function advanceDialogue(page: Page) {
  const next = page.getByRole('button', { name: 'Continue dialogue', exact: true });
  for (let count = 0; count < 8 && await next.isVisible(); count += 1) await next.click();
  await expect(next).not.toBeVisible();
}

export async function closeDialogue(page: Page) {
  if (await dialogue(page).isVisible()) {
    await page.getByRole('button', { name: 'Return to the scene', exact: true }).click();
    await expect(dialogue(page)).not.toBeVisible();
  }
}

export async function startStory(page: Page) {
  const navigation = page.getByRole('button', { name: 'The story', exact: true });
  if (await navigation.isVisible()) await navigation.click();
  await expect(story(page)).toBeVisible();
  if ((await story(page).getAttribute('class'))?.includes('dialogue-active')) await expect(dialogue(page)).toBeVisible();
  await advanceDialogue(page);
  await closeDialogue(page);
}

export async function openOptions(page: Page) {
  await startStory(page);
  await page.getByRole('button', { name: 'Story options', exact: true }).click();
  await expect(dialogue(page)).toBeVisible();
}

export async function openPlanner(page: Page, copyStory = false) {
  const navigation = page.getByRole('button', { name: 'Your evening', exact: true });
  if (!copyStory && await navigation.isVisible()) {
    await navigation.click();
  } else {
    if (copyStory) await openAction(page, 'Open wallet');
    else await openOptions(page);
    await page.getByRole('button', { name: copyStory ? 'Compare this evening' : 'Open my plan', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Shape your evening', exact: true })).toBeVisible();
}

export async function openResearch(page: Page) {
  const navigation = page.getByRole('button', { name: /^Research desk/ });
  if (await navigation.isVisible()) await navigation.click();
  else {
    await openOptions(page);
    await page.getByRole('button', { name: 'Open research desk', exact: true }).click();
  }
  await expect(page.getByLabel('Search evidence')).toBeVisible();
}

export async function openAction(page: Page, name: string) {
  await closeDialogue(page);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(dialogue(page)).toBeVisible();
  await advanceDialogue(page);
}

export async function depart(page: Page, city: 'Hong Kong' | 'Shenzhen') {
  await closeDialogue(page);
  if (await cityPreview(page, city).isVisible()) await cityPreview(page, city).click();
  await closeDialogue(page);
  await expectSceneAssets(page, city === 'Hong Kong' ? 'hong-kong-evening.webp' : 'shenzhen-evening.webp');
  await openAction(page, 'Talk about dinner');
  await page.getByRole('button', { name: city === 'Hong Kong' ? 'Head to the table' : 'Head to the station', exact: true }).click();
  await expectPhase(page, 'arrival');
  await expect(dialogue(page).getByRole('heading', { level: 2 })).toBeFocused();
}

export async function chooseDinner(page: Page, choice: 'simple' | 'linger') {
  await openAction(page, 'Read the menu');
  await page.getByRole('button', { name: choice === 'simple' ? /^Let’s keep dinner simple\./ : /^Let’s have one more dish\./ }).click();
  await expectPhase(page, 'afterDinner');
  await expect(dialogue(page).getByRole('heading', { level: 2 })).toBeFocused();
}

export async function chooseWalk(page: Page, choice: 'short' | 'long') {
  await openAction(page, 'Step outside');
  await page.getByRole('button', { name: choice === 'short' ? /^A short loop sounds good\./ : /^Let’s take the longer walk\./ }).click();
  await expectPhase(page, 'walk');
  await expect(dialogue(page).getByRole('heading', { level: 2 })).toBeFocused();
}

export async function returnHome(page: Page) {
  await openAction(page, 'Head home');
  await page.getByRole('button', { name: 'Follow the return journey', exact: true }).click();
  await expectPhase(page, 'home');
  await expect(dialogue(page).getByRole('heading', { level: 2 })).toBeFocused();
}

export async function expectClock(page: Page, expected: string) {
  await openAction(page, 'Open phone');
  await expect(storyClock(page)).toHaveText(expected);
  await closeDialogue(page);
}

export async function readStorySave(page: Page): Promise<StoryState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('between-playable-v2') ?? 'null'));
}

export async function expectDecodedImage(image: Locator, portable = false) {
  await expect(image).toBeVisible();
  if (portable) await expect(image).toHaveAttribute('src', /^data:image\/webp;base64,/);
  await expect.poll(async () => image.evaluate(async (element: HTMLImageElement) => {
    try { await element.decode(); } catch { return false; }
    return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
  }), { message: 'The actual scene asset must decode, not merely render a fallback.' }).toBe(true);
}

export async function expectSceneAssets(page: Page, sceneName: string, portable = false) {
  const scene = page.locator(`.play-world img[data-art="${sceneName}"]`);
  await expect(scene).toHaveCount(1);
  await expectDecodedImage(scene, portable);
  await expect(page.locator('.play-image-fallback')).toHaveCount(0);
}

export async function expectJun(page: Page, portable = false) {
  const phaseClass = await story(page).getAttribute('class');
  if (/\bplay-phase-(arrival|afterDinner)\b/.test(phaseClass ?? '')) {
    // At the table Jun is painted into the original scene, rather than duplicated
    // in a portrait overlay. Other phases retain the separately decoded portrait.
    const table = page.locator('.play-world img[data-art$="-table.webp"]');
    await expectDecodedImage(table, portable);
    await expect(table).toHaveAttribute('alt', /Jun,.*fictional adult friend/);
    await expect(dialogue(page).locator('img[data-art="jun-portrait.webp"]')).toHaveCount(0);
  } else {
    await expectDecodedImage(dialogue(page).locator('.jun-avatar img[data-art="jun-portrait.webp"]'), portable);
  }
}

export async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

export async function showcase(page: Page, filename: string, fullPage = false) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await expectNoOverflow(page);
  await page.screenshot({ path: `artifacts/${filename}.png`, fullPage, animations: 'disabled' });
}

export async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const bounds = (await locator.boundingBox())!;
  expect(bounds.width, `${await locator.getAttribute('aria-label') ?? await locator.innerText()} target width`).toBeGreaterThanOrEqual(43.5);
  expect(bounds.height, 'Action targets are at least 44 CSS pixels high.').toBeGreaterThanOrEqual(43.5);
}

export async function expectNoClippedText(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element => {
    const clipped = (node: Element) => {
      const style = getComputedStyle(node);
      return (['hidden', 'clip'].includes(style.overflowY) && node.scrollHeight > node.clientHeight + 1)
        || (['hidden', 'clip'].includes(style.overflowX) && node.scrollWidth > node.clientWidth + 1);
    };
    return [element, ...element.querySelectorAll('*')].every(node => !clipped(node));
  }), 'Essential copy must wrap or scroll naturally instead of being clipped.').toBe(true);
}

export async function expectWorldViewport(page: Page, filename: string) {
  await closeDialogue(page);
  await expect(story(page)).not.toHaveAttribute('data-table-framed', 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expectNoOverflow(page);
  const viewport = page.viewportSize()!;
  const box = (await page.locator('.world-scroller').boundingBox())!;
  expect(box.y, 'The illustration is the opening surface.').toBeLessThanOrEqual(24);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width * 0.95);
  expect(box.height, 'The world fills the ordinary viewport.').toBeGreaterThanOrEqual(viewport.height * 0.8);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
  const image = page.locator('.play-world-image');
  await expectDecodedImage(image);
  await expect(image).toHaveCSS('object-fit', 'contain');
  const visibleArt = await image.evaluate((element: HTMLImageElement) => {
    const imageBox = element.getBoundingClientRect();
    const sceneBox = element.closest('.world-scroller')!.getBoundingClientRect();
    const scale = Math.min(imageBox.width / element.naturalWidth, imageBox.height / element.naturalHeight);
    const artWidth = element.naturalWidth * scale;
    const artHeight = element.naturalHeight * scale;
    const artLeft = imageBox.left + (imageBox.width - artWidth) / 2;
    const artTop = imageBox.top + (imageBox.height - artHeight) / 2;
    const width = Math.max(0, Math.min(innerWidth, sceneBox.right, artLeft + artWidth) - Math.max(0, sceneBox.left, artLeft));
    const height = Math.max(0, Math.min(innerHeight, sceneBox.bottom, artTop + artHeight) - Math.max(0, sceneBox.top, artTop));
    return { fraction: width * height / (innerWidth * innerHeight), width, height };
  });
  expect(visibleArt.fraction, `Actual contained artwork, not the wrapper background, must occupy at least 80% of the viewport (${visibleArt.width}×${visibleArt.height} visible).`).toBeGreaterThanOrEqual(0.8);
  await expect(page.locator('.site-header')).not.toBeVisible();
  await expect(page.locator('.site-footer')).not.toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await showcase(page, filename);
}
