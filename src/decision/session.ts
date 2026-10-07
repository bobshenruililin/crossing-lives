import { illustrativeData } from '../domain/data';
import { compareOutings, formatClock } from '../domain/engine';
import type { ComparisonResult, OptionId, OutingFixture, OutingInputs, OutingOption } from '../domain/model';

export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type SnapshotId = 'baseline' | 'changed' | 'revised';
export type RevisionId = 'keep-hk' | 'keep-sz' | 'shorten-sz';
export type Priority = 'food' | 'company' | 'comfort' | 'exploration';
export type TimeChangeField = 'departureMinutes' | 'homeByMinutes';
export interface TimeChange { readonly field: TimeChangeField; readonly minutes: number }

export const DECISION_FIXTURE_VERSION = 'crossing-lives-illustrative-2026-10-06-v1';
export const DECISION_PRESET_ID = 'two-adults-earlier-home-v1';
export const DECISION_PRIORITIES: readonly Priority[] = Object.freeze(['food', 'company', 'comfort', 'exploration']);

function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Absolute minutes from departure-day midnight, UTC+8. After-midnight deadlines are 1440+, never 0–60. */
export const DECISION_TIME_LIMITS = freeze({
  departureMinutes: { min: 15 * 60, max: 20 * 60, step: 15 },
  homeByMinutes: { min: 20 * 60, max: 25 * 60, step: 15 },
});
/** One authored scale includes every supported full or shortened outing, before any preview is opened. */
export const DECISION_TIMELINE_RANGE = Object.freeze({ startMinutes: 15 * 60, endMinutes: 26 * 60 });

/** Fixed, fictional context. Both options consume this one matched input object. */
export const DECISION_PRESET_INPUTS: DeepReadonly<OutingInputs> = freeze({
  origin: 'kowloon', departureMinutes: 17 * 60, homeByMinutes: 23 * 60 + 30,
  budgetPerPersonHKD: 400, partySize: 2, mealMinutes: 90, walkMinutes: 45,
  weights: { price: 0, ease: 0, discovery: 0 }, szRoute: 'rail', fxHKDPerCNY: 1.09,
  borderBufferMinutes: 30, crossingClosingBufferMinutes: 15, hkLocalMinutes: 15, szLocalMinutes: 25,
  entryEligibility: 'unsure',
  familiarity: { hk: { dinner: 'unsure', walk: 'unsure' }, sz: { dinner: 'unsure', walk: 'unsure' } },
  itineraryOverrides: {
    hk: { mealMinutes: 90, walkMinutes: 45, includeSharedOrder: true, storyDelayMinutes: 0 },
    sz: { mealMinutes: 90, walkMinutes: 45, includeSharedOrder: true, storyDelayMinutes: 0 },
  },
});

export const DECISION_SCOPE_NOTES: readonly string[] = Object.freeze([
  'A fixed fictional example for two adults. Prices, FX and required journey durations are authored estimates, not live data.',
  'Both cities start with a 90-minute meal, shared order and 45-minute walk. Round-trip transport is included.',
  'Entry eligibility and activity familiarity are unknown. Crossing-hours fit does not verify transport service or immigration eligibility.',
  'Modeled slack is not a guarantee. Actual journeys and queues may take longer.',
  'Qualitative priorities and your reason are your own statements. They never alter the facts or create a preference ranking.',
  'Change one time in this authored evening: departure 15:00–20:00 on the same day, or home-by 20:00–01:00 the next day, in 15-minute steps. Other numeric assumptions stay fixed.',
  'After midnight is explicitly the next day. Arbitrary dates, other input editing and unknown required durations are not supported here.',
]);

export interface DecisionSnapshot {
  readonly id: SnapshotId;
  readonly fixtureVersion: string;
  readonly inputs: DeepReadonly<OutingInputs>;
  /** Exact engine output. Its recommendation is not the user's decision or a personal ranking. */
  readonly result: DeepReadonly<ComparisonResult>;
  readonly revision: RevisionId | null;
}

export interface DecisionChoice {
  readonly optionId: OptionId;
  /** Only explicit user text; null means no reason was supplied. */
  readonly reason: string | null;
}

export type TimeChangePreview =
  | { readonly valid: true; readonly snapshot: DecisionSnapshot }
  | { readonly valid: false; readonly error: string };

export interface DecisionSession {
  readonly presetId: typeof DECISION_PRESET_ID;
  readonly fixtureVersion: string;
  /** A private-to-this-session clone, shared by every comparison and preview. */
  readonly fixture: DeepReadonly<OutingFixture>;
  readonly stage: SnapshotId;
  readonly displayedSnapshotId: SnapshotId;
  readonly snapshots: Readonly<{
    baseline: DecisionSnapshot;
    changed: DecisionSnapshot | null;
    revised: DecisionSnapshot | null;
  }>;
  readonly choices: Readonly<Record<SnapshotId, DecisionChoice | null>>;
  readonly priorities: readonly Priority[];
}

export type DecisionEvent =
  | { type: 'choose-option'; snapshotId: SnapshotId; optionId: OptionId }
  | ({ type: 'change-time' } & TimeChange)
  | { type: 'apply-revision'; revision: RevisionId; reason?: string }
  | { type: 'set-reason'; snapshotId: SnapshotId; reason: string }
  | { type: 'set-priorities'; priorities: readonly Priority[] }
  | { type: 'view-snapshot'; snapshotId: SnapshotId }
  | { type: 'reset' };

export interface DecisionSessionConfig {
  /** Test/evidence fixture injection only; arbitrary practical input editing is intentionally absent. */
  fixture?: OutingFixture;
  fixtureVersion?: string;
}

function makeSnapshot(
  id: SnapshotId, inputs: DeepReadonly<OutingInputs>, fixture: DeepReadonly<OutingFixture>,
  fixtureVersion: string, revision: RevisionId | null = null,
): DecisionSnapshot {
  const snapshotInputs = structuredClone(inputs) as OutingInputs;
  // compareOutings uses this exact one object for BOTH options. No story-input selector or city defaults.
  const result = compareOutings(snapshotInputs, fixture as OutingFixture);
  if (!result.valid) throw new Error(`Invalid authored decision preset: ${result.errors.join(' ')}`);
  return freeze({ id, fixtureVersion, inputs: snapshotInputs, result, revision });
}

export function createDecisionSession(config: DecisionSessionConfig = {}): DecisionSession {
  const fixture = freeze(structuredClone(config.fixture ?? illustrativeData));
  const fixtureVersion = config.fixtureVersion ?? (config.fixture ? 'custom-illustrative-fixture' : DECISION_FIXTURE_VERSION);
  const baseline = makeSnapshot('baseline', DECISION_PRESET_INPUTS, fixture, fixtureVersion);
  return freeze({
    presetId: DECISION_PRESET_ID, fixtureVersion, fixture, stage: 'baseline', displayedSnapshotId: 'baseline',
    snapshots: { baseline, changed: null, revised: null },
    choices: { baseline: null, changed: null, revised: null }, priorities: [],
  });
}

const normalizeReason = (reason: string): string | null => reason.trim() || null;
const isOption = (id: unknown): id is OptionId => id === 'hk' || id === 'sz';
const isRevision = (id: unknown): id is RevisionId => id === 'keep-hk' || id === 'keep-sz' || id === 'shorten-sz';

/** A free, validated one-field preview. Canceling it requires no reducer event or cleanup. */
export function previewTimeChange(session: DecisionSession, change: TimeChange): TimeChangePreview {
  if (session.stage !== 'baseline') return freeze({ valid: false, error: 'This comparison already has its one time change. Start again to try another.' });
  if (!session.choices.baseline) return freeze({ valid: false, error: 'Choose a tentative evening before changing its circumstances.' });
  if (!change || (change.field !== 'departureMinutes' && change.field !== 'homeByMinutes')) {
    return freeze({ valid: false, error: 'Choose departure or home-by as the one time to change.' });
  }
  const limits = DECISION_TIME_LIMITS[change.field];
  const label = change.field === 'departureMinutes' ? 'Departure' : 'Home-by';
  if (!Number.isInteger(change.minutes) || change.minutes < limits.min || change.minutes > limits.max) {
    return freeze({ valid: false, error: `${label} must be a whole-minute time from ${formatClock(limits.min)} to ${formatClock(limits.max)}.` });
  }
  if ((change.minutes - limits.min) % limits.step !== 0) return freeze({ valid: false, error: `Choose ${label.toLowerCase()} in 15-minute steps.` });
  if (change.minutes === session.snapshots.baseline.inputs[change.field]) return freeze({ valid: false, error: `Choose a ${label.toLowerCase()} time different from the baseline.` });
  const inputs = { ...session.snapshots.baseline.inputs, [change.field]: change.minutes };
  return freeze({ valid: true, snapshot: makeSnapshot('changed', inputs, session.fixture, session.fixtureVersion) });
}

/** Free inspection: computes a preview using the captured fixture, with no state change or story clock. */
export function previewRevision(session: DecisionSession, revision: RevisionId): DecisionSnapshot | null {
  const changed = session.snapshots.changed;
  if (!changed || !isRevision(revision)) return null;
  const inputs = structuredClone(changed.inputs) as OutingInputs;
  if (revision === 'shorten-sz') {
    inputs.itineraryOverrides = {
      ...inputs.itineraryOverrides,
      sz: { ...inputs.itineraryOverrides?.sz, walkMinutes: 15 },
    };
  }
  return makeSnapshot('revised', inputs, session.fixture, session.fixtureVersion, revision);
}

/** Immutable, guarded transitions. Historical choices and reasons can never be edited after advancing. */
export function decisionReducer(session: DecisionSession, event: DecisionEvent): DecisionSession {
  switch (event.type) {
    case 'choose-option': {
      // Final alternatives are committed together with their exact inputs by apply-revision.
      if (session.stage === 'revised') return session;
      if (event.snapshotId !== session.stage || !isOption(event.optionId)) return session;
      const current = session.choices[event.snapshotId];
      if (current?.optionId === event.optionId) return session;
      return freeze({ ...session, choices: { ...session.choices, [event.snapshotId]: { optionId: event.optionId, reason: null } } });
    }
    case 'set-reason': {
      if (event.snapshotId !== session.stage || typeof event.reason !== 'string') return session;
      const choice = session.choices[event.snapshotId];
      if (!choice) return session;
      const reason = normalizeReason(event.reason);
      if (reason === choice.reason) return session;
      return freeze({ ...session, choices: { ...session.choices, [event.snapshotId]: { ...choice, reason } } });
    }
    case 'set-priorities': {
      // Keep this controlled comparison's qualitative context fixed after the one circumstance change.
      if (session.stage !== 'baseline') return session;
      if (!Array.isArray(event.priorities) || event.priorities.some(priority => !DECISION_PRIORITIES.includes(priority))) return session;
      const priorities = DECISION_PRIORITIES.filter(priority => event.priorities.includes(priority));
      if (priorities.length === session.priorities.length && priorities.every((priority, index) => priority === session.priorities[index])) return session;
      return freeze({ ...session, priorities });
    }
    case 'change-time': {
      const preview = previewTimeChange(session, event);
      if (!preview.valid) return session;
      return freeze({ ...session, stage: 'changed', displayedSnapshotId: 'changed', snapshots: { ...session.snapshots, changed: preview.snapshot } });
    }
    case 'apply-revision': {
      if (session.stage !== 'changed' || !isRevision(event.revision)) return session;
      const revised = previewRevision(session, event.revision)!;
      const optionId: OptionId = event.revision === 'keep-hk' ? 'hk' : 'sz';
      const reason = typeof event.reason === 'string' ? normalizeReason(event.reason) : null;
      return freeze({
        ...session, stage: 'revised', displayedSnapshotId: 'revised', snapshots: { ...session.snapshots, revised },
        choices: { ...session.choices, revised: { optionId, reason } },
      });
    }
    case 'view-snapshot':
      if (!session.snapshots[event.snapshotId] || event.snapshotId === session.displayedSnapshotId) return session;
      return freeze({ ...session, displayedSnapshotId: event.snapshotId });
    case 'reset':
      // No storage reads, storage writes, clocks, counters or browser globals are involved.
      return createDecisionSession({ fixture: session.fixture as OutingFixture, fixtureVersion: session.fixtureVersion });
    default:
      return session;
  }
}

export interface InputDelta {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}
export interface DecisionOptionDelta {
  readonly optionId: OptionId;
  readonly before: DeepReadonly<OutingOption>;
  readonly after: DeepReadonly<OutingOption>;
  /** Null if either whole-outing total is unknown; never an incomplete-cost saving. */
  readonly perPersonCostChangeHKD: number | null;
  readonly returnChangeMinutes: number;
  readonly slackChangeMinutes: number;
  readonly facts: readonly string[];
}
export interface DecisionDeltas {
  readonly from: SnapshotId;
  readonly to: SnapshotId;
  readonly inputChanges: readonly InputDelta[];
  readonly options: readonly DecisionOptionDelta[];
  readonly facts: readonly string[];
}

function inputDiff(before: unknown, after: unknown, path = ''): InputDelta[] {
  if (Object.is(before, after)) return [];
  if (before !== null && after !== null && typeof before === 'object' && typeof after === 'object') {
    const a = before as Record<string, unknown>;
    const b = after as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => inputDiff(a[key], b[key], path ? `${path}.${key}` : key));
  }
  return [{ path, before, after }];
}

/** Factual differences only. Does not invent a motivation or convert qualitative priorities to a score. */
export function selectDecisionDeltas(
  session: DecisionSession, from: SnapshotId = 'baseline', to: SnapshotId = session.displayedSnapshotId,
): DecisionDeltas | null {
  const before = session.snapshots[from];
  const after = session.snapshots[to];
  if (!before || !after || before.fixtureVersion !== after.fixtureVersion) return null;
  const inputChanges = inputDiff(before.inputs, after.inputs);
  const facts: string[] = [];
  if (before.inputs.departureMinutes !== after.inputs.departureMinutes) {
    facts.push(`Departure changed from ${formatClock(before.inputs.departureMinutes)} to ${formatClock(after.inputs.departureMinutes)}.`);
  }
  if (before.result.normalizedHomeByMinutes !== after.result.normalizedHomeByMinutes) {
    facts.push(`Home-by changed from ${formatClock(before.result.normalizedHomeByMinutes!)} to ${formatClock(after.result.normalizedHomeByMinutes!)}.`);
  }
  const options = before.result.options.map(previous => {
    const next = after.result.options.find(option => option.id === previous.id)!;
    const label = next.id === 'hk' ? 'Hong Kong' : 'Shenzhen';
    const optionFacts: string[] = [];
    const perPersonCostChangeHKD = previous.perPersonHKD === null || next.perPersonHKD === null
      ? null : Math.round((next.perPersonHKD - previous.perPersonHKD) * 100) / 100;
    if (next.perPersonHKD === null) optionFacts.push(`${label}'s whole-outing cost is unknown.`);
    else if (perPersonCostChangeHKD === 0) optionFacts.push(`${label}'s cost stays HK$${next.perPersonHKD.toFixed(2)} per person.`);
    else optionFacts.push(`${label}'s cost is HK$${next.perPersonHKD.toFixed(2)} per person.`);
    if (previous.walkMinutes !== next.walkMinutes) optionFacts.push(`${label}'s walk changes from ${previous.walkMinutes} to ${next.walkMinutes} minutes.`);
    if (previous.returnMinutes === next.returnMinutes) optionFacts.push(`${label}'s modeled home time stays ${formatClock(next.returnMinutes)}.`);
    else optionFacts.push(`${label}'s modeled home time changes from ${formatClock(previous.returnMinutes)} to ${formatClock(next.returnMinutes)}.`);
    optionFacts.push(next.spareMinutes < 0
      ? `${label} is modeled ${-next.spareMinutes} minutes after the home-by deadline.`
      : `${label} has ${next.spareMinutes} minutes of modeled slack; this is not a guarantee.`);
    if (next.crossingPlan) optionFacts.push(next.crossingFeasible
      ? `${label}'s crossings fit the modeled opening-hours window and closing buffer; this does not verify service or entry eligibility.`
      : `${label}'s crossing plan falls outside the modeled opening-hours window or closing buffer.`);
    return {
      optionId: previous.id, before: previous, after: next, perPersonCostChangeHKD,
      returnChangeMinutes: next.returnMinutes - previous.returnMinutes,
      slackChangeMinutes: next.spareMinutes - previous.spareMinutes, facts: optionFacts,
    };
  });
  return freeze({ from, to, inputChanges, options, facts });
}

export function selectDecisionView(session: DecisionSession) {
  const displayedSnapshot = session.snapshots[session.displayedSnapshotId]!;
  const currentSnapshot = session.snapshots[session.stage]!;
  const initialChoice = session.choices.baseline;
  const currentChoice = session.choices[session.stage];
  const availableSnapshotIds = (['baseline', 'changed', 'revised'] as const).filter(id => session.snapshots[id] !== null);
  const hasChoiceChanged = initialChoice && currentChoice ? initialChoice.optionId !== currentChoice.optionId : null;
  const city = (id: OptionId) => id === 'hk' ? 'Hong Kong' : 'Shenzhen';
  const choiceSummary = !currentChoice ? 'No choice recorded for this stage.'
    : session.stage === 'baseline' ? `You selected ${city(currentChoice.optionId)}.`
    : hasChoiceChanged ? `You first selected ${city(initialChoice!.optionId)} and now selected ${city(currentChoice.optionId)}.`
    : `You kept ${city(currentChoice.optionId)} as your choice.`;
  const changedInputs = session.snapshots.changed?.inputs;
  const changedField: TimeChangeField = changedInputs?.departureMinutes !== session.snapshots.baseline.inputs.departureMinutes ? 'departureMinutes' : 'homeByMinutes';
  const timeChange = changedInputs ? {
    field: changedField, beforeMinutes: session.snapshots.baseline.inputs[changedField], afterMinutes: changedInputs[changedField],
  } : null;
  return freeze({
    stage: session.stage, displayedSnapshotId: session.displayedSnapshotId, displayedSnapshot, currentSnapshot,
    availableSnapshotIds, initialChoice, currentChoice, displayedChoice: session.choices[session.displayedSnapshotId],
    priorities: session.priorities, canChangeTime: session.stage === 'baseline' && initialChoice !== null,
    canApplyRevision: session.stage === 'changed', scopeNotes: DECISION_SCOPE_NOTES,
    timelineRange: DECISION_TIMELINE_RANGE, timeChange,
    reconsideration: { hasChoiceChanged, summary: choiceSummary, reason: currentChoice?.reason ?? null },
    deltas: selectDecisionDeltas(session),
  });
}
