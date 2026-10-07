import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { formatClock } from '../domain/engine';
import { journeyArtName, selectedDeparturePlan } from '../decision/journey';
import type { DecisionSession } from '../decision/session';
import type { DecisionJourney, JourneyEvent, JourneyNode } from '../decision/journey';
import './decision-journey.css';

type ObjectId = 'map' | 'menu' | 'phone';
const art = (name: string) => (globalThis as typeof globalThis & { __BETWEEN_ART__?: Record<string, string> }).__BETWEEN_ART__?.[name] ?? `${import.meta.env.BASE_URL}art/${name}`;
const clock = (minutes: number) => `${formatClock(minutes % 1440)}${minutes >= 1440 ? ' next day' : ''}`;
const price = (value: number | null) => value === null ? 'Unknown cost' : `HK$${value.toLocaleString('en-HK', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
const originObjects = [
  { id: 'menu' as const, x: .61, y: .62, symbol: '≡' },
  { id: 'map' as const, x: .69, y: .65, symbol: '↔' },
  { id: 'phone' as const, x: .76, y: .66, symbol: '◷' },
];
const szObjects = [
  { id: 'menu' as const, x: .245, y: .63, symbol: '≡' },
  { id: 'map' as const, x: .535, y: .625, symbol: '↔' },
  { id: 'phone' as const, x: .628, y: .674, symbol: '◷' },
];
const nodes = { counter: { x: .70, y: .81 }, station: { x: .265, y: .785 } };
const focus = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));

/** Image, physical objects, node anchors and player share one source-image plane. */
export function DecisionJourneyScene({ journey, session, explorationNode, onMove, onDepart, hasPreview, dispatch, surfaceOpen, inspectionTarget, onOpen, onCompare, onRoute, originFailed, onNextInvitation }: {
  journey: DecisionJourney | null; session: DecisionSession; explorationNode: JourneyNode; onMove: (node: JourneyNode) => void; onDepart: () => void; hasPreview: boolean; dispatch: Dispatch<JourneyEvent>; surfaceOpen: boolean; inspectionTarget: ObjectId;
  onOpen: (id: ObjectId) => void; onCompare: () => void; onRoute: () => void; originFailed: boolean; onNextInvitation?: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const dialogue = useRef<HTMLElement>(null);
  const [dialogueHeight, setDialogueHeight] = useState(290);
  const arrivalImage = useRef<HTMLImageElement>(null);
  const [geometry, setGeometry] = useState({ width: 1672, height: 941, left: 0, top: 0, frameWidth: 1672, frameHeight: 941, obscured: null as { left: number; right: number; top: number; bottom: number } | null });
  const previousCamera = useRef<{ left: number; top: number } | null>(null);
  const [cameraMoving, setCameraMoving] = useState(false);
  const [spriteFailed, setSpriteFailed] = useState(false);
  const [hkFailed, setHkFailed] = useState(originFailed);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const walkRequested = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const phase = journey?.phase ?? 'exploring';
  const node = journey?.node ?? explorationNode;
  const arrived = phase === 'arrived';
  const outward = phase === 'outward';
  const plan = selectedDeparturePlan(session);
  const snapshot = journey?.snapshot ?? session.snapshots[session.stage]!;
  const option = journey?.option ?? plan?.option ?? null;
  const departure = snapshot.inputs.departureMinutes;
  const homeBy = snapshot.inputs.homeByMinutes;
  const isSZ = option?.id === 'sz';
  const city = isSZ ? 'Shenzhen' : 'Hong Kong';
  const arrivalName = journey ? journeyArtName(journey) : null;
  const objectPositions = arrived && isSZ ? szObjects : originObjects;
  const playerNode = arrived ? (isSZ ? { x: .45, y: .83 } : { x: .77, y: .815 }) : nodes[node];
  const inspected = objectPositions.find(object => object.id === inspectionTarget)!;
  const cameraX = surfaceOpen ? inspected.x : playerNode.x;
  const readyToArrive = journey !== null && journey.artStatus !== 'pending';
  const atDeparture = option !== null && node === (isSZ ? 'station' : 'counter');
  const activeFallback = arrived ? journey?.artStatus === 'fallback' : hkFailed;
  const place = arrived ? isSZ ? 'Luohu dinner · Shenzhen' : 'Nearby dinner · Hong Kong' : 'Kowloon · departure street';
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const image = arrivalImage.current;
    if (!image || !journey) return;
    let cancelled = false;
    let decoding = false;
    const settle = (status: 'ready' | 'fallback') => { if (!cancelled) dispatch({ type: 'art-settled', status, snapshot: journey.snapshot }); };
    const loaded = async () => {
      if (decoding || !image.complete || !image.naturalWidth) return;
      decoding = true;
      try { await image.decode(); settle('ready'); } catch { settle('fallback'); }
    };
    const failed = () => settle('fallback');
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    if (image.complete) { if (image.naturalWidth) void loaded(); else failed(); }
    return () => { cancelled = true; image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
  }, [arrivalName, journey?.snapshot, dispatch]);
  useEffect(() => {
    if (!journey || journey.artStatus !== 'pending') return;
    // A stalled image must not strand the journey. This is a readiness limit,
    // never a cinematic duration or an addition to the modeled trip.
    const timeout = window.setTimeout(() => dispatch({ type: 'art-settled', status: 'fallback', snapshot: journey.snapshot }), 8000);
    return () => window.clearTimeout(timeout);
  }, [journey?.artStatus, journey?.snapshot, dispatch]);
  useEffect(() => {
    // Ready artwork advances without an artificial waiting period or second commitment.
    if (outward && readyToArrive && !surfaceOpen) dispatch({ type: 'arrive' });
  }, [outward, readyToArrive, surfaceOpen, dispatch]);
  useEffect(() => {
    if (!surfaceOpen) focus(arrived ? 'decision-arrival-bill' : outward ? 'decision-outward-heading' : 'decision-journey-heading');
  }, [arrived, outward]);
  useLayoutEffect(() => {
    if (!dialogue.current) return;
    const measure = () => { const height = dialogue.current?.getBoundingClientRect().height; if (height) setDialogueHeight(height); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dialogue.current);
    return () => observer.disconnect();
  }, [surfaceOpen, phase]);
  useLayoutEffect(() => {
    if (!frame.current) return;
    const measure = () => {
      const box = frame.current!.getBoundingClientRect();
      // A hidden sibling keeps its last geometry for an exact return.
      if (!box.width || !box.height) return;
      const mobile = window.matchMedia('(max-width: 899px)').matches;
      const scale = Math.max(box.width / 1672, box.height / 941, mobile ? 740 / 1672 : 0);
      const width = 1672 * scale, height = 941 * scale;
      const clampToImage = (left: number) => Math.min(0, Math.max(box.width - width, left));
      let left = clampToImage(box.width / 2 - width * cameraX);
      // Pan the entire plane, never a marker, to keep the attended objects' full
      // 44px targets inside the crop. The wide Luohu object span cannot all fit
      // on a portrait screen; its distant Menu remains in the named controls.
      if (arrived || surfaceOpen || node === 'counter') {
        const inset = 30; // 22px half target + 8px edge breathing room.
        const targets = surfaceOpen ? [inspected] : (objectPositions.at(-1)!.x - objectPositions[0].x) * width + inset * 2 <= box.width
          ? objectPositions : objectPositions.filter(object => object.id !== 'menu');
        const lower = inset - width * targets[0].x;
        const upper = box.width - inset - width * targets.at(-1)!.x;
        if (lower <= upper) left = clampToImage(Math.min(upper, Math.max(lower, left)));
      }
      const top = (box.height - height) / 2;
      const overlay = surfaceOpen ? document.getElementById('decision-sheet')?.getBoundingClientRect() : dialogue.current?.getBoundingClientRect();
      const obscured = overlay ? { left: overlay.left - box.left, right: overlay.right - box.left, top: overlay.top - box.top, bottom: overlay.bottom - box.top } : null;
      // The desktop arrival dialogue can cover a target's lower corners even
      // when its small icon is visible. Keep the full Phone target beside it.
      if (arrived && !surfaceOpen && obscured) {
        const phone = objectPositions.find(object => object.id === 'phone')!;
        const x = left + width * phone.x, y = top + height * phone.y;
        if (x + 22 > obscured.left && x - 22 < obscured.right && y + 22 > obscured.top && y - 22 < obscured.bottom) {
          const positions = [obscured.left - 30 - width * phone.x, obscured.right + 30 - width * phone.x]
            .filter(value => value >= box.width - width && value <= 0)
            .sort((a, b) => Math.abs(a - left) - Math.abs(b - left));
          if (positions.length) left = positions[0];
        }
      }
      const previous = previousCamera.current;
      const moved = previous !== null && (Math.abs(previous.left - left) > .1 || Math.abs(previous.top - top) > .1);
      if (moved) setCameraMoving(walkRequested.current && phase === 'exploring' && !surfaceOpen && !reducedMotion);
      if (reducedMotion || arrived || surfaceOpen) { walkRequested.current = false; setCameraMoving(false); }
      previousCamera.current = { left, top };
      setGeometry({ width, height, left, top, frameWidth: box.width, frameHeight: box.height, obscured });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [cameraX, surfaceOpen, arrived, node, phase, reducedMotion, objectPositions, inspected, dialogueHeight]);
  const move = (node: JourneyNode) => {
    if (journey) return;
    if (node !== explorationNode && !reducedMotion) { walkRequested.current = true; setCameraMoving(true); }
    onMove(node);
    focus('decision-journey-heading');
  };
  const openObject = (id: ObjectId) => { walkRequested.current = false; setCameraMoving(false); setFallbackOpen(false); onOpen(id); };
  // Measured anchors from the approved sprite sheet. Only two idle poses are used.
  const backPose = !arrived && node === 'station';
  const cellSize = geometry.height * .145 * 627 / (backPose ? 531 : 530);
  const anchorX = backPose ? 290.5 / 627 : 330 / 627;
  const anchorY = backPose ? 583 / 627 : 600 / 627;
  const spriteStyle = { width: cellSize, height: cellSize, left: `${playerNode.x * 100}%`, top: `${playerNode.y * 100}%`, '--anchor-x': `${anchorX * 100}%`, '--anchor-y': `${anchorY * 100}%` } as CSSProperties;
  const visibleTarget = (object: { x: number; y: number }, halfWidth = 22) => {
    const x = geometry.left + geometry.width * object.x, y = geometry.top + geometry.height * object.y;
    const cover = geometry.obscured;
    const clearOfOverlay = !cover || x + halfWidth <= cover.left || x - halfWidth >= cover.right || y + 22 <= cover.top || y - 22 >= cover.bottom;
    return !cameraMoving && clearOfOverlay && x - halfWidth >= 8 && x + halfWidth <= geometry.frameWidth - 8 && y - 22 >= 8 && y + 22 <= geometry.frameHeight - 8;
  };
  const returnFit = !option ? '' : option.homeFeasible ? `${option.spareMinutes} min modeled slack` : `${-option.spareMinutes} min past home-by`;
  return <section className={`decision-journey-scene ${surfaceOpen ? 'has-sheet' : ''}`} data-testid="decision-journey" data-phase={phase} data-node={node} data-city={option?.id ?? 'none'} data-committed-arrival={journey?.committedArrivalMinutes ?? 'none'} data-art-status={journey?.artStatus ?? 'uncommitted'} data-camera-moving={cameraMoving} onKeyDown={event => { if (surfaceOpen || fallbackOpen || journey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); move(event.key === 'ArrowLeft' ? 'station' : 'counter'); }} aria-label="Explore the evening on foot" style={{ '--journey-dialogue-height': `${dialogueHeight}px` } as CSSProperties}>
    <div ref={frame} className="decision-journey-frame" data-testid="decision-journey-frame">
      <div className="decision-journey-plane" style={{ width: geometry.width, height: geometry.height, left: geometry.left, top: geometry.top, transition: cameraMoving && phase === 'exploring' && !surfaceOpen ? undefined : 'none' }} data-testid="decision-journey-plane" onTransitionEnd={event => { if (event.target === event.currentTarget && (event.propertyName === 'left' || event.propertyName === 'top')) { walkRequested.current = false; setCameraMoving(false); } }}>
        <img className="decision-journey-background" hidden={arrived || hkFailed} src={art('decision-hk-pixel.webp')} width="1672" height="941" alt="An imagined Kowloon street with a counter and a station entrance." onError={() => setHkFailed(true)}/>
        {arrivalName && <img ref={arrivalImage} className="decision-journey-background" style={{ visibility: arrived && journey?.artStatus === 'ready' ? 'visible' : 'hidden' }} src={art(arrivalName)} width="1672" height="941" alt={arrived ? isSZ ? 'An imagined Luohu neighborhood: a restaurant on the left, a tree and bench, and a station entrance on the right.' : 'A nearby Hong Kong dining counter represents the local arrival in this imagined street.' : ''}/>}
        {activeFallback && <div className="decision-journey-fallback" role="img" aria-label={`Schematic ${place}`}><span className="decision-fallback-building">{arrived ? `${city} dinner` : 'Dining counter'}</span><span className="decision-fallback-station">{arrived && isSZ ? 'Luohu station' : 'Station'}</span></div>}
        <>
          <div className="decision-journey-player" data-testid="decision-player" data-pose={backPose ? 'idle-back' : 'idle-right'} data-source-x={playerNode.x} data-source-y={playerNode.y} style={spriteStyle} aria-hidden="true">
            {!spriteFailed ? <img src={art('decision-player.webp')} alt="" style={{ left: backPose ? '-100%' : 0, top: backPose ? '-100%' : 0 }} onError={() => setSpriteFailed(true)}/> : <svg viewBox="0 0 40 80"><circle cx="20" cy="12" r="8" fill="#d9ac75"/><path d="M11 23h18l3 30H8z" fill="#bd923c"/><path d="M11 53h8v25h-8zM22 53h8v25h-8z" fill="#283951"/></svg>}
          </div>
          {phase === 'exploring' && !surfaceOpen && <div role="group" aria-label="Walk to a place" className="decision-journey-node-targets">{(['counter', 'station'] as const).map(targetNode => <button type="button" key={targetNode} hidden={!visibleTarget(nodes[targetNode], 30)} className={`decision-journey-node ${targetNode === node ? 'is-here' : ''}`} tabIndex={-1} style={{ left: `${nodes[targetNode].x * 100}%`, top: `${nodes[targetNode].y * 100}%` }} aria-label={`Walk to ${targetNode}`} aria-pressed={targetNode === node} onClick={() => move(targetNode)}><span aria-hidden="true">{targetNode === node ? '·' : '○'}</span></button>)}</div>}
          <div hidden={outward || fallbackOpen || !surfaceOpen && !arrived && node === 'station'} className="decision-journey-object-targets" role="group" aria-label={arrived && isSZ ? 'Objects in the Luohu scene' : 'Objects on the counter'}>{objectPositions.map(object => <button key={object.id} id={`decision-object-${object.id}`} type="button" hidden={!visibleTarget(object)} className="decision-hotspot" data-object-id={object.id} data-source-x={object.x} data-source-y={object.y} style={{ left: `${object.x * 100}%`, top: `${object.y * 100}%` }} aria-label={object.id === 'menu' ? 'Menu See both bills' : object.id === 'map' ? 'Map Unfold both routes' : 'Phone Adjust one time'} onClick={() => openObject(object.id)}><span className="decision-hotspot-mark" aria-hidden="true">{object.symbol}</span><span className="decision-hotspot-label" aria-hidden="true">{object.id}</span></button>)}</div>
        </>
      </div>
      {activeFallback && !outward && <p className="decision-journey-fallback-note">Illustration unavailable. Named places and comparison still work.</p>}
      {outward && option && <div className="decision-journey-outward" role="group" aria-label={`Schematic outward journey to ${city}`}><span>Kowloon</span><i aria-hidden="true">→</i>{isSZ && <><span>Lo Wu<small>clearance allowance</small></span><i aria-hidden="true">→</i></>}<span>{isSZ ? 'Luohu dinner' : 'Local dinner'}</span><p>{option.outwardMinutes} modeled minutes · {clock(option.departureMinutes)} → {clock(option.arrivalMinutes)}</p></div>}
    </div>
    <div hidden={surfaceOpen} className="decision-journey-place" role="status" aria-live="polite" aria-atomic="true" data-testid="decision-journey-place"><span>{outward ? 'Outward journey · modeled' : place}</span><strong data-testid="decision-journey-clock" data-minute={outward ? undefined : arrived && option ? option.arrivalMinutes : departure}>{outward && option ? `${clock(departure)} → ${clock(option.arrivalMinutes)}` : clock(arrived && option ? option.arrivalMinutes : departure)} <small>UTC+8 · {journey ? 'journey clock' : 'departure'}</small></strong><span className="decision-journey-constraints">Budget {price(snapshot.inputs.budgetPerPersonHKD)} / person · home by {clock(homeBy)}</span></div>
    <div className="decision-object-fallback" onKeyDown={event => { if (event.key === 'Escape' && fallbackOpen) { event.preventDefault(); event.stopPropagation(); setFallbackOpen(false); focus('decision-choose-object'); } }}><button id="decision-choose-object" type="button" aria-label="Choose an object" aria-expanded={fallbackOpen} onClick={() => setFallbackOpen(value => !value)}>Objects <span aria-hidden="true">⌄</span></button>{fallbackOpen && <div role="group" aria-label="Named object controls">{(['map', 'phone', 'menu'] as const).map(id => <button key={id} type="button" onClick={() => openObject(id)}>Open {id}</button>)}</div>}</div>
    {!surfaceOpen && <section ref={dialogue} className="decision-journey-dialogue" data-testid="decision-journey-dialogue" aria-labelledby={arrived ? 'decision-arrival-heading' : outward ? 'decision-outward-heading' : 'decision-journey-heading'}>
      {arrived && option ? <><p className="decision-eyebrow">Arrival · {city}</p><h2 id="decision-arrival-heading" tabIndex={-1}>{isSZ ? 'Out of the station, into Luohu.' : 'The nearby dinner is here.'}</h2><p>Dinner {option.mealMinutes} min + walk {option.walkMinutes} min remain ahead in your chosen plan.</p><p className="decision-journey-forecast" data-testid="decision-journey-forecast">Complete outing forecast: {price(option.perPersonHKD)} / person · home {clock(option.returnMinutes)}. Includes dinner and return travel.</p><button id="decision-arrival-bill" type="button" className="decision-primary" onClick={() => openObject('menu')}>Inspect the full outing bill</button></>
      : outward && option && journey ? <><p className="decision-eyebrow">One outward journey</p><h2 id="decision-outward-heading" tabIndex={-1}>{isSZ ? 'Via Lo Wu, toward Luohu.' : 'Along the local streets.'}</h2><p>Arrival {clock(option.arrivalMinutes)} in your chosen model. The outing stays {price(option.perPersonHKD)} per person.</p><p className="decision-journey-note" role="status">Preparing the arrival illustration. Entry, queues and actual service remain unknown.</p><button type="button" className="decision-secondary" onClick={() => dispatch({ type: 'art-settled', status: 'fallback', snapshot: journey.snapshot })}>Use a schematic arrival</button></>
      : <><p className="decision-eyebrow">{node === 'station' ? 'At the station entrance' : 'Beside the counter'}{option ? ` · your ${city} choice` : ''}</p><h2 id="decision-journey-heading" tabIndex={-1}>{hasPreview ? 'A preview is still open.' : atDeparture ? isSZ ? 'Ready to board for Lo Wu?' : 'Ready to head to dinner?' : node === 'station' ? option ? 'Your local dinner is nearby.' : 'Across the border, or closer to home?' : option ? 'Look around. Leave when you’re ready.' : 'Where could this evening take you?'}</h2>
      {!option && <p data-testid="decision-station-thought">{node === 'station' ? 'The train is only part of the outing. What would dinner, a walk and getting home take?' : 'Walk to the station, or unfold the map to compare two whole evenings.'}</p>}
      {option && atDeparture && <><p data-testid={isSZ ? 'decision-station-thought' : 'decision-departure-consequence'}>{session.priorities.includes('exploration') ? 'Your priority: exploration. ' : ''}Walk {option.walkMinutes} min. Arrival {clock(option.arrivalMinutes)} · home {clock(option.returnMinutes)} against home-by {clock(homeBy)} · {returnFit}.{!option.crossingFeasible && ' The modeled crossing window or buffer is not met.'}</p><p className="decision-journey-forecast">Whole outing: {price(option.perPersonHKD)} / person. Dinner and return travel included.{option.perPersonHKD === null && ' Missing costs remain unknown.'}</p></>}
      <div role="group" className="decision-journey-controls" aria-label="Named walking controls"><button type="button" className="decision-secondary" aria-pressed={node === 'counter'} onClick={() => move('counter')}>Counter</button><button type="button" className="decision-secondary" aria-pressed={node === 'station'} onClick={() => move('station')}>Station entrance</button></div>
      {hasPreview ? <><p className="decision-journey-note">Apply or cancel it on the phone before leaving. Walking keeps your current plan intact.</p><button type="button" className="decision-primary" onClick={() => openObject('phone')}>Finish the preview</button></> : atDeparture ? <><p className="decision-journey-note">{isSZ ? 'Entry, queues and actual service remain unknown.' : 'Travel, prices and restaurant availability are authored assumptions.'} This commits the story journey once.</p><button type="button" className="decision-primary" data-testid="decision-depart" onClick={onDepart}>{isSZ ? 'Board for Lo Wu' : 'Head to local dinner'}</button></> : !option ? <button type="button" className="decision-primary" onClick={() => openObject('map')}>Compare the whole evening</button> : <p className="decision-journey-note">Walk between places. Looking around changes neither the clock nor the bill.</p>}
      </>}
      {outward ? <button type="button" className="decision-journey-link" onClick={onRoute}>Inspect the route</button> : (journey || option) && <button type="button" className="decision-journey-link" onClick={onCompare}>Open comparison and replay</button>}
      {arrived && onNextInvitation && <button id="decision-next-invitation" type="button" className="decision-next-invitation" onClick={onNextInvitation}><span aria-hidden="true">◷</span>A message about next time</button>}
    </section>}
  </section>;
}
