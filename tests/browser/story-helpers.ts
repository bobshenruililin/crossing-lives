import { expect, type Locator, type Page } from '@playwright/test';
import type { StoryPhase, StoryState } from '../../src/story/model';
import { homeScene } from '../../src/data/scene-art';

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

/** Literal rendered disclosure, including descenders, must remain readable
 * outside an ordinary scene dialogue rather than hide behind its lower edge. */
export async function expectFictionCaption(page: Page) {
  const caption = page.locator('.scene-fiction');
  await expect(caption).toBeVisible();
  await expect(caption).toHaveText('Illustrated fiction · not a map');
  const measure = () => caption.evaluate(async element => {
    await document.fonts.ready;
    const range = document.createRange(); range.selectNodeContents(element);
    const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
    const panel = document.querySelector('dialog[open]')?.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      fragments: rects.length,
      inViewport: rects.every(rect => rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight),
      overlap: rects.reduce((total, rect) => total + (panel
        ? Math.max(0, Math.min(rect.right, panel.right) - Math.max(rect.left, panel.left))
          * Math.max(0, Math.min(rect.bottom, panel.bottom) - Math.max(rect.top, panel.top)) : 0), 0),
      fontSize: Number.parseFloat(style.fontSize), opacity: Number.parseFloat(style.opacity),
    };
  });
  await expect.poll(async () => {
    const result = await measure();
    return result.fragments > 0 && result.inViewport && result.overlap === 0;
  }, { message: 'The entire fiction caption must be inside the viewport and outside the open dialogue.' }).toBe(true);
  const result = await measure();
  expect(result.fontSize, 'Keep the fiction disclosure at least 12px.').toBeGreaterThanOrEqual(12);
  expect(result.opacity).toBeGreaterThan(0);
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

/** Default invitation, table and ending actions must be reachable immediately;
 * long warnings and zoom retain their separate natural-scroll coverage. */
export async function expectUnscrolledDialogueActions(page: Page, names: string[]) {
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(await dialogue(page).evaluate(element => element.scrollTop)).toBe(0);
  await expect(dialogue(page).getByRole('button', { name: 'Continue dialogue', exact: true })).toHaveCount(0);
  for (const name of names) {
    const control = dialogue(page).getByRole('button', { name, exact: true });
    await expectTouchTarget(control);
    await expect(control).toBeInViewport({ ratio: 1 });
    const result = await control.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const panel = element.closest('dialog')!.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        unclipped: rect.left >= Math.max(0, panel.left) && rect.right <= Math.min(innerWidth, panel.right)
          && rect.top >= Math.max(0, panel.top) && rect.bottom <= Math.min(innerHeight, panel.bottom),
        reachable: hit !== null && element.contains(hit),
      };
    });
    expect(result.unclipped, `${name} fits the default viewport without scrolling.`).toBe(true);
    expect(result.reachable, `${name} is not covered by another element.`).toBe(true);
  }
}

export async function expectNoClippedText(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element => {
    const clipped = (node: Element) => {
      // This live announcement is intentionally screen-reader-only. Keep all
      // visible route copy, warnings and currency subject to clipping checks.
      if (node.closest('.route-note-sr-only')) return false;
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
  await expectFictionCaption(page);
  await showcase(page, filename);
}

/** Measure actual text fragments: CSS nowrap alone does not prove that a
 * currency token is readable, and soft wrapping is invisible to text matching. */
export async function expectSingleLineMoney(values: Locator) {
  expect(await values.count(), 'The wallet exposes at least one amount.').toBeGreaterThan(0);
  for (const value of await values.all()) {
    await expect(value).toBeVisible();
    await expect(value).toHaveText(/^(?:HK\$[\d,]+\.\d{2}|Unknown)$/);
    const measure = async () => value.evaluate(async element => {
      await document.fonts.ready;
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      const rows: number[] = [];
      for (const rect of rects) if (!rows.some(top => Math.abs(top - rect.top) <= 1)) rows.push(rect.top);
      const pane = element.closest('dialog')!.getBoundingClientRect();
      return {
        text: element.textContent,
        rowCount: rows.length,
        left: Math.min(...rects.map(rect => rect.left)),
        right: Math.max(...rects.map(rect => rect.right)),
        allowedLeft: Math.max(0, pane.left),
        allowedRight: Math.min(innerWidth, pane.right),
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      };
    });
    await expect.poll(async () => (await measure()).rowCount, { message: 'Each currency amount must render on one line, including both cent digits.' }).toBe(1);
    const box = await measure();
    expect(box.left, `${box.text} must not extend beyond the visible wallet.`).toBeGreaterThanOrEqual(box.allowedLeft - 1);
    expect(box.right, `${box.text} must not be clipped or require horizontal scrolling.`).toBeLessThanOrEqual(box.allowedRight + 1);
    expect(box.fontSize, 'Keep the wallet amount readable rather than shrinking it to conceal wrapping.').toBeGreaterThanOrEqual(20);
  }
}


/** Both branches return to the shared origin. Destination observations and an
 * in-person Jun portrait would contradict that world state, even if hidden. */
export async function expectHomeScene(page: Page, portable = false) {
  await expectPhase(page, 'home');
  await expectSceneAssets(page, homeScene.image, portable);
  await expect(page.locator('.jun-avatar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Talk with Jun(?: in the illustration)?$/, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Look at the (?:table|harbor|avenue|way home)(?: in the illustration)?$/, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Read the menu(?: in the illustration)?$/, includeHidden: true })).toHaveCount(0);
  for (const name of ['Open phone', 'Open wallet', 'Story options', 'Try the other evening']) {
    await expect(page.getByRole('button', { name, exact: true, includeHidden: true })).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: 'Open phone in the illustration', exact: true, includeHidden: true })).toHaveCount(1);
}
