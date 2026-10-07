import { expect, type Page } from '@playwright/test';
import { expectHitTarget, openPoint } from './world-helpers';

/** Real geographic controls, with invariant coastline/boundary geometry between
 * narrative chapters. No hidden state, pixel preloading or injected focus. */
export async function checkRegionalDiscovery(page: Page) {
  const component = page.getByTestId('regional-map-discovery');
  const map = component.getByTestId('regional-geographic-map'), label = component.getByTestId('regional-active-label');
  const locate = component.getByRole('combobox', { name: 'Locate', exact: true });
  await component.getByRole('button', { name: 'Hong Kong–Shenzhen', exact: true }).click();
  await expect(map).toHaveAttribute('viewBox', '0 0 1000 790');
  const baseGeometry = () => map.locator('[data-layer=land],[data-layer=coastline],[data-layer=hk-mainland-boundary]').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  const base = await baseGeometry(); expect(base.length).toBeGreaterThan(3);
  const readLabel = async () => {
    await expect(label).toHaveCount(1); await expect(label).toBeVisible();
    const r = await label.evaluate(el => { const r = el.getBoundingClientRect(), parent = el.parentElement!.getBoundingClientRect(); return { font: parseFloat(getComputedStyle(el).fontSize), contained: r.left >= parent.left - 1e-6 && r.right <= parent.right + 1e-6 && r.top >= parent.top - 1e-6 && r.bottom <= parent.bottom + 1e-6 }; });
    expect(r.font).toBeGreaterThanOrEqual(12); expect(r.contained).toBe(true);
  };
  for (const [index, id, name] of [[0, 'luohu', 'Luohu'], [1, 'futian', 'Futian'], [2, 'qianhai', 'Qianhai'], [3, 'nanshan', 'Nanshan']] as const) {
    const chapter = component.locator(`[data-chapter-index="${index}"]`);
    await chapter.click(); await expect(chapter).toHaveAttribute('aria-pressed', 'true');
    await expect(locate).toHaveValue(id); await expect(label).toHaveText(name); await readLabel();
    expect(await baseGeometry(), 'Selecting a period never turns present geography into an invented historical coastline.').toEqual(base);
  }
  // A real chapter click establishes focus; native keys move focus and selection.
  const first = component.locator('[data-chapter-index="0"]');
  await first.click(); await expect(first).toBeFocused();
  await page.keyboard.press('End'); await expect(component.locator('[data-chapter-index="3"]')).toBeFocused();
  await page.keyboard.press('Home'); await expect(first).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(locate).toHaveValue('futian');
  await expect(component.locator('[data-chapter-index="1"]')).toBeFocused();
  for (const id of ['luohu', 'futian', 'nanshan', 'qianhai', 'lo-wu', 'lok-ma-chau']) { await locate.selectOption(id); await readLabel(); }
  const local = await map.locator('[data-place]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute('data-place'), { x: Number(node.getAttribute('cx') ?? node.getAttribute('x')), y: Number(node.getAttribute('cy') ?? node.getAttribute('y')) }])));
  expect(local.luohu.x).toBeGreaterThan(local.futian.x); expect(local.futian.x).toBeGreaterThan(local.nanshan.x); expect(local.nanshan.x).toBeGreaterThan(local.qianhai.x);
  await expect(component.getByText('© OpenStreetMap contributors · ODbL', { exact: true })).toBeVisible();
  await component.getByRole('button', { name: 'Greater Bay Area', exact: true }).click();
  await expect(map).toHaveAttribute('viewBox', '0 0 1000 751'); await expect(locate.locator('option')).toHaveCount(11);
  for (const id of ['hong-kong', 'shenzhen', 'dongguan', 'guangzhou', 'foshan', 'zhaoqing', 'jiangmen', 'zhongshan', 'zhuhai', 'macau', 'huizhou']) { await locate.selectOption(id); await readLabel(); }
  const research = component.locator('.rmd-research'); await research.locator(':scope > summary').click();
  const href = await component.getByRole('link', { name: 'Download boundary source data (.geojson)' }).getAttribute('href');
  expect(href).toMatch(/^data:application\/geo\+json/);
  expect(JSON.parse(decodeURIComponent(href!.split(',').slice(1).join(','))).properties.license).toBe('ODbL-1.0');
  const deeper = component.locator('.rmd-deeper'); if (await deeper.getAttribute('open') === null) await deeper.locator(':scope > summary').click();
  const boundaryNote = component.getByText('The former internal line is not drawn on this map.', { exact: true });
  await expect(boundaryNote).toBeVisible();
  await boundaryNote.scrollIntoViewIfNeeded();
  await expectHitTarget(page.getByRole('dialog').getByRole('button', { name: /^Close / }));
  await research.locator(':scope > summary').click();
  await component.getByRole('button', { name: 'Hong Kong–Shenzhen', exact: true }).click(); await expect(locate).toHaveValue('lok-ma-chau');
  for (const control of await component.locator('button,select,summary').all()) {
    if (!(await control.isVisible())) continue;
    await control.scrollIntoViewIfNeeded(); await expectHitTarget(control);
  }
  expect(await component.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
  // Long evidence scroll must leave a real, usable Close control in its frame.
  const finalResearch = component.locator('.rmd-research');
  await finalResearch.locator(':scope > summary').click();
  const finalDeeper = component.locator('.rmd-deeper');
  if (await finalDeeper.getAttribute('open') === null) await finalDeeper.locator(':scope > summary').click();
  await component.getByText('The former internal line is not drawn on this map.', { exact: true }).scrollIntoViewIfNeeded();
  const scrollBody = page.locator('.world-modal-scroll');
  await scrollBody.hover(); await page.mouse.wheel(0, 20_000);
  await expect.poll(() => scrollBody.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
  const dialog = page.getByRole('dialog'), close = dialog.getByRole('button', { name: /^Close / });
  await expectHitTarget(close);
  const contained = await close.evaluate(el => { const r = el.getBoundingClientRect(), d = el.closest('[role=dialog]')!.getBoundingClientRect(); return r.left >= d.left && r.right <= d.right && r.top >= d.top && r.bottom <= d.bottom; });
  expect(contained).toBe(true);
  await close.click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await openPoint(page, 'planning-museum');
  await expect(component.getByRole('combobox', { name: 'Locate', exact: true })).toHaveValue('lok-ma-chau');
}

