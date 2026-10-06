import { test, expect, type CDPSession } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { installReadinessObserver, summarizeReadiness, validateReadinessEvidence, type ReadinessReport } from './readiness-observer';

const profile = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  reducedMotion: 'no-preference' as const,
  cpuSlowdownMultiplier: 4,
  network: { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750, connectionType: 'cellular4g' as const },
};
const relative = (filename: string) => path.relative(process.cwd(), filename).split(path.sep).join('/');
const fileInfo = (filename: string) => ({ path: relative(filename), byteSize: statSync(filename).size, sha256: createHash('sha256').update(readFileSync(filename)).digest('hex') });
const treeInfo = (directory: string): ReturnType<typeof fileInfo>[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const filename = path.join(directory, entry.name);
  return entry.isDirectory() ? treeInfo(filename) : [fileInfo(filename)];
});
type NativeEvent = { name: string; cat?: string; ph?: string; ts?: number; dur?: number; pid?: number; tid?: number; args?: unknown };

async function beginNativeTrace(session: CDPSession, filename: string) {
  const categories = ['devtools.timeline', 'blink.user_timing', 'loading', 'disabled-by-default-devtools.timeline'];
  try {
    await session.send('Tracing.start', { categories: categories.join(','), transferMode: 'ReturnAsStream', streamFormat: 'json' });
  } catch (error) {
    return async () => ({ status: 'unavailable', reason: String(error), decodeEventStatus: 'unavailable', categories });
  }
  return async () => {
    try {
      const completed = new Promise<{ stream?: string; dataLossOccurred?: boolean }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Native trace finalization did not complete in 10 seconds.')), 10_000);
        session.once('Tracing.tracingComplete', event => { clearTimeout(timeout); resolve(event); });
      });
      await session.send('Tracing.end');
      const result = await completed;
      if (!result.stream) throw new Error('Chrome returned no native trace stream.');
      const chunks: Buffer[] = [];
      try {
        for (;;) {
          const chunk = await session.send('IO.read', { handle: result.stream, size: 1_048_576 });
          chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
          if (chunk.eof) break;
        }
      } finally { await session.send('IO.close', { handle: result.stream }); }
      const bytes = Buffer.concat(chunks);
      writeFileSync(filename, gzipSync(bytes));
      const events = (JSON.parse(bytes.toString('utf8')) as { traceEvents: NativeEvent[] }).traceEvents;
      const decodeEvents = events.filter(event => /decode.*image|image.*decode/i.test(event.name));
      return {
        status: 'captured', file: fileInfo(filename), categories, dataLossOccurred: result.dataLossOccurred ?? null,
        decodeEventStatus: decodeEvents.length ? 'native-events-observed; scene attribution and paint timing not established' : 'not-observed; decode timing unavailable',
        decodeEvents,
        actionAndPhaseMarks: events.filter(event => event.name.startsWith('crossing-capture:')),
        timingUnits: 'Native trace ts/dur are Chrome monotonic microseconds. Match named user-timing marks to page performance.now() milliseconds; do not treat either clock as the video encoder origin.',
      };
    } catch (error) {
      return { status: 'finalization-failed', reason: String(error), decodeEventStatus: 'unavailable', categories };
    }
  };
}

test('observe a cold production mobile-profile load and first table, night and home transitions', async ({ browser, baseURL }, testInfo) => {
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_COMMIT_SHA ?? null;
  if (process.env.CI) expect(commit, 'CI capture must identify its exact source commit.').toMatch(/^[a-f0-9]{40}$/i);
  const directory = path.resolve('artifacts/production-capture');
  mkdirSync(directory, { recursive: true });
  const basename = `scene-readiness-${commit ?? 'local-unidentified'}-${testInfo.project.name}`;
  const filename = (extension: string) => path.join(directory, `${basename}.${extension}`);
  const context = await browser.newContext({
    baseURL, viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile, hasTouch: profile.hasTouch, reducedMotion: profile.reducedMotion,
    recordVideo: { dir: testInfo.outputPath('recording'), size: profile.viewport },
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const pageCreateStartedEpochMs = Date.now();
  const page = await context.newPage();
  const pageCreatedEpochMs = Date.now();
  const video = page.video()!;
  const errors: string[] = [];
  const requestFailures: { url: string; reason: string | null }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => requestFailures.push({ url: request.url(), reason: request.failure()?.errorText ?? null }));
  const session = await context.newCDPSession(page);
  const pauses: { label: string; atMs: number; epochMs: number; pauseMs: number }[] = [];
  const teardownErrors: string[] = [];
  let report: ReadinessReport | null = null;
  let complete = false;
  let browserDetails: unknown = null;
  let nativeTrace: unknown = { status: 'not-started', decodeEventStatus: 'unavailable' };
  let stopNativeTrace: (() => Promise<unknown>) | undefined;
  const hold = async (label: string, pauseMs: number) => {
    const atMs = await page.evaluate(label => { window.__crossingReadiness.mark(`pause:${label}`); return performance.now(); }, label);
    pauses.push({ label, atMs, epochMs: Date.now(), pauseMs });
    await page.waitForTimeout(pauseMs);
  };
  const waitForLoadedArt = async (art: string) => {
    // Observe the actual mounted target AFTER its genuine commitment. This never
    // requests or pre-decodes a future image, nor infers readiness from wrappers.
    await page.waitForFunction(art => [...document.querySelectorAll<HTMLImageElement>('.play-world img[data-art]')]
      .some(image => image.dataset.art === art && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), art, { timeout: 30_000 });
    await expect(page.locator(`.play-world img[data-art="${art}"]`)).toBeVisible();
    await expect(page.locator('.play-image-fallback')).toHaveCount(0);
  };
  const phase = async (name: string) => expect(page.locator('.playable-evening')).toHaveClass(new RegExp(`\\bplay-phase-${name}\\b`));
  try {
    await installReadinessObserver(page);
    await session.send('Network.enable');
    await session.send('Network.clearBrowserCache');
    // Normal in-context caching stays enabled after this cold start.
    await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdownMultiplier });
    await session.send('Network.emulateNetworkConditions', profile.network);
    stopNativeTrace = await beginNativeTrace(session, filename('chrome-trace.json.gz'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    browserDetails = await page.evaluate(() => ({
      userAgent: navigator.userAgent, devicePixelRatio, width: innerWidth, height: innerHeight,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, timeOrigin: performance.timeOrigin,
    }));
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Dinner, then a walk?', exact: true })).toBeVisible();
    await waitForLoadedArt('hong-kong-evening.webp');
    await hold('cold initial invitation and street', 3000);
    await page.getByRole('button', { name: 'Let’s stay nearby.', exact: true }).click();
    await hold('nearby dinner commitment', 2000);
    await page.getByRole('button', { name: 'Head to the table', exact: true }).click();
    await phase('arrival');
    await waitForLoadedArt('hong-kong-table.webp');
    await hold('first table arrival', 3000);
    await page.getByRole('button', { name: 'Read the menu', exact: true }).click();
    await hold('dinner choices', 2500);
    await page.getByRole('button', { name: /^Let’s keep dinner simple\./ }).click();
    await phase('afterDinner');
    await hold('after dinner and disclosed delay', 2000);
    await page.getByRole('button', { name: 'Step outside', exact: true }).click();
    await hold('walk choices', 2000);
    await page.getByRole('button', { name: /^Let’s take the longer walk\./ }).click();
    await phase('walk');
    await waitForLoadedArt('hk-evening-night.webp');
    await hold('first night view', 3000);
    await page.getByRole('button', { name: 'Look around', exact: true }).click();
    await hold('uncovered night artwork', 1500);
    await page.getByRole('button', { name: 'Head home', exact: true }).click();
    await hold('return journey commitment', 2000);
    await page.getByRole('button', { name: 'Follow the return journey', exact: true }).click();
    await phase('home');
    await waitForLoadedArt('hong-kong-home-arrival.webp');
    await expect(page.getByLabel('Story clock', { exact: true })).toHaveText('19:15');
    await hold('first shared home arrival', 3000);
    await page.getByRole('button', { name: 'Finish the evening', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await phase('home');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('between-playable-v2') ?? 'null'));
    expect(saved.currentAttempt).toMatchObject({ phase: 'home', city: 'hk', dinnerChoice: 'simple', walkChoice: 'long' });
    await hold('quiet completed home', 2000);
    expect(errors).toEqual([]);
    complete = true;
  } finally {
    if (!page.isClosed()) {
      try {
        report = await page.evaluate(() => {
          const observation = window.__crossingReadiness;
          if (!observation) return null;
          observation.mark('capture-end');
          observation.stop();
          const { mark: _mark, stop: _stop, ...data } = observation;
          return data;
        });
      } catch (error) { teardownErrors.push(`Readiness report: ${String(error)}`); }
    }
    if (stopNativeTrace) nativeTrace = await stopNativeTrace();
    try { await context.tracing.stop({ path: filename('playwright-trace.zip') }); }
    catch (error) { teardownErrors.push(`Playwright trace: ${String(error)}`); }
    await context.close();
    await video.saveAs(filename('webm'));
    const evidenceValidation = validateReadinessEvidence(report);
    const timingSummary = report ? summarizeReadiness(report) : null;
    if (report) writeFileSync(filename('timings.json'), JSON.stringify({ observations: report, summary: timingSummary, evidenceValidation }, null, 2));
    const metadata = {
      commit, complete: complete && evidenceValidation.valid && teardownErrors.length === 0, evidenceValidation, storyCompleted: complete, test: testInfo.title, retry: testInfo.retry, browserVersion: browser.version(), browserDetails,
      runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      profile, networkExplanation: 'CDP desktop Chrome emulation: 150 ms minimum request-to-response-header latency, 1.6 Mbps aggregate download and 750 Kbps upload (decimal units). Not a real phone, radio, low-end CPU or public hosting measurement.',
      coldStart: 'Fresh isolated context; browser HTTP cache cleared before the only navigation. No storage seed, reload, route mocking, prefetch, Image(), decode(), or test asset warming. Normal cache behavior thereafter; resource entries disclose cache use.',
      source: treeInfo(path.resolve('dist')),
      files: { video: fileInfo(filename('webm')), timings: report ? fileInfo(filename('timings.json')) : null,
        playwrightTrace: existsSync(filename('playwright-trace.zip')) ? fileInfo(filename('playwright-trace.zip')) : null },
      metricAvailability: timingSummary?.metricAvailability ?? { status: 'unavailable', reason: 'Page observation report is missing.' },
      nativeTrace, pauses, readingPausesMs: pauses.reduce((sum, pause) => sum + pause.pauseMs, 0),
      clockAlignment: {
        pageCreateStartedEpochMs, pageCreatedEpochMs, pageTimeOriginEpochMs: report?.timeOrigin ?? null,
        explanation: 'Page marks use performance.now() milliseconds and matching crossing-capture user-timing names in the Chrome trace. DOM click/phase labels and pauses identify the same visible actions in the video. Playwright does not expose its encoder origin; page-create timestamps only bracket an approximate origin. Inspect actual frames to align; do not calculate exact painted gaps from DOM or host clocks.',
      },
      limits: [
        'One instrumented production HTTP run of the Hong Kong story path. No repeat-run distribution, Shenzhen matrix or real-device claim.',
        'The 4× CPU multiplier is relative to the CI host. Trace, video and RAF/layout observation add overhead; compare using identical instrumentation.',
        'Image load/natural dimensions are not decode completion or painted readiness. Native decode events may be absent or unattributable to an individual asset.',
        'LCP candidates describe the initial page and stop around the first user input; they do not measure later SPA scenes. Resource bytes are browser observations, not total installed payload.',
        'Recorded pauses are for readability. There are no load-time or RAF pass thresholds; the 30-second waits only guard an eventual functional failure.',
        'Visible blank-art intervals require frame-by-frame review of this canonical recording. No timing below the actual video frame cadence can be claimed.',
      ], errors, requestFailures, teardownErrors,
    };
    writeFileSync(filename('metadata.json'), JSON.stringify(metadata, null, 2));
    await testInfo.attach('Canonical production capture files', {
      body: Buffer.from(JSON.stringify({ metadata: relative(filename('metadata.json')), video: metadata.files.video, complete: metadata.complete }, null, 2)),
      contentType: 'application/json',
    });
    // Persist invalid/partial evidence and diagnostics before failing the gate.
    expect(evidenceValidation.reasons, 'The capture must contain the promised ordered path, action, artwork, navigation and resource evidence.').toEqual([]);
    expect(teardownErrors, 'Capture finalization must retain both timing data and the Playwright trace.').toEqual([]);
  }
});
