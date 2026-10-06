import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSpendingContext } from '../src/business/context';
import type { SpendingContext } from '../src/business/context';
import EvidenceDesk from '../src/components/EvidenceDesk';
import { defaultInputs, illustrativeData } from '../src/domain/data';
import { compareOutings } from '../src/domain/engine';
import type { OptionId, OutingFixture, OutingInputs, OutingOption } from '../src/domain/model';
import { createStoryState, selectStoryOption, storyReducer } from '../src/story/engine';

const optionFor = (city: OptionId, partySize = 2, fixture = illustrativeData, patch: Partial<OutingInputs> = {}) => {
  const result = compareOutings({ ...defaultInputs, partySize, ...patch }, fixture);
  assert.equal(result.valid, true, result.errors.join(' '));
  return result.options.find(option => option.id === city)!;
};
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const renderBusiness = (spendingContext: SpendingContext | null = null) => renderToStaticMarkup(createElement(EvidenceDesk, {
  onBack: () => {}, initialSection: 'economics', spendingContext,
}));
const contextMarkup = (html: string) => html.match(/<div class="research-banner spending-context">([\s\S]*?)<details class="membership-lens">/)?.[1] ?? '';

test('spending context copies both engine totals for each city and every supported party count', () => {
  for (const city of ['hk', 'sz'] as const) {
    for (const partySize of [1, 2, 3, 4, 5, 6]) {
      const option = optionFor(city, partySize);
      assert.deepEqual(createSpendingContext(option, partySize), {
        cityId: city,
        partySize,
        perPersonHKD: option.perPersonHKD,
        groupHKD: option.groupHKD,
        dataStatus: 'illustrative',
        scope: 'whole-outing',
      });
    }
  }
});

test('rounded per-person averages never recalculate the engine group amount', () => {
  const context = createSpendingContext(optionFor('hk', 6), 6)!;
  assert.equal(context.perPersonHKD, 314.67);
  assert.equal(context.groupHKD, 1888);
  assert.notEqual(context.groupHKD, context.perPersonHKD! * context.partySize);
});

test('no city selection gives no spending context, including the untouched story', () => {
  const story = freeze(createStoryState());
  const before = structuredClone(story);
  assert.equal(createSpendingContext(null, 2), null);
  assert.equal(createSpendingContext(selectStoryOption(story), 2), null);
  assert.deepEqual(story, before);
});

test('the selected story option is read without changing time, choices or familiarity', () => {
  for (const city of ['hk', 'sz'] as const) {
    const story = freeze(storyReducer(createStoryState(), { type: 'PREVIEW_CITY', city }));
    const before = structuredClone(story);
    const option = selectStoryOption(story)!;
    const context = createSpendingContext(option, 2)!;
    assert.equal(context.cityId, city);
    assert.equal(context.perPersonHKD, city === 'hk' ? 304 : 260.22);
    assert.equal(context.groupHKD, option.groupHKD);
    assert.deepEqual(story, before);
  }
});

test('missing drinks or return-journey fares stay incomplete instead of exposing a known subtotal', () => {
  for (const city of ['hk', 'sz'] as const) {
    for (const missing of ['drinks', 'travel']) {
      const fixture: OutingFixture = structuredClone(illustrativeData);
      if (missing === 'drinks') {
        (city === 'hk' ? fixture.local : fixture.shenzhen).costs[1].amount = null;
      } else if (city === 'hk') {
        fixture.local.origins.kowloon.fareEachWayHKD = null;
      } else {
        fixture.shenzhen.routes.rail.origins.kowloon.fareEachWayHKD = null;
      }
      const option = optionFor(city, 3, fixture);
      assert.ok(option.knownGroupSubtotalHKD > 0);
      const context = createSpendingContext(option, 3)!;
      assert.equal(context.perPersonHKD, null);
      assert.equal(context.groupHKD, null);
      assert.equal('knownGroupSubtotalHKD' in context, false);
      const rendered = contextMarkup(renderBusiness(context));
      assert.match(rendered, /The whole-outing estimate is incomplete for 3 people/);
      assert.doesNotMatch(rendered, /HK\$/);
    }
  }
});

test('either unavailable or malformed required total makes the entire context incomplete', () => {
  for (const key of ['perPersonHKD', 'groupHKD'] as const) {
    for (const value of [null, undefined, NaN, Infinity, -1]) {
      const option = { ...optionFor('hk'), [key]: value } as OutingOption;
      const context = createSpendingContext(option, 2)!;
      assert.equal(context.perPersonHKD, null);
      assert.equal(context.groupHKD, null);
    }
  }
});

test('zero is a valid complete whole-outing engine total in both cities', () => {
  const fixture = structuredClone(illustrativeData);
  [...fixture.local.costs, ...fixture.shenzhen.costs].forEach(cost => { cost.amount = 0; });
  Object.values(fixture.local.origins).forEach(origin => { origin.fareEachWayHKD = 0; });
  Object.values(fixture.shenzhen.routes).forEach(route => {
    route.destinationFareEachWayCNY = 0;
    Object.values(route.origins).forEach(origin => { origin.fareEachWayHKD = 0; });
  });
  for (const city of ['hk', 'sz'] as const) {
    const context = createSpendingContext(optionFor(city, 2, fixture, {
      hkMealPerPersonHKD: 0, szMealPerPersonCNY: 0,
    }), 2)!;
    assert.equal(context.perPersonHKD, 0);
    assert.equal(context.groupHKD, 0);
    const rendered = contextMarkup(renderBusiness(context));
    assert.match(rendered, /HK\$0\.00 per person/);
    assert.match(rendered, /HK\$0\.00 for 2 people/);
    assert.doesNotMatch(rendered, /incomplete/);
  }
});

test('invalid party counts cannot fabricate a valid display context', () => {
  for (const partySize of [0, -1, 1.5, 7, NaN, Infinity]) {
    assert.equal(createSpendingContext(optionFor('hk'), partySize), null);
  }
});

test('context is an immutable whitelist without private notes, inputs or business outputs', () => {
  const option = freeze({
    ...optionFor('sz'),
    notes: 'private old note',
    inputs: { ...defaultInputs, note: 'private input' },
    revenue: 900,
    wages: 100,
    profit: 800,
    allocations: { worker: 50, community: 20, business: 30 },
  });
  const before = structuredClone(option);
  const context = createSpendingContext(option, 2)!;
  assert.deepEqual(Object.keys(context).sort(), ['cityId', 'dataStatus', 'groupHKD', 'partySize', 'perPersonHKD', 'scope']);
  assert.equal(Object.isFrozen(context), true);
  assert.throws(() => Object.assign(context, { groupHKD: 1 }), TypeError);
  assert.deepEqual(option, before);
  assert.notEqual(createSpendingContext(option, 2), context);
  assert.doesNotMatch(JSON.stringify(context), /private|notes|inputs|revenue|wages|profit|allocation|lineItems|score/);
});

test('business landing labels both cities, party counts and whole-outing evidence limits', () => {
  for (const [city, partySize, label] of [['hk', 1, 'Hong Kong'], ['sz', 3, 'Shenzhen']] as const) {
    const context = createSpendingContext(optionFor(city, partySize), partySize)!;
    const html = renderBusiness(context);
    assert.match(html, /<h1 tabindex="-1">What does tonight’s spending tell us about who gained\?<\/h1>/);
    const rendered = contextMarkup(html);
    assert.match(rendered, new RegExp(`Illustrative ${label} evening`));
    assert.ok(rendered.includes(`HK$${context.perPersonHKD!.toFixed(2)} per person`));
    assert.ok(rendered.includes(`HK$${context.groupHKD!.toFixed(2)} for ${partySize} ${partySize === 1 ? 'person' : 'people'} (HKD)`));
    assert.match(rendered, /dinner, drinks and return travel/);
    assert.match(rendered, /modeled customer spending across the whole outing, including transport/);
    assert.match(rendered, /haven’t verified any restaurant’s wages, costs, ownership or profit/);
    assert.doesNotMatch(rendered, /Research scaffold/);
  }
});

test('a generic business visit invents no selected city or spending amount', () => {
  const html = renderBusiness();
  assert.match(html, /What does tonight’s spending tell us about who gained\?/);
  assert.match(html, /Research scaffold, not a completed market study/);
  assert.doesNotMatch(html, /spending-context|Illustrative Hong Kong evening|Illustrative Shenzhen evening/);
});

test('default desk remains the evidence library and retains the source links', () => {
  const html = renderToStaticMarkup(createElement(EvidenceDesk, {
    onBack: () => {}, spendingContext: createSpendingContext(optionFor('hk'), 2),
  }));
  assert.match(html, /What do we actually know\?/);
  assert.match(html, /aria-label="Search evidence"/);
  assert.match(html, /https:\/\/www\.immd\.gov\.hk\/eng\/contactus\/control_points\.html/);
  assert.match(html, /https:\/\/www\.mtr\.com\.hk\/en\/customer\/jp\/index\.php/);
  assert.match(html, /Return to your evening/);
  assert.doesNotMatch(html, /spending-context|business-pool-boundary/);
});

test('all three business questions and the independent fixed pool stay identical across outing contexts', () => {
  const generic = renderBusiness();
  const labMarkup = (html: string) => html.match(/<details class="surplus-lab">([\s\S]*?)<\/details>/)?.[0];
  const initialLab = labMarkup(generic);
  assert.ok(initialLab);
  assert.match(initialLab, /Hypothetical pool · HKD/);
  assert.match(initialLab, /value="120"/);
  assert.match(initialLab, /HK\$60\.00/);
  assert.match(initialLab, /HK\$24\.00/);
  assert.match(initialLab, /HK\$36\.00/);
  for (const city of ['hk', 'sz'] as const) {
    const html = renderBusiness(createSpendingContext(optionFor(city, 6), 6));
    assert.equal(labMarkup(html), initialLab);
    assert.match(html, /What explains the price\?/);
    assert.match(html, /Who keeps the margin\?/);
    assert.match(html, /What might change\?/);
    assert.match(html, /The fixed-pool exercise below is a separate hypothetical amount\. It is not calculated from this outing estimate\./);
  }
});
