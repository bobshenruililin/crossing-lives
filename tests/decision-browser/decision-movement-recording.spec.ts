import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { action, auditNoPrivateStorage, clockControl, experience, startFresh } from './decision-helpers';

/** Real, cold production interaction. Never seeds journey state, prewarms art,
 * composites frames, restarts tracing or trims a failed/blank transition. */
test('record the real tap journey from 16:30 choice through Luohu arrival at 390x844', async ({ browser, baseURL }, info) => {
  test.setTimeout(120_000);
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_DECISION_COMMIT;
  expect(commit, 'The movement film identifies the exact tested commit.').toMatch(/^[a-f0-9]{40}$/);
  const directory = resolve('artifacts/decision/movement');
  await mkdir(directory, { recursive: true });
  const canonicalVideo = resolve(directory, 'decision-movement-390x844.webm');
  const reportPath = resolve(directory, 'decision-movement-recording.json');
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ baseURL, viewport, hasTouch: true, reducedMotion: 'no-preference',
    recordVideo: { dir: info.outputPath('recording'), size: viewport },
  });
  // The runner owns tracing via trace: 'retain-on-failure'.
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const video = page.video();
  const started = Date.now();
  const actions: { action: string; requestedPauseMs: number; pauseStartMs: number; pauseEndMs: number; snapshot: string | null; activeObject: string | null; phase: string | null; node: string | null; art: string | null; committedArrival: string | null }[] = [];
  let completed = false;
  const read = async (description: string, pauseMs: number) => {
    const pauseStartMs = Date.now() - started;
    await page.waitForTimeout(pauseMs); // Deliberate reading time, not a performance claim.
    const journey = page.getByTestId('decision-journey');
    const exists = await journey.count();
    actions.push({ action: description, requestedPauseMs: pauseMs, pauseStartMs, pauseEndMs: Date.now() - started,
      snapshot: await experience(page).getAttribute('data-displayed-snapshot'), activeObject: await experience(page).getAttribute('data-active-object'),
      phase: exists ? await journey.getAttribute('data-phase') : null, node: exists ? await journey.getAttribute('data-node') : null,
      art: exists ? await journey.getAttribute('data-art-status') : null, committedArrival: exists ? await journey.getAttribute('data-committed-arrival') : null });
  };
  try {
    await startFresh(page);
    await read('The original opening comparison, with two complete evenings.', 3_000);
    await action(page, 'What matters to you?').tap();
    await action(page, 'Exploration').tap();
    await read('Explicitly mark exploration; no preference is inferred.', 2_000);
    await action(page, 'Back to evening').tap();
    await action(page, 'Start with Shenzhen').tap();
    await action(page, 'Change departure').tap();
    await action(page, '15 minutes earlier').tap();
    await action(page, '15 minutes earlier').tap();
    await expect(clockControl(page, 'departure')).toHaveValue('990');
    await read('Preview 16:30 using the real Phone controls.', 3_000);
    await action(page, 'Apply time change').tap();
    await read('Apply the single departure change and inspect both plans.', 3_000);
    await action(page, 'Keep full Shenzhen evening').tap();
    await expect(experience(page)).toHaveAttribute('data-stage', 'revised');
    await read('Choose the complete Shenzhen plan, retaining its 45-minute walk.', 3_000);
    await action(page, 'Explore the chosen evening').tap();
    const journey = page.getByTestId('decision-journey');
    await expect(journey).toHaveAttribute('data-node', 'counter');
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '990');
    await read('Step beside the counter; walking inspection changes no time or bill.', 3_000);
    await action(page, 'Station entrance').tap();
    await expect(journey).toHaveAttribute('data-node', 'station');
    await expect(journey).toHaveAttribute('data-committed-arrival', 'none');
    await read('Walk to the station and let the camera follow the small person.', 3_000);
    await action(page, 'Counter').tap();
    await expect(journey).toHaveAttribute('data-node', 'counter');
    await read('Walk back freely before departure.', 2_000);
    await action(page, 'Station entrance').tap();
    await expect(page.getByTestId('decision-station-thought')).toContainText('Arrival 18:15');
    await expect(page.getByTestId('decision-station-thought')).toContainText('75 min modeled slack');
    await read('Read the chosen arrival, return constraint and explicit exploration priority.', 4_000);
    await action(page, 'Board for Lo Wu').tap();
    await expect(journey).toHaveAttribute('data-phase', 'outward');
    await expect(journey).toHaveAttribute('data-committed-arrival', '1095');
    await read('One explicit departure; the schematic follows Kowloon, Lo Wu and Luohu.', 3_000);
    await expect(journey).toHaveAttribute('data-art-status', 'ready');
    await action(page, 'Continue to arrival').tap();
    await expect(journey).toHaveAttribute('data-phase', 'arrived');
    await expect(page.getByTestId('decision-journey-place')).toContainText('Luohu dinner · Shenzhen');
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1095');
    await expect(page.locator('.decision-journey-background[src$="decision-sz-evening.webp"]')).toBeVisible();
    await read('Arrive at 18:15 with the destination image, objects, clock and line together.', 4_000);
    await action(page, 'Menu See both bills').tap();
    await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', 'revised');
    await read('Tap the physical menu to inspect the complete planned bills.', 3_000);
    await action(page, 'Back to evening').tap();
    await action(page, 'Replay the comparison').tap();
    await action(page, 'Before').tap();
    await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', 'baseline');
    await read('Replay the original 17:00 comparison without replacing the journey.', 3_000);
    await action(page, 'Put down phone').tap();
    await expect(journey).toHaveAttribute('data-phase', 'arrived');
    await read('Close historical replay directly onto the same 18:15 arrival.', 2_000);
    await action(page, 'Inspect the full outing bill').tap();
    await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', 'revised');
    await read('The arrival bill reopens the captured revised plan.', 2_000);
    await action(page, 'Back to evening').tap();
    await action(page, 'Put down phone').tap();
    await expect(journey).toHaveAttribute('data-committed-arrival', '1095');
    await expect(action(page, 'Board for Lo Wu')).toHaveCount(0);
    await audit.expectZero(page);
    await read('Finish on the same arrived street, with no second departure.', 3_000);
    completed = true;
  } finally {
    await context.close();
    expect(video, 'Keep an actual browser recording, including interrupted or failed frames.').not.toBeNull();
    await video!.saveAs(canonicalVideo);
    await video!.delete();
    await writeFile(reportPath, JSON.stringify({ commit, viewport, entry: `${baseURL}/decision.html`,
      startedAt: new Date(started).toISOString(), completed, input: 'real touch events', reducedMotion: false,
      artifact: 'artifacts/decision/movement/decision-movement-390x844.webm', actions }, null, 2));
    await info.attach('movement-recording-pointer', { path: reportPath, contentType: 'application/json' });
  }
});
