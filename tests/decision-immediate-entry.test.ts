import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeData } from '../src/domain/data';
import { createDecisionSession, decisionReducer, previewRevision, previewTimeChange } from '../src/decision/session';
import { journeyReducer, selectedDeparturePlan } from '../src/decision/journey';
import type { DecisionSession, RevisionId } from '../src/decision/session';

function selectBaseline(city: 'hk' | 'sz'): DecisionSession {
  return decisionReducer(createDecisionSession(), { type: 'choose-option', snapshotId: 'baseline', optionId: city });
}
function revise(revision: RevisionId): DecisionSession {
  let source = selectBaseline('hk');
  source = decisionReducer(source, { type: 'set-reason', snapshotId: 'baseline', reason: 'Stay close to home.' });
  source = decisionReducer(source, { type: 'change-time', field: 'departureMinutes', minutes: 1200 });
  return decisionReducer(source, { type: 'apply-revision', revision, reason: 'Keep this plan despite its constraints.' });
}

test('an unchosen starting street never fabricates a departure plan', () => {
  const source = createDecisionSession();
  const before = JSON.stringify(source);
  assert.equal(selectedDeparturePlan(source), null);
  for (const node of ['counter', 'station'] as const) {
    assert.equal(journeyReducer(null, { type: 'depart-selected', session: source, node, hasPreview: false }), null);
  }
  assert.equal(JSON.stringify(source), before);
});

for (const city of ['hk', 'sz'] as const) {
  test(`${city}: a selected baseline boards directly with exact original clocks, cost and unknowns`, () => {
    const source = selectBaseline(city);
    const node = city === 'sz' ? 'station' : 'counter';
    const option = source.snapshots.baseline.result.options.find(item => item.id === city)!;
    const before = JSON.stringify(source);
    const wrongNode = city === 'sz' ? 'counter' : 'station';
    assert.equal(journeyReducer(null, { type: 'depart-selected', session: source, node: wrongNode, hasPreview: false }), null);
    const journey = journeyReducer(null, { type: 'depart-selected', session: source, node, hasPreview: false })!;
    assert.equal(journey.source, source);
    assert.equal(journey.snapshot, source.snapshots.baseline);
    assert.equal(journey.option, option);
    assert.equal(journey.phase, 'outward');
    assert.equal(journey.committedArrivalMinutes, city === 'sz' ? 1125 : 1035);
    assert.equal(journey.option.returnMinutes, city === 'sz' ? 1365 : 1185);
    assert.equal(journey.option.perPersonHKD, city === 'sz' ? 291.83 : 336);
    assert.equal(journey.option.entryFeasible, city === 'sz' ? null : true);
    assert.equal(journey.option.score, null);
    assert.equal(source.snapshots.changed, null);
    assert.equal(source.snapshots.revised, null);
    assert.equal(JSON.stringify(source), before);
    for (let i = 0; i < 12; i++) assert.equal(journeyReducer(journey, { type: 'depart-selected', session: source, node, hasPreview: false }), journey);
  });
}

test('a clock or walking preview cannot be silently used for departure', () => {
  const baseline = selectBaseline('sz');
  const time = previewTimeChange(baseline, { field: 'departureMinutes', minutes: 900 });
  assert.equal(time.valid, true);
  assert.equal(journeyReducer(null, { type: 'depart-selected', session: baseline, node: 'station', hasPreview: true }), null);
  assert.equal(selectedDeparturePlan(baseline)!.snapshot.inputs.departureMinutes, 1020);
  const changed = decisionReducer(baseline, { type: 'change-time', field: 'homeByMinutes', minutes: 1320 });
  assert.ok(previewRevision(changed, 'shorten-sz'));
  assert.equal(selectedDeparturePlan(changed), null, 'The baseline choice is not a selection of the changed circumstances.');
  assert.equal(journeyReducer(null, { type: 'depart-selected', session: changed, node: 'station', hasPreview: true }), null);
  assert.equal(journeyReducer(null, { type: 'depart-selected', session: changed, node: 'station', hasPreview: false }), null);
  const revised = decisionReducer(changed, { type: 'apply-revision', revision: 'shorten-sz' });
  const departed = journeyReducer(null, { type: 'depart-selected', session: revised, node: 'station', hasPreview: false })!;
  assert.equal(departed.option.walkMinutes, 15);
  assert.equal(departed.option.returnMinutes, 1335);
});

for (const revision of ['keep-hk', 'keep-sz', 'shorten-sz'] as const) {
  test(`${revision}: historical display never substitutes the current selection at departure`, () => {
    const source = revise(revision);
    const replaying = decisionReducer(source, { type: 'view-snapshot', snapshotId: 'baseline' });
    const plan = selectedDeparturePlan(replaying)!;
    assert.equal(plan.snapshot, source.snapshots.revised);
    const node = revision === 'keep-hk' ? 'counter' : 'station';
    let journey = journeyReducer(null, { type: 'depart-selected', session: replaying, node, hasPreview: false })!;
    assert.equal(journey.snapshot, source.snapshots.revised);
    assert.equal(journey.option.departureMinutes, 1200);
    assert.equal(journey.option.walkMinutes, revision === 'shorten-sz' ? 15 : 45);
    assert.equal(journey.source.choices.revised!.reason, 'Keep this plan despite its constraints.');
    const captured = JSON.stringify(journey);
    const later = decisionReducer(source, { type: 'set-reason', snapshotId: 'revised', reason: 'Unrelated later wording.' });
    assert.equal(journeyReducer(journey, { type: 'depart-selected', session: later, node, hasPreview: false }), journey);
    assert.equal(JSON.stringify(journey), captured);
    assert.equal(journeyReducer(journey, { type: 'arrive' }), journey, 'Art must settle before the coherent arrival.');
    journey = journeyReducer(journey, { type: 'art-settled', status: 'ready', snapshot: journey.snapshot })!;
    journey = journeyReducer(journey, { type: 'arrive' })!;
    assert.equal(journey.phase, 'arrived');
    assert.equal(journey.option.returnMinutes, plan.option.returnMinutes);
    assert.equal(journey.option.perPersonHKD, plan.option.perPersonHKD);
    assert.equal(journey.source, replaying);
    if (revision !== 'keep-hk') {
      assert.equal(journey.option.homeFeasible, false);
      assert.equal(journey.option.crossingFeasible, false);
      assert.equal(journey.option.entryFeasible, null);
    }
  });
}

test('a missing price stays unknown when the baseline journey is captured', () => {
  const fixture = structuredClone(illustrativeData);
  fixture.shenzhen.costs[1].amount = null;
  const source = decisionReducer(createDecisionSession({ fixture }), { type: 'choose-option', snapshotId: 'baseline', optionId: 'sz' });
  const journey = journeyReducer(null, { type: 'depart-selected', session: source, node: 'station', hasPreview: false })!;
  assert.equal(journey.option.perPersonHKD, null);
  assert.equal(journey.option.groupHKD, null);
  assert.ok(journey.option.knownGroupSubtotalHKD > 0);
  assert.ok(journey.option.missingCostLabels.length > 0);
});
