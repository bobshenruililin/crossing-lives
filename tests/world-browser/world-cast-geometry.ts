import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../../public-world/art/cast-manifest.json', import.meta.url), 'utf8')) as { assets: { id: string; file: string; footAnchor: { x: number; y: number } }[] };

/** Whole-image oracle for a complete single pose. Never use the legacy627px cell. */
export async function expectVisibleCast(page: Page, actor: Locator, id: string) {
  const approved = manifest.assets.find(asset => asset.id === id)!; expect(approved).toBeTruthy();
  await expect(actor).toHaveAttribute('data-cast-id', id); await expect(actor).toHaveAttribute('data-cast-pose', 'single-idle');
  await expect(actor.locator('img')).toHaveAttribute('src', page.url().startsWith('file:') ? /^data:image\/png;base64,/ : new RegExp(`/art/${approved.file.replace('.', '\\.')}$`));
  await expect(actor.locator('[data-cast-fallback]')).toHaveCount(0);
  const result = await actor.evaluate(async (node, foot) => {
    const img = node.querySelector<HTMLImageElement>('img')!; await img.decode();
    const crop = node.querySelector<HTMLElement>('.world-sprite-crop')!;
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const imageStyle = getComputedStyle(img), cropStyle = getComputedStyle(crop), scale = parseFloat(imageStyle.width) / img.naturalWidth;
    const localLeft = parseFloat(imageStyle.left), localTop = parseFloat(imageStyle.top), width = parseFloat(cropStyle.width), height = parseFloat(cropStyle.height);
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0, visiblePixels = 0, croppedPixels = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); visiblePixels++;
      const px = localLeft + (x + .5) * scale, py = localTop + (y + .5) * scale;
      if (px < -.02 || py < -.02 || px > width + .02 || py > height + .02) croppedPixels++;
    }
    const rect = crop.getBoundingClientRect(), image = img.getBoundingClientRect(), stage = document.querySelector('#world-stage')!.getBoundingClientRect();
    const plane = document.querySelector<HTMLElement>('.world-plane')!, cameraScale = new DOMMatrix(getComputedStyle(plane).transform).a, planeRect = plane.getBoundingClientRect();
    const mirrored = new DOMMatrix(cropStyle.transform).a < 0, x0 = localLeft + left * scale, x1 = localLeft + right * scale;
    const alpha = { left: rect.left + (mirrored ? width - x1 : x0) * cameraScale, right: rect.left + (mirrored ? width - x0 : x1) * cameraScale, top: rect.top + (localTop + top * scale) * cameraScale, bottom: rect.top + (localTop + bottom * scale) * cameraScale };
    const footLocalX = localLeft + foot.x * scale;
    const footScreen = { x: rect.left + (mirrored ? width - footLocalX : footLocalX) * cameraScale, y: rect.top + (localTop + foot.y * scale) * cameraScale };
    const actorScreen = { x: planeRect.left + Number((node as HTMLElement).dataset.x) * cameraScale, y: planeRect.top + Number((node as HTMLElement).dataset.y) * cameraScale };
    const intersection = Math.max(0, Math.min(alpha.right, stage.right) - Math.max(alpha.left, stage.left)) * Math.max(0, Math.min(alpha.bottom, stage.bottom) - Math.max(alpha.top, stage.top));
    const covers = [...document.querySelectorAll('.world-header,.world-controls,.world-movement-hint')].map(el => el.getBoundingClientRect());
    const upperBodyCovered = [.25,.5].some(fraction => { const x = (alpha.left + alpha.right) / 2, y = alpha.top + (alpha.bottom - alpha.top) * fraction; return covers.some(r => x > r.left && x < r.right && y > r.top && y < r.bottom); });
    return { natural: [img.naturalWidth,img.naturalHeight], visiblePixels, croppedPixels, visibleRatio: intersection / ((alpha.right - alpha.left) * (alpha.bottom - alpha.top)), alpha, footScreen, actorScreen, mirrored, upperBodyCovered, sourceRatio: img.naturalWidth / img.naturalHeight, renderedRatio: image.width / image.height };
  }, approved.footAnchor);
  expect(result.natural).toEqual([1254,1254]); expect(result.visiblePixels).toBeGreaterThan(250_000);
  expect(result.croppedPixels, 'All alpha >8 pixels from the complete image survive the production crop.').toBe(0);
  expect(Math.abs(result.renderedRatio - result.sourceRatio)).toBeLessThan(.0001);
  expect(result.visibleRatio, 'Actual alpha body remains inside the world.').toBeGreaterThanOrEqual(.995);
  expect(Math.abs(result.footScreen.x - result.actorScreen.x), 'Mirroring keeps the shoe-contact ground x.').toBeLessThan(.05);
  expect(Math.abs(result.footScreen.y - result.actorScreen.y), 'Measured shoe contacts sit on the actor ground y.').toBeLessThan(.05);
  expect(result.mirrored).toBe((await actor.getAttribute('data-facing')) === 'left');
  expect(result.alpha.bottom - result.alpha.top).toBeGreaterThan(id === 'child' ? 70 : 100); expect(result.upperBodyCovered).toBe(false);
  return result;
}

/** Check every family member, including the previously unasserted companion.
 * Uses independently scanned rendered pixels, not production layout constants. */
export async function expectVisibleFamilyBodies(page: Page) {
  for (const role of ['player', 'friend', 'child'] as const) {
    const actor = page.getByTestId(`world-${role}`);
    const result = await actor.evaluate(async (node, role) => {
      const img = node.querySelector<HTMLImageElement>('img')!; await img.decode();
      const crop = node.querySelector<HTMLElement>('.world-sprite-crop')!;
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const imageStyle = getComputedStyle(img), cropStyle = getComputedStyle(crop), localScale = parseFloat(imageStyle.width) / img.naturalWidth;
      const localLeft = parseFloat(imageStyle.left), localTop = parseFloat(imageStyle.top), cropWidth = parseFloat(cropStyle.width), cropHeight = parseFloat(cropStyle.height);
      // Only the original player is a multi-pose sheet. Its authored first cell
      // is independent of CSS cropping; the other two use their whole images.
      const sourceWidth = role === 'player' ? 627 : canvas.width, sourceHeight = role === 'player' ? 627 : canvas.height;
      let left = sourceWidth, top = sourceHeight, right = 0, bottom = 0, visiblePixels = 0, croppedPixels = 0;
      for (let y = 0; y < sourceHeight; y++) for (let x = 0; x < sourceWidth; x++) if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); visiblePixels++;
        const px = localLeft + (x + .5) * localScale, py = localTop + (y + .5) * localScale;
        if (px < -.02 || py < -.02 || px > cropWidth + .02 || py > cropHeight + .02) croppedPixels++;
      }
      const rect = crop.getBoundingClientRect(), scale = rect.height / cropHeight, mirrored = new DOMMatrix(cropStyle.transform).a < 0;
      const x0 = localLeft + left * localScale, x1 = localLeft + right * localScale;
      const alpha = { left: rect.left + (mirrored ? cropWidth - x1 : x0) * scale, right: rect.left + (mirrored ? cropWidth - x0 : x1) * scale, top: rect.top + (localTop + top * localScale) * scale, bottom: rect.top + (localTop + bottom * localScale) * scale };
      const stage = document.querySelector('#world-stage')!.getBoundingClientRect();
      const intersection = Math.max(0, Math.min(alpha.right, stage.right) - Math.max(alpha.left, stage.left)) * Math.max(0, Math.min(alpha.bottom, stage.bottom) - Math.max(alpha.top, stage.top));
      return { role, alpha, visiblePixels, croppedPixels, visibleRatio: intersection / ((alpha.right - alpha.left) * (alpha.bottom - alpha.top)), viewport: { width: stage.width, height: stage.height } };
    }, role);
    expect(result.visiblePixels).toBeGreaterThan(1000);
    expect(result.croppedPixels / result.visiblePixels).toBeLessThan(.002);
    expect(result.visibleRatio, `The ${role} actual alpha body must remain visible: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(.995);
  }
}
