import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test.use({ offline: true });
test('diagnostic tiny offline file loads and receives a native touch', async ({ page, context, browser }, info) => {
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_WORLD_COMMIT;
  expect(commit).toMatch(/^[a-f0-9]{40}$/);
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>File baseline</title><style>button{min-width:140px;min-height:44px;margin:24px}</style></head><body><button id="probe">Touch baseline</button><output id="result">Waiting</output><script>document.getElementById("probe").addEventListener("pointerdown",function(event){document.getElementById("result").textContent=JSON.stringify({trusted:event.isTrusted,pointerType:event.pointerType})})</script></body></html>';
  const file = info.outputPath('tiny-file.html'); await writeFile(file, html);
  const out = resolve('artifacts/world-webkit/diagnostics'); await mkdir(out, { recursive: true });
  const errors: string[] = [], network: string[] = [];
  let completed = false, failure: string | null = null, stage = 'navigation', observed: unknown = null;
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (/^(https?|wss?):/i.test(request.url())) network.push(request.url()); });
  try {
    await page.goto(pathToFileURL(file).href); await expect(page).toHaveURL(/^file:/);
    stage = 'native-touch'; const button = page.getByRole('button', { name: 'Touch baseline', exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox(); expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await button.tap(); await expect(page.locator('#result')).toHaveText('{"trusted":true,"pointerType":"touch"}');
    observed = JSON.parse(await page.locator('#result').innerText()); expect(errors).toEqual([]); expect(network).toEqual([]);
    stage = 'complete'; completed = true;
  } catch (error) { failure = String(error); throw error; }
  finally {
    await writeFile(resolve(out, 'tiny-file.json'), JSON.stringify({ commit, completed, stage, failure, browser: browser.version(), scope: 'Tiny Linux WebKit offline-file baseline only; not the world export or physical Safari', protocol: 'file:', offline: true, sourceBytes: Buffer.byteLength(html), sourceSha256: createHash('sha256').update(html).digest('hex'), observed, errors, network }, null, 2));
  }
});
