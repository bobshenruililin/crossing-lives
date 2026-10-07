import { test, expect, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Standalone smoke is intentionally independent of Chromium's CDP touch-swipe helper.
async function visibleTap(target: Locator) {
  await expect(target).toBeVisible();
  const visible = await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    let clipped = r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p), c = p.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(s.overflowX) && (r.left < c.left + p.clientLeft - 1 || r.right > c.left + p.clientLeft + p.clientWidth + 1)) clipped = true;
      if (/auto|scroll|hidden|clip/.test(s.overflowY) && (r.top < c.top + p.clientTop - 1 || r.bottom > c.top + p.clientTop + p.clientHeight + 1)) clipped = true;
    }
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { clipped, width: r.width, height: r.height, hit: !!top && el.contains(top) };
  });
  expect(visible.clipped).toBe(false); expect(visible.hit).toBe(true);
  expect(visible.width).toBeGreaterThanOrEqual(44); expect(visible.height).toBeGreaterThanOrEqual(44);
  await target.tap();
}
test('standalone WebKit loads offline and supports touch movement, plan commit and close', async ({ page, context, browser }, info) => {
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_WORLD_COMMIT;
  expect(commit).toMatch(/^[a-f0-9]{40}$/);
  const out = resolve('artifacts/world-webkit'); await mkdir(out, { recursive: true });
  const errors: string[] = [], network: string[] = [], input: { trusted: boolean; pointerType: string }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (/^(https?|wss?):/i.test(request.url())) network.push(request.url()); });
  await context.exposeBinding('__webkitTouchObservation', (_source, event: { trusted: boolean; pointerType: string }) => input.push(event));
  await context.addInitScript(() => {
    const w = window as typeof window & { __webkitTouchObservation: (value: { trusted: boolean; pointerType: string }) => Promise<unknown> };
    document.addEventListener('pointerdown', event => { void w.__webkitTouchObservation({ trusted: event.isTrusted, pointerType: event.pointerType }); }, { capture: true, passive: true });
  });
  let completed = false;
  let decodedArt: { complete: boolean; width: number; height: number } | null = null;
  type RenderedPosition = { x: number; width: number; height: number; planeWidth: number; planeHeight: number };
  let renderedMovement: { before: RenderedPosition; after: RenderedPosition } | null = null;
  try {
    await page.goto(pathToFileURL(resolve('artifacts/crossing-lives-world.html')).href);
    await expect(page).toHaveURL(/^file:/);
    await visibleTap(page.getByRole('button', { name: 'Play', exact: true }));
    const app = page.getByTestId('world-app'), player = page.getByTestId('world-player');
    await expect(app).toHaveAttribute('data-scene', 'hk-home'); await expect(app).toHaveAttribute('data-art-status', 'ready');
    const background = page.locator('.world-background');
    await expect(background).toBeVisible(); await expect(background).toHaveAttribute('src', /^data:image\//);
    decodedArt = await background.evaluate(async (image: HTMLImageElement) => { await image.decode(); return { complete: image.complete, width: image.naturalWidth, height: image.naturalHeight }; });
    expect(decodedArt.complete).toBe(true); expect(decodedArt.width).toBeGreaterThan(0); expect(decodedArt.height).toBeGreaterThan(0);
    await expect(player).toBeVisible();
    const renderedPosition = () => player.evaluate(el => {
      const playerRect = el.getBoundingClientRect(), planeRect = el.closest('.world-plane')!.getBoundingClientRect();
      return { x: playerRect.left - planeRect.left, width: playerRect.width, height: playerRect.height, planeWidth: planeRect.width, planeHeight: planeRect.height };
    });
    const before = Number(await player.getAttribute('data-x')), beforeRendered = await renderedPosition();
    for (const value of [beforeRendered.width, beforeRendered.height, beforeRendered.planeWidth, beforeRendered.planeHeight]) expect(value).toBeGreaterThan(0);
    await visibleTap(page.getByRole('button', { name: 'Walk left', exact: true }));
    await expect(player).toHaveAttribute('data-walking', 'false'); expect(Number(await player.getAttribute('data-x'))).toBeLessThan(before);
    await expect.poll(async () => (await renderedPosition()).x, { message: 'Trusted Walk-left tap moves the rendered player relative to the actual world plane' }).toBeLessThan(beforeRendered.x - 1);
    await expect(player).toBeVisible();
    const afterRendered = await renderedPosition();
    for (const value of [afterRendered.width, afterRendered.height, afterRendered.planeWidth, afterRendered.planeHeight]) expect(value).toBeGreaterThan(0);
    renderedMovement = { before: beforeRendered, after: afterRendered };
    await visibleTap(page.locator('.world-inspect-control')); const panel = page.getByTestId('world-insight-hk-home');
    await expect(panel.getByRole('status')).toContainText('30 minutes spare');
    await visibleTap(panel.getByRole('button', { name: /^Shorten/ }));
    await expect(panel.getByRole('status')).toContainText('60 minutes spare');
    await visibleTap(panel.getByRole('button', { name: 'Take this plan', exact: true }));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await visibleTap(page.getByRole('button', { name: 'Open world map', exact: true }));
    const plan = page.getByTestId('committed-home-plan'); await visibleTap(plan.locator('summary'));
    await expect(plan).toContainText('60 minutes spare');
    await expect(plan.locator('[data-plan-activity=lunch]')).toHaveAttribute('data-plan-choice', 'short');
    const frame = resolve(out, 'webkit-carried-plan.png'); await page.screenshot({ path: frame }); await info.attach('webkit-carried-plan', { path: frame, contentType: 'image/png' });
    await visibleTap(page.getByRole('dialog').getByRole('button', { name: /^Close / })); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(app).toHaveAttribute('data-scene', 'hk-home');
    expect(errors).toEqual([]); expect(network).toEqual([]);
    expect(input.length).toBeGreaterThanOrEqual(8); expect(input.every(event => event.trusted && event.pointerType === 'touch')).toBe(true);
    completed = true;
  } finally {
    await writeFile(resolve(out, 'webkit-smoke.json'), JSON.stringify({ commit, completed, browser: browser.version(), scope: 'Linux Playwright WebKit emulation at 390x844; not physical iPhone or Safari validation', standalone: true, offline: true, decodedArt, renderedMovement, input, errors, network }, null, 2));
  }
});
