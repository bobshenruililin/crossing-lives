import { expect, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { DECISION_CASES, type DecisionSceneId } from './world-fixtures';
import { expectHitTarget, insight } from './world-helpers';

export type DecisionObserver = (step: string, readingMs: number) => Promise<void>;
const noPause: DecisionObserver = async () => undefined;

/** Inspect actual clipping before click/press/select can implicitly scroll. */
export async function expectPrimaryVisible(target: Locator) {
  const result = await target.evaluate(el => {
    const r = el.getBoundingClientRect(), clips = [{ left: 0, top: 0, right: innerWidth, bottom: innerHeight }];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) clips.push(parent.getBoundingClientRect());
    }
    return { text: el.textContent, height: r.height, width: r.width, clipped: clips.some(c => r.left < c.left - 1 || r.top < c.top - 1 || r.right > c.right + 1 || r.bottom > c.bottom + 1) };
  });
  expect(result.height).toBeGreaterThan(0); expect(result.width).toBeGreaterThan(0);
  expect(result.clipped, `Primary content is initially clipped: ${result.text}`).toBe(false);
}
async function pressVisible(target: Locator) { await expectPrimaryVisible(target); await expectHitTarget(target); await target.click(); }
export async function setDeadlineWithNativeKeys(page: Page, deadline: 'earlier' | 'later') {
  const slider = insight(page, 'hk-home').getByRole('slider', { name: /Home by/ });
  await pressVisible(slider); await expect(slider).toBeFocused();
  await page.keyboard.press(deadline === 'earlier' ? 'Home' : 'End');
  await expect(slider).toHaveValue(deadline === 'earlier' ? '1350' : '1410');
}
async function number(panel: Locator, label: string, value: string) {
  await expect(panel.locator(`[data-world-number="${label}"] strong`)).toHaveText(value);
}
export async function expectInitialDecision(page: Page, id: DecisionSceneId) {
  const panel = insight(page, id);
  await expect(panel).toHaveAttribute('data-mechanism', DECISION_CASES[id].mechanism);
  await expect(panel.locator('.wd-caption')).toBeVisible();
  if (id === 'hk-home') {
    await expect(panel.getByRole('slider')).toHaveValue('1410');
    await expectPrimaryVisible(panel.locator('.wd-time-figure'));
    await expect(panel.locator('.wd-time-figure')).toContainText('HK ⇄ Shenzhen · striped 6h assumed round trip');
    await expect(panel.getByRole('status')).toContainText('30 minutes spare');
    await expect(panel.getByRole('status')).toContainText('Example finish 23:00');
    await expect(panel.getByRole('button', { name: /^Keep/ })).toHaveAttribute('aria-pressed', 'true');
  } else if (id === 'parcel-counter') {
    await expect(panel).toHaveAttribute('data-step', 'context');
    await expect(panel.getByRole('button', { name: /^Already going/ })).toContainText('Collection 16 · 20 min');
    await expect(panel.getByRole('button', { name: /^Go just for it/ })).toContainText('Collection 116 · 160 min');
    await expect(panel.getByRole('button', { name: /^Use / })).toHaveCount(0);
  } else {
    await expect(panel).toHaveAttribute('data-step', 'contract');
    await expect(panel.locator('.wd-caption')).toContainText('HKD 24,000 to start');
    await expect(panel.getByRole('button', { name: 'Choose lease', exact: true })).toHaveCount(0);
  }
}
export async function expectParcelResult(page: Page, method: 'collection' | 'delivery', context: 'already-going' | 'dedicated-trip') {
  const panel = insight(page, 'parcel-counter');
  await expect(panel).toHaveAttribute('data-step', 'consequence');
  await expect(panel.getByRole('status')).toHaveAttribute('data-context', context);
  await expect(panel.getByRole('status')).toHaveAttribute('data-destination', method);
  await number(panel, 'Extra money', method === 'delivery' ? '35' : context === 'already-going' ? '16' : '116');
  await number(panel, method === 'delivery' ? 'Delivery time' : 'Extra time', method === 'delivery' ? 'Unknown' : context === 'already-going' ? '20' : '160');
  await expect(panel.locator('.wd-caption')).toHaveText('Separate fictional costs · CNY-equivalent');
}
export async function expectLeaseResult(page: Page, choice: 'lower-rent' | 'less-upfront') {
  const panel = insight(page, 'rental-home'), amounts = choice === 'lower-rent' ? [6000, 12000, 6000] : [7500, 7500, 9000];
  await expect(panel).toHaveAttribute('data-step', 'consequence');
  await number(panel, 'Cash now', choice === 'lower-rent' ? '6,000' : '9,000');
  await number(panel, 'Monthly rent', choice === 'lower-rent' ? '6,000' : '7,500');
  await expect(panel.locator('.wd-deposit-claim')).toHaveText(`${choice === 'lower-rent' ? '12,000' : '7,500'} held, not spendable. Return conditional; amount and timing unknown.`);
  expect(await panel.locator('[data-money-role]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-amount'))))).toEqual(amounts);
  await expect.poll(async () => {
    const heights = await panel.locator('[data-money-role] .wd-stack-bills').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    return Math.max(...heights.map((height, index) => Math.abs(height / heights[0] - amounts[index] / amounts[0])));
  }, { message: 'Actual visible stack heights preserve cash allocation proportions.' }).toBeLessThan(.01);
  await expect(panel.locator('.wd-caption')).toHaveText('Separate fictional lease · HKD');
  await expect(panel.getByTestId('lease-comparison-delta')).toHaveText(`Compared with the other offer:3,000 ${choice === 'less-upfront' ? 'more' : 'less'} cash now; 1,500 ${choice === 'less-upfront' ? 'more' : 'less'} rent/month.`);
  await expectPrimaryVisible(panel.getByTestId('lease-comparison-delta'));
}
export async function expectTakenDecision(page: Page, id: DecisionSceneId) {
  if (id === 'hk-home') {
    const panel = insight(page, id);
    await expect(panel.getByRole('slider')).toHaveValue('1350');
    await expect(panel.getByRole('status')).toContainText('120 minutes spare');
    await expect(panel.getByRole('status')).toContainText('Example finish 20:30');
    await expect(panel.getByRole('button', { name: /^Shorten/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.locator('[data-activity=exhibition]')).toHaveAttribute('data-minutes', '0');
  } else if (id === 'parcel-counter') await expectParcelResult(page, 'delivery', 'dedicated-trip');
  else await expectLeaseResult(page, 'less-upfront');
}
export async function decisionGeometry(page: Page, id: DecisionSceneId) {
  const panel = insight(page, id);
  await panel.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))); });
  const selector = id === 'hk-home' ? '[data-clock-hand]' : id === 'parcel-counter' ? '.wd-parcel-object' : '.wd-stack-bills';
  const shape = await panel.locator(selector).evaluateAll(nodes => nodes.map(el => {
    const style = getComputedStyle(el);
    return { tag: el.tagName, d: el.getAttribute('d'), width: style.width, height: style.height, left: style.left, transform: style.transform, fill: style.fill, background: style.backgroundImage, border: style.borderStyle };
  }));
  expect(shape.length).toBeGreaterThan(0);
  return createHash('sha256').update(JSON.stringify(shape)).digest('hex');
}
/** A real comparison followed by an explicit commit. Call on a fresh opening. */
export async function takeSceneDecision(page: Page, id: DecisionSceneId, observe: DecisionObserver = noPause) {
  const panel = insight(page, id);
  await expectInitialDecision(page, id);
  let before: string, after: string;
  if (id === 'hk-home') {
    const fixedWidth = await panel.locator('.wd-time-fixed').evaluate(el => el.getBoundingClientRect().width);
    const lunchWidth = await panel.locator('[data-activity=lunch]').evaluate(el => el.getBoundingClientRect().width);
    expect(fixedWidth).toBeGreaterThan(0); expect(lunchWidth).toBeGreaterThan(0);
    before = await decisionGeometry(page, id); await observe('Read the invented day: its Hong Kong–Shenzhen round-trip allowance stays fixed, with 30 minutes spare.', 10_000);
    await setDeadlineWithNativeKeys(page, 'earlier');
    await expect(panel.getByRole('status')).toContainText('30 minutes late');
    await expect(panel.getByRole('status')).toContainText('Example finish 23:00');
    await expect(panel.getByRole('button', { name: /^Keep/ })).toHaveAttribute('aria-pressed', 'true');
    await observe('Move only the home-by clock; the unchanged day remains 30 minutes late.', 10_000);
    after = await decisionGeometry(page, id); expect(after).not.toBe(before);
    await pressVisible(panel.getByRole('button', { name: /^Shorten/ }));
    await expect(panel.getByRole('status')).toContainText('Exactly on time');
    await expect.poll(async () => panel.locator('[data-activity=lunch]').evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(lunchWidth - 1);
    expect(Math.abs(await panel.locator('.wd-time-fixed').evaluate(el => el.getBoundingClientRect().width) - fixedWidth), 'Shortening a visit must not erase the displayed cross-border round-trip allowance.').toBeLessThan(.25);
    await expectPrimaryVisible(panel.locator('.wd-time-figure'));
    await observe('Shorten lunch: its segment contracts while the crossing allowance stays; no activity was automatically changed.', 10_000);
    const activity = panel.getByRole('combobox', { name: 'Activity to adjust', exact: true });
    await expectPrimaryVisible(activity); await activity.selectOption('exhibition');
    await pressVisible(panel.getByRole('button', { name: /^Leave out/ }));
    await expect(panel.getByRole('status')).toContainText('120 minutes spare');
    await observe('Explicitly leave out the exhibition and read the resulting day.', 10_000);
    await pressVisible(panel.getByRole('button', { name: 'Take this plan', exact: true }));
    await observe('Take this plan; this explicit choice is what the later map will retain.', 5_000);
  } else if (id === 'parcel-counter') {
    await observe('Read both collection contexts, separate from the day plan.', 6_000);
    await pressVisible(panel.getByRole('button', { name: /^Already going/ }));
    await observe('Read the labelled collection and home-delivery options before choosing.', 4_000);
    await pressVisible(panel.getByRole('button', { name: /^Collect it/ }));
    await expectParcelResult(page, 'collection', 'already-going');
    before = await decisionGeometry(page, id); await observe('Already-going collection adds 16 CNY-equivalent and 20 minutes.', 6_000);
    await pressVisible(panel.getByRole('button', { name: 'Options', exact: true }));
    await pressVisible(panel.getByRole('button', { name: 'Back', exact: true }));
    await pressVisible(panel.getByRole('button', { name: /^Go just for it/ }));
    await observe('Read the labelled collection and home-delivery options before choosing.', 4_000);
    await pressVisible(panel.getByRole('button', { name: /^Collect it/ }));
    await expectParcelResult(page, 'collection', 'dedicated-trip');
    await observe('Making a dedicated collection changes the same calculation to 116 CNY-equivalent and 160 minutes.', 6_000);
    await pressVisible(panel.getByRole('button', { name: 'Options', exact: true }));
    await observe('Options returns to the labelled destination choices; compare before switching.', 4_000);
    await pressVisible(panel.getByRole('button', { name: /^Home delivery/ }));
    await expectParcelResult(page, 'delivery', 'dedicated-trip');
    after = await decisionGeometry(page, id); expect(after).not.toBe(before);
    await observe('Move the parcel home: the invented quote is 35 CNY-equivalent; delivery time remains unknown.', 6_000);
    await pressVisible(panel.getByRole('button', { name: 'Use delivery', exact: true }));
    await observe('Explicitly use delivery; the separate day plan remains unchanged.', 4_000);
  } else {
    await observe('Read the two fictional paper contracts.', 6_000);
    await pressVisible(panel.getByRole('button', { name: /^Lower monthly rent/ }));
    await expectLeaseResult(page, 'lower-rent'); before = await decisionGeometry(page, id);
    await observe('Lease A leaves 6,000 liquid, pays 6,000 rent and holds 12,000 separately.', 7_000);
    await pressVisible(panel.getByRole('button', { name: 'Back', exact: true }));
    await pressVisible(panel.getByRole('button', { name: /^Less cash tied up/ }));
    await expectLeaseResult(page, 'less-upfront'); after = await decisionGeometry(page, id); expect(after).not.toBe(before);
    await observe('Lease B leaves 9,000 liquid, but monthly rent is 7,500; its held deposit is also 7,500.', 7_000);
    await pressVisible(panel.getByRole('button', { name: 'Choose lease', exact: true }));
    await observe('Explicitly choose this fictional lease.', 4_000);
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return { before, after, mechanism: DECISION_CASES[id].mechanism };
}
export async function expectMapPlan(page: Page) {
  const plan = page.getByTestId('committed-home-plan'); await expect(plan).toBeVisible();
  await plan.locator('summary').click();
  await expect(plan).toContainText('120 minutes spare'); await expect(plan).toContainText('Travel times remain unverified'); await expect(plan).toContainText('Hong Kong–Shenzhen round trip keeps its assumed 6h allowance');
  for (const [activity, choice] of [['lunch', 'short'], ['neighborhood', 'full'], ['exhibition', 'omit']]) await expect(plan.locator(`[data-plan-activity=${activity}]`)).toHaveAttribute('data-plan-choice', choice);
  await expect(page.getByRole('group', { name: 'Places in the connected world', exact: true }).getByRole('button')).toHaveCount(12);
}
