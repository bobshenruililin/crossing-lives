import { test, expect } from '@playwright/test';
import {
  action, auditNoPrivateStorage, changeDeadline, chooseBaseline, commitShortWalk,
  expectAcceptedFacts, expectKeyboardFocusVisible, expectNoOverflow, expectStage,
  openDisclosure, readInputFacts, reason, replay, startFresh,
} from './decision-helpers';

test('scene objects transfer keyboard focus and inspect the same untouched decision', async ({ page, context }) => {
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  const before = await readInputFacts(page);
  await chooseBaseline(page, 'Hong Kong', 'I want the complete local walk.');
  for (let pass = 0; pass < 2; pass += 1) {
    await action(page, 'Menu See both bills').press('Enter');
    await expect(page.locator('summary').filter({ hasText: 'Open the bill and assumptions' })).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await expect(page.locator('.decision-bill-pair')).toBeVisible();
    await action(page, 'Map Unfold both routes').press('Enter');
    await expect(page.locator('button[aria-controls="decision-unfolded"]')).toBeFocused();
    await expect(page.locator('button[aria-controls="decision-unfolded"]')).toHaveAttribute('aria-expanded', 'true');
    await expectKeyboardFocusVisible(page);
    await expect(page.getByTestId('decision-timeline-HK')).toBeVisible();
    await expect(page.getByTestId('decision-timeline-SZ')).toBeVisible();
    await action(page, 'Phone Inspect home-by time').press('Enter');
    await expect(page.getByRole('region', { name: 'The one changed circumstance', exact: true })).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await expectStage(page, 'baseline');
    await expectAcceptedFacts(page, 'baseline');
    expect(await readInputFacts(page)).toEqual(before);
    await expect(action(page, 'Start with Hong Kong')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page, 'Start with Shenzhen')).toHaveAttribute('aria-pressed', 'false');
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page)).toHaveValue('I want the complete local walk.');
  }
  await expectNoOverflow(page);
  await audit.expectZero(page);
});

test('failed artwork still leaves the complete fresh decision and replay usable at 360px', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.route('**/decision-hk-pixel.webp', route => route.abort('failed'));
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  await expect(page.locator('.decision-world-fallback')).toBeVisible();
  await expect(page.locator('.decision-world-fallback')).toContainText('All three objects and the complete comparison still work');
  await expect(page.locator('img.decision-world-image')).toHaveCount(0);
  await expect(page.locator('.decision-world-fallback svg path')).toHaveCount(13);
  await action(page, 'Menu See both bills').click();
  await expect(page.locator('.decision-bill-pair')).toBeVisible();
  await action(page, 'Map Unfold both routes').click();
  await expect(page.getByTestId('decision-timeline-SZ')).toBeVisible();
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
