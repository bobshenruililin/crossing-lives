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

function disclosure(page: Page, label: string) {
  if (label === 'Unfold the evening') return page.locator('button[aria-controls="decision-unfolded"]');
  return page.locator('summary').filter({ hasText: label });
}

export async function openDisclosure(page: Page, label: string) {
  const control = disclosure(page, label);
  await expect(control).toHaveCount(1);
  await expect(control).toBeVisible();
  const state = await control.evaluate(element => {
    const details = element.closest('details');
    return details ? details.open : element.getAttribute('aria-expanded') === 'true';
  });
  if (!state) await control.click();
}

export async function closeDisclosure(page: Page, label: string) {
  const control = disclosure(page, label);
  const open = await control.evaluate(element => element.closest('details')?.open ?? element.getAttribute('aria-expanded') === 'true');
  if (open) await control.click();
}

export async function startFresh(page: Page, url = '/decision.html') {
  await page.goto(url);
  await expectStage(page, 'baseline');
  await expect(action(page, 'Start with Hong Kong')).toBeVisible();
  await expect(action(page, 'Start with Shenzhen')).toBeVisible();
  await expect(action(page, 'Change home-by time to 22:30')).toBeDisabled();
  await expect(outcome(page, 'HK')).toBeVisible();
  await expect(outcome(page, 'SZ')).toBeVisible();
}

export async function chooseBaseline(page: Page, city: 'Hong Kong' | 'Shenzhen', ownReason?: string) {
  await action(page, `Start with ${city}`).click();
  if (ownReason !== undefined) {
    await openDisclosure(page, 'What matters to you?');
    await reason(page).fill(ownReason);
    await closeDisclosure(page, 'What matters to you?');
  }
  await expect(action(page, 'Change home-by time to 22:30')).toBeEnabled();
}

export async function changeDeadline(page: Page) {
  await action(page, 'Change home-by time to 22:30').click();
  await expectStage(page, 'changed');
}

export async function commitShortWalk(page: Page) {
  await action(page, 'Preview a shorter Shenzhen walk').click();
  await expectStage(page, 'changed', 'revised', true);
  await action(page, 'Choose shorter Shenzhen walk').click();
  await expectStage(page, 'revised');
}

export async function replay(page: Page, stage: 'baseline' | 'changed' | 'revised') {
  await action(page, { baseline: 'Before', changed: 'Changed', revised: 'Revised' }[stage]).click();
  await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', stage);
}

export async function capture(page: Page, info: TestInfo, stage: 'baseline' | 'earlier-deadline' | 'revised' | 'replay') {
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
    return { viewport: innerWidth, document: root.scrollWidth, body: document.body.scrollWidth };
  });
  expect(overflow.document, 'The page has no horizontal scroll outside its viewport.').toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
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
  await openDisclosure(page, 'Read all authored starting facts');
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
  await openDisclosure(page, 'Unfold the evening');
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
    expect(geometry.start).toBe(1020);
    expect(geometry.end).toBeGreaterThanOrEqual(1410);
    expect(geometry.width).toBeGreaterThan(200);
    expect(geometry.segments.length, 'Both actual outward and homeward route legs are drawn.').toBeGreaterThanOrEqual(city === 'HK' ? 4 : 8);
    expect(geometry.segments[0].start).toBe(geometry.start);
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
      await expect(legs.nth(index)).toContainText(/\d{2}:\d{2}–\d{2}:\d{2}/);
    }
  }
  await closeDisclosure(page, 'Inspect the trip out and home');
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
  return bills.evaluateAll(sections => sections.map(section => ({
    heading: section.querySelector('h3')!.textContent,
    lines: [...section.querySelectorAll('li')].map(line => (line.textContent ?? '').replace(/\s+/g, ' ').trim()),
    groupTotal: section.querySelector('.decision-bill-total')!.textContent,
  })));
}
