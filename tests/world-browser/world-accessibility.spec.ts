import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { capture, closePoint, expectFacts, expectNoOverflow, insight, mapTo, openPoint, player, position, selectChoice, startWorld } from './world-helpers';
import { pointFor } from './world-fixtures';

async function validFocus(page: Page) {
  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null; if (!el) return null;
    const r = el.getBoundingClientRect(), style = getComputedStyle(el);
    return { tag: el.tagName, inert: !!el.closest('[inert],[hidden]'), visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden',
      inView: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
  });
  expect(focus).not.toBeNull(); expect(focus!.tag).not.toBe('BODY'); expect(focus!.inert).toBe(false); expect(focus!.visible).toBe(true); expect(focus!.inView).toBe(true);
}
async function tabTo(page: Page, target: Locator, limit = 24, direction: 'Tab' | 'Shift+Tab' = 'Tab') {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press(direction); await validFocus(page);
  }
  throw new Error(`Real Tab could not reach ${await target.getAttribute('aria-label') ?? await target.textContent()}`);
}
async function axe(page: Page) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(report.violations, JSON.stringify(report.violations, null, 2)).toEqual([]);
}

test('real Tab, Enter, Space and Escape keep focus visible and reach evidence; active world and several infographics pass axe', async ({ page }, info) => {
  test.setTimeout(120_000);
  await startWorld(page); await axe(page);
  // Play itself gives stage focus. E and immediate Escape require no injected focus.
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog', { name: pointFor('hk-home').label, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator(`#world-point-${pointFor('hk-home').id}`)).toBeFocused();
  const mapButton = page.getByRole('button', { name: 'Open world map', exact: true });
  await tabTo(page, mapButton); await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'World map', exact: true })).toBeVisible();
  await validFocus(page); await page.keyboard.press('Escape'); await expect(mapButton).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('dialog', { name: 'World map', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(mapButton).toBeFocused();
  for (const id of ['hk-home', 'parcel-counter', 'rental-home', 'office-floor', 'planning-museum'] as const) {
    if (id !== 'hk-home') await mapTo(page, id);
    // Home's point precedes the restored Map button in native DOM order.
    // Reverse Tab reaches it directly; forward Tab would leave this document.
    // Other map visits restore stage focus, before their physical scene points.
    await tabTo(page, page.locator(`#world-point-${pointFor(id).id}`), 24, id === 'hk-home' ? 'Shift+Tab' : 'Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: pointFor(id).label, exact: true })).toBeVisible();
    await validFocus(page);
    await axe(page);
    const dialog = page.getByRole('dialog', { name: pointFor(id).label, exact: true });
    const evidence = insight(page, id).locator(id === 'planning-museum' ? '.rmd-research' : '.wi-evidence');
    const summary = evidence.locator(':scope > summary');
    await tabTo(page, summary); await page.keyboard.press('Space');
    await expect(evidence).toHaveAttribute('open', '');
    await validFocus(page);
    // Native Tab traverses summary/link descendants and remains in the dialog.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab'); await validFocus(page);
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await expectNoOverflow(page); await capture(page, info, `${id}-keyboard-evidence`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator(`#world-point-${pointFor(id).id}`)).toBeFocused();
    await validFocus(page);
  }
});

test('reduced motion is reflected in actual computed styles and still changes visual values', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWorld(page);
  const before = await position(page); await page.keyboard.press('ArrowRight');
  await expect(player(page)).toHaveAttribute('data-walking', 'false'); expect((await position(page)).x).toBeGreaterThan(before.x);
  await openPoint(page, 'hk-home', 'key'); await selectChoice(page, 'hk-home', 1); await expectFacts(page, 'hk-home', 1);
  const styles = await page.locator('.world-sprite-crop,.world-target,.wi-hand,.wi-window,.wi-path,.wi-marker').evaluateAll(nodes => nodes.map(el => {
    const s = getComputedStyle(el); return { animation: s.animationName, transition: s.transitionDuration, animationDuration: s.animationDuration };
  }));
  expect(styles.length).toBeGreaterThan(5);
  for (const style of styles) { expect(style.animation).toBe('none'); expect(style.transition.split(',').every(s => parseFloat(s) === 0)).toBe(true); expect(style.animationDuration.split(',').every(s => parseFloat(s) === 0)).toBe(true); }
  await closePoint(page); await mapTo(page, 'parcel-counter'); await openPoint(page, 'parcel-counter', 'key'); await selectChoice(page, 'parcel-counter', 1);
  expect(await insight(page, 'parcel-counter').locator('.wi-path.is-active').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expectFacts(page, 'parcel-counter', 1);
});
