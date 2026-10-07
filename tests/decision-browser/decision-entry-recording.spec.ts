import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { action, auditNoPrivateStorage, expectAcceptedFacts, experience, startAtWorld } from './decision-helpers';
import { interaction } from './decision-friend-helpers';
import { expectPlayerFullyVisible } from './decision-journey-projection';

/** A fresh mobile browser records its real first thirty seconds. No seed,
 * asset warming, replacement frames, trimming, or manual tracing ownership. */
test('record the first thirty seconds from a cold mobile world to baseline arrival', async ({ browser, baseURL }, info) => {
  test.setTimeout(60_000);
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_DECISION_COMMIT;
  expect(commit, 'The cold opening film must identify its exact source.').toMatch(/^[a-f0-9]{40}$/);
  const directory = resolve('artifacts/decision/entry');
  await mkdir(directory, { recursive: true });
  const canonicalVideo = resolve(directory, 'decision-first-30-seconds-390x844.webm');
  const reportPath = resolve(directory, 'decision-entry-recording.json');
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ baseURL, viewport, hasTouch: true, reducedMotion: 'no-preference',
    recordVideo: { dir: info.outputPath('recording'), size: viewport } });
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const video = page.video();
  const tap = interaction(page, 'touch');
  const began = Date.now();
  const actions: { action: string; elapsedMs: number; phase: string | null; node: string | null; city: string | null; surface: string | null; committedArrival: string | null }[] = [];
  let completed = false;
  const mark = async (description: string) => {
    const journey = page.getByTestId('decision-journey');
    actions.push({ action: description, elapsedMs: Date.now() - began,
      phase: await journey.getAttribute('data-phase'), node: await journey.getAttribute('data-node'),
      city: await journey.getAttribute('data-city'), surface: await experience(page).getAttribute('data-active-object'),
      committedArrival: await journey.getAttribute('data-committed-arrival') });
  };
  const readUntil = async (elapsedMs: number) => {
    const remaining = elapsedMs - (Date.now() - began);
    if (remaining > 0) await page.waitForTimeout(remaining); // Honest reading time in the untrimmed film.
  };
  try {
    await startAtWorld(page);
    await expectPlayerFullyVisible(page);
    await expect.poll(() => page.getByTestId('decision-player').locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await mark('The cold page opens beside the counter, with a visible person and no city chosen.');
    expect(actions.at(-1)!.elapsedMs).toBeLessThanOrEqual(5_000);
    await readUntil(1_500);
    await tap(action(page, 'Station entrance'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-node', 'station');
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-camera-moving', 'false');
    await mark('Tap Station entrance and watch the person and camera move before making a choice.');
    expect(actions.at(-1)!.elapsedMs).toBeLessThanOrEqual(5_000);
    await readUntil(4_000);
    await tap(action(page, 'Counter'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-node', 'counter');
    await mark('Walk back freely to the counter.');
    await readUntil(6_000);
    await tap(action(page, 'Choose an object'));
    await tap(action(page, 'Open map'));
    await expectAcceptedFacts(page, 'baseline');
    await mark('Objects → Open map shows both complete authored evenings.');
    await readUntil(10_000);
    await tap(action(page, 'Start with Shenzhen'));
    await expect(page.getByTestId('decision-time-editor')).toHaveCount(0);
    await mark('Choose the original Shenzhen evening; the phone offers optional changes.');
    await readUntil(14_000);
    await tap(action(page, 'Put down phone'));
    await tap(action(page, 'Station entrance'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-node', 'station');
    await expect(page.getByTestId('decision-station-thought')).toContainText('Arrival 18:45');
    await mark('At the station, read the unchanged 18:45 arrival and 22:45 return.');
    await readUntil(18_000);
    await tap(action(page, 'Board for Lo Wu'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'arrived');
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-art-status', 'ready');
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1125');
    await expect(action(page, 'Continue to arrival')).toHaveCount(0);
    await mark('Board once and arrive automatically as destination art becomes ready.');
    await readUntil(23_000);
    await tap(action(page, 'Open comparison and replay'));
    await expect(page.getByRole('heading', { name: 'Your captured outing', exact: true })).toBeVisible();
    await expectAcceptedFacts(page, 'baseline');
    await expect(action(page, 'Change departure')).toHaveCount(0);
    await mark('Inspect the captured, read-only baseline without rewriting the arrival.');
    await readUntil(27_000);
    await tap(action(page, 'Put down map'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-committed-arrival', '1125');
    await audit.expectZero(page);
    await readUntil(30_000);
    await mark('End on the same Luohu arrival at 18:45.');
    expect(Date.now() - began, 'This is a short untrimmed opening film, with all required actions inside the first thirty seconds.').toBeLessThanOrEqual(35_000);
    completed = true;
  } finally {
    await context.close();
    expect(video, 'Keep the actual browser recording, including failures or delayed frames.').not.toBeNull();
    await video!.saveAs(canonicalVideo);
    await video!.delete();
    await writeFile(reportPath, JSON.stringify({ commit, viewport, entry: `${baseURL}/decision.html`,
      startedAt: new Date(began).toISOString(), completed, input: 'real touch events', reducedMotion: false,
      freshContext: true, warming: false, stateSeeding: false, manualTracing: false,
      artifact: 'artifacts/decision/entry/decision-first-30-seconds-390x844.webm', actions }, null, 2));
    await info.attach('cold-entry-recording-pointer', { path: reportPath, contentType: 'application/json' });
  }
});
