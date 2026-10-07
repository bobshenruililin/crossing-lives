import { test, expect } from '@playwright/test';
import {
  action, auditNoPrivateStorage, capture, changeDeadline, changedKeys, chooseBaseline,
  closeDisclosure, commitShortWalk, expectAcceptedFacts, expectNoOverflow, expectStage,
  experience, expectWorldAndCore, inspectCommonTimeline, openDisclosure, openObject, outcome, readInputFacts,
  readOutcomeFacts, readBills, reason, replay, startFresh,
} from './decision-helpers';

for (const width of [360, 390, 1440]) {
  test(`matched whole-evening loop, explicit priorities and immutable replay at ${width}px`, async ({ page, context }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    const audit = await auditNoPrivateStorage(context);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await startFresh(page);
    await expectAcceptedFacts(page, 'baseline');
    await expectWorldAndCore(page);
    await capture(page, info, 'baseline');
    await expect(experience(page)).toContainText(/authored|fictional|illustrative/i);
    const baselineInputs = await readInputFacts(page);
    expect(baselineInputs).toMatchObject({
      origin: 'kowloon', departureMinutes: '1020', homeByMinutes: '1410', budgetPerPersonHKD: '400', partySize: '2',
      mealMinutes: '90', walkMinutes: '45', fxHKDPerCNY: '1.09', szRoute: 'rail', entryEligibility: 'unsure',
    });
    await expect(experience(page)).toContainText(/two adults|2 adults/i);
    await expect(experience(page)).toContainText(/shared order/i);
    const baselineBills = await readBills(page);
    expect(baselineBills[0].groupTotal).toContain('672');
    expect(baselineBills[1].groupTotal).toContain('583.66');
    for (const bill of baselineBills) expect(bill.lines.length).toBeGreaterThanOrEqual(4);
    const baselineOutcomes = [await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')];
    const baselineTimeline = await inspectCommonTimeline(page);
    await closeDisclosure(page, 'Open the bill and assumptions');
    await openObject(page, 'phone');
    await expect(action(page, 'Change home-by time to 22:30'), 'The constraint action is unavailable before a tentative choice.').toHaveCount(0);
    await openObject(page, 'map');
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page), 'No reason exists before an explicit tentative choice.').toHaveValue('');
    await expect(reason(page)).not.toBeEditable();
    await action(page, 'Company').click();
    await action(page, 'Exploration').click();
    await expect(action(page, 'Company')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page, 'Exploration')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page, 'Food')).toHaveAttribute('aria-pressed', 'false');
    await expect(action(page, 'Comfort')).toHaveAttribute('aria-pressed', 'false');
    await expect(experience(page)).toContainText(/you selected/i);
    await expect(page.locator('.decision-priorities')).toContainText('You selected: Company, Exploration.');
    await expect(page.locator('.decision-priorities')).toContainText('Neither city receives a score.');
    await expect(reason(page), 'Selecting priorities never invents a reason.').toHaveValue('');
    if (width <= 390) {
      for (const label of ['Food', 'Company', 'Comfort', 'Exploration']) await expect(action(page, label)).toBeInViewport({ ratio: 1 });
      await capture(page, info, 'priorities');
    }
    await closeDisclosure(page, 'What matters to you?');
    expect([await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')], 'Explicit priorities do not re-rank or alter either modeled outing.').toEqual(baselineOutcomes);
    expect(await readInputFacts(page), 'Returning from the priority chooser preserves every comparison input.').toEqual(baselineInputs);
    expect(await readBills(page)).toEqual(baselineBills);
    await chooseBaseline(page, width === 1440 ? 'Hong Kong' : 'Shenzhen', 'I want the full walk with our dinner.');
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page)).toHaveValue('I want the full walk with our dinner.');
    await closeDisclosure(page, 'What matters to you?');
    expect([await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')]).toEqual(baselineOutcomes);
    await expectWorldAndCore(page);
    await expectNoOverflow(page);
    await audit.expectZero(page);

    await changeDeadline(page);
    await expectAcceptedFacts(page, 'changed');
    await expectWorldAndCore(page);
    await capture(page, info, 'earlier-deadline');
    const changedInputs = await readInputFacts(page);
    expect(changedKeys(baselineInputs, changedInputs), 'Earlier deadline changes exactly one authored input.').toEqual(['homeByMinutes']);
    expect(changedInputs.homeByMinutes).toBe('1350');
    expect(await readBills(page), 'Every native-currency line and both group bills stay unchanged.').toEqual(baselineBills);
    const changedOutcomes = [await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')];
    const changedTimeline = await inspectCommonTimeline(page);
    expect(changedTimeline.map(track => track.segments.map(({ id, start, end }) => ({ id, start, end })))).toEqual(
      baselineTimeline.map(track => track.segments.map(({ id, start, end }) => ({ id, start, end }))),
    );
    await expect(experience(page)).toContainText(/23:30\s*(?:→|to).*22:30|23:30.*22:30/s);
    await expect(experience(page)).toContainText(/cost(?:s)?(?:[, ]| and).*unchanged|cost(?:s)? stay|bills? (?:stay|unchanged)|same (?:cost|bill)|prices.*unchanged/i);
    await expect(experience(page)).toContainText(/(?:home|return) times?.*(?:stay|unchanged)|same (?:home|return) time/i);
    await expect(experience(page)).toContainText(/activit(?:y|ies).*unchanged|same activit|dinner.*walk.*unchanged|dinner.*walking.*unchanged/i);
    await closeDisclosure(page, 'Open the bill and assumptions');
    await expectNoOverflow(page);
    await audit.expectZero(page);

    await action(page, 'Preview a shorter Shenzhen walk').click();
    await expectStage(page, 'changed', 'revised', true);
    await expectAcceptedFacts(page, 'revised', true);
    await expect(experience(page)).toContainText(/45\s*(?:→|to)\s*15|45.*15.*minute/s);
    await expect(experience(page)).toContainText(/30\s*(?:min|minute).*(?:less|lost|give|sacrif)|(?:less|lose|sacrif|give up).*30\s*(?:min|minute)/i);
    const previewInputs = await readInputFacts(page);
    expect(changedKeys(changedInputs, previewInputs), 'Only Shenzhen walking time is sacrificed.').toEqual(['itineraryOverrides.sz.walkMinutes']);
    expect(previewInputs['itineraryOverrides.sz.walkMinutes']).toBe('15');
    await action(page, 'Cancel preview').click();
    await expectStage(page, 'changed');
    expect(await readInputFacts(page)).toEqual(changedInputs);
    expect([await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')]).toEqual(changedOutcomes);

    await commitShortWalk(page);
    await expectAcceptedFacts(page, 'revised', true);
    await expectWorldAndCore(page);
    await capture(page, info, 'revised');
    const revisedInputs = await readInputFacts(page);
    expect(revisedInputs).toEqual(previewInputs);
    expect(await readBills(page), 'Shortening only the walk does not silently change either bill.').toEqual(baselineBills);
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page), 'No unstated reason is inferred from the chosen revision.').toHaveValue('');
    await reason(page).fill('I accept 30 minutes less walking to get home earlier.');
    await expect(action(page, 'Company')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page, 'Exploration')).toHaveAttribute('aria-pressed', 'true');
    for (const label of ['Food', 'Company', 'Comfort', 'Exploration']) await expect(action(page, label)).toBeDisabled();
    await closeDisclosure(page, 'What matters to you?');
    const revisedOutcomes = [await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')];
    const revisedTimeline = await inspectCommonTimeline(page);
    const revisedSegments = revisedTimeline.map(track => track.segments.map(({ id, start, end }) => ({ id, start, end })));
    await closeDisclosure(page, 'Open the bill and assumptions');
    await expectNoOverflow(page);
    await audit.expectZero(page);
    await closeDisclosure(page, 'Unfold the evening');

    // Real replay controls revisit exact historical facts and explicit user text.
    // No UI state injection and no recomputation from the current revision.
    for (let pass = 0; pass < 2; pass += 1) {
      await replay(page, 'baseline');
      await expectStage(page, 'revised', 'baseline');
      await expectWorldAndCore(page);
      if (!pass) await capture(page, info, 'replay');
      expect(await readInputFacts(page)).toEqual(baselineInputs);
      expect(await readBills(page)).toEqual(baselineBills);
      expect([await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')]).toEqual(baselineOutcomes);
      await openDisclosure(page, 'What matters to you?');
      await expect(reason(page)).toHaveValue('I want the full walk with our dinner.');
      await expect(reason(page)).not.toBeEditable();
      await expect(action(page, 'Company')).toHaveAttribute('aria-pressed', 'true');
      await expect(action(page, 'Exploration')).toHaveAttribute('aria-pressed', 'true');
      await closeDisclosure(page, 'What matters to you?');
      await replay(page, 'changed');
      expect(await readInputFacts(page)).toEqual(changedInputs);
      expect([await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')]).toEqual(changedOutcomes);
      await action(page, 'Return to current decision').click();
      await expectStage(page, 'revised');
      expect(await readInputFacts(page)).toEqual(revisedInputs);
      expect(await readBills(page)).toEqual(baselineBills);
      expect([await readOutcomeFacts(page, 'HK'), await readOutcomeFacts(page, 'SZ')]).toEqual(revisedOutcomes);
      expect((await inspectCommonTimeline(page)).map(track => track.segments.map(({ id, start, end }) => ({ id, start, end })))).toEqual(revisedSegments);
      await openDisclosure(page, 'What matters to you?');
      await expect(reason(page)).toHaveValue('I accept 30 minutes less walking to get home earlier.');
      await closeDisclosure(page, 'What matters to you?');
    }
    await replay(page, 'revised');
    await expectStage(page, 'revised');
    await expectNoOverflow(page);
    await audit.expectZero(page);
    expect(errors).toEqual([]);
    await page.reload();
    await expectStage(page, 'baseline');
    await openObject(page, 'phone');
    await expect(action(page, 'Change home-by time to 22:30'), 'The constraint action is unavailable before a tentative choice.').toHaveCount(0);
    await expect(experience(page)).not.toContainText('I accept 30 minutes less walking');
    await expectAcceptedFacts(page, 'baseline');
    await audit.expectZero(page);
  });
}

test('keeping Hong Kong is a valid reconsideration without a forced choice flip', async ({ page, context }) => {
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  const original = await readInputFacts(page);
  await chooseBaseline(page, 'Hong Kong', 'We prefer keeping the full evening nearby.');
  await changeDeadline(page);
  const changed = await readInputFacts(page);
  await action(page, 'Keep full Hong Kong evening').click();
  await expectStage(page, 'revised');
  await expectAcceptedFacts(page, 'revised');
  expect(await readInputFacts(page)).toEqual(changed);
  await expect(experience(page)).toContainText(/You kept Hong Kong|Hong Kong.*still.*choice/i);
  await expect(experience(page)).not.toContainText(/you changed your mind|you switched to|you now prefer/i);
  await openDisclosure(page, 'What matters to you?');
  await expect(reason(page), 'Keeping an option does not invent a reason.').toHaveValue('');
  await reason(page).fill('Keeping the full walk matters more to us.');
  await replay(page, 'baseline');
  expect(await readInputFacts(page)).toEqual(original);
  await openDisclosure(page, 'What matters to you?');
  await expect(reason(page)).toHaveValue('We prefer keeping the full evening nearby.');
  await closeDisclosure(page, 'What matters to you?');
  await action(page, 'Return to current decision').click();
  await openDisclosure(page, 'What matters to you?');
  await expect(reason(page)).toHaveValue('Keeping the full walk matters more to us.');
  await closeDisclosure(page, 'What matters to you?');
  await expect(outcome(page, 'SZ')).toContainText('22:45');
  await audit.expectZero(page);
});
