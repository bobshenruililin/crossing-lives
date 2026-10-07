import { test, expect, type Locator } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { hashHttpExport } from './hash-http-export';

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
test('diagnostic exact served export supports WebKit touch movement, plan commit and close', async ({ page, context, browser }, info) => {
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_WORLD_COMMIT;
  expect(commit).toMatch(/^[a-f0-9]{40}$/);
  const out = resolve('artifacts/world-webkit/diagnostics'); await mkdir(out, { recursive: true });
  const errors: string[] = [], network: string[] = [], input: { trusted: boolean; pointerType: string }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (/^(https?|wss?):/i.test(request.url())) network.push(request.url()); });
  await context.exposeBinding('__webkitTouchObservation', (_source, event: { trusted: boolean; pointerType: string }) => input.push(event));
  await context.addInitScript(() => {
    const w = window as typeof window & { __webkitTouchObservation: (value: { trusted: boolean; pointerType: string }) => Promise<unknown> };
    document.addEventListener('pointerdown', event => { void w.__webkitTouchObservation({ trusted: event.isTrusted, pointerType: event.pointerType }); }, { capture: true, passive: true });
  });
  const sourceBytes = await readFile(resolve('artifacts/crossing-lives-world.html'));
  const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
  let responseSha256: string | null = null, servedBytes: number | null = null;
  let completed = false, failure: string | null = null, stage = 'independent-http-verification';
  let httpVerification: Awaited<ReturnType<typeof hashHttpExport>> | null = null;
  let browserResponseHeaders: Record<string, string> | null = null;
  let decodedArt: { complete: boolean; width: number; height: number } | null = null;
  type RenderedPosition = { x: number; width: number; height: number; planeWidth: number; planeHeight: number };
  let renderedMovement: { before: RenderedPosition; after: RenderedPosition } | null = null;
  try {
    await expect(page).toHaveURL('about:blank');
    httpVerification = await hashHttpExport('http://127.0.0.1:4183/crossing-lives-world.html', sourceBytes.length);
    servedBytes = httpVerification.bytes; responseSha256 = httpVerification.sha256;
    expect(httpVerification.status).toBe(200);
    expect(servedBytes).toBe(sourceBytes.length); expect(responseSha256).toBe(sourceSha256);
    expect(httpVerification.headers['content-length']).toBe(String(sourceBytes.length));
    expect(httpVerification.headers['x-diagnostic-source-sha256']).toBe(sourceSha256);
    expect(httpVerification.headers['content-encoding']).toBeUndefined();
    await expect(page).toHaveURL('about:blank');
    stage = 'browser-navigation';
    const response = await page.goto('/crossing-lives-world.html');
    expect(response).not.toBeNull(); expect(response!.status()).toBe(200);
    await expect(page).toHaveURL('http://127.0.0.1:4183/crossing-lives-world.html');
    browserResponseHeaders = await response!.allHeaders();
    expect(browserResponseHeaders['content-length']).toBe(String(sourceBytes.length));
    expect(browserResponseHeaders['x-diagnostic-source-sha256']).toBe(sourceSha256);
    expect(browserResponseHeaders['content-type']).toBe('text/html; charset=utf-8');
    expect(browserResponseHeaders['cache-control']).toBe('no-store');
    expect(browserResponseHeaders['content-encoding']).toBeUndefined();
    stage = 'touch-world-smoke';
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
    const frame = resolve(out, 'served-world-carried-plan.png'); await page.screenshot({ path: frame }); await info.attach('served-world-carried-plan', { path: frame, contentType: 'image/png' });
    await visibleTap(page.getByRole('dialog').getByRole('button', { name: /^Close / })); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(app).toHaveAttribute('data-scene', 'hk-home');
    expect(errors).toEqual([]); expect(network).toEqual(['http://127.0.0.1:4183/crossing-lives-world.html']);
    expect(input.length).toBeGreaterThanOrEqual(8); expect(input.every(event => event.trusted && event.pointerType === 'touch')).toBe(true);
    stage = 'complete'; completed = true;
  } catch (error) { failure = String(error); throw error; } finally {
    await writeFile(resolve(out, 'served-world.json'), JSON.stringify({ commit, completed, stage, failure, browser: browser.version(), scope: 'HTTP-served exact world export in Linux WebKit at 390x844; does not establish offline file support or physical iPhone/Safari validation', protocol: 'http:', standaloneExport: true, offline: false, sourceArtifact: 'artifacts/crossing-lives-world.html', sourceBytes: sourceBytes.length, sourceSha256, servedBytes, responseSha256, byteVerification: 'Independent Node HTTP stream before fresh browser navigation; browser response body is not read through the inspector', httpVerification, browserResponseHeaders, decodedArt, renderedMovement, input, errors, network }, null, 2));
  }
});
