import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfficeWorkweek } from '../../src/world/interactions/OfficeWorkweek';
import { OFFICE_WORKWEEK, officeWorkweek, readOfficeWorkweek, setOfficeDays, setOfficeMeasure } from '../../src/world/interactions/office-workweek';
import { initialWorldState, worldReducer } from '../../src/world/model';
import { PARTY_IDS } from '../../src/world/types';
import type { InteractionValues, WorldContext } from '../../src/world/types';

const context: WorldContext = { party: 'two-friends', day: 'weekend', scenario: 'fieldtrip' };
const noop = () => undefined;
const props = (values: InteractionValues = {}, withContext = context) => ({ sceneId: 'office-floor' as const, interactionId: 'office-floor', context: withContext, values, onChange: noop, onClose: noop });
const render = (values: InteractionValues = {}, withContext = context) => renderToStaticMarkup(createElement(OfficeWorkweek, props(values, withContext)));
const tags = (html: string, name: string) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
const attr = (tag: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1];

test('fixed four-week return allowances produce the independently specified totals', () => {
  assert.deepEqual(OFFICE_WORKWEEK, { weeks: 4, hongKong: { minutesPerReturn: 90, hkdPerReturn: 40 }, shenzhen: { minutesPerReturn: 210, hkdPerReturn: 100 } });
  assert.deepEqual(officeWorkweek(2), { returns: 8, hongKong: { hours: 12, hkd: 320 }, shenzhen: { hours: 28, hkd: 800 } });
  assert.deepEqual(officeWorkweek(4), { returns: 16, hongKong: { hours: 24, hkd: 640 }, shenzhen: { hours: 56, hkd: 1600 } });
  assert.ok(Object.isFrozen(OFFICE_WORKWEEK) && Object.isFrozen(OFFICE_WORKWEEK.hongKong) && Object.isFrozen(OFFICE_WORKWEEK.shenzhen));
  for (const value of [0, 3, 5, NaN, Infinity]) assert.throws(() => officeWorkweek(value as never), RangeError);
});

test('malformed and old lens values cannot alter the fixed scope or local defaults', () => {
  const malformed: InteractionValues[] = [{}, { choice: 'leases', party: 'family', weeks: 52 }, { officeWorkweekDays: '4', officeWorkweekMeasure: 'HKD' }, { officeWorkweekDays: 99, officeWorkweekMeasure: null }];
  for (const values of malformed) {
    assert.deepEqual(readOfficeWorkweek(values), { days: 2, measure: 'time' });
  }
  assert.deepEqual(readOfficeWorkweek({ officeWorkweekDays: 4, officeWorkweekMeasure: 'money' }), { days: 4, measure: 'money' });
});

test('native control transitions preserve unrelated values without mutating input', () => {
  const original = Object.freeze({ choice: 'leases', notebook: true, homeDeadline: 'earlier', officeWorkweekMeasure: 'money' });
  const four = setOfficeDays(original, 4), two = setOfficeDays(four, 2), time = setOfficeMeasure(four, 'time');
  assert.deepEqual(four, { ...original, officeWorkweekDays: 4 });
  assert.deepEqual(two, { ...original, officeWorkweekDays: 2 });
  assert.deepEqual(time, { ...original, officeWorkweekDays: 4, officeWorkweekMeasure: 'time' });
  assert.deepEqual(original, { choice: 'leases', notebook: true, homeDeadline: 'earlier', officeWorkweekMeasure: 'money' });
  assert.throws(() => setOfficeDays(original, 3 as never), RangeError);
  assert.throws(() => setOfficeMeasure(original, 'combined' as never), RangeError);
});

test('world values action changes only this office notebook and conserves other scene decisions', () => {
  const initial = initialWorldState();
  const home = { homeDeadline: 'earlier' }, parcel = { parcelMethod: 'delivery' };
  const state = { ...initial, values: { 'hk-home': home, 'parcel-counter': parcel } };
  const updated = worldReducer(state, { type: 'values', interactionId: 'office-floor', values: setOfficeDays({}, 4) });
  assert.equal(updated.values['hk-home'], home); assert.equal(updated.values['parcel-counter'], parcel);
  assert.equal(updated.context, state.context);
  assert.deepEqual(updated.values['office-floor'], { officeWorkweekDays: 4 });
  assert.deepEqual(state.values, { 'hk-home': home, 'parcel-counter': parcel });
});

test('both measures keep exactly two headline values and true fixed-scale SVG lengths', () => {
  for (const days of [2, 4] as const) for (const measure of ['time', 'money'] as const) {
    const html = render({ officeWorkweekDays: days, officeWorkweekMeasure: measure });
    const values = [...html.matchAll(/<strong>([\d,]+)<\/strong><span>(hours|HKD)<\/span>/g)].map(match => [match[1], match[2]]);
    const expected = measure === 'time' ? days === 2 ? ['12', '28'] : ['24', '56'] : days === 2 ? ['320', '800'] : ['640', '1,600'];
    assert.deepEqual(values, expected.map(value => [value, measure === 'time' ? 'hours' : 'HKD']));
    assert.equal((html.match(/data-world-number=/g) ?? []).length, 2);
    const rects = tags(html, 'rect');
    const widths = rects.filter(tag => attr(tag, 'data-office-route')).map(tag => Number(attr(tag, 'width')));
    assert.deepEqual(widths, measure === 'time' ? days === 2 ? [72, 168] : [144, 336] : days === 2 ? [67.2, 168] : [134.4, 336]);
    assert.deepEqual(rects.filter(tag => attr(tag, 'data-office-track')).map(tag => Number(attr(tag, 'width'))), [336, 336]);
    assert.equal(new Set(rects.filter(tag => attr(tag, 'data-office-route')).map(tag => attr(tag, 'x'))).size, 1);
    assert.ok(html.includes(`fixed zero to ${measure === 'time' ? 56 : 1600}`));
  }
});

test('calendar contains 28 equal positive-area cells and marks exactly 8 or 16 returns', () => {
  for (const days of [2, 4] as const) {
    const cells = tags(render({ officeWorkweekDays: days }), 'rect').filter(tag => attr(tag, 'data-office-cell'));
    assert.equal(cells.length, 28); assert.equal(cells.filter(tag => attr(tag, 'data-office-return') === 'true').length, days * 4);
    assert.deepEqual([...new Set(cells.map(tag => [attr(tag, 'width'), attr(tag, 'height')].join(',')))], ['24,16']);
    assert.equal(new Set(cells.map(tag => attr(tag, 'x'))).size, 7); assert.equal(new Set(cells.map(tag => attr(tag, 'y'))).size, 4);
    for (const cell of cells) assert.equal(attr(cell, 'data-office-return'), String(Number(attr(cell, 'data-office-cell')!.split('-')[1]) < days));
  }
});

test('native day radios and measure select expose state, one live result and optional diagram/evidence', () => {
  const html = render({ officeWorkweekDays: 4, officeWorkweekMeasure: 'money' });
  const inputs = tags(html, 'input'); assert.equal(inputs.length, 2);
  assert.ok(inputs.every(tag => attr(tag, 'type') === 'radio'));
  assert.equal(new Set(inputs.map(tag => attr(tag, 'name'))).size, 1);
  assert.deepEqual(inputs.filter(tag => /\bchecked=""/.test(tag)).map(tag => attr(tag, 'value')), ['4']);
  assert.equal(tags(html, 'fieldset').length, 1); assert.equal(tags(html, 'legend').length, 1);
  assert.equal(tags(html, 'select').length, 1); assert.equal(attr(tags(html, 'select')[0]!, 'aria-label'), 'Compare travel');
  assert.deepEqual(tags(html, 'option').filter(tag => /\bselected=""/.test(tag)).map(tag => attr(tag, 'value')), ['money']);
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.equal(tags(html, 'details').length, 2); assert.ok(tags(html, 'details').every(tag => !/\bopen=/.test(tag)));
  assert.ok(html.includes('Fictional four weeks · one adult commuter'));
  assert.ok(html.includes('Same Hong Kong job and pay.'));
  assert.ok(html.indexOf('data-world-number=') < html.indexOf('<details'), 'Primary results precede both optional disclosures.');
  assert.ok(html.includes('Actual fares, routes, queues, rent, eligibility and building occupancy are unknown.'));
  assert.ok(!html.includes('data-floor-part') && !html.includes('data-lease-status'));
});

test('one adult arithmetic is invariant across all party, day and scenario contexts', () => {
  for (const days of [2, 4] as const) for (const measure of ['time', 'money'] as const) {
    const values = { officeWorkweekDays: days, officeWorkweekMeasure: measure }, baseline = render(values);
    for (const party of PARTY_IDS) for (const day of ['weekday', 'weekend'] as const) for (const scenario of ['fieldtrip', 'daily-life', 'housing'] as const) assert.equal(render(values, { party, day, scenario }), baseline);
  }
});

test('office source keeps arithmetic local and wrapper hook contract independent', () => {
  const root = new URL('../../src/world/interactions/', import.meta.url);
  const model = readFileSync(new URL('office-workweek.ts', root), 'utf8'), component = readFileSync(new URL('OfficeWorkweek.tsx', root), 'utf8');
  const wrapper = readFileSync(new URL('index.tsx', root), 'utf8');
  assert.match(model, /returns = days \* OFFICE_WORKWEEK.weeks/);
  assert.match(model, /hours: returns \* daily.minutesPerReturn \/ 60/);
  assert.match(model, /hkd: returns \* daily.hkdPerReturn/);
  assert.doesNotMatch(model + component, /context\.|localStorage|sessionStorage|fetch\(|Date\.|setInterval|requestAnimationFrame|useEffect|useState|wallet|from ['"][^'"]*(?:decisions|domain|business)/);
  assert.doesNotMatch(wrapper, /\buse[A-Z]\w*\(/);
  assert.match(wrapper, /if \(props.sceneId === 'office-floor'\) return <OfficeWorkweek \{\.\.\.props\}\/>/);
});

test('actual WorldInteraction route renders the workweek instead of the preserved generic lens', async () => {
  registerHooks({ load(url, context, nextLoad) { if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }; return nextLoad(url, context); } });
  const { WorldInteraction } = await import('../../src/world/interactions/index');
  const html = renderToStaticMarkup(createElement(WorldInteraction, props({ officeWorkweekDays: 4 })));
  assert.ok(html.includes('data-mechanism="office-workweek"'));
  assert.ok(!html.includes('floor-coverage') && !html.includes('What is leased'));
});
