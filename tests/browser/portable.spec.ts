import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import {
  chooseDinner, chooseWalk, depart, expectDecodedImage, expectPhase,
  expectSceneAssets, returnHome, showcase, startStory, storyClock,
} from './story-helpers';

const artifact = path.resolve('artifacts/crossing-lives-portable.html');

test('portable production file stays fully offline through both nights, Jun, journals and replay', async ({ page, context }) => {
  test.setTimeout(90_000);
  expect(existsSync(artifact), 'Run npm run export:portable before browser verification.').toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  const networkRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => {
    if (/^https?:\/\//i.test(request.url())) networkRequests.push(request.url());
  });
  await context.setOffline(true);
  await page.goto(pathToFileURL(artifact).href);
  await expect(page.getByRole('heading', { name: 'One evening. Two possibilities.' })).toBeVisible();
  await expectDecodedImage(page.locator('.hero-world img'), true);

  // Inspect every rendered image, not only the cover or a scene's fallback.
  const everyImageIsEmbedded = async () => {
    const images = page.locator('img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const image of await images.all()) await expectDecodedImage(image, true);
    expect(networkRequests, 'A portable file must not even attempt an HTTP(S) request.').toEqual([]);
  };
  await everyImageIsEmbedded();
  await startStory(page);
  await expectSceneAssets(page, 'two-shores.webp', true);
  await everyImageIsEmbedded();
  await depart(page, 'Hong Kong');
  await expectSceneAssets(page, 'hong-kong-evening.webp', true);
  await everyImageIsEmbedded();
  await chooseDinner(page, 'linger');
  await chooseWalk(page, 'long');
  await expectSceneAssets(page, 'hk-evening-night.webp', true);
  await everyImageIsEmbedded();
  await page.getByRole('button', { name: 'Remember the conversation', exact: true }).click();
  await showcase(page, 'portable-hk-night-offline');
  await returnHome(page);
  await page.getByLabel('One sentence to keep').fill('The harbor page works without a connection.');
  await expectSceneAssets(page, 'hk-evening-night.webp', true);
  await everyImageIsEmbedded();

  await page.getByRole('button', { name: 'Try the other evening from the fork', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect(storyClock(page)).toHaveText('16:30');
  await expectSceneAssets(page, 'shenzhen-evening.webp', true);
  await everyImageIsEmbedded();
  await page.getByRole('button', { name: 'Make Shenzhen our evening', exact: true }).click();
  await chooseDinner(page, 'simple');
  await chooseWalk(page, 'short');
  await expectSceneAssets(page, 'sz-evening-night.webp', true);
  await everyImageIsEmbedded();
  await page.getByRole('button', { name: 'Keep the view', exact: true }).click();
  await showcase(page, 'portable-sz-night-offline');
  await returnHome(page);
  await expectSceneAssets(page, 'sz-evening-night.webp', true);
  await everyImageIsEmbedded();
  await expect(page.getByRole('heading', { name: 'Different choices. Kept side by side.' })).toBeVisible();
  await expect(page.locator('.play-attempt-comparison')).toContainText('Hong Kong');
  await expect(page.locator('.play-attempt-comparison')).toContainText('Shenzhen');
  await showcase(page, 'portable-two-journals-offline');

  await page.getByRole('button', { name: 'Start a fresh evening', exact: true }).click();
  await page.getByRole('dialog', { name: 'Begin a fresh story?' }).getByRole('button', { name: 'Start a fresh story', exact: true }).click();
  await expectPhase(page, 'fork');
  await expect(storyClock(page)).toHaveText('16:30');
  await expect(page.locator('.play-returning-note')).toHaveCount(0);
  await expectSceneAssets(page, 'two-shores.webp', true);
  await everyImageIsEmbedded();

  // Retain the original portable planner-and-field-note regression as well.
  await page.getByRole('button', { name: 'Your evening', exact: true }).click();
  await expect(page.locator('.option-card')).toHaveCount(2);
  await everyImageIsEmbedded();
  await page.getByLabel('Budget per person').fill('500');
  await page.locator('.option-hk').getByRole('button', { name: /Choose this kind of evening|Keep as a tentative choice/ }).click();
  await expect(page.getByRole('heading', { name: 'Your evening, pencilled in.' })).toBeVisible();
  await page.getByLabel('What makes this the right evening for you?').fill('An offline evening.');
  await everyImageIsEmbedded();
  await showcase(page, 'portable-offline');
  expect(errors).toEqual([]);
  expect(networkRequests).toEqual([]);
});
