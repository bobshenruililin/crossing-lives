import { castBodyBounds } from './cast-art';
import type { Facing } from './cast-art';
import type { Point } from './types';
import type { Camera } from './geometry';

/** Match the existing renderer, including its 52% crop flip origin. The original
 * player/friend renderer stays unchanged; only family framing reads these bounds.
 * Alpha >8 fills these reviewed crop bounds (player's first627px pose cell). */
const ORIGINAL_BODY = {
  player: { width: 156, height: 534, footX: 95, footY: 533, flippedFacing: 'left' },
  friend: { width: 360, height: 1066, footX: 191, footY: 1060, flippedFacing: 'right' },
} as const;
export type BodyBounds = { left: number; right: number; top: number; bottom: number };
export function originalFamilyBodyBounds(kind: 'player' | 'friend', bodyHeight: number, facing: Facing, position: Point): BodyBounds {
  const body = ORIGINAL_BODY[kind], scale = bodyHeight / body.height;
  const width = body.width * scale;
  const flipShift = facing === body.flippedFacing ? width * .04 : 0;
  const left = position.x - body.footX * scale + flipShift, top = position.y - body.footY * scale;
  return { left, right: left + width, top, bottom: top + bodyHeight };
}

export function familyBodies(bodyHeight: number, facing: Facing, player: Point, friend: Point, child: Point): BodyBounds[] {
  return [originalFamilyBodyBounds('player', bodyHeight, facing, player), originalFamilyBodyBounds('friend', bodyHeight * .98, facing, friend), castBodyBounds('child', bodyHeight * .67, facing, child)];
}

/** Keep the current family formation unless it is wider than the viewport.
 * The same gap is used for both directions, so turning never changes spacing.
 * Only spacing changes: all three original actor heights remain exact. */
export function familyGap(bodyHeight: number, originalGap: number, viewportWidth: number, cameraScale: number): number {
  const available = (viewportWidth - 26 * 2) / cameraScale;
  const span = (gap: number) => Math.max(...(['left', 'right'] as const).flatMap(facing => [-1, 1].map(side => {
    const bodies = familyBodies(bodyHeight, facing, { x: 0, y: 0 }, { x: side * gap, y: -6 }, { x: side * gap * 1.8, y: 4 });
    return Math.max(...bodies.map(body => body.right)) - Math.min(...bodies.map(body => body.left));
  })));
  if (span(originalGap) <= available) return originalGap;
  let lower = 0, upper = originalGap;
  for (let i = 0; i < 40; i++) {
    const middle = (lower + upper) / 2;
    if (span(middle) <= available) lower = middle; else upper = middle;
  }
  return lower;
}

/** Bounds midpoint is essential when feet and flipped bodies are asymmetric.
 * If a distant prop cannot fit too, cameraFor's fallback still fits the family. */
export function familyFraming(bodyHeight: number, facing: Facing, player: Point, friend: Point, child: Point) {
  const bodies = familyBodies(bodyHeight, facing, player, friend, child);
  return {
    center: { x: (Math.min(...bodies.map(body => body.left)) + Math.max(...bodies.map(body => body.right))) / 2, y: player.y },
    points: bodies.flatMap(body => [{ x: body.left, y: player.y }, { x: body.right, y: player.y }]),
  };
}

/** Family framing deliberately cannot reveal a distant physical marker if doing
 * so would clip a person. Keep that wholly offscreen marker out of native Tab;
 * its named inspect/edge control remains available to walk there normally. */
export function familyMarkerTabIndex(point: Point, camera: Camera, viewport: { width: number; height: number }): 0 | -1 {
  const x = camera.left + point.x * camera.scale, y = camera.top + point.y * camera.scale;
  return x + 22 <= 0 || x - 22 >= viewport.width || y + 22 <= 0 || y - 22 >= viewport.height ? -1 : 0;
}
