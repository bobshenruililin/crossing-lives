import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  action, applyTimeChange, auditNoPrivateStorage, beginTimePreview, chooseBaseline, clockControl, closeDisclosure, expectAcceptedFacts,
  expectStage, expectTimeFacts, expectWorldAndCore, experience, openDisclosure, openObject, readOutcomeFacts, reason, replay, startFresh,
} from './decision-helpers';

/** One real production interaction, with reading time, no state injection,
 * image-readiness manipulation, compositing replacement, or generated film. */
test('record a real selected clock, priorities, full-plan choice and replay at 1440x900', async ({ browser, baseURL }, info) => {
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
  // The Playwright runner owns tracing via trace: 'retain-on-failure'.
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const video = page.video();
  const started = Date.now();
  const actions: { action: string; requestedPauseMs: number; pauseStartMs: number; pauseEndMs: number; snapshot: string | null; activeObject: string | null }[] = [];
  let completed = false;
  const read = async (description: string, pauseMs: number) => {
    const pauseStartMs = Date.now() - started;
    await page.waitForTimeout(pauseMs); // Purposeful review time, not a speed measurement.
    actions.push({ action: description, requestedPauseMs: pauseMs, pauseStartMs,
      pauseEndMs: Date.now() - started, snapshot: await experience(page).getAttribute('data-displayed-snapshot'),
      activeObject: await experience(page).getAttribute('data-active-object') });
  };
  try {
    await startFresh(page);
    await expectAcceptedFacts(page, 'baseline');
    await expectWorldAndCore(page);
    await action(page, 'Put down map').click();
    await read('Put down the map and see the pixel world with its physical objects.', 3_000);
    await openObject(page, 'map');
    await expectWorldAndCore(page);
    await read('Open the map: read both complete evenings and the shared real time scale.', 9_000);
    const beforePriorities = [await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')];
    await openDisclosure(page, 'What matters to you?');
    await action(page, 'Food').click();
    await action(page, 'Company').click();
    await expect(action(page, 'Food')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page, 'Company')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page, 'Comfort')).toHaveAttribute('aria-pressed', 'false');
    await expect(action(page, 'Exploration')).toHaveAttribute('aria-pressed', 'false');
    await expect(reason(page)).toHaveCount(0);
    await read('Optionally select Food and Company in your own terms. No city score or reason is inferred.', 6_000);
    await closeDisclosure(page, 'What matters to you?');
    expect([await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')]).toEqual(beforePriorities);
    await expectWorldAndCore(page);
    await chooseBaseline(page, 'Shenzhen');
    await expectWorldAndCore(page);
    await read('Tentatively choose Shenzhen: the phone becomes the active object.', 3_000);
    await beginTimePreview(page, 'departure');
    await expect(clockControl(page, 'departure')).toBeFocused();
    await clockControl(page, 'departure').press('ArrowUp');
    await clockControl(page, 'departure').press('ArrowUp');
    await expect(clockControl(page, 'departure')).toHaveValue('990');
    await expectStage(page, 'baseline', 'changed', true);
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await expectWorldAndCore(page);
    await read('Use the real departure clock to select 16:30. Preview both complete journeys moving earlier, with the original comparison uncommitted.', 7_000);
    await applyTimeChange(page);
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await expect(page.getByTestId('decision-feedback')).toBeInViewport({ ratio: 1 });
    await expectWorldAndCore(page);
    await read('Apply only the departure change. Both full plans keep their costs and activities; Shenzhen reaches home at 22:15.', 8_000);
    await action(page, 'Keep full Shenzhen evening').click();
    await expectStage(page, 'revised');
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await expectWorldAndCore(page);
    await read('Keep the full Shenzhen evening, including the entire 45-minute walk. No automatic shortening or city score.', 7_000);
    await replay(page, 'baseline');
    await expectStage(page, 'revised', 'baseline');
    await expectAcceptedFacts(page, 'baseline');
    await expectWorldAndCore(page);
    await read('Replay Before: verify the original comparison has not been rewritten.', 7_000);
    await action(page, 'Return to current decision').click();
    await expectStage(page, 'revised');
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await expectWorldAndCore(page);
    await audit.expectZero(page);
    await read('Return to the current revised decision.', 3_000);
    completed = true;
  } finally {
    await context.close();
    expect(video, 'This test must produce an actual browser recording.').not.toBeNull();
    await video!.saveAs(canonicalVideo);
    await video!.delete(); // Keep one canonical video, not a second report-embedded copy.
    await writeFile(reportPath, JSON.stringify({ commit, viewport, entry: `${baseURL}/decision.html`,
      startedAt: new Date(started).toISOString(), completed, artifact: 'artifacts/decision/decision-interaction-1440x900.webm', actions }, null, 2));
    await info.attach('decision-recording-pointer', { path: reportPath, contentType: 'application/json' });
  }
});
