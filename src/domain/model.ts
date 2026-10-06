/** Money is HKD unless a field explicitly names a native currency. */
export type Origin = 'kowloon' | 'island';
export type ShenzhenRoute = 'rail' | 'bus';
export type OptionId = 'hk' | 'sz';
export type Currency = 'HKD' | 'CNY';
export type Feasibility = boolean | null;

export interface ValueWeights {
  /** Preference weights, each 0–5. These are not money or percentages. */
  price: number;
  ease: number;
  discovery: number;
}

export interface OutingInputs {
  origin: Origin;
  /** Minute of the departure day, 0–1439. Both cities use UTC+8. */
  departureMinutes: number;
  /** 0–2879. A clock time before departure is interpreted as the next day. */
  homeByMinutes: number;
  /** Normalized once to cents, rounding decimal half-cents up. */
  budgetPerPersonHKD: number;
  partySize: number;
  mealMinutes: number;
  weights: ValueWeights;
  szRoute: ShenzhenRoute;
  /** HKD paid per CNY, not CNY per HKD. */
  fxHKDPerCNY: number;
  /** Explicit overrides persist across route/origin changes; undefined restores the relevant fixture default. */
  borderBufferMinutes?: number;
  crossingClosingBufferMinutes?: number;
  hkMealPerPersonHKD?: number;
  szMealPerPersonCNY?: number;
  hkLocalMinutes?: number;
  szLocalMinutes?: number;
  walkMinutes?: number;
  entryEligibility?: 'confirmed' | 'unsure';
}

export interface CostFixture {
  id: string;
  label: string;
  currency: Currency;
  /** Unit amount is normalized to native-currency cents first. Null means unpriced, not zero. */
  amount: number | null;
  quantity: number;
  scope: 'per-person' | 'group';
  note: string;
}

export interface RouteOriginFixture {
  toCrossingMinutes: number;
  fromCrossingMinutes: number;
  fareEachWayHKD: number | null;
}

export interface RouteFixture {
  label: string;
  crossing: string;
  openingMinutes: number;
  closingMinutes: number;
  twentyFourHours: boolean;
  origins: Record<Origin, RouteOriginFixture>;
  destinationTransferMinutesEachWay: number;
  borderBufferMinutesEachWay: number;
  destinationFareEachWayCNY: number | null;
}

export interface OutingFixture {
  dataStatus: 'illustrative';
  statusLabel: string;
  assumptionNotes: string[];
  local: {
    label: string;
    description: string;
    walkMinutes: number;
    discoveryRating: number;
    origins: Record<Origin, { travelMinutesEachWay: number; fareEachWayHKD: number | null }>;
    costs: CostFixture[];
  };
  shenzhen: {
    label: string;
    description: string;
    walkMinutes: number;
    discoveryRating: number;
    costs: CostFixture[];
    routes: Record<ShenzhenRoute, RouteFixture>;
  };
  crossingHoursSource: { title: string; url: string; checkedDate: string; note: string };
}

export interface CostLineItem {
  id: string;
  label: string;
  currency: Currency;
  scope: 'per-person' | 'group';
  quantity: number;
  nativeUnitAmount: number | null;
  nativeGroupAmount: number | null;
  hkdGroupAmount: number | null;
  hkdPerPersonAmount: number | null;
  status: 'illustrative' | 'missing';
  note: string;
}

export interface ScoreBreakdown {
  price: number | null;
  ease: number;
  discovery: number;
  totalWeight: number;
  explanation: string;
}

export interface CrossingPlan {
  crossing: string;
  outwardStartMinutes: number;
  outwardEndMinutes: number;
  inwardStartMinutes: number;
  inwardEndMinutes: number;
  openingMinutes: number;
  closingMinutes: number;
  twentyFourHours: boolean;
  closingBufferMinutes: number;
}

export interface OutingOption {
  id: OptionId;
  label: string;
  description: string;
  routeLabel: string;
  lineItems: CostLineItem[];
  /** Null if any required cost is missing; never an incomplete sum. */
  perPersonHKD: number | null;
  groupHKD: number | null;
  /** Explicitly partial amount, useful when the total is unknown. */
  knownGroupSubtotalHKD: number;
  normalizedBudgetPerPersonHKD: number;
  missingCostLabels: string[];
  outwardMinutes: number;
  inwardMinutes: number;
  experienceMinutes: number;
  totalMinutes: number;
  borderBufferMinutes: number;
  departureMinutes: number;
  arrivalMinutes: number;
  experienceEndMinutes: number;
  returnMinutes: number;
  homeByMinutes: number;
  spareMinutes: number;
  budgetFeasible: Feasibility;
  homeFeasible: boolean;
  crossingFeasible: boolean;
  entryFeasible: Feasibility;
  /** True means fits this illustrative model, not a verified booking promise. */
  feasible: Feasibility;
  crossingPlan: CrossingPlan | null;
  score: number | null;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
  warnings: string[];
  dataStatus: 'illustrative';
}

export interface Recommendation {
  optionId: OptionId | null;
  label: string;
  reasons: string[];
}

export interface ComparisonResult {
  valid: boolean;
  errors: string[];
  options: OutingOption[];
  inputs: OutingInputs;
  normalizedHomeByMinutes: number | null;
  recommendation: Recommendation;
  warnings: string[];
  dataStatus: 'illustrative';
}

export interface AllocationWeights {
  worker: number;
  community: number;
  business: number;
}

export interface SurplusAllocation {
  valid: boolean;
  errors: string[];
  /** Pool is rounded to cents once before allocation. */
  poolHKD: number | null;
  poolCents: number | null;
  allocations: Record<keyof AllocationWeights, number> | null;
  allocationCents: Record<keyof AllocationWeights, number> | null;
  note: string;
}
