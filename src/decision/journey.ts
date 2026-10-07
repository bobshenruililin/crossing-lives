import type { DecisionSession, DecisionSnapshot, Priority } from './session';

export type JourneyNode = 'counter' | 'station';
export type JourneyOption = DecisionSnapshot['result']['options'][number];
export interface DecisionJourney {
  /** References to the chosen immutable pair. No engine call or new travel inputs. */
  readonly snapshot: DecisionSnapshot;
  readonly option: JourneyOption;
  readonly priorities: readonly Priority[];
  readonly node: JourneyNode;
  readonly phase: 'exploring' | 'outward' | 'arrived';
  readonly committedArrivalMinutes: number | null;
  readonly artStatus: 'pending' | 'ready' | 'fallback';
}
export type JourneyEvent =
  | { type: 'begin'; session: DecisionSession }
  | { type: 'move'; node: JourneyNode }
  | { type: 'depart' }
  | { type: 'art-settled'; status: 'ready' | 'fallback'; snapshot: DecisionSnapshot }
  | { type: 'arrive' }
  | { type: 'reset' };

/** Presentation only: node inspection is free; departure captures arrival once. */
export function journeyReducer(state: DecisionJourney | null, event: JourneyEvent): DecisionJourney | null {
  if (event.type === 'reset') return null;
  if (event.type === 'begin') {
    if (state) return state;
    const { session } = event;
    const snapshot = session.snapshots.revised;
    const choice = session.choices.revised;
    if (session.stage !== 'revised' || !snapshot || !choice) return state;
    const option = snapshot.result.options.find(item => item.id === choice.optionId);
    if (!option) return state;
    return Object.freeze({ snapshot, option, priorities: Object.freeze([...session.priorities]), node: 'counter', phase: 'exploring', committedArrivalMinutes: null, artStatus: 'pending' });
  }
  if (!state) return state;
  if (event.type === 'move') {
    if (state.phase !== 'exploring' || !['counter', 'station'].includes(event.node) || state.node === event.node) return state;
    return Object.freeze({ ...state, node: event.node });
  }
  if (event.type === 'depart') {
    if (state.phase !== 'exploring' || state.node !== (state.option.id === 'sz' ? 'station' : 'counter')) return state;
    return Object.freeze({ ...state, phase: 'outward', committedArrivalMinutes: state.option.arrivalMinutes });
  }
  if (event.type === 'art-settled') {
    // A settled fallback cannot be replaced under an already visible arrival.
    if (state.artStatus !== 'pending' || event.snapshot !== state.snapshot) return state;
    return Object.freeze({ ...state, artStatus: event.status });
  }
  if (event.type === 'arrive') {
    if (state.phase !== 'outward' || state.artStatus === 'pending') return state;
    return Object.freeze({ ...state, phase: 'arrived' });
  }
  return state;
}

export function journeyArtName(journey: DecisionJourney): string {
  if (journey.option.id === 'hk') return 'decision-hk-pixel.webp';
  // Authored lighting threshold only; not a sunset calculation or exact place.
  return journey.option.arrivalMinutes < 18 * 60 ? 'decision-sz-day.webp' : 'decision-sz-evening.webp';
}
