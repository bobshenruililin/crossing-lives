import { useState } from 'react';
import { worldAsset } from './assets';
import { CAST_ART, castLayout } from './cast-art';
import type { CastArtId, Facing } from './cast-art';
import type { Point } from './types';

/** A single complete pose, never indexed through the legacy four-pose sheet.
 * It shares only the existing restrained bob and reduced-motion policy. */
export function WorldCastSprite({ artId, role, position, bodyHeight, facing, walking }: {
  artId: CastArtId; role: 'player' | 'friend' | 'child'; position: Point;
  bodyHeight: number; facing: Facing; walking: boolean;
}) {
  const [failedArt, setFailedArt] = useState<CastArtId | null>(null);
  const art = CAST_ART[artId], layout = castLayout(artId, bodyHeight, facing);
  const failed = failedArt === artId;
  const child = artId === 'child';
  return <div className={`world-sprite world-sprite-${role} world-cast-sprite`} data-testid={`world-${role}`} data-cast-id={artId} data-cast-pose="single-idle" data-facing={facing} data-x={position.x.toFixed(2)} data-y={position.y.toFixed(2)} data-walking={walking} data-art-status={failed ? 'fallback' : 'image'} style={{ left: position.x, top: position.y, width: layout.width, height: layout.height, transform: `translate(${-layout.footX}px, ${-layout.footY}px)`, zIndex: Math.round(position.y) }} aria-hidden="true">
    <span className="world-sprite-crop" style={{ transform: `scaleX(${facing === 'left' ? -1 : 1})`, transformOrigin: '50% 50%' }}>
      {failed ? <span className="world-pixel-person" data-cast-fallback={artId} style={{ height: bodyHeight, width: child ? '58%' : '56%', left: '22%', bottom: layout.bottom }}>
        <i style={{ background: child ? '#49382e' : '#b5b5ad', height: child ? '30%' : '24%' }}/>
        <b style={{ background: child ? '#c99535' : artId === 'older-adult-a' ? '#6f7559' : '#795463', top: child ? '31%' : '25%', height: child ? '34%' : '40%' }}/>
        <em/><em/>
      </span> : <img src={worldAsset(art.src)} alt="" draggable={false} onError={() => setFailedArt(artId)} style={{ width: art.width * layout.scale, height: art.height * layout.scale, left: -art.bounds[0] * layout.scale, top: -art.bounds[1] * layout.scale }}/>} 
    </span>
  </div>;
}
