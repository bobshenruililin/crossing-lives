import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PHONE_SCENES, geometryProblems, inputProblems, completionProblems, finalRecordingComplete } from '../tests/world-phone/phone-contract.mjs';
const rect = { left: 10, top: 10, right: 70, bottom: 70 };
const viewport = { left: 0, top: 0, right: 390, bottom: 844, x: true, y: true };
test('touch geometry catches viewport, nested per-axis clipping, tiny controls and covered centers', () => {
  assert.deepEqual(geometryProblems({ rect, clips: [viewport], hit: true }, 44), []);
  assert.match(geometryProblems({ rect, clips: [{ ...viewport, right: 60 }] }, 44).join(), /horizontal clipping/);
  assert.match(geometryProblems({ rect, clips: [viewport, { ...viewport, top: 30, x: false }] }, 44).join(), /vertical clipping/);
  assert.deepEqual(geometryProblems({ rect, clips: [viewport, { ...viewport, right: 0, x: false }] }, 44), []);
  assert.match(geometryProblems({ rect: { ...rect, right: 20 }, clips: [viewport], hit: false }, 44).join(), /undersized target.*covered hit point/);
  assert.match(geometryProblems({ rect: { ...rect, left: NaN }, clips: [viewport] }).join(), /invalid/);
});
const goodInput = [...Array.from({ length: 40 }, () => ({ type: 'pointerdown', trusted: true, pointerType: 'touch' })),
  ...['input', 'change'].map(type => ({ type, trusted: false, tag: 'SELECT', label: 'Activity to adjust' }))];
test('trusted input contract rejects keyboard, mouse, hidden synthetic input and undisclosed selects', () => {
  assert.deepEqual(inputProblems(goodInput, 1), []);
  for (const bad of [{ type: 'keydown', trusted: true }, { type: 'pointerdown', pointerType: 'mouse', trusted: true }, { type: 'input', trusted: false, tag: 'INPUT' }]) assert.notDeepEqual(inputProblems([...goodInput, bad], 1), []);
  assert.notDeepEqual(inputProblems(goodInput, 2), []);
  assert.notDeepEqual(inputProblems(goodInput.slice(1), 1), []);
});
const complete = { commit: 'a'.repeat(40), scenes: PHONE_SCENES, durationMs: 350000, doors: Array.from({ length: 11 }, (_, i) => ({ kind: i ? 'visible-door' : 'nearby-enter' })), checkpoints: ['home-taken', 'parcel-delivery-taken', 'lease-b-taken', 'office-complete', 'museum-evidence', 'carried-home-plan'], mapNavigationCount: 0 };
test('complete film needs all rooms, physical route, decisions, exact commit and duration', () => {
  assert.deepEqual(completionProblems(complete), []);
  for (const mutation of [{ commit: 'HEAD' }, { scenes: PHONE_SCENES.slice(0, 11) }, { durationMs: undefined }, { durationMs: null }, { durationMs: NaN }, { durationMs: Infinity }, { durationMs: -Infinity }, { durationMs: '350000' }, { durationMs: 299999 }, { durationMs: 480001 }, { doors: [] }, { checkpoints: complete.checkpoints.slice(1) }, { mapNavigationCount: 1 }]) assert.notDeepEqual(completionProblems({ ...complete, ...mutation }), []);
});
test('phone authoring cannot silently substitute pointer/keyboard/forced navigation for touch', async () => {
  for (const file of ['world-phone-recording.spec.ts', 'phone-touch.ts', 'phone-office.ts']) {
    const source = await readFile(new URL(`../tests/world-phone/${file}`, import.meta.url), 'utf8');
    for (const forbidden of [/\.click\s*\(/, /\.check\s*\(/, /\.focus\s*\(/, /\.keyboard\b/, /\.mouse\b/, /force\s*:\s*true/, /\.scrollIntoViewIfNeeded\s*\(/, /dispatchEvent\s*\(/, /new Image\s*\(/, /\bfetch\s*\(/, /\bmapTo\s*\(/]) assert.doesNotMatch(source, forbidden, `${file} contains forbidden interaction`);
  }
  const config = await readFile(new URL('../playwright.phone.config.ts', import.meta.url), 'utf8');
  assert.match(config, /chromiumSandbox: true/); assert.match(config, /retries: 0/); assert.doesNotMatch(config, /no-sandbox|disable-web-security/);
  const source = await readFile(new URL('../tests/world-phone/world-phone-recording.spec.ts', import.meta.url), 'utf8');
  assert.equal((source.match(/\.selectOption\(/g) ?? []).length, 1);
  assert.match(source, /hasTouch: true/); assert.match(source, /isMobile: true/); assert.match(source, /width: 390, height: 844/);
  assert.match(source, /finally\s*\{/); assert.match(source, /video\.saveAs/); assert.match(source, /phone-tour-trace\.zip/);
});

test('completion metadata requires saved nonempty video and successful trace/context cleanup', () => {
  const saved = { routeCompleted: true, videoSaved: true, videoBytes: 2048, cleanupErrors: [], activeStorage: {}, durableStorage: {} };
  assert.equal(finalRecordingComplete(saved), true);
  for (const bad of [{ routeCompleted: false }, { videoSaved: false }, { videoBytes: 0 }, { videoBytes: NaN }, { cleanupErrors: ['trace stop failed'] }, { cleanupErrors: ['context close failed'] }, { activeStorage: null }, { durableStorage: null }]) assert.equal(finalRecordingComplete({ ...saved, ...bad }), false);
});
