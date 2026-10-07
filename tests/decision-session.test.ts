import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeData } from '../src/domain/data';
import type { OptionId, OutingFixture } from '../src/domain/model';
import {
  createDecisionSession, decisionReducer, previewRevision, selectDecisionDeltas, selectDecisionView,
  DECISION_FIXTURE_VERSION, DECISION_PRESET_INPUTS, DECISION_SCOPE_NOTES,
} from '../src/decision/session';
import type { DecisionEvent, DecisionSession, DecisionSnapshot } from '../src/decision/session';

const option = (snapshot: DecisionSnapshot, id: OptionId) => snapshot.result.options.find(item => item.id === id)!;
const choose = (state: DecisionSession, optionId: OptionId): DecisionSession => decisionReducer(state, { type: 'choose-option', snapshotId: state.stage, optionId });
const changed = (optionId: OptionId = 'sz', state = createDecisionSession()) => decisionReducer(choose(state, optionId), { type: 'change-deadline' });
const revised = (revision: 'keep-hk' | 'shorten-sz' = 'shorten-sz', initial: OptionId = 'sz') => decisionReducer(changed(initial), { type: 'apply-revision', revision });

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
    { type: 'change-deadline' }, { type: 'apply-revision', revision: 'shorten-sz' },
    { type: 'choose-option', snapshotId: 'changed', optionId: 'sz' },
    { type: 'choose-option', snapshotId: 'revised', optionId: 'hk' },
    { type: 'set-reason', snapshotId: 'baseline', reason: 'No choice exists' },
    { type: 'view-snapshot', snapshotId: 'changed' }, { type: 'view-snapshot', snapshotId: 'revised' },
  ];
  for (const event of outOfOrder) assert.equal(decisionReducer(initial, event), initial);
  assert.equal(previewRevision(initial, 'shorten-sz'), null);
  const selected = choose(initial, 'sz');
  assert.equal(choose(selected, 'sz'), selected);
  const afterChange = decisionReducer(selected, { type: 'change-deadline' });
  assert.equal(decisionReducer(afterChange, { type: 'change-deadline' }), afterChange);
  const afterRevision = decisionReducer(afterChange, { type: 'apply-revision', revision: 'shorten-sz' });
  for (const revision of ['keep-hk', 'shorten-sz'] as const) assert.equal(decisionReducer(afterRevision, { type: 'apply-revision', revision }), afterRevision);
  assert.equal(decisionReducer(afterRevision, { type: 'change-deadline' }), afterRevision);
});

test('a revised choice cannot contradict the alternative committed with its immutable snapshot', () => {
  for (const revision of ['keep-hk', 'shorten-sz'] as const) {
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
  state = decisionReducer(state, { type: 'change-deadline' });
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
  const afterChange = decisionReducer(withReason, { type: 'change-deadline' });
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
    assert.deepEqual(view.timelineRange, { startMinutes: 1020, endMinutes: 1410 });
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
