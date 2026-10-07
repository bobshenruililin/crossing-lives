import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { hkSzMap, gbaMap, mapProvenance } from '../src/world/regional-map/map-data';
import { cityTimeline } from '../src/world/regional-map/timeline-data';
import { boundarySourceGeoJson } from '../src/world/regional-map/boundary-source';
import { linePath, mapSelection, polygonPath, selectPlace, selectRegion, selectStage } from '../src/world/regional-map/map-adapter';

registerHooks({ load(url, context, nextLoad) { if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }; return nextLoad(url, context); } });
const { RegionalMapDiscovery } = await import('../src/world/regional-map/RegionalMapDiscovery');
const render = (values = {}) => renderToStaticMarkup(createElement(RegionalMapDiscovery, { values, onChange: () => undefined }));

test('invalid restored values fall back safely without overwriting unrelated fields', () => {
  const original = { mapRegion: 'bad', mapChapter: 'unknown', mapLocalPlace: 'fictional', other: 19 };
  const selected = mapSelection(original);
  assert.equal(selected.region, 'hk-sz'); assert.equal(selected.stageIndex, 0); assert.equal(selected.point.id, 'luohu');
  assert.deepEqual(original, { mapRegion: 'bad', mapChapter: 'unknown', mapLocalPlace: 'fictional', other: 19 });
  assert.equal(selectStage(original, 2).other, 19);
  assert.equal(selectStage(original, Infinity).mapChapter, 'early-gateways');
  assert.equal(selectStage(original, -5).mapChapter, 'early-gateways');
  assert.equal(selectStage(original, 99).mapChapter, 'polycentric-plan');
});

test('four chapters select a fixed sourced place and retain the same geography', () => {
  const expected = ['luohu', 'futian', 'qianhai', 'nanshan'];
  expected.forEach((place, index) => {
    const selection = mapSelection(selectStage({}, index));
    assert.equal(selection.point.id, place); assert.equal(selection.map, hkSzMap);
    assert.ok(selection.stage.callout.split(/\s+/).length <= 35);
  });
  assert.match(cityTimeline.stages[2].status, /not a completion date/);
  assert.match(cityTimeline.stages[3].status, /not a measured outcome/);
});

test('regional and local place choices persist independently, unknown points cannot be introduced', () => {
  let values = selectPlace({}, 'lok-ma-chau');
  values = selectRegion(values, 'gba');
  assert.equal(mapSelection(values).point.id, 'hong-kong');
  values = selectPlace(values, 'macau');
  assert.equal(mapSelection(values).point.name, 'Macao');
  assert.equal(mapSelection(selectRegion(values, 'hk-sz')).point.id, 'lok-ma-chau');
  assert.equal(selectPlace(values, 'invented-point'), values);
});

test('map coordinate adapter preserves source orientation, aspect and source pin coordinates', () => {
  assert.deepEqual(hkSzMap.viewBox, [0, 0, 1000, 790]);
  assert.deepEqual(gbaMap.viewBox, [0, 0, 1000, 751]);
  assert.equal(linePath([[.25, .5], [1, 0]], hkSzMap.viewBox), 'M250.000,395.000 L1000.000,0.000');
  assert.equal(polygonPath([[[0, 0], [.5, 1], [1, 0]]], hkSzMap.viewBox), 'M0.000,0.000 L500.000,790.000 L1000.000,0.000 Z');
  const point = (id: string) => hkSzMap.points.find(item => item.id === id)!;
  assert.ok(point('luohu').xy[0] > point('futian').xy[0]);
  assert.ok(point('futian').xy[0] > point('nanshan').xy[0]);
  assert.equal(gbaMap.points.length, 11);
});

test('every render has one active HTML label, all place anchors and a plan/historical caveat', () => {
  for (let index = 0; index < 4; index++) {
    const html = render(selectStage({}, index));
    assert.equal((html.match(/data-testid="regional-active-label"/g) ?? []).length, 1);
    assert.equal((html.match(/data-place=/g) ?? []).length, hkSzMap.points.length);
    assert.ok(html.includes('Real geography. Generalized present-day base. The game&#x27;s walking route is fictional.'));
    assert.ok(html.includes('not a reconstruction of historical coastlines'));
    assert.ok(html.includes('aria-pressed="true"'));
    assert.ok(html.includes('aria-live="polite"'));
  }
});

test('GBA shows 11 sourced anchors with one label and no historic timeline', () => {
  const html = render({ mapRegion: 'gba', mapGbaPlace: 'hong-kong' });
  assert.equal((html.match(/data-place=/g) ?? []).length, 11);
  assert.equal((html.match(/data-testid="regional-active-label"/g) ?? []).length, 1);
  assert.equal((html.match(/data-chapter-index=/g) ?? []).length, 0);
  assert.ok(html.includes('viewBox="0 0 1000 751"'));
  assert.ok(html.includes('city/SAR anchors'));
});

test('source files retain ODbL metadata and the interface offers an offline derivative download', () => {
  const boundary = JSON.parse(boundarySourceGeoJson);
  assert.equal(boundary.properties.license, 'ODbL-1.0');
  assert.equal(boundary.geometry.type, 'LineString');
  assert.ok(boundary.properties.wayIds.length >= 60);
  assert.equal(readFileSync(new URL('../public-world/source-data/hk-mainland-land-border-odbl.geojson', import.meta.url), 'utf8'), boundarySourceGeoJson);
  const html = render();
  assert.ok(html.includes('download="hk-mainland-land-border-odbl.geojson"'));
  assert.ok(html.includes('data:application/geo+json;'));
  assert.ok(html.indexOf('© OpenStreetMap contributors · ODbL') < html.indexOf('<details'));
  assert.ok(mapProvenance.absentLayers.includes('Historic coastlines'));
});

test('component adds no storage writes, network loads, routes, flows, animated geography or third-party images', () => {
  const source = readFileSync(new URL('../src/world/regional-map/RegionalMapDiscovery.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage|XMLHttpRequest)\b/);
  assert.doesNotMatch(source, /<img|<image|<animate|markerEnd/);
  assert.equal((render().match(/data-layer="hk-mainland-boundary"/g) ?? []).length, 1);
  const css = readFileSync(new URL('../src/world/regional-map/regional-map.css', import.meta.url), 'utf8');
  assert.match(css, /min-height:44px/);
  assert.match(css, /\.rmd-map-label\{[^}]*font-size:13px/);
  assert.match(css, /prefers-reduced-motion/);
});


test('world museum wrapper exposes sourced regional discovery instead of the generic diagram', async () => {
  const { WorldInteraction } = await import('../src/world/interactions/index');
  const html = renderToStaticMarkup(createElement(WorldInteraction, { sceneId: 'planning-museum', interactionId: 'planning-museum', context: { party: 'two-friends', day: 'weekend', scenario: 'fieldtrip' }, values: {}, onChange: () => undefined, onClose: () => undefined }));
  assert.equal((html.match(/data-testid="regional-active-label"/g) ?? []).length, 1);
  assert.ok(html.includes('© OpenStreetMap contributors'));
  assert.ok(!html.includes('Illustrative network · not city geography'));
});
