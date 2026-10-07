import assert from 'node:assert/strict';
import test from 'node:test';
import { createDecisionSession, decisionReducer } from '../src/decision/session';
import type { DecisionSession, RevisionId } from '../src/decision/session';
import { journeyArtName, journeyReducer } from '../src/decision/journey';

function chosen(revision: RevisionId = 'keep-sz', departure = 990): DecisionSession {
  let session = createDecisionSession();
  session = decisionReducer(session, { type: 'set-priorities', priorities: ['exploration', 'company'] });
  session = decisionReducer(session, { type: 'choose-option', snapshotId: 'baseline', optionId: 'hk' });
  session = decisionReducer(session, { type: 'set-reason', snapshotId: 'baseline', reason: 'Keep time together.' });
  session = decisionReducer(session, { type: 'change-time', field: 'departureMinutes', minutes: departure });
  session = decisionReducer(session, { type: 'apply-revision', revision, reason: 'This is my revised choice.' });
  return session;
}

test('a journey requires an explicitly chosen revised snapshot and does not alter the comparison', () => {
  assert.equal(journeyReducer(null, { type: 'begin', session: createDecisionSession() }), null);
  const session = chosen();
  const before = JSON.stringify(session);
  const state = journeyReducer(null, { type: 'begin', session })!;
  assert.equal(state.snapshot, session.snapshots.revised);
  assert.equal(state.option, session.snapshots.revised!.result.options.find(option => option.id === 'sz'));
  assert.deepEqual(state.priorities, session.priorities);
  assert.equal(state.committedArrivalMinutes, null);
  assert.equal(state.option.entryFeasible, null);
  assert.equal(state.option.score, null);
  assert.equal(JSON.stringify(session), before);
});

test('repeated free node inspection preserves exact times, prices, snapshots, priorities and reasons', () => {
  const session = chosen('shorten-sz');
  const before = JSON.stringify(session);
  let journey = journeyReducer(null, { type: 'begin', session })!;
  const option = journey.option;
  for (let i = 0; i < 40; i++) {
    journey = journeyReducer(journey, { type: 'move', node: i % 2 ? 'counter' : 'station' })!;
    assert.equal(journey.snapshot, session.snapshots.revised);
    assert.equal(journey.option, option);
    assert.equal(journey.committedArrivalMinutes, null);
    assert.equal(journey.phase, 'exploring');
  }
  assert.equal(JSON.stringify(session), before);
  assert.equal(journey.option.walkMinutes, 15);
});

for (const revision of ['keep-hk', 'keep-sz', 'shorten-sz'] as const) {
  test(`${revision}: duplicate departure commits the selected existing arrival exactly once`, () => {
    const session = chosen(revision, 1200);
    const initial = journeyReducer(null, { type: 'begin', session })!;
    const wrongNode = journeyReducer(initial, { type: 'move', node: revision === 'keep-hk' ? 'station' : 'counter' })!;
    assert.equal(journeyReducer(wrongNode, { type: 'depart' }), wrongNode, 'Commitment belongs to the relevant departure node.');
    const departureNode = journeyReducer(initial, { type: 'move', node: revision === 'keep-hk' ? 'counter' : 'station' })!;
    const departed = journeyReducer(departureNode, { type: 'depart' })!;
    assert.equal(departed.committedArrivalMinutes, initial.option.arrivalMinutes);
    assert.equal(departed.snapshot, session.snapshots.revised);
    assert.equal(departed.option, initial.option);
    for (let i = 0; i < 20; i++) assert.equal(journeyReducer(departed, { type: 'depart' }), departed);
    assert.equal(journeyReducer(departed, { type: 'move', node: 'counter' }), departed);
    assert.equal(journeyReducer(departed, { type: 'begin', session: chosen('keep-hk') }), departed);
    const ready = journeyReducer(departed, { type: 'art-settled', status: 'ready', snapshot: departed.snapshot })!;
    const arrived = journeyReducer(ready, { type: 'arrive' })!;
    assert.equal(arrived.phase, 'arrived');
    assert.equal(arrived.committedArrivalMinutes, initial.option.arrivalMinutes);
    assert.equal(arrived.option.returnMinutes, initial.option.returnMinutes);
    assert.equal(arrived.option.perPersonHKD, initial.option.perPersonHKD);
    assert.equal(journeyReducer(arrived, { type: 'depart' }), arrived);
    assert.equal(journeyReducer(arrived, { type: 'arrive' }), arrived);
  });
}

test('the destination cannot appear while artwork is pending; late callbacks cannot replace a settled fallback', () => {
  let journey = journeyReducer(null, { type: 'begin', session: chosen() })!;
  journey = journeyReducer(journey, { type: 'move', node: 'station' })!;
  journey = journeyReducer(journey, { type: 'depart' })!;
  assert.equal(journeyReducer(journey, { type: 'arrive' }), journey);
  journey = journeyReducer(journey, { type: 'art-settled', status: 'fallback', snapshot: journey.snapshot })!;
  journey = journeyReducer(journey, { type: 'arrive' })!;
  assert.equal(journey.phase, 'arrived');
  assert.equal(journeyReducer(journey, { type: 'art-settled', status: 'ready', snapshot: journey.snapshot }), journey);
  assert.equal(journeyReducer(journey, { type: 'art-settled', status: 'fallback', snapshot: journey.snapshot }), journey);
});

test('stale image success and failure after reset cannot settle a new chosen trip', () => {
  const first = journeyReducer(null, { type: 'begin', session: chosen() })!;
  const reset = journeyReducer(first, { type: 'reset' });
  assert.equal(reset, null);
  assert.equal(journeyReducer(reset, { type: 'art-settled', status: 'ready', snapshot: first.snapshot }), null);
  const second = journeyReducer(reset, { type: 'begin', session: chosen('keep-hk') })!;
  assert.equal(journeyReducer(second, { type: 'art-settled', status: 'ready', snapshot: first.snapshot }), second);
  assert.equal(journeyReducer(second, { type: 'art-settled', status: 'fallback', snapshot: first.snapshot }), second);
  assert.equal(second.artStatus, 'pending');
});

test('replay and explicit reason edits do not substitute the selected snapshot or trip', () => {
  let session = chosen();
  const journey = journeyReducer(null, { type: 'begin', session })!;
  const before = JSON.stringify(journey);
  session = decisionReducer(session, { type: 'view-snapshot', snapshotId: 'baseline' });
  assert.equal(session.displayedSnapshotId, 'baseline');
  assert.equal(journeyReducer(journey, { type: 'begin', session }), journey);
  session = decisionReducer(session, { type: 'view-snapshot', snapshotId: 'revised' });
  session = decisionReducer(session, { type: 'set-reason', snapshotId: 'revised', reason: 'My own later wording.' });
  assert.equal(journey.snapshot, session.snapshots.revised);
  assert.equal(JSON.stringify(journey), before);
});

test('illustrative lighting uses the captured arrival and never substitutes a route or sunset claim', () => {
  const day = journeyReducer(null, { type: 'begin', session: chosen('keep-sz', 900) })!;
  const evening = journeyReducer(null, { type: 'begin', session: chosen('keep-sz', 1200) })!;
  const local = journeyReducer(null, { type: 'begin', session: chosen('keep-hk', 1200) })!;
  assert.equal(journeyArtName(day), 'decision-sz-day.webp');
  assert.equal(journeyArtName(evening), 'decision-sz-evening.webp');
  assert.equal(journeyArtName(local), 'decision-hk-pixel.webp');
  assert.equal(day.option.routeLabel, 'Rail via Lo Wu');
  assert.equal(evening.option.routeLabel, 'Rail via Lo Wu');
  assert.equal(evening.option.entryFeasible, null);
  assert.equal(evening.option.crossingFeasible, false);
});
