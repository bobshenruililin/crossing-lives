import { test, expect, type Page } from '@playwright/test';
import { capture, expectScene, player, stage, world } from './world-helpers';
import { expectVisibleFamilyBodies } from './world-cast-geometry';

async function focusedBounds(page: Page) {
  return page.evaluate(() => {
    const node = document.activeElement as HTMLElement, rect = node.getBoundingClientRect();
    return { testId: node.dataset.testid, tag: node.tagName, inspect: node.classList.contains('world-inspect-control'), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
}
function expectVisibleFocus(result: Awaited<ReturnType<typeof focusedBounds>>) {
  expect(result.width).toBeGreaterThan(0); expect(result.height).toBeGreaterThan(0);
  expect(result.left).toBeGreaterThanOrEqual(-1); expect(result.top).toBeGreaterThanOrEqual(-1);
  expect(result.right).toBeLessThanOrEqual(result.viewportWidth + 1); expect(result.bottom).toBeLessThanOrEqual(result.viewportHeight + 1);
}
for (const width of [360,390]) {
  test(`Family native Tab skips unrevealable markers and reaches the clock normally at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/world.html');
    await page.getByRole('button', { name: 'Change people or day' }).click();
    await page.getByRole('combobox', { name: 'People', exact: true }).selectOption('family');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(world(page)).toHaveAttribute('data-party', 'family'); await expectScene(page, 'hk-home'); await expect(stage(page)).toBeFocused();
    await expectVisibleFamilyBodies(page);
    const clock = page.getByTestId('point-hk-home');
    await expect(clock).toHaveAttribute('tabindex', '-1');
    const offscreen = await clock.boundingBox(); expect(offscreen).not.toBeNull(); expect(offscreen!.x + offscreen!.width).toBeLessThan(0);
    let reachedInspect = false;
    // Native Tab only: no locator.focus(), state mutation, forced click or delay.
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      const focused = await focusedBounds(page); expectVisibleFocus(focused);
      expect(focused.testId, 'The unrevealable physical clock must not take invisible keyboard focus.').not.toBe('point-hk-home');
      if (focused.inspect) { reachedInspect = true; break; }
    }
    expect(reachedInspect, 'The visible named clock control remains reachable with native Tab.').toBe(true);
    await expect(page.locator('.world-inspect-control')).toBeFocused();
    await expectVisibleFamilyBodies(page); await capture(page, info, 'family-visible-clock-control-focused');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Home-by clock', exact: true })).toBeVisible();
    await expect(player(page)).toHaveAttribute('data-walking', 'false');
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(clock).toHaveAttribute('tabindex', '0'); await expect(clock).toBeFocused();
    expectVisibleFocus(await focusedBounds(page)); await expectVisibleFamilyBodies(page);
    await capture(page, info, 'family-visible-physical-clock-focused');
  });
}
