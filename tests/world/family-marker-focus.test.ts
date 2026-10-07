import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { familyFraming, familyGap, familyMarkerTabIndex } from '../../src/world/family-framing';
import { cameraFor } from '../../src/world/geometry';
import { getScene } from '../../src/world/scene-registry';

test('unrevealable initial Family clock is excluded while visible controls remain named and available', () => {
  const scene = getScene('hk-home'), player = scene.playerStart, clock = scene.points[0];
  for (const width of [360,390]) {
    const scale = 844 / 941, gap = familyGap(scene.playerBodyHeight, scene.playerBodyHeight * .42, width, scale);
    const friend = { x: player.x - gap, y: player.y - 6 }, child = { x: player.x - gap * 1.8, y: player.y + 4 };
    const frame = familyFraming(scene.playerBodyHeight, 'right', player, friend, child);
    const camera = cameraFor(width, 844, frame.center, [...frame.points, clock]);
    assert.ok(camera.left + clock.x * scale + 22 < 0);
    assert.equal(familyMarkerTabIndex(clock, camera, { width, height: 844 }), -1);
    for (const anchor of frame.points) { const x = camera.left + anchor.x * scale; assert.ok(x >= 26 - 1e-7 && x <= width - 26 + 1e-7); }
  }
  const app = readFileSync(new URL('../../src/world/WorldApp.tsx', import.meta.url), 'utf8');
  assert.match(app, /className="world-inspect-control"/); assert.match(app, /className="world-edge-cues"/);
  assert.match(app, /tabIndex=\{familyFrame \? familyMarkerTabIndex\(point, camera, size\) : undefined\}/);
  assert.match(app, /tabIndex=\{familyFrame \? familyMarkerTabIndex\(exit\.doorAnchor \?\? exit, camera, size\) : undefined\}/);
});

test('only wholly offscreen physical markers lose family Tab entry, not visible or partly intersecting markers', () => {
  const camera = { scale: 1, left: 0, top: 0, width: 1672, height: 941 }, viewport = { width: 360, height: 844 };
  for (const point of [{ x: -22, y: 400 }, { x: 382, y: 400 }, { x: 180, y: -22 }, { x: 180, y: 866 }]) assert.equal(familyMarkerTabIndex(point, camera, viewport), -1);
  for (const point of [{ x: -21, y: 400 }, { x: 381, y: 400 }, { x: 180, y: -21 }, { x: 180, y: 865 }, { x: 180, y: 400 }]) assert.equal(familyMarkerTabIndex(point, camera, viewport), 0);
});

test('walking to the physical clock makes it a normal native Tab target without panning anyone out', () => {
  const scene = getScene('hk-home'), player = scene.points[0].approach!, clock = scene.points[0];
  for (const width of [360,390]) {
    const scale = 844 / 941, gap = familyGap(scene.playerBodyHeight, scene.playerBodyHeight * .42, width, scale);
    const frame = familyFraming(scene.playerBodyHeight, 'left', player, { x: player.x + gap, y: player.y - 6 }, { x: player.x + gap * 1.8, y: player.y + 4 });
    const camera = cameraFor(width, 844, frame.center, [...frame.points, clock]);
    assert.equal(familyMarkerTabIndex(clock, camera, { width, height: 844 }), 0);
    for (const anchor of frame.points) { const x = camera.left + anchor.x * scale; assert.ok(x >= 26 - 1e-7 && x <= width - 26 + 1e-7); }
  }
});
