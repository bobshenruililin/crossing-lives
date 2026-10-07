import { test, expect, type Locator, type Page } from '@playwright/test';
import { capture, closePoint, expectHitTarget, expectNoOverflow, insight, mapTo, openOfficeDiagram, openPoint, stage, startWorld, world } from './world-helpers';
import { pointFor } from './world-fixtures';
import { auditWorldStorage } from './world-storage';

const office = (page: Page) => insight(page, 'office-floor');
async function change(page: Page, name: string) {
  if (name === 'Time' || name === 'Money') {
    const select = office(page).getByRole('combobox', { name: 'Compare travel', exact: true });
    await select.scrollIntoViewIfNeeded(); await expectHitTarget(select); await select.selectOption(name.toLowerCase()); await expect(select).toHaveValue(name.toLowerCase()); return;
  }
  const input = office(page).getByRole('radio', { name, exact: true }), label = input.locator('..');
  await label.scrollIntoViewIfNeeded(); await expectHitTarget(label); await label.click(); await expect(input).toBeChecked();
}
async function totals(page: Page, days: 2 | 4, measure: 'time' | 'money') {
  const component = office(page);
  await expect(component).toHaveAttribute('data-choice', String(days)); await expect(component).toHaveAttribute('data-measure', measure);
  const expected = measure === 'time' ? days === 2 ? ['12', '28'] : ['24', '56'] : days === 2 ? ['320', '800'] : ['640', '1,600'];
  await expect(component.locator('[data-world-number]')).toHaveCount(2);
  await expect(component.locator('[data-world-number] strong')).toHaveText(expected);
  await expect(component.locator('[data-world-number] dd span')).toHaveText([measure === 'time' ? 'hours' : 'HKD', measure === 'time' ? 'hours' : 'HKD']);
  await component.getByRole('status').scrollIntoViewIfNeeded();
  await positiveVisible(component.getByRole('status'));
}
async function positiveVisible(target: Locator) {
  await expect(target).toBeVisible();
  const value = await target.evaluate(el => {
    const r = el.getBoundingClientRect(), style = getComputedStyle(el), clips = [];
    for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const s = getComputedStyle(ancestor);
      if (/(auto|scroll|hidden|clip)/.test(`${s.overflowX} ${s.overflowY}`)) clips.push(ancestor.getBoundingClientRect());
    }
    return { width: r.width, height: r.height, opacity: Number(style.opacity), visible: style.visibility === 'visible',
      inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      unclipped: clips.every(clip => r.left >= clip.left - 1 && r.right <= clip.right + 1 && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1) };
  });
  expect(value.width).toBeGreaterThan(0); expect(value.height).toBeGreaterThan(0); expect(value.opacity).toBeGreaterThan(0);
  expect(value.visible).toBe(true); expect(value.inView).toBe(true); expect(value.unclipped).toBe(true);
}
/** Before any office input or scrolling: both choices, measure and complete totals fit. */
async function expectInitialOffice(page: Page) {
  const scroll = page.getByRole('dialog', { name: 'Office notebook', exact: true }).locator('.world-modal-scroll');
  expect(await scroll.evaluate(el => el.scrollTop)).toBe(0);
  await expect(office(page).locator('.ow-comparison')).not.toHaveAttribute('open');
  await expect(office(page).locator('.wi-evidence')).not.toHaveAttribute('open');
  for (const target of await office(page).locator('.ow-caption,.ow-scope,.ow-days label,.ow-measure select,[data-world-number] dt,[data-world-number] strong,[data-world-number] dd span').all()) await positiveVisible(target);
  for (const target of await office(page).locator('.ow-days label,.ow-measure select').all()) await expectHitTarget(target);
  await expect(office(page).locator('[data-world-number] strong')).toHaveText(['12', '28']);
  await expect(office(page).locator('[data-world-number] dd span')).toHaveText(['hours', 'hours']);
  expect(await scroll.evaluate(el => el.scrollTop)).toBe(0); await expectNoOverflow(page);
}
/** Observe rendered DOM route lengths and cell bounds; metadata/attributes alone cannot pass. */
async function geometry(page: Page, days: 2 | 4, measure: 'time' | 'money') {
  await openOfficeDiagram(page); const svg = office(page).locator('svg'); await positiveVisible(svg);
  const result = await svg.evaluate(el => {
    const box = el.getBoundingClientRect();
    const read = (node: Element) => { const r = node.getBoundingClientRect(), style = getComputedStyle(node); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, fill: style.fill, display: style.display, visibility: style.visibility, opacity: Number(style.opacity), hit: el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; };
    return { width: box.width, cells: [...el.querySelectorAll('[data-office-cell]')].map(read),
      selected: [...el.querySelectorAll('[data-office-return=true]')].map(read), unselected: [...el.querySelectorAll('[data-office-return=false]')].map(read),
      routes: [...el.querySelectorAll('[data-office-route]')].map(read), tracks: [...el.querySelectorAll('[data-office-track]')].map(read) };
  });
  expect(result.cells).toHaveLength(28); expect(result.selected).toHaveLength(days * 4);
  const scale = result.width / 360, widths = measure === 'time' ? days === 2 ? [72, 168] : [144, 336] : days === 2 ? [67.2, 168] : [134.4, 336];
  for (const [index, route] of result.routes.entries()) {
    expect(Math.abs(route.width - widths[index] * scale)).toBeLessThan(.1);
    expect(Math.abs(route.left - result.tracks[index].left)).toBeLessThan(.1);
    expect(Math.abs(result.tracks[index].width - 336 * scale)).toBeLessThan(.1);
  }
  for (const element of [...result.cells, ...result.routes]) {
    expect(element.width).toBeGreaterThan(0); expect(element.height).toBeGreaterThan(0);
    expect(element.display).not.toBe('none'); expect(element.visibility).toBe('visible'); expect(element.opacity).toBeGreaterThan(0); expect(element.hit).toBe(true);
  }
  expect(result.selected[0].fill).not.toBe(result.unselected[0].fill);
  for (const [index, cell] of result.cells.entries()) {
    expect(Math.abs(cell.width - 24 * scale)).toBeLessThan(.1); expect(Math.abs(cell.height - 16 * scale)).toBeLessThan(.1);
    expect(Math.abs(cell.left - result.cells[index % 7].left)).toBeLessThan(.1);
    expect(Math.abs(cell.top - result.cells[Math.floor(index / 7) * 7].top)).toBeLessThan(.1);
    if (index % 7) expect(cell.left).toBeGreaterThan(result.cells[index - 1].right);
    if (index >= 7) expect(cell.top).toBeGreaterThan(result.cells[index - 7].bottom);
  }
  await expectNoOverflow(page); return result.routes.map(route => route.width);
}

test('office workweek: both home totals and actual route lengths double with 8 to 16 returns', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await startWorld(page); await mapTo(page, 'office-floor'); await openPoint(page, 'office-floor');
  await totals(page, 2, 'time'); const short = await geometry(page, 2, 'time'); await capture(page, info, 'office-two-day-time');
  await change(page, '4 days / week'); await totals(page, 4, 'time'); const long = await geometry(page, 4, 'time');
  for (const index of [0, 1]) expect(Math.abs(long[index] / short[index] - 2)).toBeLessThan(.001);
  await change(page, 'Money'); await totals(page, 4, 'money'); await geometry(page, 4, 'money');
  await change(page, '2 days / week'); await totals(page, 2, 'money'); await geometry(page, 2, 'money');
  await capture(page, info, 'office-two-day-money');
});

test('office workweek: narrow portrait controls, visible calendar and optional limits stay reachable', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 844 }); await startWorld(page); await mapTo(page, 'office-floor'); await openPoint(page, 'office-floor');
  await expectInitialOffice(page); await capture(page, info, 'office-360-initial-no-scroll');
  for (const name of ['4 days / week', 'Money', '2 days / week', 'Time', '4 days / week']) await change(page, name);
  await totals(page, 4, 'time'); await geometry(page, 4, 'time'); await capture(page, info, 'office-portrait-calendar');
  const summary = office(page).locator('.wi-evidence > summary'); await summary.scrollIntoViewIfNeeded(); await expectHitTarget(summary); await summary.click();
  const unknown = office(page).getByText('Actual fares, routes, queues, rent, eligibility and building occupancy are unknown.', { exact: true });
  await unknown.scrollIntoViewIfNeeded(); await positiveVisible(unknown); await expectNoOverflow(page);
  await closePoint(page); await expect(page.locator(`#world-point-${pointFor('office-floor').id}`)).toBeFocused();
});

test('office workweek: native Tab and Arrow radio navigation, evidence and Escape restore visible focus', async ({ page }, info) => {
  await startWorld(page); await mapTo(page, 'office-floor'); await expect(stage(page)).toBeFocused(); await page.keyboard.press('e');
  const close = page.getByRole('button', { name: 'Close Office notebook', exact: true }); await expect(close).toBeFocused();
  await page.keyboard.press('Tab'); await expect(office(page).getByRole('radio', { name: '2 days / week', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight'); const four = office(page).getByRole('radio', { name: '4 days / week', exact: true }); await expect(four).toBeFocused(); await expect(four).toBeChecked(); await positiveVisible(four);
  await page.keyboard.press('Tab'); const measure = office(page).getByRole('combobox', { name: 'Compare travel', exact: true }); await expect(measure).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(measure).toHaveValue('money'); await positiveVisible(measure);
  await page.keyboard.press('ArrowUp'); await expect(measure).toHaveValue('time');
  await page.keyboard.press('Tab'); const diagram = office(page).locator('.ow-comparison > summary'); await expect(diagram).toBeFocused(); await positiveVisible(diagram);
  await page.keyboard.press('Space'); await expect(office(page).locator('.ow-comparison')).toHaveAttribute('open', '');
  await page.keyboard.press('Tab'); const summary = office(page).locator('.wi-evidence > summary'); await expect(summary).toBeFocused(); await positiveVisible(summary);
  await page.keyboard.press('Space'); await expect(office(page).locator('.wi-evidence')).toHaveAttribute('open', '');
  await page.keyboard.press('Tab'); await expect(close).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(summary).toBeFocused(); await positiveVisible(summary);
  await capture(page, info, 'office-native-focus'); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator(`#world-point-${pointFor('office-floor').id}`)).toBeFocused(); await expectNoOverflow(page);
});

test('office workweek: revisits preserve its two choices across scene-party changes without storage', async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } }); const audit = await auditWorldStorage(context), page = await context.newPage();
  try {
    await startWorld(page); await mapTo(page, 'office-floor'); await openPoint(page, 'office-floor'); await expectInitialOffice(page); await capture(page, info, 'office-390-initial-no-scroll'); await change(page, '4 days / week'); await change(page, 'Money'); await totals(page, 4, 'money'); await closePoint(page);
    await mapTo(page, 'learning-center'); await mapTo(page, 'office-floor'); await openPoint(page, 'office-floor'); await totals(page, 4, 'money'); await closePoint(page);
    for (const party of ['family', 'solo']) {
      await page.getByRole('button', { name: 'Change people and day', exact: true }).click(); await page.getByRole('combobox', { name: 'People', exact: true }).selectOption(party);
      await page.getByRole('combobox', { name: 'Day', exact: true }).selectOption('weekday'); await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
      await expect(world(page)).toHaveAttribute('data-party', party); await openPoint(page, 'office-floor'); await totals(page, 4, 'money'); await geometry(page, 4, 'money');
      await expect(office(page)).toContainText('Same Hong Kong job and pay.'); await closePoint(page);
    }
    await audit.expectZero(page); await page.reload(); await startWorld(page); await mapTo(page, 'office-floor'); await openPoint(page, 'office-floor'); await totals(page, 2, 'time'); await audit.expectZero(page);
  } finally { await context.close(); }
});
