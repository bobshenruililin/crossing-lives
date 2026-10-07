import { expect, test } from '@playwright/test';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CASES, SCENES } from '../world-browser/world-fixtures';
import { expectFacts, expectScene, insight, world } from '../world-browser/world-helpers';
import { expectInitialDecision, expectLeaseResult, expectParcelResult } from '../world-browser/world-decision-paths';
import { completionProblems, finalRecordingComplete, inputProblems } from './phone-contract.mjs';
import { phoneAudit } from './phone-audit';
import { touchDriver, type Geometry } from './phone-touch';
import { recordPhoneOffice } from './phone-office';

/** Cold full-world phone film: no cuts, speed changes, state seeds or warmed art.
 * One selectOption is disclosed because Chromium does not expose native option rows to touch locators. */
test('record all twelve rooms using real phone touch and readable decisions', async ({ browser, baseURL }, info) => {
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_WORLD_COMMIT;
  expect(commit, 'Exact tested commit is mandatory').toMatch(/^[a-f0-9]{40}$/);
  const viewport = { width: 390, height: 844 };
  const out = resolve('artifacts/world-phone'), review = resolve(out, 'gates'), film = resolve(out, 'walkthrough');
  await Promise.all([mkdir(review, { recursive: true }), mkdir(film, { recursive: true })]);
  const context = await browser.newContext({ baseURL, viewport, screen: viewport, deviceScaleFactor: 1,
    hasTouch: true, isMobile: true, reducedMotion: 'no-preference', recordVideo: { dir: info.outputPath('recording'), size: viewport } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const audit = await phoneAudit(context), page = await context.newPage(), video = page.video();
  const started = Date.now(), geometry: Geometry[] = [], touch = touchDriver(page, geometry);
  const scenes: string[] = [], checkpoints: string[] = [], doors: { from: string; to: string; kind: string }[] = [], errors: string[] = [], cleanupErrors: string[] = [];
  const actions: { label: string; startedMs: number; finishedMs: number; requestedPauseMs: number; scene: string | null }[] = [];
  let completed = false, routeCompleted = false, videoSaved = false, videoBytes = 0, durationMs = 0, nativeSelectExceptions = 0, activeStorage: unknown = null, durableStorage: unknown = null;
  page.on('pageerror', error => errors.push(error.message));
  const read = async (label: string, ms: number) => {
    const begin = Date.now() - started; await page.waitForTimeout(ms);
    actions.push({ label, startedMs: begin, finishedMs: Date.now() - started, requestedPauseMs: ms, scene: await world(page).getAttribute('data-scene') });
  };
  const capture = async (name: string) => {
    const path = resolve(review, `${name}.png`); await page.screenshot({ path });
    await info.attach(name, { path, contentType: 'image/png' });
  };
  try {
    await page.goto('/world.html');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await touch.tap(page.getByRole('button', { name: 'Play', exact: true }), 'Cold default Play');
    await expectScene(page, 'hk-home'); await expect(world(page)).toHaveAttribute('data-party', 'two-friends');
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    await read('Cold phone opening with ordinary default Play.', 3_000); await capture('01-cold-phone');
    for (const [index, id] of SCENES.entries()) {
      if (index === 1) { await touch.enterFirst(); doors.push({ from: 'hk-home', to: id, kind: 'nearby-enter' }); }
      else if (index) { await touch.door(SCENES[index - 1], id); doors.push({ from: SCENES[index - 1], to: id, kind: 'visible-door' }); }
      if (index) await read(`Arrive through the physical entrance: ${id}.`, 2_000);
      scenes.push(id); await touch.open(id);
      const panel = insight(page, id);
      if (id === 'hk-home') {
        await expectInitialDecision(page, id);
        await touch.visible(panel.locator('.wd-time-figure'), 'Initial six-hour border allowance');
        const fixed = await panel.locator('.wd-time-fixed').evaluate(el => el.getBoundingClientRect().width);
        const lunch = await panel.locator('[data-activity=lunch]').evaluate(el => el.getBoundingClientRect().width);
        await read('Home: the unchanged fictional day has 30 minutes spare.', 8_000);
        const slider = panel.getByRole('slider', { name: /Home by/ });
        const r = await slider.boundingBox(); expect(r).not.toBeNull();
        await touch.tap(slider, 'Touch the Earlier end of the home-by clock', { x: 3, y: r!.height / 2 });
        await expect(slider).toHaveValue('1350'); await expect(panel.getByRole('status')).toContainText('30 minutes late');
        await expect(panel.getByRole('button', { name: /^Keep/ })).toHaveAttribute('aria-pressed', 'true');
        await read('Earlier home changes only the deadline. The same day is now 30 minutes late.', 8_000);
        await touch.tap(panel.getByRole('button', { name: /^Shorten/ }), 'Shorten lunch');
        await expect(panel.getByRole('status')).toContainText('Exactly on time');
        await expect.poll(async () => panel.locator('[data-activity=lunch]').evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(lunch - 1);
        expect(Math.abs(await panel.locator('.wd-time-fixed').evaluate(el => el.getBoundingClientRect().width) - fixed)).toBeLessThan(.25);
        await read('Shorten lunch. Its segment contracts; the border journey remains.', 8_000);
        const activity = panel.getByRole('combobox', { name: 'Activity to adjust', exact: true });
        await touch.visible(activity, 'Native activity option menu', 44, true);
        await activity.selectOption('exhibition'); nativeSelectExceptions++;
        await touch.tap(panel.getByRole('button', { name: /^Leave out/ }), 'Leave out exhibition');
        await expect(panel.getByRole('status')).toContainText('120 minutes spare');
        await read('Leave out the exhibition explicitly; read the resulting home plan.', 8_000); await capture('02-home-plan');
        await touch.tap(panel.getByRole('button', { name: 'Take this plan', exact: true }), 'Take this plan');
        await expect(page.getByRole('dialog')).toHaveCount(0); checkpoints.push('home-taken'); await read('The plan is now explicitly taken.', 4_000);
      } else if (id === 'parcel-counter') {
        await expectInitialDecision(page, id); await read('Parcel: two collection contexts, separate from the home plan.', 6_000);
        await touch.tap(panel.getByRole('button', { name: /^Already going/ }), 'Already going');
        await expect(panel).toHaveAttribute('data-step', 'destination');
        await touch.visible(panel.getByRole('button', { name: /^Collect it/ }), 'Already-going Collect picker', 44, true);
        await touch.visible(panel.getByRole('button', { name: /^Home delivery/ }), 'Already-going Home-delivery picker', 44, true);
        await read('Read both labelled destinations: Collect it and Home delivery.', 5_000);
        await touch.tap(panel.getByRole('button', { name: /^Collect it/ }), 'Collect while already going');
        await expectParcelResult(page, 'collection', 'already-going'); await read('Already-going collection: 16 CNY-equivalent and 20 minutes.', 6_000);
        await touch.tap(panel.getByRole('button', { name: 'Options', exact: true }), 'Parcel Options');
        await read('Options returns to the labelled destination picker.', 5_000);
        await touch.tap(panel.getByRole('button', { name: 'Back', exact: true }), 'Back to parcel context');
        await touch.tap(panel.getByRole('button', { name: /^Go just for it/ }), 'Dedicated collection trip');
        await read('Dedicated-trip destination choices: Collect it or Home delivery.', 5_000);
        await touch.tap(panel.getByRole('button', { name: /^Collect it/ }), 'Collect on a dedicated trip');
        await expectParcelResult(page, 'collection', 'dedicated-trip'); await read('Dedicated collection: 116 CNY-equivalent and 160 minutes.', 6_000);
        await touch.tap(panel.getByRole('button', { name: 'Options', exact: true }), 'Parcel Options for delivery');
        await read('Read Home delivery alongside collection before choosing.', 5_000);
        await touch.tap(panel.getByRole('button', { name: /^Home delivery/ }), 'Home delivery');
        await expectParcelResult(page, 'delivery', 'dedicated-trip'); await read('Home delivery: invented 35 quote; its duration remains unknown.', 6_000); await capture('03-parcel-delivery');
        await touch.tap(panel.getByRole('button', { name: 'Use delivery', exact: true }), 'Use delivery'); checkpoints.push('parcel-delivery-taken'); await read('Delivery is explicitly chosen.', 4_000);
      } else if (id === 'rental-home') {
        await expectInitialDecision(page, id); await read('Rental: read both fictional contracts.', 6_000);
        for (const [name, choice, delta] of [
          ['Lower monthly rent', 'lower-rent', '3,000 less cash now; 1,500 less rent/month.'],
          ['Less cash tied up', 'less-upfront', '3,000 more cash now; 1,500 more rent/month.'],
        ] as const) {
          await touch.tap(panel.getByRole('button', { name: new RegExp(`^${name}`) }), `Read lease ${choice}`);
          await expectLeaseResult(page, choice);
          const comparison = panel.getByTestId('lease-comparison-delta');
          await expect(comparison).toHaveText(`Compared with the other offer:${delta}`); await touch.visible(comparison, `Initially visible ${choice} tradeoff`);
          await touch.visible(panel.getByRole('button', { name: 'Choose lease', exact: true }), 'Initially visible lease commit', 44, true);
          await read(`Rental: ${delta}`, 8_000); await capture(`04-lease-${choice}`);
          if (choice === 'lower-rent') await touch.tap(panel.getByRole('button', { name: 'Back', exact: true }), 'Back to lease offers');
        }
        await touch.tap(panel.getByRole('button', { name: 'Choose lease', exact: true }), 'Choose lease B'); checkpoints.push('lease-b-taken'); await read('Lease B is explicitly chosen.', 4_000);
      } else if (id === 'office-floor') {
        await recordPhoneOffice(page, touch, read); checkpoints.push('office-complete'); await capture('05-office-returned');
      } else if (id === 'planning-museum') {
        await expectFacts(page, id, 0); await read('Museum: real geographic context with a fictional walking route.', 5_000);
        const base = await panel.locator('[data-layer]').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')));
        for (const chapter of [1, 2, 3]) {
          await touch.tap(panel.locator(`[data-chapter-index="${chapter}"]`), `Museum chapter ${chapter + 1}`);
          await touch.visible(panel.getByTestId('regional-active-label'), `Museum selected locality ${chapter + 1}`);
          expect(await panel.locator('[data-layer]').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')))).toEqual(base);
          await read(`Museum chapter ${chapter + 1}: the present-day base stays unchanged.`, 3_000);
        }
        await touch.tap(panel.getByRole('button', { name: 'Greater Bay Area', exact: true }), 'Greater Bay Area');
        await expectFacts(page, id, 1); await read('Read the Greater Bay Area geography and member-place anchors.', 6_000); await capture('06-museum-map');
        const evidence = panel.locator('.rmd-research > summary'); await touch.reveal(evidence, 'Museum evidence summary');
        await touch.tap(evidence, 'Look closer at map evidence');
        const guide = panel.locator('.rmd-reading-guide'); await touch.reveal(guide, 'Three kinds of evidence');
        await read('Map, plan and activity records answer different questions.', 6_000); await capture('07-museum-evidence');
        const deeper = panel.locator('.rmd-deeper > summary'); await touch.reveal(deeper, 'Two different lines'); await touch.tap(deeper, 'Two different lines');
        const boundary = panel.getByText('The former internal line is not drawn on this map.', { exact: true });
        await touch.reveal(boundary, 'Boundary limitation'); await read('Read the boundary distinction and what this map does not draw.', 6_000);
        checkpoints.push('museum-evidence'); await touch.close();
      } else {
        await expectFacts(page, id, 0); await read(`${id}: ${CASES[id].choices[0].label}.`, 6_000);
        const choice = panel.getByRole('radio', { name: CASES[id].choices[1].label, exact: true });
        await touch.tap(choice.locator('..'), `${id}: ${CASES[id].choices[1].label}`);
        await expect(choice).toBeChecked(); await expectFacts(page, id, 1);
        await read(`${id}: read the visible consequence of ${CASES[id].choices[1].label}.`, 7_000); await touch.close();
      }
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await touch.tap(page.getByRole('button', { name: 'Open world map', exact: true }), 'Open final map');
    const plan = page.getByTestId('committed-home-plan'); await touch.tap(plan.locator('summary'), 'Read the taken home plan');
    await touch.visible(plan.locator('.wd-plan-status'), 'Carried home-plan result');
    await expect(plan).toContainText('120 minutes spare'); await expect(plan).toContainText('Travel times remain unverified');
    await expect(plan).toContainText('Hong Kong–Shenzhen round trip keeps its assumed 6h allowance');
    for (const [activity, choice] of [['lunch', 'short'], ['neighborhood', 'full'], ['exhibition', 'omit']]) await expect(plan.locator(`[data-plan-activity=${activity}]`)).toHaveAttribute('data-plan-choice', choice);
    await expect(page.getByRole('group', { name: 'Places in the connected world', exact: true }).getByRole('button')).toHaveCount(12);
    checkpoints.push('carried-home-plan'); await read('The map carries the home plan unchanged after the separate parcel and rental choices.', 10_000); await capture('08-carried-plan');
    await touch.close(); await expectScene(page, 'planning-museum'); await read('Finish inside the planning museum.', 4_000);
    activeStorage = await audit.active(page); expect(errors).toEqual([]);
    expect(inputProblems(audit.inputs, nativeSelectExceptions)).toEqual([]);
    durationMs = Date.now() - started;
    expect(completionProblems({ commit, scenes, doors, checkpoints, durationMs, mapNavigationCount: audit.inputs.filter(event => event.mapNavigation).length })).toEqual([]);
    routeCompleted = true;
  } finally {
    durationMs = Date.now() - started;
    if (!routeCompleted) { try { await capture('failure-interrupted-phone-tour'); } catch (error) { cleanupErrors.push(String(error)); } }
    try { await context.tracing.stop({ path: resolve(out, 'phone-tour-trace.zip') }); } catch (error) { cleanupErrors.push(String(error)); }
    try { await page.close(); durableStorage = await audit.durableAfterPageClose(); } catch (error) { completed = false; cleanupErrors.push(String(error)); }
    try { await context.close(); } catch (error) { completed = false; cleanupErrors.push(String(error)); }
    try { if (video) {
      const videoPath = resolve(film, 'crossing-lives-whole-world-390x844-touch.webm');
      await video.saveAs(videoPath);
      const saved = await stat(videoPath);
      expect(saved.isFile() && saved.size > 0, 'Saved canonical film must be an actual nonempty file').toBe(true);
      videoSaved = true; videoBytes = saved.size;
      await video.delete();
    } } catch (error) { cleanupErrors.push(String(error)); }
    completed = finalRecordingComplete({ routeCompleted, videoSaved, videoBytes, cleanupErrors, activeStorage, durableStorage });
    const report = { schemaVersion: 1, commit, viewport, hasTouch: true, isMobile: true, coldContext: true, reducedMotion: false,
      browserVersion: browser.version(), startedAt: new Date(started).toISOString(), durationMs, completed, routeCompleted, videoPresent: videoSaved, videoObjectPresent: Boolean(video), videoBytes,
      input: 'Locator.tap and native Chromium touchscreen swipe; one explicitly disclosed native selectOption', nativeSelectExceptions,
      nativeSelectException: 'Home Activity to adjust → exhibition; option selection emits untrusted input/change events and is excluded from trusted touch claims.',
      approvedDurationMs: { minimum: 300_000, maximum: 480_000 }, artifact: 'artifacts/world-phone/walkthrough/crossing-lives-whole-world-390x844-touch.webm',
      scenes, doors, checkpoints, mapNavigationCount: audit.inputs.filter(event => event.mapNavigation).length, actions, errors, cleanupErrors,
      storageScope: 'Passive active-document acquisition/operation observations; exact synthetic canary preservation. Does not prove zero acquisitions during final close/unload.', activeStorage, durableStorage };
    const reportPath = resolve(film, 'phone-world-recording.json');
    await Promise.all([writeFile(reportPath, JSON.stringify(report, null, 2)), writeFile(resolve(out, 'trusted-input.json'), JSON.stringify(audit.inputs, null, 2)),
      writeFile(resolve(out, 'geometry.json'), JSON.stringify(geometry, null, 2)), writeFile(resolve(out, 'storage-observations.json'), JSON.stringify(audit.storage, null, 2))]);
    await info.attach('phone-world-recording-report', { path: reportPath, contentType: 'application/json' });
    expect(video, 'Actual browser film is required, including on failure').not.toBeNull();
    expect(videoSaved, 'The canonical video must actually be saved').toBe(true); expect(cleanupErrors).toEqual([]);
  }
});
