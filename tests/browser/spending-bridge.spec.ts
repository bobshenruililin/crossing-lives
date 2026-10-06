import { test, expect, type Page } from '@playwright/test';
import { seedLegacyPlanner } from './story-fixtures';
import {
  chooseDinner, chooseWalk, closeDialogue, depart, dialogue, expectHomeScene,
  expectNoClippedText, expectNoOverflow, expectPhase, expectSceneAssets, expectSingleLineMoney,
  expectTouchTarget, openAction, openOptions, openPlanner, openResearch, readStorySave,
  returnHome, showcase, startStory, storyClock,
} from './story-helpers';

const bridgeName = 'Who benefits from this spending?';
const question = 'What does tonight’s spending tell us about who gained?';
const savedBytes = (page: Page) => page.evaluate(() => Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));

async function expectBusinessLanding(page: Page, context?: { city: 'Hong Kong' | 'Shenzhen'; each: string; group: string; party: number }) {
  await expect(page.getByRole('heading', { name: question, exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Business questions', exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel('Search evidence')).toHaveCount(0);
  const banner = page.locator('.research-banner');
  if (context) {
    await expect(banner).toHaveClass(/spending-context/);
    await expect(banner.locator('strong')).toHaveText(`Illustrative ${context.city} evening`);
    await expect(banner.locator('p').first()).toHaveText(`${context.each} per person · ${context.group} for ${context.party} people (HKD), including dinner, drinks and return travel.`);
    await expect(banner.locator('p').last()).toHaveText('That is modeled customer spending across the whole outing, including transport. We haven’t verified any restaurant’s wages, costs, ownership or profit.');
    // Check actual currency fragments in prose, not just matching text. Labels
    // may wrap naturally; neither exact amount should split through its cents.
    const amounts = await banner.locator('p').first().evaluate((element, tokens) => {
      const node = element.firstChild!;
      return tokens.map(token => {
        const start = node.textContent!.indexOf(token);
        if (start < 0) return { count: 0, height: Infinity };
        const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + token.length);
        const rows = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => rect.top);
        return { count: rows.length, height: Math.max(...rows) - Math.min(...rows) };
      });
    }, [context.each, context.group]);
    for (const amount of amounts) {
      expect(amount.count).toBeGreaterThan(0);
      expect(amount.height, 'Exact spending amounts stay on one rendered line.').toBeLessThanOrEqual(1);
    }
  } else {
    await expect(page.locator('.spending-context')).toHaveCount(0);
    await expect(banner).toContainText('Research scaffold, not a completed market study');
    await expect(banner).toContainText('No business cost dataset is connected. No causal claims or extra returns are estimated.');
    await expect(banner).not.toContainText(/HK\$|Illustrative Hong Kong evening|Illustrative Shenzhen evening/);
  }
  for (const title of ['What explains the price?', 'Who keeps the margin?', 'What might change?']) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('.business-grid')).toContainText('Separate revenue from profit, and wages from ownership returns.');
  await expect(page.locator('.business-pool-boundary')).toHaveText('The fixed-pool exercise below is a separate hypothetical amount. It is not calculated from this outing estimate.');
  await expectNoClippedText(banner);
  await expectNoOverflow(page);
  await expectTouchTarget(page.getByRole('button', { name: 'Return to your evening', exact: true }));
}

async function returnToWallet(page: Page, keyboard = false) {
  const back = page.getByRole('button', { name: 'Return to your evening', exact: true });
  if (keyboard) {
    for (let count = 0; count < 30 && !(await back.evaluate(element => element === document.activeElement)); count += 1) await page.keyboard.press('Shift+Tab');
    await expect(back).toBeFocused();
    await expect(back).toBeInViewport();
    await page.keyboard.press('Space');
  } else await back.click();
  await expect(dialogue(page).getByRole('heading', { name: 'Wallet', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open wallet', exact: true })).toBeFocused();
  await expect(dialogue(page)).not.toBeVisible();
}

async function expectIndependentPool(page: Page) {
  await page.locator('.surplus-lab > summary').click();
  await expect(page.getByLabel('Hypothetical pool · HKD', { exact: true })).toHaveValue('120');
  for (const [name, weight] of [['Workers', '50'], ['Community', '20'], ['Business reserve', '30']] as const) {
    await expect(page.getByRole('slider', { name: new RegExp(name) })).toHaveValue(weight);
  }
  await expect(page.locator('.allocation-proof')).toContainText('HK$60.00 + HK$24.00 + HK$36.00 = HK$120.00');
  for (const name of ['Workers', 'Community', 'Business reserve']) {
    const slider = page.getByRole('slider', { name: new RegExp(name) });
    await slider.focus(); await slider.press('Home'); await slider.press('ArrowRight');
    await expect(slider).toHaveValue('1');
  }
  await expect(page.locator('.allocation-proof')).toContainText('HK$40.00 + HK$40.00 + HK$40.00 = HK$120.00');
  await expect(page.getByLabel('Hypothetical pool · HKD', { exact: true })).toHaveValue('120');
}

for (const width of [390, 360]) {
  test(`spending bridge ${width}px: no selection and both city contexts preserve story and practical bytes`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 844 });
    const legacy = await seedLegacyPlanner(page, 'Private older practical detail must never enter the business context.');
    await page.goto('/'); await startStory(page);
    await openAction(page, 'Open wallet');
    const initial = await savedBytes(page);
    const bridge = page.getByRole('button', { name: bridgeName, exact: true });
    await expectTouchTarget(bridge);
    // Use real Tab navigation from the normally focused Wallet heading, rather
    // than programmatic focus or a click masquerading as keyboard coverage.
    for (let count = 0; count < 12 && !(await bridge.evaluate(element => element === document.activeElement)); count += 1) await page.keyboard.press('Tab');
    await expect(bridge).toBeFocused();
    await expect(bridge).toBeInViewport();
    await page.keyboard.press('Enter');
    await expectBusinessLanding(page);
    await showcase(page, `business-general-${width}`);
    expect(await savedBytes(page)).toEqual(initial);
    await returnToWallet(page, true);
    expect(await savedBytes(page)).toEqual(initial);
    await expectPhase(page, 'fork'); await expect(storyClock(page)).toHaveText('16:30');

    for (const city of ['hk', 'sz'] as const) {
      await depart(page, city === 'hk' ? 'Hong Kong' : 'Shenzhen');
      await chooseDinner(page, 'simple');
      await expect(page.getByRole('button', { name: bridgeName, exact: true })).toHaveCount(0);
      await openAction(page, 'Open wallet');
      const state = await readStorySave(page);
      const bytes = await savedBytes(page);
      const each = city === 'hk' ? 'HK$304.00' : 'HK$260.22';
      const group = city === 'hk' ? 'HK$608.00' : 'HK$520.44';
      await expect(dialogue(page).locator('.pocket-facts dd')).toHaveText(['HK$400.00', each]);
      await expectSingleLineMoney(dialogue(page).locator('.pocket-facts dd'));
      await expect(page.locator('.wallet-business-bridge')).toContainText('This is customer spending. Pay, costs and profits need different evidence.');
      await expectTouchTarget(bridge);
      await showcase(page, `wallet-business-${city}-${width}`);
      await bridge.click();
      await expectBusinessLanding(page, { city: city === 'hk' ? 'Hong Kong' : 'Shenzhen', each, group, party: 2 });
      await expect(page.locator('.evidence-layout')).not.toContainText(legacy.notes);
      await showcase(page, `business-landing-${city}-${width}`);
      await showcase(page, `business-context-${city}-${width}`, true);
      await expectIndependentPool(page);
      expect(await savedBytes(page)).toEqual(bytes);
      await returnToWallet(page);
      expect(await readStorySave(page)).toEqual(state);
      expect(await savedBytes(page)).toEqual(bytes);
      await expectPhase(page, 'afterDinner');
      await expect(storyClock(page)).toHaveText(city === 'hk' ? '18:15' : '19:45');
      await expectSceneAssets(page, city === 'hk' ? 'hong-kong-table.webp' : 'shenzhen-table.webp');
      // A normal subsequent panel must not reopen the one-shot Wallet resume.
      await openAction(page, 'Step outside');
      await expect(dialogue(page).getByRole('heading', { name: 'A little walk?', exact: true })).toBeFocused();
      await page.getByRole('button', { name: /^Let’s head home now\./ }).click();
      await expectHomeScene(page);
      await expect(page.getByRole('button', { name: bridgeName, exact: true })).toHaveCount(0);
      await openAction(page, 'Open phone');
      await expect(page.getByRole('button', { name: bridgeName, exact: true })).toHaveCount(0);
      await closeDialogue(page);
      if (city === 'hk') await page.getByRole('button', { name: 'Try the other evening', exact: true }).click();
    }
    await openResearch(page);
    await expect(page.getByRole('heading', { name: 'What do we actually know?', exact: true })).toBeFocused();
    await expect(page.getByLabel('Search evidence')).toBeVisible();
    await page.getByRole('button', { name: 'Business questions', exact: true }).click();
    await expect(page.locator('.spending-context')).toHaveCount(0);
    await expect(page.locator('.research-banner')).not.toContainText(/HK\$/);
  });
}

test('practical receipt bridge uses the real three-person bill and returns to the same plan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLegacyPlanner(page, 'Keep this separate practical note private.');
  await page.goto('/'); await openPlanner(page);
  await page.getByRole('button', { name: 'One more person', exact: true }).click();
  await expect(page.locator('.party-field output')).toHaveText('3');
  await page.locator('.option-hk .choose-button').click();
  await expect(page.getByRole('heading', { name: 'Your evening, pencilled in.' })).toBeVisible();
  const before = await savedBytes(page);
  await page.getByRole('button', { name: bridgeName, exact: true }).click();
  await expectBusinessLanding(page, { city: 'Hong Kong', each: 'HK$325.33', group: 'HK$976.00', party: 3 });
  await expect(page.locator('.evidence-layout')).not.toContainText('Keep this separate practical note private.');
  await showcase(page, 'business-receipt-three-people-390', true);
  await expectIndependentPool(page);
  expect(await savedBytes(page)).toEqual(before);
  await page.getByRole('button', { name: 'Return to your evening', exact: true }).click();
  await expect(page.getByRole('button', { name: bridgeName, exact: true })).toBeFocused();
  // Focus restoration must be visible on the long phone receipt; do not let
  // a focused element below the current scroll position masquerade as success.
  await expect(page.getByRole('button', { name: bridgeName, exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('heading', { name: 'Your evening, pencilled in.' })).toBeVisible();
  expect(await savedBytes(page)).toEqual(before);
});

test('blocked storage keeps the exact story and independent practical inputs across the Wallet bridge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await page.goto('/'); await startStory(page);
  await openPlanner(page);
  await page.getByLabel('Budget per person').fill('777');
  await page.getByRole('button', { name: 'One more person', exact: true }).click();
  await startStory(page);
  await depart(page, 'Shenzhen'); await chooseDinner(page, 'simple'); await chooseWalk(page, 'short');
  await expect(storyClock(page)).toHaveText('20:00');
  await openAction(page, 'Open wallet');
  await page.getByRole('button', { name: bridgeName, exact: true }).click();
  await expectBusinessLanding(page, { city: 'Shenzhen', each: 'HK$260.22', group: 'HK$520.44', party: 2 });
  await returnToWallet(page);
  await expectPhase(page, 'walk'); await expect(storyClock(page)).toHaveText('20:00');
  await expectSceneAssets(page, 'sz-evening-night.webp');
  await openAction(page, 'Open phone');
  await expect(page.locator('.route-note-forecast')).toContainText('modeled home 21:45');
  await page.getByRole('button', { name: 'Evening assumptions', exact: true }).click();
  await expect(page.locator('.route-note-detail')).toContainText('15-minute walk · completed');
  await closeDialogue(page); await returnHome(page);
  await expect(storyClock(page)).toHaveText('21:45');
  await openPlanner(page);
  await expect(page.getByLabel('Budget per person')).toHaveValue('777');
  await expect(page.locator('.party-field output')).toHaveText('3');
  await expect(page.locator('.storage-notice')).toContainText('Saving is unavailable');
  await openOptions(page);
  await expect(dialogue(page)).toContainText('cannot save the story');
});
