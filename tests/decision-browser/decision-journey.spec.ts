import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { action, auditNoPrivateStorage, beginTimePreview, changeDeadline, chooseBaseline, clockControl, applyTimeChange, expectNoOverflow, openDisclosure, closeDisclosure, expectKeyboardFocusVisible, readInputFacts, reason, commitShortWalk, startFresh } from './decision-helpers';

async function selectEvening(page: Page, city: 'Hong Kong' | 'Shenzhen', departure?: number) {
  await chooseBaseline(page, city, 'An explicit starting reason.');
  await openDisclosure(page, 'What matters to you?');
  await action(page, 'Exploration').click();
  await closeDisclosure(page, 'What matters to you?');
  if (departure === undefined) await changeDeadline(page);
  else { await beginTimePreview(page, 'departure'); await clockControl(page, 'departure').selectOption(String(departure)); await applyTimeChange(page); }
  await action(page, `Keep full ${city} evening`).click();
}
async function captureMovement(page: Page, info: TestInfo, name: string) {
  const path = resolve('artifacts/decision/movement', `${info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${name}.png`);
  await mkdir(resolve('artifacts/decision/movement'), { recursive: true });
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}
type ControlKind = 'button' | 'summary';
const control = (page: Page, name: string, kind: ControlKind = 'button') => kind === 'summary' ? page.locator('summary').filter({ hasText: name }) : action(page, name);
async function keyboardActivate(page: Page, name: string, kind: ControlKind = 'button') {
  const button = control(page, name, kind);
  for (let step = 0; step < 40; step++) {
    if (await button.evaluate(element => element === document.activeElement)) { await expectKeyboardFocusVisible(page); await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard traversal did not reach ${name}.`);
}
async function expectPlayerInsideFrame(page: Page) {
  const frame = await page.getByTestId('decision-journey-frame').boundingBox();
  expect(frame).not.toBeNull();
  await expect.poll(async () => {
    const player = await page.getByTestId('decision-player').boundingBox();
    return !!player && player.x >= frame!.x && player.x + player.width <= frame!.x + frame!.width && player.y >= frame!.y && player.y + player.height <= frame!.y + frame!.height;
  }).toBe(true);
}

async function expectLoadedPlayer(page: Page) {
  const sprite = page.getByTestId('decision-player').locator('img');
  await expect(sprite).toHaveCount(1);
  const bitmap = await sprite.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const back = image.parentElement!.getAttribute('data-pose') === 'idle-back';
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, back ? 627 : 0, back ? 627 : 0, 627, 627, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    let visible = 0;
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 128) { visible++; colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`); }
    }
    return { width: image.naturalWidth, height: image.naturalHeight, visible, colors: colors.size };
  });
  expect(bitmap.width).toBe(1254); expect(bitmap.height).toBe(1254);
  expect(bitmap.visible).toBeGreaterThan(100); expect(bitmap.colors).toBeGreaterThan(15);
  // Decoded bitmap checks complement, and do not replace, actual pixel/film review.
}
async function expectDestinationImage(page: Page, filename: string) {
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-art-status', 'ready');
  const image = page.locator(`.decision-journey-background[src$="${filename}"]`).last();
  await expect(image).toBeVisible();
  expect(await image.evaluate(async (element: HTMLImageElement) => { await element.decode(); return [element.naturalWidth, element.naturalHeight]; })).toEqual([1672, 941]);
}

async function expectSeriousAxeClear(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')), 'No serious/critical findings; no excluded rules.').toEqual([]);
}

type Activate = (name: string, kind?: ControlKind) => Promise<void>;
async function selectShenzhenWith(page: Page, activate: Activate) {
  await activate('What matters to you?');
  await activate('Exploration');
  await activate('Back to evening');
  await activate('Start with Shenzhen');
  await activate('Change home-by');
  for (let step = 0; step < 4; step++) await activate('15 minutes earlier');
  await expect(clockControl(page, 'homeBy')).toHaveValue('1350');
  await activate('Apply time change');
  await activate('Keep full Shenzhen evening');
}
async function inspectExactBillWith(page: Page, activate: Activate) {
  await activate('Choose an object');
  await activate('Open menu');
  const bills = await page.locator('.decision-bill-pair').innerText();
  await activate('Inputs used in this comparison', 'summary');
  const rows = page.locator('[data-input-key][data-input-value]');
  expect(await rows.count()).toBeGreaterThanOrEqual(15);
  for (const row of await rows.all()) {
    const displayed = row.locator('dd');
    await expect(displayed).toBeVisible();
    expect(await displayed.innerText()).toBe(await row.getAttribute('data-input-value'));
  }
  const inputs = await rows.evaluateAll(items => items.map(item => [item.getAttribute('data-input-key'), item.getAttribute('data-input-value')]));
  await activate('Back to evening');
  return { bills, inputs };
}

for (const width of [390, 1440]) test(`Shenzhen node journey keeps the chosen comparison at ${width}px`, async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ baseURL, viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const activate: Activate = width === 390 ? (name, kind) => control(page, name, kind).tap() : (name, kind) => keyboardActivate(page, name, kind);
  const audit = await auditNoPrivateStorage(context);
  try {
    await startFresh(page);
    // Every interactive step through arrival uses actual touch events at 390 px
    // or Tab/Enter traversal at 1440 px. No click(), focus(), or seeded state.
    await selectShenzhenWith(page, activate);
    const before = await inspectExactBillWith(page, activate);
    await activate('Explore the chosen evening');
    const journey = page.getByTestId('decision-journey');
    await expect(journey).toHaveAttribute('data-phase', 'exploring');
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1020');
    await expect(page.getByTestId('decision-journey-place')).toContainText('home by 22:30');
    await expectPlayerInsideFrame(page);
    await expectLoadedPlayer(page);
    await captureMovement(page, info, 'counter');
    await expectSeriousAxeClear(page);
    for (let turn = 0; turn < 2; turn++) {
      await activate('Station entrance');
      await expect(journey).toHaveAttribute('data-node', 'station');
      await expectPlayerInsideFrame(page);
      await expect(journey).toHaveAttribute('data-committed-arrival', 'none');
      await expect(page.getByTestId('decision-station-thought')).toContainText('You marked exploration.');
      await expect(page.getByTestId('decision-station-thought')).toContainText('15 min past home-by');
      await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1020');
      await activate('Counter');
    }
    await activate('Station entrance');
    await expectPlayerInsideFrame(page);
    await captureMovement(page, info, 'station');
    await expectSeriousAxeClear(page);
    await activate('Open comparison and replay');
    expect(await inspectExactBillWith(page, activate)).toEqual(before);
    await activate('Put down phone');
    await activate('Board for Lo Wu');
    await expect(journey).toHaveAttribute('data-phase', 'outward');
    await expect(journey).toHaveAttribute('data-committed-arrival', '1125');
    await expect(page.getByRole('group', { name: 'Schematic outward journey to Shenzhen' })).toContainText('Lo Wu');
    await captureMovement(page, info, 'outward');
    await expectSeriousAxeClear(page);
    await expect(action(page, 'Continue to arrival')).toBeEnabled();
    await activate('Continue to arrival');
    await expect(journey).toHaveAttribute('data-phase', 'arrived');
    await expect(page.getByTestId('decision-journey-place')).toContainText('Luohu dinner · Shenzhen');
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1125');
    await expect(action(page, 'Inspect the full outing bill')).toBeFocused();
    await expect(page.getByTestId('decision-journey-forecast')).toContainText('HK$291.83');
    await expect(page.getByTestId('decision-journey-forecast')).toContainText('home 22:45');
    await expectPlayerInsideFrame(page);
    await expectDestinationImage(page, 'decision-sz-evening.webp');
    await expectLoadedPlayer(page);
    await captureMovement(page, info, 'arrival');
    await expectSeriousAxeClear(page);
    await activate('Open comparison and replay');
    await activate('Replay the comparison');
    await activate('Before');
    await activate('Return to current decision');
    expect(await inspectExactBillWith(page, activate)).toEqual(before);
    await activate('Put down phone');
    await expect(journey).toHaveAttribute('data-phase', 'arrived');
    await expect(journey).toHaveAttribute('data-committed-arrival', '1125');
    await expect(action(page, 'Board for Lo Wu')).toHaveCount(0);
    await expectNoOverflow(page);
    await audit.expectZero(page);
  } finally { await context.close(); }
});

test('local departure works from the counter and reduced motion arrives without a cinematic', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startFresh(page);
  await selectEvening(page, 'Hong Kong', 990);
  await action(page, 'Explore the chosen evening').click();
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-node', 'counter');
  await expect(action(page, 'Head to local dinner')).toBeVisible();
  await expect(page.getByTestId('decision-departure-consequence')).toContainText('Arrival 16:45');
  await expect(page.getByTestId('decision-departure-consequence')).toContainText('home 19:15');
  await expect(page.getByTestId('decision-departure-consequence')).toContainText('255 min modeled slack');
  await keyboardActivate(page, 'Station entrance');
  await keyboardActivate(page, 'Counter');
  for (const selector of ['.decision-journey-plane', '.decision-journey-player']) {
    expect(await page.locator(selector).evaluate(element => getComputedStyle(element).transitionDuration.split(',').map(value => Number.parseFloat(value)))).toEqual([0]);
  }
  await keyboardActivate(page, 'Head to local dinner');
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'arrived');
  await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1005');
  await expect(page.getByTestId('decision-journey-place')).toContainText('Nearby dinner · Hong Kong');
  await expect(page.getByTestId('decision-journey-forecast')).toContainText('HK$336');
  await expect(page.getByTestId('decision-journey-forecast')).toContainText('home 19:15');
  await expect(action(page, 'Continue to arrival')).toHaveCount(0);
  await expect(action(page, 'Inspect the full outing bill')).toBeFocused();
  await expectPlayerInsideFrame(page);
  await expectDestinationImage(page, 'decision-hk-pixel.webp');
  await expectLoadedPlayer(page);
  await captureMovement(page, info, 'local-arrival');
  await expectNoOverflow(page);
});

test('slow incoming art keeps the route truthful and a failed image gives a usable arrival', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let release: (() => void) | undefined;
  await page.route('**/art/decision-sz-*.webp', async route => { await new Promise<void>(resolve => { release = resolve; }); await route.abort('failed'); });
  try {
  await startFresh(page);
  await selectEvening(page, 'Shenzhen', 900);
  await action(page, 'Explore the chosen evening').click();
  await action(page, 'Station entrance').click();
  await action(page, 'Board for Lo Wu').click();
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-art-status', 'pending');
  await expect(page.getByTestId('decision-journey-place')).toContainText('Outward journey');
  await expect(action(page, 'Preparing the arrival…')).toBeDisabled();
  await captureMovement(page, info, 'slow-arrival');
  expect(release).toBeDefined();
  release!();
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-art-status', 'fallback');
  await action(page, 'Continue to arrival').click();
  await expect(page.getByTestId('decision-journey-place')).toContainText('Luohu dinner · Shenzhen');
  await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1005');
  await expect(page.locator('.decision-journey-fallback')).toBeVisible();
  await captureMovement(page, info, 'fallback-arrival');
  await expect(page.getByRole('img', { name: 'Schematic Luohu dinner · Shenzhen' })).toBeVisible();
  await expectSeriousAxeClear(page);
  await action(page, 'Inspect the full outing bill').click();
  await expect(page.locator('.decision-bill-pair')).toContainText('Shenzhen');
  await expectNoOverflow(page);
  } finally { release?.(); }
});

test('portable movement embeds all four approved images and arrives with the network disabled', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true, reducedMotion: 'reduce' });
  const attempted: string[] = [];
  context.on('request', request => { if (/^https?:/i.test(request.url())) attempted.push(request.url()); });
  const page = await context.newPage();
  try {
    await startFresh(page, pathToFileURL(resolve('artifacts/crossing-lives-decision-prototype.html')).href);
    await selectEvening(page, 'Shenzhen', 900);
    await action(page, 'Explore the chosen evening').click();
    await action(page, 'Station entrance').click();
    await action(page, 'Board for Lo Wu').click();
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'arrived');
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-art-status', 'ready');
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1005');
    expect(await page.evaluate(() => Object.keys((globalThis as typeof globalThis & { __BETWEEN_ART__: Record<string, string> }).__BETWEEN_ART__).sort())).toEqual(['decision-hk-pixel.webp', 'decision-player.webp', 'decision-sz-day.webp', 'decision-sz-evening.webp']);
    for (const image of await page.locator('.decision-journey-plane img').all()) await expect(image).toHaveAttribute('src', /^data:image\/webp;base64,/);
    expect(attempted).toEqual([]);
    await expectLoadedPlayer(page);
    await expect(page.locator('.decision-journey-background').last()).toBeVisible();
    await captureMovement(page, info, 'offline-day-arrival');
  } finally { await context.close(); }
});

for (const revision of ['earlier-departure', 'short-walk'] as const) test(`arrival objects reopen the captured revision after closing Before: ${revision}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startFresh(page);
  if (revision === 'earlier-departure') await selectEvening(page, 'Shenzhen', 990);
  else {
    await chooseBaseline(page, 'Shenzhen', 'An explicit starting reason.');
    await changeDeadline(page);
    await commitShortWalk(page);
  }
  await openDisclosure(page, 'What matters to you?');
  await reason(page).fill('My own revised reason.');
  await closeDisclosure(page, 'What matters to you?');
  const capturedInputs = await readInputFacts(page);
  await action(page, 'Explore the chosen evening').click();
  await action(page, 'Station entrance').click();
  await action(page, 'Board for Lo Wu').click();
  await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'arrived');
  const expectedArrival = revision === 'earlier-departure' ? '1095' : '1125';
  await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', expectedArrival);
  for (const object of ['arrival-bill', 'menu', 'map', 'phone'] as const) {
    await action(page, 'Open comparison and replay').click();
    await action(page, 'Replay the comparison').click();
    await action(page, 'Before').click();
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page)).toHaveValue('An explicit starting reason.');
    await closeDisclosure(page, 'What matters to you?');
    await expect(page.getByTestId('decision-experience')).toHaveAttribute('data-displayed-snapshot', 'baseline');
    await action(page, 'Put down phone').click();
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', expectedArrival);
    if (object === 'arrival-bill') await action(page, 'Inspect the full outing bill').click();
    else await action(page, { menu: 'Menu See both bills', map: 'Map Unfold both routes', phone: 'Phone Adjust one time' }[object]).click();
    await expect(page.getByTestId('decision-experience')).toHaveAttribute('data-displayed-snapshot', 'revised');
    expect(await readInputFacts(page)).toEqual(capturedInputs);
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page)).toHaveValue('My own revised reason.');
    await closeDisclosure(page, 'What matters to you?');
    const activeObject = await page.getByTestId('decision-experience').getAttribute('data-active-object');
    await action(page, `Put down ${activeObject}`).click();
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-committed-arrival', expectedArrival);
    await expect(action(page, 'Board for Lo Wu')).toHaveCount(0);
  }
});
