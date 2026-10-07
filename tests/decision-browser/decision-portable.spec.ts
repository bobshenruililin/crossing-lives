import { test, expect } from '@playwright/test';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  action, auditNoPrivateStorage, capture, changeDeadline, chooseBaseline, commitShortWalk,
  expectAcceptedFacts, expectNoOverflow, expectStage, expectWorldAndCore, inspectCommonTimeline, openDisclosure, openObject,
  readInputFacts, replay, startFresh,
} from './decision-helpers';

test('production portable runs the full decision loop under file:// with network disabled', async ({ browser }, info) => {
  const path = resolve('artifacts/crossing-lives-decision-prototype.html');
  await access(path); // Missing production export is a failure, never a silent skip.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true });
  const attemptedNetwork: string[] = [];
  context.on('request', request => { if (/^https?:|^wss?:/i.test(request.url())) attemptedNetwork.push(request.url()); });
  await context.route(/^https?:\/\//, route => route.abort('internetdisconnected'));
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await startFresh(page, pathToFileURL(path).href);
    await expect(page).toHaveURL(/^file:/);
    await expectAcceptedFacts(page, 'baseline');
    await expectWorldAndCore(page);
    await expect(page.locator('img.decision-world-image')).toHaveAttribute('src', /^data:image\//);
    expect(await page.locator('img.decision-world-image').evaluate(async (image: HTMLImageElement) => { await image.decode(); return image.naturalWidth; })).toBeGreaterThanOrEqual(1000);
    const baseline = await readInputFacts(page);
    await chooseBaseline(page, 'Shenzhen', 'I am comparing the complete evening.');
    await changeDeadline(page);
    await expectAcceptedFacts(page, 'changed');
    await commitShortWalk(page);
    await expectAcceptedFacts(page, 'revised', true);
    const revised = await readInputFacts(page);
    await inspectCommonTimeline(page);
    await openDisclosure(page, 'Sources and what is still unknown');
    const externalAssets = await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
      const urls = [
        ...[...document.images].map(image => image.currentSrc),
        ...[...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(script => script.src),
        ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(link => link.href),
      ];
      return urls.filter(url => !url.startsWith('data:'));
    });
    expect(externalAssets, 'Artwork, fonts and executable code are embedded, not fetched from adjacent files.').toEqual([]);
    await replay(page, 'baseline');
    expect(await readInputFacts(page)).toEqual(baseline);
    await action(page, 'Return to current decision').click();
    expect(await readInputFacts(page)).toEqual(revised);
    await expectNoOverflow(page);
    await audit.expectZero(page);
    await capture(page, info, 'replay');
    expect(attemptedNetwork, 'A working offline page must not even attempt a network dependency.').toEqual([]);
    expect(errors).toEqual([]);
    await page.reload();
    await expectStage(page, 'baseline');
    await openObject(page, 'phone');
    await expect(action(page, 'Change home-by')).toHaveCount(0);
    await audit.expectZero(page);
    expect(attemptedNetwork).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
