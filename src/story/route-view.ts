import { illustrativeData } from '../domain/data';
import { formatClock } from '../domain/engine';
import type { CostLineItem, OptionId, OutingFixture, OutingOption, ShenzhenRoute } from '../domain/model';
import { previewStoryAction, selectStoryOption, selectStoryProgress } from './engine';
import type { StoryProgress, StoryState } from './model';

export type RouteReturnIntent = 'planned' | 'direct';
export type RouteLegStatus = 'projected' | 'completed';
export interface RouteViewSettings { returnIntent?: RouteReturnIntent }
export interface RouteLeg {
  id: string;
  kind: 'travel' | 'clearance';
  from: string;
  to: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  status: RouteLegStatus;
  detail: string;
}
export interface RouteJourney {
  id: 'outward' | 'inward';
  title: string;
  from: string;
  to: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  status: RouteLegStatus;
  legs: RouteLeg[];
}
export interface RouteView {
  city: OptionId;
  route: ShenzhenRoute;
  routeLabel: string;
  routeChoices: { route: ShenzhenRoute; label: string }[];
  canSelectRoute: boolean;
  /** Always selected from the untouched source state; never the preview clock. */
  actualProgress: StoryProgress;
  /** An engine-derived forecast; at home this is the completed outing. */
  conditionalOption: OutingOption;
  isConditional: boolean;
  forecastText: string;
  costText: string;
  consequence: string;
  announcement: string;
  tradeoff: string | null;
  deadlineText: string;
  crossingFitText: string | null;
  entryText: string | null;
  warnings: string[];
  originLabel: string;
  destinationLabel: string;
  outward: RouteJourney;
  inward: RouteJourney;
  middle: {
    title: string;
    startMinutes: number;
    endMinutes: number;
    dinnerEndMinutes: number;
    mealText: string;
    walkText: string;
    delayText: string;
  };
  costLines: CostLineItem[];
  fxHKDPerCNY: number;
  crossingHours: { label: string; source: OutingFixture['crossingHoursSource']; marginText: string } | null;
}

export const formatRouteDuration = (value: number): string =>
  `${Math.floor(value / 60) ? `${Math.floor(value / 60)}h ` : ''}${value % 60 ? `${value % 60}m` : ''}`.trim() || '0m';
export const formatRouteMoney = (value: number): string => `HK$${value.toFixed(2)}`;

/** Compose existing pure previews so a disclosed story event is never added by UI arithmetic. */
function forecast(state: StoryState, city: OptionId, fixture: OutingFixture, returnIntent: RouteReturnIntent) {
  let projectedState = state;
  if (state.currentAttempt.phase === 'fork') {
    projectedState = previewStoryAction(state, {
      type: 'COMMIT_DEPARTURE', city, route: state.currentAttempt.route,
    }, fixture).state;
  }
  if (projectedState.currentAttempt.phase === 'arrival') {
    projectedState = previewStoryAction(projectedState, { type: 'COMMIT_DINNER', choice: 'simple' }, fixture).state;
  }
  // This optional intent is only meaningful when a real after-dinner choice is available.
  if (returnIntent === 'direct' && state.currentAttempt.phase === 'afterDinner') {
    projectedState = previewStoryAction(state, { type: 'RETURN_AFTER_DINNER' }, fixture).state;
  }
  return { option: selectStoryOption(projectedState, city, fixture), progress: selectStoryProgress(projectedState, fixture) };
}

function wholeOutingCost(option: OutingOption): string {
  if (option.perPersonHKD === null || option.groupHKD === null) {
    return `Whole-outing total unknown. Missing: ${option.missingCostLabels.join(', ')}.`;
  }
  return `Whole outing: ${formatRouteMoney(option.perPersonHKD)} each / ${formatRouteMoney(option.groupHKD)} for two.`;
}

function makeJourney(
  id: RouteJourney['id'], option: OutingOption, origin: string, destination: string, completed: boolean,
): RouteJourney {
  const outward = id === 'outward';
  const status: RouteLegStatus = completed ? 'completed' : 'projected';
  const startMinutes = outward ? option.departureMinutes : option.experienceEndMinutes;
  const endMinutes = outward ? option.arrivalMinutes : option.returnMinutes;
  const from = outward ? origin : destination;
  const to = outward ? destination : origin;
  const plan = option.crossingPlan;
  const leg = (key: string, kind: RouteLeg['kind'], label: string, a: string, b: string, start: number, end: number): RouteLeg => ({
    id: `${id}-${key}`, kind, label, from: a, to: b, startMinutes: start, endMinutes: end,
    durationMinutes: end - start, status,
    detail: kind === 'clearance'
      ? 'Authored clearance allowance for this direction, not a current queue estimate. Actual queues and entry eligibility remain unverified.'
      : 'Authored door-to-door travel allowance from the selected route and origin, including any explicit timing edits. It is not a timetable or live arrival estimate.',
  });
  const crossingStart = plan ? outward ? plan.outwardStartMinutes : plan.inwardStartMinutes : 0;
  const crossingEnd = plan ? outward ? plan.outwardEndMinutes : plan.inwardEndMinutes : 0;
  const legs = plan ? [
    leg('approach', 'travel', outward ? 'To the crossing' : 'Back to the crossing', from, plan.crossing, startMinutes, crossingStart),
    leg('clearance', 'clearance', `${plan.crossing} · ${outward ? 'outward' : 'return'} clearance allowance`, plan.crossing, plan.crossing, crossingStart, crossingEnd),
    leg('onward', 'travel', outward ? 'On to the dinner area' : 'Back to the starting area', plan.crossing, to, crossingEnd, endMinutes),
  ] : [leg('local', 'travel', outward ? 'Local outward journey' : 'Local return journey', from, to, startMinutes, endMinutes)];
  return { id, title: outward ? 'Going out' : 'Coming home', from, to, startMinutes, endMinutes,
    durationMinutes: outward ? option.outwardMinutes : option.inwardMinutes, status, legs };
}

/** Presentation only: no dispatch, mutation, independent clock, persisted folds, ranking or fare fixtures. */
export function selectRouteView(
  state: StoryState, fixture: OutingFixture = illustrativeData, settings: RouteViewSettings = {},
): RouteView | null {
  const attempt = state.currentAttempt;
  const city = attempt.city ?? state.previewCity;
  if (!city) return null;
  const returnIntent = settings.returnIntent ?? 'planned';
  const projected = forecast(state, city, fixture, returnIntent);
  const option = projected.option;
  if (!option) return null;
  const actualProgress = selectStoryProgress(state, fixture);
  const dinnerAssumed = attempt.dinnerChoice === null;
  const directPreview = returnIntent === 'direct' && attempt.phase === 'afterDinner';
  const walkAssumed = attempt.walkChoice === null && !directPreview;
  const isConditional = dinnerAssumed || walkAssumed || directPreview;
  const delayText = option.storyDelayMinutes > 0
    ? `${actualProgress.delayApplied ? 'Includes the applied' : 'Includes the disclosed'} ${option.storyDelayMinutes}-minute dinner delay.`
    : 'Calm version: no fictional dinner delay.';
  const forecastText = `${actualProgress.homeComplete
    ? `Completed in this model: home ${formatClock(option.returnMinutes)}.`
    : directPreview ? `If we head home now with no walk: modeled home ${formatClock(option.returnMinutes)}.`
      : dinnerAssumed ? `If we keep dinner simple and walk ${option.walkMinutes} minutes: modeled home ${formatClock(option.returnMinutes)}.`
        : walkAssumed ? `Dinner is committed. If we walk ${option.walkMinutes} minutes: modeled home ${formatClock(option.returnMinutes)}.`
          : `With our chosen ${option.walkMinutes}-minute walk: modeled home ${formatClock(option.returnMinutes)}.`} ${delayText}`;
  const costText = wholeOutingCost(option);
  const homeLabel = actualProgress.homeComplete ? 'home' : 'conditional home';
  const consequence = `${formatRouteDuration(option.outwardMinutes)} outward · arrive ${formatClock(option.arrivalMinutes)} · ${formatRouteDuration(option.inwardMinutes)} return · ${homeLabel} ${formatClock(option.returnMinutes)}. ${costText}`;
  let tradeoff: string | null = null;
  if (city === 'sz' && attempt.phase === 'fork') {
    const otherRoute = attempt.route === 'rail' ? 'bus' : 'rail';
    const otherState = previewStoryAction(state, { type: 'SET_ROUTE', route: otherRoute }, fixture).state;
    const other = forecast(otherState, city, fixture, returnIntent).option;
    if (other) {
      const travelDelta = option.outwardMinutes + option.inwardMinutes - other.outwardMinutes - other.inwardMinutes;
      const costDelta = option.perPersonHKD === null || other.perPersonHKD === null ? null
        : (Math.round(option.perPersonHKD * 100) - Math.round(other.perPersonHKD * 100)) / 100;
      tradeoff = `Compared with ${fixture.shenzhen.routes[otherRoute].label}: ${travelDelta === 0 ? 'the same round-trip travel time' : `${formatRouteDuration(Math.abs(travelDelta))} ${travelDelta > 0 ? 'more' : 'less'} round-trip travel`}; ${costDelta === null ? 'cost difference unknown' : costDelta === 0 ? 'the same whole-outing cost' : `${formatRouteMoney(Math.abs(costDelta))} ${costDelta > 0 ? 'more' : 'less'} per person`}.`;
    }
  }
  const originLabel = `${state.baseInputs.origin === 'island' ? 'Hong Kong Island / Central' : 'Kowloon / Tsim Sha Tsui'} (scenario)`;
  const destinationLabel = city === 'sz' ? 'Luohu dinner area (scenario)' : 'Hong Kong dinner area (scenario)';
  const deadlineText = option.spareMinutes >= 0
    ? `${formatRouteDuration(option.spareMinutes)} before the chosen ${formatClock(option.homeByMinutes)} home deadline.`
    : `${formatRouteDuration(-option.spareMinutes)} after the chosen ${formatClock(option.homeByMinutes)} home deadline.`;
  const crossingFitText = city === 'sz' ? option.crossingFeasible
    ? 'Both clearance intervals fit the modeled crossing window.'
    : 'A clearance interval falls outside the modeled crossing window or closing margin.' : null;
  const entryText = city === 'sz' ? 'Real entry eligibility, transport services, seats and queues remain unverified.' : null;
  const warnings = [
    ...(!option.homeFeasible ? [deadlineText] : []),
    ...(option.budgetFeasible === false ? [option.groupHKD === null ? 'Known costs already exceed the chosen allowance; the whole-outing total is still unknown.' : 'The whole outing exceeds the chosen allowance.'] : []),
    ...(option.perPersonHKD === null ? [costText] : []),
    ...(!option.crossingFeasible && crossingFitText ? [crossingFitText] : []),
  ];
  const plan = option.crossingPlan;
  return {
    city, route: attempt.route, routeLabel: option.routeLabel,
    routeChoices: (['rail', 'bus'] as const).map(route => ({ route, label: fixture.shenzhen.routes[route].label })),
    canSelectRoute: city === 'sz' && attempt.phase === 'fork', actualProgress, conditionalOption: option,
    isConditional, forecastText, costText, consequence,
    announcement: `${option.routeLabel}. Arrive ${formatClock(option.arrivalMinutes)}. ${forecastText} ${costText}`,
    tradeoff, deadlineText, crossingFitText, entryText, warnings, originLabel, destinationLabel,
    outward: makeJourney('outward', option, originLabel, destinationLabel, actualProgress.outwardComplete),
    inward: makeJourney('inward', option, originLabel, destinationLabel, actualProgress.homeComplete),
    middle: {
      title: actualProgress.homeComplete ? 'The evening we chose' : actualProgress.outwardComplete ? 'At the dinner area' : 'Dinner & a walk',
      startMinutes: option.arrivalMinutes, endMinutes: option.experienceEndMinutes,
      dinnerEndMinutes: projected.progress.dinnerEndMinutes!,
      mealText: `${option.mealMinutes}-minute ${option.includeSharedOrder ? 'dinner with a shared order' : 'simple dinner'} · ${dinnerAssumed ? 'assumed, still to choose' : 'completed'}`,
      walkText: option.walkMinutes === 0 ? `No walk · ${directPreview ? 'if we return now' : 'chosen direct return'}`
        : `${option.walkMinutes}-minute walk · ${walkAssumed ? 'assumed, still to choose' : 'completed'}`,
      delayText,
    },
    costLines: option.lineItems, fxHKDPerCNY: state.baseInputs.fxHKDPerCNY,
    crossingHours: plan ? {
      label: `${plan.crossing}: ${plan.twentyFourHours ? '24 hours' : `${formatClock(plan.openingMinutes)}–${formatClock(plan.closingMinutes % 1440)}`}`,
      source: fixture.crossingHoursSource,
      marginText: plan.twentyFourHours
        ? 'A 24-hour crossing does not guarantee a bus or any transport service home.'
        : `The engine uses a ${plan.closingBufferMinutes}-minute closing margin. It is not a last-train or service guarantee.`,
    } : null,
  };
}
