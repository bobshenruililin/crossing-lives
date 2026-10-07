import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { decodeImage, worldAsset } from './assets';
import { cameraFor, partiallyCropped, PLANE, pointOnScreen, screenToPlane } from './geometry';
import { clampPoint, DEFAULT_CONTEXT, initialWorldState, nearbyEntrance, PARTY_CAST, PARTY_LABELS, SCENARIO_LABELS, SCENARIO_ROUTES, worldReducer } from './model';
import { getScene } from './scene-registry';
import { PARTY_IDS, SCENE_IDS } from './types';
import type { InteractionValues, Point, SceneRecord, WorldContext } from './types';
import { WorldSprite } from './WorldSprite';
import { WorldInteraction } from './interactions';
import './world.css';

const sceneName = (scene: SceneRecord) => scene.placeLabel.split(' · ')[0];
const focusElement = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReduced(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  return reduced;
}
function Modal({ label, onClose, children, className = '', style }: { label: string; onClose: () => void; children: ReactNode; className?: string; style?: CSSProperties }) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = element.current;
    const target = root?.querySelector<HTMLElement>('[data-autofocus], button, input, select, [tabindex="0"]');
    target?.focus({ preventScroll: true });
  }, []);
  const trap = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const targets = [...(element.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea, summary, [tabindex="0"]') ?? [])].filter(node => node.getClientRects().length > 0 && !node.closest('[inert], [hidden]') && getComputedStyle(node).visibility !== 'hidden');
    if (!targets.length) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
  };
  return <div className={`world-modal ${className}`} role="dialog" aria-modal="true" aria-label={label} ref={element} style={style} onKeyDown={trap}><button type="button" className="world-close" aria-label={`Close ${label}`} onClick={onClose}>×</button><div className="world-modal-scroll">{children}</div></div>;
}
function ContextFields({ context, onChange }: { context: WorldContext; onChange: (context: WorldContext) => void }) {
  return <div className="world-context-fields">
    <label>People<select value={context.party} onChange={event => onChange({ ...context, party: event.target.value as WorldContext['party'] })}>{PARTY_IDS.map(id => <option key={id} value={id}>{PARTY_LABELS[id]}</option>)}</select></label>
    <label>Day<select value={context.day} onChange={event => onChange({ ...context, day: event.target.value as WorldContext['day'] })}><option value="weekend">Weekend</option><option value="weekday">Weekday</option></select></label>
    <label>Day in mind<select value={context.scenario} onChange={event => onChange({ ...context, scenario: event.target.value as WorldContext['scenario'] })}><option value="fieldtrip">A field trip</option><option value="daily-life">Everyday life</option><option value="housing">Looking at homes</option></select></label>
    <p className="world-small">{context.party === 'family' ? 'Fictional cast: two adults and one child. Child fares and eligibility are unknown.' : `Fictional cast: ${PARTY_CAST[context.party].adults === 1 ? 'one adult' : 'two adults'}.`}</p>
    <p className="world-small">{context.scenario === 'housing' ? 'Start in the neighborhood. Follow rental and larger homes.' : context.scenario === 'daily-life' ? 'Start at home. Follow the train to the office.' : 'Begin at home and follow your curiosity.'} Every place stays open.</p>
    <p className="world-small">Day is authored context, not live opening hours or queues.</p>
  </div>;
}
function Schematic({ scene }: { scene: SceneRecord }) {
  return <div className="world-schematic" role="img" aria-label={`Functional schematic of ${sceneName(scene)}. Illustration not ready.`} style={{ '--sky': scene.palette[0], '--wall': scene.palette[1], '--ground': scene.palette[2] } as CSSProperties}>
    <div className="world-schematic-light"/><div className="world-schematic-wall"/><div className="world-schematic-ground"/>
    <div className="world-schematic-door door-left"/><div className="world-schematic-door door-right"/>
    <div className="world-schematic-object"><span>{scene.points[0].icon}</span></div>
    <div className="world-schematic-window"><i/><i/><i/></div>
    <span className="world-schematic-title">{sceneName(scene)}</span>
  </div>;
}
export default function WorldApp() {
  const [state, dispatch] = useReducer(worldReducer, undefined, initialWorldState);
  const scene = getScene(state.sceneId);
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1440, height: 900 });
  const [focusAnchor, setFocusAnchor] = useState<Point | null>(null);
  const [settingsOnStart, setSettingsOnStart] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const returnFocus = useRef('world-stage');
  const reduced = useReducedMotion();
  const activePoint = scene.points.find(point => point.id === state.activePointId);
  const modalOpen = Boolean(state.overlay || activePoint);
  const entrance = nearbyEntrance(state);
  const cast = PARTY_CAST[state.context.party];
  const focusedRoute = SCENARIO_ROUTES[state.context.scenario];
  const routeIndex = focusedRoute.indexOf(scene.id);
  const routeNext = state.context.scenario !== 'fieldtrip' && routeIndex >= 0 ? focusedRoute[routeIndex + 1] : undefined;
  const primaryExit = scene.exits.find(exit => exit.targetSceneId === routeNext) ?? scene.exits.find(exit => exit.id.endsWith('-next')) ?? scene.exits.at(-1)!;
  const routeCaption = (target: typeof primaryExit) => scene.id === 'hk-home' ? 'To the MTR' : `To ${sceneName(getScene(target.targetSceneId)).replace(/^Fictional /i, '')}`;
  const partyGap = Math.max(60, scene.playerBodyHeight * .42);
  const preferredSide = state.facing === 'right' ? -1 : 1;
  const spaceNeeded = partyGap * (cast.children ? 1.8 : 1);
  const partySide = preferredSide === -1 && state.player.x - scene.walkArea.left < spaceNeeded ? 1 : preferredSide === 1 && scene.walkArea.right - state.player.x < spaceNeeded ? -1 : preferredSide;
  const friendPosition = clampPoint({ x: state.player.x + partySide * partyGap, y: state.player.y - 6 }, scene.id);
  const childPosition = clampPoint({ x: state.player.x + partySide * partyGap * 1.8, y: state.player.y + 4 }, scene.id);
  const partyCenter = cast.adults > 1 ? { x: (state.player.x + (cast.children ? childPosition.x : friendPosition.x)) / 2, y: state.player.y } : state.player;
  const approachedPoint = scene.points.find(point => point.id === state.motion?.pointId);
  const nearbyPoint = scene.points.find(point => Math.abs(point.x - state.player.x) < 260);
  const nearbyExit = scene.exits.find(exit => Math.abs(exit.x - state.player.x) < 260);
  const attention = activePoint ?? approachedPoint ?? (entrance ? entrance.doorAnchor ?? entrance : undefined) ?? nearbyPoint ?? (nearbyExit?.doorAnchor ?? nearbyExit);
  const protectedPoints = [state.player, { x: state.player.x + scene.playerBodyHeight * .18, y: state.player.y }, { x: state.player.x - scene.playerBodyHeight * .18, y: state.player.y }, ...(cast.adults > 1 ? [{ x: friendPosition.x - scene.playerBodyHeight * .18, y: friendPosition.y }, { x: friendPosition.x + scene.playerBodyHeight * .18, y: friendPosition.y }] : []), ...(cast.children > 0 ? [{ x: childPosition.x - scene.playerBodyHeight * .67 * .165, y: childPosition.y }, { x: childPosition.x + scene.playerBodyHeight * .67 * .165, y: childPosition.y }] : []), ...(attention ? [attention] : [])];
  const framingScale = Math.max(size.width / PLANE.width, size.height / PLANE.height);
  const cameraFocus = focusAnchor && Math.abs(focusAnchor.x - partyCenter.x) > size.width / framingScale * .55 ? focusAnchor : partyCenter;
  const camera = cameraFor(size.width, size.height, cameraFocus, focusAnchor ? [...protectedPoints, focusAnchor] : protectedPoints);
  const labelAlignment = (point: Point) => { const x = camera.left + point.x * camera.scale; return x < 125 ? 'left' : x > size.width - 125 ? 'right' : 'center'; };
  const pointScreenY = activePoint ? camera.top + activePoint.y * camera.scale : 0;
  const inspectionLimit = activePoint && size.width <= 650 ? Math.max(210, Math.min(size.height * .54, size.height - 117 - pointScreenY - 38)) : undefined;
  const close = () => { dispatch({ type: 'close' }); focusElement(returnFocus.current); };
  const openOverlay = (overlay: 'map' | 'settings' | 'help', trigger: string) => { returnFocus.current = trigger; dispatch({ type: 'overlay', overlay }); };
  const navigate = (to: typeof state.sceneId, exitId?: string, back = false) => { setFocusAnchor(null); dispatch({ type: 'navigate', to, exitId, back }); focusElement('world-stage'); setShowHint(false); };
  const inspect = (pointId: string) => { returnFocus.current = `world-point-${pointId}`; setFocusAnchor(null); dispatch({ type: 'point', pointId }); setShowHint(false); focusElement('world-stage'); };

  useLayoutEffect(() => {
    const node = frame.current; if (!node) return;
    const measure = () => { const rect = node.getBoundingClientRect(); if (rect.width && rect.height) setSize({ width: rect.width, height: rect.height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!scene.art.approved || state.visited.length > 1) return;
    const abort = new AbortController();
    void decodeImage(scene.art.src, abort.signal).then(status => { if (!abort.signal.aborted) dispatch({ type: 'initial-art', sceneId: scene.id, status }); });
    return () => abort.abort();
  }, [state.sceneId]);
  useEffect(() => {
    const travel = state.travel; if (!travel) return;
    const target = getScene(travel.to); const abort = new AbortController();
    if (!target.art.approved) dispatch({ type: 'art', token: travel.token, sceneId: travel.to, status: 'fallback' });
    else void decodeImage(target.art.src, abort.signal).then(status => { if (!abort.signal.aborted) dispatch({ type: 'art', token: travel.token, sceneId: travel.to, status }); });
    return () => abort.abort();
  }, [state.travel?.token]);
  useEffect(() => {
    const motion = state.motion; if (!motion) return;
    if (reduced) { dispatch({ type: 'motion-done', id: motion.id }); return; }
    const distance = Math.hypot(motion.to.x - motion.from.x, motion.to.y - motion.from.y);
    const duration = Math.min(1450, Math.max(170, distance / 540 * 1000));
    let animation = 0; const begin = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - begin) / duration);
      dispatch({ type: 'frame', id: motion.id, position: { x: motion.from.x + (motion.to.x - motion.from.x) * progress, y: motion.from.y + (motion.to.y - motion.from.y) * progress } });
      if (progress === 1) dispatch({ type: 'motion-done', id: motion.id });
      else animation = requestAnimationFrame(step);
    };
    animation = requestAnimationFrame(step); return () => cancelAnimationFrame(animation);
  }, [state.motion?.id, reduced]);
  useEffect(() => { setFocusAnchor(null); if (state.started) focusElement('world-stage'); }, [state.sceneId, state.started]);
  useEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && state.travel && !modalOpen) { event.preventDefault(); dispatch({ type: 'cancel-travel' }); focusElement('world-stage'); } };
    document.addEventListener('keydown', cancel); return () => document.removeEventListener('keydown', cancel);
  }, [state.travel, modalOpen]);

  const keyMove = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!state.started || modalOpen || event.target !== event.currentTarget) return;
    if (event.key === 'Escape' && state.travel) { event.preventDefault(); dispatch({ type: 'cancel-travel' }); return; }
    const key = event.key.toLowerCase();
    const offsets: Record<string, Point> = { arrowleft: { x: -95, y: 0 }, a: { x: -95, y: 0 }, arrowright: { x: 95, y: 0 }, d: { x: 95, y: 0 }, arrowup: { x: 0, y: -45 }, w: { x: 0, y: -45 }, arrowdown: { x: 0, y: 45 }, s: { x: 0, y: 45 } };
    if (offsets[key]) { event.preventDefault(); setFocusAnchor(null); setShowHint(false); const base = state.motion?.to ?? state.player; dispatch({ type: 'move', to: { x: base.x + offsets[key].x, y: base.y + offsets[key].y } }); }
    if (key === 'enter' && entrance) { event.preventDefault(); navigate(entrance.targetSceneId, entrance.id); }
    else if (key === 'e' || key === 'enter' || key === ' ') { event.preventDefault(); inspect(scene.points[0].id); }
    if (key === 'm') { event.preventDefault(); openOverlay('map', 'world-map-button'); }
  };
  const moveDirection = (x: number, y: number) => { setFocusAnchor(null); setShowHint(false); const base = state.motion?.to ?? state.player; dispatch({ type: 'move', to: { x: base.x + x, y: base.y + y } }); focusElement('world-stage'); };
  const planeStyle = { width: PLANE.width, height: PLANE.height, transform: `translate(${camera.left}px, ${camera.top}px) scale(${camera.scale})`, '--inverse-scale': 1 / camera.scale } as CSSProperties;
  return <main className="world-app" data-testid="world-app" data-scene={scene.id} data-started={state.started} data-party={state.context.party} data-travel={state.travel?.to ?? 'none'} data-art-status={state.artStatus}>
    <div className="world-viewport" ref={frame}>
      <div id="world-stage" className="world-stage" data-testid="world-stage" tabIndex={state.started && !modalOpen ? 0 : -1} role="region" aria-label={`${sceneName(scene)}. Use arrow keys or WASD to walk. E to inspect. Enter at a nearby door to enter. M for map.`} aria-describedby={showHint && state.started ? 'world-movement-hint' : undefined} onKeyDown={keyMove} inert={modalOpen || !state.started} onPointerDown={event => {
        if (event.target !== event.currentTarget && !(event.target instanceof Element && event.target.closest('[data-ground]'))) return;
        const rect = frame.current!.getBoundingClientRect();
        const point = screenToPlane({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera);
        dispatch({ type: 'move', to: point }); setFocusAnchor(null); setShowHint(false); event.currentTarget.focus({ preventScroll: true });
      }}>
        <div className="world-plane" style={planeStyle} data-testid="world-plane">
          {state.artStatus === 'ready' && scene.art.approved ? <img className="world-background" src={worldAsset(scene.art.src)} alt={scene.art.alt} width={1672} height={941}/> : <Schematic scene={scene}/>}
          <div className="world-ground" data-ground="true" style={{ left: scene.walkArea.left, top: scene.walkArea.top, width: scene.walkArea.right - scene.walkArea.left, height: scene.walkArea.bottom - scene.walkArea.top }} aria-hidden="true"/>
          {state.started && <>
            {cast.adults > 1 && <WorldSprite kind="friend" bodyHeight={scene.playerBodyHeight * .98} position={friendPosition} facing={state.facing} walking={Boolean(state.motion)}/>}
            {cast.children > 0 && <WorldSprite kind="child" bodyHeight={scene.playerBodyHeight * .67} position={childPosition} facing={state.facing} walking={Boolean(state.motion)}/>}
            <WorldSprite position={state.player} bodyHeight={scene.playerBodyHeight} facing={state.facing} walking={Boolean(state.motion)}/>
            {scene.exits.map(exit => <button type="button" key={exit.id} id={`world-exit-${exit.id}`} className="world-target world-exit" data-nearby={entrance?.id === exit.id} data-primary={exit.id === primaryExit.id} data-label-align={labelAlignment(exit.doorAnchor ?? exit)} hidden={partiallyCropped(exit.doorAnchor ?? exit, camera, size)} style={{ left: (exit.doorAnchor ?? exit).x, top: (exit.doorAnchor ?? exit).y }} aria-label={`Walk to ${exit.label}`} data-testid={`exit-${exit.targetSceneId}`} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setFocusAnchor(exit.doorAnchor ?? exit); }} onClick={() => navigate(exit.targetSceneId, exit.id)}><span aria-hidden="true">{exit.x < PLANE.width / 2 ? '←' : '→'}</span><span className="world-target-label">{entrance?.id === exit.id ? 'Enter · ' : ''}{routeCaption(exit)}{entrance?.id === exit.id && <small>Press Enter or tap the arrow</small>}</span></button>)}
            {scene.points.map(point => <button type="button" key={point.id} id={`world-point-${point.id}`} className="world-target world-point" data-primary="true" data-label-align={labelAlignment(point)} data-label-below={camera.top + point.y * camera.scale < 180} hidden={partiallyCropped(point, camera, size)} style={{ left: point.x, top: point.y }} aria-label={`Explore ${point.label.toLowerCase()}`} data-testid={`point-${point.interactionId}`} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setFocusAnchor(point); }} onClick={() => inspect(point.id)}><span aria-hidden="true">{point.icon}</span><span className="world-target-label">{point.label}</span></button>)}
          </>}
        </div>
      </div>
      {!state.started ? <div className="world-start"><div className="world-start-card"><p className="world-kicker">A small journey through a large city</p><h1>Crossing<br/>Lives<span>.</span></h1><p className="world-start-description">Walk into a different everyday life.</p><button type="button" className="world-play" onClick={() => dispatch({ type: 'start' })}>Play <span aria-hidden="true">→</span></button><p className="world-start-default">{PARTY_LABELS[state.context.party]} · {state.context.day} · {state.context.scenario === 'fieldtrip' ? 'field trip' : state.context.scenario === 'housing' ? 'looking at homes' : 'everyday life'}</p><button type="button" className="world-text-button" aria-expanded={settingsOnStart} onClick={() => setSettingsOnStart(!settingsOnStart)}>Change people or day <span aria-hidden="true">{settingsOnStart ? '−' : '+'}</span></button>{settingsOnStart && <ContextFields context={state.context} onChange={context => dispatch({ type: 'context', context })}/>}<p className="world-start-footnote">An imagined Futian field trip. Explore in any order.</p></div></div> : <>
        <header className="world-header" inert={modalOpen}><div><p className="world-kicker">Crossing Lives</p><h1 id="world-scene-name" aria-live="polite">{sceneName(scene)}</h1></div><div className="world-header-buttons"><button id="world-map-button" type="button" onClick={() => openOverlay('map', 'world-map-button')} aria-label="Open world map"><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/></svg><span>Map</span></button><button id="world-settings-button" type="button" onClick={() => openOverlay('settings', 'world-settings-button')} aria-label="Change people and day">{cast.adults + cast.children}<span aria-hidden="true"> ♙</span></button><button id="world-help-button" type="button" onClick={() => openOverlay('help', 'world-help-button')} aria-label="How to play">?</button></div></header>
        {routeNext && <button type="button" className="world-route-cue" inert={modalOpen} onClick={() => navigate(routeNext)}>Suggested next · {sceneName(getScene(routeNext))} <span aria-hidden="true">→</span></button>}
        {state.artStatus === 'fallback' && <p className="world-art-status">{scene.art.approved ? 'Illustration unavailable · functional schematic' : 'Development schematic · illustration pending'}</p>}
        <div className="world-edge-cues" inert={modalOpen}>{scene.exits.filter(exit => !pointOnScreen(exit.doorAnchor ?? exit, camera, size)).map(exit => <button type="button" key={exit.id} className={exit.x < state.player.x ? 'world-edge-left' : 'world-edge-right'} data-primary={exit.id === primaryExit.id} aria-label={`Walk to ${exit.label}`} onClick={() => navigate(exit.targetSceneId, exit.id)}><span aria-hidden="true">{exit.x < state.player.x ? '←' : '→'}</span><span>{routeCaption(exit)}</span></button>)}</div>
        {state.travel && <div className="world-travel-status" role="status"><span>{state.travel.walkDone ? 'Preparing' : 'Walking to'} {sceneName(getScene(state.travel.to))}…</span>{state.travel.walkDone && state.travel.ready === 'pending' && <button type="button" onClick={() => dispatch({ type: 'art', token: state.travel!.token, sceneId: state.travel!.to, status: 'fallback' })}>Use schematic</button>}<button type="button" onClick={() => { dispatch({ type: 'cancel-travel' }); focusElement('world-stage'); }}>Stay here</button></div>}
        <div className="world-controls" inert={modalOpen}><div className="world-dpad" role="group" aria-label="Walking controls"><button type="button" aria-label="Walk left" onClick={() => moveDirection(-180, 0)}>←</button><div><button type="button" aria-label="Walk further back" onClick={() => moveDirection(0, -65)}>↑</button><button type="button" aria-label="Walk forward" onClick={() => moveDirection(0, 65)}>↓</button></div><button type="button" aria-label="Walk right" onClick={() => moveDirection(180, 0)}>→</button></div><button className="world-inspect-control" type="button" data-action={entrance ? 'enter' : 'inspect'} onClick={() => entrance ? navigate(entrance.targetSceneId, entrance.id) : inspect(scene.points[0].id)} aria-label={entrance ? `Enter ${entrance.label}` : `Explore ${scene.points[0].label.toLowerCase()}`}><span aria-hidden="true">{entrance ? '↵' : scene.points[0].icon}</span>{entrance ? `Enter · ${entrance.label}` : scene.points[0].label}</button>{state.history.length > 0 && <button className="world-back" type="button" aria-label={`Return to ${sceneName(getScene(state.history.at(-1)!))}`} onClick={() => navigate(state.history.at(-1)!, undefined, true)}>↶<span>Back</span></button>}</div>
        {showHint && <p id="world-movement-hint" className="world-movement-hint">Tap the ground or use arrow keys to walk.</p>}
        {activePoint && <Modal label={activePoint.label} className="world-interaction" onClose={close} style={inspectionLimit ? { '--inspection-limit': `${inspectionLimit}px` } as CSSProperties : undefined}><p className="world-kicker">{sceneName(scene)}</p><h2>{activePoint.label}</h2><WorldInteraction sceneId={scene.id} interactionId={activePoint.interactionId} context={state.context} values={state.values[activePoint.interactionId] ?? {}} onChange={(values: InteractionValues) => dispatch({ type: 'values', interactionId: activePoint.interactionId, values })} onClose={close}/></Modal>}
        {state.overlay && <div className="world-modal-shade" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
          {state.overlay === 'settings' && <Modal label="People and day" onClose={close}><p className="world-kicker">Your fictional day</p><h2>Who is coming?</h2><ContextFields context={state.context} onChange={context => dispatch({ type: 'context', context })}/><button className="world-primary" type="button" onClick={close}>Keep exploring</button></Modal>}
          {state.overlay === 'help' && <Modal label="How to play" onClose={close}><p className="world-kicker">Take your time</p><h2>Follow your curiosity.</h2><p>Tap the ground to walk. Arrows lead to another place. Objects open a small experiment.</p><p>Keyboard: arrows or WASD to walk, Enter at a marked entrance, E to explore, M for the map, and Escape to close or stay here.</p><p>Every place is open from the start. Your choices stay for this tab. There is no score.</p><p className="world-small">This fictional route is for exploring questions, not live travel planning. Services, hours, entry eligibility and actual prices require separate checks.</p><button className="world-primary" type="button" onClick={close}>Back to the world</button></Modal>}
          {state.overlay === 'map' && <Modal label="World map" className="world-map" onClose={close}><p className="world-kicker">An imagined field trip</p><h2>Where next?</h2><p className="world-map-route">{SCENARIO_LABELS[state.context.scenario]}</p><div className="world-map-canvas" role="group" aria-label="Places in the connected world"><div className="world-map-line" aria-hidden="true"/>{SCENE_IDS.map((id, index) => <button type="button" key={id} className={`${id === scene.id ? 'is-here' : ''} ${SCENARIO_ROUTES[state.context.scenario].includes(id) ? 'in-route' : ''}`} aria-current={id === scene.id ? 'location' : undefined} onClick={() => id === scene.id ? close() : navigate(id)} style={{ '--map-index': index } as CSSProperties}><span className="world-map-dot" aria-hidden="true">{id === scene.id ? '●' : '○'}</span><span>{sceneName(getScene(id))}</span></button>)}</div><p className="world-small">{state.context.scenario === 'fieldtrip' ? 'The whole route is highlighted.' : 'Your route focus is highlighted.'} Illustrative connections, not geographic directions. Every other place stays open.</p></Modal>}
        </div>}
      </>}
    </div>
    <span className="world-sr-only" role="status" aria-live="polite">{state.started ? `${PARTY_LABELS[state.context.party]}. ${cast.adults} adults${cast.children ? ` and ${cast.children} child. Child fares unknown` : ''}. ${state.context.day}.` : `Ready to play. ${DEFAULT_CONTEXT.party}.`}</span>
  </main>;
}
