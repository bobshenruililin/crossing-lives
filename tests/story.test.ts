import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeData } from '../src/domain/data';
import { compareOutings } from '../src/domain/engine';
import {
  createStoryState, decodeStoryState, previewStoryAction, selectStoryComparison, selectStoryInputs,
  selectStoryJournal, selectStoryOption, selectStoryPreviousOption, selectStoryProgress, STORY_PRESETS,
  storyReducer, validateStoryState,
} from '../src/story/engine';
import type { StoryAction, StoryState } from '../src/story/model';

const dispatch = (state: StoryState, ...actions: StoryAction[]) => actions.reduce(storyReducer, state);
const arrive = (city: 'hk' | 'sz' = 'hk', state = createStoryState()) => storyReducer(state, { type: 'COMMIT_DEPARTURE', city });
const finish = (city: 'hk' | 'sz' = 'hk', state = createStoryState(), dinner: 'simple' | 'linger' = 'linger', walk: 'short' | 'long' = 'long') => dispatch(arrive(city, state),
  { type: 'COMMIT_DINNER', choice: dinner }, { type: 'COMMIT_WALK', choice: walk },
  { type: 'KEEP_MEMENTO', memento: 'view' }, { type: 'RETURN_HOME' });
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('data-driven presets show constraints, two adults and one disclosed delay enabled by default', () => {
  assert.deepEqual(STORY_PRESETS.map(({ id, departureMinutes, homeByMinutes, budgetPerPersonHKD, partySize }) => [id, departureMinutes, homeByMinutes, budgetPerPersonHKD, partySize]), [
    ['short', 1020, 1200, 400, 2], ['wander', 990, 1410, 400, 2], ['budget', 990, 1410, 320, 2],
  ]);
  for (const preset of STORY_PRESETS) {
    const state = createStoryState(preset.id);
    assert.equal(state.delayScenario, 'dinner30');
    assert.equal(state.baseInputs.partySize, 2);
    assert.equal(state.baseInputs.entryEligibility, 'unsure');
    assert.equal(state.currentAttempt.phase, 'fork');
    assert.equal(selectStoryProgress(state).elapsedMinutes, 0);
    assert.deepEqual(validateStoryState(state), []);
  }
});

test('repeated commits are strict no-ops and scene inspection is cost- and time-free', () => {
  let state = createStoryState();
  assert.equal(storyReducer(state, { type: 'INSPECT', hotspot: 'table' }), state);
  state = storyReducer(state, { type: 'PREVIEW_CITY', city: 'sz' });
  const cost = selectStoryOption(state)!.groupHKD;
  state = dispatch(state, { type: 'INSPECT', hotspot: 'table' }, { type: 'INSPECT', hotspot: 'home' }, { type: 'CLOSE_INSPECTION' });
  assert.equal(selectStoryProgress(state).elapsedMinutes, 0);
  assert.equal(selectStoryOption(state)!.groupHKD, cost);
  assert.deepEqual(state.currentAttempt.inspectedHotspots, ['sz:table', 'sz:home']);
  for (const action of [
    { type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'COMMIT_DINNER', choice: 'linger' },
    { type: 'COMMIT_WALK', choice: 'long' }, { type: 'RETURN_HOME' },
  ] as StoryAction[]) {
    state = storyReducer(state, action);
    const before = selectStoryOption(state);
    assert.equal(storyReducer(state, action), state);
    state = dispatch(state, { type: 'INSPECT', hotspot: 'table' }, { type: 'CLOSE_INSPECTION' });
    assert.deepEqual(selectStoryOption(state), before);
  }
  assert.equal(selectStoryOption(state)!.groupHKD, 583.66);
  assert.equal(selectStoryOption(state)!.storyDelayMinutes, 30);
  assert.equal(selectStoryProgress(state).clockMinutes, selectStoryOption(state)!.returnMinutes);
});

test('rewind after dinner keeps meal and one delay, while arrival clears all downstream commitments', () => {
  const home = finish();
  const dinner = storyReducer(home, { type: 'REWIND', checkpoint: 'afterDinner' });
  assert.equal(dinner.currentAttempt.dinnerChoice, 'linger');
  assert.equal(dinner.currentAttempt.walkChoice, null);
  assert.equal(dinner.currentAttempt.memento, null);
  assert.equal(selectStoryProgress(dinner).elapsedMinutes, 15 + 90 + 30);
  assert.equal(selectStoryOption(dinner)!.groupHKD, 672);
  assert.equal(selectStoryJournal(dinner).some(line => line.includes('wander')), false);
  const arrival = storyReducer(home, { type: 'REWIND', checkpoint: 'arrival' });
  assert.equal(arrival.currentAttempt.dinnerChoice, null);
  assert.equal(arrival.currentAttempt.walkChoice, null);
  assert.equal(selectStoryProgress(arrival).elapsedMinutes, 15);
  assert.equal(selectStoryOption(arrival)!.storyDelayMinutes, 0);
  assert.equal(selectStoryOption(arrival)!.groupHKD, 608);
  assert.equal(selectStoryJournal(arrival).length, 1);
  const again = storyReducer(arrival, { type: 'COMMIT_DINNER', choice: 'linger' });
  assert.equal(selectStoryProgress(again).elapsedMinutes, selectStoryProgress(dinner).elapsedMinutes);
  assert.equal(selectStoryOption(again)!.groupHKD, selectStoryOption(dinner)!.groupHKD);
  const fork = storyReducer(home, { type: 'REWIND', checkpoint: 'fork' });
  assert.equal(fork.currentAttempt.city, null);
  assert.equal(fork.previewCity, 'hk');
  assert.equal(selectStoryProgress(fork).elapsedMinutes, 0);
  assert.deepEqual(selectStoryJournal(fork), []);
});

test('a delayed short loop matches a calm long wander for either city without changing its bill', () => {
  for (const city of ['hk', 'sz'] as const) {
    const calm = finish(city, createStoryState('wander', { delayScenario: 'none' }), 'simple', 'long');
    const delayed = finish(city, createStoryState('wander'), 'simple', 'short');
    assert.equal(selectStoryOption(delayed)!.returnMinutes, selectStoryOption(calm)!.returnMinutes);
    assert.equal(selectStoryOption(delayed)!.groupHKD, selectStoryOption(calm)!.groupHKD);
    assert.equal(selectStoryProgress(delayed).delayApplied, true);
    assert.equal(selectStoryProgress(calm).delayApplied, false);
  }
});

test('direct return in either city matches the zero-walk domain model with the same two-adult bill', () => {
  for (const city of ['hk', 'sz'] as const) for (const route of ['rail', 'bus'] as const) {
    for (const dinnerChoice of ['simple', 'linger'] as const) for (const delayScenario of ['none', 'dinner30'] as const) {
      const dinner = freeze(storyReducer(arrive(city, createStoryState('wander', {
        delayScenario, baseInputs: { szRoute: route },
      })), { type: 'COMMIT_DINNER', choice: dinnerChoice }));
      const dinnerBytes = JSON.stringify(dinner);
      const before = selectStoryOption(dinner)!;
      const preview = previewStoryAction(dinner, { type: 'RETURN_AFTER_DINNER' });
      const home = storyReducer(dinner, { type: 'RETURN_AFTER_DINNER' });
      const option = selectStoryOption(home)!;
      const expected = compareOutings({ ...dinner.baseInputs, szRoute: route,
        familiarity: dinner.currentAttempt.familiarity,
        itineraryOverrides: { [city]: { mealMinutes: dinnerChoice === 'linger' ? 90 : 60,
          includeSharedOrder: dinnerChoice === 'linger', walkMinutes: 0,
          storyDelayMinutes: delayScenario === 'dinner30' ? 30 : 0 } },
      }).options.find(item => item.id === city)!;

      assert.deepEqual(option, expected);
      assert.equal(home.currentAttempt.phase, 'home');
      assert.equal(home.currentAttempt.walkChoice, 'none');
      assert.equal(home.currentAttempt.dinnerChoice, dinnerChoice);
      assert.equal(home.baseInputs.partySize, 2);
      assert.equal(selectStoryInputs(home).entryEligibility, 'unsure');
      if (city === 'sz') assert.equal(option.entryFeasible, null);
      assert.equal(option.groupHKD, before.groupHKD);
      assert.equal(option.perPersonHKD, before.perPersonHKD);
      assert.deepEqual(option.lineItems, before.lineItems);
      assert.equal(preview.allowed, true);
      assert.deepEqual(preview.state, home);
      assert.equal(preview.billDeltaHKD, 0);
      assert.equal(preview.perPersonDeltaHKD, 0);
      assert.equal(preview.returnDeltaMinutes, -45);
      assert.equal(preview.progress.elapsedMinutes, option.totalMinutes);
      assert.equal(preview.progress.clockMinutes, option.returnMinutes);
      assert.equal(preview.progress.walkComplete, false);
      assert.equal(preview.progress.dinnerComplete, true);
      assert.equal(preview.progress.homeComplete, true);
      assert.equal(preview.progress.delayMinutes, delayScenario === 'dinner30' ? 30 : 0);
      assert.equal(JSON.stringify(dinner), dinnerBytes);
      assert.deepEqual(validateStoryState(home), []);
      assert.ok(selectStoryJournal(home).some(line => line.includes('straight home after dinner, without a walk')));
      assert.equal(selectStoryJournal(home).some(line => /15-minute loop|45-minute wander/.test(line)), false);
    }
  }
});

test('direct return is an explicit after-dinner-only action and eager or repeated returns are strict no-ops', () => {
  const fork = createStoryState();
  const arrival = arrive();
  const dinner = storyReducer(arrival, { type: 'COMMIT_DINNER', choice: 'simple' });
  const walk = storyReducer(dinner, { type: 'COMMIT_WALK', choice: 'short' });
  const walkedHome = storyReducer(walk, { type: 'RETURN_HOME' });
  const directHome = storyReducer(dinner, { type: 'RETURN_AFTER_DINNER' });
  const action: StoryAction = { type: 'RETURN_AFTER_DINNER' };
  for (const state of [fork, arrival, walk, walkedHome, directHome]) {
    assert.equal(storyReducer(state, action), state);
    assert.equal(previewStoryAction(state, action).allowed, false);
  }
  assert.equal(storyReducer(directHome, { type: 'RETURN_HOME' }), directHome);
  assert.equal(storyReducer(dinner, { type: 'RETURN_HOME' }), dinner);
  assert.equal(storyReducer(dinner, { type: 'COMMIT_WALK', choice: 'none' } as unknown as StoryAction), dinner);
  assert.equal(dispatch(dinner, action, action, action).currentAttempt.walkChoice, 'none');
  assert.deepEqual(dispatch(dinner, action, action, action), directHome);
});

test('direct-return rewind and replay preserve dinner and apply the disclosed delay exactly once', () => {
  for (const city of ['hk', 'sz'] as const) {
    const dinner = storyReducer(arrive(city), { type: 'COMMIT_DINNER', choice: 'linger' });
    const home = freeze(storyReducer(dinner, { type: 'RETURN_AFTER_DINNER' }));
    const homeBytes = JSON.stringify(home);
    const rewound = storyReducer(home, { type: 'REWIND', checkpoint: 'afterDinner' });
    assert.deepEqual(rewound, dinner);
    const replay = storyReducer(rewound, { type: 'RETURN_AFTER_DINNER' });
    assert.deepEqual(replay, home);
    assert.deepEqual(selectStoryProgress(replay), selectStoryProgress(home));
    assert.equal(selectStoryOption(replay)!.storyDelayMinutes, 30);
    assert.equal(selectStoryJournal(replay).filter(line => line.includes('30 minutes longer')).length, 1);
    const shortHome = dispatch(rewound, { type: 'COMMIT_WALK', choice: 'short' }, { type: 'RETURN_HOME' });
    assert.equal(selectStoryOption(shortHome)!.returnMinutes - selectStoryOption(home)!.returnMinutes, 15);
    assert.equal(selectStoryOption(shortHome)!.groupHKD, selectStoryOption(home)!.groupHKD);
    const arrival = storyReducer(home, { type: 'REWIND', checkpoint: 'arrival' });
    assert.equal(arrival.currentAttempt.walkChoice, null);
    assert.equal(selectStoryOption(arrival)!.storyDelayMinutes, 0);
    assert.deepEqual(dispatch(arrival, { type: 'COMMIT_DINNER', choice: 'linger' }, { type: 'RETURN_AFTER_DINNER' }), home);
    assert.equal(JSON.stringify(home), homeBytes);
  }
});

test('heading straight home still reports a missed deadline and unresolved real entry eligibility', () => {
  for (const city of ['hk', 'sz'] as const) {
    const dinner = storyReducer(arrive(city, createStoryState('short', {
      baseInputs: { homeByMinutes: 1080 },
    })), { type: 'COMMIT_DINNER', choice: 'linger' });
    const preview = previewStoryAction(dinner, { type: 'RETURN_AFTER_DINNER' });
    assert.equal(preview.allowed, true);
    assert.equal(preview.state.currentAttempt.phase, 'home');
    assert.equal(preview.option!.walkMinutes, 0);
    assert.equal(preview.option!.homeFeasible, false);
    assert.equal(preview.state.baseInputs.homeByMinutes, 1080);
    assert.ok(preview.warnings.some(line => line.includes('after the deadline')));
    assert.ok(selectStoryJournal(preview.state).some(line => line.includes('after the chosen home deadline')));
    assert.equal(selectStoryInputs(preview.state).entryEligibility, 'unsure');
    if (city === 'sz') assert.equal(preview.option!.entryFeasible, null);
  }
});

test('direct-return snapshots and same-version saves survive alternate play and changed assumptions', () => {
  for (const city of ['hk', 'sz'] as const) {
    const dinner = storyReducer(arrive(city), { type: 'COMMIT_DINNER', choice: 'linger' });
    const home = storyReducer(dinner, { type: 'RETURN_AFTER_DINNER' });
    const restoredHome = decodeStoryState(JSON.stringify(home))!;
    assert.equal(restoredHome.version, 2);
    assert.deepEqual(restoredHome, home);
    assert.notEqual(restoredHome.currentAttempt, home.currentAttempt);
    assert.deepEqual(selectStoryOption(restoredHome), selectStoryOption(home));
    assert.deepEqual(selectStoryProgress(restoredHome), selectStoryProgress(home));

    let alternate = storyReducer(home, { type: 'TRY_OTHER_CITY' });
    const previousBytes = JSON.stringify(alternate.previousAttempt);
    const previousOption = selectStoryPreviousOption(alternate);
    freeze(alternate.previousAttempt);
    alternate = dispatch(alternate,
      { type: 'RECONFIGURE', inputs: { departureMinutes: 900 }, delayScenario: 'none' },
      { type: 'SET_FAMILIARITY', city, activity: 'dinner', value: 'new' },
      { type: 'COMMIT_DEPARTURE', city: city === 'hk' ? 'sz' : 'hk' },
      { type: 'COMMIT_DINNER', choice: 'simple' }, { type: 'RETURN_AFTER_DINNER' });
    assert.equal(JSON.stringify(alternate.previousAttempt), previousBytes);
    assert.deepEqual(selectStoryPreviousOption(alternate), previousOption);
    const restoredAlternate = decodeStoryState(JSON.stringify(alternate))!;
    assert.deepEqual(restoredAlternate, alternate);
    assert.equal(restoredAlternate.previousAttempt!.walkChoice, 'none');
    assert.deepEqual(selectStoryPreviousOption(restoredAlternate), selectStoryOption(home));
    assert.deepEqual(selectStoryProgress(restoredAlternate), selectStoryProgress(alternate));
  }
});

test('same-version decoding accepts old walks but rejects zero-walk commitments outside a completed return', () => {
  for (const city of ['hk', 'sz'] as const) for (const walk of ['short', 'long'] as const) {
    const legacyHome = finish(city, createStoryState(), 'linger', walk);
    assert.deepEqual(decodeStoryState(JSON.stringify(legacyHome)), legacyHome);
    const legacyPrior = storyReducer(legacyHome, { type: 'TRY_OTHER_CITY' });
    assert.deepEqual(decodeStoryState(JSON.stringify(legacyPrior)), legacyPrior);
  }
  const dinner = storyReducer(arrive(), { type: 'COMMIT_DINNER', choice: 'simple' });
  const home = storyReducer(dinner, { type: 'RETURN_AFTER_DINNER' });
  for (const phase of ['fork', 'arrival', 'afterDinner', 'walk'] as const) {
    assert.equal(decodeStoryState({ ...home, currentAttempt: { ...home.currentAttempt, phase } }), null);
  }
  assert.equal(decodeStoryState({ ...home, currentAttempt: { ...home.currentAttempt, dinnerChoice: null } }), null);
  assert.equal(decodeStoryState({ ...home, currentAttempt: { ...home.currentAttempt, walkChoice: null } }), null);
  const prior = storyReducer(home, { type: 'TRY_OTHER_CITY' });
  assert.equal(decodeStoryState({ ...prior, previousAttempt: { ...prior.previousAttempt, phase: 'walk' } }), null);
  const injected = { ...home, totalCost: 0,
    currentAttempt: { ...home.currentAttempt, elapsedMinutes: 0, delayApplied: 20, toJSON: () => ({}) } };
  assert.deepEqual(decodeStoryState(injected), home);
});

test('direct return keeps an unknown whole-outing bill unknown rather than treating no walk as a saving', () => {
  const fixture = structuredClone(illustrativeData);
  fixture.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = null;
  const dinner = storyReducer(arrive('sz'), { type: 'COMMIT_DINNER', choice: 'linger' });
  const preview = previewStoryAction(dinner, { type: 'RETURN_AFTER_DINNER' }, fixture);
  assert.equal(preview.allowed, true);
  assert.equal(preview.option!.walkMinutes, 0);
  assert.equal(preview.option!.groupHKD, null);
  assert.equal(preview.option!.perPersonHKD, null);
  assert.equal(preview.billDeltaHKD, null);
  assert.equal(preview.perPersonDeltaHKD, null);
  assert.equal(preview.option!.knownGroupSubtotalHKD, selectStoryOption(dinner, 'sz', fixture)!.knownGroupSubtotalHKD);
  assert.ok(selectStoryJournal(preview.state, fixture).some(line => line.includes('bill unknown')));
});

test('preview reports concrete deltas without changing the current choices, journal, clock or bill', () => {
  const state = freeze(arrive('hk'));
  const snapshot = JSON.stringify(state);
  const simple = previewStoryAction(state, { type: 'COMMIT_DINNER', choice: 'simple' });
  const linger = previewStoryAction(state, { type: 'COMMIT_DINNER', choice: 'linger' });
  assert.equal(simple.allowed, true);
  assert.equal(simple.billDeltaHKD, 0);
  assert.equal(linger.billDeltaHKD, 64);
  assert.equal(linger.perPersonDeltaHKD, 32);
  assert.equal(linger.returnDeltaMinutes, 60);
  assert.equal(linger.progress.dinnerEndMinutes, 990 + 15 + 90 + 30);
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(selectStoryProgress(state).elapsedMinutes, 15);
  const shorter = previewStoryAction(linger.state, { type: 'COMMIT_WALK', choice: 'short' });
  assert.equal(shorter.returnDeltaMinutes, -30);
  assert.equal(shorter.billDeltaHKD, 0);
  assert.equal(shorter.progress.clockMinutes, 990 + 15 + 90 + 30 + 15);
});

test('prior attempt is byte-for-byte unchanged by alternate choices, familiarity or scenario editing', () => {
  const first = freeze(finish('hk'));
  let alternate = storyReducer(first, { type: 'TRY_OTHER_CITY' });
  assert.equal(alternate.previewCity, 'sz');
  assert.equal(alternate.currentAttempt.phase, 'fork');
  assert.equal(alternate.currentAttempt.id, 2);
  const previousBytes = JSON.stringify(alternate.previousAttempt);
  const previousOption = selectStoryPreviousOption(alternate);
  freeze(alternate.previousAttempt);
  alternate = dispatch(alternate, { type: 'SET_ROUTE', route: 'bus' },
    { type: 'SET_FAMILIARITY', city: 'hk', activity: 'dinner', value: 'new' },
    { type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'COMMIT_DINNER', choice: 'simple' },
    { type: 'COMMIT_WALK', choice: 'short' }, { type: 'KEEP_MEMENTO', memento: 'conversation' },
    { type: 'SET_JOURNAL_NOTE', text: 'One chosen detail.' }, { type: 'RETURN_HOME' });
  assert.equal(JSON.stringify(alternate.previousAttempt), previousBytes);
  assert.deepEqual(selectStoryPreviousOption(alternate), previousOption);
  alternate = storyReducer(alternate, { type: 'RECONFIGURE', inputs: { departureMinutes: 900, budgetPerPersonHKD: 300 }, delayScenario: 'none' });
  assert.equal(alternate.currentAttempt.phase, 'fork');
  assert.equal(alternate.baseInputs.departureMinutes, 900);
  assert.equal(JSON.stringify(alternate.previousAttempt), previousBytes);
  assert.deepEqual(selectStoryPreviousOption(alternate), previousOption);
  assert.equal(first.currentAttempt.phase, 'home');
  assert.equal(first.previousAttempt, null);
});

test('only one previous snapshot is retained when trying another completed evening', () => {
  const first = finish('hk');
  const second = finish('sz', storyReducer(first, { type: 'TRY_OTHER_CITY' }), 'simple', 'short');
  const third = storyReducer(second, { type: 'TRY_OTHER_CITY' });
  assert.equal(third.previousAttempt!.city, 'sz');
  assert.equal(third.previousAttempt!.dinnerChoice, 'simple');
  assert.equal(third.previousAttempt!.walkChoice, 'short');
  assert.equal(third.currentAttempt.id, 3);
  assert.equal('previousAttempt' in third.previousAttempt!, false);
  assert.equal(second.previousAttempt!.city, 'hk');
});

test('every phase rejects out-of-order or repeated commitments and forward rewinds', () => {
  const fork = createStoryState();
  const arrival = arrive();
  const dinner = storyReducer(arrival, { type: 'COMMIT_DINNER', choice: 'simple' });
  const walk = storyReducer(dinner, { type: 'COMMIT_WALK', choice: 'short' });
  const home = storyReducer(walk, { type: 'RETURN_HOME' });
  const badByPhase: Array<[StoryState, StoryAction[]]> = [
    [fork, [{ type: 'COMMIT_DINNER', choice: 'simple' }, { type: 'COMMIT_WALK', choice: 'long' }, { type: 'RETURN_HOME' }, { type: 'REWIND', checkpoint: 'arrival' }, { type: 'TRY_OTHER_CITY' }]],
    [arrival, [{ type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'COMMIT_WALK', choice: 'short' }, { type: 'RETURN_HOME' }, { type: 'SET_ROUTE', route: 'bus' }, { type: 'KEEP_MEMENTO', memento: 'view' }]],
    [dinner, [{ type: 'COMMIT_DINNER', choice: 'linger' }, { type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'RETURN_HOME' }, { type: 'PREVIEW_CITY', city: 'sz' }]],
    [walk, [{ type: 'COMMIT_WALK', choice: 'long' }, { type: 'COMMIT_DINNER', choice: 'linger' }, { type: 'TRY_OTHER_CITY' }]],
    [home, [{ type: 'RETURN_HOME' }, { type: 'COMMIT_WALK', choice: 'long' }, { type: 'COMMIT_DINNER', choice: 'linger' }]],
  ];
  for (const [state, actions] of badByPhase) for (const action of actions) assert.equal(storyReducer(state, action), state, `${state.currentAttempt.phase}: ${action.type}`);
  for (const action of [{ type: 'COMMIT_DEPARTURE', city: 'other' }, { type: 'SET_ROUTE', route: 'taxi' }, { type: 'REWIND', checkpoint: 'home' }, { type: 'UNKNOWN' }, null]) {
    assert.equal(storyReducer(fork, action as unknown as StoryAction), fork);
  }
});

test('no story action creates a practical entry attestation, including configuration and reload', () => {
  let state = createStoryState('wander', { baseInputs: { entryEligibility: 'confirmed', partySize: 6 } });
  assert.equal(state.baseInputs.entryEligibility, 'unsure');
  assert.equal(state.baseInputs.partySize, 2);
  state = storyReducer(state, { type: 'RECONFIGURE', inputs: { entryEligibility: 'confirmed' } });
  state = finish('sz', state);
  assert.equal(state.baseInputs.entryEligibility, 'unsure');
  assert.equal(selectStoryInputs(state).entryEligibility, 'unsure');
  assert.equal(selectStoryOption(state)!.entryFeasible, null);
  assert.equal(state.currentAttempt.phase, 'home');
  assert.equal(decodeStoryState({ ...state, baseInputs: { ...state.baseInputs, entryEligibility: 'confirmed' } }), null);
  assert.ok(selectStoryJournal(state).some(line => line.includes('entry eligibility')));
});

test('the authored delay still triggers existing home and crossing-window warnings', () => {
  const setup = { baseInputs: { departureMinutes: 1110, homeByMinutes: 1470 } };
  const calm = finish('sz', createStoryState('wander', { ...setup, delayScenario: 'none' }));
  const delayed = finish('sz', createStoryState('wander', setup));
  const calmOption = selectStoryOption(calm)!;
  const lateOption = selectStoryOption(delayed)!;
  assert.equal(calmOption.homeFeasible, true);
  assert.equal(calmOption.crossingFeasible, true);
  assert.equal(lateOption.homeFeasible, false);
  assert.equal(lateOption.crossingFeasible, false);
  assert.equal(lateOption.returnMinutes - calmOption.returnMinutes, 30);
  assert.ok(lateOption.reasons.some(reason => reason.includes('after the deadline')));
  assert.ok(lateOption.reasons.some(reason => reason.includes('border crossing')));
  assert.equal(delayed.baseInputs.homeByMinutes, 1470);
  assert.ok(selectStoryJournal(delayed).some(line => line.includes('Rewind the departure')));
});

test('short preset exposes a late outcome without hiding or blocking the fictional branch', () => {
  const home = finish('sz', createStoryState('short'));
  assert.equal(home.currentAttempt.phase, 'home');
  assert.equal(selectStoryOption(home)!.homeFeasible, false);
  assert.equal(home.baseInputs.homeByMinutes, 1200);
  assert.equal(selectStoryOption(home)!.entryFeasible, null);
  assert.equal(storyReducer(home, { type: 'REWIND', checkpoint: 'fork' }).currentAttempt.phase, 'fork');
});

test('unknown costs remain unknown through story selectors and choice previews', () => {
  const fixture = structuredClone(illustrativeData);
  fixture.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = null;
  const state = arrive('sz');
  const preview = previewStoryAction(state, { type: 'COMMIT_DINNER', choice: 'linger' }, fixture);
  assert.equal(preview.allowed, true);
  assert.equal(preview.option!.groupHKD, null);
  assert.equal(preview.option!.perPersonHKD, null);
  assert.equal(preview.billDeltaHKD, null);
  assert.equal(preview.perPersonDeltaHKD, null);
  assert.ok(preview.option!.knownGroupSubtotalHKD > 0);
  assert.ok(selectStoryJournal(finish('sz'), fixture).some(line => line.includes('bill unknown')));
});

test('same-version save resumes every phase with exact scene, selections, costs and time', () => {
  let state = createStoryState();
  const actions: StoryAction[] = [
    { type: 'PREVIEW_CITY', city: 'sz' }, { type: 'INSPECT', hotspot: 'home' },
    { type: 'SET_ROUTE', route: 'bus' }, { type: 'SET_FAMILIARITY', city: 'sz', activity: 'dinner', value: 'new' },
    { type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'COMMIT_DINNER', choice: 'linger' },
    { type: 'COMMIT_WALK', choice: 'short' }, { type: 'KEEP_MEMENTO', memento: 'practical' },
    { type: 'SET_JOURNAL_NOTE', text: '  A street, 一张桌子. <plain text>  ' }, { type: 'RETURN_HOME' }, { type: 'TRY_OTHER_CITY' },
  ];
  for (const action of actions) {
    state = storyReducer(state, action);
    const restored = decodeStoryState(JSON.stringify(state));
    assert.deepEqual(restored, state);
    assert.notEqual(restored, state);
    assert.deepEqual(selectStoryComparison(restored!), selectStoryComparison(state));
    assert.deepEqual(selectStoryProgress(restored!), selectStoryProgress(state));
  }
});

test('corrupt saves and impossible phase/choice combinations are rejected conservatively', () => {
  const good = createStoryState();
  const corrupt: unknown[] = [null, [], {}, '', '{broken', { ...good, version: 1 }, { ...good, version: 3 }, { ...good, scenarioId: 'other' },
    { ...good, delayScenario: 'random' }, { ...good, presetId: 'night' }, { ...good, previousAttempt: {} },
    { ...good, currentAttempt: { ...good.currentAttempt, phase: 'home' } },
    { ...good, currentAttempt: { ...good.currentAttempt, phase: 'walk', city: 'sz', walkChoice: 'short' } },
    { ...good, currentAttempt: { ...good.currentAttempt, dinnerChoice: 'simple' } },
    { ...good, currentAttempt: { ...good.currentAttempt, city: 'sz' } },
    { ...good, currentAttempt: { ...good.currentAttempt, inspectedHotspots: ['hk:table', 'hk:table'] } },
    { ...good, currentAttempt: { ...good.currentAttempt, familiarity: { hk: { dinner: 'new' } } } },
    { ...good, baseInputs: { ...good.baseInputs, budgetPerPersonHKD: null } },
  ];
  for (const value of corrupt) assert.equal(decodeStoryState(value), null, JSON.stringify(value));
  const inconsistent = { ...good, currentAttempt: { ...good.currentAttempt, phase: 'afterDinner' } } as StoryState;
  assert.equal(storyReducer(inconsistent, { type: 'COMMIT_WALK', choice: 'long' }), inconsistent);
  const savedPrior = storyReducer(finish(), { type: 'TRY_OTHER_CITY' });
  assert.equal(decodeStoryState({ ...savedPrior, previousAttempt: { ...savedPrior.previousAttempt, phase: 'walk' } }), null);
});

test('mementos and player note change only the journal and explicit familiarity remains optional', () => {
  const state = finish('hk');
  const practical = dispatch(state, { type: 'KEEP_MEMENTO', memento: 'practical' }, { type: 'SET_JOURNAL_NOTE', text: 'I kept the amber window.' });
  assert.deepEqual(selectStoryOption(practical), selectStoryOption(state));
  assert.deepEqual(selectStoryProgress(practical), selectStoryProgress(state));
  assert.equal(selectStoryOption(practical)!.scoreBreakdown.discovery, null);
  assert.equal(selectStoryJournal(practical).at(-1), 'I kept the amber window.');
  assert.equal(storyReducer(practical, { type: 'SET_JOURNAL_NOTE', text: 'x'.repeat(1001) }), practical);
});

test('story decode strips derived counters and unknown hooks while preserving a clean independent snapshot', () => {
  const original = finish('hk');
  const candidate = { ...original, elapsedMinutes: 5000, totalCost: 0, toJSON: () => ({ bad: true }),
    currentAttempt: { ...original.currentAttempt, delayApplied: 999, emotionalScore: 100, toJSON: () => ({ bad: true }) },
    baseInputs: { ...original.baseInputs, extra: 'untrusted', weights: { ...original.baseInputs.weights, toJSON: () => ({}) } },
  };
  const decoded = decodeStoryState(candidate)!;
  assert.deepEqual(decoded, original);
  assert.notEqual(decoded.currentAttempt, original.currentAttempt);
  assert.notEqual(decoded.baseInputs, original.baseInputs);
  assert.equal(selectStoryProgress(decoded).elapsedMinutes, selectStoryOption(decoded)!.totalMinutes);
  assert.deepEqual(JSON.parse(JSON.stringify(decoded)), original);
  const hostile = { ...original, get presetId() { throw new Error('No access'); } };
  assert.equal(decodeStoryState(hostile), null);
  assert.ok(validateStoryState(hostile).length);
});

test('explicit reset clears both attempts, while choosing a preset reapplies its visible constraints', () => {
  let state = storyReducer(finish('hk'), { type: 'TRY_OTHER_CITY' });
  state = dispatch(state, { type: 'SET_FAMILIARITY', city: 'sz', activity: 'walk', value: 'new' },
    { type: 'RECONFIGURE', inputs: { departureMinutes: 900, budgetPerPersonHKD: 200, fxHKDPerCNY: 1.2 } });
  assert.equal(state.baseInputs.departureMinutes, 900);
  assert.equal(state.currentAttempt.familiarity.sz.walk, 'new');
  const preset = storyReducer(state, { type: 'RECONFIGURE', presetId: 'wander' });
  assert.equal(preset.baseInputs.departureMinutes, 990);
  assert.equal(preset.baseInputs.budgetPerPersonHKD, 400);
  assert.equal(preset.baseInputs.fxHKDPerCNY, 1.2);
  assert.deepEqual(preset.previousAttempt, state.previousAttempt);
  const fresh = storyReducer(preset, { type: 'RESET' });
  assert.deepEqual(fresh, createStoryState());
  assert.equal(fresh.previousAttempt, null);
  assert.equal(fresh.currentAttempt.id, 1);
  assert.equal(storyReducer(fresh, { type: 'RESET', presetId: 'short' }).presetId, 'short');
});
