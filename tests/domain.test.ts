import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeData, defaultInputs } from '../src/domain/data';
import { allocateSurplus, compareOutings, effectiveTravelAssumptions, formatClock, validateInputs } from '../src/domain/engine';
import type { OutingFixture, OutingInputs } from '../src/domain/model';

const confirmed = (patch: Partial<OutingInputs> = {}): OutingInputs => ({
  ...defaultInputs, weights: { ...defaultInputs.weights }, entryEligibility: 'confirmed', ...patch,
});
const freshFixture = (): OutingFixture => structuredClone(illustrativeData);
const option = (inputs: OutingInputs, id: 'hk' | 'sz', fixture = illustrativeData) => {
  const result = compareOutings(inputs, fixture);
  assert.equal(result.valid, true, result.errors.join(' '));
  return result.options.find(item => item.id === id)!;
};

test('baseline models two whole outings with complete costs and round trips', () => {
  const result = compareOutings(confirmed());
  assert.equal(result.valid, true);
  assert.equal(result.options.length, 2);
  const [hk, sz] = result.options;
  assert.equal(hk.perPersonHKD, 336);
  assert.equal(hk.groupHKD, 672);
  assert.equal(sz.perPersonHKD, 291.83);
  assert.equal(sz.groupHKD, 583.66);
  assert.equal(hk.outwardMinutes, 15);
  assert.equal(hk.inwardMinutes, 15);
  assert.equal(hk.experienceMinutes, 135);
  assert.equal(hk.totalMinutes, 165);
  assert.equal(sz.outwardMinutes, 105);
  assert.equal(sz.inwardMinutes, 105);
  assert.equal(sz.borderBufferMinutes, 60);
  assert.equal(sz.returnMinutes, 1365);
  assert.equal(hk.feasible, true);
  assert.equal(sz.feasible, true);
  assert.equal(result.recommendation.optionId, null);
  assert.match(result.recommendation.label, /still yours to judge/);
  for (const item of result.options) {
    assert.equal(item.dataStatus, 'illustrative');
    assert.equal(item.lineItems.reduce((sum, cost) => sum + Math.round(cost.hkdGroupAmount! * 100), 0), Math.round(item.groupHKD! * 100));
    assert.equal(item.departureMinutes + item.totalMinutes, item.returnMinutes);
  }
});

test('default entry uncertainty keeps Shenzhen conditional without hiding its calculations', () => {
  const sz = option(defaultInputs, 'sz');
  assert.equal(sz.entryFeasible, null);
  assert.equal(sz.feasible, null);
  assert.equal(sz.budgetFeasible, true);
  assert.equal(sz.homeFeasible, true);
  assert.equal(sz.crossingFeasible, true);
  assert.equal(sz.groupHKD, 583.66);
  assert.ok(sz.reasons.some(reason => reason.includes('Entry eligibility')));
});

test('shared costs are charged once, with both per-person and group money exposed', () => {
  const solo = option(confirmed({ partySize: 1 }), 'hk');
  const group = option(confirmed({ partySize: 6 }), 'hk');
  const soloDessert = solo.lineItems.find(item => item.id === 'hk-shared')!;
  const groupDessert = group.lineItems.find(item => item.id === 'hk-shared')!;
  assert.equal(soloDessert.nativeGroupAmount, 64);
  assert.equal(groupDessert.nativeGroupAmount, 64);
  assert.equal(groupDessert.hkdPerPersonAmount, 10.67);
  assert.equal(solo.groupHKD, 368);
  assert.equal(group.groupHKD, 1888);
  assert.equal(group.perPersonHKD, 314.67);
  assert.equal(group.lineItems.find(item => item.id === 'hk-dinner')!.nativeGroupAmount, 248 * 6);
});

test('FX changes convert CNY costs only, with visible native currencies', () => {
  const low = compareOutings(confirmed({ fxHKDPerCNY: 1 }));
  const high = compareOutings(confirmed({ fxHKDPerCNY: 1.2 }));
  assert.equal(low.options[0].groupHKD, high.options[0].groupHKD);
  assert.equal(low.options[1].perPersonHKD, 275);
  assert.equal(high.options[1].perPersonHKD, 312.4);
  const meal = high.options[1].lineItems.find(item => item.id === 'sz-dinner')!;
  assert.equal(meal.currency, 'CNY');
  assert.equal(meal.nativeUnitAmount, 128);
  assert.equal(meal.nativeGroupAmount, 256);
  assert.equal(meal.hkdGroupAmount, 307.2);
  assert.equal(low.options[1].lineItems.find(item => item.id === 'sz-cross-border')!.hkdGroupAmount,
    high.options[1].lineItems.find(item => item.id === 'sz-cross-border')!.hkdGroupAmount);
});

test('each value weight can change the ranking; Shenzhen is not intrinsically preferred', () => {
  assert.equal(compareOutings(confirmed({ weights: { price: 5, ease: 0, discovery: 0 } })).recommendation.optionId, 'sz');
  assert.equal(compareOutings(confirmed({ weights: { price: 0, ease: 5, discovery: 0 } })).recommendation.optionId, 'hk');
  assert.equal(compareOutings(confirmed({ weights: { price: 0, ease: 0, discovery: 5 } })).recommendation.optionId, null);
  assert.equal(compareOutings(confirmed({ weights: { price: 0, ease: 0, discovery: 5 }, familiarity: { hk: { dinner: 'familiar', walk: 'familiar' }, sz: { dinner: 'new', walk: 'new' } } })).recommendation.optionId, 'sz');
  const noWeights = compareOutings(confirmed({ weights: { price: 0, ease: 0, discovery: 0 } }));
  assert.equal(noWeights.recommendation.optionId, null);
  assert.equal(noWeights.options[0].score, null);
});

test('missing and invalid required prices produce unknown totals, not zero-filled totals', () => {
  for (const amount of [null, undefined, NaN, -1, Infinity]) {
    const fixture = freshFixture();
    fixture.shenzhen.costs[2].amount = amount as number | null;
    const sz = option(confirmed(), 'sz', fixture);
    assert.equal(sz.groupHKD, null);
    assert.equal(sz.perPersonHKD, null);
    assert.equal(sz.budgetFeasible, null);
    assert.equal(sz.feasible, null);
    assert.equal(sz.score, null);
    assert.deepEqual(sz.missingCostLabels, ['Shared dishes']);
    assert.ok(sz.knownGroupSubtotalHKD > 0);
    assert.equal(sz.lineItems[2].hkdGroupAmount, null);
  }
});

test('a missing transport fare also makes the whole outing total unknown', () => {
  const fixture = freshFixture();
  fixture.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = null;
  const sz = option(confirmed(), 'sz', fixture);
  assert.equal(sz.perPersonHKD, null);
  assert.ok(sz.missingCostLabels.includes('Rail · round trip'));
});

test('known subtotal can prove a budget failure even when the complete bill is unknown', () => {
  const fixture = freshFixture();
  fixture.shenzhen.costs[2].amount = null;
  const sz = option(confirmed({ budgetPerPersonHKD: 200 }), 'sz', fixture);
  assert.equal(sz.knownGroupSubtotalHKD, 520.44);
  assert.equal(sz.groupHKD, null);
  assert.equal(sz.perPersonHKD, null);
  assert.equal(sz.budgetFeasible, false);
  assert.equal(sz.feasible, false);
  assert.ok(sz.reasons.some(reason => reason.includes('Known costs alone exceed') && reason.includes('at least HK$120.44')));
  assert.ok(sz.reasons.some(reason => reason.includes('Total unknown')));
});

test('earlier home-by clock means next day and clock formatting labels rollover', () => {
  const inputs = confirmed({ departureMinutes: 23 * 60, homeByMinutes: 2 * 60 });
  const result = compareOutings(inputs);
  assert.equal(result.normalizedHomeByMinutes, 26 * 60);
  const hk = result.options[0];
  assert.equal(hk.returnMinutes, 1545);
  assert.equal(hk.homeFeasible, true);
  assert.equal(formatClock(hk.returnMinutes), '01:45 (+1d)');
  assert.equal(formatClock(1440), '00:00 (+1d)');
  assert.equal(formatClock(2880 + 5), '00:05 (+2d)');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(NaN), 'Unknown');
  assert.equal(formatClock(-1), 'Unknown');
});

test('home deadline and Lo Wu closing cutoff are independent constraints', () => {
  const late = option(confirmed({ departureMinutes: 20 * 60, homeByMinutes: 2 * 60 }), 'sz');
  assert.equal(late.homeFeasible, true);
  assert.equal(late.crossingFeasible, false);
  assert.equal(late.feasible, false);
  const tooShort = option(confirmed({ homeByMinutes: 19 * 60 }), 'sz');
  assert.equal(tooShort.homeFeasible, false);
  assert.equal(tooShort.crossingFeasible, true);
  const sameTime = compareOutings(confirmed({ homeByMinutes: defaultInputs.departureMinutes }));
  assert.ok(sameTime.options.every(item => item.homeFeasible === false));
});

test('crossing closing buffer is honored at the exact modeled boundary', () => {
  const safeMargin = option(confirmed({ departureMinutes: 18 * 60 + 50, homeByMinutes: 2 * 60 }), 'sz');
  const oneMinuteLater = option(confirmed({ departureMinutes: 18 * 60 + 51, homeByMinutes: 2 * 60 }), 'sz');
  assert.equal(safeMargin.crossingPlan!.inwardEndMinutes, 23 * 60 + 45);
  assert.equal(safeMargin.crossingFeasible, true);
  assert.equal(oneMinuteLater.crossingFeasible, false);
  assert.ok(safeMargin.warnings.some(warning => warning.includes('not a guaranteed last-safe departure')));
});

test('rail is closed before morning opening while road crossing is separately 24 hours', () => {
  const early = confirmed({ departureMinutes: 3 * 60, homeByMinutes: 12 * 60, budgetPerPersonHKD: 1000 });
  assert.equal(option(early, 'sz').crossingFeasible, false);
  const bus = option({ ...early, szRoute: 'bus' }, 'sz');
  assert.equal(bus.crossingFeasible, true);
  assert.equal(bus.crossingPlan!.twentyFourHours, true);
  assert.ok(bus.warnings.some(warning => warning.includes('does not confirm transport service')));
});

test('editable timing and meal assumptions affect their intended components', () => {
  const inputs = confirmed({ hkMealPerPersonHKD: 200, szMealPerPersonCNY: 100, hkLocalMinutes: 20, szLocalMinutes: 40, borderBufferMinutes: 50, mealMinutes: 120, walkMinutes: 60 });
  const [hk, sz] = compareOutings(inputs).options;
  assert.equal(hk.outwardMinutes, 20);
  assert.equal(hk.inwardMinutes, 20);
  assert.equal(hk.experienceMinutes, 180);
  assert.equal(hk.perPersonHKD, 288);
  assert.equal(sz.outwardMinutes, 140);
  assert.equal(sz.inwardMinutes, 140);
  assert.equal(sz.borderBufferMinutes, 100);
  assert.equal(sz.perPersonHKD, 261.31);
});

test('switching origin changes the cross-border route fare and duration', () => {
  const kowloon = option(confirmed(), 'sz');
  const island = option(confirmed({ origin: 'island' }), 'sz');
  assert.equal(island.outwardMinutes - kowloon.outwardMinutes, 15);
  assert.equal(island.inwardMinutes - kowloon.inwardMinutes, 15);
  assert.equal(Math.round((island.perPersonHKD! - kowloon.perPersonHKD!) * 100), 2200);
});

test('unedited journey assumptions follow the selected origin and route', () => {
  assert.equal(defaultInputs.hkLocalMinutes, undefined);
  assert.equal(defaultInputs.szLocalMinutes, undefined);
  assert.equal(defaultInputs.borderBufferMinutes, undefined);
  assert.deepEqual(effectiveTravelAssumptions(confirmed()), {
    hkLocalMinutes: 15, szLocalMinutes: 25, borderBufferMinutes: 30, crossingClosingBufferMinutes: 15,
  });
  assert.deepEqual(effectiveTravelAssumptions(confirmed({ origin: 'island', szRoute: 'bus' })), {
    hkLocalMinutes: 20, szLocalMinutes: 35, borderBufferMinutes: 35, crossingClosingBufferMinutes: 15,
  });
  assert.equal(option(confirmed({ origin: 'island' }), 'hk').outwardMinutes, 20);
  assert.equal(option(confirmed({ szRoute: 'bus' }), 'sz').outwardMinutes, 135);
});

test('explicit journey overrides persist and clearing them restores the relevant fixture', () => {
  const inputs = confirmed({ origin: 'island', szRoute: 'bus', hkLocalMinutes: 17, szLocalMinutes: 28, borderBufferMinutes: 40 });
  assert.deepEqual(effectiveTravelAssumptions(inputs), {
    hkLocalMinutes: 17, szLocalMinutes: 28, borderBufferMinutes: 40, crossingClosingBufferMinutes: 15,
  });
  assert.equal(option(inputs, 'hk').outwardMinutes, 17);
  assert.equal(option(inputs, 'sz').outwardMinutes, 148);
  assert.equal(effectiveTravelAssumptions({ ...inputs, szLocalMinutes: undefined }).szLocalMinutes, 35);
});

test('zero budget never produces infinity or a spurious recommendation', () => {
  const result = compareOutings(confirmed({ budgetPerPersonHKD: 0 }));
  assert.equal(result.recommendation.optionId, null);
  for (const item of result.options) {
    assert.equal(item.budgetFeasible, false);
    assert.equal(item.feasible, false);
    assert.equal(item.scoreBreakdown.price, 0);
    assert.equal(item.score, null);
    assert.equal(item.scoreBreakdown.discovery, null);
  }
});

test('budget test uses the full group charge rather than a rounded per-person average', () => {
  const fixture = freshFixture();
  fixture.local.costs = [{ id: 'hk-shared', label: 'Shared item', currency: 'HKD', amount: 1, quantity: 1, scope: 'group', note: 'Test fixture.' }];
  fixture.local.origins.kowloon.fareEachWayHKD = 0;
  const hk = option(confirmed({ partySize: 3, budgetPerPersonHKD: 0.33 }), 'hk', fixture);
  assert.equal(hk.perPersonHKD, 0.33);
  assert.equal(hk.groupHKD, 1);
  assert.equal(hk.budgetFeasible, false);
});

test('decimal half-cent budgets use the same normalized cents for feasibility and explanations', () => {
  const fixture = freshFixture();
  fixture.local.costs = [{ id: 'test-charge', label: 'Test charge', currency: 'HKD', amount: 1.01, quantity: 1, scope: 'group', note: 'Test fixture.' }];
  fixture.local.origins.kowloon.fareEachWayHKD = 0;
  const equal = option(confirmed({ partySize: 1, budgetPerPersonHKD: 1.005 }), 'hk', fixture);
  assert.equal(equal.normalizedBudgetPerPersonHKD, 1.01);
  assert.equal(equal.groupHKD, 1.01);
  assert.equal(equal.budgetFeasible, true);
  assert.equal(equal.scoreBreakdown.price, 0);
  assert.ok(equal.reasons.some(reason => reason.includes('Within the HK$1.01')));
  assert.ok(equal.reasons.every(reason => !reason.includes('exceeds')));
  const short = option(confirmed({ partySize: 1, budgetPerPersonHKD: 1.004 }), 'hk', fixture);
  assert.equal(short.normalizedBudgetPerPersonHKD, 1);
  assert.equal(short.budgetFeasible, false);
  assert.ok(short.reasons.some(reason => reason.includes('by HK$0.01')));
});

test('native unit amounts normalize once before multiplying across a group', () => {
  const fixture = freshFixture();
  fixture.local.costs = [{ id: 'test-charge', label: 'Test charge', currency: 'HKD', amount: 10.075, quantity: 1, scope: 'per-person', note: 'Test fixture.' }];
  fixture.local.origins.kowloon.fareEachWayHKD = 0;
  const hk = option(confirmed({ partySize: 3, budgetPerPersonHKD: 10.075 }), 'hk', fixture);
  assert.equal(hk.lineItems[0].nativeUnitAmount, 10.08);
  assert.equal(hk.groupHKD, 30.24);
  assert.equal(hk.perPersonHKD, 10.08);
  assert.equal(hk.normalizedBudgetPerPersonHKD, 10.08);
  assert.equal(hk.budgetFeasible, true);
});

test('FX products round decimal half-cents consistently without binary multiplication drift', () => {
  const fixture = freshFixture();
  fixture.local.costs = [{ id: 'test-charge', label: 'Test CNY charge', currency: 'CNY', amount: 5, quantity: 1, scope: 'group', note: 'Test fixture.' }];
  fixture.local.origins.kowloon.fareEachWayHKD = 0;
  const hk = option(confirmed({ partySize: 1, fxHKDPerCNY: 1.001, budgetPerPersonHKD: 5.005 }), 'hk', fixture);
  assert.equal(hk.groupHKD, 5.01);
  assert.equal(hk.normalizedBudgetPerPersonHKD, 5.01);
  assert.equal(hk.budgetFeasible, true);
});

test('extreme supported values remain finite', () => {
  const result = compareOutings(confirmed({
    partySize: 6, fxHKDPerCNY: 100, budgetPerPersonHKD: 1_000_000_000,
    hkMealPerPersonHKD: 1_000_000_000, szMealPerPersonCNY: 1_000_000_000,
    departureMinutes: 1439, homeByMinutes: 2879, mealMinutes: 180,
    borderBufferMinutes: 240, hkLocalMinutes: 180, szLocalMinutes: 180, walkMinutes: 180,
  }));
  assert.equal(result.valid, true);
  for (const item of result.options) {
    assert.ok(Number.isFinite(item.groupHKD!));
    assert.equal(item.score, null);
    assert.equal(item.scoreBreakdown.discovery, null);
    assert.ok(Number.isInteger(item.returnMinutes));
  }
});

test('invalid party, FX, time, preferences and amount inputs return errors without a result', () => {
  const invalidPatches: Partial<OutingInputs>[] = [
    { partySize: 0 }, { partySize: 7 }, { partySize: 1.5 }, { partySize: NaN },
    { fxHKDPerCNY: 0 }, { fxHKDPerCNY: -1 }, { fxHKDPerCNY: Infinity }, { fxHKDPerCNY: NaN },
    { departureMinutes: -1 }, { departureMinutes: 1440 }, { departureMinutes: 1000.5 },
    { homeByMinutes: 2880 }, { homeByMinutes: -1 }, { mealMinutes: 59 }, { mealMinutes: 181 },
    { budgetPerPersonHKD: -1 }, { budgetPerPersonHKD: Number.MAX_VALUE },
    { weights: { price: -1, ease: 3, discovery: 3 } }, { weights: { price: 3, ease: 6, discovery: 3 } },
    { borderBufferMinutes: -1 }, { crossingClosingBufferMinutes: 0 }, { szLocalMinutes: NaN }, { walkMinutes: 0.5 },
    { hkMealPerPersonHKD: -1 }, { szMealPerPersonCNY: Infinity },
    { entryEligibility: 'yes' as 'confirmed' }, { origin: 'unknown' as 'kowloon' }, { szRoute: 'taxi' as 'rail' },
  ];
  for (const patch of invalidPatches) {
    const result = compareOutings(confirmed(patch));
    assert.equal(result.valid, false, JSON.stringify(patch));
    assert.ok(result.errors.length > 0);
    assert.deepEqual(result.options, []);
    assert.equal(result.recommendation.optionId, null);
  }
  assert.ok(validateInputs(null as unknown as OutingInputs).length);
});

test('malformed persisted values are rejected without throwing', () => {
  for (const malformed of [null, undefined, {}, [], { ...defaultInputs, weights: null }, { ...defaultInputs, weights: [] }, { ...defaultInputs, weights: 'abc' }, { ...defaultInputs, budgetPerPersonHKD: '400' }]) {
    const result = compareOutings(malformed as unknown as OutingInputs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.deepEqual(result.options, []);
  }
});

test('actionable entry and closing blockers appear before positive budget facts', () => {
  assert.match(option(defaultInputs, 'sz').reasons[0], /Entry eligibility/);
  assert.match(option(confirmed({ departureMinutes: 20 * 60, homeByMinutes: 2 * 60 }), 'sz').reasons[0], /border crossing/);
});

test('fixed surplus allocation conserves rounded cents using largest remainders', () => {
  const equal = allocateSurplus(100, { worker: 1, community: 1, business: 1 });
  assert.equal(equal.valid, true);
  assert.deepEqual(equal.allocationCents, { worker: 3334, community: 3333, business: 3333 });
  assert.deepEqual(equal.allocations, { worker: 33.34, community: 33.33, business: 33.33 });
  assert.equal(allocateSurplus(0.005, { worker: 1, community: 1, business: 1 }).poolCents, 1);
  assert.equal(allocateSurplus(1.005, { worker: 1, community: 1, business: 1 }).poolCents, 101);
  assert.equal(allocateSurplus(10.075, { worker: 1, community: 1, business: 1 }).poolCents, 1008);
  assert.deepEqual(allocateSurplus(0, { worker: 0, community: 0, business: 0 }).allocationCents, { worker: 0, community: 0, business: 0 });
  assert.deepEqual(allocateSurplus(0.001, { worker: 0, community: 0, business: 0 }).allocationCents, { worker: 0, community: 0, business: 0 });
  for (const pool of [0, 0.01, 0.02, 0.03, 1.005, 12.345, 777.77, 1_000_000_000]) {
    for (const weights of [{ worker: 2, community: 3, business: 5 }, { worker: 1, community: 1, business: 1 }, { worker: 0, community: 0, business: 1 }, { worker: 1e-9, community: 2.7, business: 1_000_000_000 }]) {
      const result = allocateSurplus(pool, weights);
      assert.equal(result.valid, true);
      assert.equal(Object.values(result.allocationCents!).reduce((sum, value) => sum + value, 0), result.poolCents);
      assert.ok(Object.values(result.allocationCents!).every(value => Number.isInteger(value) && value >= 0));
    }
  }
  assert.match(equal.note, /no claim that ownership creates/);
});

test('invalid allocation inputs are rejected, including all-zero weights for a positive pool', () => {
  for (const pool of [-1, NaN, Infinity, Number.MAX_VALUE]) assert.equal(allocateSurplus(pool, { worker: 1, community: 1, business: 1 }).valid, false);
  assert.equal(allocateSurplus(100, { worker: 0, community: 0, business: 0 }).valid, false);
  assert.equal(allocateSurplus(100, { worker: -1, community: 1, business: 1 }).valid, false);
  assert.equal(allocateSurplus(100, { worker: NaN, community: 1, business: 1 }).valid, false);
  assert.equal(allocateSurplus(100, { worker: 1, community: Infinity, business: 1 }).valid, false);
});

test('engine never mutates inputs or the source fixture', () => {
  const inputs = confirmed();
  const fixture = freshFixture();
  const beforeInputs = structuredClone(inputs);
  const beforeFixture = structuredClone(fixture);
  compareOutings(inputs, fixture);
  assert.deepEqual(inputs, beforeInputs);
  assert.deepEqual(fixture, beforeFixture);
});

test('explicit optional-order flags omit only shared food, including across party sizes', () => {
  const fixture = freshFixture();
  fixture.local.costs.push({ id: 'hk-shared-taxi', label: 'Shared taxi', currency: 'HKD', amount: 30, quantity: 1, scope: 'group', note: 'Required group cost, not optional food.' });
  for (const partySize of [1, 2, 3, 6]) {
    const withOrder = option(confirmed({ partySize, itineraryOverrides: { hk: { includeSharedOrder: true } } }), 'hk', fixture);
    const without = option(confirmed({ partySize, itineraryOverrides: { hk: { includeSharedOrder: false } } }), 'hk', fixture);
    assert.equal(withOrder.groupHKD! - without.groupHKD!, 64);
    assert.equal(without.lineItems.some(item => item.id === 'hk-shared'), false);
    assert.equal(without.lineItems.find(item => item.id === 'hk-shared-taxi')!.hkdGroupAmount, 30);
    assert.equal(without.lineItems.find(item => item.id === 'hk-transport')!.hkdGroupAmount, 24 * partySize);
  }
  const [hk, sz] = compareOutings(confirmed({ itineraryOverrides: { hk: { includeSharedOrder: false }, sz: { includeSharedOrder: false } } })).options;
  assert.equal(hk.perPersonHKD, 304);
  assert.equal(sz.perPersonHKD, 260.22);
});

test('per-city activity settings stay independent and their delay is time-only', () => {
  const base = compareOutings(confirmed());
  const edited = compareOutings(confirmed({ itineraryOverrides: { hk: { mealMinutes: 60, walkMinutes: 15, includeSharedOrder: false, storyDelayMinutes: 30 } } }));
  assert.deepEqual(edited.options[1], base.options[1]);
  assert.equal(edited.options[0].experienceMinutes, 105);
  assert.equal(edited.options[0].mealMinutes, 60);
  assert.equal(edited.options[0].walkMinutes, 15);
  assert.equal(edited.options[0].storyDelayMinutes, 30);
  assert.equal(edited.options[0].includeSharedOrder, false);
  assert.equal(edited.options[0].perPersonHKD, 304);
  const delayOnly = option(confirmed({ itineraryOverrides: { hk: { storyDelayMinutes: 30 } } }), 'hk');
  assert.equal(delayOnly.groupHKD, base.options[0].groupHKD);
  assert.equal(delayOnly.returnMinutes, base.options[0].returnMinutes + 30);
});

test('explicit novelty is city-symmetric and is not sourced from the fixture', () => {
  const familiarity: OutingInputs['familiarity'] = { hk: { dinner: 'new', walk: 'familiar' }, sz: { dinner: 'new', walk: 'familiar' } };
  const result = compareOutings(confirmed({ familiarity, weights: { price: 0, ease: 0, discovery: 5 } }));
  assert.equal(result.options[0].scoreBreakdown.discovery, 50);
  assert.equal(result.options[1].scoreBreakdown.discovery, 50);
  assert.equal(result.options[0].score, result.options[1].score);
  assert.equal(result.recommendation.optionId, null);
  const hkNew = compareOutings(confirmed({ familiarity: { hk: { dinner: 'new', walk: 'new' }, sz: { dinner: 'familiar', walk: 'familiar' } }, weights: { price: 0, ease: 0, discovery: 5 } }));
  const szNew = compareOutings(confirmed({ familiarity: { sz: { dinner: 'new', walk: 'new' }, hk: { dinner: 'familiar', walk: 'familiar' } }, weights: { price: 0, ease: 0, discovery: 5 } }));
  assert.equal(hkNew.recommendation.optionId, 'hk');
  assert.equal(szNew.recommendation.optionId, 'sz');
  assert.equal(hkNew.options[0].score, szNew.options[1].score);
  assert.equal('discoveryRating' in illustrativeData.local, false);
  assert.equal('discoveryRating' in illustrativeData.shenzhen, false);
});

test('unsure means unknown, never low, and prevents ranking a known alternative above it', () => {
  const result = compareOutings(confirmed({ familiarity: { hk: { dinner: 'familiar', walk: 'familiar' }, sz: { dinner: 'new', walk: 'unsure' } }, weights: { price: 0, ease: 0, discovery: 5 } }));
  assert.equal(result.options[0].score, 0);
  assert.equal(result.options[1].scoreBreakdown.discovery, null);
  assert.equal(result.options[1].score, null);
  assert.equal(result.recommendation.optionId, null);
  assert.match(result.recommendation.label, /still yours to judge/);
  assert.ok(result.options[1].warnings.some(warning => warning.includes('Missing preference')));
  const zeroDiscovery = compareOutings(confirmed({ weights: { price: 0, ease: 5, discovery: 0 } }));
  assert.equal(zeroDiscovery.options[0].scoreBreakdown.discovery, null);
  assert.equal(zeroDiscovery.options[0].score, 87.5);
  assert.equal(zeroDiscovery.recommendation.optionId, 'hk');
});

test('absent walks do not inject an unknown familiarity component', () => {
  const result = option(confirmed({ itineraryOverrides: { hk: { walkMinutes: 0 } }, familiarity: { hk: { dinner: 'new', walk: 'unsure' } }, weights: { price: 0, ease: 0, discovery: 5 } }), 'hk');
  assert.equal(result.scoreBreakdown.discovery, 100);
  assert.equal(result.score, 100);
});

test('constraint-only explanations remain possible with unknown familiarity', () => {
  const result = compareOutings(confirmed({ homeByMinutes: 20 * 60 }));
  assert.equal(result.options[0].feasible, true);
  assert.equal(result.options[1].homeFeasible, false);
  assert.equal(result.recommendation.optionId, 'hk');
  assert.equal(result.options[0].score, null);
  assert.match(result.recommendation.reasons[0], /only option/);
});

test('omitted unpriced optional food becomes absent while other missing costs remain unknown', () => {
  const fixture = freshFixture();
  fixture.shenzhen.costs[2].amount = null;
  const inputs = confirmed({ itineraryOverrides: { sz: { includeSharedOrder: false } } });
  assert.equal(option(inputs, 'sz', fixture).perPersonHKD, 260.22);
  fixture.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = null;
  assert.equal(option(inputs, 'sz', fixture).perPersonHKD, null);
  assert.deepEqual(option(inputs, 'sz', fixture).missingCostLabels, ['Rail · round trip']);
});

test('malformed per-city durations and explicit familiarity are rejected without a result', () => {
  const patches = [
    { itineraryOverrides: null }, { itineraryOverrides: [] }, { itineraryOverrides: { xx: {} } },
    { itineraryOverrides: { hk: null } }, { itineraryOverrides: { sz: [] } },
    { itineraryOverrides: { hk: { mealMinutes: 59 } } }, { itineraryOverrides: { hk: { walkMinutes: 0.5 } } },
    { itineraryOverrides: { hk: { storyDelayMinutes: -1 } } }, { itineraryOverrides: { sz: { includeSharedOrder: 'false' } } },
    { familiarity: null }, { familiarity: [] }, { familiarity: { hk: null } },
    { familiarity: { hk: { dinner: 55 } } }, { familiarity: { sz: { walk: 'maybe' } } },
  ];
  for (const patch of patches) assert.equal(compareOutings(confirmed(patch as unknown as Partial<OutingInputs>)).valid, false, JSON.stringify(patch));
});


test('an unknown competing plan does not make the known plan a preference winner', () => {
  const result=compareOutings(defaultInputs);
  assert.equal(result.recommendation.optionId,null);
  assert.equal(result.recommendation.label,'One fits; one needs checking');
  assert.ok(result.recommendation.reasons.some(reason=>reason.includes('not a personal-preference winner')));
});
