import { test, expect } from '@playwright/test';
import {
  action, auditNoPrivateStorage, changeDeadline, chooseBaseline, closeDisclosure, commitShortWalk,
  expectAcceptedFacts, expectKeyboardFocusVisible, expectNoOverflow, expectStage, expectWorldAndCore,
  experience, openDisclosure, readInputFacts, reason, replay, sheet, startFresh,
} from './decision-helpers';

async function expectHeadingFocus(page: import('@playwright/test').Page) {
  await expect(page.locator('#decision-sheet-heading')).toBeFocused();
  await expectKeyboardFocusVisible(page);
  await expect(sheet(page)).toHaveCount(1);
}

test('scene objects replace one sheet, return keyboard focus and preserve the exact decision', async ({ page, context }) => {
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  const before = await readInputFacts(page);
  await chooseBaseline(page, 'Hong Kong', 'I want the complete local walk.');
  for (let pass = 0; pass < 2; pass += 1) {
    await action(page, 'Menu See both bills').press('Enter');
    await expect(experience(page)).toHaveAttribute('data-active-object', 'menu');
    await expectHeadingFocus(page);
    await expect(page.locator('.decision-bill-pair')).toBeVisible();
    await expect(page.getByTestId('decision-outcome-HK'), 'Inactive core controls are unmounted, not hidden tabbable duplicates.').toHaveCount(0);
    await expect(reason(page)).toHaveCount(0);
    await action(page, 'Back to evening').press('Enter');
    await expect(experience(page)).toHaveAttribute('data-active-object', 'phone');
    await expectHeadingFocus(page);
    await action(page, 'Map Unfold both routes').press('Enter');
    await expect(experience(page)).toHaveAttribute('data-active-object', 'map');
    await expectHeadingFocus(page);
    await expectWorldAndCore(page);
    await expect(action(page, 'Start with Hong Kong')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page, 'Start with Shenzhen')).toHaveAttribute('aria-pressed', 'false');
    await action(page, 'Put down map').press('Enter');
    await expect(sheet(page)).toHaveCount(0);
    await expect(action(page, 'Start with Hong Kong')).toHaveCount(0);
    await expect(action(page, 'What matters to you?')).toHaveCount(0);
    await expect(action(page, 'Map Unfold both routes')).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await page.keyboard.press('Enter');
    await expect(experience(page)).toHaveAttribute('data-active-object', 'map');
    await expectHeadingFocus(page);
    await action(page, 'Phone Inspect home-by time').press('Enter');
    await expect(experience(page)).toHaveAttribute('data-active-object', 'phone');
    await expectHeadingFocus(page);
    await action(page, 'Put down phone').press('Enter');
    await expect(sheet(page)).toHaveCount(0);
    await expect(action(page, 'Phone Inspect home-by time')).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await page.keyboard.press('Enter');
    await expectHeadingFocus(page);
    await expectStage(page, 'baseline');
    await expectAcceptedFacts(page, 'baseline');
    expect(await readInputFacts(page)).toEqual(before);
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page)).toHaveValue('I want the complete local walk.');
    await closeDisclosure(page, 'What matters to you?');
  }
  // Optional evidence may scroll inside its own view, while the world stays fixed.
  await openDisclosure(page, 'Open the bill and assumptions');
  await openDisclosure(page, 'Read all authored starting facts');
  await page.locator('[data-input-key] dd').last().scrollIntoViewIfNeeded();
  await expect(page.locator('[data-input-key] dd').last()).toBeInViewport({ ratio: 1 });
  expect(await page.locator('.decision-detail-body').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expectNoOverflow(page);
  await audit.expectZero(page);
});

test('failed artwork still leaves the complete fresh decision and replay usable at 360px', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.route('**/decision-hk-pixel.webp', route => route.abort('failed'));
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  await expect(page.locator('.decision-world-fallback')).toBeVisible();
  await expect(page.locator('.decision-world-fallback')).toContainText('The comparison and every object still work');
  await expect(page.locator('img.decision-world-image')).toHaveCount(0);
  await expect(page.locator('.decision-world-fallback svg')).toBeVisible();
  await expectWorldAndCore(page);
  await action(page, 'Choose an object').click();
  await expect(page.getByRole('group', { name: 'Named object controls', exact: true })).toBeVisible();
  await action(page, 'Open menu').click();
  await expect(page.getByRole('group', { name: 'Named object controls', exact: true })).toHaveCount(0);
  await expect(page.locator('.decision-bill-pair')).toBeVisible();
  await action(page, 'Choose an object').click();
  await action(page, 'Open map').click();
  await expect(page.getByTestId('decision-timeline-SZ')).toBeInViewport({ ratio: 1 });
  await chooseBaseline(page, 'Shenzhen');
  await changeDeadline(page);
  await expectAcceptedFacts(page, 'changed');
  await commitShortWalk(page);
  await expectAcceptedFacts(page, 'revised', true);
  await replay(page, 'baseline');
  await expectStage(page, 'revised', 'baseline');
  await expectAcceptedFacts(page, 'baseline');
  await action(page, 'Return to current decision').click();
  await expectStage(page, 'revised');
  await expectNoOverflow(page);
  await audit.expectZero(page);
});

test('ordinary mobile taps complete the world-to-phone decision without scrolling or a seed', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  try {
    await startFresh(page);
    await expectWorldAndCore(page);
    await action(page, 'Put down map').tap();
    await expect(sheet(page)).toHaveCount(0);
    await action(page, 'Map Unfold both routes').tap();
    await expectWorldAndCore(page);
    await action(page, 'What matters to you?').tap();
    await expect(reason(page)).toHaveValue('');
    await expect(reason(page)).not.toBeEditable();
    await action(page, 'Food').tap();
    await expect(action(page, 'Food')).toHaveAttribute('aria-pressed', 'true');
    await action(page, 'Back to evening').tap();
    await action(page, 'Phone Inspect home-by time').tap();
    await expect(action(page, 'Change home-by time to 22:30')).toHaveCount(0);
    await action(page, 'Map Unfold both routes').tap();
    await action(page, 'Start with Shenzhen').tap();
    await expect(experience(page)).toHaveAttribute('data-active-object', 'phone');
    await expectWorldAndCore(page);
    await action(page, 'Change home-by time to 22:30').tap();
    await expectAcceptedFacts(page, 'changed');
    await expectWorldAndCore(page);
    await action(page, 'Preview a shorter Shenzhen walk').tap();
    await expectStage(page, 'changed', 'revised', true);
    await expectWorldAndCore(page);
    await action(page, 'Choose shorter Shenzhen walk').tap();
    await expectAcceptedFacts(page, 'revised', true);
    await expectWorldAndCore(page);
    await action(page, 'Replay the comparison').tap();
    await action(page, 'Before').tap();
    await expectAcceptedFacts(page, 'baseline');
    await expectWorldAndCore(page);
    await action(page, 'Return to current decision').tap();
    await expectAcceptedFacts(page, 'revised', true);
    await expectNoOverflow(page);
    await audit.expectZero(page);
  } finally { await context.close(); }
});
