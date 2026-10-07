import { test, expect } from '@playwright/test';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENES, isDecisionScene } from './world-fixtures';
import { background, capture, closePoint, expectFacts, expectScene, expectUnknown, geometryFingerprint, openPoint, renderedArtHash, selectChoice, startWorld, takeExit } from './world-helpers';
import { checkRegionalDiscovery } from './world-regional';
import { expectInitialDecision, expectMapPlan, expectTakenDecision, takeSceneDecision } from './world-decision-paths';
import { auditWorldStorage } from './world-storage';

test('standalone HTML decodes and plays all twelve scenes offline, with no external requests or storage access', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const portable = resolve('artifacts/crossing-lives-world.html'); await access(portable);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true, hasTouch: true });
  const attemptedNetwork: string[] = [], errors: string[] = [];
  context.on('request', request => { if (/^(https?|wss?):/i.test(request.url())) attemptedNetwork.push(request.url()); });
  await context.route(/^https?:\/\//, route => route.abort('internetdisconnected'));
  const audit = await auditWorldStorage(context), page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const rendered = new Set<string>();
  try {
    await startWorld(page, pathToFileURL(portable).href, true); await expect(page).toHaveURL(/^file:/);
    for (const [index, id] of SCENES.entries()) {
      if (index) await takeExit(page, SCENES[index - 1], id, true);
      await expectScene(page, id, true); await expect(background(page)).toHaveAttribute('src', /^data:image\//);
      rendered.add(await renderedArtHash(page));
      await openPoint(page, id, 'touch');
      if (isDecisionScene(id)) {
        await takeSceneDecision(page, id); await openPoint(page, id, 'touch');
        await expectTakenDecision(page, id); await expectUnknown(page, id); await closePoint(page); continue;
      }
      await expectFacts(page, id, 0);
      const before = await geometryFingerprint(page, id);
      await selectChoice(page, id, 1); await expectFacts(page, id, 1);
      expect(await geometryFingerprint(page, id)).not.toBe(before);
      await expectUnknown(page, id); await selectChoice(page, id, 0); await expectFacts(page, id, 0);
      if (id === 'planning-museum') await checkRegionalDiscovery(page);
      await closePoint(page);
    }
    await page.getByRole('button', { name: 'Open world map', exact: true }).click(); await expectMapPlan(page); await page.keyboard.press('Escape');
    expect(rendered.size, 'All twelve current scene images actually decode, rather than only existing in an embedded manifest.').toBe(12);
    const dependencies = await page.evaluate(async () => {
      await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode()));
      return [...[...document.images].map(img => img.currentSrc), ...[...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(el => el.src), ...[...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')].map(el => el.href)].filter(url => !url.startsWith('data:'));
    });
    expect(dependencies).toEqual([]); expect(attemptedNetwork).toEqual([]); expect(errors).toEqual([]);
    await audit.expectZero(page); await capture(page, info, 'offline-whole-world-finished');
    await page.reload(); await page.getByRole('button', { name: 'Play', exact: true }).tap(); await expectScene(page, 'hk-home', true);
    await openPoint(page, 'hk-home', 'touch'); await expectInitialDecision(page, 'hk-home');
    await audit.expectZero(page); expect(attemptedNetwork).toEqual([]); expect(errors).toEqual([]);
    await audit.proveNegativeControl(page);
  } finally { await context.close(); }
});
