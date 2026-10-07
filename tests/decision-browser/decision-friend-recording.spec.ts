import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { action, auditNoPrivateStorage, clockControl, startFresh } from './decision-helpers';
import {
  captureFriend, expectInvitation, expectPartyFacts, expectPayoff, friend, friendAction, friendDetail,
  interaction, newReason, openInvitation, ownReason, readSourceState, reconsider, returnToArrival, sourceReason, typeReason,
} from './decision-friend-helpers';

/** Cold production entry and real touch/typing only. No state injection, art
 * prewarming, manual trace ownership, frame composition or omission of failed frames. */
test('record the real paced friend invitation, explicit three-adult choice and unchanged arrival at 390x844', async ({ browser, baseURL }, info) => {
  test.setTimeout(180_000);
  const commit = process.env.GITHUB_SHA ?? process.env.CROSSING_DECISION_COMMIT;
  expect(commit, 'The invitation film identifies the exact tested commit.').toMatch(/^[a-f0-9]{40}$/);
  const directory = resolve('artifacts/decision/friend');
  await mkdir(directory, { recursive: true });
  const canonicalVideo = resolve(directory, 'decision-friend-390x844.webm');
  const reportPath = resolve(directory, 'decision-friend-recording.json');
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ baseURL, viewport, hasTouch: true, reducedMotion: 'no-preference', recordVideo: { dir: info.outputPath('recording'), size: viewport } });
  const audit = await auditNoPrivateStorage(context);
  const page = await context.newPage();
  const video = page.video();
  const activate = interaction(page, 'touch');
  const started = Date.now();
  const actions: { action: string; requestedPauseMs: number; pauseStartMs: number; pauseEndMs: number; sourcePhase: string | null; sourceArrival: string | null; friendStage: string | null; friendParty: string | null; friendChoice: string | null; friendSnapshot: string | null; friendSurface: string | null }[] = [];
  let completed = false;
  const read = async (description: string, pauseMs: number) => {
    const pauseStartMs = Date.now() - started;
    await page.waitForTimeout(pauseMs); // Deliberate reading time, never a load/performance measurement.
    const journey = page.getByTestId('decision-journey');
    const hasJourney = await journey.count();
    const hasFriend = await friend(page).count();
    actions.push({ action: description, requestedPauseMs: pauseMs, pauseStartMs, pauseEndMs: Date.now() - started,
      sourcePhase: hasJourney ? await journey.getAttribute('data-phase') : null,
      sourceArrival: hasJourney ? await journey.getAttribute('data-committed-arrival') : null,
      friendStage: hasFriend ? await friend(page).getAttribute('data-stage') : null,
      friendParty: hasFriend ? await friend(page).getAttribute('data-party-size') : null,
      friendChoice: hasFriend ? await friend(page).getAttribute('data-choice') : null,
      friendSnapshot: hasFriend ? await friend(page).getAttribute('data-displayed-snapshot') : null,
      friendSurface: hasFriend ? await friend(page).getAttribute('data-active-object') : null });
  };
  try {
    await startFresh(page);
    await read('The cold opening comparison shows two authored full evenings.', 2_000);
    await activate(action(page, 'Start with Shenzhen'));
    await activate(action(page, 'What matters to you?'));
    await activate(action(page, 'Exploration'));
    await read('Exploration is explicitly chosen for the earlier outing.', 1_500);
    await activate(action(page, 'Back to evening'));
    await activate(action(page, 'Change departure'));
    await activate(action(page, '15 minutes earlier'));
    await activate(action(page, '15 minutes earlier'));
    await expect(clockControl(page, 'departure')).toHaveValue('990');
    await activate(action(page, 'Apply time change'));
    await activate(action(page, 'Keep full Shenzhen evening'));
    await activate(action(page, 'What matters to you?'));
    await typeReason(page, page.getByRole('textbox', { name: 'Your reason (optional)', exact: true }), sourceReason, 'touch');
    await activate(action(page, 'Back to evening'));
    await read('The chosen source outing leaves at 16:30 and keeps its full walk.', 2_000);
    await activate(action(page, 'Explore the chosen evening'));
    await activate(action(page, 'Station entrance'));
    await read('At the station, the earlier chosen comparison remains intact.', 2_000);
    await activate(action(page, 'Board for Lo Wu'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'outward');
    await read('The original outward journey is a schematic, not a live service.', 2_000);
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-art-status', 'ready');
    await activate(action(page, 'Continue to arrival'));
    await expect(page.getByTestId('decision-journey')).toHaveAttribute('data-phase', 'arrived');
    const source = await readSourceState(page);
    await read('The source arrives in Luohu at 18:15. The next-time message is a separate entry.', 3_000);
    await openInvitation(page, activate);
    await expectInvitation(page);
    await read('Read the friend’s invitation for another evening before departure.', 4_000);
    await captureFriend(page, info, 'film-invitation');
    await activate(friendAction(page, 'Preview three adults'));
    await expectPayoff(page, true);
    await expect(friend(page).getByTestId('friend-world-npc')).toHaveAttribute('data-art-status', 'ready');
    await read('Preview all four totals: the group pays more while the rounded average falls.', 4_000);
    await activate(friendAction(page, 'Cancel preview'));
    await expectInvitation(page);
    await read('Cancel returns to exactly two adults, with no journey mutation.', 2_000);
    await activate(friendAction(page, 'Preview three adults'));
    await activate(friendAction(page, 'Plan with three adults'));
    await expectPayoff(page, false);
    await read('Commit the new party size. Both city choices still await an explicit choice.', 3_000);
    await activate(friendAction(page, 'Map Compare this evening'));
    await expectPartyFacts(page, 3, { departure: 990, deadline: 1410 });
    await read('The map retains the source outing’s clocks, full dinner and 45-minute walks.', 3_000);
    await activate(friendAction(page, 'Back to friend comparison'));
    await friendDetail(page, activate, 'Earlier choice and priorities');
    await expect(friend(page)).toContainText(sourceReason);
    await read('The earlier Shenzhen reason and exploration priority are labeled as history.', 3_000);
    await activate(friendAction(page, 'Back to friend comparison'));
    await activate(friendAction(page, 'Choose Hong Kong for three'));
    await expect(friend(page).getByTestId('friend-choice-status')).toContainText('No reason stated.');
    await expect(friend(page).getByTestId('friend-choice-status')).toContainText('Priorities: not reconfirmed.');
    await read('The new city choice is complete without typing a reason or reconfirming priorities.', 3_000);
    await activate(friendAction(page, 'What matters this time?'));
    await expect(newReason(page)).toHaveValue('');
    await expect(reconsider(page)).not.toBeChecked();
    await expect(friendAction(page, 'Exploration')).toHaveAttribute('aria-pressed', 'false');
    await expect(friendAction(page, 'Keep this reflection')).toBeEnabled();
    await read('The new choice starts with no reason or priorities copied from history.', 2_000);
    await activate(friendAction(page, 'Company'));
    await activate(reconsider(page));
    await typeReason(page, newReason(page), ownReason, 'touch');
    await read('State a new reason and explicitly reconsider company for this evening.', 3_000);
    await activate(friendAction(page, 'Keep this reflection'));
    await expect(friend(page).getByTestId('friend-choice-status')).toContainText(ownReason);
    await read('The new Hong Kong choice records the user’s reason and Company priority.', 3_000);
    await activate(friendAction(page, 'Replay two and three'));
    await activate(friendAction(page, 'Two adults'));
    await expectPartyFacts(page, 2, { departure: 990, deadline: 1410 });
    await read('Replay two adults with the original clocks and per-person totals.', 3_000);
    await activate(friendAction(page, 'Three adults'));
    await expectPartyFacts(page, 3, { departure: 990, deadline: 1410 });
    await read('Replay three adults on the same time scale.', 3_000);
    await returnToArrival(page, activate);
    expect(await readSourceState(page)).toEqual(source);
    await audit.expectZero(page);
    await read('Return to the unchanged original Luohu arrival at 18:15, focused on the invitation entry.', 3_000);
    completed = true;
  } finally {
    await context.close();
    expect(video, 'Retain the actual browser film including any interrupted or failed frames.').not.toBeNull();
    await video!.saveAs(canonicalVideo);
    await video!.delete();
    await writeFile(reportPath, JSON.stringify({ commit, viewport, entry: `${baseURL}/decision.html`, startedAt: new Date(started).toISOString(),
      completed, input: 'real touch and keyboard text entry', reducedMotion: false,
      artifact: 'artifacts/decision/friend/decision-friend-390x844.webm', actions }, null, 2));
    await info.attach('friend-recording-pointer', { path: reportPath, contentType: 'application/json' });
  }
});
