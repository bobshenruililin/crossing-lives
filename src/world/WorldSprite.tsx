import { useState } from 'react';
import { worldAsset } from './assets';
import type { Point } from './types';
/** Measured visible alpha (>8/255) bounds, excluding near-transparent export speckles. */
const CROP = {
  player: { left: 235, top: 67, width: 156, height: 534, footX: 330, footY: 600 },
  friend: { left: 459, top: 105, width: 360, height: 1066, footX: 650, footY: 1165 },
};
export function WorldSprite({ position, bodyHeight, facing, walking, kind = 'player' }: { position: Point; bodyHeight: number; facing: 'left' | 'right'; walking: boolean; kind?: 'player' | 'friend' | 'child' }) {
  const [failed, setFailed] = useState(false);
  const player = kind === 'player';
  const crop = player ? CROP.player : CROP.friend;
  const scale = bodyHeight / crop.height;
  const width = kind === 'child' ? bodyHeight * .33 : crop.width * scale;
  const anchorX = kind === 'child' ? .5 : (crop.footX - crop.left) / crop.width;
  const anchorY = kind === 'child' ? 1 : (crop.footY - crop.top) / crop.height;
  return <div className={`world-sprite world-sprite-${kind}`} data-testid={player ? 'world-player' : `world-${kind}`} data-x={position.x.toFixed(2)} data-y={position.y.toFixed(2)} data-walking={walking} style={{ left: position.x, top: position.y, width, height: bodyHeight, transform: `translate(${-anchorX * 100}%, ${-anchorY * 100}%)`, zIndex: Math.round(position.y) }} aria-hidden="true">
    {kind === 'child' || failed ? <span className="world-pixel-person" style={{ height: bodyHeight }}><i/><b/><em/><em/></span> : <span className="world-sprite-crop" style={{ transform: `scaleX(${facing === (player ? 'left' : 'right') ? -1 : 1})` }}><img src={worldAsset(player ? 'art/player.webp' : 'art/friend.webp')} alt="" onError={() => setFailed(true)} style={{ width: 1254 * scale, height: 1254 * scale, left: -crop.left * scale, top: -crop.top * scale }}/></span>}
  </div>;
}
