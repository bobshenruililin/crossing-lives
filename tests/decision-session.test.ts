import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeData } from '../src/domain/data';
import { formatClock } from '../src/domain/engine';
import type { OptionId, OutingFixture } from '../src/domain/model';
import {
  createDecisionSession, decisionReducer, previewRevision, previewTimeChange, selectDecisionDeltas, selectDecisionView,
  DECISION_FIXTURE_VERSION, DECISION_PRESET_INPUTS, DECISION_SCOPE_NOTES, DECISION_TIME_LIMITS, DECISION_TIMELINE_RANGE,
} from '../src/decision/session';
import type { DecisionEvent, DecisionSession, DecisionSnapshot, RevisionId, TimeChange } from '../src/decision/session';

const option = (snapshot: DecisionSnapshot, id: OptionId) => snapshot.result.options.find(item => item.id === id)!;
const choose = (state: DecisionSession, optionId: OptionId): DecisionSession => decisionReducer(state, { type: 'choose-option', snapshotId: state.stage, optionId });
const changed = (optionId: OptionId = 'sz', state = createDecisionSession()) => decisionReducer(choose(state, optionId), { type: 'change-time', field: 'homeByMinutes', minutes: 1350 });
const revised = (revision: RevisionId = 'shorten-sz', initial: OptionId = 'sz') => decisionReducer(changed(initial), { type: 'apply-revision', revision });

test('authored baseline uses one exact matched input object and exact whole-outing engine outputs', () => {
  const session = createDecisionSession();
  const baseline = session.snapshots.baseline;
  assert.equal(baseline.inputs, baseline.result.inputs);
  assert.deepEqual(baseline.inputs, DECISION_PRESET_INPUTS);
  assert.equal(baseline.fixtureVersion, DECISION_FIXTURE_VERSION);
  assert.equal(baseline.result.valid, true);
  assert.equal(session.stage, 'baseline');
  assert.equal(session.choices.baseline, null);
  assert.equal(session.snapshots.changed, null);
  assert.equal(session.snapshots.revised, null);
  assert.equal(baseline.inputs.partySize, 2);
  assert.equal(baseline.inputs.origin, 'kowloon');
  assert.equal(baseline.inputs.departureMinutes, 1020);
  assert.equal(baseline.inputs.homeByMinutes, 1410);
  assert.equal(baseline.inputs.budgetPerPersonHKD, 400);
  assert.equal(baseline.inputs.fxHKDPerCNY, 1.09);
  assert.equal(baseline.inputs.szRoute, 'rail');
  assert.deepEqual(baseline.inputs.weights, { price: 0, ease: 0, discovery: 0 });
  const hk = option(baseline, 'hk');
  const sz = option(baseline, 'sz');
  assert.deepEqual([hk.perPersonHKD, hk.groupHKD, hk.arrivalMinutes, hk.returnMinutes, hk.spareMinutes], [336, 672, 1035, 1185, 225]);
  assert.deepEqual([sz.perPersonHKD, sz.groupHKD, sz.arrivalMinutes, sz.returnMinutes, sz.spareMinutes], [291.83, 583.66, 1125, 1365, 45]);
  assert.equal(sz.routeLabel, 'Rail via Lo Wu');
  assert.deepEqual([hk.outwardMinutes, hk.inwardMinutes, sz.outwardMinutes, sz.inwardMinutes], [15, 15, 105, 105]);
  for (const item of baseline.result.options) {
    assert.equal(item.mealMinutes, 90);
    assert.equal(item.walkMinutes, 45);
    assert.equal(item.includeSharedOrder, true);
    assert.equal(item.storyDelayMinutes, 0);
    assert.equal(item.experienceMinutes, 135);
    assert.equal(item.score, null);
    assert.equal(item.scoreBreakdown.totalWeight, 0);
    assert.equal(item.scoreBreakdown.discovery, null);
    assert.deepEqual(item.familiarity, { dinner: 'unsure', walk: 'unsure' });
  }
  assert.equal(hk.entryFeasible, true);
  assert.equal(sz.entryFeasible, null);
  assert.equal(sz.feasible, null);
  assert.equal(baseline.result.recommendation.optionId, null);
});

test('matched itinerary overrides prevent other-city defaults or story choices leaking into the comparison', () => {
  const fixture = structuredClone(illustrativeData);
  fixture.local.walkMinutes = 5;
  fixture.shenzhen.walkMinutes = 160;
  const session = createDecisionSession({ fixture, fixtureVersion: 'different-walk-defaults' });
  for (const item of session.snapshots.baseline.result.options) {
    assert.equal(item.mealMinutes, 90);
    assert.equal(item.walkMinutes, 45);
    assert.equal(item.storyDelayMinutes, 0);
    assert.equal(item.includeSharedOrder, true);
  }
  assert.deepEqual(session.snapshots.baseline.inputs.itineraryOverrides?.hk, session.snapshots.baseline.inputs.itineraryOverrides?.sz);
});

test('the changed snapshot differs in home-by only, with unchanged costs, travel, arrival and activities', () => {
  const session = changed();
  const deltas = selectDecisionDeltas(session, 'baseline', 'changed')!;
  assert.deepEqual(deltas.inputChanges, [{ path: 'homeByMinutes', before: 1410, after: 1350 }]);
  assert.equal(session.snapshots.changed!.inputs, session.snapshots.changed!.result.inputs);
  assert.equal(session.snapshots.changed!.fixtureVersion, session.snapshots.baseline.fixtureVersion);
  for (const { before, after, perPersonCostChangeHKD, returnChangeMinutes, slackChangeMinutes } of deltas.options) {
    assert.equal(perPersonCostChangeHKD, 0);
    assert.equal(returnChangeMinutes, 0);
    assert.equal(slackChangeMinutes, -60);
    const { homeByMinutes: _beforeDeadline, spareMinutes: _beforeSlack, homeFeasible: _beforeHome, feasible: _beforeFit, reasons: _beforeReasons, ...beforeFacts } = before;
    const { homeByMinutes: _afterDeadline, spareMinutes: _afterSlack, homeFeasible: _afterHome, feasible: _afterFit, reasons: _afterReasons, ...afterFacts } = after;
    assert.deepEqual(afterFacts, beforeFacts);
  }
  const sz = option(session.snapshots.changed!, 'sz');
  assert.equal(sz.returnMinutes, 1365);
  assert.equal(sz.homeByMinutes, 1350);
  assert.equal(sz.spareMinutes, -15);
  assert.equal(sz.homeFeasible, false);
  assert.equal(sz.feasible, false);
  assert.equal(sz.entryFeasible, null);
  assert.equal(option(session.snapshots.changed!, 'hk').spareMinutes, 165);
  assert.deepEqual(deltas.facts, ['Home-by changed from 23:30 to 22:30.']);
});

test('short-walk revision changes only Shenzhen walk45→15, preserving costs and every Hong Kong fact', () => {
  const session = revised();
  const deltas = selectDecisionDeltas(session, 'changed', 'revised')!;
  assert.deepEqual(deltas.inputChanges, [{ path: 'itineraryOverrides.sz.walkMinutes', before: 45, after: 15 }]);
  assert.deepEqual(option(session.snapshots.revised!, 'hk'), option(session.snapshots.changed!, 'hk'));
  const before = option(session.snapshots.changed!, 'sz');
  const after = option(session.snapshots.revised!, 'sz');
  assert.deepEqual([after.walkMinutes, after.returnMinutes, after.spareMinutes, after.perPersonHKD], [15, 1335, 15, 291.83]);
  assert.equal(after.homeFeasible, true);
  assert.equal(after.entryFeasible, null);
  assert.equal(after.feasible, null);
  assert.equal(after.mealMinutes, before.mealMinutes);
  assert.equal(after.arrivalMinutes, before.arrivalMinutes);
  assert.equal(after.outwardMinutes, before.outwardMinutes);
  assert.equal(after.inwardMinutes, before.inwardMinutes);
  assert.equal(after.storyDelayMinutes, before.storyDelayMinutes);
  assert.equal(after.includeSharedOrder, before.includeSharedOrder);
  assert.deepEqual(after.lineItems, before.lineItems);
  assert.deepEqual(after.familiarity, before.familiarity);
  assert.deepEqual(after.scoreBreakdown, before.scoreBreakdown);
  assert.deepEqual(session.choices.revised, { optionId: 'sz', reason: null });
  assert.match(deltas.options[1].facts.join(' '), /15 minutes of modeled slack; this is not a guarantee/);
});

test('keep-Hong-Kong revision preserves the entire changed comparison and records an explicit choice', () => {
  const session = revised('keep-hk', 'hk');
  assert.deepEqual(session.snapshots.revised!.inputs, session.snapshots.changed!.inputs);
  assert.deepEqual(session.snapshots.revised!.result, session.snapshots.changed!.result);
  assert.deepEqual(selectDecisionDeltas(session, 'changed', 'revised')!.inputChanges, []);
  assert.deepEqual(session.choices.revised, { optionId: 'hk', reason: null });
  const view = selectDecisionView(session);
  assert.equal(view.reconsideration.hasChoiceChanged, false);
  assert.equal(view.reconsideration.summary, 'You kept Hong Kong as your choice.');
  assert.doesNotMatch(view.reconsideration.summary, /changed your mind|better|happi|personality/i);
});

test('remaining with Shenzhen after shortening its walk does not invent a changed-city story', () => {
  const view = selectDecisionView(revised('shorten-sz', 'sz'));
  assert.equal(view.reconsideration.hasChoiceChanged, false);
  assert.equal(view.reconsideration.summary, 'You kept Shenzhen as your choice.');
  assert.equal(view.reconsideration.reason, null);
});

test('a genuine city change is described without inventing the user motivation', () => {
  const session = revised('keep-hk', 'sz');
  const view = selectDecisionView(session);
  assert.equal(view.reconsideration.hasChoiceChanged, true);
  assert.equal(view.reconsideration.summary, 'You first selected Shenzhen and now selected Hong Kong.');
  assert.equal(view.reconsideration.reason, null);
});

test('duplicate commitments are idempotent and out-of-order commitments are ignored', () => {
  const initial = createDecisionSession();
  const outOfOrder: DecisionEvent[] = [
    { type: 'change-time', field: 'homeByMinutes', minutes: 1350 }, { type: 'apply-revision', revision: 'shorten-sz' },
    { type: 'choose-option', snapshotId: 'changed', optionId: 'sz' },
    { type: 'choose-option', snapshotId: 'revised', optionId: 'hk' },
    { type: 'set-reason', snapshotId: 'baseline', reason: 'No choice exists' },
    { type: 'view-snapshot', snapshotId: 'changed' }, { type: 'view-snapshot', snapshotId: 'revised' },
  ];
  for (const event of outOfOrder) assert.equal(decisionReducer(initial, event), initial);
  assert.equal(previewRevision(initial, 'shorten-sz'), null);
  const selected = choose(initial, 'sz');
  assert.equal(choose(selected, 'sz'), selected);
  const afterChange = decisionReducer(selected, { type: 'change-time', field: 'homeByMinutes', minutes: 1350 });
  assert.equal(decisionReducer(afterChange, { type: 'change-time', field: 'homeByMinutes', minutes: 1350 }), afterChange);
  const afterRevision = decisionReducer(afterChange, { type: 'apply-revision', revision: 'shorten-sz' });
  for (const revision of ['keep-hk', 'keep-sz', 'shorten-sz'] as const) assert.equal(decisionReducer(afterRevision, { type: 'apply-revision', revision }), afterRevision);
  assert.equal(decisionReducer(afterRevision, { type: 'change-time', field: 'homeByMinutes', minutes: 1350 }), afterRevision);
});

test('a revised choice cannot contradict the alternative committed with its immutable snapshot', () => {
  for (const revision of ['keep-hk', 'keep-sz', 'shorten-sz'] as const) {
    const session = revised(revision);
    const expectedCity = revision === 'keep-hk' ? 'hk' : 'sz';
    for (const optionId of ['hk', 'sz'] as const) {
      assert.equal(decisionReducer(session, { type: 'choose-option', snapshotId: 'revised', optionId }), session);
    }
    assert.equal(session.choices.revised!.optionId, expectedCity);
    assert.equal(session.snapshots.revised!.revision, revision);
    const withReason = decisionReducer(session, { type: 'set-reason', snapshotId: 'revised', reason: 'My explicit reason.' });
    assert.equal(withReason.choices.revised!.optionId, expectedCity);
    assert.equal(withReason.choices.revised!.reason, 'My explicit reason.');
    assert.equal(withReason.snapshots, session.snapshots);
  }
});

test('baseline, historical choice and historical reason remain immutable through preview, revision and inspection', () => {
  let state = choose(createDecisionSession(), 'sz');
  state = decisionReducer(state, { type: 'set-reason', snapshotId: 'baseline', reason: '  I want the longer trip tonight.  ' });
  const baseline = state.snapshots.baseline;
  const baselineJSON = JSON.stringify(baseline);
  const baselineChoice = state.choices.baseline;
  state = decisionReducer(state, { type: 'change-time', field: 'homeByMinutes', minutes: 1350 });
  previewRevision(state, 'shorten-sz');
  state = decisionReducer(state, { type: 'apply-revision', revision: 'keep-hk' });
  state = decisionReducer(state, { type: 'view-snapshot', snapshotId: 'baseline' });
  assert.equal(state.snapshots.baseline, baseline);
  assert.equal(JSON.stringify(baseline), baselineJSON);
  assert.equal(state.choices.baseline, baselineChoice);
  assert.equal(baselineChoice!.reason, 'I want the longer trip tonight.');
  assert.equal(decisionReducer(state, { type: 'set-reason', snapshotId: 'baseline', reason: 'Retroactive rewrite' }), state);
  assert.equal(decisionReducer(state, { type: 'choose-option', snapshotId: 'baseline', optionId: 'hk' }), state);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(baseline.inputs.itineraryOverrides!.sz));
  assert.ok(Object.isFrozen(baseline.result.options[0].lineItems));
  assert.ok(Object.isFrozen(baselineChoice));
  assert.throws(() => { (baseline.inputs as { homeByMinutes: number }).homeByMinutes = 1; }, TypeError);
});

test('historical display is independent of current stage and current selection', () => {
  const session = revised('keep-hk', 'sz');
  const inspected = decisionReducer(session, { type: 'view-snapshot', snapshotId: 'baseline' });
  assert.equal(inspected.stage, 'revised');
  assert.equal(inspected.displayedSnapshotId, 'baseline');
  assert.equal(inspected.snapshots, session.snapshots);
  assert.equal(inspected.choices, session.choices);
  const view = selectDecisionView(inspected);
  assert.equal(view.displayedSnapshot, session.snapshots.baseline);
  assert.equal(view.currentSnapshot, session.snapshots.revised);
  assert.equal(view.displayedChoice!.optionId, 'sz');
  assert.equal(view.currentChoice!.optionId, 'hk');
  assert.equal(decisionReducer(inspected, { type: 'view-snapshot', snapshotId: 'baseline' }), inspected);
  assert.equal(decisionReducer(inspected, { type: 'view-snapshot', snapshotId: 'revised' }).choices, session.choices);
});

test('qualitative priorities are explicit, idempotent and never affect facts, weights or choices', () => {
  const session = createDecisionSession();
  const result = decisionReducer(session, { type: 'set-priorities', priorities: ['exploration', 'food', 'food', 'company', 'comfort'] });
  assert.deepEqual(result.priorities, ['food', 'company', 'comfort', 'exploration']);
  assert.equal(result.snapshots, session.snapshots);
  assert.equal(result.choices, session.choices);
  assert.equal(result.fixture, session.fixture);
  assert.equal(decisionReducer(result, { type: 'set-priorities', priorities: ['food', 'company', 'comfort', 'exploration'] }), result);
  const completed = decisionReducer(changed('sz', result), { type: 'apply-revision', revision: 'shorten-sz' });
  for (const id of ['baseline', 'changed', 'revised'] as const) {
    assert.deepEqual(completed.snapshots[id]!.inputs.weights, { price: 0, ease: 0, discovery: 0 });
    for (const item of completed.snapshots[id]!.result.options) assert.equal(item.score, null);
  }
});

test('priorities stay fixed after the deadline change, including while replaying Before', () => {
  const baseline = decisionReducer(createDecisionSession(), { type: 'set-priorities', priorities: ['food', 'company'] });
  const afterChange = changed('sz', baseline);
  const afterRevision = decisionReducer(afterChange, { type: 'apply-revision', revision: 'shorten-sz' });
  const beforeView = decisionReducer(afterRevision, { type: 'view-snapshot', snapshotId: 'baseline' });
  for (const state of [afterChange, afterRevision, beforeView]) {
    assert.equal(decisionReducer(state, { type: 'set-priorities', priorities: ['comfort'] }), state);
    assert.equal(decisionReducer(state, { type: 'set-priorities', priorities: [] }), state);
    assert.equal(state.priorities, baseline.priorities);
    assert.deepEqual(selectDecisionView(state).priorities, ['food', 'company']);
  }
  const reset = decisionReducer(beforeView, { type: 'reset' });
  assert.deepEqual(reset.priorities, []);
  assert.deepEqual(decisionReducer(reset, { type: 'set-priorities', priorities: ['exploration'] }).priorities, ['exploration']);
});

test('optional reasons preserve only user text, have no numerical effect, and are not copied to another choice', () => {
  const session = choose(createDecisionSession(), 'sz');
  const withReason = decisionReducer(session, { type: 'set-reason', snapshotId: 'baseline', reason: '  More time to talk on the train.  ' });
  assert.equal(withReason.snapshots, session.snapshots);
  assert.equal(withReason.choices.baseline!.reason, 'More time to talk on the train.');
  assert.equal(selectDecisionView(withReason).reconsideration.reason, 'More time to talk on the train.');
  assert.equal(decisionReducer(withReason, { type: 'set-reason', snapshotId: 'baseline', reason: 'More time to talk on the train.' }), withReason);
  const differentChoice = choose(withReason, 'hk');
  assert.equal(differentChoice.choices.baseline!.reason, null);
  const afterChange = decisionReducer(withReason, { type: 'change-time', field: 'homeByMinutes', minutes: 1350 });
  assert.equal(afterChange.choices.changed, null);
  const afterRevision = decisionReducer(afterChange, { type: 'apply-revision', revision: 'shorten-sz', reason: '  Keep the meal, skip part of the walk. ' });
  assert.equal(afterRevision.choices.baseline!.reason, 'More time to talk on the train.');
  assert.equal(afterRevision.choices.revised!.reason, 'Keep the meal, skip part of the walk.');
  assert.equal(decisionReducer(afterRevision, { type: 'set-reason', snapshotId: 'revised', reason: '  ' }).choices.revised!.reason, null);
});

test('unknown fixture costs propagate through every snapshot and never become zero or a saving', () => {
  const fixture: OutingFixture = structuredClone(illustrativeData);
  fixture.shenzhen.costs[0].amount = null;
  fixture.local.costs[1].amount = null;
  const baseline = createDecisionSession({ fixture, fixtureVersion: 'unknown-cost-test-v1' });
  const session = decisionReducer(changed('sz', baseline), { type: 'apply-revision', revision: 'shorten-sz' });
  for (const id of ['baseline', 'changed', 'revised'] as const) {
    const snapshot = session.snapshots[id]!;
    assert.equal(snapshot.fixtureVersion, 'unknown-cost-test-v1');
    for (const item of snapshot.result.options) {
      assert.equal(item.perPersonHKD, null);
      assert.equal(item.groupHKD, null);
      assert.equal(item.budgetFeasible, null);
      assert.ok(item.knownGroupSubtotalHKD > 0);
      assert.equal(item.missingCostLabels.length, 1);
      assert.equal(item.score, null);
    }
  }
  const deltas = selectDecisionDeltas(session, 'baseline', 'revised')!;
  for (const item of deltas.options) {
    assert.equal(item.perPersonCostChangeHKD, null);
    assert.match(item.facts[0], /whole-outing cost is unknown/);
    assert.doesNotMatch(item.facts.join(' '), /cost stays|saving|HK\$0/);
  }
});

test('fixture is cloned once into session ownership, preventing outside edits from changing later comparisons', () => {
  const fixture: OutingFixture = structuredClone(illustrativeData);
  const initial = createDecisionSession({ fixture, fixtureVersion: 'captured-test-fixture-v1' });
  fixture.shenzhen.costs[0].amount = 999;
  fixture.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = 999;
  const session = decisionReducer(changed('sz', initial), { type: 'apply-revision', revision: 'shorten-sz' });
  for (const id of ['baseline', 'changed', 'revised'] as const) {
    assert.equal(option(session.snapshots[id]!, 'sz').perPersonHKD, 291.83);
    assert.equal(session.snapshots[id]!.fixtureVersion, 'captured-test-fixture-v1');
  }
  assert.ok(Object.isFrozen(session.fixture.shenzhen.costs[0]));
});

test('preview is repeatable and free: no selected city, snapshot history, reason or time is changed', () => {
  const session = changed();
  const before = JSON.stringify(session);
  const first = previewRevision(session, 'shorten-sz')!;
  const second = previewRevision(session, 'shorten-sz')!;
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(session), before);
  assert.equal(session.snapshots.revised, null);
  assert.equal(session.choices.revised, null);
  assert.equal(first.inputs, first.result.inputs);
  const full = previewRevision(session, 'keep-hk')!;
  assert.deepEqual(full.inputs, session.snapshots.changed!.inputs);
  const committed = decisionReducer(session, { type: 'apply-revision', revision: 'shorten-sz' });
  assert.deepEqual(committed.snapshots.revised, first);
});

test('all snapshot tabs and repeated inspections keep the same timeline scale and original minutes', () => {
  let session = revised();
  const before = JSON.stringify(session.snapshots);
  for (const snapshotId of ['baseline', 'changed', 'revised', 'changed', 'baseline', 'revised'] as const) {
    session = decisionReducer(session, { type: 'view-snapshot', snapshotId });
    const view = selectDecisionView(session);
    assert.deepEqual(view.timelineRange, { startMinutes: 900, endMinutes: 1560 });
    selectDecisionDeltas(session);
    previewRevision(session, 'shorten-sz');
  }
  assert.equal(JSON.stringify(session.snapshots), before);
  assert.equal(session.stage, 'revised');
});

test('reset restores authored context and empty choices/priorities without browser data access', () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const name of ['localStorage', 'sessionStorage']) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`Must not touch ${name}`); } });
  }
  try {
    const baseline = decisionReducer(createDecisionSession(), { type: 'set-priorities', priorities: ['comfort'] });
    let session = decisionReducer(changed('sz', baseline), { type: 'apply-revision', revision: 'keep-hk' });
    session = decisionReducer(session, { type: 'set-reason', snapshotId: 'revised', reason: 'I need the extra time at home.' });
    const old = session;
    const reset = decisionReducer(session, { type: 'reset' });
    assert.deepEqual(reset, createDecisionSession());
    assert.deepEqual(decisionReducer(reset, { type: 'reset' }), reset);
    assert.equal(old.stage, 'revised');
    assert.equal(old.choices.revised!.reason, 'I need the extra time at home.');
    assert.deepEqual(reset.snapshots.baseline.inputs, DECISION_PRESET_INPUTS);
    selectDecisionView(reset);
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test('unknown eligibility, familiarity, service and queues remain honestly qualified', () => {
  const session = revised();
  for (const id of ['baseline', 'changed', 'revised'] as const) {
    const sz = option(session.snapshots[id]!, 'sz');
    assert.equal(sz.entryFeasible, null);
    assert.equal(sz.scoreBreakdown.discovery, null);
    assert.match(sz.warnings.join(' '), /does not confirm transport service or immigration eligibility/);
    assert.match(sz.warnings.join(' '), /actual queues may be longer/);
    assert.match(sz.warnings.join(' '), /not a guaranteed/);
  }
  assert.match(DECISION_SCOPE_NOTES.join(' '), /unknown required durations are not supported/);
  assert.equal('recommendation' in selectDecisionView(session), false);
});

test('earlier departure shifts both whole outings equally and permits keeping the full Shenzhen plan', () => {
  const initial = choose(createDecisionSession(), 'sz');
  const change: TimeChange = { field: 'departureMinutes', minutes: 16 * 60 + 30 };
  const session = decisionReducer(initial, { type: 'change-time', ...change });
  const deltas = selectDecisionDeltas(session, 'baseline', 'changed')!;
  assert.deepEqual(deltas.inputChanges, [{ path: 'departureMinutes', before: 1020, after: 990 }]);
  assert.deepEqual(deltas.facts, ['Departure changed from 17:00 to 16:30.']);
  assert.deepEqual(selectDecisionView(session).timeChange, { field: 'departureMinutes', beforeMinutes: 1020, afterMinutes: 990 });
  for (const delta of deltas.options) {
    assert.equal(delta.after.departureMinutes, delta.before.departureMinutes - 30);
    assert.equal(delta.after.arrivalMinutes, delta.before.arrivalMinutes - 30);
    assert.equal(delta.after.experienceEndMinutes, delta.before.experienceEndMinutes - 30);
    assert.equal(delta.returnChangeMinutes, -30);
    assert.equal(delta.slackChangeMinutes, 30);
    assert.equal(delta.perPersonCostChangeHKD, 0);
    for (const key of ['mealMinutes', 'walkMinutes', 'storyDelayMinutes', 'includeSharedOrder', 'outwardMinutes', 'inwardMinutes', 'homeByMinutes', 'totalMinutes'] as const) assert.equal(delta.after[key], delta.before[key]);
    assert.deepEqual(delta.after.lineItems, delta.before.lineItems);
  }
  const kept = decisionReducer(session, { type: 'apply-revision', revision: 'keep-sz' });
  const sz = option(kept.snapshots.revised!, 'sz');
  assert.deepEqual([sz.returnMinutes, sz.spareMinutes, sz.walkMinutes, sz.perPersonHKD], [1335, 75, 45, 291.83]);
  assert.equal(sz.homeFeasible, true);
  assert.equal(sz.entryFeasible, null);
  assert.equal(sz.feasible, null);
  assert.deepEqual(kept.snapshots.revised!.inputs, session.snapshots.changed!.inputs);
  assert.deepEqual(kept.snapshots.revised!.result, session.snapshots.changed!.result);
  assert.deepEqual(kept.choices.revised, { optionId: 'sz', reason: null });
  assert.deepEqual(selectDecisionDeltas(kept, 'changed', 'revised')!.inputChanges, []);
  assert.equal(selectDecisionView(kept).reconsideration.summary, 'You kept Shenzhen as your choice.');
});

test('home-by fit and crossing-window fit remain independent for later departures', () => {
  for (const [departure, home, slack, crossingFit] of [
    [1080, 1425, -15, true], [1125, 1470, -60, true], [1140, 1485, -75, false],
  ] as const) {
    const initial = choose(createDecisionSession(), 'sz');
    const session = decisionReducer(initial, { type: 'change-time', field: 'departureMinutes', minutes: departure });
    const sz = option(session.snapshots.changed!, 'sz');
    assert.deepEqual([sz.returnMinutes, sz.spareMinutes, sz.crossingFeasible], [home, slack, crossingFit]);
    assert.equal(sz.homeFeasible, false);
    assert.equal(sz.entryFeasible, null);
    assert.equal(sz.feasible, false);
    assert.equal(sz.walkMinutes, 45);
    assert.equal(sz.perPersonHKD, 291.83);
    assert.equal(option(session.snapshots.changed!, 'hk').homeFeasible, true);
    assert.match(selectDecisionDeltas(session)!.options[1].facts.join(' '), crossingFit ? /crossings fit the modeled/ : /falls outside the modeled/);
  }
});

test('shortening is an explicit optional change and can still leave home-by or crossing failures', () => {
  for (const [departure, shortHome, shortSlack, crossingFit] of [
    [1140, 1455, -45, true], [1200, 1515, -105, false],
  ] as const) {
    const initial = choose(createDecisionSession(), 'sz');
    const session = decisionReducer(initial, { type: 'change-time', field: 'departureMinutes', minutes: departure });
    assert.equal(option(session.snapshots.changed!, 'sz').walkMinutes, 45);
    const full = previewRevision(session, 'keep-sz')!;
    assert.equal(option(full, 'sz').walkMinutes, 45);
    assert.deepEqual(full.inputs, session.snapshots.changed!.inputs);
    const short = previewRevision(session, 'shorten-sz')!;
    const sz = option(short, 'sz');
    assert.deepEqual([sz.returnMinutes, sz.spareMinutes, sz.crossingFeasible], [shortHome, shortSlack, crossingFit]);
    assert.equal(sz.homeFeasible, false);
    assert.equal(sz.entryFeasible, null);
    assert.equal(sz.feasible, false);
    assert.equal(sz.perPersonHKD, 291.83);
    assert.equal(session.snapshots.revised, null);
    assert.equal(option(session.snapshots.changed!, 'sz').walkMinutes, 45);
    const committed = decisionReducer(session, { type: 'apply-revision', revision: 'shorten-sz' });
    assert.deepEqual(committed.snapshots.revised, short);
    assert.match(selectDecisionDeltas(committed, 'changed', 'revised')!.options[1].facts.join(' '), /minutes after the home-by deadline/);
    if (!crossingFit) assert.match(selectDecisionDeltas(committed)!.options[1].facts.join(' '), /falls outside the modeled/);
  }
});

test('authored time boundaries accept explicit next-day deadlines without implicit clock rollover', () => {
  const initial = choose(createDecisionSession(), 'hk');
  for (const [field, minutes, hkHome, szHome] of [
    ['departureMinutes', 900, 1065, 1245], ['departureMinutes', 1200, 1365, 1545],
    ['homeByMinutes', 1200, 1185, 1365], ['homeByMinutes', 1440, 1185, 1365],
    ['homeByMinutes', 1470, 1185, 1365], ['homeByMinutes', 1500, 1185, 1365],
  ] as const) {
    const preview = previewTimeChange(initial, { field, minutes });
    assert.equal(preview.valid, true);
    if (!preview.valid) throw new Error(preview.error);
    assert.equal(preview.snapshot.inputs[field], minutes);
    assert.equal(option(preview.snapshot, 'hk').returnMinutes, hkHome);
    assert.equal(option(preview.snapshot, 'sz').returnMinutes, szHome);
    assert.equal(preview.snapshot.result.normalizedHomeByMinutes, field === 'homeByMinutes' ? minutes : 1410);
  }
  assert.equal(formatClock(1440), '00:00 (+1d)');
  assert.equal(formatClock(1470), '00:30 (+1d)');
  assert.equal(formatClock(1500), '01:00 (+1d)');
  assert.equal(formatClock(1545), '01:45 (+1d)');
  for (const minutes of [0, 15, 30, 45, 60]) {
    assert.equal(previewTimeChange(initial, { field: 'homeByMinutes', minutes }).valid, false);
    assert.equal(decisionReducer(initial, { type: 'change-time', field: 'homeByMinutes', minutes }), initial);
  }
});

test('invalid, unchanged, off-step or unsupported time changes never mutate a session', () => {
  const initial = choose(createDecisionSession(), 'hk');
  const before = JSON.stringify(initial);
  const invalid: unknown[] = [
    { field: 'departureMinutes', minutes: 899 }, { field: 'departureMinutes', minutes: 1201 },
    { field: 'homeByMinutes', minutes: 1199 }, { field: 'homeByMinutes', minutes: 1501 },
    { field: 'departureMinutes', minutes: 1020 }, { field: 'homeByMinutes', minutes: 1410 },
    { field: 'departureMinutes', minutes: 991 }, { field: 'homeByMinutes', minutes: 1351 },
    { field: 'departureMinutes', minutes: 990.5 }, { field: 'homeByMinutes', minutes: 1350.5 },
    ...[null, undefined, NaN, Infinity, -Infinity, '990', true].map(minutes => ({ field: 'departureMinutes', minutes })),
    { field: 'mealMinutes', minutes: 90 }, { field: '__proto__', minutes: 990 },
    { field: 'departureMinutes' }, { minutes: 990 }, {}, null,
  ];
  for (const change of invalid) {
    const preview = previewTimeChange(initial, change as TimeChange);
    assert.equal(preview.valid, false);
    if (preview.valid) throw new Error('Invalid draft unexpectedly previewed.');
    assert.ok(preview.error.length > 0);
    assert.equal(decisionReducer(initial, { type: 'change-time', ...change as TimeChange }), initial);
  }
  assert.equal(JSON.stringify(initial), before);
  // Extra caller fields cannot become a second changed circumstance.
  const committed = decisionReducer(initial, { type: 'change-time', field: 'departureMinutes', minutes: 990, homeByMinutes: 1350 } as DecisionEvent);
  assert.equal(committed.snapshots.changed!.inputs.homeByMinutes, 1410);
  assert.deepEqual(selectDecisionDeltas(committed)!.inputChanges, [{ path: 'departureMinutes', before: 1020, after: 990 }]);
});

test('time preview is pure and repeatable, and applying commits exactly the previewed comparison', () => {
  let initial = choose(createDecisionSession(), 'sz');
  initial = decisionReducer(initial, { type: 'set-priorities', priorities: ['company'] });
  initial = decisionReducer(initial, { type: 'set-reason', snapshotId: 'baseline', reason: 'I want the full walk.' });
  const before = JSON.stringify(initial);
  for (const change of [
    { field: 'departureMinutes', minutes: 990 }, { field: 'homeByMinutes', minutes: 1350 },
  ] as const) {
    const first = previewTimeChange(initial, change);
    const second = previewTimeChange(initial, change);
    assert.deepEqual(first, second);
    assert.equal(first.valid, true);
    if (!first.valid) throw new Error(first.error);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.snapshot.inputs));
    assert.equal(first.snapshot.inputs, first.snapshot.result.inputs);
    assert.equal(initial.snapshots.changed, null);
    assert.equal(initial.choices.changed, null);
    const committed = decisionReducer(initial, { type: 'change-time', ...change });
    assert.deepEqual(committed.snapshots.changed, first.snapshot);
    assert.equal(committed.snapshots.baseline, initial.snapshots.baseline);
    assert.equal(committed.choices.baseline, initial.choices.baseline);
    assert.equal(committed.priorities, initial.priorities);
  }
  assert.equal(JSON.stringify(initial), before);
});

test('time change needs a tentative choice and allows only one committed circumstance per replay', () => {
  const fresh = createDecisionSession();
  const change: TimeChange = { field: 'departureMinutes', minutes: 990 };
  assert.equal(previewTimeChange(fresh, change).valid, false);
  assert.equal(decisionReducer(fresh, { type: 'change-time', ...change }), fresh);
  assert.equal(selectDecisionView(fresh).canChangeTime, false);
  assert.equal(selectDecisionView(fresh).timeChange, null);
  const selected = choose(fresh, 'sz');
  assert.equal(selectDecisionView(selected).canChangeTime, true);
  const committed = decisionReducer(selected, { type: 'change-time', ...change });
  const completed = decisionReducer(committed, { type: 'apply-revision', revision: 'keep-sz' });
  const replay = decisionReducer(completed, { type: 'view-snapshot', snapshotId: 'baseline' });
  for (const session of [committed, completed, replay]) {
    assert.equal(selectDecisionView(session).canChangeTime, false);
    for (const attempt of [change, { field: 'homeByMinutes', minutes: 1350 }] as const) {
      assert.equal(previewTimeChange(session, attempt).valid, false);
      assert.equal(decisionReducer(session, { type: 'change-time', ...attempt }), session);
    }
    assert.equal(decisionReducer(session, { type: 'set-priorities', priorities: ['comfort'] }), session);
  }
  const reset = decisionReducer(replay, { type: 'reset' });
  assert.deepEqual(reset, createDecisionSession());
  assert.equal(previewTimeChange(choose(reset, 'hk'), { field: 'homeByMinutes', minutes: 1350 }).valid, true);
});

test('every allowed one-field time preview, full-plan commit, revision and replay shares an unclipped fixed axis', () => {
  const initial = choose(createDecisionSession(), 'sz');
  assert.deepEqual(DECISION_TIMELINE_RANGE, { startMinutes: 900, endMinutes: 1560 });
  assert.equal(selectDecisionView(initial).timelineRange, DECISION_TIMELINE_RANGE);
  for (const field of ['departureMinutes', 'homeByMinutes'] as const) {
    const { min, max, step } = DECISION_TIME_LIMITS[field];
    for (let minutes = min; minutes <= max; minutes += step) {
      if (minutes === initial.snapshots.baseline.inputs[field]) continue;
      const preview = previewTimeChange(initial, { field, minutes });
      assert.equal(preview.valid, true);
      if (!preview.valid) throw new Error(preview.error);
      const session = decisionReducer(initial, { type: 'change-time', field, minutes });
      assert.deepEqual(selectDecisionDeltas(session)!.inputChanges, [{ path: field, before: initial.snapshots.baseline.inputs[field], after: minutes }]);
      for (const revision of ['keep-hk', 'keep-sz', 'shorten-sz'] as const) {
        const completed = decisionReducer(session, { type: 'apply-revision', revision });
        for (const snapshotId of ['baseline', 'changed', 'revised'] as const) {
          const replay = decisionReducer(completed, { type: 'view-snapshot', snapshotId });
          assert.equal(selectDecisionView(replay).timelineRange, DECISION_TIMELINE_RANGE);
          const snapshot = replay.snapshots[snapshotId]!;
          assert.ok(snapshot.inputs.homeByMinutes >= DECISION_TIMELINE_RANGE.startMinutes);
          assert.ok(snapshot.inputs.homeByMinutes <= DECISION_TIMELINE_RANGE.endMinutes);
          for (const item of snapshot.result.options) {
            assert.ok(item.departureMinutes >= DECISION_TIMELINE_RANGE.startMinutes);
            assert.ok(item.returnMinutes <= DECISION_TIMELINE_RANGE.endMinutes);
            assert.equal(item.perPersonHKD, item.id === 'hk' ? 336 : 291.83);
            assert.equal(item.mealMinutes, 90);
            assert.equal(item.storyDelayMinutes, 0);
            assert.equal(item.includeSharedOrder, true);
            assert.equal(item.score, null);
          }
        }
      }
    }
  }
});

test('unknown costs and eligibility survive time previews, full Shenzhen commitment and snapshot replay', () => {
  const fixture = structuredClone(illustrativeData);
  fixture.shenzhen.costs[0].amount = null;
  const initial = choose(createDecisionSession({ fixture, fixtureVersion: 'time-change-unknown-cost-v1' }), 'sz');
  fixture.shenzhen.costs[0].amount = 1;
  const preview = previewTimeChange(initial, { field: 'departureMinutes', minutes: 990 });
  assert.equal(preview.valid, true);
  if (!preview.valid) throw new Error(preview.error);
  const changed = decisionReducer(initial, { type: 'change-time', field: 'departureMinutes', minutes: 990 });
  const completed = decisionReducer(changed, { type: 'apply-revision', revision: 'keep-sz' });
  for (const snapshot of [preview.snapshot, completed.snapshots.baseline, completed.snapshots.changed!, completed.snapshots.revised!]) {
    const sz = option(snapshot, 'sz');
    assert.equal(snapshot.fixtureVersion, 'time-change-unknown-cost-v1');
    assert.equal(sz.perPersonHKD, null);
    assert.equal(sz.groupHKD, null);
    assert.equal(sz.budgetFeasible, null);
    assert.equal(sz.entryFeasible, null);
    assert.equal(sz.feasible, null);
    assert.equal(sz.score, null);
    assert.deepEqual(sz.familiarity, { dinner: 'unsure', walk: 'unsure' });
    assert.equal(sz.walkMinutes, 45);
  }
  assert.equal(selectDecisionDeltas(completed)!.options[1].perPersonCostChangeHKD, null);
  assert.match(selectDecisionDeltas(completed)!.options[1].facts.join(' '), /whole-outing cost is unknown/);
});
