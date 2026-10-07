import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { capture, expectHitTarget, expectNoOverflow, insight, mapTo, openPoint, startWorld } from './world-helpers';
import { auditWorldStorage } from './world-storage';

async function earlierHome(page: Page) {
  const clock = insight(page, 'hk-home').getByRole('slider', { name: /Home by/ });
  await clock.focus(); await page.keyboard.press('Home');
  await expect(clock).toHaveValue('1350');
}
async function number(panel: Locator, label: string, expected: string) {
  await expect(panel.locator(`[data-world-number="${label}"] strong`)).toHaveText(expected);
}
async function closeAndReopen(page: Page, scene: 'hk-home' | 'parcel-counter' | 'rental-home', how: 'Cancel' | 'Escape' | 'Close') {
  if (how === 'Escape') await page.keyboard.press('Escape');
  else if (how === 'Close') await page.getByRole('button', { name: /^Close / }).click();
  else await insight(page, scene).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openPoint(page, scene, 'key');
}

/** Observe before any assertion, tap or scroll that could bring a control into view. */
async function expectCompactInitialView(page: Page, panel: Locator, commitName: string, rental = false) {
  const modal = page.getByRole('dialog');
  const initial = await modal.evaluate(el => {
    const scroll = el.querySelector<HTMLElement>('.world-modal-scroll')!;
    return { declaredLimit: parseFloat(getComputedStyle(el).getPropertyValue('--inspection-limit')), height: el.getBoundingClientRect().height, scrollTop: scroll.scrollTop };
  });
  expect(initial.declaredLimit, 'This gate must exercise the actual repaired small prop sheet.').toBeGreaterThanOrEqual(210);
  expect(initial.declaredLimit, 'The rental table projects lower than the parcel counter; both retain a compact prop sheet.').toBeLessThanOrEqual(rental ? 300 : 260);
  expect(initial.height).toBeLessThanOrEqual(initial.declaredLimit + 1);
  expect(initial.scrollTop, 'A compact-view check must start before automatic or manual scrolling.').toBe(0);
  const targets = [panel.locator('.wd-caption'), panel.getByRole('status'), ...(rental ? [panel.locator('.wd-deposit-claim'), panel.getByTestId('lease-comparison-delta')] : []), panel.getByRole('button', { name: rental ? 'Back' : 'Options', exact: true }), panel.getByRole('button', { name: 'Cancel', exact: true }), panel.getByRole('button', { name: commitName, exact: true })];
  for (const target of targets) {
    const result = await target.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      const clips = [{ name: 'viewport', left: 0, top: 0, right: innerWidth, bottom: innerHeight }];
      for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) clips.push({ name: ancestor.className || ancestor.tagName, ...box(ancestor.getBoundingClientRect()) });
      }
      return { target: el.textContent, rect: box(rect), clippedBy: clips.filter(clip => rect.left < clip.left - 1 || rect.top < clip.top - 1 || rect.right > clip.right + 1 || rect.bottom > clip.bottom + 1) };
    });
    expect(result.clippedBy, JSON.stringify(result, null, 2)).toEqual([]);
  }
  await expect(panel.locator('.wd-caption')).toContainText(rental ? 'HKD' : 'CNY-equivalent');
  if (rental) await expect(panel.locator('.wd-deposit-claim')).toContainText('Return conditional; amount and timing unknown.');
  for (const name of [rental ? 'Back' : 'Options', 'Cancel', commitName]) await expectHitTarget(panel.getByRole('button', { name, exact: true }));
  expect(await modal.locator('.world-modal-scroll').evaluate(el => el.scrollTop)).toBe(0);
}

test('home can keep a late day, shorten one activity, omit another and cancel without changing the taken plan', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startWorld(page); await openPoint(page, 'hk-home', 'key');
  const panel = insight(page, 'hk-home');
  await earlierHome(page);
  await expect(panel.getByRole('status')).toContainText('30 minutes late');
  await panel.getByRole('button', { name: /^Shorten/ }).click();
  await expect(panel.getByRole('status')).toContainText('Exactly on time');
  await expect(panel.locator('[data-activity=lunch]')).toHaveAttribute('data-minutes', '60');
  await panel.locator('.wd-evidence > summary').click();
  await panel.getByRole('button', { name: 'Keep everything at full length', exact: true }).click();
  await panel.locator('.wd-evidence > summary').click();
  await expect(panel.getByRole('status')).toContainText('30 minutes late');
  await expect(panel.locator('[data-activity=lunch]')).toHaveAttribute('data-minutes', '90');
  await capture(page, info, 'home-earlier-explicitly-kept-late');
  await panel.getByRole('button', { name: /Take this plan/ }).click();
  await openPoint(page, 'hk-home', 'key');
  await expect(panel.getByRole('slider')).toHaveValue('1350');
  for (const how of ['Cancel', 'Escape', 'Close'] as const) {
    await panel.getByRole('button', { name: /^Shorten/ }).click();
    await expect(panel.getByRole('status')).toContainText('Exactly on time');
    await closeAndReopen(page, 'hk-home', how);
    await expect(panel.getByRole('status')).toContainText('30 minutes late');
    await expect(panel.getByRole('group', { name: 'Choose time for lunch', exact: true }).getByRole('button', { name: /^Keep/ })).toHaveAttribute('aria-pressed', 'true');
  }
  await panel.getByRole('combobox', { name: 'Activity to adjust', exact: true }).selectOption('exhibition');
  await panel.getByRole('button', { name: /^Leave out/ }).click();
  await expect(panel.getByRole('status')).toContainText('90 minutes spare');
  await expect(panel.locator('[data-activity=exhibition]')).toHaveAttribute('data-minutes', '0');
  await panel.getByRole('button', { name: /Take this plan/ }).click();
  await page.getByRole('button', { name: 'Open world map', exact: true }).click();
  // This is the two-line shell integration gate, not an optional silent pass.
  const plan = page.getByTestId('committed-home-plan');
  await plan.locator('summary').click();
  await expect(plan).toContainText('90 minutes spare');
  await expect(plan.locator('[data-plan-activity=exhibition]')).toHaveAttribute('data-plan-choice', 'omit');
  await expect(page.getByRole('group', { name: 'Places in the connected world', exact: true }).getByRole('button')).toHaveCount(12);
  await capture(page, info, 'taken-plan-remains-in-map');
});

test('parcel context changes price and time; destination is a separate choice and canceled changes do not leak', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startWorld(page); await mapTo(page, 'parcel-counter'); await openPoint(page, 'parcel-counter', 'key');
  const panel = insight(page, 'parcel-counter');
  await expect(panel).toHaveAttribute('data-step', 'context');
  await expect(panel.getByRole('button', { name: /^Already going/ })).toContainText('Collection 16 · 20 min');
  await expect(panel.getByRole('button', { name: /^Go just for it/ })).toContainText('Collection 116 · 160 min');
  await panel.getByRole('button', { name: /^Already going/ }).click();
  await expect(panel).toHaveAttribute('data-step', 'destination');
  await number(panel, 'Collection cost', '16'); await number(panel, 'Delivery quote', '35');
  await panel.getByRole('button', { name: /^Collect it/ }).click();
  await number(panel, 'Extra money', '16'); await number(panel, 'Extra time', '20');
  await expect(panel.getByRole('status')).toBeFocused();
  await panel.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(panel.getByRole('button', { name: /^Collect it/ })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Back', exact: true }).click();
  await panel.getByRole('button', { name: /^Go just for it/ }).click();
  await number(panel, 'Collection cost', '116'); await number(panel, 'Delivery quote', '35');
  await expect(panel.getByRole('button', { name: /^Collect it/ })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: /^Collect it/ }).click();
  await number(panel, 'Extra money', '116'); await number(panel, 'Extra time', '160');
  const collectionX = await panel.locator('.wd-parcel-object').evaluate(el => el.getBoundingClientRect().x);
  await panel.getByRole('button', { name: 'Options', exact: true }).click();
  await panel.getByRole('button', { name: /^Home delivery/ }).click();
  await number(panel, 'Extra money', '35'); await number(panel, 'Delivery time', 'Unknown');
  await expect.poll(() => panel.locator('.wd-parcel-object').evaluate(el => el.getBoundingClientRect().x)).toBeGreaterThan(collectionX + 15);
  await capture(page, info, 'dedicated-parcel-home-delivery');
  await panel.getByRole('button', { name: /Use delivery/ }).click();
  await openPoint(page, 'parcel-counter', 'key');
  await panel.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(panel.getByRole('button', { name: /^Home delivery/ })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(panel.getByRole('button', { name: /^Go just for it/ })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: /^Already going/ }).click();
  await expect(panel.getByRole('button', { name: /^Home delivery/ })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: /^Collect it/ }).click();
  await closeAndReopen(page, 'parcel-counter', 'Cancel');
  await number(panel, 'Extra money', '35'); await number(panel, 'Delivery time', 'Unknown');
  await panel.getByRole('button', { name: 'Options', exact: true }).click();
  await panel.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(panel.getByRole('button', { name: /^Go just for it/ })).toHaveAttribute('aria-pressed', 'true');
});

test('lease choice conserves cash, changes monthly rent and keeps the held deposit outside liquid cash', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startWorld(page); await mapTo(page, 'rental-home'); await openPoint(page, 'rental-home', 'key');
  const panel = insight(page, 'rental-home');
  await expect(panel).toHaveAttribute('data-step', 'contract');
  await expect(panel.getByRole('button', { name: 'Choose lease', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: /^Lower monthly rent/ }).click();
  await expect(panel.getByRole('status')).toBeFocused();
  await number(panel, 'Cash now', '6,000'); await number(panel, 'Monthly rent', '6,000');
  await expect(panel.locator('.wd-deposit-claim')).toContainText('12,000 held, not spendable.');
  const rentHeight = await panel.locator('[data-money-role=rent] .wd-stack-bills').evaluate(el => el.getBoundingClientRect().height);
  await expect.poll(() => panel.locator('[data-money-role=deposit] .wd-stack-bills').evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(rentHeight * 2, 0);
  await panel.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(panel.getByRole('button', { name: /^Lower monthly rent/ })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: /^Less cash tied up/ }).click();
  await number(panel, 'Cash now', '9,000'); await number(panel, 'Monthly rent', '7,500');
  await expect(panel.getByTestId('lease-comparison-delta')).toContainText('3,000 more cash now; 1,500 more rent/month.');
  const allocation = await panel.locator('[data-money-role]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-amount'))));
  expect(allocation).toEqual([7500, 7500, 9000]); expect(allocation.reduce((sum, amount) => sum + amount, 0)).toBe(24000);
  const secondStackHeights = () => panel.locator('[data-money-role] .wd-stack-bills').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  await expect.poll(async () => { const [rent, deposit] = await secondStackHeights(); return deposit / rent; }).toBeCloseTo(1, 3);
  await expect.poll(async () => { const [rent, , liquid] = await secondStackHeights(); return liquid / rent; }).toBeCloseTo(1.2, 3);
  await expect(panel.locator('.wd-deposit-claim')).toContainText('7,500 held, not spendable.');
  await expect(panel.locator('.wd-deposit-claim')).toContainText('Return conditional; amount and timing unknown.');
  await capture(page, info, 'lease-liquid-cash-and-held-claim');
  await panel.getByRole('button', { name: /Choose lease/ }).click();
  await openPoint(page, 'rental-home', 'key');
  await panel.getByRole('button', { name: 'Back', exact: true }).click();
  await panel.getByRole('button', { name: /^Lower monthly rent/ }).click();
  await closeAndReopen(page, 'rental-home', 'Escape');
  await number(panel, 'Cash now', '9,000'); await number(panel, 'Monthly rent', '7,500');
  await expect(panel.getByTestId('lease-comparison-delta')).toContainText('3,000 more cash now; 1,500 more rent/month.');
});

test('touch and reduced motion preserve decisions, legacy storage canaries and accessible native controls', async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const storage = await auditWorldStorage(context), page = await context.newPage();
  try {
    await startWorld(page, '/world.html', true); await openPoint(page, 'hk-home', 'touch');
    await earlierHome(page);
    await insight(page, 'hk-home').getByRole('button', { name: /^Shorten/ }).tap();
    await insight(page, 'hk-home').getByRole('button', { name: /Take this plan/ }).tap();
    await mapTo(page, 'parcel-counter'); await openPoint(page, 'parcel-counter', 'touch');
    await insight(page, 'parcel-counter').getByRole('button', { name: /^Already going/ }).tap();
    await insight(page, 'parcel-counter').getByRole('button', { name: /^Home delivery/ }).tap();
    await capture(page, info, 'touch-parcel-initial-selected-consequence');
    await expectCompactInitialView(page, insight(page, 'parcel-counter'), 'Use delivery');
    await insight(page, 'parcel-counter').getByRole('button', { name: /Use delivery/ }).tap();
    await mapTo(page, 'rental-home'); await openPoint(page, 'rental-home', 'touch');
    await insight(page, 'rental-home').getByRole('button', { name: /^Less cash tied up/ }).tap();
    await capture(page, info, 'touch-rental-initial-selected-consequence');
    await expectCompactInitialView(page, insight(page, 'rental-home'), 'Choose lease', true);
    const styles = await page.locator('.world-decision *').evaluateAll(nodes => nodes.map(el => ({ transition: getComputedStyle(el).transitionDuration, animation: getComputedStyle(el).animationName })));
    expect(styles.length).toBeGreaterThan(10);
    for (const style of styles) { expect(style.animation).toBe('none'); expect(style.transition.split(',').every(value => parseFloat(value) === 0)).toBe(true); }
    await expectNoOverflow(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await capture(page, info, 'touch-reduced-motion-lease');
    await insight(page, 'rental-home').getByRole('button', { name: /Choose lease/ }).tap();
    await mapTo(page, 'hk-home'); await openPoint(page, 'hk-home', 'touch');
    await expect(insight(page, 'hk-home').getByRole('status')).toContainText('Exactly on time');
    await storage.expectZero(page);
  } finally { await context.close(); }
});
