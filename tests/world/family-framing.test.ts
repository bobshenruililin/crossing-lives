import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { familyBodies, familyFraming, familyGap, originalFamilyBodyBounds } from '../../src/world/family-framing';
import { cameraFor, PLANE } from '../../src/world/geometry';
import { clampPoint } from '../../src/world/model';
import { getScene } from '../../src/world/scene-registry';
import { SCENE_IDS } from '../../src/world/types';
import type { SceneId, Point } from '../../src/world/types';

function projected(id: SceneId, width: number, height: number, facing: 'left' | 'right', player: Point, attention?: Point) {
  const scene = getScene(id), scale = Math.max(width / PLANE.width, height / PLANE.height);
  const gap = familyGap(scene.playerBodyHeight, Math.max(60, scene.playerBodyHeight * .42), width, scale);
  const preferred = facing === 'right' ? -1 : 1, needed = gap * 1.8;
  const side = preferred === -1 && player.x - scene.walkArea.left < needed ? 1 : preferred === 1 && scene.walkArea.right - player.x < needed ? -1 : preferred;
  const friend = clampPoint({ x: player.x + side * gap, y: player.y - 6 }, id), child = clampPoint({ x: player.x + side * gap * 1.8, y: player.y + 4 }, id);
  const framing = familyFraming(scene.playerBodyHeight, facing, player, friend, child);
  const camera = cameraFor(width, height, framing.center, [...framing.points, ...(attention ? [attention] : [])]);
  const bodies = familyBodies(scene.playerBodyHeight, facing, player, friend, child).map(b => ({ left: camera.left + b.left * scale, right: camera.left + b.right * scale, top: camera.top + b.top * scale, bottom: camera.top + b.bottom * scale }));
  return { bodies, gap, framing, friend, child };
}

test('actual CI regressions retain every family body after home-left movement and rental arrival', () => {
  const cases = [
    { id: 'hk-home' as const, width: 360, facing: 'left' as const, player: { x: 940, y: 837.49 } },
    { id: 'rental-home' as const, width: 390, facing: 'right' as const, player: { x: 234.08, y: 781.03 } },
  ];
  for (const item of cases) {
    const scene = getScene(item.id), result = projected(item.id, item.width, 844, item.facing, item.player, scene.exits[0].doorAnchor ?? scene.exits[0]);
    assert.ok(result.gap < scene.playerBodyHeight * .42, 'Only an over-wide family formation is compacted.');
    for (const body of result.bodies) {
      assert.ok(body.left >= 26 - 1e-7); assert.ok(body.right <= item.width - 26 + 1e-7);
      assert.ok(body.top >= 0); assert.ok(body.bottom <= 844);
    }
  }
});

test('all three real pose bounds stay onscreen through starts, motion endpoints, edges, object approaches and distant attention', () => {
  for (const id of SCENE_IDS) for (const width of [360,390,1440]) for (const facing of ['left','right'] as const) {
    const scene = getScene(id), height = width === 1440 ? 900 : 844;
    const positions = [scene.playerStart, { x: scene.playerStart.x - 180, y: scene.playerStart.y }, { x: scene.playerStart.x + 180, y: scene.playerStart.y }, { x: scene.walkArea.left, y: scene.playerStart.y }, { x: scene.walkArea.right, y: scene.playerStart.y }, ...scene.points.map(point => point.approach ?? scene.playerStart)];
    for (const position of positions) for (const attention of [undefined, ...scene.points, ...scene.exits]) {
      const result = projected(id, width, height, facing, clampPoint(position, id), attention);
      for (const [index, body] of result.bodies.entries()) {
        assert.ok(body.left >= -1e-7 && body.right <= width + 1e-7, `${id} ${width}px ${facing} actor${index}: ${body.left}..${body.right}`);
        assert.ok(body.top >= -1e-7 && body.bottom <= height + 1e-7);
      }
    }
  }
});

test('family layout keeps authored heights, foot offsets and the original renderer exact', () => {
  const renderer = readFileSync(new URL('../../src/world/WorldSprite.tsx', import.meta.url));
  assert.equal(createHash('sha256').update(renderer).digest('hex'), '549c0c77fd1aae8d7bb85b5582ecd74349131737186d8bc714c4cb8e52ed74b0');
  assert.match(readFileSync(new URL('../../src/world/world.css', import.meta.url), 'utf8'), /transform-origin:52% 50%/);
  for (const facing of ['left','right'] as const) for (const role of ['player','friend'] as const) {
    const height = role === 'player' ? 420 : 420 * .98;
    const body = originalFamilyBodyBounds(role, height, facing, { x: 800, y: 780 });
    assert.ok(Math.abs(body.bottom - body.top - height) < 1e-8);
  }
  const normal = 420 * .42;
  assert.equal(familyGap(420, normal, 1440, 900 / 941), normal, 'No compaction when the original formation fits.');
  for (const width of [360,390]) assert.ok(familyGap(420, normal, width, 844 / 941) < normal);
});

test('camera fallback uses the body union midpoint and never demotes a family member for a distant prop', () => {
  const result = projected('hk-home', 360, 844, 'left', { x: 940, y: 837.49 }, { x: 50, y: 150 });
  const left = Math.min(...result.bodies.map(body => body.left)), right = Math.max(...result.bodies.map(body => body.right));
  assert.ok(Math.abs((left + right) / 2 - 180) < 1e-7);
  assert.ok(left >= 26 - 1e-7 && right <= 334 + 1e-7);
  const app = readFileSync(new URL('../../src/world/WorldApp.tsx', import.meta.url), 'utf8');
  assert.match(app, /const partyGap = cast\.children \? familyGap/);
  assert.match(app, /const cameraFocus = !familyFrame && focusAnchor/);
});
