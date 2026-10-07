import { expect, type Page } from '@playwright/test';
import { expectHitTarget, player } from './world-helpers';

/** Measures alpha independently within the authored upper-left 627×627 pose
 * cell of the four-pose sheet. The production crop is checked against that
 * whole cell, not used to choose pixels. No new Image or fetch is used. */
export async function expectVisibleSprite(page: Page) {
  const result = await player(page).evaluate(async node => {
    const img = node.querySelector('img')!; await img.decode();
    const crop = node.querySelector('.world-sprite-crop')!;
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Authored cell boundary is independent of CSS crop offsets and dimensions.
    const cell = { left: 0, top: 0, right: 627, bottom: 627 };
    let left = cell.right, top = cell.bottom, right = -1, bottom = -1, visiblePixels = 0, croppedPixels = 0;
    const imageStyle = getComputedStyle(img), cropStyle = getComputedStyle(crop);
    const localScale = parseFloat(imageStyle.width) / img.naturalWidth;
    const localLeft = parseFloat(imageStyle.left), localTop = parseFloat(imageStyle.top);
    const cropWidth = parseFloat(cropStyle.width), cropHeight = parseFloat(cropStyle.height);
    for (let y = cell.top; y < cell.bottom; y++) for (let x = cell.left; x < cell.right; x++) if (data[(y * canvas.width + x) * 4 + 3] > 8) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); visiblePixels++;
      const px = localLeft + (x + .5) * localScale, py = localTop + (y + .5) * localScale;
      if (px < -1e-6 || py < -1e-6 || px > cropWidth + 1e-6 || py > cropHeight + 1e-6) croppedPixels++;
    }
    const rect = crop.getBoundingClientRect(), imageRect = img.getBoundingClientRect(), stage = document.querySelector('#world-stage')!.getBoundingClientRect();
    const scale = rect.height / cropHeight;
    const flipped = new DOMMatrix(cropStyle.transform).a < 0;
    const x0 = localLeft + left * localScale, x1 = localLeft + (right + 1) * localScale;
    const y0 = localTop + top * localScale, y1 = localTop + (bottom + 1) * localScale;
    const alpha = { left: rect.left + (flipped ? cropWidth - x1 : x0) * scale, right: rect.left + (flipped ? cropWidth - x0 : x1) * scale, top: rect.top + y0 * scale, bottom: rect.top + y1 * scale };
    const intersection = Math.max(0, Math.min(alpha.right, stage.right) - Math.max(alpha.left, stage.left)) * Math.max(0, Math.min(alpha.bottom, stage.bottom) - Math.max(alpha.top, stage.top));
    const area = (alpha.right - alpha.left) * (alpha.bottom - alpha.top);
    const covers = [...document.querySelectorAll('.world-header, .world-controls, .world-movement-hint')].map(el => el.getBoundingClientRect());
    const bodyPoints = [[(alpha.left + alpha.right) / 2, alpha.top + (alpha.bottom - alpha.top) * .25], [(alpha.left + alpha.right) / 2, alpha.top + (alpha.bottom - alpha.top) * .5]];
    return { sourceWidth: img.naturalWidth, sourceHeight: img.naturalHeight, cell, sourceAlpha: { left, top, right, bottom }, visiblePixels, croppedPixels, alpha, crop: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      sourceRatio: img.naturalWidth / img.naturalHeight, renderedRatio: imageRect.width / imageRect.height,
      visibleRatio: intersection / area, height: alpha.bottom - alpha.top, width: alpha.right - alpha.left,
      upperBodyCovered: bodyPoints.some(([x, y]) => covers.some(r => x > r.left && x < r.right && y > r.top && y < r.bottom)) };
  });
  expect([result.sourceWidth, result.sourceHeight], 'The authored player sheet contains four 627×627 pose cells.').toEqual([1254, 1254]);
  expect(result.visiblePixels).toBeGreaterThan(1000);
  expect(result.croppedPixels / result.visiblePixels, 'The visible alpha body is retained inside the actual source crop.').toBeLessThan(.002);
  expect(Math.abs(result.renderedRatio - result.sourceRatio), 'A transform may flip the person but must not stretch it.').toBeLessThan(1e-6);
  expect(result.visibleRatio, 'Actual alpha-body bounds, not full transparent sheet bounds, stay inside the world.').toBeGreaterThanOrEqual(.995);
  expect(result.alpha.left).toBeGreaterThanOrEqual(result.crop.left - 1);
  expect(result.alpha.right).toBeLessThanOrEqual(result.crop.right + 1);
  expect(result.alpha.top).toBeGreaterThanOrEqual(result.crop.top - 1);
  expect(result.alpha.bottom).toBeLessThanOrEqual(result.crop.bottom + 1);
  expect(result.height).toBeGreaterThan(100); expect(result.width).toBeGreaterThan(24);
  expect(result.upperBodyCovered, 'Permanent controls must not obscure the actual head or torso.').toBe(false);
  return result;
}
export async function expectWorldDominant(page: Page) {
  const result = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('.world-header, .world-controls, .world-movement-hint, .world-route-cue, .world-art-status')].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
    let covered = 0, samples = 0;
    for (let y = 10; y < innerHeight; y += 20) for (let x = 10; x < innerWidth; x += 20) { samples++; if (panels.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) covered++; }
    const world = document.querySelector('#world-stage')!.getBoundingClientRect();
    return { uncovered: 1 - covered / samples, width: world.width / innerWidth, height: world.height / innerHeight,
      textWords: [...document.querySelectorAll('.world-header,.world-controls,.world-movement-hint,.world-route-cue')].map(e => e.textContent ?? '').join(' ').split(/\s+/).filter(Boolean).length };
  });
  expect(result.width).toBeGreaterThanOrEqual(.99); expect(result.height).toBeGreaterThanOrEqual(.99);
  expect(result.uncovered, 'World remains the main first view, with only compact permanent controls.').toBeGreaterThan(.65);
  expect(result.textWords).toBeLessThan(65);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function expectVisibleWorldTargets(page: Page) {
  for (const target of await page.locator('.world-target,.world-edge-cues button,.world-header-buttons button,.world-dpad button,.world-inspect-control,.world-back').all()) {
    const state = await target.evaluate(el => { const r = el.getBoundingClientRect(); return { displayed: r.width > 0 && r.height > 0, intersects: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight }; });
    if (state.displayed && state.intersects) await expectHitTarget(target);
  }
}
/** Observe DOM/image state on animation-frame callbacks during travel. Loaded
 * dimensions do not prove native decode completion or compositor paint; the
 * separate decode checks and untrimmed film provide those distinct observations. */
export async function observeFrames(page: Page) {
  await page.evaluate(() => {
    const w = window as typeof window & { __worldFrames: unknown[]; __stopWorldFrames: () => void };
    w.__worldFrames = []; let active = true, frame = 0;
    const sample = () => {
      if (!active) return;
      const app = document.querySelector('[data-testid=world-app]'), image = document.querySelector<HTMLImageElement>('.world-background');
      const player = document.querySelector<HTMLElement>('[data-testid=world-player]');
      w.__worldFrames.push({ scene: app?.getAttribute('data-scene'), status: app?.getAttribute('data-art-status'), travel: app?.getAttribute('data-travel'),
        source: image?.getAttribute('src') ?? null, loadedImage: Boolean(image?.complete && image?.naturalWidth), schematic: Boolean(document.querySelector('.world-schematic')),
        x: Number(player?.dataset.x), y: Number(player?.dataset.y) });
      frame = requestAnimationFrame(sample);
    };
    w.__stopWorldFrames = () => { active = false; cancelAnimationFrame(frame); }; frame = requestAnimationFrame(sample);
  });
}
export async function readFrames(page: Page) {
  return page.evaluate(() => {
    const w = window as typeof window & { __worldFrames: { scene: string; status: string; travel: string; source: string | null; loadedImage: boolean; schematic: boolean; x: number; y: number }[]; __stopWorldFrames: () => void };
    w.__stopWorldFrames(); return w.__worldFrames;
  });
}
