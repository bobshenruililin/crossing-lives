import { getScene, isSceneId } from './scene-registry';
import { SCENE_IDS } from './types';
import type { InteractionValues, Point, SceneId, ScenarioId, WorldContext } from './types';

export const SCENARIO_ROUTES: Record<ScenarioId, readonly SceneId[]> = { fieldtrip: SCENE_IDS, 'daily-life': ['hk-home', 'metro-carriage', 'office-floor'], housing: ['neighborhood-lane', 'rental-home', 'luxury-home'] };
export const SCENARIO_LABELS = { fieldtrip: 'The whole field trip', 'daily-life': 'Home → train → office', housing: 'Neighborhood → rental → larger home' } as const;
export const DEFAULT_CONTEXT: WorldContext = { party: 'two-friends', day: 'weekend', scenario: 'fieldtrip' };
export const PARTY_LABELS = { 'two-friends': 'Two friends', solo: 'Solo', couple: 'Couple', 'older-couple': 'Older couple', family: 'Family' } as const;
export const PARTY_CAST = { 'two-friends': { adults: 2, children: 0 }, solo: { adults: 1, children: 0 }, couple: { adults: 2, children: 0 }, 'older-couple': { adults: 2, children: 0 }, family: { adults: 2, children: 1 } } as const;
export interface Motion { id: number; from: Point; to: Point; purpose: 'walk' | 'exit' | 'point'; pointId?: string }
export interface Travel { token: number; from: SceneId; to: SceneId; entry: 'left' | 'right'; ready: 'pending' | 'ready' | 'fallback'; walkDone: boolean; back: boolean }
export interface WorldState {
  started: boolean; context: WorldContext; sceneId: SceneId; player: Point;
  facing: 'left' | 'right'; motion: Motion | null; travel: Travel | null; serial: number;
  artStatus: 'ready' | 'fallback'; activePointId: string | null;
  overlay: 'map' | 'settings' | 'help' | null;
  values: Readonly<Record<string, InteractionValues>>;
  visited: readonly SceneId[]; history: readonly SceneId[];
  positions: Partial<Record<SceneId, Point>>;
}
export type WorldEvent =
  | { type: 'start' }
  | { type: 'context'; context: WorldContext }
  | { type: 'move'; to: Point }
  | { type: 'point'; pointId: string; approach?: Point }
  | { type: 'navigate'; to: SceneId; exitId?: string; back?: boolean }
  | { type: 'frame'; id: number; position: Point }
  | { type: 'motion-done'; id: number }
  | { type: 'art'; token: number; sceneId: SceneId; status: 'ready' | 'fallback' }
  | { type: 'initial-art'; sceneId: SceneId; status: 'ready' | 'fallback' }
  | { type: 'values'; interactionId: string; values: InteractionValues }
  | { type: 'overlay'; overlay: WorldState['overlay'] }
  | { type: 'close' }
  | { type: 'cancel-travel' };
export function initialWorldState(): WorldState {
  return { started: false, context: { ...DEFAULT_CONTEXT }, sceneId: 'hk-home', player: { ...getScene('hk-home').playerStart }, facing: 'right', motion: null, travel: null, serial: 0, artStatus: 'fallback', activePointId: null, overlay: null, values: {}, visited: [], history: [], positions: {} };
}
export function clampPoint(point: Point, sceneId: SceneId): Point {
  const area = getScene(sceneId).walkArea;
  return { x: Math.max(area.left, Math.min(area.right, Number.isFinite(point.x) ? point.x : area.left)), y: Math.max(area.top, Math.min(area.bottom, Number.isFinite(point.y) ? point.y : area.top)) };
}

/** A nearby door offers an explicit Enter action; proximity alone never navigates. */
export function nearbyEntrance(state: WorldState) {
  if (!state.started || state.travel || state.overlay || state.activePointId) return null;
  return getScene(state.sceneId).exits
    .map(exit => ({ exit, distance: Math.hypot(state.player.x - clampPoint(exit, state.sceneId).x, state.player.y - clampPoint(exit, state.sceneId).y) }))
    .filter(item => item.distance <= 86)
    .sort((a, b) => a.distance - b.distance)[0]?.exit ?? null;
}

function beginMotion(state: WorldState, to: Point, purpose: Motion['purpose'], pointId?: string): WorldState {
  const destination = clampPoint(to, state.sceneId);
  return { ...state, serial: state.serial + 1, facing: destination.x < state.player.x ? 'left' : destination.x > state.player.x ? 'right' : state.facing, motion: { id: state.serial + 1, from: state.player, to: destination, purpose, pointId }, activePointId: null, overlay: null };
}
function commitIfReady(state: WorldState): WorldState {
  const travel = state.travel;
  if (!travel || !travel.walkDone || travel.ready === 'pending') return state;
  const scene = getScene(travel.to);
  const saved = travel.back ? state.positions[travel.to] : undefined;
  const player = saved ?? scene.entryPoints?.[travel.entry] ?? (scene.art.approved ? scene.playerStart : { x: travel.entry === 'left' ? scene.walkArea.left + 200 : scene.walkArea.right - 200, y: scene.playerStart.y });
  return { ...state, sceneId: travel.to, player: clampPoint(player, travel.to), artStatus: travel.ready, motion: null, travel: null, activePointId: null, positions: { ...state.positions, [state.sceneId]: state.player }, history: travel.back ? state.history.slice(0, -1) : [...state.history, state.sceneId], visited: state.visited.includes(travel.to) ? state.visited : [...state.visited, travel.to] };
}
/** Async completions carry identities. An older image or walk can never arrive in a newer scene. */
export function worldReducer(state: WorldState, event: WorldEvent): WorldState {
  switch (event.type) {
    case 'start': {
      if (state.started) return state;
      const sceneId = SCENARIO_ROUTES[state.context.scenario][0];
      return { ...state, started: true, overlay: null, sceneId, player: { ...getScene(sceneId).playerStart }, artStatus: sceneId === state.sceneId ? state.artStatus : 'fallback', visited: [sceneId] };
    }
    case 'context': return { ...state, context: { ...event.context } };
    case 'initial-art': return state.sceneId === event.sceneId && state.visited.length <= 1 && !state.travel ? { ...state, artStatus: event.status } : state;
    case 'move': return !state.started || state.overlay || state.travel ? state : beginMotion({ ...state, activePointId: null }, event.to, 'walk');
    case 'point': {
      if (!state.started || state.travel) return state;
      const point = getScene(state.sceneId).points.find(item => item.id === event.pointId);
      return point ? beginMotion(state, event.approach ?? point.approach ?? { x: point.x - 55, y: point.y + 65 }, 'point', point.id) : state;
    }
    case 'navigate': {
      if (!state.started || !isSceneId(event.to) || event.to === state.sceneId) return state;
      const scene = getScene(state.sceneId);
      const exit = event.exitId ? scene.exits.find(item => item.id === event.exitId && item.targetSceneId === event.to) : scene.exits.find(item => item.targetSceneId === event.to);
      if (event.exitId && !exit) return state;
      const destination = exit ?? { x: scene.walkArea.right - 60, y: scene.playerStart.y, entryDirection: 'left' as const };
      const next = beginMotion(state, destination, 'exit');
      return { ...next, travel: { token: next.serial, from: state.sceneId, to: event.to, entry: destination.entryDirection, ready: 'pending', walkDone: false, back: event.back === true } };
    }
    case 'frame': return !state.motion || event.id !== state.motion.id ? state : { ...state, player: clampPoint(event.position, state.sceneId) };
    case 'motion-done': {
      if (!state.motion || event.id !== state.motion.id) return state;
      const motion = state.motion;
      const next = { ...state, player: motion.to, motion: null, positions: { ...state.positions, [state.sceneId]: motion.to } };
      if (motion.purpose === 'exit' && state.travel?.token === event.id) return commitIfReady({ ...next, travel: { ...state.travel, walkDone: true } });
      return { ...next, activePointId: motion.purpose === 'point' ? motion.pointId ?? null : null };
    }
    case 'art': {
      if (!state.travel || state.travel.token !== event.token || state.travel.to !== event.sceneId || state.travel.ready !== 'pending') return state;
      return commitIfReady({ ...state, travel: { ...state.travel, ready: event.status } });
    }
    case 'values': return { ...state, values: { ...state.values, [event.interactionId]: { ...event.values } } };
    case 'overlay': return { ...state, overlay: event.overlay, activePointId: null, motion: null, travel: null };
    case 'close': return { ...state, overlay: null, activePointId: null };
    case 'cancel-travel': return { ...state, travel: null, motion: null };
  }
}
