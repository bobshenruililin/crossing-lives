import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { auditNoPrivateStorage, expectNoOverflow, expectStage } from './decision-helpers';
import {
  arriveFromSource, captureFriend, confirmFriendChoice, expectFriendGeometry, expectInvitation, expectPartyFacts,
  expectPayoff, friend, friendAction, inspectFriendBill, interaction, newReason, openInvitation, ownReason,
  prepareSource, readSourceState, reconsider, returnToArrival,
} from './decision-friend-helpers';

test('friend invitation survives return during preview and a draft; switching city clears only the optional reflection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const activate = interaction(page, 'pointer');
  await prepareSource(page, activate);
  await arriveFromSource(page, activate);
  const source = await readSourceState(page);
  await openInvitation(page, activate);
  const before = await inspectFriendBill(page, activate);
  await activate(friendAction(page, 'Preview three adults'));
  await expectPayoff(page, true);
  await returnToArrival(page, activate);
  expect(await readSourceState(page)).toEqual(source);
  await openInvitation(page, activate);
  await expectPayoff(page, true);
  await activate(friendAction(page, 'Cancel preview'));
  await expectInvitation(page);
  expect(await inspectFriendBill(page, activate)).toEqual(before);
  await activate(friendAction(page, 'Preview three adults'));
  await activate(friendAction(page, 'Plan with three adults'));
  await activate(friendAction(page, 'Choose Hong Kong for three'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
  await activate(friendAction(page, 'What matters this time?'));
  await activate(friendAction(page, 'Comfort'));
  await reconsider(page).check();
  await newReason(page).fill('A draft for the local option.');
  await returnToArrival(page, activate);
  expect(await readSourceState(page)).toEqual(source);
  await openInvitation(page, activate);
  await expect(friend(page)).toHaveAttribute('data-stage', 'choice');
  await expect(newReason(page)).toHaveValue('A draft for the local option.');
  await expect(friendAction(page, 'Comfort')).toHaveAttribute('aria-pressed', 'true');
  await expect(reconsider(page)).toBeChecked();
  await activate(friendAction(page, 'Reconsider the city'));
  await confirmFriendChoice(page, activate, 'Shenzhen');
  await returnToArrival(page, activate);
  expect(await readSourceState(page)).toEqual(source);
});

test('friend standalone artifact completes offline without network or persistent storage', async ({ browser }, info) => {
  const path = resolve('artifacts/crossing-lives-decision-prototype.html');
  await access(path);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true, reducedMotion: 'reduce' });
  const attempted: string[] = [];
  context.on('request', request => { if (/^(https?|wss?):/i.test(request.url())) attempted.push(request.url()); });
  await context.route(/^https?:\/\//, route => route.abort('internetdisconnected'));
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const activate = interaction(page, 'pointer');
  try {
    await prepareSource(page, activate, { url: pathToFileURL(path).href, revision: 'short-walk' });
    await arriveFromSource(page, activate);
    const source = await readSourceState(page);
    await openInvitation(page, activate);
    await expectInvitation(page);
    const image = friend(page).locator('img.decision-world-image');
    await expect(image).toHaveAttribute('src', /^data:image\/webp;base64,/);
    expect(await image.evaluate(async (element: HTMLImageElement) => { await element.decode(); return [element.naturalWidth, element.naturalHeight]; })).toEqual([1672, 941]);
    await activate(friendAction(page, 'Preview three adults'));
    await expectPayoff(page, true);
    await expect(friend(page).getByTestId('friend-world-npc')).toHaveAttribute('data-art-status', 'ready');
    await expect(friend(page).getByTestId('friend-world-npc').locator('img')).toHaveAttribute('src', /^data:image\/webp;base64,/);
    const bill = await inspectFriendBill(page, activate);
    expect(bill.inputs.partySize).toBe('3');
    expect(bill.inputs['itineraryOverrides.sz.walkMinutes']).toBe('15');
    await activate(friendAction(page, 'Plan with three adults'));
    await confirmFriendChoice(page, activate, 'Shenzhen');
    await activate(friendAction(page, 'Replay two and three'));
    await activate(friendAction(page, 'Two adults'));
    await expectPartyFacts(page, 2, { szWalk: 15 });
    await activate(friendAction(page, 'Three adults'));
    await expectPartyFacts(page, 3, { szWalk: 15 });
    await expect(friend(page).getByTestId('friend-world-npc')).toHaveAttribute('data-art-status', 'ready');
    await captureFriend(page, info, 'offline-replay');
    const externalAssets = await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
      return [
        ...[...document.images].map(image => image.currentSrc),
        ...[...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(script => script.src),
        ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(link => link.href),
      ].filter(url => !url.startsWith('data:'));
    });
    expect(externalAssets, 'The standalone friend episode has no adjacent image, script or style dependency.').toEqual([]);
    await returnToArrival(page, activate);
    expect(await readSourceState(page)).toEqual(source);
    await audit.expectZero(page);
    await expectNoOverflow(page);
    expect(attempted).toEqual([]);
    expect(errors).toEqual([]);
    await page.reload();
    await expectStage(page, 'baseline');
    await expect(friend(page)).toHaveCount(0);
    await audit.expectZero(page);
    expect(attempted).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('friend reduced motion and failed origin art retain named objects and the complete decision path', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/\/art\/decision-(?:hk-pixel|joining-friend)\.webp$/, route => route.abort('failed'));
  const activate = interaction(page, 'pointer');
  await prepareSource(page, activate);
  await arriveFromSource(page, activate);
  await openInvitation(page, activate);
  await expect(friend(page).locator('.decision-world-fallback')).toBeVisible();
  await expect(friend(page)).toContainText('The illustration couldn’t load.');
  await expectFriendGeometry(page);
  await captureFriend(page, info, 'art-fallback');
  await activate(friendAction(page, 'Phone Read the invitation'));
  await expect(friend(page)).toContainText('Can I join next time?');
  await activate(friendAction(page, 'Back to friend comparison'));
  await activate(friendAction(page, 'Preview three adults'));
  await expectPayoff(page, true);
  await expect(friend(page).getByTestId('friend-world-npc')).toHaveAttribute('data-art-status', 'fallback');
  await expect(friend(page).getByTestId('friend-world-npc').locator('svg')).toBeVisible();
  await captureFriend(page, info, 'friend-sprite-fallback');
  await inspectFriendBill(page, activate);
  await activate(friendAction(page, 'Plan with three adults'));
  await confirmFriendChoice(page, activate, 'Hong Kong');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText(ownReason);
  const motion = await friend(page).evaluate(element => ({
    requested: matchMedia('(prefers-reduced-motion: reduce)').matches,
    transitions: [...element.querySelectorAll('#friend-sheet, .decision-world-image, .decision-deadline-line, .decision-time-segment')]
      .flatMap(node => getComputedStyle(node).transitionDuration.split(',').map(value => Number.parseFloat(value))),
    running: element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running')
      .map(animation => Number(animation.effect?.getComputedTiming().duration ?? 0)),
  }));
  expect(motion.requested).toBe(true);
  expect(motion.transitions.every(duration => duration === 0)).toBe(true);
  expect(motion.running.filter(duration => duration > 0)).toEqual([]);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  await returnToArrival(page, activate);
  await expectNoOverflow(page);
});
