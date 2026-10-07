import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';

export const experience = (page: Page) => page.getByTestId('decision-experience');
export const outcome = (page: Page, city: 'HK' | 'SZ') => page.getByTestId(`decision-outcome-${city}`);
export const timeline = (page: Page, city: 'HK' | 'SZ') => page.getByTestId(`decision-timeline-${city}`);
export const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
export const reason = (page: Page) => page.getByRole('textbox', { name: 'Your reason (optional)', exact: true });

export async function expectStage(page: Page, stage: 'baseline' | 'changed' | 'revised', displayed = stage, preview = false) {
  await expect(experience(page)).toHaveAttribute('data-stage', stage);
  await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', displayed);
  await expect(experience(page)).toHaveAttribute('data-preview', String(preview));
}

export const sheet = (page: Page) => page.getByTestId('decision-sheet');
export const world = (page: Page) => page.getByTestId('decision-world-visible');
export const contextStrip = (page: Page) => page.getByTestId('decision-context');
export const activeObject = (page: Page) => experience(page).getAttribute('data-active-object');

export async function expectCore(page: Page) {
  await expect(experience(page)).toHaveAttribute('data-active-object', /^(map|phone)$/);
  await expect(sheet(page)).toHaveCount(1);
  await expect(sheet(page)).toBeVisible();
}

export async function returnToCore(page: Page) {
  const active = await activeObject(page);
  if (active === 'map' || active === 'phone') return;
  const back = action(page, 'Back to evening');
  if (await back.isVisible()) await back.click();
  else await action(page, 'Map Unfold both routes').click();
  await expectCore(page);
}

export async function openObject(page: Page, object: 'map' | 'phone' | 'menu') {
  if (await activeObject(page) === object) return;
  await action(page, { map: 'Map Unfold both routes', phone: 'Phone Adjust one time', menu: 'Menu See both bills' }[object]).click();
  await expect(sheet(page)).toHaveCount(1);
  await expect(sheet(page)).toBeVisible();
}

/** Optional inspection is a visible object-sheet navigation, never a hidden
 * panel read. The old page disclosure names remain meaningful user actions. */
export async function openDisclosure(page: Page, label: string) {
  if (label === 'Inspect the trip out and home') {
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    return;
  }
  if (label === 'Inputs used in this comparison') {
    const summary = page.locator('summary').filter({ hasText: label });
    await expect(summary).toHaveCount(1);
    if (!await summary.evaluate(element => element.closest('details')!.open)) await summary.click();
    return;
  }
  if (label === 'Open the bill and assumptions') {
    await openObject(page, 'menu');
    return;
  }
  await returnToCore(page);
  if (label === 'What matters to you?') {
    await action(page, label).click();
  } else {
    await action(page, 'Inspect the details').click();
    await action(page, label).click();
  }
  await expect(sheet(page)).toHaveCount(1);
}

export async function closeDisclosure(page: Page, label: string) {
  if (label === 'Inspect the trip out and home') return;
  if (label === 'Inputs used in this comparison') {
    const summary = page.locator('summary').filter({ hasText: label });
    if (await summary.count() && await summary.evaluate(element => element.closest('details')!.open)) await summary.click();
    return;
  }
  await returnToCore(page);
}

export async function startFresh(page: Page, url = '/decision.html') {
  await page.goto(url);
  await expectStage(page, 'baseline');
  await expect(experience(page)).toHaveAttribute('data-active-object', 'map');
  await expect(sheet(page)).toHaveCount(1);
  for (const city of ['Hong Kong', 'Shenzhen']) {
    await expect(action(page, `Start with ${city}`)).toBeVisible();
    await expect(action(page, `Start with ${city}`)).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(outcome(page, 'HK')).toBeVisible();
  await expect(outcome(page, 'SZ')).toBeVisible();
}

export async function chooseBaseline(page: Page, city: 'Hong Kong' | 'Shenzhen', ownReason?: string) {
  await returnToCore(page);
  await openObject(page, 'map');
  await action(page, `Start with ${city}`).click();
  await expect(experience(page)).toHaveAttribute('data-active-object', 'phone');
  if (ownReason !== undefined) {
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page), 'A tentative choice does not infer a reason.').toHaveValue('');
    await reason(page).fill(ownReason);
    await closeDisclosure(page, 'What matters to you?');
  }
  await expect(action(page, 'Change departure')).toBeEnabled();
  await expect(action(page, 'Change home-by')).toBeEnabled();
}

export type TimeField = 'departure' | 'homeBy';
export const clockControl = (page: Page, field: TimeField) => page.getByRole('combobox', { name: field === 'departure' ? 'Departure time' : 'Home-by time', exact: true });
export const clockText = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export async function beginTimePreview(page: Page, field: TimeField) {
  await returnToCore(page);
  await openObject(page, 'phone');
  await action(page, field === 'departure' ? 'Change departure' : 'Change home-by').click();
  await expect(clockControl(page, field)).toBeInViewport({ ratio: 1 });
}

export async function previewTime(page: Page, field: TimeField, minutes: number) {
  await beginTimePreview(page, field);
  await clockControl(page, field).selectOption(String(minutes));
  await expectStage(page, 'baseline', 'changed', true);
  await expect(experience(page)).toHaveAttribute('data-preview-kind', 'time');
  await expect(action(page, 'Apply time change')).toBeEnabled();
}

export async function applyTimeChange(page: Page) {
  await action(page, 'Apply time change').click();
  await expectStage(page, 'changed');
  await expect(experience(page)).toHaveAttribute('data-preview-kind', 'none');
}

/** The accepted earlier-home example now uses genuine clock selection. */
export async function changeDeadline(page: Page) {
  await previewTime(page, 'homeBy', 1350);
  await applyTimeChange(page);
}

export async function commitShortWalk(page: Page) {
  await returnToCore(page);
  await openObject(page, 'phone');
  await action(page, 'Preview a shorter Shenzhen walk').click();
  await expectStage(page, 'changed', 'revised', true);
  await action(page, 'Choose shorter Shenzhen walk').click();
  await expectStage(page, 'revised');
}

export async function replay(page: Page, stage: 'baseline' | 'changed' | 'revised') {
  await openDisclosure(page, 'Replay the comparison');
  await action(page, { baseline: 'Before', changed: 'Changed', revised: 'Revised' }[stage]).click();
  await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', stage);
  await expectCore(page);
}

export async function capture(page: Page, info: TestInfo, stage: 'baseline' | 'earlier-deadline' | 'revised' | 'replay' | 'priorities' | 'earlier-departure' | 'late-departure' | 'time-preview') {
  await page.evaluate(() => document.fonts.ready);
  const viewport = page.viewportSize()!;
  const name = `${stage}-${viewport.width}x${viewport.height}`;
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  const fullPath = info.outputPath(`${name}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true, animations: 'disabled' });
  await info.attach(`${name}-full`, { path: fullPath, contentType: 'image/png' });
}

export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { viewport: innerWidth, document: root.scrollWidth, body: document.body.scrollWidth,
      viewportHeight: innerHeight, documentHeight: root.scrollHeight, bodyHeight: document.body.scrollHeight, x: scrollX, y: scrollY };
  });
  expect(overflow.document, 'The page has no horizontal scroll outside its viewport.').toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.documentHeight, 'Optional detail views scroll internally; the world document never scrolls.').toBeLessThanOrEqual(overflow.viewportHeight + 1);
  expect(overflow.bodyHeight).toBeLessThanOrEqual(overflow.viewportHeight + 1);
  expect([overflow.x, overflow.y]).toEqual([0, 0]);
}

export async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width, 'Interactive targets remain at least 44 CSS pixels wide.').toBeGreaterThanOrEqual(44);
  expect(box!.height, 'Interactive targets remain at least 44 CSS pixels high.').toBeGreaterThanOrEqual(44);
}

/** Hooks block acquisition before the native getter is called. No personal saved
 * document is opened, seeded, enumerated, read, or altered by this audit. */
export async function auditNoPrivateStorage(context: BrowserContext) {
  const reports: { area: string; operation: string; url: string }[] = [];
  await context.exposeBinding('__reportDecisionStorage', ({ frame }, event: { area: string; operation: string }) => {
    reports.push({ ...event, url: frame.url() });
  });
  await context.addInitScript(() => {
    const auditWindow = window as typeof window & {
      __decisionStorageAudit: { ready: boolean; events: { area: string; operation: string }[]; pending: Promise<unknown>[] };
      __reportDecisionStorage: (event: { area: string; operation: string }) => Promise<unknown>;
    };
    const audit = { ready: false, events: [] as { area: string; operation: string }[], pending: [] as Promise<unknown>[] };
    auditWindow.__decisionStorageAudit = audit;
    const block = (area: string, operation: string): never => {
      const event = { area, operation };
      audit.events.push(event);
      audit.pending.push(auditWindow.__reportDecisionStorage(event).catch(() => undefined));
      throw new DOMException('Private storage is blocked in this fresh decision test.', 'SecurityError');
    };
    for (const area of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
      Object.defineProperty(window, area, { configurable: true, get: () => block(area, 'acquire') });
    }
    for (const operation of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
      Object.defineProperty(Storage.prototype, operation, { configurable: true, writable: true, value: () => block('Storage', operation) });
    }
    Object.defineProperty(Storage.prototype, 'length', { configurable: true, get: () => block('Storage', 'length') });
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => block('cookie', 'read'), set: () => block('cookie', 'write') });
    audit.ready = true;
  });
  return {
    reports,
    async expectZero(page: Page) {
      const active = await page.evaluate(async () => {
        const audit = (window as typeof window & { __decisionStorageAudit: { ready: boolean; events: unknown[]; pending: Promise<unknown>[] } }).__decisionStorageAudit;
        await Promise.all(audit.pending);
        return { ready: audit.ready, events: audit.events };
      });
      expect(active.ready).toBe(true);
      expect(active.events, 'A decision session must never touch private or persistent storage.').toEqual([]);
      expect(reports, 'The host also observes attempted access from earlier active documents.').toEqual([]);
    },
  };
}

export async function readInputFacts(page: Page) {
  await openDisclosure(page, 'Open the bill and assumptions');
  await openDisclosure(page, 'Inputs used in this comparison');
  const facts = await page.locator('[data-input-key][data-input-value]').evaluateAll(nodes => nodes.map(node => ({
    key: node.getAttribute('data-input-key')!, value: node.getAttribute('data-input-value')!,
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  })));
  expect(facts.length, 'The disclosed fixed inputs are inspectable, not a hidden UI seed.').toBeGreaterThanOrEqual(15);
  expect(new Set(facts.map(fact => fact.key)).size, 'Each current input fact has one unambiguous value.').toBe(facts.length);
  for (const fact of facts) expect(fact.text, `Input ${fact.key} has readable supporting text.`).not.toBe('');
  for (const row of await page.locator('[data-input-key][data-input-value]').all()) {
    const key = await row.getAttribute('data-input-key');
    const value = await row.getAttribute('data-input-value');
    const displayedValue = row.locator('dd');
    await expect(displayedValue, `Input ${key} exposes its value to the reader.`).toBeVisible();
    expect(await displayedValue.innerText(), `Input ${key} renders the exact value used by the comparison.`).toBe(value);
  }
  await returnToCore(page);
  return Object.fromEntries(facts.map(fact => [fact.key, fact.value]));
}

export function changedKeys(before: Record<string, string>, after: Record<string, string>) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key] !== after[key]).sort();
}

export async function readOutcomeFacts(page: Page, city: 'HK' | 'SZ') {
  return outcome(page, city).evaluate(element => ({
    cost: element.getAttribute('data-cost-hkd'),
    home: element.getAttribute('data-home-minute'),
    dinner: element.getAttribute('data-dinner-minutes'),
    walk: element.getAttribute('data-walk-minutes'),
    deadline: element.getAttribute('data-deadline-minute'),
  }));
}

export async function expectAcceptedFacts(page: Page, stage: 'baseline' | 'changed' | 'revised', shortened = false) {
  const deadline = stage === 'baseline' ? '1410' : '1350';
  expect(await readOutcomeFacts(page, 'HK')).toEqual({ cost: '336', home: '1185', dinner: '90', walk: '45', deadline });
  expect(await readOutcomeFacts(page, 'SZ')).toEqual({ cost: '291.83', home: shortened ? '1335' : '1365', dinner: '90', walk: shortened ? '15' : '45', deadline });
  await expect(outcome(page, 'HK')).toContainText(/336(?:\.00)?/);
  await expect(outcome(page, 'HK')).toContainText('19:45');
  await expect(outcome(page, 'SZ')).toContainText('291.83');
  await expect(outcome(page, 'SZ')).toContainText(shortened ? '22:15' : '22:45');
  // The DOM facts above cannot substitute for readable activity text.
  await expect(outcome(page, 'HK')).toContainText(/90\s*(?:min|minute)/i);
  await expect(outcome(page, 'HK')).toContainText(/45\s*(?:min|minute)/i);
  await expect(outcome(page, 'SZ')).toContainText(/90\s*(?:min|minute)/i);
  await expect(outcome(page, 'SZ')).toContainText(shortened ? /15\s*(?:min|minute)/i : /45\s*(?:min|minute)/i);
  if (stage === 'changed') await expect(outcome(page, 'SZ')).toContainText(/15\s*(?:min|minute).*late|15\s*(?:min|minute).*after|late.*15\s*(?:min|minute)/i);
  if (shortened) await expect(outcome(page, 'SZ')).toContainText(/15\s*(?:min|minute).*slack|slack.*15\s*(?:min|minute)/i);
}

/** Measures the positioned segments themselves. A correctly sized wrapper with
 * tiny, cropped, independently scaled, or incomplete contents will fail. */
export async function inspectCommonTimeline(page: Page) {
  await expectCore(page);
  const tracks = [];
  for (const city of ['HK', 'SZ'] as const) {
    const track = timeline(page, city);
    await expect(track).toBeVisible();
    const geometry = await track.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const start = Number(element.getAttribute('data-scale-start-minute'));
      const end = Number(element.getAttribute('data-scale-end-minute'));
      return { city: element.getAttribute('data-option-id'), x: rect.x, width: rect.width, start, end,
        segments: [...element.querySelectorAll<HTMLElement>('[data-segment-id]')].map(segment => {
          const box = segment.getBoundingClientRect();
          return { id: segment.dataset.segmentId!, start: Number(segment.dataset.startMinute), end: Number(segment.dataset.endMinute),
            x: box.x, width: box.width, height: box.height, text: segment.getAttribute('aria-label') ?? segment.textContent ?? '' };
        }),
      };
    });
    expect(geometry.start).toBe(900);
    expect(geometry.end).toBe(1560);
    expect(geometry.width).toBeGreaterThan(200);
    expect(geometry.segments.length, 'Both actual outward and homeward route legs are drawn.').toBeGreaterThanOrEqual(city === 'HK' ? 4 : 8);
    expect(geometry.segments[0].start).toBe(Number(await outcome(page, city).getAttribute('data-departure-minute')));
    expect(geometry.segments[0].start).toBeGreaterThanOrEqual(geometry.start);
    const home = Number((await readOutcomeFacts(page, city)).home);
    expect(geometry.segments.at(-1)!.end, 'The timeline includes the complete return all the way home.').toBe(home);
    for (let index = 0; index < geometry.segments.length; index += 1) {
      const segment = geometry.segments[index];
      expect(Number.isFinite(segment.start) && Number.isFinite(segment.end)).toBe(true);
      expect(segment.end).toBeGreaterThan(segment.start);
      expect(segment.height).toBeGreaterThanOrEqual(12);
      expect(segment.text.trim()).not.toBe('');
      if (index) expect(segment.start, 'No unaccounted gap or overlapping modeled activity.').toBe(geometry.segments[index - 1].end);
      const expectedLeft = geometry.x + geometry.width * (segment.start - geometry.start) / (geometry.end - geometry.start);
      const expectedWidth = geometry.width * (segment.end - segment.start) / (geometry.end - geometry.start);
      expect(Math.abs(segment.x - expectedLeft), `${city}/${segment.id} starts on the common minute scale.`).toBeLessThanOrEqual(2);
      expect(Math.abs(segment.width - expectedWidth), `${city}/${segment.id} duration is drawn proportionally.`).toBeLessThanOrEqual(2);
    }
    tracks.push(geometry);
  }
  expect(tracks[0].start).toBe(tracks[1].start);
  expect(tracks[0].end).toBe(tracks[1].end);
  expect(Math.abs(tracks[0].width - tracks[1].width), 'Both options use the same pixels-per-minute scale.').toBeLessThanOrEqual(1);
  const marker = page.getByTestId('decision-deadline-marker');
  const markerMinute = Number(await marker.getAttribute('data-deadline-minute'));
  expect(markerMinute).toBe(Number((await readOutcomeFacts(page, 'HK')).deadline));
  const markerBox = (await marker.boundingBox())!;
  const expectedMarkerX = tracks[0].x + tracks[0].width * (markerMinute - tracks[0].start) / (tracks[0].end - tracks[0].start);
  expect(Math.abs(markerBox.x - expectedMarkerX), 'The deadline is drawn on the same absolute scale as the route.').toBeLessThanOrEqual(2);
  await openDisclosure(page, 'Unfold the evening');
  for (const [city, labels] of [
    ['Hong Kong', ['Local trip out', 'Dinner + shared order', 'Walk', 'Local trip home']],
    ['Shenzhen', ['Rail to Lo Wu', 'Outward clearance allowance', 'Transfer to Luohu dinner', 'Dinner + shared order', 'Walk', 'Transfer back to Lo Wu', 'Return clearance allowance', 'Rail back to Kowloon']],
  ] as const) {
    await action(page, `${city} route`).click();
    await openDisclosure(page, 'Inspect the trip out and home');
    const legs = page.locator('.decision-route-legs li');
    await expect(legs).toHaveCount(labels.length);
    for (let index = 0; index < labels.length; index += 1) {
      await expect(legs.nth(index)).toBeVisible();
      await expect(legs.nth(index)).toContainText(labels[index]);
      expect((await legs.nth(index).innerText()).match(/\d{2}:\d{2}/g), 'Every leg exposes both start and end clocks, including overnight legs.').toHaveLength(2);
      const actualSegment = tracks[city === 'Hong Kong' ? 0 : 1].segments[index];
      await expect(legs.nth(index), 'Every outward and return duration agrees with its real shared-scale segment.').toContainText(`${actualSegment.end - actualSegment.start} min`);
    }
  }
  await closeDisclosure(page, 'Inspect the trip out and home');
  await returnToCore(page);
  return tracks;
}

export async function expectKeyboardFocusVisible(page: Page) {
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  await expect(focused).toBeInViewport();
  const style = await focused.evaluate(element => {
    const css = getComputedStyle(element);
    return { visible: element.matches(':focus-visible'), outlineWidth: Number.parseFloat(css.outlineWidth), outlineStyle: css.outlineStyle,
      outlineColor: css.outlineColor, boxShadow: css.boxShadow };
  });
  expect(style.visible, 'Keyboard focus is distinguishable from pointer focus.').toBe(true);
  expect((style.outlineWidth > 0 && style.outlineStyle !== 'none' && style.outlineColor !== 'rgba(0, 0, 0, 0)') || style.boxShadow !== 'none',
    'Keyboard interaction has a visible outline or focus ring.').toBe(true);
}

export async function readBills(page: Page) {
  await openDisclosure(page, 'Open the bill and assumptions');
  const bills = page.locator('.decision-bill-pair > section');
  await expect(bills).toHaveCount(2);
  const values = await bills.evaluateAll(sections => sections.map(section => ({
    heading: section.querySelector('h3')!.textContent,
    lines: [...section.querySelectorAll('li')].map(line => (line.textContent ?? '').replace(/\s+/g, ' ').trim()),
    groupTotal: section.querySelector('.decision-bill-total')!.textContent,
  })));
  await returnToCore(page);
  return values;
}

/** Read actual active-sheet geometry without opening a second surface. */
export async function readCoreGeometry(page: Page) {
  await expectCore(page);
  const tracks = [];
  for (const city of ['HK', 'SZ'] as const) {
    tracks.push(await timeline(page, city).evaluate(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        start: element.getAttribute('data-scale-start-minute'), end: element.getAttribute('data-scale-end-minute'),
        segments: [...element.querySelectorAll<HTMLElement>('[data-segment-id]')].map(segment => {
          const rect = segment.getBoundingClientRect();
          return { id: segment.dataset.segmentId, start: segment.dataset.startMinute, end: segment.dataset.endMinute,
            x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      };
    }));
  }
  const marker = page.getByTestId('decision-deadline-marker');
  return { tracks, marker: { ...(await marker.boundingBox())!, minute: await marker.getAttribute('data-deadline-minute') },
    outcomes: [await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')] };
}

export async function expectWorldAndCore(page: Page) {
  await expectCore(page);
  await expect(world(page)).toBeInViewport({ ratio: 1 });
  await expect(contextStrip(page)).toBeInViewport({ ratio: 1 });
  await expect(sheet(page)).toBeInViewport({ ratio: 1 });
  const worldBox = (await world(page).boundingBox())!;
  const sheetBox = (await sheet(page).boundingBox())!;
  const artwork = page.locator('img.decision-world-image, .decision-world-fallback svg');
  await expect(artwork).toHaveCount(1);
  await expect(artwork).toBeVisible();
  // Observe the browser's natural loading only; do not predecode or substitute
  // artwork in the canonical recording. Pixel sampling is a separate QA case.
  await expect.poll(() => artwork.evaluate(element => element instanceof HTMLImageElement
    ? element.complete && element.naturalWidth > 0 && element.naturalHeight > 0
    : element instanceof SVGSVGElement)).toBe(true);
  const picture = await artwork.evaluate(element => {
    const box = element.getBoundingClientRect();
    if (element instanceof SVGSVGElement) {
      const bounds = element.getBBox(), matrix = element.getScreenCTM()!;
      const corners = [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y], [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]]
        .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
      return { kind: 'functional-fallback', left: Math.max(box.left, Math.min(...corners.map(point => point.x))),
        top: Math.max(box.top, Math.min(...corners.map(point => point.y))),
        right: Math.min(box.right, Math.max(...corners.map(point => point.x))),
        bottom: Math.min(box.bottom, Math.max(...corners.map(point => point.y))) };
    }
    const css = getComputedStyle(element);
    let width = box.width, height = box.height;
    if (element instanceof HTMLImageElement && css.objectFit !== 'fill') {
      const contain = Math.min(box.width / element.naturalWidth, box.height / element.naturalHeight);
      const scale = css.objectFit === 'cover' ? Math.max(box.width / element.naturalWidth, box.height / element.naturalHeight)
        : css.objectFit === 'none' ? 1 : css.objectFit === 'scale-down' ? Math.min(1, contain) : contain;
      width = element.naturalWidth * scale;
      height = element.naturalHeight * scale;
    }
    const offset = (value: string, space: number) => value.endsWith('%') ? space * Number.parseFloat(value) / 100
      : value === 'center' ? space / 2 : value === 'right' || value === 'bottom' ? space
      : value === 'left' || value === 'top' ? 0 : Number.parseFloat(value);
    const [x = '50%', y = '50%'] = css.objectPosition.split(' ');
    const left = box.x + offset(x, box.width - width), top = box.y + offset(y, box.height - height);
    // The object-fit image plane may be smaller than its box (letterboxing),
    // or larger and clipped by it. Neither invisible area counts as artwork.
    return { kind: 'raster', left: Math.max(box.x, left), top: Math.max(box.y, top),
      right: Math.min(box.right, left + width), bottom: Math.min(box.bottom, top + height) };
  });
  const visibleArt = {
    left: Math.max(0, worldBox.x, picture.left), top: Math.max(0, worldBox.y, picture.top),
    right: Math.min(page.viewportSize()!.width, worldBox.x + worldBox.width, picture.right),
    bottom: Math.min(page.viewportSize()!.height, worldBox.y + worldBox.height, picture.bottom),
  };
  if (picture.kind === 'raster') {
    expect(visibleArt.right - visibleArt.left, 'The actual raster picture plane intersects the exposed region, not merely its wrapper.').toBeGreaterThanOrEqual(280);
    expect(visibleArt.bottom - visibleArt.top, 'At least 280px of successful raster artwork remains above or beside the sheet.').toBeGreaterThanOrEqual(280);
  } else {
    // The intentional failed-image case checks a working, visible fallback;
    // it does not claim the full raster-world experience survived the failure.
    expect(visibleArt.right - visibleArt.left, 'The actual SVG fallback drawing remains visible.').toBeGreaterThanOrEqual(100);
    expect(visibleArt.bottom - visibleArt.top).toBeGreaterThanOrEqual(100);
  }
  const coveredBySheet = Math.max(0, Math.min(visibleArt.right, sheetBox.x + sheetBox.width) - Math.max(visibleArt.left, sheetBox.x))
    * Math.max(0, Math.min(visibleArt.bottom, sheetBox.y + sheetBox.height) - Math.max(visibleArt.top, sheetBox.y));
  expect(coveredBySheet, 'The measured artwork region is genuinely unoccluded by the active sheet.').toBeLessThanOrEqual(1);
  expect(await artwork.evaluate(element => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const css = getComputedStyle(node);
      if (css.visibility !== 'visible' || css.display === 'none' || Number(css.opacity) === 0) return false;
    }
    return true;
  })).toBe(true);
  for (const city of ['HK', 'SZ'] as const) {
    await expect(outcome(page, city).locator('.decision-key-figures')).toBeInViewport({ ratio: 1 });
    await expect(timeline(page, city)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByTestId('decision-deadline-marker')).toBeInViewport({ ratio: 1 });
  if (page.viewportSize()!.width <= 390) {
    await page.evaluate(() => document.fonts.ready);
    const labels = await page.locator('.decision-time-axis > span:visible').evaluateAll(nodes => nodes.map(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      return { hour: node.getAttribute('data-hour'), text: node.textContent, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }).sort((a, b) => a.left - b.left));
    expect(labels.length, 'The fixed overnight axis retains readable intermediate labels.').toBeGreaterThanOrEqual(3);
    expect(labels[0].hour).toBe('15');
    expect(labels.at(-1)!.hour).toBe('26');
    expect(labels.at(-1)!.text).toContain('02:00');
    for (let index = 0; index < labels.length; index += 1) {
      expect(labels[index].right).toBeGreaterThan(labels[index].left);
      expect(labels[index].bottom).toBeGreaterThan(labels[index].top);
      if (index) expect(labels[index].left - labels[index - 1].right,
        `Rendered tick labels ${labels[index - 1].text} and ${labels[index].text} must not collide.`).toBeGreaterThanOrEqual(4);
    }
  }
  const caveat = sheet(page).getByTestId('decision-core-caveat');
  const footer = sheet(page).getByTestId('decision-sheet-footer');
  const actionArea = sheet(page).getByTestId('decision-action-area');
  await expect(caveat).toHaveText('Authored prices and times. Entry, queues and services unknown. Modeled slack is not a guarantee.');
  for (const [element, description] of [
    [footer, 'The reserved core footer'], [actionArea, 'The whole main action area'],
    [caveat, 'The complete caveat in every core state'],
  ] as const) {
    await expect(element).toHaveCount(1);
    await expect(element, `${description} stays visible without scroll assistance.`).toBeInViewport({ ratio: 1 });
  }
  // This common gate is observational: the real recording and keyboard path
  // must not acquire hidden pointer or scrolling actions through assertions.
  const layout = await sheet(page).evaluate(element => {
    const rect = (node: Element) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const caveatNode = element.querySelector('.decision-core-caveat')!;
    const range = document.createRange(); range.selectNodeContents(caveatNode);
    const text = range.getBoundingClientRect();
    return { sheet: rect(element), body: rect(element.querySelector('.decision-core-body')!),
      footer: rect(element.querySelector('.decision-sheet-footer')!), actions: rect(element.querySelector('.decision-action-area')!),
      caveat: rect(caveatNode), tools: rect(element.querySelector('.decision-sheet-tools')!),
      caveatText: { left: text.left, right: text.right, top: text.top, bottom: text.bottom } };
  });
  for (const [item, container, description] of [
    [layout.footer, layout.sheet, 'reserved footer within sheet'],
    [layout.actions, layout.footer, 'complete actions within footer'],
    [layout.caveat, layout.footer, 'caveat block within footer'],
    [layout.caveatText, layout.caveat, 'all rendered caveat lines within their block'],
  ] as const) {
    expect(item.right - item.left, description).toBeGreaterThan(0);
    expect(item.bottom - item.top, description).toBeGreaterThan(0);
    expect(item.left, description).toBeGreaterThanOrEqual(container.left);
    expect(item.right, description).toBeLessThanOrEqual(container.right);
    expect(item.top, description).toBeGreaterThanOrEqual(container.top);
    expect(item.bottom, description).toBeLessThanOrEqual(container.bottom);
  }
  expect(layout.body.bottom, 'The scroll body does not extend behind the reserved footer.').toBeLessThanOrEqual(layout.footer.top);
  expect(layout.actions.bottom, 'Main actions do not overlap the caveat.').toBeLessThanOrEqual(layout.caveat.top);
  expect(layout.caveat.bottom, 'The full caveat stays above the optional tools.').toBeLessThanOrEqual(layout.tools.top);
  for (const button of await sheet(page).locator('button:visible, select:visible').all()) {
    await expect(button, 'Every main causal-path action is present without scrolling its sheet.').toBeInViewport({ ratio: 1 });
  }
  await expect(contextStrip(page)).toContainText(/400/);
  await expect(contextStrip(page)).toContainText(/person|each/i);
  await expect(contextStrip(page)).toContainText(/2\s*(?:adults|people)/i);
  const departure = Number(await outcome(page, 'HK').getAttribute('data-departure-minute'));
  await expect(contextStrip(page)).toContainText(clockText(departure));
  const deadline = Number((await readOutcomeFacts(page, 'HK')).deadline);
  await expect(contextStrip(page)).toContainText(clockText(deadline));
  if (deadline >= 1440) await expect(contextStrip(page)).toContainText(/next day/i);
  const extent = await page.evaluate(() => ({ x: scrollX, y: scrollY, height: document.documentElement.scrollHeight, viewport: innerHeight }));
  expect(extent.x).toBe(0);
  expect(extent.y, 'The world is the viewport, not a page scrolled down to a form.').toBe(0);
  expect(extent.height).toBeLessThanOrEqual(extent.viewport + 1);
}

/** Explicit expected outcomes for the new authored clock cases. This checks
 * rendered facts; it does not reproduce the outing engine or price arithmetic. */
export async function expectTimeFacts(page: Page, expected: {
  departure: number; deadline: number; hkHome: number; szHome: number; szWalk?: number;
}) {
  const walk = expected.szWalk ?? 45;
  expect(await readOutcomeFacts(page, 'HK')).toEqual({ cost: '336', home: String(expected.hkHome), dinner: '90', walk: '45', deadline: String(expected.deadline) });
  expect(await readOutcomeFacts(page, 'SZ')).toEqual({ cost: '291.83', home: String(expected.szHome), dinner: '90', walk: String(walk), deadline: String(expected.deadline) });
  for (const [city, home, cityWalk, cost] of [['HK', expected.hkHome, 45, '336'], ['SZ', expected.szHome, walk, '291.83']] as const) {
    await expect(outcome(page, city)).toHaveAttribute('data-departure-minute', String(expected.departure));
    await expect(outcome(page, city)).toContainText(cost);
    await expect(outcome(page, city)).toContainText(clockText(home));
    await expect(outcome(page, city)).toContainText('Dinner 90 min');
    await expect(outcome(page, city)).toContainText(`walk ${cityWalk} min`);
    if (home >= 1440) await expect(outcome(page, city).locator('.decision-key-figures')).toContainText(/next day/i);
  }
}


/** Explicit optional legend inspection for mixed-interaction QA cases only.
 * First-view comparison/control checks remain untouched; recording and keyboard
 * coverage call the observational expectWorldAndCore instead. */
export async function expectTrailingBodyReachable(page: Page) {
  await expectWorldAndCore(page);
  const body = sheet(page).locator('.decision-core-body');
  const last = body.locator('.decision-comparison > :last-child');
  const footer = sheet(page).getByTestId('decision-sheet-footer');
  const fixedFooter = await footer.boundingBox();
  const initial = await body.evaluate(element => ({ top: element.scrollTop, height: element.scrollHeight }));
  const bodyBox = (await body.boundingBox())!;
  // Ordinary wheel input is directed inside the body, never scrollIntoView on
  // the document. The trailing legend may scroll; initial city lanes may not.
  await page.mouse.move(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height / 2);
  await page.mouse.wheel(0, initial.height + page.viewportSize()!.height);
  await expect.poll(() => body.evaluate(element => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThanOrEqual(1);
  await expect(last).toHaveCount(1);
  await expect(last, 'Ordinary inner scrolling reaches the complete final comparison content.').toBeInViewport({ ratio: 1 });
  const ending = await last.evaluate(element => {
    const box = element.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    const body = element.closest('.decision-core-body')!.getBoundingClientRect();
    const footer = element.closest('[data-testid="decision-sheet"]')!.querySelector('.decision-sheet-footer')!.getBoundingClientRect();
    return { box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
      text: { left: text.left, right: text.right, top: text.top, bottom: text.bottom },
      body: { left: body.left, right: body.right, top: body.top, bottom: body.bottom }, footerTop: footer.top };
  });
  for (const [item, description] of [[ending.box, 'last body content'], [ending.text, 'all final rendered text']] as const) {
    expect(item.right - item.left, description).toBeGreaterThan(0);
    expect(item.bottom - item.top, description).toBeGreaterThan(0);
    expect(item.left, description).toBeGreaterThanOrEqual(ending.body.left);
    expect(item.right, description).toBeLessThanOrEqual(ending.body.right);
    expect(item.top, description).toBeGreaterThanOrEqual(ending.body.top);
    expect(item.bottom, description).toBeLessThanOrEqual(Math.min(ending.body.bottom, ending.footerTop));
  }
  expect(await footer.boundingBox(), 'Inner-body scrolling cannot move the reserved caveat/action footer.').toEqual(fixedFooter);
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  await page.mouse.wheel(0, -(initial.height + page.viewportSize()!.height));
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(0);
  if (initial.top > 0) await page.mouse.wheel(0, initial.top);
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(initial.top);
  await expectWorldAndCore(page); // Restore and recheck both lanes and every primary control.
}
