import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { action, auditNoPrivateStorage, clockControl, expectNoOverflow, experience, openObject, startFresh } from './decision-helpers';
import {
  arriveFromSource, captureFriend, confirmFriendChoice, currentFriend, expectFriendGeometry, expectInvitation,
  expectPartyFacts, expectPayoff, friend, friendAction, friendDetail, inspectFriendBill, inspectFriendComparison, inspectFriendSprite, interaction, newReason, openInvitation, ownReason,
  prepareSource, readFriendOutcomes, readFriendTracks, readSourceState, reconsider, returnToArrival, sourceReason,
  typeReason,
} from './decision-friend-helpers';

for (const [width, mode] of [[390, 'touch'], [1440, 'keyboard']] as const) {
  test(`friend invitation preserves arrival through cancel, choice and replay with ${mode} at ${width}px`, async ({ browser, baseURL }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL, viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: mode === 'touch', reducedMotion: 'no-preference' });
    const audit = await auditNoPrivateStorage(context);
    const page = await context.newPage();
    const activate = interaction(page, mode);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await prepareSource(page, activate, { mode });
      await arriveFromSource(page, activate);
      const source = await readSourceState(page);
      const journeyNode = await page.getByTestId('decision-journey').elementHandle();
      await openInvitation(page, activate);
      await expectInvitation(page);
      await expect(friend(page).getByTestId('friend-world-npc')).toHaveCount(0);
      await expectFriendGeometry(page);
      await captureFriend(page, info, 'invitation');
      await activate(friendAction(page, 'Map Compare this evening'));
      await expectPartyFacts(page, 2);
      const beforeOutcomes = await readFriendOutcomes(page);
      const beforeTracks = await readFriendTracks(page);
      const beforeBill = await inspectFriendBill(page, activate);
      expect(beforeBill.inputs.partySize).toBe('2');

      for (let repetition = 0; repetition < 2; repetition += 1) {
        await activate(friendAction(page, 'Preview three adults'));
        await expect(friend(page).getByTestId('friend-preview-state')).toContainText(/preview/i);
        await expectPayoff(page, true);
        expect((await inspectFriendComparison(page, activate, 3)).tracks, 'A party preview does not shift either modeled time track.').toEqual(beforeTracks);
        await expect(friendAction(page, 'Plan with three adults')).toBeEnabled();
        expect(await readSourceState(page), 'Even an active preview leaves the captured source untouched.').toEqual(source);
        const previewBill = await inspectFriendBill(page, activate);
        expect(previewBill.inputs).toEqual({ ...beforeBill.inputs, partySize: '3' });
        await activate(friendAction(page, 'Cancel preview'));
        await expectInvitation(page);
        await expect(friend(page).getByTestId('friend-world-npc')).toHaveCount(0);
        await activate(friendAction(page, 'Map Compare this evening'));
        expect(await readFriendOutcomes(page)).toEqual(beforeOutcomes);
        expect(await readFriendTracks(page)).toEqual(beforeTracks);
        expect(await inspectFriendBill(page, activate), 'Cancel restores the exact two-adult lines and inputs, repeatedly.').toEqual(beforeBill);
        expect(await readSourceState(page)).toEqual(source);
      }

      await activate(friendAction(page, 'Preview three adults'));
      await activate(friendAction(page, 'Plan with three adults'));
      await expectPayoff(page, false);
      await expect(friendAction(page, 'Choose Hong Kong for three')).toBeEnabled();
      await expect(friendAction(page, 'Choose Shenzhen for three')).toBeEnabled();
      await expect(friendAction(page, 'Replay two and three')).toHaveCount(0);
      await expect(friend(page)).toHaveAttribute('data-choice', 'none');
      await friendDetail(page, activate, 'Earlier choice and priorities');
      await expect(friend(page)).toContainText(sourceReason);
      await expect(friend(page)).toContainText('Exploration');
      await expect(friend(page)).toContainText(/earlier|historical/i);
      await currentFriend(page, activate);
      await confirmFriendChoice(page, activate, width === 390 ? 'Hong Kong' : 'Shenzhen', mode);
      await captureFriend(page, info, 'explicit-choice');
      await activate(friendAction(page, 'Replay two and three'));
      await activate(friendAction(page, 'Two adults'));
      await expectPartyFacts(page, 2);
      expect(await readFriendTracks(page)).toEqual(beforeTracks);
      const replayed = await readFriendOutcomes(page);
      await returnToArrival(page, activate);
      expect(await readSourceState(page)).toEqual(source);
      expect(await journeyNode!.evaluate(node => node.isConnected && node === document.querySelector('[data-testid="decision-journey"]')),
        'The original arrived journey stayed mounted; returning did not recreate it.').toBe(true);
      await openInvitation(page, activate);
      expect(await readFriendOutcomes(page), 'Returning and reopening preserves the new episode replay position.').toEqual(replayed);
      await activate(friendAction(page, 'Three adults'));
      await expectPartyFacts(page, 3);
      await activate(friendAction(page, 'Back to the three-adult choice'));
      await expect(friend(page).getByTestId('friend-choice-status')).toContainText(ownReason);
      await returnToArrival(page, activate);
      expect(await readSourceState(page)).toEqual(source);
      await expectNoOverflow(page);
      await audit.expectZero(page);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

for (const revision of ['earlier-departure', 'short-walk'] as const) {
  test(`friend captures current ${revision} while source replay and source bills remain exact`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const activate = interaction(page, 'pointer');
    await prepareSource(page, activate, { revision });
    await openObject(page, 'menu');
    const sourceBill = await experience(page).locator('.decision-bill-pair').innerText();
    await experience(page).locator('summary').filter({ hasText: 'Inputs used in this comparison' }).click();
    const sourceInputs = await experience(page).locator('[data-input-key]').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.getAttribute('data-input-key'), row.getAttribute('data-input-value')])));
    await action(page, 'Back to evening').click();
    await arriveFromSource(page, activate);
    await action(page, 'Open comparison and replay').click();
    await action(page, 'Replay the comparison').click();
    await action(page, 'Before').click();
    await action(page, 'Put down phone').click();
    await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', 'baseline');
    const before = await readSourceState(page);
    await openInvitation(page, activate);
    await activate(friendAction(page, 'Map Compare this evening'));
    const expected = { departure: revision === 'earlier-departure' ? 990 : 1020, deadline: revision === 'earlier-departure' ? 1410 : 1350, szWalk: revision === 'short-walk' ? 15 : 45 };
    await expectPartyFacts(page, 2, expected);
    const tracks = await readFriendTracks(page);
    const captured = await inspectFriendBill(page, activate);
    expect(captured.inputs).toEqual(sourceInputs);
    await activate(friendAction(page, 'Preview three adults'));
    await expectPayoff(page, true);
    expect((await inspectFriendComparison(page, activate, 3, expected)).tracks).toEqual(tracks);
    await activate(friendAction(page, 'Plan with three adults'));
    await confirmFriendChoice(page, activate, 'Shenzhen');
    await returnToArrival(page, activate);
    expect(await readSourceState(page), 'Source Before replay position is preserved even though friend captured the current revised plan.').toEqual(before);
    await action(page, 'Inspect the full outing bill').click();
    await expect(experience(page)).toHaveAttribute('data-displayed-snapshot', 'revised');
    expect(await experience(page).locator('.decision-bill-pair').innerText()).toEqual(sourceBill);
    await experience(page).locator('summary').filter({ hasText: 'Inputs used in this comparison' }).click();
    expect(await experience(page).locator('[data-input-key]').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.getAttribute('data-input-key'), row.getAttribute('data-input-value')])))).toEqual(sourceInputs);
    await action(page, 'Back to evening').click();
    await action(page, 'What matters to you?').click();
    await expect(experience(page).getByRole('textbox', { name: 'Your reason (optional)', exact: true })).toHaveValue(sourceReason);
    await expect(experience(page).getByRole('button', { name: 'Exploration', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(experience(page).getByRole('button', { name: 'Company', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });
}

test('friend bill changes only per-adult charges and keeps ONE shared extra with exact converted rounding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const activate = interaction(page, 'pointer');
  await prepareSource(page, activate);
  await arriveFromSource(page, activate);
  await openInvitation(page, activate);
  const before = await inspectFriendBill(page, activate);
  await activate(friendAction(page, 'Preview three adults'));
  const preview = await inspectFriendBill(page, activate);
  expect(preview.inputs).toEqual({ ...before.inputs, partySize: '3' });
  const expected = [
    ['hk-dinner', 'HKD', 'per-person', '1', '496', '496', '744', '744'],
    ['hk-drinks', 'HKD', 'per-person', '1', '64', '64', '96', '96'],
    ['hk-shared', 'HKD', 'group', '1', '64', '64', '64', '64'],
    ['hk-transport', 'HKD', 'per-person', '2', '48', '48', '72', '72'],
    ['sz-dinner', 'CNY', 'per-person', '1', '256', '279.04', '384', '418.56'],
    ['sz-drinks', 'CNY', 'per-person', '1', '36', '39.24', '54', '58.86'],
    ['sz-shared', 'CNY', 'group', '1', '58', '63.22', '58', '63.22'],
    ['sz-cross-border', 'HKD', 'per-person', '2', '176', '176', '264', '264'],
    ['sz-local-transport', 'CNY', 'per-person', '2', '24', '26.16', '36', '39.24'],
  ];
  for (const [id, currency, scope, quantity, nativeBefore, hkdBefore, nativeAfter, hkdAfter] of expected) {
    const prior = before.lines.find(line => line.id === id)!;
    const after = preview.lines.find(line => line.id === id)!;
    expect(prior).toMatchObject({ id, currency, scope, quantity, native: nativeBefore, hkd: hkdBefore });
    expect(after).toMatchObject({ id, currency, scope, quantity, native: nativeAfter, hkd: hkdAfter });
    if (scope === 'group') {
      expect(after, 'Exactly one unchanged shared group charge, including its readable description.').toEqual(prior);
      expect(after.text).toMatch(/1 × fixed shared extra/i);
    }
  }
  expect(preview.text).toContain('843.88');
  expect(preview.text).toContain('281.29');
  expect(preview.text).toContain('976');
  expect(preview.text).toContain('325.33');
  expect(preview.text).toMatch(/averages round separately/i);
  await activate(friendAction(page, 'Plan with three adults'));
  expect(await inspectFriendBill(page, activate)).toEqual(preview);
  await activate(friendAction(page, 'Choose Hong Kong for three'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Priorities: not reconfirmed.');
  await activate(friendAction(page, 'What matters this time?'));
  await expect(newReason(page)).toHaveValue('');
  await expect(reconsider(page)).not.toBeChecked();
  await expect(friendAction(page, 'Keep this reflection')).toBeEnabled();
  await activate(friendAction(page, 'Keep this reflection'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Priorities: not reconfirmed.');
  await activate(friendAction(page, 'What matters this time?'));
  await newReason(page).fill('   ');
  await expect(friendAction(page, 'Keep this reflection')).toBeEnabled();
  await activate(friendAction(page, 'Keep this reflection'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
  await activate(friendAction(page, 'What matters this time?'));
  await activate(friendAction(page, 'Company'));
  await newReason(page).fill('I chose the nearby dinner this time.');
  await expect(reconsider(page)).not.toBeChecked();
  await expect(friendAction(page, 'Keep this reflection')).toBeEnabled();
  await activate(friendAction(page, 'Keep this reflection'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('I chose the nearby dinner this time.');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Priorities: not reconfirmed.');
  await activate(friendAction(page, 'What matters this time?'));
  await reconsider(page).check();
  await activate(friendAction(page, 'Keep this reflection'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Priorities reconsidered: Company.');
});

for (const width of [360, 390, 1440]) {
  test(`friend first views remain usable and produce review screenshots at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const activate = interaction(page, 'pointer');
    await prepareSource(page, activate, { city: 'Hong Kong' });
    await arriveFromSource(page, activate, 'Hong Kong');
    await openInvitation(page, activate);
    await expectInvitation(page);
    await expectFriendGeometry(page);
    await expect(friendAction(page, 'Preview three adults')).toBeInViewport({ ratio: 1 });
    await captureFriend(page, info, 'invitation');
    await activate(friendAction(page, 'Preview three adults'));
    await expectPayoff(page, true);
    await expectFriendGeometry(page);
    for (const label of ['Plan with three adults', 'Cancel preview']) await expect(friendAction(page, label)).toBeInViewport({ ratio: 1 });
    await inspectFriendSprite(page, info);
    await captureFriend(page, info, 'preview');
    await activate(friendAction(page, 'Plan with three adults'));
    await expectFriendGeometry(page);
    await captureFriend(page, info, 'comparison');
    await activate(friendAction(page, 'Choose Shenzhen for three'));
    await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
    await captureFriend(page, info, 'effortless-choice');
    await activate(friendAction(page, 'What matters this time?'));
    await expect(newReason(page)).toHaveValue('');
    await expectFriendGeometry(page);
    await captureFriend(page, info, 'new-reason');
    await activate(friendAction(page, 'Company'));
    await typeReason(page, newReason(page), ownReason, 'pointer');
    await reconsider(page).check();
    await activate(friendAction(page, 'Keep this reflection'));
    await expectFriendGeometry(page);
    await captureFriend(page, info, 'payoff');
    await activate(friendAction(page, 'Replay two and three'));
    await activate(friendAction(page, 'Two adults'));
    await expectPartyFacts(page, 2);
    await captureFriend(page, info, 'two-adult-replay');
    await activate(friendAction(page, 'Three adults'));
    await expectPartyFacts(page, 3);
    await expect(friend(page).getByTestId('friend-world-npc')).toHaveAttribute('data-art-status', 'ready');
    await captureFriend(page, info, 'three-adult-replay');
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')), 'No serious or critical violations; no exclusions or disabled rules.').toEqual([]);
    const art = friend(page).locator('img.decision-world-image');
    await expect(art).toBeVisible();
    expect(await art.evaluate(async (image: HTMLImageElement) => { await image.decode(); return [image.naturalWidth, image.naturalHeight]; })).toEqual([1672, 941]);
    await expect(art).toHaveAttribute('src', /decision-hk-pixel\.webp$/);
    await returnToArrival(page, activate);
    await expectNoOverflow(page);
  });
}


test('friend preview keeps an inherited late return and failed crossing buffer visible before either commitment', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const activate = interaction(page, 'pointer');
  await startFresh(page);
  await action(page, 'Start with Shenzhen').click();
  await action(page, 'Change departure').click();
  for (let step = 0; step < 8; step += 1) await action(page, '15 minutes later').click();
  await expect(clockControl(page, 'departure')).toHaveValue('1140');
  await action(page, 'Apply time change').click();
  await action(page, 'Keep full Shenzhen evening').click();
  await arriveFromSource(page, activate);
  const original = await readSourceState(page);
  await openInvitation(page, activate);
  await activate(friendAction(page, 'Preview three adults'));
  await expectPayoff(page, true);
  const warning = friend(page).getByTestId('friend-constraint-SZ');
  const verifyWarning = async () => {
    await expect(warning).toBeVisible();
    await expect(warning).toBeInViewport({ ratio: 1 });
    await expect(warning).toHaveAttribute('data-home-fit', 'false');
    await expect(warning).toHaveAttribute('data-crossing-fit', 'false');
    await expect(warning).toContainText('75 min past home-by.');
    await expect(warning).toContainText('Modeled crossing window or closing buffer not met.');
    await expect(friend(page).getByTestId('friend-constraint-HK')).toHaveCount(0);
    const ordering = await warning.evaluate(element => {
      const warningBox = element.getBoundingClientRect();
      const footer = element.closest('.friend-sheet-footer')!;
      const action = footer.querySelector('.decision-primary, .decision-choice')!.getBoundingClientRect();
      return { warningBottom: warningBox.bottom, actionTop: action.top };
    });
    expect(ordering.warningBottom).toBeLessThanOrEqual(ordering.actionTop);
  };
  await verifyWarning();
  await expect(friendAction(page, 'Plan with three adults')).toBeInViewport({ ratio: 1 });
  await captureFriend(page, info, 'late-source-preview');
  const previewAxe = await new AxeBuilder({ page }).analyze();
  expect(previewAxe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')), 'The mounted preview warning has no serious/critical accessibility findings.').toEqual([]);
  await activate(friendAction(page, 'Cancel preview'));
  await expectInvitation(page);
  await activate(friendAction(page, 'Preview three adults'));
  await verifyWarning();
  await activate(friendAction(page, 'Plan with three adults'));
  await expectPayoff(page, false);
  await verifyWarning();
  await expect(friendAction(page, 'Choose Shenzhen for three')).toBeInViewport({ ratio: 1 });
  await captureFriend(page, info, 'late-source-city-choice');
  const choiceAxe = await new AxeBuilder({ page }).analyze();
  expect(choiceAxe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')), 'The mounted city-choice warning has no serious/critical accessibility findings.').toEqual([]);
  await activate(friendAction(page, 'Map Compare this evening'));
  await expectPartyFacts(page, 3, { departure: 1140, deadline: 1410 });
  await expect(friend(page).getByTestId('friend-outcome-SZ')).toHaveAttribute('data-home-fit', 'false');
  await expect(friend(page).getByTestId('friend-outcome-SZ')).toHaveAttribute('data-crossing-fit', 'false');
  await currentFriend(page, activate);
  await activate(friendAction(page, 'Choose Shenzhen for three'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('75 min past home-by.');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Modeled crossing window or closing buffer not met.');
  await returnToArrival(page, activate);
  expect(await readSourceState(page)).toEqual(original);
});


test('the friend invitation also captures an unchanged baseline after immediate departure', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const activate = interaction(page, 'pointer');
  await prepareSource(page, activate, { revision: 'baseline' });
  await arriveFromSource(page, activate);
  await expect(experience(page)).toHaveAttribute('data-stage', 'baseline');
  await expect(page.getByTestId('decision-journey-clock')).toHaveAttribute('data-minute', '1125');
  const original = await readSourceState(page);
  await openInvitation(page, activate);
  await expectInvitation(page);
  await activate(friendAction(page, 'Map Compare this evening'));
  await expectPartyFacts(page, 2, { departure: 1020, deadline: 1410 });
  await currentFriend(page, activate);
  await friendDetail(page, activate, 'Earlier choice and priorities');
  await expect(friend(page)).toContainText('My starting reason belongs to the earlier outing.');
  await currentFriend(page, activate);
  await activate(friendAction(page, 'Preview three adults'));
  await expectPayoff(page, true);
  await activate(friendAction(page, 'Plan with three adults'));
  await activate(friendAction(page, 'Map Compare this evening'));
  await expectPartyFacts(page, 3, { departure: 1020, deadline: 1410 });
  await currentFriend(page, activate);
  await activate(friendAction(page, 'Choose Hong Kong for three'));
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
  await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Priorities: not reconfirmed.');
  await returnToArrival(page, activate);
  expect(await readSourceState(page)).toEqual(original);
});
