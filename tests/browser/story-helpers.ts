import { expect, type Locator, type Page } from '@playwright/test';
import type { StoryPhase, StoryState } from '../../src/story/model';

export const story = (page: Page) => page.getByRole('region', { name: 'Play an illustrative evening' });
export const storyClock = (page: Page) => page.locator('.play-hud > span:nth-child(2) strong');
export const cityPreview = (page: Page, city: 'Hong Kong' | 'Shenzhen') =>
  page.getByRole('group', { name: 'Preview a city' }).getByRole('button', { name: new RegExp(`^${city}`) });

export async function expectPhase(page: Page, phase: StoryPhase) {
  await expect(story(page)).toHaveClass(new RegExp(`\\bplay-phase-${phase}\\b`));
}

export async function startStory(page: Page) {
  await page.getByRole('button', { name: 'The story', exact: true }).click();
  await expectPhase(page, 'fork');
}

export async function depart(page: Page, city: 'Hong Kong' | 'Shenzhen') {
  await cityPreview(page, city).click();
  await page.getByRole('button', { name: `Make ${city} our evening`, exact: true }).click();
  await expectPhase(page, 'arrival');
}

export async function chooseDinner(page: Page, choice: 'simple' | 'linger') {
  await page.getByRole('button', { name: choice === 'simple' ? /^Dinner, then out\./ : /^Stay for one more dish\./ }).click();
  await expectPhase(page, 'afterDinner');
}

export async function chooseWalk(page: Page, choice: 'short' | 'long') {
  await page.getByRole('button', { name: choice === 'short' ? /^Make it a small loop\./ : /^Keep the longer wander\./ }).click();
  await expectPhase(page, 'walk');
}

export async function returnHome(page: Page) {
  await page.getByRole('button', { name: 'Follow the return journey', exact: true }).click();
  await expectPhase(page, 'home');
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
  const jun = page.locator('.jun-avatar img[data-art="jun-portrait.webp"]');
  await expect(scene).toHaveCount(1);
  await expect(jun).toHaveCount(1);
  await expectDecodedImage(scene, portable);
  await expectDecodedImage(jun, portable);
  await expect(page.locator('.play-image-fallback')).toHaveCount(0);
}

export async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

export async function showcase(page: Page, filename: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expectNoOverflow(page);
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).not.toBeFocused();
  const bounds = (await skip.boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `artifacts/${filename}.png`, fullPage: true, animations: 'disabled' });
}
