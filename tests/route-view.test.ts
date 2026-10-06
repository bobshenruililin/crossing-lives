import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeData } from '../src/domain/data';
import { formatClock } from '../src/domain/engine';
import type { OutingFixture, ShenzhenRoute } from '../src/domain/model';
import { createStoryState, selectStoryOption, selectStoryProgress, storyReducer } from '../src/story/engine';
import type { StoryAction, StoryState } from '../src/story/model';
import { selectRouteView } from '../src/story/route-view';
import type { RouteJourney } from '../src/story/route-view';

const dispatch = (state: StoryState, ...actions: StoryAction[]) => actions.reduce(storyReducer, state);
const preview = (city: 'hk' | 'sz' = 'sz', state = createStoryState()) => storyReducer(state, { type: 'PREVIEW_CITY', city });
const viewOf = (state: StoryState, fixture?: OutingFixture, returnIntent: 'planned' | 'direct' = 'planned') => {
  const view = selectRouteView(state, fixture, { returnIntent });
  assert.ok(view);
  return view;
};
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const assertFullJourney = (journey: RouteJourney) => {
  assert.equal(journey.legs[0].startMinutes, journey.startMinutes);
  assert.equal(journey.legs.at(-1)!.endMinutes, journey.endMinutes);
  assert.equal(journey.legs[0].from, journey.from);
  assert.equal(journey.legs.at(-1)!.to, journey.to);
  assert.equal(journey.legs.reduce((sum, leg) => sum + leg.durationMinutes, 0), journey.durationMinutes);
  assert.equal(journey.endMinutes - journey.startMinutes, journey.durationMinutes);
  journey.legs.forEach((leg, index) => {
    assert.equal(leg.durationMinutes, leg.endMinutes - leg.startMinutes);
    assert.equal(leg.status, journey.status);
    if (index) assert.equal(journey.legs[index - 1].endMinutes, leg.startMinutes);
  });
};

test('no route is fabricated before choosing a city', () => {
  const state = freeze(createStoryState());
  assert.equal(selectRouteView(state), null);
  assert.equal(selectStoryProgress(state).clockMinutes, 990);
});

test('default route forecasts compose departure and simple dinner, leaving actual 16:30 unchanged', () => {
  for (const [city, route, arrival, home, perPerson, group] of [
    ['sz', 'rail', '18:15', '22:15', 260.22, 520.44],
    ['sz', 'bus', '18:45', '23:15', 326.58, 653.16],
    ['hk', 'rail', '16:45', '19:15', 304, 608],
  ] as const) {
    const state = freeze(dispatch(preview(city), { type: 'SET_ROUTE', route }));
    const before = structuredClone(state);
    const view = viewOf(state);
    assert.equal(formatClock(view.conditionalOption.arrivalMinutes), arrival);
    assert.equal(formatClock(view.conditionalOption.returnMinutes), home);
    assert.equal(view.conditionalOption.perPersonHKD, perPerson);
    assert.equal(view.conditionalOption.groupHKD, group);
    assert.equal(view.actualProgress.clockMinutes, 990);
    assert.equal(view.actualProgress.elapsedMinutes, 0);
    assert.equal(view.actualProgress.phase, 'fork');
    assert.equal(view.actualProgress.outwardComplete, false);
    assert.equal(view.conditionalOption.storyDelayMinutes, 30);
    assert.equal(view.isConditional, true);
    assert.match(view.forecastText, /If we keep dinner simple and walk 45 minutes/);
    assert.match(view.forecastText, /disclosed 30-minute dinner delay/);
    assert.match(view.consequence, /outward.*arrive.*return.*conditional home.*Whole outing/);
    assert.equal(view.outward.status, 'projected');
    assert.equal(view.inward.status, 'projected');
    assert.deepEqual(state, before);
  }
  const state = preview();
  assert.equal(formatClock(selectStoryOption(state)!.returnMinutes), '21:45');
  assert.equal(formatClock(viewOf(state).conditionalOption.returnMinutes), '22:15');
});

test('calm forecast adds no delay and the existing base forecast is not mutated', () => {
  const state = preview('sz', createStoryState('wander', { delayScenario: 'none' }));
  const view = viewOf(state);
  assert.equal(formatClock(view.conditionalOption.returnMinutes), '21:45');
  assert.equal(view.conditionalOption.storyDelayMinutes, 0);
  assert.match(view.forecastText, /Calm version: no fictional dinner delay/);
  assert.equal(view.actualProgress.clockMinutes, 990);
});

test('both rail and road journeys include every leg and their own clearance allowance', () => {
  for (const [route, outward, inward] of [
    ['rail', [50, 30, 25], [25, 30, 50]],
    ['bus', [65, 35, 35], [35, 35, 65]],
  ] as const) {
    const view = viewOf(dispatch(preview(), { type: 'SET_ROUTE', route }));
    assertFullJourney(view.outward);
    assertFullJourney(view.inward);
    assert.deepEqual(view.outward.legs.map(leg => leg.durationMinutes), outward);
    assert.deepEqual(view.inward.legs.map(leg => leg.durationMinutes), inward);
    assert.equal(view.outward.to, view.destinationLabel);
    assert.equal(view.inward.from, view.destinationLabel);
    assert.equal(view.inward.to, view.originLabel);
    assert.match(view.outward.legs[1].label, /outward clearance allowance/);
    assert.match(view.inward.legs[1].label, /return clearance allowance/);
    assert.match(view.outward.legs[1].detail, /not a current queue/);
  }
  const rail = viewOf(preview());
  assert.equal(rail.outward.legs[1].startMinutes, 1040);
  assert.equal(rail.outward.legs[1].endMinutes, 1070);
  assert.equal(rail.inward.startMinutes, 1230);
  assert.equal(rail.inward.legs[1].startMinutes, 1255);
  assert.equal(rail.inward.legs[1].endMinutes, 1285);
  assert.match(rail.tradeoff!, /1h less round-trip travel; HK\$66.36 less per person/);
  const road = viewOf(dispatch(preview(), { type: 'SET_ROUTE', route: 'bus' }));
  assert.match(road.tradeoff!, /1h more round-trip travel; HK\$66.36 more per person/);
});

test('local route has one complete journey in each direction and no invented crossing', () => {
  const view = viewOf(preview('hk'));
  assertFullJourney(view.outward);
  assertFullJourney(view.inward);
  assert.equal(view.outward.legs.length, 1);
  assert.equal(view.inward.legs.length, 1);
  assert.equal(view.outward.durationMinutes, 15);
  assert.equal(view.inward.durationMinutes, 15);
  assert.equal(view.crossingHours, null);
  assert.equal(view.crossingFitText, null);
  assert.equal(view.entryText, null);
  assert.equal(view.canSelectRoute, false);
  assert.equal(view.tradeoff, null);
});

test('leg boundaries follow explicit transfer and clearance overrides through route changes', () => {
  const initial = preview('sz', createStoryState('wander', { baseInputs: { szLocalMinutes: 40, borderBufferMinutes: 50 } }));
  for (const [route, duration, home, legs] of [
    ['rail', 140, '23:25', [50, 50, 40]],
    ['bus', 155, '23:55', [65, 50, 40]],
  ] as const) {
    const state = dispatch(initial, { type: 'SET_ROUTE', route });
    const view = viewOf(state);
    assert.equal(view.outward.durationMinutes, duration);
    assert.equal(view.inward.durationMinutes, duration);
    assert.equal(formatClock(view.conditionalOption.returnMinutes), home);
    assert.deepEqual(view.outward.legs.map(leg => leg.durationMinutes), legs);
    assert.deepEqual(view.inward.legs.map(leg => leg.durationMinutes), [...legs].reverse());
    assertFullJourney(view.outward);
    assertFullJourney(view.inward);
  }
});

test('origin and asymmetric fixture times determine both endpoint labels and full leg boundaries', () => {
  const fixture = structuredClone(illustrativeData);
  fixture.shenzhen.routes.rail.origins.island.fromCrossingMinutes = 72;
  fixture.shenzhen.routes.rail.origins.island.toCrossingMinutes = 63;
  const state = preview('sz', createStoryState('wander', { baseInputs: { origin: 'island' } }));
  const view = viewOf(state, fixture);
  assert.match(view.originLabel, /Hong Kong Island \/ Central \(scenario\)/);
  assert.doesNotMatch(view.originLabel, /Kowloon/);
  assert.deepEqual(view.outward.legs.map(leg => leg.durationMinutes), [63, 30, 25]);
  assert.deepEqual(view.inward.legs.map(leg => leg.durationMinutes), [25, 30, 72]);
  assert.equal(view.outward.durationMinutes, 118);
  assert.equal(view.inward.durationMinutes, 127);
  assertFullJourney(view.outward);
  assertFullJourney(view.inward);
  const local = viewOf(preview('hk', createStoryState('wander', { baseInputs: { origin: 'island', hkLocalMinutes: 33 } })));
  assert.equal(local.outward.durationMinutes, 33);
  assert.equal(local.inward.durationMinutes, 33);
});

test('arrival previews only dinner; after dinner preserves the committed meal and explicitly assumes a walk', () => {
  const arrival = dispatch(preview(), { type: 'COMMIT_DEPARTURE', city: 'sz' });
  const arrivalView = viewOf(arrival);
  assert.equal(formatClock(arrivalView.actualProgress.clockMinutes), '18:15');
  assert.equal(formatClock(arrivalView.conditionalOption.returnMinutes), '22:15');
  assert.equal(arrivalView.outward.status, 'completed');
  assert.equal(arrivalView.canSelectRoute, false);
  assert.equal(arrivalView.tradeoff, null);
  const afterDinner = dispatch(arrival, { type: 'COMMIT_DINNER', choice: 'linger' });
  const afterView = viewOf(afterDinner);
  assert.equal(formatClock(afterView.actualProgress.clockMinutes), '20:15');
  assert.equal(afterView.conditionalOption.mealMinutes, 90);
  assert.equal(afterView.conditionalOption.includeSharedOrder, true);
  assert.equal(formatClock(afterView.conditionalOption.returnMinutes), '22:45');
  assert.match(afterView.forecastText, /Dinner is committed. If we walk 45 minutes/);
  assert.match(afterView.forecastText, /applied 30-minute dinner delay/);
  assert.match(afterView.middle.mealText, /90-minute dinner with a shared order · completed/);
  assert.match(afterView.middle.walkText, /45-minute walk · assumed, still to choose/);
  assert.equal(afterView.middle.dinnerEndMinutes, afterView.actualProgress.clockMinutes);
});

test('short walk and zero-walk direct return honor the chosen engine outcomes', () => {
  const dinner = dispatch(preview(), { type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'COMMIT_DINNER', choice: 'simple' });
  const before = structuredClone(dinner);
  const directPreview = viewOf(dinner, undefined, 'direct');
  assert.equal(formatClock(directPreview.actualProgress.clockMinutes), '19:45');
  assert.equal(directPreview.actualProgress.phase, 'afterDinner');
  assert.equal(directPreview.actualProgress.homeComplete, false);
  assert.equal(directPreview.inward.status, 'projected');
  assert.equal(directPreview.conditionalOption.walkMinutes, 0);
  assert.equal(formatClock(directPreview.conditionalOption.returnMinutes), '21:30');
  assert.equal(directPreview.inward.startMinutes, directPreview.actualProgress.clockMinutes);
  assert.match(directPreview.forecastText, /If we head home now with no walk/);
  assert.deepEqual(dinner, before);
  const short = dispatch(dinner, { type: 'COMMIT_WALK', choice: 'short' });
  const shortView = viewOf(short);
  assert.equal(formatClock(shortView.actualProgress.clockMinutes), '20:00');
  assert.equal(formatClock(shortView.conditionalOption.returnMinutes), '21:45');
  assert.equal(shortView.conditionalOption.walkMinutes, 15);
  assert.equal(shortView.isConditional, false);
  assert.match(shortView.middle.walkText, /15-minute walk · completed/);
  const direct = dispatch(dinner, { type: 'RETURN_AFTER_DINNER' });
  const directView = viewOf(direct);
  assert.equal(directView.actualProgress.clockMinutes, 1290);
  assert.equal(directView.conditionalOption.walkMinutes, 0);
  assert.equal(directView.isConditional, false);
  assert.equal(directView.inward.status, 'completed');
  assert.match(directView.middle.walkText, /No walk · chosen direct return/);
  assert.match(directView.forecastText, /Completed in this model: home 21:30/);
  for (const view of [directPreview, shortView, directView]) assert.equal(view.conditionalOption.perPersonHKD, 260.22);
  assertFullJourney(directView.inward);
  // Direct intent cannot invent a skipped walk at another phase.
  assert.equal(viewOf(short, undefined, 'direct').conditionalOption.walkMinutes, 15);
  assert.equal(viewOf(preview(), undefined, 'direct').conditionalOption.walkMinutes, 45);
});

test('committed round trip clock advances only through the reducer and never from reading the note', () => {
  let state = preview();
  for (const [action, clock] of [
    [{ type: 'COMMIT_DEPARTURE', city: 'sz' }, '18:15'],
    [{ type: 'COMMIT_DINNER', choice: 'simple' }, '19:45'],
    [{ type: 'COMMIT_WALK', choice: 'long' }, '20:30'],
    [{ type: 'RETURN_HOME' }, '22:15'],
  ] as const) {
    state = storyReducer(state, action);
    const before = structuredClone(state);
    for (let read = 0; read < 3; read++) {
      const view = viewOf(state);
      assert.equal(formatClock(view.actualProgress.clockMinutes), clock);
      assert.equal(view.conditionalOption.storyDelayMinutes, 30);
      assert.equal(view.conditionalOption.perPersonHKD, 260.22);
    }
    assert.deepEqual(state, before);
  }
  const home = viewOf(state);
  assert.equal(home.outward.status, 'completed');
  assert.equal(home.inward.status, 'completed');
  assert.equal(home.actualProgress.elapsedMinutes, home.conditionalOption.totalMinutes);
});

test('a missing fare remains unknown and cannot become a partial total or a cost saving', () => {
  const fixture = structuredClone(illustrativeData);
  fixture.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = null;
  const state = freeze(preview());
  const before = structuredClone(fixture);
  const view = viewOf(state, freeze(fixture));
  assert.equal(view.conditionalOption.perPersonHKD, null);
  assert.equal(view.conditionalOption.groupHKD, null);
  assert.ok(view.conditionalOption.knownGroupSubtotalHKD > 0);
  assert.match(view.costText, /Whole-outing total unknown. Missing: Rail · round trip/);
  assert.doesNotMatch(view.costText, /HK\$0|172\.22|344\.44/);
  assert.match(view.tradeoff!, /cost difference unknown/);
  assert.doesNotMatch(view.tradeoff!, /less per person|more per person/);
  assert.equal(view.costLines.find(line => line.id === 'sz-cross-border')!.nativeGroupAmount, null);
  assert.equal(view.conditionalOption.crossingFeasible, true);
  assert.equal(view.conditionalOption.entryFeasible, null);
  assert.equal(view.conditionalOption.feasible, null);
  assert.match(view.entryText!, /eligibility.*unverified/);
  assert.deepEqual(fixture, before);
});

test('published road hours, rail cutoff and practical eligibility stay separate', () => {
  for (const route of ['rail', 'bus'] as ShenzhenRoute[]) {
    const state = dispatch(preview('sz', createStoryState('wander', { baseInputs: { departureMinutes: 1200, homeByMinutes: 120 } })),
      { type: 'SET_ROUTE', route }, { type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'COMMIT_DINNER', choice: 'linger' });
    const view = viewOf(state);
    assert.equal(view.conditionalOption.entryFeasible, null);
    assert.equal(view.conditionalOption.homeFeasible, false);
    assert.equal(view.conditionalOption.crossingFeasible, route === 'bus');
    assert.equal(formatClock(view.conditionalOption.returnMinutes), route === 'rail' ? '02:15 (+1d)' : '03:15 (+1d)');
    assert.equal(view.conditionalOption.spareMinutes, route === 'rail' ? -15 : -75);
    assert.match(view.deadlineText, /after the chosen 02:00 \(\+1d\) home deadline/);
    assert.match(view.crossingHours!.source.note, /separate Lok Ma Chau Spur Line is 06:30–22:30/);
    assert.equal(view.crossingHours!.source.url, illustrativeData.crossingHoursSource.url);
    assert.match(view.entryText!, /transport services, seats and queues remain unverified/);
    if (route === 'rail') {
      assert.match(view.crossingHours!.label, /^Lo Wu rail crossing: 06:30–00:00$/);
      assert.match(view.crossingHours!.marginText, /15-minute closing margin/);
      assert.match(view.crossingFitText!, /outside/);
      assert.doesNotMatch(view.crossingHours!.label, /24 hours/);
    } else {
      assert.match(view.crossingHours!.label, /^Lok Ma Chau road crossing: 24 hours$/);
      assert.match(view.crossingHours!.marginText, /does not guarantee a bus/);
      assert.match(view.crossingFitText!, /fit the modeled crossing window/);
    }
  }
});

test('inspection, preview and route-note reads preserve choices, source state and previous attempt', () => {
  const first = dispatch(createStoryState(), { type: 'COMMIT_DEPARTURE', city: 'hk' },
    { type: 'COMMIT_DINNER', choice: 'simple' }, { type: 'RETURN_AFTER_DINNER' }, { type: 'TRY_OTHER_CITY' });
  const state = freeze(dispatch(first, { type: 'SET_ROUTE', route: 'bus' }, { type: 'INSPECT', hotspot: 'home' }));
  const before = structuredClone(state);
  const fixture = freeze(structuredClone(illustrativeData));
  const fixtureBefore = structuredClone(fixture);
  viewOf(state, fixture);
  viewOf(state, fixture, 'direct');
  assert.equal(state.currentAttempt.phase, 'fork');
  assert.equal(selectStoryProgress(state).clockMinutes, 990);
  assert.equal(state.currentAttempt.route, 'bus');
  assert.deepEqual(state, before);
  assert.deepEqual(fixture, fixtureBefore);
});
