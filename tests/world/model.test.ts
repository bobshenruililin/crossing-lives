import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONTEXT, initialWorldState, PARTY_CAST, worldReducer } from '../../src/world/model';
import { getScene } from '../../src/world/scene-registry';
import { PARTY_IDS, SCENE_IDS } from '../../src/world/types';
import type { SceneId } from '../../src/world/types';
const play = () => worldReducer(initialWorldState(), { type: 'start' });
const arrive = (state: ReturnType<typeof play>, to: SceneId, back = false) => {
  let next = worldReducer(state, { type: 'navigate', to, back });
  const id = next.travel!.token;
  next = worldReducer(next, { type: 'art', token: id, sceneId: to, status: 'ready' });
  return worldReducer(next, { type: 'motion-done', id });
};
test('one start enables movement with the exact unpriced default context', () => {
  const state = play();
  assert.equal(state.started, true); assert.deepEqual(state.context, DEFAULT_CONTEXT);
  assert.deepEqual(state.visited, ['hk-home']); assert.deepEqual(state.values, {});
  const moving = worldReducer(state, { type: 'move', to: { x: state.player.x + 80, y: state.player.y } });
  assert.equal(moving.motion?.purpose, 'walk'); assert.equal(moving.sceneId, 'hk-home');
  assert.equal(worldReducer(state, { type: 'start' }), state);
});
test('all twelve scenes form reversible connected entrances without interaction gates', () => {
  for (const origin of SCENE_IDS) {
    const seen = new Set<SceneId>(), queue: SceneId[] = [origin];
    while(queue.length) { const id = queue.shift()!; if (seen.has(id)) continue; seen.add(id); for(const exit of getScene(id).exits) queue.push(exit.targetSceneId); }
    assert.equal(seen.size, 12, `${origin} must reach every place`);
    for(const exit of getScene(origin).exits) {
      let atOrigin = origin === 'hk-home' ? play() : arrive(play(), origin);
      atOrigin = worldReducer(atOrigin, { type: 'navigate', to: exit.targetSceneId, exitId: exit.id });
      const token = atOrigin.travel!.token;
      atOrigin = worldReducer(atOrigin, { type: 'art', token, sceneId: exit.targetSceneId, status: 'ready' });
      atOrigin = worldReducer(atOrigin, { type: 'motion-done', id: token });
      assert.equal(atOrigin.sceneId, exit.targetSceneId);
      atOrigin = arrive(atOrigin, origin, true);
      assert.equal(atOrigin.sceneId, origin, `${exit.id} must allow an exact Back`);
    }
  }
  let state = play();
  for (const id of SCENE_IDS.slice(1)) { state = arrive(state, id); assert.equal(state.sceneId, id); }
  assert.equal(state.visited.length, 12); assert.deepEqual(state.values, {});
});
test('outgoing scene, player and art stay coherent until both walking and decode settle', () => {
  let state = worldReducer(play(), { type: 'navigate', to: 'metro-carriage' });
  const token = state.travel!.token;
  state = worldReducer(state, { type: 'art', token, sceneId: 'metro-carriage', status: 'ready' });
  assert.equal(state.sceneId, 'hk-home'); assert.equal(state.artStatus, 'fallback');
  state = worldReducer(state, { type: 'motion-done', id: token });
  assert.equal(state.sceneId, 'metro-carriage'); assert.equal(state.artStatus, 'ready');
  state = worldReducer(state, { type: 'navigate', to: 'border-arrival' });
  const second = state.travel!.token;
  state = worldReducer(state, { type: 'motion-done', id: second });
  assert.equal(state.sceneId, 'metro-carriage');
  state = worldReducer(state, { type: 'art', token: second, sceneId: 'border-arrival', status: 'fallback' });
  assert.equal(state.sceneId, 'border-arrival'); assert.equal(state.artStatus, 'fallback');
});
test('rapid exits and canceled loads ignore stale movement and image completions', () => {
  let state = worldReducer(play(), { type: 'navigate', to: 'metro-carriage' }); const old = state.travel!.token;
  state = worldReducer(state, { type: 'navigate', to: 'rental-home' }); const current = state.travel!.token;
  assert.equal(worldReducer(state, { type: 'motion-done', id: old }), state);
  assert.equal(worldReducer(state, { type: 'art', token: old, sceneId: 'metro-carriage', status: 'ready' }), state);
  assert.equal(worldReducer(state, { type: 'art', token: current, sceneId: 'metro-carriage', status: 'ready' }), state);
  state = worldReducer(state, { type: 'cancel-travel' });
  assert.equal(worldReducer(state, { type: 'art', token: current, sceneId: 'rental-home', status: 'ready' }), state);
  assert.equal(state.sceneId, 'hk-home');
});
test('back and revisits preserve local choices and context without reapplying calculations', () => {
  let state = play();
  state = worldReducer(state, { type: 'values', interactionId: 'hk-home', values: { bring: 'notebook', homeBy: 19 } });
  state = arrive(state, 'rental-home');
  state = worldReducer(state, { type: 'values', interactionId: 'rental-home', values: { extraCost: 230, included: false } });
  state = arrive(state, 'hk-home', true);
  assert.deepEqual(state.values['hk-home'], { bring: 'notebook', homeBy: 19 }); assert.deepEqual(state.history, []);
  state = arrive(state, 'rental-home');
  assert.deepEqual(state.values['rental-home'], { extraCost: 230, included: false });
  assert.deepEqual(state.context, DEFAULT_CONTEXT); assert.deepEqual(state.visited, ['hk-home','rental-home']);
});
test('party/day changes conserve every entered assumption and movement has no demographic coefficients', () => {
  const original = worldReducer(play(), { type: 'values', interactionId: 'metro-carriage', values: { minutes: 45, days: 4 } });
  for (const party of PARTY_IDS) {
    const next = worldReducer(original, { type: 'context', context: { party, day: 'weekday', scenario: 'housing' } });
    assert.equal(next.values, original.values); assert.deepEqual(next.player, original.player);
    const moved = worldReducer(next, { type: 'move', to: { x: 990, y: 780 } });
    assert.deepEqual(moved.motion?.to, { x: 990, y: 780 });
    assert.deepEqual(Object.keys(PARTY_CAST[party]).sort(), ['adults','children']);
  }
  assert.deepEqual(PARTY_CAST.family, { adults: 2, children: 1 });
});
test('walking clamps to authored ground and object activation waits for reaching it', () => {
  let state = play(); const scene = getScene(state.sceneId);
  state = worldReducer(state, { type: 'move', to: { x: Infinity, y: -500 } });
  assert.equal(state.motion!.to.x, scene.walkArea.left); assert.equal(state.motion!.to.y, scene.walkArea.top);
  state = worldReducer(state, { type: 'point', pointId: scene.points[0].id });
  assert.equal(state.activePointId, null);
  state = worldReducer(state, { type: 'motion-done', id: state.motion!.id });
  assert.equal(state.activePointId, scene.points[0].id);
  state = worldReducer(state, { type: 'close' }); assert.equal(state.activePointId, null);
});
test('opening another surface cancels an in-flight object approach', () => {
  let state = worldReducer(play(), { type: 'point', pointId: getScene('hk-home').points[0].id });
  const oldMotion = state.motion!.id;
  state = worldReducer(state, { type: 'overlay', overlay: 'map' });
  assert.equal(state.motion, null); assert.equal(state.activePointId, null);
  assert.equal(worldReducer(state, { type: 'motion-done', id: oldMotion }), state);
  assert.equal(state.overlay, 'map');
});
test('a scene point walks to its ground approach while its target remains on the physical object', () => {
  for (const id of SCENE_IDS) {
    const scene = getScene(id), point = scene.points[0];
    if (!point.approach) continue;
    const state = id === 'hk-home' ? play() : arrive(play(), id);
    const walking = worldReducer(state, { type: 'point', pointId: point.id });
    assert.deepEqual(walking.motion?.to, point.approach);
  }
});
test('scenario can choose a different starting place without changing inputs or restricting the world', () => {
  let state = initialWorldState();
  state = worldReducer(state, { type: 'context', context: { party: 'solo', day: 'weekday', scenario: 'housing' } });
  state = worldReducer(state, { type: 'start' });
  assert.equal(state.sceneId, 'neighborhood-lane'); assert.deepEqual(state.values, {});
  assert.deepEqual(state.visited, ['neighborhood-lane']);
  state = arrive(state, 'learning-center'); assert.equal(state.sceneId, 'learning-center');
  assert.deepEqual(state.context, { party: 'solo', day: 'weekday', scenario: 'housing' });
});
test('walking to a door only offers entry and does not navigate without an explicit action', async () => {
  const { nearbyEntrance } = await import('../../src/world/model');
  let state = play(); const exit = getScene('hk-home').exits[0];
  assert.equal(nearbyEntrance(state), null);
  state = worldReducer(state, { type: 'move', to: exit });
  state = worldReducer(state, { type: 'motion-done', id: state.motion!.id });
  assert.equal(state.sceneId, 'hk-home'); assert.equal(state.travel, null);
  assert.equal(nearbyEntrance(state)?.id, exit.id);
  state = worldReducer(state, { type: 'navigate', to: exit.targetSceneId, exitId: exit.id });
  assert.equal(state.travel?.to, 'metro-carriage');
  state = worldReducer(state, { type: 'cancel-travel' });
  assert.equal(state.sceneId, 'hk-home'); assert.equal(state.travel, null);
});
