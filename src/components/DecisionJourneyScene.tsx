import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { formatClock } from '../domain/engine';
import { journeyArtName } from '../decision/journey';
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
export function DecisionJourneyScene({ journey, dispatch, surfaceOpen, onOpen, onCompare, originFailed }: {
  journey: DecisionJourney; dispatch: Dispatch<JourneyEvent>; surfaceOpen: boolean;
  onOpen: (id: ObjectId) => void; onCompare: () => void; originFailed: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const dialogue = useRef<HTMLElement>(null);
  const [dialogueHeight, setDialogueHeight] = useState(290);
  const arrivalImage = useRef<HTMLImageElement>(null);
  const [geometry, setGeometry] = useState({ width: 1672, height: 941, left: 0, top: 0 });
  const [spriteFailed, setSpriteFailed] = useState(false);
  const [hkFailed, setHkFailed] = useState(originFailed);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const arrived = journey.phase === 'arrived';
  const outward = journey.phase === 'outward';
  const option = journey.option;
  const isSZ = option.id === 'sz';
  const city = isSZ ? 'Shenzhen' : 'Hong Kong';
  const arrivalName = journeyArtName(journey);
  const objectPositions = arrived && isSZ ? szObjects : originObjects;
  const playerNode = arrived ? (isSZ ? { x: .45, y: .83 } : { x: .77, y: .815 }) : nodes[journey.node];
  const cameraX = surfaceOpen ? (arrived && isSZ ? .45 : .69) : playerNode.x;
  const readyToArrive = journey.artStatus !== 'pending';
  const atDeparture = journey.node === (isSZ ? 'station' : 'counter');
  const activeFallback = arrived ? journey.artStatus === 'fallback' : hkFailed;
  const place = arrived ? isSZ ? 'Luohu dinner · Shenzhen' : 'Nearby dinner · Hong Kong' : 'Kowloon · departure street';
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const image = arrivalImage.current;
    if (!image) return;
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
  }, [arrivalName, journey.snapshot, dispatch]);
  useEffect(() => {
    if (journey.artStatus !== 'pending') return;
    // A stalled image must not strand the journey. This is a readiness limit,
    // never a cinematic duration or an addition to the modeled trip.
    const timeout = window.setTimeout(() => dispatch({ type: 'art-settled', status: 'fallback', snapshot: journey.snapshot }), 8000);
    return () => window.clearTimeout(timeout);
  }, [journey.artStatus, journey.snapshot, dispatch]);
  useEffect(() => {
    if (outward && reducedMotion && readyToArrive) dispatch({ type: 'arrive' });
  }, [outward, reducedMotion, readyToArrive, dispatch]);
  useEffect(() => {
    if (!surfaceOpen) focus(arrived ? 'decision-arrival-bill' : outward ? 'decision-outward-heading' : 'decision-journey-heading');
  }, [arrived, outward, surfaceOpen]);
  useLayoutEffect(() => {
    if (!dialogue.current) return;
    const measure = () => setDialogueHeight(dialogue.current?.getBoundingClientRect().height ?? 290);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dialogue.current);
    return () => observer.disconnect();
  }, [surfaceOpen, journey.phase]);
  useLayoutEffect(() => {
    if (!frame.current) return;
    const measure = () => {
      const box = frame.current!.getBoundingClientRect();
      const mobile = window.matchMedia('(max-width: 899px)').matches;
      const scale = Math.max(box.width / 1672, box.height / 941, mobile ? 740 / 1672 : 0);
      const width = 1672 * scale, height = 941 * scale;
      const left = Math.min(0, Math.max(box.width - width, box.width / 2 - width * cameraX));
      setGeometry({ width, height, left, top: (box.height - height) / 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [cameraX, surfaceOpen]);
  const move = (node: JourneyNode) => {
    dispatch({ type: 'move', node });
    focus('decision-journey-heading');
  };
  const openObject = (id: ObjectId) => { setFallbackOpen(false); onOpen(id); };
  // Measured anchors from the approved sprite sheet. Only two idle poses are used.
  const backPose = !arrived && journey.node === 'station';
  const cellSize = geometry.height * .145 * 627 / (backPose ? 531 : 530);
  const anchorX = backPose ? 290.5 / 627 : 330 / 627;
  const anchorY = backPose ? 583 / 627 : 600 / 627;
  const spriteStyle = { width: cellSize, height: cellSize, left: `${playerNode.x * 100}%`, top: `${playerNode.y * 100}%`, '--anchor-x': `${anchorX * 100}%`, '--anchor-y': `${anchorY * 100}%` } as CSSProperties;
  const returnFit = option.homeFeasible ? `${option.spareMinutes} min modeled slack` : `${-option.spareMinutes} min past home-by`;
  return <section className={`decision-journey-scene ${surfaceOpen ? 'has-sheet' : ''}`} data-testid="decision-journey" data-phase={journey.phase} data-node={journey.node} data-city={option.id} data-committed-arrival={journey.committedArrivalMinutes ?? 'none'} data-art-status={journey.artStatus} aria-label="Walk into the chosen evening" style={{ '--journey-dialogue-height': `${dialogueHeight}px` } as CSSProperties}>
    <div ref={frame} className="decision-journey-frame" data-testid="decision-journey-frame">
      <div className="decision-journey-plane" style={geometry} data-testid="decision-journey-plane">
        <img className="decision-journey-background" hidden={arrived || hkFailed} src={art('decision-hk-pixel.webp')} width="1672" height="941" alt="An imagined Kowloon street with a counter and a station entrance." onError={() => setHkFailed(true)}/>
        <img ref={arrivalImage} className="decision-journey-background" style={{ visibility: arrived && journey.artStatus === 'ready' ? 'visible' : 'hidden' }} src={art(arrivalName)} width="1672" height="941" alt={arrived ? isSZ ? 'An imagined Luohu neighborhood: a restaurant on the left, a tree and bench, and a station entrance on the right.' : 'A nearby Hong Kong dining counter represents the local arrival in this imagined street.' : ''}/>
        {activeFallback && <div className="decision-journey-fallback" role="img" aria-label={`Schematic ${place}`}><span className="decision-fallback-building">{arrived ? `${city} dinner` : 'Dining counter'}</span><span className="decision-fallback-station">{arrived && isSZ ? 'Luohu station' : 'Station'}</span></div>}
        {!outward && <>
          <div className="decision-journey-player" data-testid="decision-player" data-pose={backPose ? 'idle-back' : 'idle-right'} data-source-x={playerNode.x} data-source-y={playerNode.y} style={spriteStyle} aria-hidden="true">
            {!spriteFailed ? <img src={art('decision-player.webp')} alt="" style={{ left: backPose ? '-100%' : 0, top: backPose ? '-100%' : 0 }} onError={() => setSpriteFailed(true)}/> : <svg viewBox="0 0 40 80"><circle cx="20" cy="12" r="8" fill="#d9ac75"/><path d="M11 23h18l3 30H8z" fill="#bd923c"/><path d="M11 53h8v25h-8zM22 53h8v25h-8z" fill="#283951"/></svg>}
          </div>
          {journey.phase === 'exploring' && !surfaceOpen && <div role="group" aria-label="Walk to a place" className="decision-journey-node-targets">{(['counter', 'station'] as const).map(node => <button type="button" key={node} className={`decision-journey-node ${node === journey.node ? 'is-here' : ''}`} tabIndex={-1} style={{ left: `${nodes[node].x * 100}%`, top: `${nodes[node].y * 100}%` }} aria-label={`Walk to ${node}`} aria-pressed={journey.node === node} onClick={() => move(node)}><span aria-hidden="true">{node === journey.node ? '·' : '○'}</span></button>)}</div>}
          <div hidden={!surfaceOpen && !arrived && journey.node === 'station'} className="decision-journey-object-targets" role="group" aria-label={arrived && isSZ ? 'Objects in the Luohu scene' : 'Objects on the counter'}>{objectPositions.map(object => <button key={object.id} id={`decision-object-${object.id}`} type="button" className="decision-hotspot" data-object-id={object.id} data-source-x={object.x} data-source-y={object.y} style={{ left: `${object.x * 100}%`, top: `${object.y * 100}%` }} aria-label={object.id === 'menu' ? 'Menu See both bills' : object.id === 'map' ? 'Map Unfold both routes' : 'Phone Adjust one time'} onClick={() => openObject(object.id)}><span className="decision-hotspot-mark" aria-hidden="true">{object.symbol}</span><span className="decision-hotspot-label" aria-hidden="true">{object.id}</span></button>)}</div>
        </>}
      </div>
      {activeFallback && !outward && <p className="decision-journey-fallback-note">Illustration unavailable. Named places and comparison still work.</p>}
      {outward && <div className="decision-journey-outward" role="group" aria-label={`Schematic outward journey to ${city}`}><span>Kowloon</span><i aria-hidden="true">→</i>{isSZ && <><span>Lo Wu<small>clearance allowance</small></span><i aria-hidden="true">→</i></>}<span>{isSZ ? 'Luohu dinner' : 'Local dinner'}</span><p>{option.outwardMinutes} modeled minutes · {clock(option.departureMinutes)} → {clock(option.arrivalMinutes)}</p></div>}
    </div>
    <div className="decision-journey-place" role="status" aria-live="polite" aria-atomic="true" data-testid="decision-journey-place"><span>{outward ? 'Outward journey · schematic' : place}</span><strong data-testid="decision-journey-clock" data-minute={outward ? undefined : arrived ? option.arrivalMinutes : option.departureMinutes}>{outward ? `${clock(option.departureMinutes)} → ${clock(option.arrivalMinutes)}` : clock(arrived ? option.arrivalMinutes : option.departureMinutes)} <small>UTC+8 · journey clock</small></strong><span className="decision-journey-constraints">Budget {price(journey.snapshot.inputs.budgetPerPersonHKD)} / person · home by {clock(option.homeByMinutes)}</span></div>
    <div className="decision-object-fallback" onKeyDown={event => { if (event.key === 'Escape' && fallbackOpen) { event.preventDefault(); event.stopPropagation(); setFallbackOpen(false); focus('decision-choose-object'); } }}><button id="decision-choose-object" type="button" aria-label="Choose an object" aria-expanded={fallbackOpen} onClick={() => setFallbackOpen(value => !value)}>Objects <span aria-hidden="true">⌄</span></button>{fallbackOpen && <div role="group" aria-label="Named object controls">{(['map', 'phone', 'menu'] as const).map(id => <button key={id} type="button" onClick={() => openObject(id)}>Open {id}</button>)}</div>}</div>
    {!surfaceOpen && <section ref={dialogue} className="decision-journey-dialogue" data-testid="decision-journey-dialogue" aria-labelledby={arrived ? 'decision-arrival-heading' : outward ? 'decision-outward-heading' : 'decision-journey-heading'}>
      {arrived ? <><p className="decision-eyebrow">Arrival · {city}</p><h2 id="decision-arrival-heading" tabIndex={-1}>{isSZ ? 'Out of the station, into Luohu.' : 'The nearby dinner is here.'}</h2><p>Dinner {option.mealMinutes} min + walk {option.walkMinutes} min remain ahead in your chosen plan.</p><p className="decision-journey-forecast" data-testid="decision-journey-forecast">Complete outing forecast: {price(option.perPersonHKD)} / person · home {clock(option.returnMinutes)}. Includes dinner and return travel.</p><button id="decision-arrival-bill" type="button" className="decision-primary" onClick={() => openObject('menu')}>Inspect the full outing bill</button></>
      : outward ? <><p className="decision-eyebrow">One outward journey</p><h2 id="decision-outward-heading" tabIndex={-1}>{isSZ ? 'Via Lo Wu, toward Luohu.' : 'Along the local streets.'}</h2><p>The chosen model places your arrival at {clock(option.arrivalMinutes)}. The same complete outing remains {price(option.perPersonHKD)} per person.</p><p className="decision-journey-note">Authored journey, not a timetable. {isSZ ? 'Entry, queues and actual service remain unknown.' : 'Actual travel and restaurant availability remain unverified.'}</p><button type="button" className="decision-primary" disabled={!readyToArrive} onClick={() => dispatch({ type: 'arrive' })}>{readyToArrive ? 'Continue to arrival' : 'Preparing the arrival…'}</button>{!readyToArrive && <button type="button" className="decision-journey-link" onClick={() => { dispatch({ type: 'art-settled', status: 'fallback', snapshot: journey.snapshot }); dispatch({ type: 'arrive' }); }}>Use a schematic arrival</button>}</>
      : <><p className="decision-eyebrow">{journey.node === 'station' ? 'At the station entrance' : 'Beside the counter'} · your {city} choice</p><h2 id="decision-journey-heading" tabIndex={-1}>{atDeparture ? isSZ ? 'Ready to board for Lo Wu?' : 'Ready to head to dinner?' : journey.node === 'station' ? 'Your local dinner is nearby.' : 'A little room to look around.'}</h2>{journey.node === 'counter' && <p>Tap a place to move, or use the named buttons. Walking here is free inspection: it changes neither the modeled clock nor the bill.</p>}{(journey.node === 'station' || !isSZ) && <p data-testid={isSZ ? 'decision-station-thought' : 'decision-departure-consequence'}>{journey.priorities.includes('exploration') ? 'You marked exploration. ' : ''}Your plan keeps {option.walkMinutes} minutes walking. Arrival {clock(option.arrivalMinutes)} · home {clock(option.returnMinutes)} against home-by {clock(option.homeByMinutes)} · {returnFit}.{!option.crossingFeasible && ' The modeled crossing window or buffer is not met.'}</p>}
      <div role="group" className="decision-journey-controls" aria-label="Named walking controls"><button type="button" className="decision-secondary" aria-pressed={journey.node === 'counter'} onClick={() => move('counter')}>Counter</button><button type="button" className="decision-secondary" aria-pressed={journey.node === 'station'} onClick={() => move('station')}>Station entrance</button></div>{atDeparture && <><button type="button" className="decision-primary" data-testid="decision-depart" onClick={() => dispatch({ type: 'depart' })}>{isSZ ? 'Board for Lo Wu' : 'Head to local dinner'}</button><p className="decision-journey-note">{isSZ ? 'Story commitment only. Entry and real service remain unknown.' : 'Story commitment only; the local arrival uses your chosen model.'}</p></>}</>}
      <button type="button" className="decision-journey-link" onClick={onCompare}>Open comparison and replay</button>
    </section>}
  </section>;
}
