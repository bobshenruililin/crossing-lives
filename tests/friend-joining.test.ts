import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeData } from '../src/domain/data';
import { compareOutings } from '../src/domain/engine';
import type { OptionId, OutingFixture, OutingInputs } from '../src/domain/model';
import { createDecisionSession, DECISION_PRESET_INPUTS, decisionReducer } from '../src/decision/session';
import type { DecisionSession } from '../src/decision/session';
import {
  createFriendJoiningSession, FRIEND_JOINING_SCOPE_NOTES, friendJoiningReducer,
  previewFriendJoining, selectFriendJoiningView,
} from '../src/decision/friendJoining';
import type { FriendJoiningEvent, FriendJoiningSession, FriendJoiningSnapshot } from '../src/decision/friendJoining';

const option = (snapshot: FriendJoiningSnapshot, id: OptionId) => snapshot.result.options.find(item => item.id === id)!;
const chosen = (session = createFriendJoiningSession(), id: OptionId = 'sz') =>
  friendJoiningReducer(session, { type: 'choose-option', snapshotId: 'before', optionId: id });
const committed = (session = chosen()) => friendJoiningReducer(session, { type: 'commit-friend-joining' });
const preview = (session = chosen()) => {
  const result = previewFriendJoining(session);
  assert.equal(result.valid, true);
  if (!result.valid) throw new Error(result.error);
  return result.snapshot;
};

test('default before snapshot reuses the authored input and engine, with no new fixture or scoring', () => {
  const session = createFriendJoiningSession();
  assert.deepEqual(session.snapshots.before.inputs, DECISION_PRESET_INPUTS);
  assert.deepEqual(session.snapshots.before.result, compareOutings(structuredClone(DECISION_PRESET_INPUTS) as OutingInputs));
  assert.equal(session.snapshots.before.inputs, session.snapshots.before.result.inputs);
  assert.equal(session.choices.before, null);
  assert.equal(session.choices.changed, null);
  assert.equal(session.sourceChoice, null);
  assert.deepEqual(session.historicalPriorities, []);
  assert.ok(Object.isFrozen(session));
  assert.ok(Object.isFrozen(session.fixture.local.costs[0]));
  assert.ok(Object.isFrozen(session.snapshots.before.result.options[1].lineItems[0]));
  for (const item of session.snapshots.before.result.options) {
    assert.equal(item.score, null);
    assert.equal(item.scoreBreakdown.totalWeight, 0);
  }
});

test('only party size changes; all timing, route, budget, familiarity and activity inputs stay exact', () => {
  const session = committed();
  const before = session.snapshots.before;
  const after = session.snapshots.changed!;
  assert.deepEqual(after.inputs, { ...before.inputs, partySize: 3 });
  assert.equal(before.inputs.partySize, 2);
  assert.equal(after.inputs, after.result.inputs);
  for (const id of ['hk', 'sz'] as const) {
    const a = option(before, id);
    const b = option(after, id);
    for (const key of [
      'routeLabel', 'departureMinutes', 'arrivalMinutes', 'experienceEndMinutes', 'returnMinutes',
      'homeByMinutes', 'spareMinutes', 'outwardMinutes', 'inwardMinutes', 'mealMinutes', 'walkMinutes',
      'storyDelayMinutes', 'includeSharedOrder', 'experienceMinutes', 'totalMinutes', 'borderBufferMinutes',
      'homeFeasible', 'crossingFeasible', 'entryFeasible', 'normalizedBudgetPerPersonHKD',
    ] as const) assert.equal(b[key], a[key], `${id}.${key}`);
    assert.deepEqual(b.crossingPlan, a.crossingPlan);
    assert.deepEqual(b.familiarity, a.familiarity);
  }
  assert.deepEqual([option(after, 'hk').returnMinutes, option(after, 'sz').returnMinutes], [1185, 1365]);
  assert.ok(Object.isFrozen(after.inputs.itineraryOverrides!.sz));
});

test('exact HKD cents scale meals and round trips for three while keeping only ONE shared extra', () => {
  const session = committed();
  const before = option(session.snapshots.before, 'hk');
  const after = option(session.snapshots.changed!, 'hk');
  assert.deepEqual([before.groupHKD, before.perPersonHKD, after.groupHKD, after.perPersonHKD], [672, 336, 976, 325.33]);
  assert.equal(after.knownGroupSubtotalHKD, 976);
  assert.deepEqual(after.lineItems.map(line => [
    line.id, line.scope, line.quantity, line.nativeUnitAmount, line.nativeGroupAmount, line.hkdGroupAmount, line.hkdPerPersonAmount,
  ]), [
    ['hk-dinner', 'per-person', 1, 248, 744, 744, 248],
    ['hk-drinks', 'per-person', 1, 32, 96, 96, 32],
    ['hk-shared', 'group', 1, 64, 64, 64, 21.33],
    ['hk-transport', 'per-person', 2, 12, 72, 72, 24],
  ]);
  const delta = selectFriendJoiningView(session).deltas!.find(item => item.optionId === 'hk')!;
  assert.deepEqual(delta, { optionId: 'hk', perPersonCostChangeHKD: -10.67, groupCostChangeHKD: 304, knownGroupSubtotalChangeHKD: 304 });
  assert.notEqual(after.perPersonHKD, 672 / 3, 'The pair’s bill is not divided by three.');
});

test('native CNY lines convert in cents before group addition and per-person rounding', () => {
  const session = committed();
  const before = option(session.snapshots.before, 'sz');
  const after = option(session.snapshots.changed!, 'sz');
  assert.deepEqual([before.groupHKD, before.perPersonHKD, after.groupHKD, after.perPersonHKD], [583.66, 291.83, 843.88, 281.29]);
  assert.equal(after.knownGroupSubtotalHKD, 843.88);
  assert.deepEqual(after.lineItems.map(line => [
    line.id, line.currency, line.scope, line.quantity, line.nativeUnitAmount, line.nativeGroupAmount, line.hkdGroupAmount, line.hkdPerPersonAmount,
  ]), [
    ['sz-dinner', 'CNY', 'per-person', 1, 128, 384, 418.56, 139.52],
    ['sz-drinks', 'CNY', 'per-person', 1, 18, 54, 58.86, 19.62],
    ['sz-shared', 'CNY', 'group', 1, 58, 58, 63.22, 21.07],
    ['sz-cross-border', 'HKD', 'per-person', 2, 44, 264, 264, 88],
    ['sz-local-transport', 'CNY', 'per-person', 2, 6, 36, 39.24, 13.08],
  ]);
  for (const line of after.lineItems) {
    const old = before.lineItems.find(item => item.id === line.id)!;
    assert.equal(line.quantity, old.quantity, 'Quantity describes one adult’s line or the one group extra.');
    assert.equal(line.nativeUnitAmount, old.nativeUnitAmount);
    assert.equal(line.scope, old.scope);
  }
  const delta = selectFriendJoiningView(session).deltas!.find(item => item.optionId === 'sz')!;
  assert.deepEqual(delta, { optionId: 'sz', perPersonCostChangeHKD: -10.54, groupCostChangeHKD: 260.22, knownGroupSubtotalChangeHKD: 260.22 });
  assert.notEqual(Math.round(after.perPersonHKD! * 3 * 100), Math.round(after.groupHKD! * 100), 'An average is not a payment allocation.');
  assert.notEqual(after.perPersonHKD, Math.round(583.66 / 3 * 100) / 100);
});

test('repeated previews and cancellation are free; explicit commit captures exactly the preview', () => {
  let session = chosen();
  session = friendJoiningReducer(session, { type: 'set-reason', snapshotId: 'before', reason: 'The longer walk interests me.' });
  const serialized = JSON.stringify(session);
  const first = preview(session);
  assert.deepEqual(preview(session), first);
  assert.equal(JSON.stringify(session), serialized);
  assert.equal(session.snapshots.changed, null);
  assert.equal(session.choices.changed, null);
  // Discarding both previews is cancellation; there is no cancel action, clock or bill to undo.
  const applied = committed(session);
  assert.deepEqual(applied.snapshots.changed, first);
  assert.equal(applied.snapshots.before, session.snapshots.before);
  assert.equal(applied.choices.before, session.choices.before);
  assert.equal(applied.choices.changed, null, 'Changing the circumstance never chooses a city.');
  assert.equal(applied.stage, 'changed');
  assert.equal(applied.displayedSnapshotId, 'changed');
  assert.equal(JSON.stringify(session), serialized);
});

test('out-of-order and repeated actions cannot advance twice or rewrite historical choices', () => {
  const fresh = createFriendJoiningSession();
  assert.equal(previewFriendJoining(fresh).valid, false);
  for (const event of [
    { type: 'commit-friend-joining' },
    { type: 'set-reason', snapshotId: 'before', reason: 'No choice yet.' },
    { type: 'choose-option', snapshotId: 'changed', optionId: 'hk' },
    { type: 'set-reason', snapshotId: 'changed', reason: 'Too soon.' },
    { type: 'view-snapshot', snapshotId: 'changed' },
    { type: 'choose-option', snapshotId: 'before', optionId: 'other' },
    { type: 'view-snapshot', snapshotId: '__proto__' },
    { type: 'change-time', field: 'departureMinutes', minutes: 990 },
  ]) assert.equal(friendJoiningReducer(fresh, event as FriendJoiningEvent), fresh);
  const before = chosen();
  assert.equal(chosen(before), before);
  let session = committed(before);
  const snapshots = session.snapshots;
  for (const snapshotId of ['before', 'changed', 'before', 'changed'] as const) {
    session = friendJoiningReducer(session, { type: 'view-snapshot', snapshotId });
    assert.equal(session.stage, 'changed');
    assert.equal(session.snapshots, snapshots);
    assert.equal(previewFriendJoining(session).valid, false);
    assert.equal(committed(session), session);
    assert.equal(friendJoiningReducer(session, { type: 'choose-option', snapshotId: 'before', optionId: 'hk' }), session);
    assert.equal(friendJoiningReducer(session, { type: 'set-reason', snapshotId: 'before', reason: 'Rewrite history.' }), session);
    assert.equal(selectFriendJoiningView(session).canCommitFriendJoining, false);
  }
  assert.equal(session.snapshots.changed!.inputs.partySize, 3);
  assert.equal(option(session.snapshots.changed!, 'hk').groupHKD, 976);
});

test('city choices and exact explicit reasons stay separate from facts and never create scores', () => {
  let session = committed();
  const snapshots = session.snapshots;
  const evidence = JSON.stringify(snapshots);
  assert.equal(friendJoiningReducer(session, { type: 'set-reason', snapshotId: 'changed', reason: 'No implicit choice.' }), session);
  session = friendJoiningReducer(session, { type: 'choose-option', snapshotId: 'changed', optionId: 'hk' });
  assert.deepEqual(session.choices.changed, { optionId: 'hk', reason: null });
  session = friendJoiningReducer(session, { type: 'set-reason', snapshotId: 'changed', reason: '  I prefer more time together nearby.  ' });
  assert.equal(session.choices.changed!.reason, 'I prefer more time together nearby.');
  assert.equal(friendJoiningReducer(session, { type: 'set-reason', snapshotId: 'changed', reason: 'I prefer more time together nearby.' }), session);
  assert.equal(friendJoiningReducer(session, { type: 'set-reason', snapshotId: 'changed', reason: 10 } as unknown as FriendJoiningEvent), session);
  assert.equal(session.snapshots, snapshots);
  assert.equal(JSON.stringify(snapshots), evidence);
  const view = selectFriendJoiningView(session);
  assert.equal('recommendation' in view, false);
  for (const item of view.options) {
    assert.equal('score' in item, false);
    assert.equal('scoreBreakdown' in item, false);
  }
  assert.equal(view.changedChoice!.reason, 'I prefer more time together nearby.');
  session = friendJoiningReducer(session, { type: 'choose-option', snapshotId: 'changed', optionId: 'sz' });
  assert.deepEqual(session.choices.changed, { optionId: 'sz', reason: null });
  session = friendJoiningReducer(session, { type: 'set-reason', snapshotId: 'changed', reason: '   ' });
  assert.equal(session.choices.changed!.reason, null);
  for (const item of session.snapshots.changed!.result.options) assert.equal(item.score, null);
});

test('captures the revised source plan; the earlier reason/priorities remain explicitly historical', () => {
  let source = createDecisionSession();
  source = decisionReducer(source, { type: 'set-priorities', priorities: ['company', 'exploration'] });
  source = decisionReducer(source, { type: 'choose-option', snapshotId: 'baseline', optionId: 'sz' });
  source = decisionReducer(source, { type: 'change-time', field: 'departureMinutes', minutes: 990 });
  source = decisionReducer(source, { type: 'apply-revision', revision: 'shorten-sz', reason: 'My earlier two-adult reason.' });
  // A replay tab must not replace the actual revised source plan.
  source = decisionReducer(source, { type: 'view-snapshot', snapshotId: 'baseline' });
  const sourceBefore = JSON.stringify(source);
  const initial = createFriendJoiningSession(source);
  assert.equal(initial.sourceSnapshotId, 'revised');
  assert.deepEqual(initial.snapshots.before.inputs, source.snapshots.revised!.inputs);
  assert.deepEqual(initial.sourceChoice, source.choices.revised);
  assert.deepEqual(initial.choices.before, { optionId: 'sz', reason: null });
  assert.equal(initial.choices.changed, null);
  const session = committed(initial);
  assert.deepEqual(session.snapshots.changed!.inputs, { ...source.snapshots.revised!.inputs, partySize: 3 });
  assert.equal(option(session.snapshots.changed!, 'sz').walkMinutes, 15);
  assert.equal(option(session.snapshots.changed!, 'sz').returnMinutes, 1305);
  const view = selectFriendJoiningView(session);
  assert.deepEqual(view.historicalContext, {
    sourceSnapshotId: 'revised', choice: { optionId: 'sz', reason: 'My earlier two-adult reason.' }, priorities: ['company', 'exploration'],
  });
  assert.equal('priorities' in view, false, 'Earlier priorities are not presented as newly confirmed.');
  assert.equal(view.changedChoice, null);
  assert.equal(JSON.stringify(source), sourceBefore);
});

test('entry remains unknown for all adults and a party change cannot fix a time/crossing failure or switch city', () => {
  let source = decisionReducer(createDecisionSession(), { type: 'choose-option', snapshotId: 'baseline', optionId: 'sz' });
  source = decisionReducer(source, { type: 'change-time', field: 'departureMinutes', minutes: 1200 });
  source = decisionReducer(source, { type: 'apply-revision', revision: 'keep-sz' });
  let session = committed(createFriendJoiningSession(source));
  for (const snapshot of [session.snapshots.before, session.snapshots.changed!]) {
    assert.equal(snapshot.inputs.entryEligibility, 'unsure');
    const sz = option(snapshot, 'sz');
    assert.equal(sz.entryFeasible, null);
    assert.equal(sz.homeFeasible, false);
    assert.equal(sz.crossingFeasible, false);
    assert.equal(sz.feasible, false);
    assert.equal(sz.score, null);
  }
  assert.equal(session.choices.before!.optionId, 'sz');
  assert.equal(session.choices.changed, null);
  session = friendJoiningReducer(session, { type: 'choose-option', snapshotId: 'changed', optionId: 'sz' });
  assert.equal(option(session.snapshots.changed!, 'sz').entryFeasible, null);
  assert.equal(session.snapshots.changed!.inputs.entryEligibility, 'unsure');
  assert.equal('recommendation' in selectFriendJoiningView(session), false);
  assert.match(FRIEND_JOINING_SCOPE_NOTES.join(' '), /unknown for every adult, including the joining friend/);
  assert.match(FRIEND_JOINING_SCOPE_NOTES.join(' '), /does not rewrite that journey/);
  assert.match(FRIEND_JOINING_SCOPE_NOTES.join(' '), /same ONE shared extra/);
});

test('fixture, inputs and source context are owned immutable captures, even if the caller mutates its copies', () => {
  const fixture: OutingFixture = structuredClone(illustrativeData);
  let source = createDecisionSession({ fixture, fixtureVersion: 'friend-capture-v1' });
  source = decisionReducer(source, { type: 'set-priorities', priorities: ['comfort'] });
  source = decisionReducer(source, { type: 'choose-option', snapshotId: 'baseline', optionId: 'hk' });
  source = decisionReducer(source, { type: 'set-reason', snapshotId: 'baseline', reason: 'Earlier context.' });
  const mutableSource = structuredClone(source);
  const session = createFriendJoiningSession(mutableSource);
  const before = JSON.stringify(session);
  fixture.local.costs[0].amount = 999;
  (mutableSource.fixture as OutingFixture).shenzhen.costs[0].amount = 999;
  (mutableSource.snapshots.baseline.inputs as OutingInputs).departureMinutes = 1200;
  (mutableSource.choices.baseline as { reason: string }).reason = 'Outside edit.';
  (mutableSource.priorities as string[]).push('food');
  const applied = committed(session);
  assert.equal(JSON.stringify(session), before);
  assert.equal(option(applied.snapshots.changed!, 'sz').groupHKD, 843.88);
  assert.equal(option(applied.snapshots.changed!, 'hk').groupHKD, 976);
  assert.equal(applied.snapshots.changed!.inputs.departureMinutes, 1020);
  assert.equal(applied.sourceChoice!.reason, 'Earlier context.');
  assert.deepEqual(applied.historicalPriorities, ['comfort']);
  assert.equal(applied.snapshots.before.fixtureVersion, 'friend-capture-v1');
  assert.equal(applied.snapshots.changed!.fixtureVersion, 'friend-capture-v1');
  assert.notEqual(session.fixture, source.fixture);
  assert.notEqual(session.snapshots.before.inputs, source.snapshots.baseline.inputs);
  assert.throws(() => { (session.fixture as OutingFixture).shenzhen.costs[0].amount = 1; }, TypeError);
  assert.throws(() => { (session.snapshots.before.inputs as OutingInputs).partySize = 4; }, TypeError);
});

test('missing per-person, group and fare costs stay unknown; only labelled known subtotals change', () => {
  const cases: Array<{ id: OptionId; missingId: string; edit: (fixture: OutingFixture) => void; before: number; after: number }> = [
    { id: 'hk', missingId: 'hk-dinner', edit: f => { f.local.costs[0].amount = null; }, before: 176, after: 232 },
    { id: 'hk', missingId: 'hk-shared', edit: f => { f.local.costs[2].amount = null; }, before: 608, after: 912 },
    { id: 'sz', missingId: 'sz-dinner', edit: f => { f.shenzhen.costs[0].amount = null; }, before: 304.62, after: 425.32 },
    { id: 'sz', missingId: 'sz-shared', edit: f => { f.shenzhen.costs[2].amount = null; }, before: 520.44, after: 780.66 },
    { id: 'sz', missingId: 'sz-cross-border', edit: f => { f.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = null; }, before: 407.66, after: 579.88 },
  ];
  for (const item of cases) {
    const fixture = structuredClone(illustrativeData);
    item.edit(fixture);
    const source = createDecisionSession({ fixture, fixtureVersion: `missing-${item.missingId}-v1` });
    const initial = chosen(createFriendJoiningSession(source));
    const draft = preview(initial);
    const session = committed(initial);
    assert.deepEqual(session.snapshots.changed, draft);
    for (const [snapshot, subtotal] of [[session.snapshots.before, item.before], [draft, item.after]] as const) {
      const outing = option(snapshot, item.id);
      assert.equal(outing.groupHKD, null);
      assert.equal(outing.perPersonHKD, null);
      assert.equal(outing.knownGroupSubtotalHKD, subtotal);
      assert.equal(outing.budgetFeasible, null);
      assert.equal(outing.feasible, null);
      assert.equal(outing.score, null);
      const line = outing.lineItems.find(cost => cost.id === item.missingId)!;
      assert.equal(line.status, 'missing');
      assert.equal(line.hkdGroupAmount, null);
      assert.equal(line.hkdPerPersonAmount, null);
      assert.deepEqual(outing.missingCostLabels, [line.label]);
    }
    const delta = selectFriendJoiningView(session).deltas!.find(change => change.optionId === item.id)!;
    assert.equal(delta.perPersonCostChangeHKD, null);
    assert.equal(delta.groupCostChangeHKD, null);
    assert.equal(delta.knownGroupSubtotalChangeHKD, Math.round((item.after - item.before) * 100) / 100);
  }
});

test('source bounds reject a changed party, scoring, eligibility attestation or altered shared-order scope', () => {
  const alterInputs = (edit: (inputs: OutingInputs) => void) => {
    const source = structuredClone(createDecisionSession());
    edit(source.snapshots.baseline.inputs as OutingInputs);
    return source;
  };
  for (const source of [
    alterInputs(inputs => { inputs.partySize = 3; }),
    alterInputs(inputs => { inputs.entryEligibility = 'confirmed'; }),
    alterInputs(inputs => { inputs.weights.price = 1; }),
    alterInputs(inputs => { inputs.itineraryOverrides!.sz!.includeSharedOrder = false; }),
  ]) assert.throws(() => createFriendJoiningSession(source));
  for (const edit of [
    (f: OutingFixture) => { f.local.costs[2].quantity = 2; },
    (f: OutingFixture) => { f.shenzhen.costs[2].scope = 'per-person'; },
    (f: OutingFixture) => { f.shenzhen.costs[2].optionalSharedOrder = false; },
    (f: OutingFixture) => { f.local.costs.push({ ...f.local.costs[2], id: 'another-shared-extra' }); },
  ]) {
    const fixture = structuredClone(illustrativeData);
    edit(fixture);
    assert.throws(() => createFriendJoiningSession(createDecisionSession({ fixture })), /same ONE/);
  }
  const mismatchedVersion = { ...createDecisionSession(), fixtureVersion: 'different' } as DecisionSession;
  assert.throws(() => createFriendJoiningSession(mismatchedVersion), /fixture version/);
});

test('the pure domain episode never reads browser storage or a wall clock', () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const name of ['localStorage', 'sessionStorage', 'document', 'window']) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`Do not access ${name}`); } });
  }
  const now = Date.now;
  Date.now = () => { throw new Error('Do not advance a real clock.'); };
  try {
    const initial = chosen();
    preview(initial);
    const session: FriendJoiningSession = committed(initial);
    selectFriendJoiningView(session);
    assert.equal(session.snapshots.changed!.inputs.departureMinutes, 1020);
  } finally {
    Date.now = now;
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
