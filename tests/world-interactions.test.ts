import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { WORLD_CONTENT } from '../src/world/interactions/content';
import { WorldDiagram } from '../src/world/interactions/diagrams';
import { WorldInteraction } from '../src/world/interactions/panel';
import { changeChoice, clockHands, clockMinute, learningSchedule, mortgageAllocation, sceneContent, sceneNumbers, selectedVariant } from '../src/world/interactions/model';
import { PARTY_IDS, SCENE_IDS } from '../src/world/types';
import type { InteractionValues, SceneId, WorldContext } from '../src/world/types';

const context: WorldContext = Object.freeze({ party: 'two-friends', day: 'weekend', scenario: 'fieldtrip' });
const noop = () => {};
const render = (sceneId: SceneId, values: InteractionValues = {}, withContext = context) => renderToStaticMarkup(createElement(WorldInteraction, { sceneId, interactionId: sceneId, context: withContext, values, onChange: noop, onClose: noop }));
const diagram = (scene: SceneId, choice: string) => renderToStaticMarkup(createElement(WorldDiagram, { scene, choice }));
const tags = (html: string, element: string) => html.match(new RegExp(`<${element}\\b[^>]*>`, 'g')) ?? [];
const attr = (tag: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1];

for (const id of SCENE_IDS) {
  test(`${id}: every authored choice changes diagram geometry and exposes one native selection`, () => {
    const action = sceneContent(id).action;
    const diagrams: string[] = [];
    for (const choice of action.input.choices) {
      const html = render(id, { choice: choice.value });
      const radios = tags(html, 'input');
      assert.equal(radios.length, action.input.choices.length);
      assert.ok(radios.every(tag => attr(tag, 'type') === 'radio'));
      assert.equal(new Set(radios.map(tag => attr(tag, 'name'))).size, 1);
      assert.deepEqual(radios.filter(tag => /\bchecked=""/.test(tag)).map(tag => attr(tag, 'value')), [choice.value]);
      assert.equal(tags(html, 'fieldset').length, 1);
      assert.equal(tags(html, 'legend').length, 1);
      assert.equal(tags(html, 'svg').length, 1);
      assert.equal(attr(tags(html, 'svg')[0], 'role'), 'img');
      assert.ok((attr(tags(html, 'svg')[0], 'aria-label')?.length ?? 0) > 30);
      assert.ok(tags(html, 'details').every(tag => !/\bopen(?:=|\s|>)/.test(tag)), 'Evidence must start collapsed.');
      assert.equal((html.match(/role="status"/g) ?? []).length, 1);
      assert.ok(!html.includes('role="dialog"'), 'The shell already owns the dialog.');
      assert.ok(!html.includes(`<p>${sceneContent(id).thought}</p>`), 'Do not repeat the shell introduction.');
      assert.ok((html.match(/data-world-number=/g) ?? []).length <= 2);
      assert.ok(!tags(html, 'a').some(tag => attr(tag, 'rel') !== 'noopener noreferrer'));
      const markup = diagram(id, choice.value);
      // Remove wording to prove this is a diagram change, not a text-only toggle.
      diagrams.push(markup.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, '').replace(/<figcaption>[\s\S]*?<\/figcaption>/g, '').replace(/(?:aria-label|data-[\w-]+)="[^"]*"/g, ''));
    }
    assert.equal(new Set(diagrams).size, action.input.choices.length);
  });
  test(`${id}: choice changes and context never mutate other values or price a party`, () => {
    const action = sceneContent(id).action;
    const existing = Object.freeze({ choice: action.input.defaultValue, notebook: true, customValue: 17 });
    const untouched = Object.freeze({ choice: 'do-not-touch' });
    const valuesByScene = Object.freeze({ [id]: existing, unrelated: untouched });
    const before = JSON.stringify({ valuesByScene, context, content: WORLD_CONTENT });
    for (const choice of action.input.choices) {
      const changed = changeChoice(id, existing, choice.value);
      assert.notEqual(changed, existing);
      assert.equal(changed.notebook, true);
      assert.equal(changed.customValue, 17);
      assert.equal(changed.choice, choice.value);
      assert.deepEqual(Object.keys(changed).sort(), ['choice', 'customValue', 'notebook']);
      assert.deepEqual(sceneNumbers(id, choice.value), action.variants.find(v => v.value === choice.value)!.keyNumbers);
      const baseline = render(id, changed);
      for (const party of PARTY_IDS) for (const day of ['weekday', 'weekend'] as const) for (const scenario of ['fieldtrip', 'daily-life', 'housing'] as const) {
        assert.equal(render(id, changed, { party, day, scenario }), baseline);
      }
    }
    assert.equal(JSON.stringify({ valuesByScene, context, content: WORLD_CONTENT }), before);
    assert.equal(valuesByScene.unrelated, untouched);
    assert.equal(selectedVariant(id, {}).value, action.input.defaultValue);
    assert.equal(selectedVariant(id, { choice: 'invalid-saved-choice' }).value, action.input.defaultValue);
    assert.throws(() => changeChoice(id, existing, 'invalid-choice'), RangeError);
    assert.throws(() => sceneNumbers(id, 'invalid-choice'), RangeError);
  });
}

test('all twelve mechanisms remain distinct, short and publicly bounded', () => {
  assert.deepEqual(Object.keys(WORLD_CONTENT.scenes), [...SCENE_IDS]);
  const kinds = new Set<string>();
  const publicHosts = new Set(['www.mtr.com.hk', 'www.immd.gov.hk', 'www.consumer.org.hk', 'www.sf-express.com', 'www.linkreit.com', 'www1.hkexnews.hk', 'pnr.sz.gov.cn', 'www.sz.gov.cn', 'www.ifec.org.hk', 'www.stats.gov.cn', 'app.www.gov.cn']);
  for (const id of SCENE_IDS) {
    const scene = sceneContent(id);
    assert.ok(scene.thought.trim().split(/\s+/).length <= 35);
    for (const variant of scene.action.variants) {
      assert.ok(variant.thought.trim().split(/\s+/).length <= 35);
      assert.ok(variant.keyNumbers.length <= 2);
      assert.ok(scene.action.unknowns.length > 0);
    }
    const svg = diagram(id, scene.action.input.defaultValue);
    kinds.add(attr(tags(svg, 'figure')[0], 'data-mechanism')!);
    for (const source of scene.action.publicSources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(publicHosts.has(url.hostname), source.url);
      assert.ok(source.supports && source.limit);
    }
  }
  assert.equal(kinds.size, 12);
  assert.match(WORLD_CONTENT.setup.guardrail, /child fare treatment remains unknown/);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../src/world/interactions/content.ts', import.meta.url))).digest('hex'), '67f9201b86b2b80487920ca1d00cd7cf31235c2cecafc25e26f8c9ebe7269f98');
});

test('parcel additional arithmetic has exactly the disclosed difference and its own common unit', () => {
  const local = sceneNumbers('parcel-counter', 'already-going'), dedicated = sceneNumbers('parcel-counter', 'dedicated-trip');
  assert.deepEqual(local.map(n => n.value), [16, 20]);
  assert.deepEqual(dedicated.map(n => n.value), [116, 160]);
  assert.equal(Number(dedicated[0].value) - Number(local[0].value), 100);
  assert.equal(Number(dedicated[1].value) - Number(local[1].value), 140);
  assert.equal(local[0].unit, 'CNY-equivalent');
  assert.equal(dedicated[0].unit, 'CNY-equivalent');
  assert.ok(!/<dl class="wi-numbers"[\s\S]*?<\/dl>/.exec(render('parcel-counter'))![0].includes('HKD')); 
});

test('every numeric choice is visibly marked illustrative beside its results before collapsed evidence', () => {
  for (const id of SCENE_IDS) for (const choice of sceneContent(id).action.input.choices) {
    const numbers = sceneNumbers(id, choice.value);
    const visible = render(id, { choice: choice.value }).split('<details')[0];
    if (!numbers.length) { assert.ok(!visible.includes('wi-example-caption')); continue; }
    const money = numbers.some(number => number.unit === 'HKD' || number.unit === 'CNY-equivalent');
    const caption = money ? 'Illustrative example · not a price quote' : 'Illustrative timing';
    assert.ok(visible.includes(`<span class="wi-example-caption">${caption}</span><dl class="wi-numbers"`), `${id} / ${choice.value}`);
    assert.ok((visible.match(/data-world-number=/g) ?? []).length <= 2);
  }
  const css = readFileSync(new URL('../src/world/interactions/interactions.css', import.meta.url), 'utf8');
  assert.match(css, /\.wi-example-caption\s*\{[^}]*font-size:12px/);
});

test('clock hands show 22:30 or 23:30 without simulating elapsed time', () => {
  assert.equal(clockMinute('hk-home', 'earlier'), 1350);
  assert.equal(clockMinute('hk-home', 'later'), 1410);
  const earlier = clockHands(1350), later = clockHands(1410);
  assert.deepEqual(earlier.minute, later.minute);
  assert.ok(Math.abs(earlier.minute.y - 127) < 1e-9);
  assert.ok(Math.abs(earlier.hour.x - (85 - 37 / Math.sqrt(2))) < 1e-9);
  assert.ok(Math.abs(later.hour.x - (85 - 37 * Math.sin(Math.PI / 12))) < 1e-9);
  assert.deepEqual(sceneNumbers('hk-home', 'earlier').map(n => n.value), ['22:30']);
  assert.deepEqual(sceneNumbers('hk-home', 'later').map(n => n.value), ['23:30']);
});

test('rental stack area retains the real 1:2 relationship as deposit becomes a claim', () => {
  for (const choice of ['cash-out', 'claims']) {
    const rects = tags(diagram('rental-home', choice), 'rect');
    const rent = rects.find(t => attr(t, 'data-money-role') === 'rent')!;
    const deposit = rects.find(t => attr(t, 'data-money-role') === 'deposit')!;
    assert.equal(Number(attr(deposit, 'width')) * Number(attr(deposit, 'height')), 2 * Number(attr(rent, 'width')) * Number(attr(rent, 'height')));
    assert.deepEqual(sceneNumbers('rental-home', choice).map(n => n.value), [6000, 12000]);
    assert.match(diagram('rental-home', choice), /subject to/);
  }
});

test('mortgage shows payment allocation honestly and never exaggerates a debt-bar change', () => {
  assert.deepEqual(mortgageAllocation(), { initialDebt: 2400000, payment: 12000, interest: 8000, principal: 4000, remainingDebt: 2396000, interestShare: 2 / 3, principalShare: 1 / 3 });
  for (const choice of ['payment', 'asset']) {
    const html = diagram('luxury-home', choice);
    const parts = tags(html, 'rect').filter(t => attr(t, 'data-payment-part'));
    assert.equal(parts.length, 2);
    assert.equal(Number(attr(parts[0], 'width')), 200);
    assert.equal(Number(attr(parts[1], 'width')), 100);
    assert.ok(!html.includes('wi-debt-old'));
    assert.ok(!html.includes('data-total-debt'));
  }
  assert.deepEqual(sceneNumbers('luxury-home', 'payment').map(n => n.value), [8000, 4000]);
  assert.deepEqual(sceneNumbers('luxury-home', 'asset').map(n => n.value), [4000]);
  assert.match(diagram('luxury-home', 'asset'), /Future value\?/);
  assert.match(diagram('luxury-home', 'asset'), /total debt is not drawn to scale/);
});

test('one shared schedule scale fixes arrival while moving only the class and gap', () => {
  const early = learningSchedule('earlier'), late = learningSchedule('later');
  assert.equal(early.finish, 1080); assert.equal(early.arrival, 1125); assert.equal(early.classStart, 1110); assert.equal(late.classStart, 1170);
  assert.equal(early.arrivalX, late.arrivalX); assert.equal(early.arrivalX, 144);
  assert.equal(early.classX, 108); assert.equal(late.classX, 252);
  const pixelsPerMinute = (early.endX - early.finishX) / 120;
  assert.equal(early.arrivalX - early.classX, 15 * pixelsPerMinute);
  assert.equal(late.classX - late.arrivalX, 45 * pixelsPerMinute);
  assert.deepEqual(sceneNumbers('learning-center', 'earlier').map(n => n.value), ['18:45', 15]);
  assert.deepEqual(sceneNumbers('learning-center', 'later').map(n => n.value), ['18:45', 45]);
  assert.throws(() => learningSchedule('invented'), RangeError);
});

test('unknown gates and leases are never promoted to known or permitted by a toggle', () => {
  for (const choice of ['crossing', 'whole-trip']) {
    const gates = tags(diagram('border-arrival', choice), 'g').filter(t => attr(t, 'data-gate'));
    assert.equal(gates.length, choice === 'crossing' ? 1 : 4);
    assert.ok(gates.every(tag => attr(tag, 'data-status') === 'not-checked'));
  }
  const visible = diagram('office-floor', 'visible'), leases = diagram('office-floor', 'leases');
  assert.equal((visible.match(/data-observed="true"/g) ?? []).length, 2, 'One corridor and one room only.');
  assert.equal((leases.match(/data-observed="true"/g) ?? []).length, 0);
  for (const html of [visible, leases]) {
    const rooms = tags(html, 'g').filter(t => attr(t, 'data-lease-status'));
    assert.equal(rooms.length, 8);
    assert.ok(rooms.every(t => attr(t, 'data-lease-status') === 'unknown'));
  }
});

test('access is a toy route and planning is a dashed counterfactual without real map pins', () => {
  assert.deepEqual(sceneNumbers('urban-village', 'open').map(n => n.value), [6]);
  assert.deepEqual(sceneNumbers('urban-village', 'closed').map(n => n.value), [14]);
  assert.match(diagram('urban-village', 'closed'), /Toy layout/);
  assert.match(diagram('planning-museum', 'planned'), /is-dashed wi-proposed-link/);
  assert.ok(!diagram('planning-museum', 'current').includes('wi-proposed-link'));
  for (const choice of ['current', 'planned']) {
    assert.match(diagram('planning-museum', choice), /not Hong Kong or Shenzhen geography/);
    assert.deepEqual(sceneNumbers('planning-museum', choice), []);
  }
});

test('interaction source has no storage, demographic arithmetic, asynchronous number animation or legacy imports', () => {
  const dir = new URL('../src/world/interactions/', import.meta.url);
  const source = readdirSync(dir).filter(name => /\.(?:ts|tsx|css)$/.test(name) && name !== 'content.ts').map(name => readFileSync(new URL(name, dir), 'utf8')).join('\n');
  assert.doesNotMatch(source, /localStorage|sessionStorage|setInterval|requestAnimationFrame|Date\.now|fetch\(/);
  assert.doesNotMatch(source, /from ['"][^'"]*(?:domain|decision|story|legacy)/);
  assert.doesNotMatch(source, /context\.party|context\.day|context\.scenario/);
  const css = readFileSync(new URL('interactions.css', dir), 'utf8');
  assert.match(css, /\.wi-choices label\s*\{[^}]*min-height:44px/);
  assert.match(css, /\.wi-visual text\s*\{[^}]*font:16px/);
  assert.match(css, /\.wi-figure figcaption\s*\{[^}]*font-size:12px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /animation:none!important; transition:none!important/);
});
