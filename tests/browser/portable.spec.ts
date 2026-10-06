import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import {
  chooseDinner, chooseWalk, closeDialogue, depart, dialogue, expectClock,
  expectJun, expectPhase, expectSceneAssets, openAction, openOptions, openPlanner,
  returnHome, showcase, startStory,
} from './story-helpers';

const artifact = path.resolve('artifacts/crossing-lives-portable.html');

test('portable production file keeps both cities, Jun, choices and quiet resume fully offline', async ({ page, context }) => {
  test.setTimeout(90_000);
  expect(existsSync(artifact), 'Run npm run export:portable before browser verification.').toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (/^https?:\/\//i.test(request.url())) requests.push(request.url()); });
  await context.setOffline(true);
  await page.goto(pathToFileURL(artifact).href);
  await startStory(page);
  const allAssetsEmbedded = async () => {
    const images = page.locator('img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('src', /^data:image\/webp;base64,/);
      await expect.poll(() => image.evaluate(async (element: HTMLImageElement) => {
        try { await element.decode(); } catch { return false; }
        return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
      })).toBe(true);
    }
    expect(requests, 'The portable file must not even attempt HTTP(S).').toEqual([]);
  };
  await expectSceneAssets(page, 'hong-kong-evening.webp', true);
  await allAssetsEmbedded();
  await depart(page, 'Hong Kong');
  await expectSceneAssets(page, 'hong-kong-table.webp', true);
  await expectJun(page, true);
  await allAssetsEmbedded();
  await chooseDinner(page, 'linger');
  await expectSceneAssets(page, 'hong-kong-table.webp', true);
  await allAssetsEmbedded();
  await chooseWalk(page, 'long');
  await expectSceneAssets(page, 'hk-evening-night.webp', true);
  await expectJun(page, true);
  await allAssetsEmbedded();
  await closeDialogue(page);
  await showcase(page, 'portable-hk-night-offline');
  await returnHome(page);
  await expectClock(page, '19:45');
  await expect(page.getByRole('textbox')).toHaveCount(0);

  await page.getByRole('button', { name: 'Try the other evening', exact: true }).click();
  await expectPhase(page, 'fork');
  await expectClock(page, '16:30');
  await expectSceneAssets(page, 'shenzhen-evening.webp', true);
  await depart(page, 'Shenzhen');
  await expectSceneAssets(page, 'shenzhen-table.webp', true);
  await expectJun(page, true);
  await allAssetsEmbedded();
  await chooseDinner(page, 'simple');
  await expectSceneAssets(page, 'shenzhen-table.webp', true);
  await allAssetsEmbedded();
  await chooseWalk(page, 'short');
  await expectSceneAssets(page, 'sz-evening-night.webp', true);
  await expectJun(page, true);
  await allAssetsEmbedded();
  await closeDialogue(page);
  await showcase(page, 'portable-sz-night-offline');
  await returnHome(page);
  await expectClock(page, '21:45');
  await allAssetsEmbedded();
  await page.reload();
  await startStory(page);
  await expectPhase(page, 'home');
  await expectSceneAssets(page, 'sz-evening-night.webp', true);
  await expectClock(page, '21:45');
  await openAction(page, 'Open phone');
  await expect(dialogue(page)).toContainText(/entry.*unverified/i);
  await allAssetsEmbedded();
  await closeDialogue(page);

  await openOptions(page);
  await page.getByRole('button', { name: 'Start a fresh evening', exact: true }).click();
  await page.getByRole('button', { name: 'Start a fresh story', exact: true }).click();
  await startStory(page);
  await expectPhase(page, 'fork');
  await expectClock(page, '16:30');
  await expectSceneAssets(page, 'hong-kong-evening.webp', true);
  await allAssetsEmbedded();
  await openPlanner(page);
  await expect(page.locator('.option-card')).toHaveCount(2);
  await page.getByLabel('Budget per person').fill('500');
  await page.locator('.option-hk').getByRole('button', { name: /Choose this kind of evening|Keep as a tentative choice/ }).click();
  await expect(page.getByRole('heading', { name: 'Your evening, pencilled in.' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await allAssetsEmbedded();
  await showcase(page, 'portable-optional-plan-offline');
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
