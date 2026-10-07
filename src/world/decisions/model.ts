import type { InteractionValues, SceneId } from '../types';

/** Authored allowances, not measured Hong Kong–Futian journey times. */
export const HOME_FIXTURE = Object.freeze({ startMinute: 660, fixedCommitmentMinutes: 360, earlier: 1350, later: 1410 });
export const HOME_ACTIVITIES = [
  { id: 'lunch', label: 'Lunch', sceneId: 'mall-foodcourt', fullMinutes: 90, shortMinutes: 60 },
  { id: 'neighborhood', label: 'Neighborhood walk', sceneId: 'neighborhood-lane', fullMinutes: 150, shortMinutes: 90 },
  { id: 'exhibition', label: 'Planning exhibition', sceneId: 'planning-museum', fullMinutes: 120, shortMinutes: 60 },
] as const;
export type ActivityId = typeof HOME_ACTIVITIES[number]['id'];
export type ActivityChoice = 'full' | 'short' | 'omit';
export type DeadlineChoice = 'earlier' | 'later';
export interface HomePlan { deadline: DeadlineChoice; activities: Record<ActivityId, ActivityChoice> }
export const clockText = (minutes: number) => `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
const activityChoice = (value: unknown): ActivityChoice => value === 'short' || value === 'omit' ? value : 'full';

export function readHomePlan(values: InteractionValues): HomePlan {
  return {
    deadline: (values.homeDeadline ?? values.choice) === 'earlier' ? 'earlier' : 'later',
    activities: { lunch: activityChoice(values.homeLunch), neighborhood: activityChoice(values.homeNeighborhood), exhibition: activityChoice(values.homeExhibition) },
  };
}
export function setHomeDeadline(plan: HomePlan, deadline: DeadlineChoice): HomePlan {
  if (deadline !== 'earlier' && deadline !== 'later') throw new RangeError('Unknown home-by choice.');
  return { ...plan, deadline };
}
export function setHomeActivity(plan: HomePlan, id: ActivityId, choice: ActivityChoice): HomePlan {
  if (!HOME_ACTIVITIES.some(activity => activity.id === id) || !['full', 'short', 'omit'].includes(choice)) throw new RangeError('Unknown activity choice.');
  return { ...plan, activities: { ...plan.activities, [id]: choice } };
}
export function keepEverything(plan: HomePlan): HomePlan {
  return { ...plan, activities: { lunch: 'full', neighborhood: 'full', exhibition: 'full' } };
}
export function homeSnapshot(plan: HomePlan) {
  const activities = HOME_ACTIVITIES.map(activity => ({ ...activity, choice: plan.activities[activity.id], minutes: plan.activities[activity.id] === 'omit' ? 0 : plan.activities[activity.id] === 'short' ? activity.shortMinutes : activity.fullMinutes }));
  const activityMinutes = activities.reduce((sum, activity) => sum + activity.minutes, 0);
  const totalMinutes = HOME_FIXTURE.fixedCommitmentMinutes + activityMinutes;
  const deadlineMinute = HOME_FIXTURE[plan.deadline];
  const finishMinute = HOME_FIXTURE.startMinute + totalMinutes;
  const marginMinutes = deadlineMinute - finishMinute;
  return { activities, activityMinutes, totalMinutes, deadlineMinute, finishMinute, marginMinutes, lateMinutes: Math.max(0, -marginMinutes), spareMinutes: Math.max(0, marginMinutes), availableMinutes: deadlineMinute - HOME_FIXTURE.startMinute };
}
/** Only the explicit take-plan action writes a plan. Unknown and legacy keys survive. */
export function commitHomePlan(values: InteractionValues, plan: HomePlan): InteractionValues {
  return { ...values, homePlanTaken: true, homeDeadline: plan.deadline, homeLunch: plan.activities.lunch, homeNeighborhood: plan.activities.neighborhood, homeExhibition: plan.activities.exhibition };
}
export function committedHomeSummary(values: InteractionValues) {
  if (values.homePlanTaken !== true) return null;
  const plan = readHomePlan(values), snapshot = homeSnapshot(plan);
  const suggestedPlaces: readonly SceneId[] = snapshot.activities.filter(activity => activity.minutes > 0).map(activity => activity.sceneId);
  return { plan, ...snapshot, suggestedPlaces };
}

export const PARCEL_FIXTURE = Object.freeze({ handling: 6, detourTransport: 10, detourMinutes: 20, dedicatedTransport: 100, dedicatedMinutes: 140, delivery: 35, unit: 'CNY-equivalent' });
export type ParcelContext = 'already-going' | 'dedicated-trip';
export type ParcelMethod = 'collection' | 'delivery';
export interface ParcelDecision { context: ParcelContext; method: ParcelMethod | null }
export function readParcelDecision(values: InteractionValues): ParcelDecision {
  return { context: (values.parcelContext ?? values.choice) === 'dedicated-trip' ? 'dedicated-trip' : 'already-going', method: values.parcelMethod === 'collection' || values.parcelMethod === 'delivery' ? values.parcelMethod : null };
}
export function setParcelContext(decision: ParcelDecision, context: ParcelContext): ParcelDecision {
  if (context !== 'already-going' && context !== 'dedicated-trip') throw new RangeError('Unknown parcel context.');
  return { ...decision, context };
}
export function setParcelMethod(decision: ParcelDecision, method: ParcelMethod): ParcelDecision {
  if (method !== 'collection' && method !== 'delivery') throw new RangeError('Unknown parcel method.');
  return { ...decision, method };
}
export function parcelSnapshot(decision: ParcelDecision) {
  const dedicated = decision.context === 'dedicated-trip';
  const pickupCost = PARCEL_FIXTURE.handling + PARCEL_FIXTURE.detourTransport + (dedicated ? PARCEL_FIXTURE.dedicatedTransport : 0);
  const pickupMinutes = PARCEL_FIXTURE.detourMinutes + (dedicated ? PARCEL_FIXTURE.dedicatedMinutes : 0);
  return {
    pickupCost, pickupMinutes, deliveryCost: PARCEL_FIXTURE.delivery, deliveryDuration: null,
    selectedCost: decision.method === 'collection' ? pickupCost : decision.method === 'delivery' ? PARCEL_FIXTURE.delivery : null,
    selectedMinutes: decision.method === 'collection' ? pickupMinutes : null,
    deliveryMinusCollection: PARCEL_FIXTURE.delivery - pickupCost,
    unit: PARCEL_FIXTURE.unit,
  };
}
export function commitParcelDecision(values: InteractionValues, decision: ParcelDecision): InteractionValues {
  if (decision.method === null) throw new RangeError('Choose a parcel destination first.');
  return { ...values, parcelContext: decision.context, parcelMethod: decision.method };
}

/** The same fictional room and 12-month term; these are invented HKD offers. */
export const RENTAL_FIXTURE = Object.freeze({ startingCash: 24000, termMonths: 12, unit: 'HKD', otherMoveInCharges: 0 });
export const LEASE_OFFERS = {
  'lower-rent': { id: 'lower-rent', label: 'Lower monthly rent', monthlyRent: 6000, deposit: 12000 },
  'less-upfront': { id: 'less-upfront', label: 'Less cash tied up', monthlyRent: 7500, deposit: 7500 },
} as const;
export type LeaseChoice = keyof typeof LEASE_OFFERS;
export const RENTAL_REFUND_TERMS = 'Deposit is held, not spendable. This fictional lease allows a return after the term, less agreed deductions for damage or unpaid amounts. Refund amount and timing are unknown.';
export function readLeaseChoice(values: InteractionValues): LeaseChoice | null {
  return values.leaseChoice === 'lower-rent' || values.leaseChoice === 'less-upfront' ? values.leaseChoice : null;
}
export function rentalSnapshot(choice: LeaseChoice) {
  if (choice !== 'lower-rent' && choice !== 'less-upfront') throw new RangeError('Unknown fictional lease.');
  const offer = LEASE_OFFERS[choice];
  const rentPaid = offer.monthlyRent;
  const conditionalDeposit = offer.deposit;
  const cashOut = rentPaid + conditionalDeposit + RENTAL_FIXTURE.otherMoveInCharges;
  return { offer, startingCash: RENTAL_FIXTURE.startingCash, rentPaid, conditionalDeposit, cashOut, liquidCash: RENTAL_FIXTURE.startingCash - cashOut, recurringRent: offer.monthlyRent, refundAmount: null, refundTiming: null, unit: RENTAL_FIXTURE.unit };
}
export function commitLeaseChoice(values: InteractionValues, choice: LeaseChoice): InteractionValues {
  rentalSnapshot(choice);
  return { ...values, leaseChoice: choice };
}
