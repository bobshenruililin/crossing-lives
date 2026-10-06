import type { Page } from '@playwright/test';

export type ImageObservation = {
  art: string | null; src: string; complete: boolean; naturalWidth: number; naturalHeight: number;
  inViewport: boolean; cssVisible: boolean; opacity: number; loadReadyCandidate: boolean;
};
export type FrameObservation = {
  atMs: number; phase: string | null; images: ImageObservation[]; portrait: ImageObservation | null;
  anyLoadReadyArt: boolean; fallback: boolean; observerCostMs: number;
};
export type ReadinessReport = {
  timeOrigin: number;
  supportedEntryTypes: string[];
  marks: { label: string; atMs: number; phase: string | null }[];
  imageEvents: { type: string; atMs: number; art: string | null; complete: boolean; naturalWidth: number }[];
  entries: Record<string, unknown>[];
  frames: FrameObservation[];
  navigation: Record<string, unknown>[];
};

declare global {
  interface Window {
    __crossingReadiness: ReadinessReport & { mark: (label: string) => void; stop: () => void };
  }
}

/** Passive observation only: no Image(), fetch(), decode(), style or DOM writes.
 * Loaded dimensions are NOT decode completion, compositor readiness or paint proof. */
export async function installReadinessObserver(page: Page) {
  await page.addInitScript(() => {
    const report = {
      timeOrigin: performance.timeOrigin,
      supportedEntryTypes: [...PerformanceObserver.supportedEntryTypes],
      marks: [], imageEvents: [], entries: [], frames: [], navigation: [],
    } as ReadinessReport;
    const phase = () => document.querySelector('.playable-evening')?.className.match(/\bplay-phase-(\w+)\b/)?.[1] ?? null;
    const mark = (label: string) => {
      const entry = performance.mark(`crossing-capture:${label}`);
      report.marks.push({ label, atMs: entry.startTime, phase: phase() });
    };
    const observers: PerformanceObserver[] = [];
    for (const type of ['resource', 'paint', 'largest-contentful-paint', 'longtask']) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const element = (entry as PerformanceEntry & { element?: Element }).element;
          report.entries.push({ ...entry.toJSON(), ...(element ? { elementTag: element.tagName, elementArt: element.getAttribute('data-art') } : {}) });
        }
      });
      observer.observe({ type, buffered: true });
      observers.push(observer);
    }
    for (const type of ['load', 'error']) document.addEventListener(type, event => {
      const image = event.target;
      if (image instanceof HTMLImageElement && image.hasAttribute('data-art')) {
        report.imageEvents.push({ type, atMs: performance.now(), art: image.getAttribute('data-art'), complete: image.complete, naturalWidth: image.naturalWidth });
        mark(`image-${type}:${image.getAttribute('data-art')}`);
      }
    }, true);
    document.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (button) mark(`click:${(button.getAttribute('aria-label') ?? button.textContent ?? '').replace(/\s+/g, ' ').trim()}`);
    }, true);
    let lastPhase: string | null = null;
    const mutation = new MutationObserver(() => {
      const next = phase();
      if (next !== lastPhase) { lastPhase = next; mark(`phase:${next}`); }
    });
    mutation.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const inspect = (image: HTMLImageElement): ImageObservation => {
      const box = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      const inViewport = box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight;
      // Include ancestor display/visibility/opacity. Occlusion by other layers and
      // dialog backdrops is deliberately not inferred from DOM geometry.
      let cssVisible = style.display !== 'none' && style.visibility === 'visible';
      let opacity = Number(style.opacity);
      for (let parent = image.parentElement; parent; parent = parent.parentElement) {
        const ancestor = getComputedStyle(parent);
        cssVisible &&= ancestor.display !== 'none' && ancestor.visibility === 'visible';
        opacity *= Number(ancestor.opacity);
      }
      return {
        art: image.getAttribute('data-art'), src: image.currentSrc, complete: image.complete,
        naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, inViewport, cssVisible, opacity,
        loadReadyCandidate: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 && inViewport && cssVisible && opacity > 0,
      };
    };
    let running = true;
    let frameId = 0;
    const sample = (atMs: number) => {
      if (!running) return;
      const started = performance.now();
      const images = [...document.querySelectorAll<HTMLImageElement>('.play-world img[data-art]:not([data-art="jun-portrait.webp"])')].map(inspect);
      const portrait = document.querySelector<HTMLImageElement>('.jun-avatar img');
      report.frames.push({
        atMs, phase: phase(), images, portrait: portrait ? inspect(portrait) : null,
        anyLoadReadyArt: images.some(image => image.loadReadyCandidate),
        fallback: !!document.querySelector('.play-image-fallback'), observerCostMs: performance.now() - started,
      });
      frameId = requestAnimationFrame(sample);
    };
    window.__crossingReadiness = Object.assign(report, { mark, stop: () => {
      running = false;
      cancelAnimationFrame(frameId);
      mutation.disconnect();
      for (const observer of observers) {
        report.entries.push(...observer.takeRecords().map(entry => entry.toJSON()));
        observer.disconnect();
      }
      report.navigation = performance.getEntriesByType('navigation').map(entry => entry.toJSON());
    } });
    mark('observer-start');
    frameId = requestAnimationFrame(sample);
  });
}

/** These sampled runs are diagnostic DOM gaps, NOT measured painted blank frames. */
export function summarizeReadiness(report: ReadinessReport) {
  const frames = report.frames;
  const runs: { fromMs: number; throughMs: number; nextReadySampleMs: number | null; sampledSpanMs: number; phase: string | null }[] = [];
  for (let index = 0; index < frames.length; index += 1) {
    if (frames[index].anyLoadReadyArt) continue;
    const start = index;
    while (index + 1 < frames.length && !frames[index + 1].anyLoadReadyArt) index += 1;
    runs.push({ fromMs: frames[start].atMs, throughMs: frames[index].atMs, nextReadySampleMs: frames[index + 1]?.atMs ?? null,
      sampledSpanMs: frames[index].atMs - frames[start].atMs, phase: frames[start].phase });
  }
  const firstClick = report.marks.find(mark => mark.label.startsWith('click:'))?.atMs ?? Infinity;
  const initialResources = report.entries.filter(entry => entry.entryType === 'resource' && Number(entry.startTime) < firstClick);
  const firstSeenArt = [...new Set(frames.flatMap(frame => frame.images.map(image => image.art)))].map(art => ({
    art,
    firstImageSampleMs: frames.find(frame => frame.images.some(image => image.art === art))?.atMs ?? null,
    firstLoadReadyCandidateSampleMs: frames.find(frame => frame.images.some(image => image.art === art && image.loadReadyCandidate))?.atMs ?? null,
  }));
  const entryAvailability = (type: string) => {
    const count = report.entries.filter(entry => entry.entryType === type).length;
    return { status: count > 0 ? 'observed' : report.supportedEntryTypes.includes(type) ? 'not-observed' : 'not-supported', count };
  };
  const imageEventAvailability = (type: string) => {
    const count = report.imageEvents.filter(event => event.type === type).length;
    return { status: count > 0 ? 'observed' : 'not-observed', count };
  };
  return {
    metricAvailability: {
      paint: entryAvailability('paint'),
      largestContentfulPaint: entryAvailability('largest-contentful-paint'),
      longTasks: entryAvailability('longtask'),
      imageLoadEvents: imageEventAvailability('load'), imageErrorEvents: imageEventAvailability('error'),
      interpretation: 'These ancillary series are optional. Core evidence completeness does not imply they were observed. No events is not zero latency, zero decoding cost or proof of no visual gap.',
    },
    firstClickMs: Number.isFinite(firstClick) ? firstClick : null, firstSeenArt,
    sampledNoLoadReadyArtworkRuns: runs,
    sampleCount: frames.length,
    maximumObservedRafGapMs: frames.reduce((max, frame, index) => Math.max(max, index ? frame.atMs - frames[index - 1].atMs : 0), 0),
    observerTotalCostMs: frames.reduce((total, frame) => total + frame.observerCostMs, 0),
    initialResources, navigation: report.navigation,
    paints: report.entries.filter(entry => entry.entryType === 'paint'),
    largestContentfulPaintCandidates: report.entries.filter(entry => entry.entryType === 'largest-contentful-paint'),
    longTasks: report.entries.filter(entry => entry.entryType === 'longtask'),
    interpretation: 'Image load, complete and natural dimensions do not establish decode/paint. RAF samples run before paint and can miss inter-frame or compositor gaps. Video inspection is required for visible blank-art intervals; no pixel interval is invented here. RAF gaps are not a dropped-frame count.',
  };
}

/** Verify that the measurement actually observed the promised path. These are
 * evidence-integrity checks, never latency, smoothness or no-blank-art budgets. */
export function validateReadinessEvidence(report: ReadinessReport | null) {
  const reasons: string[] = [];
  const finiteTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (!report) return { valid: false, reasons: ['The page observation report is missing.'] };
  if (!finiteTime(report.timeOrigin) || report.timeOrigin === 0) reasons.push('A finite positive page timeOrigin is missing.');
  if (!report.frames.length) reasons.push('No RAF samples were captured.');
  if (report.frames.some((frame, index) => !finiteTime(frame.atMs) || (index > 0 && frame.atMs <= report.frames[index - 1].atMs))) {
    reasons.push('RAF sample times must be finite, nonnegative and strictly ordered.');
  }
  if (!report.marks.length || report.marks.some((mark, index) => !finiteTime(mark.atMs) || (index > 0 && mark.atMs < report.marks[index - 1].atMs))) {
    reasons.push('Action/phase mark times are missing, nonfinite or out of order.');
  }
  const phases = ['fork', 'arrival', 'afterDinner', 'walk', 'home'];
  const observedPath = report.frames.map(frame => frame.phase).filter((phase, index, all) => phase && (index === 0 || phase !== all[index - 1]));
  if (observedPath.join(',') !== phases.join(',')) reasons.push(`RAF phase coverage is incomplete or unexpected: ${observedPath.join(' → ') || '(empty)'}.`);
  let priorPhaseMs = -1;
  for (const phase of phases) {
    const mark = report.marks.find(mark => mark.label === `phase:${phase}`);
    if (!mark || mark.phase !== phase || !finiteTime(mark.atMs) || mark.atMs < priorPhaseMs) reasons.push(`Missing or invalid phase mark: ${phase}.`);
    else priorPhaseMs = mark.atMs;
  }
  const requiredActions = [
    /^click:Let’s stay nearby\./, /^click:Head to the table$/, /^click:Read the menu$/,
    /^click:Let’s keep dinner simple\./, /^click:Step outside$/, /^click:Let’s take the longer walk\./,
    /^click:Look around$/, /^click:Head home$/, /^click:Follow the return journey$/, /^click:Finish the evening$/,
  ];
  let previousActionMs = -1;
  const actions = requiredActions.map(pattern => {
    const action = report.marks.find(mark => pattern.test(mark.label));
    if (!action || !finiteTime(action.atMs) || action.atMs < previousActionMs) reasons.push(`Missing or invalid ordered real action mark: ${pattern.source}.`);
    else previousActionMs = action.atMs;
    return action;
  });
  for (const [phase, actionIndex] of [['arrival', 1], ['afterDinner', 3], ['walk', 5], ['home', 8]] as const) {
    const phaseMark = report.marks.find(mark => mark.label === `phase:${phase}`);
    const action = actions[actionIndex];
    if (phaseMark && action && phaseMark.atMs < action.atMs) reasons.push(`The ${phase} phase mark precedes its genuine commitment click.`);
  }
  const expectedArt = [
    { art: 'hong-kong-evening.webp', phase: 'fork', actionIndex: null },
    { art: 'hong-kong-table.webp', phase: 'arrival', actionIndex: 1 },
    { art: 'hk-evening-night.webp', phase: 'walk', actionIndex: 5 },
    { art: 'hong-kong-home-arrival.webp', phase: 'home', actionIndex: 8 },
  ];
  for (const target of expectedArt) {
    const commitment = target.actionIndex === null ? 0 : actions[target.actionIndex]?.atMs;
    const candidate = report.frames.find(frame => finiteTime(frame.atMs) && commitment !== undefined && frame.atMs >= commitment
      && frame.phase === target.phase && (target.actionIndex !== null || (actions[0] && frame.atMs < actions[0].atMs))
      && frame.images.some(image => image.art === target.art && image.loadReadyCandidate && image.complete
        && Number.isFinite(image.naturalWidth) && image.naturalWidth > 0 && Number.isFinite(image.naturalHeight) && image.naturalHeight > 0
        && image.inViewport && image.cssVisible && Number.isFinite(image.opacity) && image.opacity > 0 && image.src.length > 0));
    if (!candidate) reasons.push(`No valid load-ready candidate was sampled for ${target.art} in ${target.phase}${target.actionIndex === null ? ' before the first click' : ' after its commitment'}.`);
  }
  const navigation = report.navigation.find(entry => entry.entryType === 'navigation');
  const navigationTimes = navigation ? [navigation.startTime, navigation.responseEnd, navigation.domContentLoadedEventEnd, navigation.loadEventEnd] : [];
  if (!navigation || navigationTimes.some(time => !finiteTime(time)) || Number(navigation.loadEventEnd) <= 0
    || navigationTimes.some((time, index) => index > 0 && Number(time) < Number(navigationTimes[index - 1]))) {
    reasons.push('A completed navigation record with finite ordered response/DOMContentLoaded/load observations is missing.');
  }
  const resources = report.entries.filter(entry => entry.entryType === 'resource');
  if (!resources.length) reasons.push('No resource observations were captured.');
  if (resources.some(entry => !finiteTime(entry.startTime) || !finiteTime(entry.responseEnd) || Number(entry.responseEnd) < Number(entry.startTime)
    || !finiteTime(entry.duration) || !finiteTime(entry.transferSize) || !finiteTime(entry.encodedBodySize) || !finiteTime(entry.decodedBodySize))) {
    reasons.push('One or more resource records have missing/nonfinite timing or byte observations.');
  }
  for (const art of expectedArt) {
    if (!resources.some(entry => typeof entry.name === 'string' && entry.name.endsWith(`/art/${art.art}`))) reasons.push(`Missing resource observation for ${art.art}.`);
  }
  for (const extension of ['js', 'css']) {
    if (!resources.some(entry => typeof entry.name === 'string' && new RegExp(`/assets/[^/?]+\\.${extension}(?:\\?|$)`).test(entry.name))) {
      reasons.push(`Missing production ${extension.toUpperCase()} resource observation.`);
    }
  }
  return { valid: reasons.length === 0, reasons };
}
