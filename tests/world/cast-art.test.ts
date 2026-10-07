import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { CAST_ART, castBodyBounds, castFramingPoints, castLayout, castPartyGap, castPointApproach, PARTY_APPEARANCE } from '../../src/world/cast-art';
import { cameraFor } from '../../src/world/geometry';
import { getScene } from '../../src/world/scene-registry';
import { DEFAULT_CONTEXT, initialWorldState, worldReducer } from '../../src/world/model';
import { PARTY_IDS, SCENE_IDS } from '../../src/world/types';

// Independent full-image RGBA decode; production crop constants never select pixels.
function decodePng(file: string) {
  const bytes = readFileSync(new URL(`../../public-world/${file}`, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8); assert.equal(bytes[25], 6); assert.equal(bytes[28], 0);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4, rgba = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? rgba[y * stride + x - 4] : 0, b = y ? rgba[(y - 1) * stride + x] : 0, c = x >= 4 && y ? rgba[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predict = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      rgba[y * stride + x] = (raw[y * (stride + 1) + x + 1] + predict) & 255;
    }
  }
  return { width, height, rgba, hash: createHash('sha256').update(bytes).digest('hex') };
}
const ids = Object.keys(CAST_ART) as (keyof typeof CAST_ART)[];
const decoded = Object.fromEntries(ids.map(id => [id, decodePng(CAST_ART[id].src)])) as Record<keyof typeof CAST_ART, ReturnType<typeof decodePng>>;

test('original bytes, independently measured whole-image alpha and dominant height match the approved manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../public-world/art/cast-manifest.json', import.meta.url), 'utf8'));
  const hashes = ['23a27967e8931b4d594f17aaced081d8292d3de290163e898807dd62a2873e87','34a9446d0c87d9058b95f92ca26882e416ad7b9cb84a69219b3aa49099d767db','5ef780288a6101448f2c9e880525b147da7a1b463be1000ce264a5cd4260aa1b'];
  for (const [index, id] of ids.entries()) {
    const art = CAST_ART[id], png = decoded[id], entry = manifest.assets.find((item: { id: string }) => item.id === id);
    assert.equal(png.hash, hashes[index]); assert.equal(png.hash, entry.sha256); assert.equal(png.width, art.width); assert.equal(png.height, art.height);
    for (const threshold of [8, 192]) {
      let left = png.width, top = png.height, right = 0, bottom = 0, count = 0;
      for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (png.rgba[(y * png.width + x) * 4 + 3] > threshold) {
        left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1); count++;
      }
      assert.ok(count > 250_000);
      if (threshold === 8) assert.deepEqual([left, top, right, bottom], art.bounds);
      else { assert.equal(bottom - top, art.bodyHeight); assert.equal(bottom, art.foot.y); }
    }
    for (const [x, y] of [[0, 0], [1253, 0], [0, 1253], [1253, 1253]]) assert.equal(png.rgba[(y * png.width + x) * 4 + 3], 0);
  }
});

test('single-pose mirroring exactly anchors the shoes and preserves aspect at every authored size', () => {
  for (const sceneId of SCENE_IDS) for (const id of ids) {
    const art = CAST_ART[id], height = getScene(sceneId).playerBodyHeight * (id === 'child' ? .67 : 1);
    const right = castLayout(id, height, 'right'), left = castLayout(id, height, 'left');
    assert.ok(Math.abs(right.footX + left.footX - right.width) < 1e-8); assert.equal(right.footY, left.footY);
    assert.equal(right.width, left.width); assert.equal(right.height, left.height);
    assert.ok(Math.abs(art.bodyHeight * right.scale - height) < 1e-8);
    assert.equal(art.width * right.scale / (art.height * right.scale), art.width / art.height);
    const sourceFoot = (art.foot.x - art.bounds[0]) * right.scale;
    assert.ok(Math.abs(right.left + sourceFoot) < 1e-8); assert.ok(Math.abs(left.left + left.width - sourceFoot) < 1e-8);
    assert.ok(Math.abs(right.top + (art.foot.y - art.bounds[1]) * right.scale) < 1e-8);
    assert.ok(right.bottom >= 0 && right.bottom < 2);
  }
});

test('only the older pair and family child select new art; inputs and ordinary motion stay unchanged', () => {
  assert.deepEqual(PARTY_APPEARANCE['older-couple'], { player: 'older-adult-a', friend: 'older-adult-b', child: null });
  assert.deepEqual(PARTY_APPEARANCE.family, { player: null, friend: null, child: 'child' });
  for (const id of ['solo','couple','two-friends'] as const) assert.deepEqual(PARTY_APPEARANCE[id], { player: null, friend: null, child: null });
  const started = worldReducer(initialWorldState(), { type: 'start' });
  const seeded = worldReducer(started, { type: 'values', interactionId: 'rental-home', values: { rent: 4200, cash: 10000 } });
  const baseline = worldReducer(seeded, { type: 'move', to: { x: 980, y: 790 } });
  for (const party of PARTY_IDS) {
    const selected = worldReducer(seeded, { type: 'context', context: { ...DEFAULT_CONTEXT, party } });
    assert.equal(selected.values, seeded.values);
    assert.deepEqual(worldReducer(selected, { type: 'move', to: { x: 980, y: 790 } }).motion, baseline.motion);
    assert.deepEqual(Object.keys(PARTY_APPEARANCE[party]).sort(), ['child','friend','player']);
  }
});

test('measured first-play older bodies fit both directions at 360/390/1440', () => {
  const scene = getScene('hk-home');
  for (const width of [360,390,1440]) for (const facing of ['left','right'] as const) {
    const height = width === 1440 ? 900 : 844, main = scene.playerStart, gap = scene.playerBodyHeight * .42;
    const friend = { x: main.x + (facing === 'left' ? gap : -gap), y: main.y - 6 };
    const camera = cameraFor(width, height, { x: (main.x + friend.x) / 2, y: main.y }, [...castFramingPoints('older-adult-a', scene.playerBodyHeight, facing, main), ...castFramingPoints('older-adult-b', scene.playerBodyHeight * .98, facing, friend)]);
    for (const body of [castBodyBounds('older-adult-a', scene.playerBodyHeight, facing, main), castBodyBounds('older-adult-b', scene.playerBodyHeight * .98, facing, friend)]) {
      assert.ok(camera.left + body.left * camera.scale >= 0); assert.ok(camera.left + body.right * camera.scale <= width);
      assert.ok(camera.top + body.top * camera.scale >= 0); assert.ok(camera.top + body.bottom * camera.scale <= height);
    }
  }
});

test('public provenance is project-relative and the dedicated renderer never indexes a sheet pose', () => {
  for (const name of ['cast-manifest.json','CAST_PROVENANCE.md']) assert.doesNotMatch(readFileSync(new URL(`../../public-world/art/${name}`, import.meta.url), 'utf8'), /\/workspace\/|\/agent_notes\/|https?:\/\/(?:docs\.google\.com|drive\.google\.com|[^/]*slack\.com)\//);
  const source = readFileSync(new URL('../../src/world/WorldCastSprite.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /627|CROP\.player|CROP\.friend|frameIndex/); assert.match(source, /single-idle/);
});

test('measured approach is coherent with stored feet and next motion; original and other-scene stances remain exact', () => {
  for (const id of ['rental-home','luxury-home'] as const) for (const width of [360,390,1440]) {
    const scene = getScene(id), point = scene.points[0], scale = cameraFor(width, width === 1440 ? 900 : 844, scene.playerStart).scale;
    const stance = castPointApproach('older-adult-a', scene.playerBodyHeight, point, scale, scene.playerStart, 'right')!;
    const current = { ...worldReducer(initialWorldState(), { type: 'start' }), sceneId: id, player: scene.playerStart };
    const walking = worldReducer(current, { type: 'point', pointId: point.id, approach: stance });
    assert.deepEqual(walking.motion!.to, stance); assert.equal(walking.activePointId, null);
    const arrived = worldReducer(walking, { type: 'motion-done', id: walking.motion!.id });
    assert.deepEqual(arrived.player, stance); assert.deepEqual(arrived.positions[id], stance); assert.equal(arrived.activePointId, point.id);
    assert.deepEqual(worldReducer(arrived, { type: 'move', to: { x: stance.x + 95, y: stance.y } }).motion!.from, stance);
    assert.deepEqual(worldReducer(current, { type: 'point', pointId: point.id }).motion!.to, point.approach);
  }
  for (const id of SCENE_IDS.filter(id => id !== 'rental-home' && id !== 'luxury-home')) {
    const scene = getScene(id), gap = Math.max(60, scene.playerBodyHeight * .42);
    assert.equal(castPointApproach('older-adult-a', scene.playerBodyHeight, scene.points[0], 844 / 941, scene.playerStart, 'right'), undefined);
    assert.equal(castPartyGap('older-adult-a', 'older-adult-b', scene.playerBodyHeight, scene.points, 844 / 941, gap), gap);
  }
});

test('measured approach cannot bypass point identity, start/travel guards, clamping or cancellation', () => {
  const initial = initialWorldState(), point = getScene('hk-home').points[0];
  assert.equal(worldReducer(initial, { type: 'point', pointId: point.id, approach: { x: 500, y: 800 } }), initial);
  const started = worldReducer(initial, { type: 'start' });
  assert.equal(worldReducer(started, { type: 'point', pointId: 'missing', approach: { x: 500, y: 800 } }), started);
  const travel = worldReducer(started, { type: 'navigate', to: 'metro-carriage' });
  assert.equal(worldReducer(travel, { type: 'point', pointId: point.id, approach: { x: 500, y: 800 } }), travel);
  const moving = worldReducer(started, { type: 'point', pointId: point.id, approach: { x: -999, y: Infinity } });
  const area = getScene('hk-home').walkArea; assert.deepEqual(moving.motion!.to, { x: area.left, y: area.top });
  const canceled = worldReducer(moving, { type: 'overlay', overlay: 'map' });
  assert.equal(worldReducer(canceled, { type: 'motion-done', id: moving.motion!.id }), canceled);
});

test('both measured bodies and the full44px marker keep the original26px camera inset in both directions', () => {
  for (const id of ['rental-home','luxury-home'] as const) for (const width of [360,390,1440]) for (const facing of ['left','right'] as const) {
    const scene = getScene(id), point = scene.points[0], height = width === 1440 ? 900 : 844;
    const scale = cameraFor(width, height, scene.playerStart).scale;
    const from = { x: facing === 'right' ? scene.walkArea.left : scene.walkArea.right, y: scene.playerStart.y };
    const stance = castPointApproach('older-adult-a', scene.playerBodyHeight, point, scale, from, facing)!;
    const gap = castPartyGap('older-adult-a', 'older-adult-b', scene.playerBodyHeight, scene.points, scale, scene.playerBodyHeight * .42);
    const friend = { x: stance.x + (facing === 'right' ? -gap : gap), y: stance.y - 6 };
    const points = [...castFramingPoints('older-adult-a', scene.playerBodyHeight, facing, stance), ...castFramingPoints('older-adult-b', scene.playerBodyHeight * .98, facing, friend), point];
    const camera = cameraFor(width, height, { x: (stance.x + friend.x) / 2, y: stance.y }, points);
    for (const anchor of points) { const x = camera.left + anchor.x * camera.scale; assert.ok(x >= 26 - 1e-7 && x <= width - 26 + 1e-7, `${id} ${width}px ${facing}: x=${x}`); }
    const markerX = camera.left + point.x * camera.scale; assert.ok(markerX - 22 >= 4 && markerX + 22 <= width - 4);
    for (const body of [castBodyBounds('older-adult-a', scene.playerBodyHeight, facing, stance), castBodyBounds('older-adult-b', scene.playerBodyHeight * .98, facing, friend)]) assert.ok(body.right <= point.x - 26 / scale + 1e-7 || body.left >= point.x + 26 / scale - 1e-7);
    assert.deepEqual(castPointApproach('older-adult-a', scene.playerBodyHeight, point, scale, stance, facing), stance);
  }
});
