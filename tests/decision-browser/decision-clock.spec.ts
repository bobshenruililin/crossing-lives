import { test, expect } from '@playwright/test';
import {
  action, applyTimeChange, auditNoPrivateStorage, beginTimePreview, capture, changedKeys, chooseBaseline,
  clockControl, closeDisclosure, expectAcceptedFacts, expectKeyboardFocusVisible, expectNoOverflow,
  expectStage, expectTimeFacts, expectWorldAndCore, experience, inspectCommonTimeline, openDisclosure,
  outcome, previewTime, readBills, readCoreGeometry, readInputFacts, reason, replay, startFresh,
} from './decision-helpers';

for (const width of [360, 390]) {
  test(`16:30 departure shifts both complete journeys and keeps the full Shenzhen walk at ${width}px`, async ({ page, context }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const audit = await auditNoPrivateStorage(context);
    await startFresh(page);
    const baselineInputs = await readInputFacts(page);
    const bills = await readBills(page);
    await chooseBaseline(page, 'Shenzhen', 'We want the full dinner and walk together.');
    await beginTimePreview(page, 'departure');
    await expect(clockControl(page, 'departure')).toHaveValue('1020');
    await expect(action(page, 'Apply time change')).toBeDisabled();
    await expectStage(page, 'baseline', 'baseline', true);
    await expectWorldAndCore(page);
    const before = await readCoreGeometry(page);
    await clockControl(page, 'departure').selectOption('990');
    await expectStage(page, 'baseline', 'changed', true);
    await expect(experience(page)).toHaveAttribute('data-preview-kind', 'time');
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await expectWorldAndCore(page);
    const deltaPixels = before.tracks[0].width * -30 / 660;
    await expect.poll(async () => (await readCoreGeometry(page)).tracks[0].segments[0].x - before.tracks[0].segments[0].x).toBeCloseTo(deltaPixels, 0);
    const shifted = await readCoreGeometry(page);
    expect(shifted.marker).toEqual(before.marker);
    for (let city = 0; city < 2; city += 1) {
      expect(shifted.tracks[city].segments).toHaveLength(before.tracks[city].segments.length);
      for (let index = 0; index < before.tracks[city].segments.length; index += 1) {
        const original = before.tracks[city].segments[index], after = shifted.tracks[city].segments[index];
        expect(Number(after.start) - Number(original.start)).toBe(-30);
        expect(Number(after.end) - Number(original.end)).toBe(-30);
        expect(after.id).toBe(original.id);
        expect(Math.abs(after.width - original.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(after.x - original.x - deltaPixels)).toBeLessThanOrEqual(2);
      }
    }
    const previewInputs = await readInputFacts(page);
    expect(changedKeys(baselineInputs, previewInputs)).toEqual(['departureMinutes']);
    expect(previewInputs.departureMinutes).toBe('990');
    expect(await readBills(page)).toEqual(bills);
    await expectStage(page, 'baseline', 'changed', true); // Menu/Back did not commit the preview.
    await applyTimeChange(page);
    await expect(action(page, 'Change departure')).toHaveCount(0);
    await expect(action(page, 'Change home-by')).toHaveCount(0);
    await expect(page.getByTestId('decision-time-editor')).toHaveCount(0);
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await expectWorldAndCore(page);
    await capture(page, info, 'earlier-departure');
    await expect(action(page, 'Keep full Hong Kong evening')).toBeInViewport({ ratio: 1 });
    await expect(action(page, 'Keep full Shenzhen evening')).toBeInViewport({ ratio: 1 });
    await action(page, 'Keep full Shenzhen evening').click();
    await expectStage(page, 'revised');
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await expect(outcome(page, 'SZ')).toContainText('75 min modeled slack');
    expect(await readInputFacts(page)).toEqual(previewInputs);
    expect(await readBills(page)).toEqual(bills);
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page), 'Keeping the full plan does not invent a reason.').toHaveValue('');
    await reason(page).fill('We started earlier so we could keep all 45 minutes of walking.');
    await closeDisclosure(page, 'What matters to you?');
    await inspectCommonTimeline(page);
    await replay(page, 'baseline');
    expect(await readInputFacts(page)).toEqual(baselineInputs);
    await expectAcceptedFacts(page, 'baseline');
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page)).toHaveValue('We want the full dinner and walk together.');
    await expect(reason(page)).not.toBeEditable();
    await closeDisclosure(page, 'What matters to you?');
    await replay(page, 'changed');
    expect(await readInputFacts(page)).toEqual(previewInputs);
    await action(page, 'Return to current decision').click();
    await expectTimeFacts(page, { departure: 990, deadline: 1410, hkHome: 1155, szHome: 1335 });
    await openDisclosure(page, 'What matters to you?');
    await expect(reason(page), 'The exact revised reason survives baseline replay and return.').toHaveValue('We started earlier so we could keep all 45 minutes of walking.');
    await closeDisclosure(page, 'What matters to you?');
    await expectWorldAndCore(page);
    await audit.expectZero(page);
  });
}

test('clock boundaries, keyboard steps and changing fields never combine or commit drafts', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  const baseline = await readInputFacts(page);
  await chooseBaseline(page, 'Hong Kong');
  await beginTimePreview(page, 'departure');
  expect(await clockControl(page, 'departure').locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value)))
    .toEqual(Array.from({ length: 21 }, (_, index) => String(900 + index * 15)));
  await clockControl(page, 'departure').selectOption('900');
  await expect(action(page, '15 minutes earlier')).toBeDisabled();
  await expect(action(page, '15 minutes later')).toBeEnabled();
  await expectTimeFacts(page, { departure: 900, deadline: 1410, hkHome: 1065, szHome: 1245 });
  await expectWorldAndCore(page);
  await clockControl(page, 'departure').selectOption('1200');
  await expect(action(page, '15 minutes later')).toBeDisabled();
  await expectTimeFacts(page, { departure: 1200, deadline: 1410, hkHome: 1365, szHome: 1545 });
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-crossing-fit', 'false');
  await expectWorldAndCore(page);
  await action(page, 'Choose another circumstance').click();
  await expectStage(page, 'baseline');
  expect(await readInputFacts(page)).toEqual(baseline);
  await beginTimePreview(page, 'homeBy');
  await expect(clockControl(page, 'homeBy')).toHaveValue('1410');
  await expect(action(page, 'Apply time change')).toBeDisabled();
  expect(await clockControl(page, 'homeBy').locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value)))
    .toEqual(Array.from({ length: 21 }, (_, index) => String(1200 + index * 15)));
  await clockControl(page, 'homeBy').selectOption('1200');
  await expect(action(page, '15 minutes earlier')).toBeDisabled();
  await expectTimeFacts(page, { departure: 1020, deadline: 1200, hkHome: 1185, szHome: 1365 });
  await expect(page.getByTestId('decision-deadline-marker')).toHaveAttribute('data-deadline-minute', '1200');
  await expect(outcome(page, 'HK')).toHaveAttribute('data-home-fit', 'true');
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-home-fit', 'false');
  await expect(outcome(page, 'SZ')).toContainText('165 min late');
  await expectWorldAndCore(page); // Includes the visible 20:00 home-by context.
  await clockControl(page, 'homeBy').selectOption('1500');
  await expect(action(page, '15 minutes later')).toBeDisabled();
  await expect(clockControl(page, 'homeBy').locator('option:checked')).toHaveText('01:00 next day');
  await expectTimeFacts(page, { departure: 1020, deadline: 1500, hkHome: 1185, szHome: 1365 });
  await expectWorldAndCore(page);
  const homeDraft = await readInputFacts(page);
  expect(changedKeys(baseline, homeDraft)).toEqual(['homeByMinutes']);
  expect(homeDraft.departureMinutes).toBe('1020');
  await expect(clockControl(page, 'homeBy')).toHaveValue('1500');
  await capture(page, info, 'time-preview');
  await action(page, 'Cancel time preview').press('Enter');
  await expectStage(page, 'baseline');
  await expect(page.locator('#decision-sheet-heading')).toBeFocused();
  await expectKeyboardFocusVisible(page);
  expect(await readInputFacts(page)).toEqual(baseline);
  await beginTimePreview(page, 'homeBy');
  await clockControl(page, 'homeBy').press('ArrowUp');
  await expect(clockControl(page, 'homeBy')).toHaveValue('1395');
  await clockControl(page, 'homeBy').press('ArrowDown');
  await expect(clockControl(page, 'homeBy')).toHaveValue('1410');
  await expect(action(page, 'Apply time change')).toBeDisabled();
  await action(page, '15 minutes later').press('Enter');
  await expect(clockControl(page, 'homeBy')).toHaveValue('1425');
  await expectWorldAndCore(page);
  await action(page, 'Cancel time preview').press('Enter');
  expect(await readInputFacts(page)).toEqual(baseline);
  await expectAcceptedFacts(page, 'baseline');
  await expectNoOverflow(page);
  await audit.expectZero(page);
});

test('late departure distinguishes home lateness from the border closing buffer and never auto-repairs', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const audit = await auditNoPrivateStorage(context);
  await startFresh(page);
  const baseline = await readInputFacts(page), bills = await readBills(page);
  await chooseBaseline(page, 'Shenzhen');
  await previewTime(page, 'departure', 1140);
  await expectTimeFacts(page, { departure: 1140, deadline: 1410, hkHome: 1305, szHome: 1485 });
  await applyTimeChange(page);
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-home-fit', 'false');
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-crossing-fit', 'false');
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-entry-fit', 'unknown');
  await expect(outcome(page, 'SZ').locator('.decision-lane-facts')).toContainText('75 min late');
  await expect(page.getByTestId('decision-border-SZ')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('decision-border-SZ')).toContainText('Crossing: no fit');
  await expect(page.getByTestId('decision-border-SZ')).toHaveAttribute('aria-label', /window.*buffer/i);
  await expect(experience(page)).not.toContainText(/border (?:is )?closed/i);
  await expectWorldAndCore(page);
  await capture(page, info, 'late-departure');
  const changed = await readInputFacts(page);
  expect(changedKeys(baseline, changed)).toEqual(['departureMinutes']);
  expect(await readBills(page)).toEqual(bills);
  await openDisclosure(page, 'Unfold the evening');
  await action(page, 'Shenzhen route').click();
  await expect(page.locator('.decision-route-legs li').filter({ hasText: 'Return clearance allowance' })).toContainText('23:25–23:55');
  await expect(page.getByTestId('decision-crossing-detail')).toContainText('Normal published hours: 06:30–00:00');
  await expect(page.getByTestId('decision-crossing-detail')).toContainText('Chosen closing buffer: 15 min');
  await expect(page.getByTestId('decision-crossing-detail')).toContainText('not a claim that the border is already closed');
  await closeDisclosure(page, 'Unfold the evening');
  await action(page, 'Preview a shorter Shenzhen walk').click();
  await expectTimeFacts(page, { departure: 1140, deadline: 1410, hkHome: 1305, szHome: 1455, szWalk: 15 });
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-home-fit', 'false');
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-crossing-fit', 'true');
  await expect(outcome(page, 'SZ')).toContainText('45 min late');
  await expect(page.getByTestId('decision-feedback')).toContainText('45 min past home-by');
  await expectWorldAndCore(page);
  await action(page, 'Cancel preview').click();
  expect(await readInputFacts(page)).toEqual(changed);
  await action(page, 'Keep full Shenzhen evening').click();
  await expectStage(page, 'revised');
  await expectTimeFacts(page, { departure: 1140, deadline: 1410, hkHome: 1305, szHome: 1485 });
  await expect(outcome(page, 'SZ')).toHaveAttribute('data-crossing-fit', 'false');
  await expect(page.getByTestId('decision-choice-status')).toContainText('75 min past home-by');
  await expect(page.getByTestId('decision-choice-status')).toContainText('Modeled crossing window or closing buffer not met');
  await expectWorldAndCore(page);
  await audit.expectZero(page);
});
