import { defaultInputs, illustrativeData } from '../domain/data';
import { compareOutings, formatClock, validateInputs } from '../domain/engine';
import type { OptionId, OutingFixture, OutingInputs, OutingOption } from '../domain/model';
import type {
  StoryAction, StoryActionPreview, StoryAttempt, StoryAttemptSnapshot, StoryFamiliarity,
  StoryPreset, StoryPresetId, StoryProgress, StorySetup, StoryState,
} from './model';

export type * from './model';
export const STORY_VERSION = 2 as const;
export const STORY_SCENARIO_ID = 'fictional-saturday-v1' as const;
export const STORY_LABEL = 'Fictional Saturday · illustrative costs and travel';
export const STORY_DELAY_LABEL = 'Includes one fictional 30-minute dinner delay';
export const STORY_PRESETS: readonly StoryPreset[] = [
  { id: 'short', label: 'A short evening', description: 'A close home deadline makes each commitment visible.', departureMinutes: 1020, homeByMinutes: 1200, budgetPerPersonHKD: 400, partySize: 2 },
  { id: 'wander', label: 'Room to wander', description: 'Leave room for a table and a street in either city.', departureMinutes: 990, homeByMinutes: 1410, budgetPerPersonHKD: 400, partySize: 2 },
  { id: 'budget', label: 'Keep to a budget', description: 'Make the shared order a visible choice against the same allowance.', departureMinutes: 990, homeByMinutes: 1410, budgetPerPersonHKD: 320, partySize: 2 },
];

const cities = ['hk', 'sz'] as const;
const phases = ['fork', 'arrival', 'afterDinner', 'walk', 'home'] as const;
const clone = <T,>(value: T): T => structuredClone(value);
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && (values as readonly string[]).includes(value);
const presetFor = (id: StoryPresetId): StoryPreset => STORY_PRESETS.find(preset => preset.id === id)!;
const emptyFamiliarity = (): StoryFamiliarity => ({ hk: { dinner: 'unsure', walk: 'unsure' }, sz: { dinner: 'unsure', walk: 'unsure' } });
const freshAttempt = (id: number, inputs: OutingInputs): StoryAttempt => ({
  id, city: null, route: inputs.szRoute, phase: 'fork', dinnerChoice: null, walkChoice: null,
  memento: null, inspectedHotspots: [], familiarity: {
    hk: { dinner: inputs.familiarity?.hk?.dinner ?? 'unsure', walk: inputs.familiarity?.hk?.walk ?? 'unsure' },
    sz: { dinner: inputs.familiarity?.sz?.dinner ?? 'unsure', walk: inputs.familiarity?.sz?.walk ?? 'unsure' },
  }, journalNote: '',
});

function scenarioInputs(presetId: StoryPresetId, patch: Partial<OutingInputs> = {}): OutingInputs {
  const preset = presetFor(presetId);
  return clone({
    ...defaultInputs, departureMinutes: preset.departureMinutes, homeByMinutes: preset.homeByMinutes,
    budgetPerPersonHKD: preset.budgetPerPersonHKD, ...patch,
    // Fictional play neither reads nor writes a practical immigration attestation.
    partySize: 2, entryEligibility: 'unsure',
    weights: { ...defaultInputs.weights, ...patch.weights },
    familiarity: patch.familiarity ?? emptyFamiliarity(),
  });
}

export function createStoryState(presetId: StoryPresetId = 'wander', setup: StorySetup = {}): StoryState {
  if (!oneOf(presetId, ['short', 'wander', 'budget'])) throw new Error('Unknown story preset.');
  if (setup.delayScenario !== undefined && !oneOf(setup.delayScenario, ['none', 'dinner30'])) throw new Error('Unknown delay scenario.');
  const baseInputs = scenarioInputs(presetId, setup.baseInputs);
  const errors = validateInputs(baseInputs);
  if (errors.length) throw new Error(errors.join(' '));
  return {
    version: STORY_VERSION, scenarioId: STORY_SCENARIO_ID, presetId, baseInputs,
    delayScenario: setup.delayScenario ?? 'dinner30', currentAttempt: freshAttempt(1, baseInputs),
    previousAttempt: null, previewCity: null, openHotspot: null,
  };
}

/** The domain engine is the only source of costs, clock arithmetic and feasibility. */
export function selectStoryInputs(state: StoryState): OutingInputs {
  const attempt = state.currentAttempt;
  const overrides: NonNullable<OutingInputs['itineraryOverrides']> = {};
  for (const city of cities) {
    const active = city === attempt.city;
    const dinner = active ? attempt.dinnerChoice : null;
    const walk = active ? attempt.walkChoice : null;
    overrides[city] = {
      mealMinutes: dinner === 'linger' ? 90 : 60,
      walkMinutes: walk === 'none' ? 0 : walk === 'short' ? 15 : 45,
      includeSharedOrder: dinner === 'linger',
      storyDelayMinutes: dinner && state.delayScenario === 'dinner30' ? 30 : 0,
    };
  }
  return {
    ...clone(state.baseInputs), partySize: 2, entryEligibility: 'unsure', szRoute: attempt.route,
    itineraryOverrides: overrides, familiarity: clone(attempt.familiarity),
  };
}

export function selectStoryComparison(state: StoryState, fixture: OutingFixture = illustrativeData) {
  return compareOutings(selectStoryInputs(state), fixture);
}

export function selectStoryOption(state: StoryState, city: OptionId | null = state.currentAttempt.city ?? state.previewCity, fixture: OutingFixture = illustrativeData): OutingOption | null {
  return city ? selectStoryComparison(state, fixture).options.find(option => option.id === city) ?? null : null;
}

export function selectStoryProgress(state: StoryState, fixture: OutingFixture = illustrativeData): StoryProgress {
  const attempt = state.currentAttempt;
  const option = selectStoryOption(state, undefined, fixture);
  const phaseIndex = phases.indexOf(attempt.phase);
  const dinnerComplete = phaseIndex >= 2;
  const walkComplete = phaseIndex >= 3 && attempt.walkChoice !== 'none';
  const homeComplete = phaseIndex >= 4;
  const elapsedMinutes = !option || phaseIndex === 0 ? 0
    : option.outwardMinutes + (dinnerComplete ? option.mealMinutes + option.storyDelayMinutes : 0)
      + (walkComplete ? option.walkMinutes : 0) + (homeComplete ? option.inwardMinutes : 0);
  return {
    phase: attempt.phase, elapsedMinutes, clockMinutes: state.baseInputs.departureMinutes + elapsedMinutes,
    projectedReturnMinutes: option?.returnMinutes ?? null,
    dinnerEndMinutes: option ? option.arrivalMinutes + option.mealMinutes + option.storyDelayMinutes : null,
    delayApplied: dinnerComplete && state.delayScenario === 'dinner30',
    delayMinutes: dinnerComplete && state.delayScenario === 'dinner30' ? 30 : 0,
    outwardComplete: phaseIndex >= 1, dinnerComplete, walkComplete, homeComplete,
  };
}

function snapshotState(snapshot: StoryAttemptSnapshot): StoryState {
  const { baseInputs, delayScenario, presetId, ...attempt } = clone(snapshot);
  return {
    version: STORY_VERSION, scenarioId: STORY_SCENARIO_ID, presetId, baseInputs, delayScenario,
    currentAttempt: attempt, previousAttempt: null, previewCity: attempt.city, openHotspot: null,
  };
}

export function selectStoryPreviousOption(state: StoryState, fixture: OutingFixture = illustrativeData): OutingOption | null {
  return state.previousAttempt ? selectStoryOption(snapshotState(state.previousAttempt), undefined, fixture) : null;
}

/** Returning the exact same reference makes invalid, repeated and out-of-order actions true no-ops. */
export function storyReducer(state: StoryState, action: StoryAction): StoryState {
  if (validateStoryState(state).length || !action || typeof action !== 'object') return state;
  const attempt = state.currentAttempt;
  const withAttempt = (patch: Partial<StoryAttempt>): StoryState => ({ ...state, currentAttempt: { ...attempt, ...patch }, openHotspot: null });
  switch (action.type) {
    case 'PREVIEW_CITY':
      return attempt.phase === 'fork' && oneOf(action.city, cities) && (state.previewCity !== action.city || state.openHotspot !== null)
        ? { ...state, previewCity: action.city, openHotspot: null } : state;
    case 'SET_ROUTE':
      return attempt.phase === 'fork' && oneOf(action.route, ['rail', 'bus']) && attempt.route !== action.route ? withAttempt({ route: action.route }) : state;
    case 'INSPECT': {
      const city = attempt.city ?? state.previewCity;
      if (!city || !oneOf(action.hotspot, ['table', 'wander', 'home'])) return state;
      const id = `${city}:${action.hotspot}`;
      if (state.openHotspot === action.hotspot && attempt.inspectedHotspots.includes(id)) return state;
      return { ...state, openHotspot: action.hotspot, currentAttempt: { ...attempt,
        inspectedHotspots: attempt.inspectedHotspots.includes(id) ? attempt.inspectedHotspots : [...attempt.inspectedHotspots, id] } };
    }
    case 'CLOSE_INSPECTION':
      return state.openHotspot === null ? state : { ...state, openHotspot: null };
    case 'COMMIT_DEPARTURE': {
      if (attempt.phase !== 'fork' || !oneOf(action.city, cities) || (action.route !== undefined && !oneOf(action.route, ['rail', 'bus']))) return state;
      return { ...withAttempt({ city: action.city, route: action.route ?? attempt.route, phase: 'arrival' }), previewCity: action.city };
    }
    case 'COMMIT_DINNER':
      return attempt.phase === 'arrival' && oneOf(action.choice, ['simple', 'linger'])
        ? withAttempt({ dinnerChoice: action.choice, phase: 'afterDinner' }) : state;
    case 'COMMIT_WALK':
      return attempt.phase === 'afterDinner' && oneOf(action.choice, ['short', 'long'])
        ? withAttempt({ walkChoice: action.choice, phase: 'walk' }) : state;
    case 'KEEP_MEMENTO':
      return (attempt.phase === 'walk' || attempt.phase === 'home') && oneOf(action.memento, ['view', 'conversation', 'practical']) && attempt.memento !== action.memento
        ? withAttempt({ memento: action.memento }) : state;
    case 'SET_FAMILIARITY':
      return oneOf(action.city, cities) && oneOf(action.activity, ['dinner', 'walk']) && oneOf(action.value, ['new', 'familiar', 'unsure']) && attempt.familiarity[action.city][action.activity] !== action.value
        ? withAttempt({ familiarity: { ...attempt.familiarity, [action.city]: { ...attempt.familiarity[action.city], [action.activity]: action.value } } }) : state;
    case 'SET_JOURNAL_NOTE':
      return (attempt.phase === 'walk' || attempt.phase === 'home') && typeof action.text === 'string' && action.text.length <= 1000 && attempt.journalNote !== action.text
        ? withAttempt({ journalNote: action.text }) : state;
    case 'RETURN_HOME':
      return attempt.phase === 'walk' ? withAttempt({ phase: 'home' }) : state;
    case 'RETURN_AFTER_DINNER':
      return attempt.phase === 'afterDinner' ? withAttempt({ phase: 'home', walkChoice: 'none' }) : state;
    case 'REWIND': {
      if (!oneOf(action.checkpoint, ['fork', 'arrival', 'afterDinner']) || phases.indexOf(attempt.phase) <= phases.indexOf(action.checkpoint)) return state;
      if (action.checkpoint === 'fork') return { ...state, currentAttempt: { ...freshAttempt(attempt.id, state.baseInputs), route: attempt.route, familiarity: clone(attempt.familiarity), inspectedHotspots: [...attempt.inspectedHotspots] }, previewCity: attempt.city, openHotspot: null };
      return withAttempt({ phase: action.checkpoint, dinnerChoice: action.checkpoint === 'arrival' ? null : attempt.dinnerChoice,
        walkChoice: null, memento: null, journalNote: '' });
    }
    case 'TRY_OTHER_CITY': {
      if (attempt.phase !== 'home' || attempt.id === Number.MAX_SAFE_INTEGER) return state;
      const previousAttempt: StoryAttemptSnapshot = clone({ ...attempt, baseInputs: state.baseInputs, delayScenario: state.delayScenario, presetId: state.presetId });
      return { ...state, previousAttempt, currentAttempt: { ...freshAttempt(attempt.id + 1, state.baseInputs), route: attempt.route, familiarity: clone(attempt.familiarity) },
        previewCity: attempt.city === 'hk' ? 'sz' : 'hk', openHotspot: null };
    }
    case 'RESET':
      return action.presetId === undefined || oneOf(action.presetId, ['short', 'wander', 'budget']) ? createStoryState(action.presetId) : state;
    case 'RECONFIGURE': {
      if (attempt.id === Number.MAX_SAFE_INTEGER) return state;
      if ((action.presetId !== undefined && !oneOf(action.presetId, ['short', 'wander', 'budget'])) ||
        (action.delayScenario !== undefined && !oneOf(action.delayScenario, ['none', 'dinner30'])) ||
        (action.inputs !== undefined && !isRecord(action.inputs))) return state;
      const presetId = action.presetId ?? state.presetId;
      const preset = presetFor(presetId);
      const patch: Partial<OutingInputs> = {
        ...state.baseInputs, familiarity: clone(attempt.familiarity),
        ...(action.presetId ? { departureMinutes: preset.departureMinutes, homeByMinutes: preset.homeByMinutes, budgetPerPersonHKD: preset.budgetPerPersonHKD } : {}),
        ...action.inputs,
      };
      const baseInputs = scenarioInputs(presetId, patch);
      if (validateInputs(baseInputs).length) return state;
      return { ...state, presetId, baseInputs, delayScenario: action.delayScenario ?? state.delayScenario,
        currentAttempt: freshAttempt(attempt.id + 1, baseInputs), previewCity: attempt.city ?? state.previewCity, openHotspot: null };
    }
    default: return state;
  }
}

const moneyDelta = (after: number | null | undefined, before: number | null | undefined): number | null =>
  after == null || before == null ? null : (Math.round(after * 100) - Math.round(before * 100)) / 100;

export function previewStoryAction(state: StoryState, action: StoryAction, fixture: OutingFixture = illustrativeData): StoryActionPreview {
  const next = storyReducer(state, action);
  const city = next.currentAttempt.city ?? next.previewCity;
  const before = selectStoryOption(state, city, fixture);
  const comparison = selectStoryComparison(next, fixture);
  const option = comparison.options.find(item => item.id === city) ?? null;
  return {
    allowed: next !== state, state: next, comparison, option, progress: selectStoryProgress(next, fixture),
    billDeltaHKD: moneyDelta(option?.groupHKD, before?.groupHKD),
    perPersonDeltaHKD: moneyDelta(option?.perPersonHKD, before?.perPersonHKD),
    returnDeltaMinutes: option && before ? option.returnMinutes - before.returnMinutes : null,
    warnings: option ? [...option.reasons.filter(reason => /outside|unconfirmed|exceed|unknown|after the deadline/.test(reason)), ...option.warnings] : comparison.errors,
  };
}

/** Journal text is reproducible and action-specific; no inference of happiness, motive or utility. */
export function selectStoryJournal(state: StoryState, fixture: OutingFixture = illustrativeData): string[] {
  const attempt = state.currentAttempt;
  const option = selectStoryOption(state, undefined, fixture);
  if (!attempt.city || !option) return [];
  const entries = [`You chose ${attempt.city === 'hk' ? 'Hong Kong' : 'Shenzhen'} via ${option.routeLabel}; modeled arrival ${formatClock(option.arrivalMinutes)}.`];
  if (attempt.dinnerChoice) entries.push(attempt.dinnerChoice === 'linger'
    ? 'You left 90 minutes for dinner and added one shared order for the group.'
    : 'You kept dinner to 60 minutes, without the optional shared order.');
  if (attempt.dinnerChoice && state.delayScenario === 'dinner30') entries.push('The fictional dinner ran 30 minutes longer, once in this attempt.');
  if (attempt.walkChoice) entries.push(attempt.walkChoice === 'none'
    ? `You headed straight home after dinner, without a walk; modeled home time ${formatClock(option.returnMinutes)}.`
    : attempt.walkChoice === 'long'
      ? `You kept the 45-minute wander; modeled home time ${formatClock(option.returnMinutes)}.`
      : `You chose a 15-minute loop; modeled home time ${formatClock(option.returnMinutes)}.`);
  if (attempt.memento) entries.push({ view: 'You chose to keep the view.', conversation: 'You chose to remember the conversation.', practical: 'You chose to keep the practical note.' }[attempt.memento]);
  if (attempt.phase === 'home') {
    entries.push(`Modeled home arrival: ${formatClock(option.returnMinutes)}${option.homeFeasible ? ', within the chosen home deadline.' : `, ${-option.spareMinutes} minutes after the chosen home deadline.`}`);
    entries.push(option.groupHKD === null ? `Whole-outing bill unknown: ${option.missingCostLabels.join(', ')}.` : `Illustrative whole-outing bill: HK$${option.groupHKD.toFixed(2)} for two adults, HK$${option.perPersonHKD!.toFixed(2)} per person.`);
    if (attempt.city === 'sz') entries.push('Still to verify before real travel: entry eligibility, transport services, crossing conditions and current costs.');
    else entries.push('Still to verify before real travel: current prices, opening hours and transport.');
    if (!option.crossingFeasible) entries.push('The modeled crossing is outside the opening window or chosen closing buffer. Rewind the departure before relying on this plan.');
  }
  if (attempt.journalNote) entries.push(attempt.journalNote);
  return entries;
}

function validFamiliarity(value: unknown): boolean {
  return isRecord(value) && cities.every(city => {
    const activities = value[city];
    return isRecord(activities) && ['dinner', 'walk'].every(activity => oneOf(activities[activity], ['new', 'familiar', 'unsure']));
  });
}

function validAttempt(value: unknown): value is StoryAttempt {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || (value.id as number) < 1 ||
    !(value.city === null || oneOf(value.city, cities)) || !oneOf(value.route, ['rail', 'bus']) || !oneOf(value.phase, phases) ||
    !(value.dinnerChoice === null || oneOf(value.dinnerChoice, ['simple', 'linger'])) ||
    !(value.walkChoice === null || oneOf(value.walkChoice, ['none', 'short', 'long'])) ||
    !(value.memento === null || oneOf(value.memento, ['view', 'conversation', 'practical'])) ||
    !Array.isArray(value.inspectedHotspots) || value.inspectedHotspots.length > 6 ||
    !value.inspectedHotspots.every(id => typeof id === 'string' && /^(hk|sz):(table|wander|home)$/.test(id)) ||
    new Set(value.inspectedHotspots).size !== value.inspectedHotspots.length ||
    !validFamiliarity(value.familiarity) || typeof value.journalNote !== 'string' || value.journalNote.length > 1000) return false;
  const phase = phases.indexOf(value.phase);
  return (value.walkChoice !== 'none' || value.phase === 'home') &&
    (phase === 0 ? value.city === null : value.city !== null) &&
    (phase < 2 ? value.dinnerChoice === null : value.dinnerChoice !== null) &&
    (phase < 3 ? value.walkChoice === null && value.memento === null && value.journalNote === '' : value.walkChoice !== null);
}

function validBaseInputs(value: unknown): value is OutingInputs {
  return isRecord(value) && value.partySize === 2 && value.entryEligibility === 'unsure' && validateInputs(value as unknown as OutingInputs).length === 0;
}

/** Strict phase/choice validation. Old planner saves are not fabricated into a story. */
function inspectStoryState(value: unknown): string[] {
  if (!isRecord(value)) return ['Story state must be an object.'];
  const errors: string[] = [];
  if (value.version !== STORY_VERSION || value.scenarioId !== STORY_SCENARIO_ID) errors.push('Unsupported story version or scenario.');
  if (!oneOf(value.presetId, ['short', 'wander', 'budget']) || !oneOf(value.delayScenario, ['none', 'dinner30'])) errors.push('Invalid story setup.');
  if (!validBaseInputs(value.baseInputs)) errors.push('Invalid story inputs; two fictional adults and unresolved practical eligibility are required.');
  if (!validAttempt(value.currentAttempt)) errors.push('Invalid current attempt or inconsistent phase commitments.');
  if (!(value.previewCity === null || oneOf(value.previewCity, cities)) || !(value.openHotspot === null || oneOf(value.openHotspot, ['table', 'wander', 'home']))) errors.push('Invalid scene inspection.');
  if (validAttempt(value.currentAttempt)) {
    if (value.currentAttempt.city !== null && value.previewCity !== value.currentAttempt.city) errors.push('Committed scene and preview city disagree.');
    if (value.openHotspot !== null && value.currentAttempt.city === null && value.previewCity === null) errors.push('An inspection needs a selected scene.');
    if (value.openHotspot !== null && !value.currentAttempt.inspectedHotspots.includes(`${value.currentAttempt.city ?? value.previewCity}:${value.openHotspot}`)) errors.push('The open detail has not been inspected in this scene.');
  }
  if (value.previousAttempt !== null) {
    const previous = value.previousAttempt;
    if (!validAttempt(previous) || previous.phase !== 'home' || !isRecord(previous) || !validBaseInputs(previous.baseInputs) ||
      !oneOf(previous.presetId, ['short', 'wander', 'budget']) || !oneOf(previous.delayScenario, ['none', 'dinner30'])) errors.push('Invalid saved prior attempt.');
    else if (validAttempt(value.currentAttempt) && previous.id >= value.currentAttempt.id) errors.push('Attempt sequence is inconsistent.');
  }
  return errors;
}

export function validateStoryState(value: unknown): string[] {
  try { return inspectStoryState(value); }
  catch { return ['The story save could not be inspected.']; }
}

/** Keep only explicit contract fields: no persisted derived totals, counters or custom hooks. */
function canonicalInputs(inputs: OutingInputs): OutingInputs {
  const result: OutingInputs = {
    origin: inputs.origin, departureMinutes: inputs.departureMinutes, homeByMinutes: inputs.homeByMinutes,
    budgetPerPersonHKD: inputs.budgetPerPersonHKD, partySize: 2, mealMinutes: inputs.mealMinutes,
    weights: { price: inputs.weights.price, ease: inputs.weights.ease, discovery: inputs.weights.discovery },
    szRoute: inputs.szRoute, fxHKDPerCNY: inputs.fxHKDPerCNY, entryEligibility: 'unsure',
  };
  for (const key of ['borderBufferMinutes', 'crossingClosingBufferMinutes', 'hkMealPerPersonHKD', 'szMealPerPersonCNY', 'hkLocalMinutes', 'szLocalMinutes', 'walkMinutes'] as const) {
    if (inputs[key] !== undefined) result[key] = inputs[key];
  }
  if (inputs.itineraryOverrides !== undefined) {
    result.itineraryOverrides = {};
    for (const city of cities) {
      const raw = inputs.itineraryOverrides[city];
      if (raw !== undefined) {
        const entry: NonNullable<OutingInputs['itineraryOverrides']>['hk'] = {};
        for (const key of ['mealMinutes', 'walkMinutes', 'storyDelayMinutes'] as const) if (raw[key] !== undefined) entry[key] = raw[key];
        if (raw.includeSharedOrder !== undefined) entry.includeSharedOrder = raw.includeSharedOrder;
        result.itineraryOverrides[city] = entry;
      }
    }
  }
  if (inputs.familiarity !== undefined) {
    result.familiarity = {};
    for (const city of cities) {
      const raw = inputs.familiarity[city];
      if (raw !== undefined) {
        result.familiarity[city] = {};
        for (const activity of ['dinner', 'walk'] as const) if (raw[activity] !== undefined) result.familiarity[city][activity] = raw[activity];
      }
    }
  }
  return result;
}

function canonicalAttempt(attempt: StoryAttempt): StoryAttempt {
  return {
    id: attempt.id, city: attempt.city, route: attempt.route, phase: attempt.phase,
    dinnerChoice: attempt.dinnerChoice, walkChoice: attempt.walkChoice, memento: attempt.memento,
    inspectedHotspots: [...attempt.inspectedHotspots],
    familiarity: { hk: { dinner: attempt.familiarity.hk.dinner, walk: attempt.familiarity.hk.walk }, sz: { dinner: attempt.familiarity.sz.dinner, walk: attempt.familiarity.sz.walk } },
    journalNote: attempt.journalNote,
  };
}

/** Accepts either serialized JSON or a parsed object; failures are safe and side-effect free. */
export function decodeStoryState(value: unknown): StoryState | null {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    if (validateStoryState(parsed).length) return null;
    const state = parsed as StoryState;
    return {
      version: STORY_VERSION, scenarioId: STORY_SCENARIO_ID, presetId: state.presetId,
      baseInputs: canonicalInputs(state.baseInputs), delayScenario: state.delayScenario,
      currentAttempt: canonicalAttempt(state.currentAttempt),
      previousAttempt: state.previousAttempt ? {
        ...canonicalAttempt(state.previousAttempt), presetId: state.previousAttempt.presetId,
        baseInputs: canonicalInputs(state.previousAttempt.baseInputs), delayScenario: state.previousAttempt.delayScenario,
      } : null,
      previewCity: state.previewCity, openHotspot: state.openHotspot,
    };
  } catch { return null; }
}
