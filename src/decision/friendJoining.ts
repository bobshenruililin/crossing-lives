import { compareOutings } from '../domain/engine';
import type { ComparisonResult, OptionId, OutingFixture, OutingInputs, OutingOption } from '../domain/model';
import { createDecisionSession } from './session';
import type { DecisionChoice, DecisionSession, DeepReadonly, Priority, SnapshotId } from './session';

export type FriendJoiningSnapshotId = 'before' | 'changed';
export const FRIEND_JOINING_EPISODE_ID = 'same-outing-friend-joins-two-to-three-v1';
export const FRIEND_JOINING_SCOPE_NOTES: readonly string[] = Object.freeze([
  'A new optional planning what-if before departure: a third adult joins at the same origin and all three travel together. Opening it after an earlier scene’s arrival does not rewrite that journey.',
  'Only party size changes, from two to three. Departure, home-by, routes, activity durations, prices and FX stay fixed.',
  'Each adult still has a per-person meal, drinks and round-trip transport. Each city keeps the same ONE shared extra at the same quantity and group price; this is not a claim about how many people it feeds.',
  'The group total can rise while the rounded per-person average falls. A rounded average is not an exact three-way payment allocation.',
  'Entry eligibility is unknown for every adult, including the joining friend. No choice or commit confirms anyone’s eligibility.',
  'Earlier reasons and priorities are historical context. A reason for the new three-adult decision must be supplied explicitly; earlier priorities need reconfirming before being used in the new scene.',
  'Preview and cancellation are free inspection. Committing the party change records a comparison, not a booking, departure, payment or automatic city choice.',
  'Prices, FX and required durations are authored illustrative assumptions, not live quotes or guaranteed travel times.',
]);

function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export interface FriendJoiningSnapshot {
  readonly id: FriendJoiningSnapshotId;
  readonly fixtureVersion: string;
  readonly inputs: DeepReadonly<OutingInputs>;
  /** Exact engine evidence. Recommendation and rubric fields are excluded from the presentation selector. */
  readonly result: DeepReadonly<ComparisonResult>;
}

export interface FriendJoiningSession {
  readonly episodeId: typeof FRIEND_JOINING_EPISODE_ID;
  readonly sourceSnapshotId: SnapshotId;
  readonly fixtureVersion: string;
  readonly fixture: DeepReadonly<OutingFixture>;
  readonly stage: FriendJoiningSnapshotId;
  readonly displayedSnapshotId: FriendJoiningSnapshotId;
  readonly snapshots: Readonly<{ before: FriendJoiningSnapshot; changed: FriendJoiningSnapshot | null }>;
  readonly choices: Readonly<Record<FriendJoiningSnapshotId, DecisionChoice | null>>;
  /** Historical context only; never copied into the reason for the new decision. */
  readonly sourceChoice: DecisionChoice | null;
  readonly historicalPriorities: readonly Priority[];
}

export type FriendJoiningPreview =
  | { readonly valid: true; readonly snapshot: FriendJoiningSnapshot }
  | { readonly valid: false; readonly error: string };

export type FriendJoiningEvent =
  | { type: 'choose-option'; snapshotId: FriendJoiningSnapshotId; optionId: OptionId }
  | { type: 'set-reason'; snapshotId: FriendJoiningSnapshotId; reason: string }
  | { type: 'commit-friend-joining' }
  | { type: 'view-snapshot'; snapshotId: FriendJoiningSnapshotId };

function makeSnapshot(
  id: FriendJoiningSnapshotId, inputs: DeepReadonly<OutingInputs>,
  fixture: DeepReadonly<OutingFixture>, fixtureVersion: string,
): FriendJoiningSnapshot {
  const capturedInputs = structuredClone(inputs) as OutingInputs;
  const result = compareOutings(capturedInputs, fixture as OutingFixture);
  if (!result.valid) throw new Error(`Invalid authored friend-joining inputs: ${result.errors.join(' ')}`);
  return freeze({ id, fixtureVersion, inputs: capturedInputs, result });
}

/** Capture a prior comparison, including a revised time/shortened walk, without changing it or its movement state. */
export function createFriendJoiningSession(source: DecisionSession = createDecisionSession()): FriendJoiningSession {
  const current = source.snapshots[source.stage];
  if (!current || current.inputs.partySize !== 2 || current.inputs.entryEligibility !== 'unsure'
    || Object.values(current.inputs.weights).some(weight => weight !== 0)) {
    throw new Error('This authored episode requires two adults, unknown entry eligibility and no preference scoring.');
  }
  if (current.fixtureVersion !== source.fixtureVersion) throw new Error('The source snapshot must use its captured fixture version.');
  const fixture = freeze(structuredClone(source.fixture));
  for (const id of ['hk', 'sz'] as const) {
    const costs = id === 'hk' ? fixture.local.costs : fixture.shenzhen.costs;
    const shared = costs.filter(cost => cost.scope === 'group');
    if (current.inputs.itineraryOverrides?.[id]?.includeSharedOrder === false
      || shared.length !== 1 || shared[0].id !== `${id}-shared`
      || shared[0].optionalSharedOrder !== true || shared[0].quantity !== 1) {
      throw new Error('Each city must retain its same ONE explicitly group-scoped shared extra.');
    }
  }
  const before = makeSnapshot('before', current.inputs, fixture, source.fixtureVersion);
  const sourceChoice = structuredClone(source.choices[source.stage]);
  return freeze({
    episodeId: FRIEND_JOINING_EPISODE_ID, sourceSnapshotId: current.id,
    fixtureVersion: source.fixtureVersion, fixture, stage: 'before', displayedSnapshotId: 'before',
    snapshots: { before, changed: null },
    choices: { before: sourceChoice ? { optionId: sourceChoice.optionId, reason: null } : null, changed: null },
    sourceChoice, historicalPriorities: structuredClone(source.priorities),
  });
}

/** Pure, repeatable inspection. Cancel by discarding this value; there is no state or cost to roll back. */
export function previewFriendJoining(session: FriendJoiningSession): FriendJoiningPreview {
  if (session.stage !== 'before') return freeze({ valid: false, error: 'This episode already has its one committed party change.' });
  if (!session.choices.before) return freeze({ valid: false, error: 'Choose a tentative outing before comparing a friend joining.' });
  return freeze({ valid: true, snapshot: makeSnapshot(
    'changed', { ...session.snapshots.before.inputs, partySize: 3 }, session.fixture, session.fixtureVersion,
  ) });
}

/** Choice/reason changes never recompute outputs. Earlier choices freeze once the party change is committed. */
export function friendJoiningReducer(session: FriendJoiningSession, event: FriendJoiningEvent): FriendJoiningSession {
  switch (event.type) {
    case 'choose-option': {
      if (event.snapshotId !== session.stage || (event.optionId !== 'hk' && event.optionId !== 'sz')) return session;
      if (session.choices[event.snapshotId]?.optionId === event.optionId) return session;
      return freeze({ ...session, choices: { ...session.choices, [event.snapshotId]: { optionId: event.optionId, reason: null } } });
    }
    case 'set-reason': {
      if (event.snapshotId !== session.stage || typeof event.reason !== 'string') return session;
      const choice = session.choices[event.snapshotId];
      if (!choice) return session;
      const reason = event.reason.trim() || null;
      if (reason === choice.reason) return session;
      return freeze({ ...session, choices: { ...session.choices, [event.snapshotId]: { ...choice, reason } } });
    }
    case 'commit-friend-joining': {
      const preview = previewFriendJoining(session);
      if (!preview.valid) return session;
      return freeze({
        ...session, stage: 'changed', displayedSnapshotId: 'changed',
        snapshots: { before: session.snapshots.before, changed: preview.snapshot },
      });
    }
    case 'view-snapshot':
      if ((event.snapshotId !== 'before' && event.snapshotId !== 'changed')
        || !session.snapshots[event.snapshotId] || event.snapshotId === session.displayedSnapshotId) return session;
      return freeze({ ...session, displayedSnapshotId: event.snapshotId });
    default:
      return session;
  }
}

function optionFacts(option: DeepReadonly<OutingOption>) {
  const { score: _score, scoreBreakdown: _rubric, ...facts } = option;
  return facts;
}

const moneyChange = (before: number | null, after: number | null): number | null =>
  before === null || after === null ? null : Math.round((after - before) * 100) / 100;

/** Compact, unranked facts for later scene integration. No score, recommendation or inferred reason is presented. */
export function selectFriendJoiningView(session: FriendJoiningSession) {
  const displayed = session.snapshots[session.displayedSnapshotId]!;
  const changed = session.snapshots.changed;
  const deltas = changed ? session.snapshots.before.result.options.map(before => {
    const after = changed.result.options.find(option => option.id === before.id)!;
    return {
      optionId: before.id,
      perPersonCostChangeHKD: moneyChange(before.perPersonHKD, after.perPersonHKD),
      groupCostChangeHKD: moneyChange(before.groupHKD, after.groupHKD),
      knownGroupSubtotalChangeHKD: moneyChange(before.knownGroupSubtotalHKD, after.knownGroupSubtotalHKD),
    };
  }) : null;
  return freeze({
    stage: session.stage, displayedSnapshotId: session.displayedSnapshotId,
    availableSnapshotIds: (['before', 'changed'] as const).filter(id => session.snapshots[id] !== null),
    inputs: displayed.inputs, options: displayed.result.options.map(optionFacts),
    displayedChoice: session.choices[session.displayedSnapshotId],
    beforeChoice: session.choices.before, changedChoice: session.choices.changed,
    historicalContext: { sourceSnapshotId: session.sourceSnapshotId, choice: session.sourceChoice, priorities: session.historicalPriorities },
    canCommitFriendJoining: session.stage === 'before' && session.choices.before !== null,
    partyChange: changed ? { before: 2, after: 3 } as const : null,
    deltas, scopeNotes: FRIEND_JOINING_SCOPE_NOTES,
  });
}
