import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { artFor, CASES, exitFor, nameFor, pointFor } from './world-fixtures';
import type { SceneId } from '../../src/world/types';

export const world = (page: Page) => page.getByTestId('world-app');
export const player = (page: Page) => page.getByTestId('world-player');
export const insight = (page: Page, id: SceneId) => page.getByTestId(id === 'planning-museum' ? 'regional-map-discovery' : `world-insight-${id}`);
export const choiceAttribute = (id: SceneId) => id === 'planning-museum' ? 'data-region' : 'data-choice';
export const background = (page: Page) => page.locator('.world-background');
export const stage = (page: Page) => page.getByTestId('world-stage');
export const visibleButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true });
export async function capture(page: Page, info: TestInfo, name: string) {
  const directory = resolve('artifacts/world/gates', info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
}
export async function startWorld(page: Page, url = '/world.html', touch = false) {
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  if (touch) await page.getByRole('button', { name: 'Play', exact: true }).tap();
  else await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(world(page)).toHaveAttribute('data-started', 'true');
  await expect(world(page)).toHaveAttribute('data-party', 'two-friends');
  await expect(stage(page)).toBeFocused();
  await expectScene(page, 'hk-home');
}
export async function expectScene(page: Page, id: SceneId, embedded = page.url().startsWith('file:')) {
  await expect(world(page)).toHaveAttribute('data-scene', id);
  await expect(world(page)).toHaveAttribute('data-travel', 'none');
  await expect(world(page)).toHaveAttribute('data-art-status', 'ready');
  await expect(background(page)).toBeVisible();
  await expect(background(page)).toHaveAttribute('alt', artFor(id).alt);
  await expect(background(page)).toHaveAttribute('src', embedded ? /^data:image\// : new RegExp(`${id}\\.webp$`));
  const decoded = await background(page).evaluate(async (img: HTMLImageElement) => {
    await img.decode(); return { complete: img.complete, width: img.naturalWidth, height: img.naturalHeight };
  });
  expect(decoded.complete).toBe(true); expect(decoded.width).toBeGreaterThanOrEqual(1500); expect(decoded.height).toBeGreaterThanOrEqual(900);
  await expect(player(page)).toBeVisible();
  await expect(player(page).locator('img')).toBeVisible();
  expect(await player(page).locator('img').evaluate(async (img: HTMLImageElement) => { await img.decode(); return img.naturalWidth; })).toBeGreaterThan(0);
  await expect(page.locator('.world-schematic')).toHaveCount(0);
}
export async function position(page: Page) {
  return { x: Number(await player(page).getAttribute('data-x')), y: Number(await player(page).getAttribute('data-y')) };
}
export async function openPoint(page: Page, id: SceneId, method: 'button' | 'key' | 'touch' = 'button') {
  if (method === 'key') { await stage(page).focus(); await page.keyboard.press('e'); }
  else {
    const control = page.locator('.world-inspect-control');
    if (await control.getAttribute('data-action') === 'enter') {
      const step = page.getByRole('button', { name: 'Walk right', exact: true });
      if (method === 'touch') await step.tap(); else await step.click();
      await expect(player(page)).toHaveAttribute('data-walking', 'false');
    }
    await expect(control).toHaveAccessibleName(`Explore ${pointFor(id).label.toLowerCase()}`);
    if (method === 'touch') await control.tap(); else await control.click();
  }
  await expect(page.getByRole('dialog', { name: pointFor(id).label, exact: true })).toBeVisible();
  await expect(insight(page, id)).toBeVisible();
  await expect(player(page)).toHaveAttribute('data-walking', 'false');
}
export async function closePoint(page: Page) {
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function mapTo(page: Page, id: SceneId, embedded = false) {
  await page.getByRole('button', { name: 'Open world map', exact: true }).click();
  const map = page.getByRole('dialog', { name: 'World map', exact: true });
  await expect(map).toBeVisible();
  await map.getByRole('button', { name: nameFor(id), exact: true }).click();
  await expectScene(page, id, embedded);
}
/** Click the visible route control, never an offscreen forced click or state seed. */
export async function takeExit(page: Page, from: SceneId, to: SceneId, embedded = false) {
  const label = `Walk to ${exitFor(from, to).label}`;
  const candidates = page.getByRole('button', { name: label, exact: true });
  let chosen: Locator | undefined;
  for (const candidate of await candidates.all()) {
    if (await candidate.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 0; })) { chosen = candidate; break; }
  }
  expect(chosen, `A user can reach the ${to} entrance from this view.`).toBeDefined();
  await expectHitTarget(chosen!);
  await chosen!.click();
  await expectScene(page, to, embedded);
}
/** Reads only the currently rendered decoded resource, and never warms next-scene art. */
export async function renderedArtHash(page: Page) {
  const data = await background(page).evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0); return canvas.toDataURL('image/png');
  });
  return createHash('sha256').update(data).digest('hex');
}
export async function approvedArtHash(id: SceneId) {
  expect(artFor(id).approved, `${id} requires reviewed approved art.`).toBe(true);
  return createHash('sha256').update(await readFile(resolve('public-world', artFor(id).src))).digest('hex');
}
export async function geometryFingerprint(page: Page, id: SceneId) {
  const svg = insight(page, id).locator(id === 'planning-museum' ? 'svg.rmd-map' : 'svg.wi-visual');
  // Observe final paint after finite authored transitions, without disabling them.
  await svg.evaluate(async el => {
    await Promise.all(el.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined)));
  });
  const geometry = await svg.evaluate(svg => [...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,g')].map(el => {
    const style = getComputedStyle(el);
    return { tag: el.tagName, attrs: [...el.attributes].filter(a => ['d', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'transform'].includes(a.name)).map(a => [a.name, a.value]),
      paint: [style.fill, style.stroke, style.strokeWidth, style.strokeDasharray, style.opacity, style.fillOpacity, style.visibility, style.display] };
  }));
  return createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
}
export async function selectChoice(page: Page, id: SceneId, index: 0 | 1) {
  const choice = CASES[id].choices[index];
  if (id === 'planning-museum') {
    const button = insight(page, id).getByRole('button', { name: choice.label, exact: true });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(insight(page, id)).toHaveAttribute('data-region', choice.value); return;
  }
  await insight(page, id).getByRole('radio', { name: choice.label, exact: true }).check();
  await expect(insight(page, id)).toHaveAttribute('data-choice', choice.value);
  await expect(insight(page, id).getByRole('radio', { name: choice.label, exact: true })).toBeChecked();
}
export async function expectFacts(page: Page, id: SceneId, index: 0 | 1) {
  if (id === 'planning-museum') {
    const component = insight(page, id), map = component.getByTestId('regional-geographic-map');
    await expect(map).toHaveAttribute('viewBox', index === 0 ? '0 0 1000 790' : '0 0 1000 751');
    await expect(component).toHaveAttribute('data-region', CASES[id].choices[index].value);
    await expect(component.getByRole('combobox', { name: 'Locate', exact: true }).locator('option')).toHaveCount(index === 0 ? 6 : 11);
    await expect(map.locator('[data-place]')).toHaveCount(index === 0 ? 6 : 11);
    await expect(component.getByText('© OpenStreetMap contributors · ODbL', { exact: true })).toBeVisible();
    await expect(component).toContainText('Real geography. Generalized present-day base.');
    await expect(component).toContainText("The game's walking route is fictional.");
    return;
  }
  const rows = insight(page, id).locator('[data-world-number]');
  await expect(rows).toHaveCount(CASES[id].choices[index].numbers.length);
  for (const [label, value, unit] of CASES[id].choices[index].numbers) {
    const row = rows.filter({ has: page.locator('dt', { hasText: label }) });
    await expect(row.locator('dt')).toHaveText(label); await expect(row.locator('strong')).toHaveText(value); await expect(row.locator('dd span')).toHaveText(unit);
  }
  await expect(insight(page, id).locator('[data-mechanism]')).toHaveAttribute('data-mechanism', CASES[id].mechanism);
  await expect(insight(page, id).locator('svg')).toHaveAccessibleName(/.{25}/);
  if (id === 'metro-carriage') await expect(insight(page, id).locator('[data-journey-part][data-included=true]')).toHaveCount(index === 0 ? 1 : 7);
  if (id === 'border-arrival') { await expect(insight(page, id).locator('[data-gate]')).toHaveCount(index === 0 ? 1 : 4); await expect(insight(page, id).locator('[data-gate]:not([data-status=not-checked])')).toHaveCount(0); }
  if (id === 'rental-home') {
    const heights = await insight(page, id).locator('[data-money-role]').evaluateAll(nodes => nodes.map(n => Number(n.getAttribute('height'))));
    expect(heights).toEqual([48, 96]);
    if (index === 1) expect(await insight(page, id).locator('[data-money-role=deposit]').evaluate(el => getComputedStyle(el).strokeDasharray)).not.toBe('none');
  }
  if (id === 'luxury-home') {
    const widths = await insight(page, id).locator('[data-payment-part]').evaluateAll(nodes => nodes.map(n => Number(n.getAttribute('width'))));
    expect(Math.abs(widths[0] / widths[1] - 2)).toBeLessThan(1e-6);
    if (index === 1) await expect(insight(page, id).locator('svg')).toHaveAccessibleName(/unknown/i);
  }
  if (id === 'office-floor') {
    await expect(insight(page, id).locator('[data-floor-part][data-observed=true]')).toHaveCount(index === 0 ? 2 : 0);
    await expect(insight(page, id).locator('[data-lease-status=unknown]')).toHaveCount(8);
  }
  if (id === 'learning-center') {
    await expect(insight(page, id).locator('[data-schedule-marker=arrival]')).toHaveAttribute('d', 'M144 62V138');
    await expect(insight(page, id).locator('[data-schedule-marker=class]')).toHaveAttribute('d', index === 0 ? 'M108 30V139' : 'M252 30V139');
  }

}
export async function expectUnknown(page: Page, id: SceneId) {
  if (id === 'planning-museum') {
    const component = insight(page, id), evidence = component.locator('.rmd-research');
    await evidence.locator(':scope > summary').click();
    await component.locator('.rmd-deeper > summary').click();
    await expect(component.getByText(CASES[id].unknown, { exact: true })).toBeVisible();
    await evidence.locator(':scope > summary').click(); return;
  }
  const evidence = insight(page, id).locator('.wi-evidence');
  await evidence.locator(':scope > summary').click();
  await expect(evidence.getByText(CASES[id].unknown, { exact: true })).toBeVisible();
  await evidence.locator(':scope > summary').click();
}
export async function expectHitTarget(target: Locator) {
  await expect(target).toBeVisible();
  const result = await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    const points = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 5, r.top + r.height / 2], [r.right - 5, r.top + r.height / 2], [r.left + r.width / 2, r.top + 5], [r.left + r.width / 2, r.bottom - 5]];
    return { width: r.width, height: r.height, contained: r.left >= -1e-6 && r.top >= -1e-6 && r.right <= innerWidth + 1e-6 && r.bottom <= innerHeight + 1e-6,
      hits: points.map(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit === el || (hit !== null && el.contains(hit)); }) };
  });
  expect(result.width).toBeGreaterThanOrEqual(44 - 1e-6); expect(result.height).toBeGreaterThanOrEqual(44 - 1e-6);
  expect(result.contained, 'The actual target rectangle is wholly in the viewport.').toBe(true);
  expect(result.hits, 'No sibling overlay steals the visible target hit area.').toEqual([true, true, true, true, true]);
}
export async function expectNoOverflow(page: Page) {
  const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, bodyWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight, x: scrollX, y: scrollY }));
  expect(size.documentWidth).toBeLessThanOrEqual(size.width + 1); expect(size.bodyWidth).toBeLessThanOrEqual(size.width + 1);
  expect(size.documentHeight).toBeLessThanOrEqual(size.height + 1); expect(size.bodyHeight).toBeLessThanOrEqual(size.height + 1); expect([size.x, size.y]).toEqual([0, 0]);
}
