import { SCENE_ART_OVERRIDES } from '../../src/world/scene-art.generated';
import { SCENE_IDS } from '../../src/world/types';
import type { SceneId } from '../../src/world/types';

// Explicit reader-visible oracle: no import of the calculations under test.
export const SCENES = SCENE_IDS;
export const artFor = (id: SceneId) => SCENE_ART_OVERRIDES[id]!.art!;
export const nameFor = (id: SceneId) => SCENE_ART_OVERRIDES[id]!.placeLabel!.split(' · ')[0];
export const pointFor = (id: SceneId) => SCENE_ART_OVERRIDES[id]!.points![0];
export const exitFor = (from: SceneId, to: SceneId) => {
  const exit = SCENE_ART_OVERRIDES[from]!.exits!.find(item => item.targetSceneId === to);
  if (!exit) throw new Error(`No physical entrance from ${from} to ${to}`);
  return exit;
};
export interface ChoiceCase { value: string; label: string; numbers: readonly [string, string, string][] }
export interface SceneCase { mechanism: string; choices: readonly [ChoiceCase, ChoiceCase]; unknown: string }
export const DECISION_SCENES = ['hk-home', 'parcel-counter', 'rental-home'] as const;
export type DecisionSceneId = typeof DECISION_SCENES[number];
export type ComparisonSceneId = Exclude<SceneId, DecisionSceneId>;
export const isDecisionScene = (id: SceneId): id is DecisionSceneId => (DECISION_SCENES as readonly string[]).includes(id);
export const DECISION_CASES: Record<DecisionSceneId, { mechanism: string; unknown: string }> = {
  'hk-home': { mechanism: 'home-plan', unknown: 'No complete Futian itinerary has been timed here.' },
  'parcel-counter': { mechanism: 'parcel-destination', unknown: 'Delivery duration, real fares, current fees, item eligibility and return terms are unknown.' },
  'rental-home': { mechanism: 'lease-tradeoff', unknown: 'Real rent, included charges, refund deductions, lease-break rights and eligibility require exact terms.' },
};
export const CASES: Record<ComparisonSceneId, SceneCase> = {
  'metro-carriage': { mechanism: 'journey-strip', choices: [
    { value: 'ride', label: 'Train ride', numbers: [] }, { value: 'whole', label: 'Door to door', numbers: [] },
  ], unknown: 'Direction-matched journey times, queues and onward services are unknown.' },
  'border-arrival': { mechanism: 'gate-chain', choices: [
    { value: 'crossing', label: 'Crossing only', numbers: [] }, { value: 'whole-trip', label: 'Whole trip', numbers: [] },
  ], unknown: 'Admission and travel-document conditions remain unverified.' },
  'mall-foodcourt': { mechanism: 'catchment-response', choices: [
    { value: 'cross-border', label: 'Visitor-led', numbers: [] }, { value: 'local-routine', label: 'Routine-led', numbers: [] },
  ], unknown: 'Customer origins, spending shares, demand trends, margins and actual adaptation are unmeasured.' },
  'neighborhood-lane': { mechanism: 'routine-map', choices: [
    { value: 'passing', label: 'Passing through', numbers: [] }, { value: 'returning', label: 'Return regularly', numbers: [] },
  ], unknown: 'Residents’ income, tenure, personal ties and feelings are unknown.' },
  'urban-village': { mechanism: 'access-detour', choices: [
    { value: 'open', label: 'Passage open', numbers: [['Example walk', '6', 'minutes']] },
    { value: 'closed', label: 'Passage closed', numbers: [['Example walk', '14', 'minutes']] },
  ], unknown: 'No real urban-village boundary, rent, tenure, redevelopment or resident characteristic is asserted.' },
  'luxury-home': { mechanism: 'ownership-payment', choices: [
    { value: 'payment', label: 'Split the payment', numbers: [['Interest paid', '8,000', 'HKD'], ['Debt reduced', '4,000', 'HKD']] },
    { value: 'asset', label: 'Look at the asset', numbers: [['Debt reduced', '4,000', 'HKD']] },
  ], unknown: 'Future property value, resale timing, exit costs, financing eligibility and local taxes are unknown.' },
  'office-floor': { mechanism: 'office-workweek', choices: [
    { value: '2', label: '2 days / week', numbers: [['Hong Kong home', '12', 'hours'], ['Shenzhen home', '28', 'hours']] },
    { value: '4', label: '4 days / week', numbers: [['Hong Kong home', '24', 'hours'], ['Shenzhen home', '56', 'hours']] },
  ], unknown: 'Actual fares, routes, queues, rent, eligibility and building occupancy are unknown.' },
  'learning-center': { mechanism: 'schedule-overlap', choices: [
    { value: 'earlier', label: 'Earlier session', numbers: [['Arrival', '18:45', 'local clock'], ['Late by', '15', 'minutes']] },
    { value: 'later', label: 'Later session', numbers: [['Arrival', '18:45', 'local clock'], ['Time before class', '45', 'minutes']] },
  ], unknown: 'No actual course, fee, admission, teaching quality or employment return is established.' },
  'planning-museum': { mechanism: 'regional-geography', choices: [
    { value: 'hk-sz', label: 'Hong Kong–Shenzhen', numbers: [] }, { value: 'gba', label: 'Greater Bay Area', numbers: [] },
  ], unknown: 'The former internal line is not drawn on this map.' },
};
