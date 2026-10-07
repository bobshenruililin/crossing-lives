import type { PartyId, Point, ScenePoint } from './types';

/** Original single-pose cutouts. Bounds are right/bottom exclusive and cover
 * every alpha >8 pixel in the whole image; body height uses alpha >192.
 * The public manifest retains the measurements, byte hashes and provenance. */
export const CAST_ART = {
  'older-adult-a': { src: 'art/older-adult-a.png', width: 1254, height: 1254, bounds: [434, 56, 817, 1196], bodyHeight: 1136, foot: { x: 605.616, y: 1193 } },
  'older-adult-b': { src: 'art/older-adult-b.png', width: 1254, height: 1254, bounds: [446, 42, 808, 1219], bodyHeight: 1176, foot: { x: 601.749, y: 1218 } },
  child: { src: 'art/child.png', width: 1254, height: 1254, bounds: [454, 114, 808, 1176], bodyHeight: 1060, foot: { x: 606.085, y: 1175 } },
} as const;
export type CastArtId = keyof typeof CAST_ART;
export type Facing = 'left' | 'right';

/** Appearance selection is separate from the world model and all arithmetic. */
export const PARTY_APPEARANCE: Record<PartyId, { player: CastArtId | null; friend: CastArtId | null; child: CastArtId | null }> = {
  'two-friends': { player: null, friend: null, child: null },
  solo: { player: null, friend: null, child: null },
  couple: { player: null, friend: null, child: null },
  'older-couple': { player: 'older-adult-a', friend: 'older-adult-b', child: null },
  family: { player: null, friend: null, child: 'child' },
};

/** Mirror the crop and its asymmetric foot offset together. A centered image
 * flip alone would move the shoes away from the shared world ground point. */
export function castLayout(id: CastArtId, bodyHeight: number, facing: Facing) {
  const art = CAST_ART[id], [left, top, right, bottom] = art.bounds;
  const scale = bodyHeight / art.bodyHeight;
  const width = (right - left) * scale, height = (bottom - top) * scale;
  const footX = (facing === 'left' ? right - art.foot.x : art.foot.x - left) * scale;
  const footY = (art.foot.y - top) * scale;
  return { scale, width, height, footX, footY, left: -footX, top: -footY, right: width - footX, bottom: height - footY };
}

export function castBodyBounds(id: CastArtId, bodyHeight: number, facing: Facing, position: Point) {
  const layout = castLayout(id, bodyHeight, facing);
  return { left: position.x + layout.left, top: position.y + layout.top, right: position.x + layout.right, bottom: position.y + layout.bottom };
}

export function castFramingPoints(id: CastArtId, bodyHeight: number, facing: Facing, position: Point): Point[] {
  const body = castBodyBounds(id, bodyHeight, facing, position);
  return [{ x: body.left, y: position.y }, { x: body.right, y: position.y }];
}

function inspectionClearance(id: CastArtId, bodyHeight: number, point: ScenePoint, cameraScale: number) {
  if (!point.approach) return null;
  const right = castLayout(id, bodyHeight, 'right'), left = castLayout(id, bodyHeight, 'left');
  const radius = (22 + 4) / cameraScale; // Existing 44px target plus a 4px visible gap.
  const extent = Math.max(-right.left, right.right, -left.left, left.right);
  const approach = point.approach;
  const overlaps = approach.y + right.top < point.y + radius && approach.y + right.bottom > point.y - radius
    && approach.x - extent < point.x + radius && approach.x + extent > point.x - radius;
  return overlaps ? { approach, extent, radius } : null;
}

/** A display-derived endpoint, consumed by the ordinary guarded walk. Keep both
 * mirror directions clear, so opening/closing the object never jumps the feet. */
export function castPointApproach(id: CastArtId, bodyHeight: number, point: ScenePoint, cameraScale: number, from: Point, facing: Facing): Point | undefined {
  const clearance = inspectionClearance(id, bodyHeight, point, cameraScale);
  if (!clearance) return undefined;
  const { approach, extent, radius } = clearance;
  const left = point.x - radius - extent, right = point.x + radius + extent;
  // Let the player reach the far side of the marker and the companion follow
  // on its usual side. The marker then fits between the pair in portrait.
  // At either existing stance the current facing keeps repeat inspection still.
  const side = from.x < left - .01 ? 1 : from.x > right + .01 ? -1 : facing === 'right' ? 1 : -1;
  return { x: side === 1 ? right : left, y: approach.y };
}

/** Preserve which side the companion follows. Where the broader cast must
 * straddle a target, reserve its full width for either facing direction.
 * This gap is stable throughout the scene, not switched on at rest. */
export function castPartyGap(player: CastArtId, friend: CastArtId, bodyHeight: number, points: readonly ScenePoint[], cameraScale: number, originalGap: number): number {
  let gap = originalGap;
  const companion = castLayout(friend, bodyHeight * .98, 'right');
  const companionExtent = Math.max(-companion.left, companion.right);
  for (const point of points) {
    const clearance = inspectionClearance(player, bodyHeight, point, cameraScale);
    if (clearance) gap = Math.max(gap, clearance.extent + companionExtent + clearance.radius * 2);
  }
  return gap;
}
