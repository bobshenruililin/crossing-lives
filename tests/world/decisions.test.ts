import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { HomeDecision, ParcelDecision, RentalDecision } from '../../src/world/decisions/DecisionScenes';
import { PlanSummary } from '../../src/world/decisions/PlanSummary';
import { HOME_ACTIVITIES, HOME_FIXTURE, LEASE_OFFERS, PARCEL_FIXTURE, RENTAL_FIXTURE, RENTAL_REFUND_TERMS, commitHomePlan, committedHomeSummary, commitLeaseChoice, commitParcelDecision, homeSnapshot, keepEverything, parcelSnapshot, readHomePlan, readLeaseChoice, readParcelDecision, rentalSnapshot, setHomeActivity, setHomeDeadline, setParcelContext, setParcelMethod } from '../../src/world/decisions/model';
import type { ActivityChoice, HomePlan } from '../../src/world/decisions/model';
import { initialWorldState, worldReducer } from '../../src/world/model';
import { PARTY_IDS } from '../../src/world/types';
import type { InteractionProps, InteractionValues, WorldContext } from '../../src/world/types';

const context: WorldContext = { party: 'two-friends', day: 'weekend', scenario: 'fieldtrip' };
const noop = () => {};
const componentFor = { 'hk-home': HomeDecision, 'parcel-counter': ParcelDecision, 'rental-home': RentalDecision };
const render = (sceneId: keyof typeof componentFor, values: InteractionValues = {}, withContext = context) => renderToStaticMarkup(createElement(componentFor[sceneId], { sceneId, interactionId: sceneId, context: withContext, values, onChange: noop, onClose: noop }));
const summary = (values: InteractionValues) => renderToStaticMarkup(createElement(PlanSummary, { values }));

test('an earlier deadline makes the unchanged invented day late; it never repairs the plan', () => {
  const all = readHomePlan({});
  const later = homeSnapshot(all);
  assert.equal(later.totalMinutes, 720);
  assert.equal(later.finishMinute, 23 * 60);
  assert.equal(later.spareMinutes, 30);
  const earlier = setHomeDeadline(all, 'earlier');
  assert.equal(homeSnapshot(earlier).lateMinutes, 30);
  assert.deepEqual(earlier.activities, all.activities);
  assert.equal(homeSnapshot(earlier).finishMinute, later.finishMinute);
  const shorter = setHomeActivity(earlier, 'lunch', 'short');
  assert.equal(homeSnapshot(shorter).marginMinutes, 0);
  assert.equal(homeSnapshot(shorter).finishMinute, 22 * 60 + 30);
  assert.equal(homeSnapshot(setHomeActivity(earlier, 'exhibition', 'omit')).spareMinutes, 90);
  assert.equal(homeSnapshot(keepEverything(shorter)).lateMinutes, 30, 'Keep everything preserves the earlier deadline and its consequence.');
  assert.deepEqual(all.activities, { lunch: 'full', neighborhood: 'full', exhibition: 'full' });
});

test('every home combination conserves time and only changes the activity the player chose', () => {
  const choices: ActivityChoice[] = ['full', 'short', 'omit'];
  for (const deadline of ['earlier', 'later'] as const) for (const lunch of choices) for (const neighborhood of choices) for (const exhibition of choices) {
    const plan: HomePlan = { deadline, activities: { lunch, neighborhood, exhibition } };
    const before = JSON.stringify(plan);
    const result = homeSnapshot(plan);
    const expected = (lunch === 'full' ? 90 : lunch === 'short' ? 60 : 0) + (neighborhood === 'full' ? 150 : neighborhood === 'short' ? 90 : 0) + (exhibition === 'full' ? 120 : exhibition === 'short' ? 60 : 0);
    assert.equal(result.activityMinutes, expected);
    assert.equal(result.totalMinutes, 360 + expected);
    assert.equal(result.finishMinute, 660 + 360 + expected);
    assert.equal(result.availableMinutes - result.totalMinutes, result.marginMinutes);
    assert.equal(result.spareMinutes - result.lateMinutes, result.marginMinutes);
    for (const activity of HOME_ACTIVITIES) {
      const next = setHomeActivity(plan, activity.id, 'omit');
      for (const other of HOME_ACTIVITIES.filter(item => item.id !== activity.id)) assert.equal(next.activities[other.id], plan.activities[other.id]);
    }
    assert.equal(JSON.stringify(plan), before);
  }
  assert.equal(HOME_FIXTURE.fixedCommitmentMinutes, 360);
  assert.throws(() => setHomeActivity(readHomePlan({}), 'unknown' as never, 'short'), RangeError);
  assert.throws(() => setHomeActivity(readHomePlan({}), 'lunch', 'automatic' as never), RangeError);
});

test('only an explicitly taken plan leaves a later footprint; no activity becomes a locked or completed scene', () => {
  assert.equal(committedHomeSummary({}), null);
  assert.equal(summary({ homeDeadline: 'earlier' }), '');
  const values = Object.freeze({ choice: 'earlier', reflection: 'same', prototypePosition: 17 });
  const preview = setHomeActivity(readHomePlan(values), 'exhibition', 'omit');
  assert.equal(summary(values), '', 'A preview does not leak into the saved summary.');
  const committed = commitHomePlan(values, preview);
  assert.equal(committed.reflection, 'same');
  assert.equal(committed.prototypePosition, 17);
  assert.equal(committed.choice, 'earlier');
  assert.deepEqual(readHomePlan(committed), preview);
  assert.deepEqual(committedHomeSummary(committed)!.suggestedPlaces, ['mall-foodcourt', 'neighborhood-lane']);
  assert.match(summary(committed), /Planning exhibition<\/span><span>Left out/);
  assert.match(summary(committed), /All places are still open/);
  assert.doesNotMatch(summary(committed), /checkbox|completed|checked=/);
  assert.deepEqual(values, { choice: 'earlier', reflection: 'same', prototypePosition: 17 });
});

test('parcel context changes real additional money and time before the collection/delivery decision', () => {
  const initial = readParcelDecision({});
  assert.equal(initial.method, null, 'No destination is selected for the player.');
  const collection = setParcelMethod(initial, 'collection');
  const local = parcelSnapshot(collection);
  const dedicatedDecision = setParcelContext(collection, 'dedicated-trip');
  const dedicated = parcelSnapshot(dedicatedDecision);
  assert.equal(dedicatedDecision.method, 'collection', 'Changing context must not silently change the decision.');
  assert.deepEqual([local.pickupCost, local.pickupMinutes, local.selectedCost, local.selectedMinutes], [16, 20, 16, 20]);
  assert.deepEqual([dedicated.pickupCost, dedicated.pickupMinutes, dedicated.selectedCost, dedicated.selectedMinutes], [116, 160, 116, 160]);
  assert.equal(dedicated.pickupCost - local.pickupCost, 100);
  assert.equal(dedicated.pickupMinutes - local.pickupMinutes, 140);
  assert.equal(local.deliveryMinusCollection, 19);
  assert.equal(dedicated.deliveryMinusCollection, -81);
  for (const decision of [collection, dedicatedDecision]) {
    const delivery = parcelSnapshot(setParcelMethod(decision, 'delivery'));
    assert.equal(delivery.selectedCost, 35);
    assert.equal(delivery.selectedMinutes, null);
    assert.equal(delivery.deliveryDuration, null);
    assert.equal(delivery.unit, 'CNY-equivalent');
    assert.equal(parcelSnapshot(setParcelContext(setParcelMethod(decision, 'delivery'), 'already-going')).deliveryDuration, null);
  }
  assert.deepEqual(PARCEL_FIXTURE, { handling: 6, detourTransport: 10, detourMinutes: 20, dedicatedTransport: 100, dedicatedMinutes: 140, delivery: 35, unit: 'CNY-equivalent' });
  assert.throws(() => commitParcelDecision({}, initial), RangeError);
});

test('each lease conserves the starting cash and its conditional claim stays separate from liquid money', () => {
  assert.equal(readLeaseChoice({}), null, 'The player must choose a lease.');
  const lower = rentalSnapshot('lower-rent'), upfront = rentalSnapshot('less-upfront');
  assert.deepEqual([lower.rentPaid, lower.conditionalDeposit, lower.liquidCash, lower.recurringRent], [6000, 12000, 6000, 6000]);
  assert.deepEqual([upfront.rentPaid, upfront.conditionalDeposit, upfront.liquidCash, upfront.recurringRent], [7500, 7500, 9000, 7500]);
  for (const result of [lower, upfront]) {
    assert.equal(result.rentPaid + result.conditionalDeposit + result.liquidCash, 24000);
    assert.equal(result.cashOut + result.liquidCash, result.startingCash);
    assert.equal(result.refundAmount, null);
    assert.equal(result.refundTiming, null);
  }
  assert.ok(upfront.liquidCash > lower.liquidCash);
  assert.ok(upfront.recurringRent > lower.recurringRent, 'Neither offer dominates cash now and recurring rent.');
  assert.equal(RENTAL_FIXTURE.otherMoveInCharges, 0);
  assert.match(RENTAL_REFUND_TERMS, /less agreed deductions/);
  assert.match(RENTAL_REFUND_TERMS, /amount and timing are unknown/);
  assert.throws(() => rentalSnapshot('best' as never), RangeError);
});

test('commits preserve all unrelated values and world close/context changes do not alter committed decisions', () => {
  const original = Object.freeze({ prototypeChoice: 'untouched', reflection: true, score: null });
  const plan = setHomeActivity(setHomeDeadline(readHomePlan(original), 'earlier'), 'lunch', 'short');
  const committedHome = commitHomePlan(original, plan);
  const committedParcel = commitParcelDecision(original, { context: 'dedicated-trip', method: 'delivery' });
  const committedLease = commitLeaseChoice(original, 'less-upfront');
  let world = worldReducer(initialWorldState(), { type: 'start' });
  for (const [interactionId, values] of [['hk-home', committedHome], ['parcel-counter', committedParcel], ['rental-home', committedLease]] as const) world = worldReducer(world, { type: 'values', interactionId, values });
  const before = JSON.stringify(world.values);
  world = worldReducer(world, { type: 'close' });
  world = worldReducer(world, { type: 'context', context: { party: 'family', day: 'weekday', scenario: 'housing' } });
  assert.equal(JSON.stringify(world.values), before);
  assert.deepEqual(readHomePlan(world.values['hk-home']), plan);
  assert.deepEqual(readParcelDecision(world.values['parcel-counter']), { context: 'dedicated-trip', method: 'delivery' });
  assert.equal(readLeaseChoice(world.values['rental-home']), 'less-upfront');
  for (const result of [committedHome, committedParcel, committedLease]) for (const [key, value] of Object.entries(original)) assert.equal(result[key], value);
});

test('all three scenes expose native choices, immediate facts, adjacent unknowns and optional evidence', () => {
  const home = render('hk-home', { homeDeadline: 'earlier' });
  assert.match(home, /30 minutes late/);
  assert.match(home, /type="range"/);
  assert.match(home, /Keep everything at full length/);
  assert.match(home, /Leave out/);
  assert.match(home, /data-attended-activity="lunch"/);
  assert.equal((home.match(/class="wd-activity-card"/g) ?? []).length, 1);
  assert.match(home.split('<details')[0], /Fictional day plan · travel times unverified/);
  assert.match(home, /Travel and clearance times are unverified; the illustration is not a live clock/);
  const parcel = render('parcel-counter', { parcelContext: 'dedicated-trip', parcelMethod: 'delivery' });
  assert.match(parcel.split('<details')[0], /Separate fictional costs · CNY-equivalent/);
  assert.match(parcel, /<strong>35<\/strong>/);
  assert.match(parcel, /<strong>Unknown<\/strong>/);
  assert.match(parcel, /data-destination="delivery"/);
  assert.match(parcel, /not fares or an exchange rate/);
  assert.match(parcel, /does not change your day plan or its allowances/);
  const rental = render('rental-home', { leaseChoice: 'less-upfront' });
  assert.match(rental.split('<details')[0], /Separate fictional lease · HKD/);
  assert.match(rental, /<strong>9,000<\/strong>/);
  assert.match(rental, /<strong>7,500<\/strong>/);
  assert.match(rental.split('<details')[0], /held, not spendable/);
  assert.match(rental.split('<details')[0], /Return conditional; amount and timing unknown/);
  assert.match(rental, /Refund amount and timing are unknown/);
  for (const html of [home, parcel, rental]) {
    assert.equal((html.match(/role="status"/g) ?? []).length, 1);
    assert.ok((html.match(/data-world-number=/g) ?? []).length <= 2);
    assert.ok(!/<details[^>]*\bopen/.test(html));
    assert.ok(!html.includes('role="dialog"'));
    assert.match(html, />Cancel<\/button>/);
  }
  assert.match(render('parcel-counter'), /data-step="context"/);
  assert.doesNotMatch(render('parcel-counter').split('<details')[0], />Use (?:collection|delivery)/);
  assert.match(render('rental-home'), /data-step="contract"/);
  assert.doesNotMatch(render('rental-home').split('<details')[0], />Choose lease/);
});

test('compact primary views show only the attended step, with one fiction label and no repeated worksheet prose', () => {
  const home = render('hk-home', { homeDeadline: 'earlier' }), visibleHome = home.split('<details')[0];
  assert.ok(visibleHome.indexOf('wd-clock-row') < visibleHome.indexOf('wd-activity-card'));
  assert.ok(visibleHome.indexOf('wd-activity-card') < visibleHome.indexOf('wd-home-outcome'));
  assert.ok(visibleHome.indexOf('wd-home-outcome') < visibleHome.indexOf('wd-actions'));
  assert.match(visibleHome, /<select aria-label="Activity to adjust"/);
  assert.match(visibleHome, /HK ⇄ Shenzhen · striped 6h assumed round trip/);
  assert.match(visibleHome, /wd-time-fixed/);
  assert.ok(visibleHome.indexOf('wd-time-figure') < visibleHome.indexOf('wd-activity-card'));
  assert.match(renderToStaticMarkup(createElement(PlanSummary, { values: commitHomePlan({}, readHomePlan({})) })), /Hong Kong–Shenzhen round trip keeps its assumed 6h allowance/);
  assert.doesNotMatch(visibleHome, /Keep everything at full length|wd-activity-tabs/);
  const parcel = render('parcel-counter', { parcelContext: 'dedicated-trip', parcelMethod: 'collection' }).split('<details')[0];
  assert.match(parcel, /<strong>116<\/strong>/);
  assert.match(parcel, /<strong>160<\/strong>/);
  assert.doesNotMatch(parcel, /wd-context-cards|wd-parcel-destinations/);
  const rental = render('rental-home', { leaseChoice: 'less-upfront' }).split('<details')[0];
  assert.doesNotMatch(rental, /wd-lease-offers|wd-contract/);
  assert.equal((rental.match(/9,000/g) ?? []).length, 1);
  assert.equal((rental.match(/7,500/g) ?? []).length, 2, 'The monthly rent and separate deposit happen to be equal, and each appears once.');
  for (const visible of [visibleHome, parcel, rental]) {
    assert.equal((visible.match(/class="wd-caption"/g) ?? []).length, 1);
    assert.doesNotMatch(visible, /class="wd-prompt"|class="wd-thought"|class="wd-limit"/);
  }
});

test('party, day and scenario never infer a decision, price, allowance or capability', () => {
  for (const sceneId of Object.keys(componentFor) as (keyof typeof componentFor)[]) {
    const values: InteractionValues = sceneId === 'hk-home' ? { homeDeadline: 'earlier', homeLunch: 'short' } : sceneId === 'parcel-counter' ? { parcelContext: 'dedicated-trip', parcelMethod: 'collection' } : { leaseChoice: 'less-upfront' };
    const baseline = render(sceneId, values);
    for (const party of PARTY_IDS) for (const day of ['weekday', 'weekend'] as const) for (const scenario of ['fieldtrip', 'daily-life', 'housing'] as const) assert.equal(render(sceneId, values, { party, day, scenario }), baseline);
  }
});

test('the decision layer never touches persistence, legacy models or demographic calculations', () => {
  const dir = new URL('../../src/world/decisions/', import.meta.url);
  const source = readdirSync(dir).filter(name => /\.(?:ts|tsx|css)$/.test(name)).map(name => readFileSync(new URL(name, dir), 'utf8')).join('\n');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|setInterval|requestAnimationFrame|Date\.now|fetch\(/);
  assert.doesNotMatch(source, /from ['"][^'"]*(?:domain|persistence|story|components|legacy)/);
  assert.doesNotMatch(source, /context\.party|context\.day|context\.scenario/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /animation:none!important;transition:none!important/);
  assert.equal(Object.keys(LEASE_OFFERS).length, 2);
});
