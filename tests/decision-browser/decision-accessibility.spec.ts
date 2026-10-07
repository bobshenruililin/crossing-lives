import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  action, applyTimeChange, auditNoPrivateStorage, chooseBaseline, clockControl, closeDisclosure,
  expectKeyboardFocusVisible, expectNoOverflow, expectStage, expectTouchTarget,
  experience, expectWorldAndCore, inspectCommonTimeline, openDisclosure, readCoreGeometry, sheet, world, startFresh,
} from './decision-helpers';

async function expectSeriousAxeClear(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')),
    'Serious and critical findings remain visible failures; no exclusions or rule disabling.').toEqual([]);
}

async function tabTo(page: Page, label: string, role: 'button' | 'region' = 'button') {
  const target = page.getByRole(role, { name: label, exact: true });
  for (let press = 0; press < 60; press += 1) {
    if (await target.evaluate(element => element === document.activeElement)) {
      await expectKeyboardFocusVisible(page);
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard navigation never reached ${label}.`);
}

/** Real keyboard access to the now-independent comparison scroll region.
 * No pointer, focus() call, wheel input or scrollTop assignment is used. */
async function expectKeyboardComparisonScroll(page: Page) {
  const body = page.getByRole('region', { name: 'Comparison timeline', exact: true });
  await expect(body).toHaveCount(1);
  await expect(body).toHaveAttribute('tabindex', '0');
  const initial = await body.evaluate(element => ({ top: element.scrollTop, range: element.scrollHeight - element.clientHeight }));
  expect(initial.top, 'The keyboard test starts from the untouched comparison position.').toBe(0);
  const fixedFooter = await page.getByTestId('decision-sheet-footer').boundingBox();
  await tabTo(page, 'Comparison timeline', 'region');
  await expect(body).toBeFocused();
  await expectKeyboardFocusVisible(page);
  await page.keyboard.press('End');
  await expect.poll(() => body.evaluate(element => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThanOrEqual(1);
  if (initial.range > 0) expect(await body.evaluate(element => element.scrollTop), 'End must actually scroll an overflowing comparison.').toBeGreaterThan(initial.top);
  const legend = body.locator('.decision-comparison > :last-child');
  await expect(legend, 'Keyboard End reveals the complete last legend line.').toBeInViewport({ ratio: 1 });
  const endBounds = await legend.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    const body = element.closest('.decision-core-body')!.getBoundingClientRect();
    const footer = element.closest('[data-testid="decision-sheet"]')!.querySelector('.decision-sheet-footer')!.getBoundingClientRect();
    return { textTop: text.top, textBottom: text.bottom, bodyTop: body.top, bodyBottom: body.bottom, footerTop: footer.top };
  });
  expect(endBounds.textTop).toBeGreaterThanOrEqual(endBounds.bodyTop);
  expect(endBounds.textBottom).toBeLessThanOrEqual(Math.min(endBounds.bodyBottom, endBounds.footerTop));
  await expect(body).toBeFocused();
  expect(await page.getByTestId('decision-sheet-footer').boundingBox()).toEqual(fixedFooter);
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  await page.keyboard.press('Home');
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(initial.top);
  await expect(body).toBeFocused();
  await expectKeyboardFocusVisible(page);
  await expectWorldAndCore(page); // Both initial figures/tracks and fixed caveat are visible again.
}

async function expectVisibleControls(page: Page) {
  for (const control of await experience(page).locator('button:visible, summary:visible, textarea:visible, select:visible').all()) {
    await expectTouchTarget(control);
  }
}

async function inspectArtwork(page: Page) {
  const worldImage = experience(page).locator('img.decision-world-image');
  await expect(worldImage).toHaveCount(1);
  await expect(worldImage).toBeVisible();
  const bitmap = await worldImage.evaluate(async (element: HTMLImageElement) => {
    await element.decode();
    const box = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    const [positionX, positionY] = css.objectPosition.split(' ').map(value => Number.parseFloat(value) / 100);
    const scale = css.objectFit === 'cover' ? Math.max(box.width / element.naturalWidth, box.height / element.naturalHeight)
      : Math.min(box.width / element.naturalWidth, box.height / element.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(element, 0, 0, 32, 32);
    const pixels = ctx.getImageData(0, 0, 32, 32).data;
    const colors = new Set<string>(); let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      if (pixels[index + 3] === 255) opaque += 1;
    }
    return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight,
      width: box.width, height: box.height, projectedWidth: element.naturalWidth * scale,
      projectedHeight: element.naturalHeight * scale, opacity: Number(css.opacity),
      colors: colors.size, opaque, alt: element.getAttribute('alt'), src: element.currentSrc,
      projectedX: box.x + (box.width - element.naturalWidth * scale) * positionX,
      projectedY: box.y + (box.height - element.naturalHeight * scale) * positionY };
  });
  expect(bitmap.naturalWidth).toBeGreaterThanOrEqual(1000);
  expect(bitmap.naturalHeight).toBeGreaterThanOrEqual(500);
  expect(bitmap.width).toBeGreaterThanOrEqual(280);
  expect(bitmap.height).toBeGreaterThanOrEqual(120);
  expect(Math.min(bitmap.projectedWidth, bitmap.width), 'The actual picture, not merely its box, stays legible.').toBeGreaterThanOrEqual(280);
  expect(Math.min(bitmap.projectedHeight, bitmap.height)).toBeGreaterThanOrEqual(120);
  expect(bitmap.opacity).toBeGreaterThan(0);
  expect(bitmap.colors, 'The approved scene has decoded real picture content.').toBeGreaterThan(20);
  expect(bitmap.opaque).toBeGreaterThan(900);
  expect(bitmap.alt).not.toBeNull();
  expect(bitmap.src).not.toBe('');
  // Object anchors were checked against the actual 1672×941 approved source
  // pixels. Measure the cropped/contained bitmap, not the frame dimensions.
  for (const [name, x, y] of [['menu', .61, .62], ['map', .69, .65], ['phone', .76, .66]] as const) {
    const pin = experience(page).locator(`button[data-object-id="${name}"]`);
    await expect(pin).toBeVisible();
    const box = (await pin.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - (bitmap.projectedX + bitmap.projectedWidth * x)), `${name} remains on its object when the image is cropped.`).toBeLessThanOrEqual(3);
    expect(Math.abs(box.y + box.height / 2 - (bitmap.projectedY + bitmap.projectedHeight * y)), `${name} remains on its object across viewport sizes.`).toBeLessThanOrEqual(3);
  }

}

for (const width of [360, 390, 1440]) {
  test(`world and one active sheet: geometry, keyboard, accessibility and reduced motion at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const audit = await auditNoPrivateStorage(context);
    await startFresh(page);
    await page.evaluate(() => document.fonts.ready);
    await expectWorldAndCore(page);
    await expectVisibleControls(page);
    await expectNoOverflow(page);
    await inspectArtwork(page);
    await expectSeriousAxeClear(page);
    await tabTo(page, 'Start with Hong Kong');
    await page.keyboard.press('Enter');
    await expect(experience(page)).toHaveAttribute('data-active-object', 'phone');
    await expect(page.locator('#decision-sheet-heading')).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await expectWorldAndCore(page);
    await tabTo(page, 'Change home-by');
    await page.keyboard.press('Enter');
    await expect(clockControl(page, 'homeBy')).toHaveValue('1410');
    await expect(action(page, 'Apply time change')).toBeDisabled();
    await expectWorldAndCore(page); // The longest unchanged-clock hint must not hide either lane or any control.
    await expectVisibleControls(page);
    await expectKeyboardComparisonScroll(page);
    await expect(clockControl(page, 'homeBy')).toHaveValue('1410');
    await expectStage(page, 'baseline', 'baseline', true);
    await expectSeriousAxeClear(page);
    await tabTo(page, '15 minutes earlier');
    for (let step = 0; step < 4; step += 1) await page.keyboard.press('Enter');
    await expect(clockControl(page, 'homeBy')).toHaveValue('1350');
    await expectWorldAndCore(page);
    await expectVisibleControls(page); // Includes the active native time select.
    await expectSeriousAxeClear(page);
    await tabTo(page, 'Apply time change');
    await page.keyboard.press('Enter');
    await expectStage(page, 'changed');
    await expect(page.getByTestId('decision-feedback')).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await expectWorldAndCore(page);
    await expectVisibleControls(page);
    await expectNoOverflow(page);
    await inspectCommonTimeline(page);
    await openDisclosure(page, 'Open the bill and assumptions');
    await openDisclosure(page, 'Sources and what is still unknown');
    await expect(sheet(page)).toHaveCount(1);
    await expect(experience(page)).toContainText(/entry.*(?:unknown|unverified)|eligibility.*(?:unknown|unverified)/i);
    await expect(experience(page)).toContainText(/(?:train|transport|service).*(?:unverified|not verified|unknown|check)/i);
    await expect(experience(page)).toContainText(/queue/i);
    await expect(experience(page)).toContainText(/not a guarantee|no guarantee/i);
    await expect(experience(page)).toContainText(/illustrative|authored/i);
    await expectVisibleControls(page);
    await expectNoOverflow(page);
    await expectSeriousAxeClear(page);
    await closeDisclosure(page, 'Sources and what is still unknown');

    // Replaced controls must transfer actual keyboard focus on every transition.
    await action(page, 'Preview a shorter Shenzhen walk').press('Enter');
    await expectStage(page, 'changed', 'revised', true);
    await expect(page.getByTestId('decision-feedback')).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await expectWorldAndCore(page);
    await action(page, 'Cancel preview').press('Enter');
    await expectStage(page, 'changed');
    await expect(page.getByTestId('decision-feedback')).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await action(page, 'Preview a shorter Shenzhen walk').press('Enter');
    await action(page, 'Choose shorter Shenzhen walk').press('Enter');
    await expectStage(page, 'revised');
    await expect(page.getByTestId('decision-feedback')).toBeFocused();
    await expectKeyboardFocusVisible(page);
    await inspectCommonTimeline(page);
    await expectWorldAndCore(page);
    await expectVisibleControls(page);
    await expectNoOverflow(page);
    await expectSeriousAxeClear(page);
    const motion = await page.evaluate(() => ({
      requested: matchMedia('(prefers-reduced-motion: reduce)').matches,
      transitions: [...document.querySelectorAll('[data-testid="decision-sheet"], .decision-world-image, .decision-deadline-line, .decision-time-segment')]
        .flatMap(element => getComputedStyle(element).transitionDuration.split(',').map(value => Number.parseFloat(value))),
      running: document.getAnimations().filter(animation => animation.playState === 'running')
        .map(animation => Number(animation.effect?.getComputedTiming().duration ?? 0)),
    }));
    expect(motion.requested).toBe(true);
    expect(motion.transitions.every(duration => duration === 0), 'Reduced motion means actual zero-duration transitions.').toBe(true);
    expect(motion.running.filter(duration => duration > 0)).toEqual([]);
    await audit.expectZero(page);
  });
}

for (const width of [360, 390]) {
  test(`phone changes only the deadline marker while world and consequences remain visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await startFresh(page);
    await expectWorldAndCore(page);
    await chooseBaseline(page, 'Shenzhen');
    await expectWorldAndCore(page);
    const before = await readCoreGeometry(page);
    const originalTrackNodes = await Promise.all(['HK', 'SZ'].map(city => page.getByTestId(`decision-timeline-${city}`).elementHandle()));
    expect(originalTrackNodes.every(Boolean)).toBe(true);
    const worldBefore = await world(page).boundingBox();
    const deadline = action(page, 'Change home-by');
    await expect(deadline).toBeInViewport({ ratio: 1 });
    await deadline.click();
    await clockControl(page, 'homeBy').selectOption('1350');
    await expectWorldAndCore(page);
    const apply = action(page, 'Apply time change');
    await expect(apply).toBeInViewport({ ratio: 1 });
    const actionBox = (await apply.boundingBox())!;
    await applyTimeChange(page);
    await expectWorldAndCore(page);
    const displacement = before.tracks[0].width * 60 / 660;
    await expect.poll(async () => Math.abs((await page.getByTestId('decision-deadline-marker').boundingBox())!.x - (before.marker.x - displacement))).toBeLessThanOrEqual(2);
    const after = await readCoreGeometry(page);
    for (const [index, city] of ['HK', 'SZ'].entries()) {
      expect(await originalTrackNodes[index]!.evaluate((node, id) => node.isConnected && node === document.querySelector(`[data-testid="decision-timeline-${id}"]`), city),
        `${city} keeps the exact original track DOM node through the deadline change.`).toBe(true);
    }
    expect(after.tracks, 'Both complete routes retain their exact real segment geometry.').toEqual(before.tracks);
    expect(after.outcomes.map(({ deadline: _deadline, ...rest }) => rest)).toEqual(before.outcomes.map(({ deadline: _deadline, ...rest }) => rest));
    expect(after.marker.minute).toBe('1350');
    expect(before.marker.minute).toBe('1410');
    expect(Math.abs(before.marker.x - after.marker.x - displacement), 'Only the deadline line moves one hour on the common eleven-hour scale.').toBeLessThanOrEqual(2);
    expect(await world(page).boundingBox()).toEqual(worldBefore);
    const feedback = page.getByTestId('decision-feedback');
    await expect(feedback).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('decision-outcome-SZ').locator('.decision-lane-facts')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('decision-outcome-SZ').locator('.decision-lane-facts')).toContainText(/15\s*(?:min|minute).*late/i);
    await expect(feedback).toContainText(/cost|bill/i);
    expect(Math.abs((await feedback.boundingBox())!.y - actionBox.y), 'The causal feedback occupies the same compact action area.').toBeLessThanOrEqual(240);
    const previewAction = action(page, 'Preview a shorter Shenzhen walk');
    await expect(previewAction).toBeInViewport({ ratio: 1 });
    const previewBox = (await previewAction.boundingBox())!;
    await previewAction.click();
    await expectWorldAndCore(page);
    await expect(feedback).toBeInViewport({ ratio: 1 });
    await expect(feedback).toContainText(/45\s*(?:→|to)\s*15|30\s*(?:min|minute)/i);
    expect(Math.abs((await feedback.boundingBox())!.y - previewBox.y)).toBeLessThanOrEqual(240);
    await expectNoOverflow(page);
  });
}

test('storage audit detects blocked attempts without reading any saved data', async ({ page, context }) => {
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  await audit.expectZero(page);
  const attempts = await page.evaluate(async () => {
    const failures = [];
    for (const area of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
      try { Reflect.get(window, area); failures.push('unexpected success'); }
      catch (error) { failures.push(error instanceof DOMException ? error.name : String(error)); }
    }
    try { Reflect.get(document, 'cookie'); failures.push('unexpected success'); }
    catch (error) { failures.push(error instanceof DOMException ? error.name : String(error)); }
    const audit = (window as typeof window & { __decisionStorageAudit: { pending: Promise<unknown>[] } }).__decisionStorageAudit;
    await Promise.all(audit.pending);
    return failures;
  });
  expect(attempts).toEqual(Array(5).fill('SecurityError'));
  expect(audit.reports.map(({ area, operation }) => ({ area, operation }))).toEqual([
    ...['localStorage', 'sessionStorage', 'indexedDB', 'caches'].map(area => ({ area, operation: 'acquire' })),
    { area: 'cookie', operation: 'read' },
  ]);
});
