import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { action, clockControl, expectKeyboardFocusVisible, expectNoOverflow, expectTouchTarget, experience, startFresh } from './decision-helpers';

export const friend = (page: Page) => page.getByTestId('friend-experience');
export const friendAction = (page: Page, name: string) => friend(page).getByRole('button', { name, exact: true });
export const friendOutcome = (page: Page, city: 'HK' | 'SZ') => friend(page).getByTestId(`friend-outcome-${city}`);
export const friendTimeline = (page: Page, city: 'HK' | 'SZ') => friend(page).getByTestId(`friend-timeline-${city}`);
export const newReason = (page: Page) => friend(page).getByRole('textbox', { name: 'Your reason for this choice (optional)', exact: true });
export const reconsider = (page: Page) => friend(page).getByRole('checkbox', { name: 'I’ve reconsidered what matters for this evening', exact: true });
export const sourceReason = 'I want the original full walk for this outing.';
export const ownReason = 'For another evening, company matters more to me with three adults.';

export type InputMode = 'touch' | 'keyboard' | 'pointer';
export type Activate = (locator: Locator) => Promise<void>;
export function interaction(page: Page, mode: InputMode): Activate {
  if (mode === 'touch') return async locator => {
    const target = await locator.getAttribute('type') === 'checkbox' ? locator.locator('..') : locator;
    await expectTouchTarget(target);
    await target.tap();
  };
  if (mode === 'pointer') return locator => locator.click();
  return async locator => {
    await tabTo(page, locator);
    await page.keyboard.press(await locator.getAttribute('type') === 'checkbox' ? 'Space' : 'Enter');
  };
}

export async function tabTo(page: Page, locator: Locator) {
  await expect(locator).toHaveCount(1);
  await expect(locator).toBeVisible();
  for (let step = 0; step < 80; step += 1) {
    if (await locator.evaluate(element => element === document.activeElement)) {
      await expectKeyboardFocusVisible(page);
      return;
    }
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[hidden], [inert]') === null), 'Real Tab traversal must never enter an inactive scene.').toBe(true);
  }
  throw new Error(`Tab traversal did not reach ${await locator.getAttribute('aria-label') ?? await locator.textContent()}.`);
}

export async function typeReason(page: Page, locator: Locator, text: string, mode: InputMode) {
  if (mode === 'keyboard') await tabTo(page, locator);
  else if (mode === 'touch') await locator.tap();
  else await locator.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
}

/** The source is constructed entirely through ordinary user controls. */
export async function prepareSource(page: Page, activate: Activate, options: {
  city?: 'Hong Kong' | 'Shenzhen'; revision?: 'deadline' | 'earlier-departure' | 'short-walk';
  mode?: InputMode; url?: string;
} = {}) {
  const city = options.city ?? 'Shenzhen';
  const revision = options.revision ?? 'deadline';
  const mode = options.mode ?? 'pointer';
  await startFresh(page, options.url);
  await activate(action(page, `Start with ${city}`));
  await activate(action(page, 'What matters to you?'));
  await activate(action(page, 'Exploration'));
  await typeReason(page, page.getByRole('textbox', { name: 'Your reason (optional)', exact: true }), 'My starting reason belongs to the earlier outing.', mode);
  await activate(action(page, 'Back to evening'));
  await activate(action(page, revision === 'earlier-departure' ? 'Change departure' : 'Change home-by'));
  for (let step = 0; step < (revision === 'earlier-departure' ? 2 : 4); step += 1) await activate(action(page, '15 minutes earlier'));
  await expect(clockControl(page, revision === 'earlier-departure' ? 'departure' : 'homeBy')).toHaveValue(revision === 'earlier-departure' ? '990' : '1350');
  await activate(action(page, 'Apply time change'));
  if (revision === 'short-walk') {
    await activate(action(page, 'Preview a shorter Shenzhen walk'));
    await activate(action(page, 'Choose shorter Shenzhen walk'));
  } else await activate(action(page, `Keep full ${city} evening`));
  await activate(action(page, 'What matters to you?'));
  await typeReason(page, page.getByRole('textbox', { name: 'Your reason (optional)', exact: true }), sourceReason, mode);
  await activate(action(page, 'Back to evening'));
  await expect(experience(page)).toHaveAttribute('data-stage', 'revised');
}

export async function arriveFromSource(page: Page, activate: Activate, city: 'Hong Kong' | 'Shenzhen' = 'Shenzhen') {
  await activate(action(page, 'Explore the chosen evening'));
  if (city === 'Shenzhen') await activate(action(page, 'Station entrance'));
  await activate(action(page, city === 'Shenzhen' ? 'Board for Lo Wu' : 'Head to local dinner'));
  const journey = page.getByTestId('decision-journey');
  await expect(journey).not.toHaveAttribute('data-art-status', 'pending');
  if (await journey.getAttribute('data-phase') === 'outward') await activate(action(page, 'Continue to arrival'));
  await expect(journey).toHaveAttribute('data-phase', 'arrived');
  await expect(action(page, 'A message about next time')).toHaveAttribute('id', 'decision-next-invitation');
}

export async function readSourceState(page: Page) {
  const attrs = async (locator: Locator) => locator.evaluate(element => Object.fromEntries([...element.attributes].filter(attr => attr.name.startsWith('data-')).map(attr => [attr.name, attr.value])));
  return {
    main: await attrs(experience(page)), journey: await attrs(page.getByTestId('decision-journey')),
    clock: await attrs(page.getByTestId('decision-journey-clock')),
    place: await page.getByTestId('decision-journey-place').textContent(),
    forecast: await page.getByTestId('decision-journey-forecast').textContent(),
  };
}

export async function openInvitation(page: Page, activate: Activate) {
  await activate(action(page, 'A message about next time'));
  await expectIsolatedEpisode(page);
}

export async function expectIsolatedEpisode(page: Page) {
  await expect(friend(page)).toBeVisible();
  await expect(experience(page)).toHaveCount(1);
  await expect(experience(page)).toBeHidden();
  await expect(experience(page)).toHaveAttribute('hidden', '');
  await expect(experience(page)).toHaveJSProperty('inert', true);
  await expect(friend(page)).toHaveJSProperty('inert', false);
  await expect(page.getByTestId('decision-journey')).toHaveCount(1);
  for (const label of ['Menu See both bills', 'Map Unfold both routes', 'Phone Adjust one time', 'A message about next time']) {
    await expect(page.getByRole('button', { name: label, exact: true }), 'Hidden source controls must not leak into the active role tree.').toHaveCount(0);
  }
  for (const label of ['Menu See the party bills', 'Map Compare this evening', 'Phone Read the invitation', 'Return to the current arrival']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(1);
  }
  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  });
  expect(duplicates, 'Mounted hidden source and active friend scene share no DOM IDs.').toEqual([]);
}

export async function expectInvitation(page: Page) {
  await expect(friend(page)).toHaveAttribute('data-stage', 'invitation');
  await expect(friend(page)).toHaveAttribute('data-party-size', '2');
  await expect(friend(page).getByRole('heading', { name: 'One more for another evening?', exact: true })).toBeVisible();
  await expect(friend(page)).toContainText('Can I join next time?');
  await expect(friend(page)).toContainText('I’ll meet you before you leave.');
  await expect(friend(page).getByTestId('friend-context')).toContainText('Another evening · before departure');
  await expect(friend(page).getByTestId('friend-context')).toContainText('2 adults');
  await expect(friendAction(page, 'Preview three adults')).toBeEnabled();
  await expect(friendAction(page, 'Return to the current arrival')).toBeVisible();
}

export async function currentFriend(page: Page, activate: Activate) {
  await activate(friendAction(page, 'Back to friend comparison'));
}

export async function friendDetail(page: Page, activate: Activate, name: string) {
  const summary = friend(page).locator('summary').filter({ hasText: 'Inspect this evening' });
  if (!await summary.evaluate(element => element.closest('details')!.open)) await activate(summary);
  await activate(friendAction(page, name));
}

export async function readFriendOutcomes(page: Page) {
  await expectIsolatedEpisode(page);
  return Promise.all((['HK', 'SZ'] as const).map(city => friendOutcome(page, city).evaluate(element => Object.fromEntries([...element.attributes].filter(attr => attr.name.startsWith('data-')).map(attr => [attr.name, attr.value])))));
}

/** Measure the rendered DOM geometry; screenshots and film verify actual appearance. */
export async function readFriendTracks(page: Page) {
  const geometries = [];
  const results = [];
  for (const city of ['HK', 'SZ'] as const) {
    const track = friendTimeline(page, city);
    await expect(track).toBeVisible();
    const geometry = await track.evaluate(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, width: box.width, start: Number(element.getAttribute('data-scale-start-minute')), end: Number(element.getAttribute('data-scale-end-minute')),
        segments: [...element.querySelectorAll<HTMLElement>('[data-segment-id]')].map(segment => {
          const rect = segment.getBoundingClientRect();
          return { id: segment.dataset.segmentId!, start: Number(segment.dataset.startMinute), end: Number(segment.dataset.endMinute), x: rect.x, width: rect.width, height: rect.height, text: segment.textContent ?? '' };
        }) };
    });
    expect([geometry.start, geometry.end]).toEqual([900, 1560]);
    expect(geometry.width).toBeGreaterThan(200);
    expect(geometry.segments.length, 'Every outward, activity and return leg is drawn.').toBeGreaterThanOrEqual(city === 'HK' ? 4 : 8);
    expect(geometry.segments[0].start).toBe(Number(await friendOutcome(page, city).getAttribute('data-departure-minute')));
    expect(geometry.segments.at(-1)!.end).toBe(Number(await friendOutcome(page, city).getAttribute('data-home-minute')));
    for (const [index, segment] of geometry.segments.entries()) {
      expect(segment.end).toBeGreaterThan(segment.start);
      expect(segment.height).toBeGreaterThanOrEqual(12);
      expect(segment.text.trim()).not.toBe('');
      if (index) expect(segment.start, 'The full modeled route has no gap or overlapping leg.').toBe(geometry.segments[index - 1].end);
      const left = geometry.x + geometry.width * (segment.start - geometry.start) / (geometry.end - geometry.start);
      const width = geometry.width * (segment.end - segment.start) / (geometry.end - geometry.start);
      expect(Math.abs(segment.x - left), `${city}/${segment.id} starts at its visible common-scale minute.`).toBeLessThanOrEqual(2);
      expect(Math.abs(segment.width - width), `${city}/${segment.id} is visibly proportional to its duration.`).toBeLessThanOrEqual(2);
      expect(segment.x).toBeGreaterThanOrEqual(geometry.x - 2);
      expect(segment.x + segment.width).toBeLessThanOrEqual(geometry.x + geometry.width + 2);
    }
    geometries.push(geometry);
    results.push({ start: String(geometry.start), end: String(geometry.end), segments: geometry.segments.map(({ id, start, end, text }) => ({ id, start: String(start), end: String(end), text })) });
  }
  expect(Math.abs(geometries[0].x - geometries[1].x), 'Both cities align on one clock.').toBeLessThanOrEqual(1);
  expect(Math.abs(geometries[0].width - geometries[1].width), 'Both cities have the same visible pixels per minute.').toBeLessThanOrEqual(1);
  const marker = friend(page).getByTestId('friend-deadline-marker');
  const markerMinute = Number(await marker.getAttribute('data-deadline-minute'));
  const markerBox = (await marker.boundingBox())!;
  const expectedX = geometries[0].x + geometries[0].width * (markerMinute - geometries[0].start) / (geometries[0].end - geometries[0].start);
  expect(Math.abs(markerBox.x - expectedX), 'The actual home-by marker shares the route time scale.').toBeLessThanOrEqual(2);
  return results;
}

export async function inspectFriendBill(page: Page, activate: Activate) {
  await activate(friendAction(page, 'Menu See the party bills'));
  await expectIsolatedEpisode(page);
  const rows = friend(page).locator('[data-cost-line-id]');
  await expect(rows).toHaveCount(9);
  const lines = await rows.evaluateAll(elements => elements.map(element => ({
    id: element.getAttribute('data-cost-line-id'), native: element.getAttribute('data-native-group-amount'),
    hkd: element.getAttribute('data-hkd-group-amount'), currency: element.getAttribute('data-currency'),
    quantity: element.getAttribute('data-quantity'), scope: element.getAttribute('data-scope'), text: element.textContent,
  })));
  const summary = friend(page).locator('summary').filter({ hasText: 'Inputs used in this comparison' });
  await expect(summary).toHaveCount(1);
  if (!await summary.evaluate(element => element.closest('details')!.open)) await activate(summary);
  const facts = friend(page).locator('[data-input-key][data-input-value]');
  expect(await facts.count()).toBeGreaterThanOrEqual(15);
  for (const row of await facts.all()) {
    const key = await row.getAttribute('data-input-key');
    const value = await row.getAttribute('data-input-value');
    const displayed = row.locator('dd');
    await expect(displayed, `Input ${key} has a readable disclosed value.`).toBeVisible();
    expect(await displayed.innerText(), `Input ${key} visibly matches the exact model input.`).toBe(value);
  }
  const inputs = Object.fromEntries(await facts.evaluateAll(elements => elements.map(element => [element.getAttribute('data-input-key')!, element.getAttribute('data-input-value')!])));
  const text = await friend(page).locator('.decision-bills').innerText();
  await currentFriend(page, activate);
  return { lines, inputs, text };
}

export async function expectPartyFacts(page: Page, party: 2 | 3, options: { departure?: number; deadline?: number; szWalk?: number } = {}) {
  const departure = options.departure ?? 1020;
  const szWalk = options.szWalk ?? 45;
  for (const [city, cost, group, home, walk] of [
    ['HK', party === 2 ? 336 : 325.33, party === 2 ? 672 : 976, departure + 165, 45],
    ['SZ', party === 2 ? 291.83 : 281.29, party === 2 ? 583.66 : 843.88, departure + 300 + szWalk, szWalk],
  ] as const) {
    const outcome = friendOutcome(page, city);
    await expect(outcome).toBeVisible();
    await expect(outcome).toHaveAttribute('data-cost-hkd', String(cost));
    await expect(outcome).toHaveAttribute('data-group-hkd', String(group));
    await expect(outcome).toHaveAttribute('data-departure-minute', String(departure));
    await expect(outcome).toHaveAttribute('data-home-minute', String(home));
    await expect(outcome).toHaveAttribute('data-deadline-minute', String(options.deadline ?? 1350));
    await expect(outcome).toHaveAttribute('data-dinner-minutes', '90');
    await expect(outcome).toHaveAttribute('data-walk-minutes', String(walk));
    await expect(outcome).toHaveAttribute('data-entry-fit', 'unknown');
    await expect(outcome).toContainText(String(cost));
    await expect(outcome).toContainText(`walk ${walk} min`);
  }
}

export async function inspectFriendComparison(page: Page, activate: Activate, party: 2 | 3, options: { departure?: number; deadline?: number; szWalk?: number } = {}) {
  await activate(friendAction(page, 'Map Compare this evening'));
  await expectPartyFacts(page, party, options);
  const result = { outcomes: await readFriendOutcomes(page), tracks: await readFriendTracks(page) };
  await currentFriend(page, activate);
  return result;
}

export async function expectPayoff(page: Page, preview: boolean) {
  await expect(friend(page)).toHaveAttribute('data-stage', preview ? 'preview' : 'comparison');
  await expect(friend(page)).toHaveAttribute('data-party-size', '3');
  await expect(friend(page)).toHaveAttribute('data-choice', 'none');
  await expect(friend(page)).toHaveAttribute('data-preview', String(preview));
  for (const [city, beforeGroup, afterGroup, beforeAverage, afterAverage] of [
    ['HK', '672', '976', '336', '325.33'], ['SZ', '583.66', '843.88', '291.83', '281.29'],
  ]) {
    const costs = friend(page).getByTestId(`friend-cost-${city}`);
    await expect(costs).toBeVisible();
    await expect(costs).toHaveAttribute('data-group-before', beforeGroup);
    await expect(costs).toHaveAttribute('data-group-after', afterGroup);
    await expect(costs).toHaveAttribute('data-average-before', beforeAverage);
    await expect(costs).toHaveAttribute('data-average-after', afterAverage);
    for (const figure of [beforeGroup, afterGroup, beforeAverage, afterAverage]) await expect(costs).toContainText(figure);
    await expect(costs).toContainText('Whole group');
    await expect(costs).toContainText('Average / person');
    for (const amount of await costs.locator('dd').all()) {
      const visible = await amount.evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        const body = element.closest('.friend-sheet-body')!.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, bodyTop: body.top, bodyBottom: body.bottom, bodyLeft: body.left, bodyRight: body.right };
      });
      expect(visible.top, 'Every before/after amount appears in the initial comparison body.').toBeGreaterThanOrEqual(visible.bodyTop);
      expect(visible.bottom, 'Group and average amounts cannot sit clipped behind the footer.').toBeLessThanOrEqual(visible.bodyBottom);
      expect(visible.left).toBeGreaterThanOrEqual(visible.bodyLeft);
      expect(visible.right).toBeLessThanOrEqual(visible.bodyRight);
    }
  }
  await expect(friend(page).getByTestId('friend-time-unchanged')).toContainText('Same clock');
  await expect(friend(page).getByTestId('friend-payoff')).toContainText(/rounded average.*exact payment split/i);
}

export async function confirmFriendChoice(page: Page, activate: Activate, city: 'Hong Kong' | 'Shenzhen', mode: InputMode = 'pointer') {
  await activate(friendAction(page, `Choose ${city} for three`));
  await expect(friend(page)).toHaveAttribute('data-stage', 'finished');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText(city);
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Priorities: not reconfirmed.');
  await expect(friendAction(page, 'Replay two and three')).toBeEnabled();
  await activate(friendAction(page, 'What matters this time?'));
  for (const name of ['Food', 'Company', 'Comfort', 'Exploration']) await expect(friendAction(page, name)).toHaveAttribute('aria-pressed', 'false');
  await expect(newReason(page)).toHaveValue('');
  await expect(reconsider(page)).not.toBeChecked();
  await expect(friendAction(page, 'Keep this reflection')).toBeEnabled();
  await activate(friendAction(page, 'Company'));
  await typeReason(page, newReason(page), ownReason, mode);
  await expect(friendAction(page, 'Keep this reflection')).toBeEnabled();
  await activate(reconsider(page));
  await activate(friendAction(page, 'Keep this reflection'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText(city);
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText(ownReason);
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Company');
  await expect(friendAction(page, 'Replay two and three')).toBeEnabled();
}

/** Native pixel bounds and an at-scale world screenshot complement the film.
 * Alpha/fringe counts are evidence for human review, not an aesthetic verdict. */
export async function inspectFriendSprite(page: Page, info: TestInfo) {
  const npc = friend(page).getByTestId('friend-world-npc');
  await expect(npc).toHaveCount(1);
  await expect(npc).toHaveAttribute('data-art-status', 'ready');
  await expect(npc).toBeVisible();
  const image = npc.locator('img');
  const evidence = await image.evaluate(async (element: HTMLImageElement) => {
    await element.decode();
    const canvas = document.createElement('canvas');
    canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(element, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0, opaque = 0, partial = 0, left = canvas.width, right = 0, top = canvas.height, bottom = 0;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha === 0) transparent += 1;
      else if (alpha === 255) opaque += 1;
      else partial += 1;
      if (alpha > 128) {
        const pixel = index / 4, x = pixel % canvas.width, y = Math.floor(pixel / canvas.width);
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
    }
    const box = element.getBoundingClientRect();
    const frame = element.closest('[data-testid="friend-world-frame"]')!.getBoundingClientRect();
    return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, transparent, opaque, partial, colors: colors.size,
      nativeBounds: { left, right, top, bottom },
      displayedBounds: { left: box.left + left / canvas.width * box.width, right: box.left + (right + 1) / canvas.width * box.width,
        top: box.top + top / canvas.height * box.height, bottom: box.top + (bottom + 1) / canvas.height * box.height },
      frame: { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom } };
  });
  expect([evidence.naturalWidth, evidence.naturalHeight]).toEqual([1254, 1254]);
  expect(evidence.transparent).toBeGreaterThan(evidence.naturalWidth * evidence.naturalHeight / 2);
  expect(evidence.opaque).toBeGreaterThan(1_000);
  expect(evidence.colors).toBeGreaterThan(15);
  expect(evidence.displayedBounds.right - evidence.displayedBounds.left).toBeGreaterThan(12);
  expect(evidence.displayedBounds.bottom - evidence.displayedBounds.top).toBeGreaterThan(38);
  expect(evidence.displayedBounds.left).toBeGreaterThanOrEqual(evidence.frame.left);
  expect(evidence.displayedBounds.right).toBeLessThanOrEqual(evidence.frame.right);
  expect(evidence.displayedBounds.top).toBeGreaterThanOrEqual(evidence.frame.top);
  expect(evidence.displayedBounds.bottom).toBeLessThanOrEqual(evidence.frame.bottom);
  await info.attach('friend-sprite-alpha-and-scale-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  const screenshot = info.outputPath(`friend-sprite-at-scale-${page.viewportSize()!.width}.png`);
  await friend(page).getByTestId('friend-world-frame').screenshot({ path: screenshot, animations: 'disabled' });
  await info.attach('friend-sprite-at-scale', { path: screenshot, contentType: 'image/png' });
}

export async function returnToArrival(page: Page, activate: Activate) {
  await activate(friendAction(page, 'Return to the current arrival'));
  await expect(friend(page)).toBeHidden();
  await expect(experience(page)).toBeVisible();
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'arrived');
  await expect(action(page, 'A message about next time')).toBeFocused();
}

export async function captureFriend(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const viewport = page.viewportSize()!;
  const directory = resolve('artifacts/decision/friend');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await info.attach(`friend-${name}-${viewport.width}`, { path, contentType: 'image/png' });
}

export async function expectFriendGeometry(page: Page) {
  await expect(friend(page)).toBeVisible();
  await expectNoOverflow(page);
  for (const label of ['Menu See the party bills', 'Map Compare this evening', 'Phone Read the invitation', 'Return to the current arrival']) {
    await expect(friendAction(page, label)).toBeInViewport({ ratio: 1 });
    await expectTouchTarget(friendAction(page, label));
  }
  await expect(friend(page).getByTestId('friend-context')).toBeInViewport({ ratio: 1 });
}
