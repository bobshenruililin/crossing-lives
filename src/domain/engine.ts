import { illustrativeData } from './data';
import type {
  AllocationWeights, ComparisonResult, CostFixture, CostLineItem, CrossingPlan,
  Feasibility, OutingFixture, OutingInputs, OutingOption, Recommendation, SurplusAllocation,
} from './model';

export { defaultInputs } from './data';
export type * from './model';

const DAY = 1440;
const MAX_MONEY = 1_000_000_000;
/** Interpret a finite, nonnegative number's decimal representation without binary half-cent drift. */
function decimalRatio(value: number): [bigint, bigint] {
  const [significand, exponent = '0'] = value.toString().split('e');
  const decimalPlaces = significand.split('.')[1]?.length ?? 0;
  const power = Number(exponent) - decimalPlaces;
  const coefficient = BigInt(significand.replace('.', ''));
  return power >= 0 ? [coefficient * 10n ** BigInt(power), 1n] : [coefficient, 10n ** BigInt(-power)];
}
const roundRatioHalfUp = (numerator: bigint, denominator: bigint): number =>
  Number((numerator * 2n + denominator) / (denominator * 2n));
const toCents = (value: number): number => {
  const [numerator, denominator] = decimalRatio(value);
  return roundRatioHalfUp(numerator * 100n, denominator);
};
const scaleCents = (cents: number, factor: number, people = 1): number => {
  const [numerator, denominator] = decimalRatio(factor);
  return roundRatioHalfUp(BigInt(cents) * numerator * BigInt(people), denominator);
};
const roundMoney = (value: number): number => toCents(value) / 100;
const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));
const finiteRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function formatClock(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return 'Unknown';
  const whole = Math.floor(minutes);
  const day = Math.floor(whole / DAY);
  const clock = whole % DAY;
  const hhmm = `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
  return day ? `${hhmm} (+${day}d)` : hhmm;
}

export function validateInputs(inputs: OutingInputs): string[] {
  const errors: string[] = [];
  if (!inputs || typeof inputs !== 'object') return ['Outing inputs are required.'];
  if (!['kowloon', 'island'].includes(inputs.origin)) errors.push('Choose Kowloon / Tsim Sha Tsui or Hong Kong Island / Central as the origin.');
  if (!Number.isInteger(inputs.departureMinutes) || !finiteRange(inputs.departureMinutes, 0, DAY - 1)) errors.push('Departure must be a whole minute within the departure day.');
  if (!Number.isInteger(inputs.homeByMinutes) || !finiteRange(inputs.homeByMinutes, 0, DAY * 2 - 1)) errors.push('Home-by must be a whole minute on the departure day or the next day.');
  if (!finiteRange(inputs.budgetPerPersonHKD, 0, MAX_MONEY)) errors.push('Budget must be a finite, nonnegative HKD amount per person.');
  if (!Number.isInteger(inputs.partySize) || !finiteRange(inputs.partySize, 1, 6)) errors.push('Party size must be a whole number from 1 to 6.');
  if (!Number.isInteger(inputs.mealMinutes) || !finiteRange(inputs.mealMinutes, 60, 180)) errors.push('Meal duration must be a whole number from 60 to 180 minutes.');
  if (!['rail', 'bus'].includes(inputs.szRoute)) errors.push('Choose rail or bus for the Shenzhen route.');
  if (!finiteRange(inputs.fxHKDPerCNY, Number.MIN_VALUE, 100)) errors.push('FX must be greater than 0 and at most 100 HKD per CNY.');
  for (const key of ['price', 'ease', 'discovery'] as const) {
    if (!finiteRange(inputs.weights?.[key], 0, 5)) errors.push(`The ${key} preference weight must be from 0 to 5.`);
  }
  const assumptions: Array<[keyof OutingInputs, number, number]> = [
    ['borderBufferMinutes', 0, 240], ['crossingClosingBufferMinutes', 1, 120],
    ['hkLocalMinutes', 0, 180], ['szLocalMinutes', 0, 180], ['walkMinutes', 0, 180],
    ['hkMealPerPersonHKD', 0, MAX_MONEY], ['szMealPerPersonCNY', 0, MAX_MONEY],
  ];
  for (const [key, min, max] of assumptions) {
    const value = inputs[key];
    if (value !== undefined && !finiteRange(value, min, max)) errors.push(`${key} must be a finite number from ${min} to ${max}.`);
    if (value !== undefined && key.endsWith('Minutes') && !Number.isInteger(value)) errors.push(`${key} must be a whole number of minutes.`);
  }
  if (inputs.entryEligibility !== undefined && !['confirmed', 'unsure'].includes(inputs.entryEligibility)) errors.push('Entry eligibility must be confirmed or unsure.');
  return errors;
}

function priceLine(item: CostFixture, inputs: OutingInputs): CostLineItem {
  let valid = finiteRange(item.amount, 0, MAX_MONEY) && finiteRange(item.quantity, 0, 1_000)
    && ['HKD', 'CNY'].includes(item.currency) && ['per-person', 'group'].includes(item.scope);
  const unitCents = valid ? toCents(item.amount!) : null;
  const nativeGroupCents = unitCents === null ? null : scaleCents(unitCents, item.quantity, item.scope === 'group' ? 1 : inputs.partySize);
  const hkdGroupCents = nativeGroupCents === null ? null : scaleCents(nativeGroupCents, item.currency === 'CNY' ? inputs.fxHKDPerCNY : 1);
  valid = valid && Number.isSafeInteger(nativeGroupCents) && Number.isSafeInteger(hkdGroupCents);
  const nativeGroupAmount = valid ? nativeGroupCents! / 100 : null;
  const hkdGroupAmount = valid ? hkdGroupCents! / 100 : null;
  return {
    id: item.id, label: item.label, currency: item.currency, scope: item.scope,
    quantity: item.quantity, nativeUnitAmount: valid ? unitCents! / 100 : null,
    nativeGroupAmount, hkdGroupAmount,
    hkdPerPersonAmount: hkdGroupAmount === null ? null : roundRatioHalfUp(BigInt(hkdGroupCents!), BigInt(inputs.partySize)) / 100,
    status: valid ? 'illustrative' : 'missing', note: item.note,
  };
}

/** A crossing must begin and finish during the same daily open interval. */
function crossingWindowFits(start: number, end: number, plan: CrossingPlan): boolean {
  if (plan.twentyFourHours) return true;
  const dayStart = Math.floor(start / DAY) * DAY;
  return start >= dayStart + plan.openingMinutes && end <= dayStart + plan.closingMinutes - plan.closingBufferMinutes;
}

const andFeasibility = (...flags: Feasibility[]): Feasibility =>
  flags.includes(false) ? false : flags.includes(null) ? null : true;

/** Use after input validation. Undefined means automatic; an explicit edit persists until cleared. */
export function effectiveTravelAssumptions(inputs: OutingInputs, fixture: OutingFixture = illustrativeData) {
  const route = fixture.shenzhen.routes[inputs.szRoute];
  return {
    hkLocalMinutes: inputs.hkLocalMinutes ?? fixture.local.origins[inputs.origin].travelMinutesEachWay,
    szLocalMinutes: inputs.szLocalMinutes ?? route.destinationTransferMinutesEachWay,
    borderBufferMinutes: inputs.borderBufferMinutes ?? route.borderBufferMinutesEachWay,
    crossingClosingBufferMinutes: inputs.crossingClosingBufferMinutes ?? 15,
  };
}

function makeOption(id: 'hk' | 'sz', inputs: OutingInputs, fixture: OutingFixture, homeBy: number): OutingOption {
  const isLocal = id === 'hk';
  const experience = isLocal ? fixture.local : fixture.shenzhen;
  const localOrigin = fixture.local.origins[inputs.origin];
  const route = fixture.shenzhen.routes[inputs.szRoute];
  const routeOrigin = route.origins[inputs.origin];
  const travel = effectiveTravelAssumptions(inputs, fixture);
  const localMinutes = travel.hkLocalMinutes;
  const destinationMinutes = travel.szLocalMinutes;
  const borderMinutes = travel.borderBufferMinutes;
  const outwardMinutes = isLocal ? localMinutes : routeOrigin.toCrossingMinutes + borderMinutes + destinationMinutes;
  const inwardMinutes = isLocal ? localMinutes : destinationMinutes + borderMinutes + routeOrigin.fromCrossingMinutes;
  const experienceMinutes = inputs.mealMinutes + (inputs.walkMinutes ?? experience.walkMinutes);
  const arrivalMinutes = inputs.departureMinutes + outwardMinutes;
  const experienceEndMinutes = arrivalMinutes + experienceMinutes;
  const returnMinutes = experienceEndMinutes + inwardMinutes;
  const travelCosts: CostFixture[] = isLocal ? [{
    id: 'hk-transport', label: 'Local transport · round trip', currency: 'HKD',
    amount: localOrigin.fareEachWayHKD, quantity: 2, scope: 'per-person', note: 'Two illustrative one-way fares per person.',
  }] : [{
    id: 'sz-cross-border', label: `${inputs.szRoute === 'rail' ? 'Rail' : 'Bus'} · round trip`, currency: 'HKD',
    amount: routeOrigin.fareEachWayHKD, quantity: 2, scope: 'per-person', note: 'Two illustrative one-way fares per person; not a live fare quote.',
  }, {
    id: 'sz-local-transport', label: 'Shenzhen transfers · round trip', currency: 'CNY',
    amount: route.destinationFareEachWayCNY, quantity: 2, scope: 'per-person', note: 'Illustrative destination transfers each way.',
  }];
  const mealOverride = isLocal ? inputs.hkMealPerPersonHKD : inputs.szMealPerPersonCNY;
  const experienceCosts = experience.costs.map(item => item.id === `${id}-dinner` && mealOverride !== undefined
    ? { ...item, amount: mealOverride, note: 'Editable illustrative meal allowance per person.' }
    : item);
  const lineItems = [...experienceCosts, ...travelCosts].map(item => priceLine(item, inputs));
  const missingCostLabels = lineItems.filter(item => item.hkdGroupAmount === null).map(item => item.label);
  const knownGroupCents = lineItems.reduce((sum, item) => sum + (item.hkdGroupAmount === null ? 0 : toCents(item.hkdGroupAmount)), 0);
  const knownGroupSubtotalHKD = knownGroupCents / 100;
  const groupHKD = missingCostLabels.length ? null : knownGroupSubtotalHKD;
  const perPersonHKD = groupHKD === null ? null : roundRatioHalfUp(BigInt(knownGroupCents), BigInt(inputs.partySize)) / 100;
  const budgetCents = toCents(inputs.budgetPerPersonHKD);
  const normalizedBudgetPerPersonHKD = budgetCents / 100;
  // Compare group cents to the party's combined per-person budget, avoiding a rounded average falsely fitting.
  const budgetFeasible = knownGroupCents > budgetCents * inputs.partySize ? false : groupHKD === null ? null : true;
  const homeFeasible = returnMinutes <= homeBy;
  const crossingPlan: CrossingPlan | null = isLocal ? null : {
    crossing: route.crossing,
    outwardStartMinutes: inputs.departureMinutes + routeOrigin.toCrossingMinutes,
    outwardEndMinutes: inputs.departureMinutes + routeOrigin.toCrossingMinutes + borderMinutes,
    inwardStartMinutes: experienceEndMinutes + destinationMinutes,
    inwardEndMinutes: experienceEndMinutes + destinationMinutes + borderMinutes,
    openingMinutes: route.openingMinutes, closingMinutes: route.closingMinutes, twentyFourHours: route.twentyFourHours,
    closingBufferMinutes: travel.crossingClosingBufferMinutes,
  };
  const crossingFeasible = crossingPlan === null || (
    crossingWindowFits(crossingPlan.outwardStartMinutes, crossingPlan.outwardEndMinutes, crossingPlan) &&
    crossingWindowFits(crossingPlan.inwardStartMinutes, crossingPlan.inwardEndMinutes, crossingPlan)
  );
  const entryFeasible = isLocal || inputs.entryEligibility === 'confirmed' ? true : null;
  const feasible = andFeasibility(budgetFeasible, homeFeasible, crossingFeasible, entryFeasible);
  const priceScore = groupHKD === null ? null : budgetCents === 0
    ? (knownGroupCents === 0 ? 100 : 0)
    : clamp((1 - knownGroupCents / (budgetCents * inputs.partySize)) * 100);
  const easeScore = clamp((1 - (outwardMinutes + inwardMinutes) / 240) * 100);
  const discoveryScore = clamp(experience.discoveryRating);
  const totalWeight = inputs.weights.price + inputs.weights.ease + inputs.weights.discovery;
  const score = totalWeight === 0 || (priceScore === null && inputs.weights.price > 0) ? null : roundMoney(
    ((priceScore ?? 0) * inputs.weights.price + easeScore * inputs.weights.ease + discoveryScore * inputs.weights.discovery) / totalWeight,
  );
  const reasons: string[] = [];
  // Put blockers first: compact UI views must not hide them behind positive facts.
  if (!crossingFeasible) reasons.push('A planned border crossing falls outside the opening hours or leaves less than the chosen closing buffer.');
  if (entryFeasible === null) reasons.push('Entry eligibility is unconfirmed. Check your documents and permission to enter before choosing this option.');
  if (budgetFeasible === false) reasons.push(`${groupHKD === null ? 'Known costs alone exceed' : 'The group bill exceeds'} your combined per-person budgets by ${groupHKD === null ? 'at least ' : ''}HK$${((knownGroupCents - budgetCents * inputs.partySize) / 100).toFixed(2)}.`);
  if (groupHKD === null) reasons.push(`Total unknown: missing ${missingCostLabels.join(', ')}.`);
  if (!homeFeasible) reasons.push(`Home at ${formatClock(returnMinutes)}, ${returnMinutes - homeBy} minutes after the deadline.`);
  if (budgetFeasible === true) reasons.push(`Within the HK$${normalizedBudgetPerPersonHKD.toFixed(2)} per-person budget.`);
  if (homeFeasible) reasons.push(`Home at ${formatClock(returnMinutes)}, ${homeBy - returnMinutes} minutes before the deadline.`);
  const warnings = ['All cost and journey-time figures are illustrative estimates.'];
  if (!isLocal) {
    warnings.push('Crossing-hours fit does not confirm transport service or immigration eligibility. Verify both before travel.');
    warnings.push(`Includes ${borderMinutes} minutes of border buffer each way; actual queues may be longer.`);
    if (!route.twentyFourHours) warnings.push(`Keeps a ${crossingPlan!.closingBufferMinutes}-minute buffer before the crossing closes. This is a modeled margin, not a guaranteed last-safe departure.`);
  }
  if (returnMinutes >= DAY) warnings.push(`Returns on the next day at ${formatClock(returnMinutes)}.`);
  return {
    id, label: experience.label, description: experience.description,
    routeLabel: isLocal ? 'Local transit and walking' : route.label,
    lineItems, perPersonHKD, groupHKD, knownGroupSubtotalHKD, normalizedBudgetPerPersonHKD, missingCostLabels,
    outwardMinutes, inwardMinutes, experienceMinutes, totalMinutes: outwardMinutes + experienceMinutes + inwardMinutes,
    borderBufferMinutes: isLocal ? 0 : 2 * borderMinutes,
    departureMinutes: inputs.departureMinutes, arrivalMinutes, experienceEndMinutes, returnMinutes,
    homeByMinutes: homeBy, spareMinutes: homeBy - returnMinutes,
    budgetFeasible, homeFeasible, crossingFeasible, entryFeasible, feasible, crossingPlan, score,
    scoreBreakdown: {
      price: priceScore === null ? null : roundMoney(priceScore), ease: roundMoney(easeScore), discovery: discoveryScore, totalWeight,
      explanation: 'Price = budget left as a percentage (clamped 0–100). Ease = 100 minus round-trip travel minutes / 240 × 100 (clamped 0–100). Discovery = the authored itinerary rating. The final score is the weighted average; infeasible options are excluded from the recommendation.',
    },
    reasons, warnings, dataStatus: 'illustrative',
  };
}

function recommend(options: OutingOption[], inputs: OutingInputs): Recommendation {
  const eligible = options.filter(option => option.feasible === true);
  if (!eligible.length) return {
    optionId: null,
    label: options.some(option => option.feasible === null) ? 'More information needed' : 'Neither outing fits these constraints',
    reasons: ['Check the cost, home-by and crossing-hours flags. Change the scenario before choosing an outing.'],
  };
  if (eligible.length === 1) return {
    optionId: eligible[0].id, label: `${eligible[0].label} fits this scenario`,
    reasons: ['It is the only option that fits all the modeled constraints with complete costs.', 'This is an illustrative comparison, not a verified travel recommendation.'],
  };
  if (inputs.weights.price + inputs.weights.ease + inputs.weights.discovery === 0) return {
    optionId: null, label: 'Both fit; choose what matters', reasons: ['All preference weights are zero, so neither option receives a preference ranking.'],
  };
  const ranked = [...eligible].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  if (ranked[0].score === ranked[1].score) return {
    optionId: null, label: 'Both fit equally well', reasons: ['The transparent rubric produces the same score for both outings at these weights.'],
  };
  return {
    optionId: ranked[0].id,
    label: `${ranked[0].label} edges ahead`,
    reasons: [
      `It scores ${ranked[0].score?.toFixed(1)} versus ${ranked[1].score?.toFixed(1)} with price / ease / discovery weights ${inputs.weights.price} / ${inputs.weights.ease} / ${inputs.weights.discovery}.`,
      'This deterministic rubric uses the displayed assumptions, not an AI prediction of your enjoyment.',
    ],
  };
}

export function compareOutings(inputs: OutingInputs, fixture: OutingFixture = illustrativeData): ComparisonResult {
  const errors = validateInputs(inputs);
  if (errors.length) return {
    valid: false, errors, options: [], inputs, normalizedHomeByMinutes: null,
    recommendation: { optionId: null, label: 'Check your inputs', reasons: errors },
    warnings: [], dataStatus: 'illustrative',
  };
  const normalizedHomeByMinutes = inputs.homeByMinutes < inputs.departureMinutes ? inputs.homeByMinutes + DAY : inputs.homeByMinutes;
  const options = (['hk', 'sz'] as const).map(id => makeOption(id, inputs, fixture, normalizedHomeByMinutes));
  return {
    valid: true, errors: [], inputs, normalizedHomeByMinutes, options,
    recommendation: recommend(options, inputs), warnings: [...fixture.assumptionNotes], dataStatus: 'illustrative',
  };
}

/** A separate fixed-pool what-if; there is no relationship to outing savings or ownership. */
export function allocateSurplus(poolHKD: number, weights: AllocationWeights): SurplusAllocation {
  const note = 'An optional fixed-pool allocation scenario only. It makes no claim that ownership creates a surplus or causes any distribution.';
  const errors: string[] = [];
  const validPool = finiteRange(poolHKD, 0, MAX_MONEY);
  if (!validPool) errors.push('The surplus pool must be a finite, nonnegative HKD amount.');
  const normalizedPoolCents = validPool ? toCents(poolHKD) : null;
  const keys = ['worker', 'community', 'business'] as const;
  for (const key of keys) if (!finiteRange(weights?.[key], 0, MAX_MONEY)) errors.push(`The ${key} allocation weight must be finite and nonnegative.`);
  const weightTotal = keys.reduce((sum, key) => sum + (weights?.[key] ?? 0), 0);
  if (weightTotal === 0 && (normalizedPoolCents ?? 0) > 0) errors.push('At least one allocation weight must be positive for a nonzero rounded pool.');
  if (errors.length) return { valid: false, errors, poolHKD: null, poolCents: null, allocations: null, allocationCents: null, note };
  const poolCents = normalizedPoolCents!;
  const exact = keys.map(key => weightTotal > 0 ? poolCents * weights[key] / weightTotal : 0);
  const cents = exact.map(Math.floor);
  let remaining = poolCents - cents.reduce((sum, value) => sum + value, 0);
  // Largest remainder. Equal remainders use the declared worker/community/business order.
  const remainderOrder = keys.map((_, index) => index).sort((a, b) => (exact[b] - cents[b]) - (exact[a] - cents[a]) || a - b);
  for (const index of remainderOrder) {
    if (remaining <= 0) break;
    cents[index] += 1;
    remaining -= 1;
  }
  const allocationCents = { worker: cents[0], community: cents[1], business: cents[2] };
  const allocations = { worker: cents[0] / 100, community: cents[1] / 100, business: cents[2] / 100 };
  return { valid: true, errors: [], poolHKD: poolCents / 100, poolCents, allocations, allocationCents, note };
}
