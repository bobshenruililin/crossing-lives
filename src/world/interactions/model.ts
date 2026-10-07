import { WORLD_SCENES } from './content';
import type { SceneId, InteractionValues } from '../types';

export interface KeyNumber { label: string; value: string | number; unit: string }
export interface PublicSource { id: string; title: string; url: string; supports: string; limit: string }
export interface ContentVariant { value: string; label: string; thought: string; consequence: string; visual: Record<string, unknown>; keyNumbers: readonly KeyNumber[] }
export interface SceneContent {
  title: string; placeLabel: string; pointLabel: string; thought: string;
  action: {
    question: string;
    input: { label: string; defaultValue: string; choices: readonly { value: string; label: string }[] };
    variants: readonly ContentVariant[]; aha: string; evidenceStatus: string;
    unknowns: readonly string[]; publicSources: readonly PublicSource[];
    scope?: string; fictionalInputs?: Record<string, unknown>;
  };
}
export const sceneContent = (id: SceneId) => WORLD_SCENES[id] as unknown as SceneContent;
export function selectedVariant(id: SceneId, values: InteractionValues): ContentVariant {
  const action = sceneContent(id).action;
  return action.variants.find(v => v.value === values.choice) ?? action.variants.find(v => v.value === action.input.defaultValue)!;
}
/** A local replacement only. Never changes context, storage, or any other scene. */
export function changeChoice(id: SceneId, values: InteractionValues, choice: string): InteractionValues {
  if (!sceneContent(id).action.input.choices.some(v => v.value === choice)) throw new RangeError('Unknown scene choice.');
  return { ...values, choice };
}
function fixture(id: SceneId, key: string): number {
  const value = sceneContent(id).action.fictionalInputs?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Missing fixture ${id}.${key}`);
  return value;
}
export function clockMinute(id: 'hk-home', choice: string): number {
  if (!sceneContent(id).action.input.choices.some(v => v.value === choice)) throw new RangeError('Unknown clock choice.');
  return fixture(id, choice);
}
export const formatClock = (minute: number) => `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;
export function clockHands(minute: number) {
  const hourAngle = ((minute % 720) / 720) * Math.PI * 2;
  const minuteAngle = ((minute % 60) / 60) * Math.PI * 2;
  return { hour: { x: 85 + 37 * Math.sin(hourAngle), y: 80 - 37 * Math.cos(hourAngle) }, minute: { x: 85 + 47 * Math.sin(minuteAngle), y: 80 - 47 * Math.cos(minuteAngle) } };
}
export function mortgageAllocation() {
  const initialDebt = fixture('luxury-home', 'initialLoanHKD');
  const payment = fixture('luxury-home', 'firstPaymentHKD');
  const interest = Math.round(initialDebt * fixture('luxury-home', 'annualNominalRate') / 12 * 100) / 100;
  const principal = payment - interest;
  return { initialDebt, payment, interest, principal, remainingDebt: initialDebt - principal, interestShare: interest / payment, principalShare: principal / payment };
}
/** Every schedule object uses the same minute-to-coordinate transform. */
export function learningSchedule(choice: string) {
  if (choice !== 'earlier' && choice !== 'later') throw new RangeError('Unknown class choice.');
  const finish = fixture('learning-center', 'workFinishMinute');
  const arrival = finish + fixture('learning-center', 'journeyMinutes');
  const classStart = fixture('learning-center', choice === 'earlier' ? 'earlyClassMinute' : 'laterClassMinute');
  const x = (minute: number) => 36 + ((minute - finish) / 120) * 288;
  return { finish, arrival, classStart, margin: classStart - arrival, finishX: x(finish), arrivalX: x(arrival), classX: x(classStart), hourX: x(finish + 60), endX: x(finish + 120) };
}
/** Calculate the disclosed toy inputs only; context is deliberately not accepted. */
export function sceneNumbers(id: SceneId, value: string): readonly KeyNumber[] {
  const action = sceneContent(id).action;
  const variant = action.variants.find(v => v.value === value);
  if (!variant) throw new RangeError('Unknown scene choice.');
  const number = (key: string) => fixture(id, key);
  if (id === 'hk-home') return [{ label: 'Home by', value: formatClock(clockMinute(id, value)), unit: 'local clock' }];
  if (id === 'parcel-counter') {
    const dedicated = value === 'dedicated-trip';
    return [{ label: 'Extra logistics', value: number('counterHandling') + number('localDetourTransport') + (dedicated ? number('dedicatedTripTransport') : 0), unit: 'CNY-equivalent' }, { label: 'Extra time', value: number('localDetourMinutes') + (dedicated ? number('dedicatedTripMinutes') : 0), unit: 'minutes' }];
  }
  if (id === 'urban-village') {
    const edges = action.fictionalInputs?.[value === 'open' ? 'openEdgesMinutes' : 'closedEdgesMinutes'];
    if (!Array.isArray(edges) || !edges.every(x => typeof x === 'number' && Number.isFinite(x))) throw new TypeError('Invalid route fixture.');
    return [{ label: 'Example walk', value: edges.reduce((a, b) => a + b, 0), unit: 'minutes' }];
  }
  if (id === 'rental-home') return [{ label: value === 'cash-out' ? 'Rent paid' : 'Use paid', value: number('firstMonthRentHKD'), unit: 'HKD' }, { label: value === 'cash-out' ? 'Deposit held' : 'Return claim', value: number('depositHKD'), unit: 'HKD' }];
  if (id === 'luxury-home') {
    const { interest, principal } = mortgageAllocation();
    return value === 'payment' ? [{ label: 'Interest paid', value: interest, unit: 'HKD' }, { label: 'Debt reduced', value: principal, unit: 'HKD' }] : [{ label: 'Debt reduced', value: principal, unit: 'HKD' }];
  }
  if (id === 'learning-center') {
    const { arrival, margin } = learningSchedule(value);
    return [{ label: 'Arrival', value: formatClock(arrival), unit: 'local clock' }, { label: margin < 0 ? 'Late by' : 'Time before class', value: Math.abs(margin), unit: 'minutes' }];
  }
  return variant.keyNumbers.map(number => ({ ...number }));
}
