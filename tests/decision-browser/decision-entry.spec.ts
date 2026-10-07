import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  action, applyTimeChange, auditNoPrivateStorage, beginTimePreview, changeDeadline, chooseBaseline,
  clockControl, closeDisclosure, expectAcceptedFacts, expectNoOverflow, expectStage, experience,
  openDisclosure, openObject, readInputFacts, reason, replay, sheet, startAtWorld, startFresh,
} from './decision-helpers';
import { interaction, tabTo } from './decision-friend-helpers';
import { observeFirstArrivalFrame, expectFirstArrivalFrame, expectPlayerFullyVisible } from './decision-journey-projection';

async function expectVisiblePerson(page: Page) {
  const player = page.getByTestId('decision-player');
  await expectPlayerFullyVisible(page);
  const sprite = player.locator('img');
  await expect(sprite).toBeVisible();
  await expect.poll(() => sprite.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
}

for (const [width, mode] of [[390, 'touch'], [1440, 'keyboard']] as const) {
  test(`the first five seconds show a person and allow unchosen ${mode} movement at ${width}px`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: mode === 'touch' });
    const audit = await auditNoPrivateStorage(context);
    const page = await context.newPage();
    const activate = interaction(page, mode);
    const began = Date.now();
    try {
      await startAtWorld(page);
      await expectVisiblePerson(page);
      const firstPersonMs = Date.now() - began;
      expect(firstPersonMs, 'A cold entry exposes the real loaded player within five seconds.').toBeLessThanOrEqual(5_000);
      const journey = page.getByTestId('decision-journey');
      const originalPosition = await page.getByTestId('decision-player').getAttribute('data-source-x');
      const renderedPosition = () => page.evaluate(() => {
        const player = document.querySelector('[data-testid="decision-player"]')!.getBoundingClientRect();
        const plane = document.querySelector('[data-testid="decision-journey-plane"]')!.getBoundingClientRect();
        return { playerX: player.x, playerY: player.y, planeX: plane.x, planeY: plane.y };
      });
      const beforeMove = await renderedPosition();
      if (mode === 'keyboard') await page.keyboard.press('ArrowLeft');
      else await activate(action(page, 'Station entrance'));
      await expect(journey).toHaveAttribute('data-node', 'station');
      await expect(page.getByTestId('decision-player')).not.toHaveAttribute('data-source-x', originalPosition!);
      await expect.poll(async () => {
        const afterMove = await renderedPosition();
        return Math.max(...(Object.keys(beforeMove) as (keyof typeof beforeMove)[]).map(key => Math.abs(afterMove[key] - beforeMove[key])));
      }, 'Walking must displace the rendered player or camera plane, not only update DOM attributes.').toBeGreaterThan(20);
      await expect(journey).toHaveAttribute('data-camera-moving', 'false');
      await expectVisiblePerson(page);
      const firstMoveMs = Date.now() - began;
      expect(firstMoveMs, 'The first actual keyboard/touch move needs no plan or tutorial.').toBeLessThanOrEqual(5_000);
      await expect(journey).toHaveAttribute('data-city', 'none');
      await expect(journey).toHaveAttribute('data-committed-arrival', 'none');
      await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1020');
      await expect(sheet(page)).toHaveCount(0);
      await activate(action(page, 'Counter'));
      await expect(journey).toHaveAttribute('data-node', 'counter');
      await expect(page.getByTestId('decision-player')).toHaveAttribute('data-source-x', originalPosition!);
      await expectVisiblePerson(page);
      if (mode === 'keyboard') {
        // This regression follows the timed opening proof, so picker testing
        // does not enlarge or dilute the first-five-second movement budget.
        await activate(action(page, 'Choose an object'));
        await tabTo(page, action(page, 'Open map'));
        for (const arrow of ['ArrowLeft', 'ArrowRight']) {
          await page.keyboard.press(arrow);
          await expect(journey).toHaveAttribute('data-node', 'counter');
          await expect(action(page, 'Open map')).toBeFocused();
          await expect(action(page, 'Choose an object')).toHaveAttribute('aria-expanded', 'true');
        }
        await page.keyboard.press('Escape');
        await expect(page.getByRole('group', { name: 'Named object controls', exact: true })).toHaveCount(0);
        await expect(action(page, 'Choose an object')).toBeFocused();
        await page.keyboard.press('ArrowLeft');
        await expect(journey).toHaveAttribute('data-node', 'station');
        await page.keyboard.press('ArrowRight');
        await expect(journey).toHaveAttribute('data-node', 'counter');
        await expect(sheet(page)).toHaveCount(0);
      }
      await expectNoOverflow(page);
      await audit.expectZero(page);
      await info.attach('cold-entry-timing', { body: JSON.stringify({ firstPersonMs, firstMoveMs, mode, viewport: page.viewportSize() }), contentType: 'application/json' });
      await info.attach('unchosen-world', { body: await page.screenshot(), contentType: 'image/png' });
    } finally { await context.close(); }
  });
}

for (const [city, id, arrival, home, cost] of [
  ['Hong Kong', 'hk', '1035', '19:45', 'HK$336'],
  ['Shenzhen', 'sz', '1125', '22:45', 'HK$291.83'],
] as const) {
  test(`an unchanged ${city} baseline departs once and the captured outing is read-only`, async ({ page, context }) => {
    const audit = await auditNoPrivateStorage(context);
    await startFresh(page);
    const original = await readInputFacts(page);
    const ownReason = `Keep my original complete ${city} evening.`;
    await chooseBaseline(page, city, ownReason);
    await expectAcceptedFacts(page, 'baseline');
    await expect(page.getByTestId('decision-time-editor')).toHaveCount(0);
    await expectStage(page, 'baseline');
    await action(page, 'Put down phone').click();
    if (city === 'Shenzhen') await action(page, 'Station entrance').click();
    const journey = page.getByTestId('decision-journey');
    await expect(journey).toHaveAttribute('data-city', id);
    await expect(journey).toHaveAttribute('data-committed-arrival', 'none');
    await observeFirstArrivalFrame(page);
    await action(page, city === 'Shenzhen' ? 'Board for Lo Wu' : 'Head to local dinner').click();
    await expect(journey).toHaveAttribute('data-phase', 'arrived');
    await expectFirstArrivalFrame(page);
    await expect(journey).toHaveAttribute('data-committed-arrival', arrival);
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', arrival);
    await expect(page.getByTestId('decision-journey-forecast')).toContainText(cost);
    await expect(page.getByTestId('decision-journey-forecast')).toContainText(`home ${home}`);
    await expect(action(page, 'Continue to arrival')).toHaveCount(0);
    await action(page, 'Open comparison and replay').click();
    await expect(page.getByRole('heading', { name: 'Your captured outing', exact: true })).toBeVisible();
    await expectAcceptedFacts(page, 'baseline');
    for (const label of ['Start with Hong Kong', 'Start with Shenzhen', 'Change departure', 'Change home-by', 'Keep full Shenzhen evening', 'Keep full Hong Kong evening']) {
      await expect(action(page, label), 'The captured outing exposes inspection without plan-mutation controls.').toHaveCount(0);
    }
    expect(await readInputFacts(page)).toEqual(original);
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page)).toHaveValue(ownReason);
    await expect(reason(page)).toBeDisabled();
    for (const label of ['Food', 'Company', 'Comfort', 'Exploration']) await expect(action(page, label)).toBeDisabled();
    await closeDisclosure(page, 'What matters to you?');
    await replay(page, 'baseline');
    await expectStage(page, 'baseline');
    await action(page, 'Put down phone').click();
    await expect(journey).toHaveAttribute('data-phase', 'arrived');
    await expect(journey).toHaveAttribute('data-committed-arrival', arrival);
    await expect(action(page, 'Board for Lo Wu')).toHaveCount(0);
    await expect(action(page, 'Head to local dinner')).toHaveCount(0);
    await audit.expectZero(page);
  });
}

for (const preview of ['time', 'walk'] as const) for (const resolution of ['cancel', 'apply'] as const) {
  test(`putting down the phone preserves a ${preview} preview and blocks boarding until ${resolution}`, async ({ page }) => {
    await startFresh(page);
    await chooseBaseline(page, 'Shenzhen');
    if (preview === 'time') {
      await beginTimePreview(page, 'departure');
      await clockControl(page, 'departure').selectOption('990');
    } else {
      await changeDeadline(page);
      await action(page, 'Preview a shorter Shenzhen walk').click();
    }
    const previewFacts = await readInputFacts(page);
    const committedStage = preview === 'time' ? 'baseline' : 'changed';
    const displayedStage = preview === 'time' ? 'changed' : 'revised';
    await action(page, 'Put down phone').click();
    await expectStage(page, committedStage, displayedStage, true);
    await expect(experience(page)).toHaveAttribute('data-preview-kind', preview);
    await action(page, 'Station entrance').click();
    const journey = page.getByTestId('decision-journey');
    await expect(journey).toHaveAttribute('data-phase', 'exploring');
    await expect(journey).toHaveAttribute('data-committed-arrival', 'none');
    await expect(action(page, 'Board for Lo Wu')).toHaveCount(0);
    await action(page, 'Finish the preview').click();
    await expect(experience(page)).toHaveAttribute('data-active-object', 'phone');
    expect(await readInputFacts(page)).toEqual(previewFacts);
    if (preview === 'time') {
      await expect(clockControl(page, 'departure')).toHaveValue('990');
      await expect(action(page, 'Apply time change')).toBeEnabled();
      if (resolution === 'apply') {
        await applyTimeChange(page);
        await action(page, 'Keep full Shenzhen evening').click();
        await expectStage(page, 'revised');
      } else {
        await action(page, 'Cancel time preview').click();
        await expectStage(page, 'baseline');
        await expectAcceptedFacts(page, 'baseline');
      }
    } else {
      await expect(action(page, 'Choose shorter Shenzhen walk')).toBeEnabled();
      if (resolution === 'apply') {
        await action(page, 'Choose shorter Shenzhen walk').click();
        await expectStage(page, 'revised');
        await expectAcceptedFacts(page, 'revised', true);
      } else {
        await action(page, 'Cancel preview').click();
        await expectStage(page, 'changed');
        await expectAcceptedFacts(page, 'changed');
        await action(page, 'Keep full Shenzhen evening').click();
      }
    }
    await action(page, 'Put down phone').click();
    await action(page, 'Board for Lo Wu').click();
    await expect(journey).toHaveAttribute('data-phase', 'arrived');
    await expect(journey).toHaveAttribute('data-committed-arrival', preview === 'time' && resolution === 'apply' ? '1095' : '1125');
  });
}

test('historical Before inspection cannot replace the current physical choice before departure', async ({ page }) => {
  await startFresh(page);
  await chooseBaseline(page, 'Shenzhen', 'My historical Shenzhen reason.');
  await beginTimePreview(page, 'departure');
  await clockControl(page, 'departure').selectOption('990');
  await applyTimeChange(page);
  await action(page, 'Keep full Hong Kong evening').click();
  const revised = await readInputFacts(page);
  await replay(page, 'baseline');
  await expectStage(page, 'revised', 'baseline');
  await expectAcceptedFacts(page, 'baseline');
  await action(page, 'Put down phone').click();
  const journey = page.getByTestId('decision-journey');
  await expect(journey).toHaveAttribute('data-city', 'hk');
  await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '990');
  await action(page, 'Station entrance').click();
  await expect(action(page, 'Board for Lo Wu')).toHaveCount(0);
  await action(page, 'Counter').click();
  await action(page, 'Head to local dinner').click();
  await expect(journey).toHaveAttribute('data-phase', 'arrived');
  await expect(journey).toHaveAttribute('data-city', 'hk');
  await expect(journey).toHaveAttribute('data-committed-arrival', '1005');
  await openObject(page, 'phone');
  await expectStage(page, 'revised');
  expect(await readInputFacts(page)).toEqual(revised);
});

test('the portable cold world and unchanged baseline remain playable offline with reduced motion', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, offline: true, reducedMotion: 'reduce' });
  const attempted: string[] = [];
  context.on('request', request => { if (/^(https?|wss?):/i.test(request.url())) attempted.push(request.url()); });
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const tap = interaction(page, 'touch');
  try {
    await startAtWorld(page, pathToFileURL(resolve('artifacts/crossing-lives-decision-prototype.html')).href);
    await expectVisiblePerson(page);
    await tap(action(page, 'Station entrance'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-node', 'station');
    await expectVisiblePerson(page);
    for (const selector of ['.decision-journey-plane', '.decision-journey-player']) {
      expect(await page.locator(selector).evaluate(element => getComputedStyle(element).transitionDuration.split(',').map(Number.parseFloat))).toEqual([0]);
    }
    await tap(action(page, 'Choose an object'));
    await tap(action(page, 'Open map'));
    await expectAcceptedFacts(page, 'baseline');
    await tap(action(page, 'Start with Shenzhen'));
    await tap(action(page, 'Put down phone'));
    await tap(action(page, 'Board for Lo Wu'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'arrived');
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-art-status', 'ready');
    await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1125');
    await expect(experience(page)).toHaveAttribute('data-stage', 'baseline');
    await expectVisiblePerson(page);
    for (const image of await page.locator('.decision-journey-plane img').all()) await expect(image).toHaveAttribute('src', /^data:image\/webp;base64,/);
    expect(attempted, 'The cold world, movement, choice and arrival make no network requests.').toEqual([]);
    await audit.expectZero(page);
    await expectNoOverflow(page);
    await info.attach('offline-reduced-baseline-arrival', { body: await page.screenshot(), contentType: 'image/png' });
  } finally { await context.close(); }
});
