import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  action, auditNoPrivateStorage, changeDeadline, chooseBaseline, expectAcceptedFacts,
  expectStage, experience, openDisclosure, replay, startFresh,
} from './decision-helpers';

/** One real production interaction, with reading time, no state injection,
 * image-readiness manipulation, compositing replacement, or generated film. */
test('record a real fresh decision, earlier deadline, revised walk and replay at 1440x900', async ({ browser, baseURL }, info) => {
  test.setTimeout(120_000);
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_DECISION_COMMIT;
  expect(commit, 'The canonical review film must identify its exact tested commit.').toMatch(/^[a-f0-9]{40}$/);
  const directory = resolve('artifacts/decision');
  await mkdir(directory, { recursive: true });
  const canonicalVideo = resolve(directory, 'decision-interaction-1440x900.webm');
  const reportPath = resolve(directory, 'decision-recording.json');
  const viewport = { width: 1440, height: 900 };
  const context = await browser.newContext({ baseURL, viewport,
    recordVideo: { dir: info.outputPath('recording'), size: viewport },
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const video = page.video();
  const started = Date.now();
  const actions: { action: string; requestedPauseMs: number; pauseStartMs: number; pauseEndMs: number; snapshot: string | null }[] = [];
  let completed = false;
  const read = async (description: string, pauseMs: number) => {
    const pauseStartMs = Date.now() - started;
    await page.waitForTimeout(pauseMs); // Purposeful review time, not a speed measurement.
    actions.push({ action: description, requestedPauseMs: pauseMs, pauseStartMs,
      pauseEndMs: Date.now() - started, snapshot: await experience(page).getAttribute('data-displayed-snapshot') });
  };
  try {
    await startFresh(page);
    await expectAcceptedFacts(page, 'baseline');
    await read('Fresh unseeded entry: read both full options before choosing.', 9_000);
    await chooseBaseline(page, 'Shenzhen');
    await read('Choose Shenzhen from the baseline comparison.', 1_500);
    await changeDeadline(page);
    await expectAcceptedFacts(page, 'changed');
    await expect(page.getByTestId('decision-feedback')).toBeInViewport({ ratio: 1 });
    await read('Change only home-by time: inspect unchanged bills and returns, with Shenzhen 15 minutes late.', 9_000);
    await action(page, 'Preview a shorter Shenzhen walk').click();
    await expectStage(page, 'changed', 'revised', true);
    await expectAcceptedFacts(page, 'revised', true);
    await read('Preview the explicit sacrifice: Shenzhen walk 45 to 15 minutes, dinner and cost unchanged.', 7_000);
    await action(page, 'Choose shorter Shenzhen walk').click();
    await expectStage(page, 'revised');
    await openDisclosure(page, 'Unfold the evening');
    await page.getByTestId('decision-timeline-HK').scrollIntoViewIfNeeded();
    await read('Commit the shorter walk and inspect both complete routes on one clock.', 7_000);
    await replay(page, 'baseline');
    await expectStage(page, 'revised', 'baseline');
    await expectAcceptedFacts(page, 'baseline');
    await page.getByTestId('decision-outcome-HK').scrollIntoViewIfNeeded();
    await read('Replay Before: verify the original comparison has not been rewritten.', 7_000);
    await action(page, 'Return to current decision').click();
    await expectStage(page, 'revised');
    await expectAcceptedFacts(page, 'revised', true);
    await audit.expectZero(page);
    await read('Return to the current revised decision.', 3_000);
    completed = true;
  } finally {
    await context.tracing.stop(completed ? {} : { path: info.outputPath('decision-recording-failure-trace.zip') });
    await context.close();
    expect(video, 'This test must produce an actual browser recording.').not.toBeNull();
    await video!.saveAs(canonicalVideo);
    await video!.delete(); // Keep one canonical video, not a second report-embedded copy.
    await writeFile(reportPath, JSON.stringify({ commit, viewport, entry: `${baseURL}/decision.html`,
      startedAt: new Date(started).toISOString(), completed, artifact: 'artifacts/decision/decision-interaction-1440x900.webm', actions }, null, 2));
    await info.attach('decision-recording-pointer', { path: reportPath, contentType: 'application/json' });
  }
});
