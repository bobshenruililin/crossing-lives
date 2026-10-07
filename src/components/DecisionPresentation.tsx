import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatClock } from '../domain/engine';
import { DECISION_TIMELINE_RANGE } from '../decision/session';
import type { DecisionSnapshot, TimeChangeField } from '../decision/session';

export type DecisionOption = DecisionSnapshot['result']['options'][number];
export type ComparisonSnapshot = Pick<DecisionSnapshot, 'inputs' | 'result'> & { readonly id: string };
export type SceneObject = 'map' | 'phone' | 'menu';
export type StreetGeometry = { width: number; height: number; left: number; top: number };
type Segment = { id: string; label: string; start: number; end: number; kind: 'travel' | 'clearance' | 'dinner' | 'walk' };

// Shared presentation only. The default ID namespace preserves the original scene.
const art = (name: string) => (globalThis as typeof globalThis & { __BETWEEN_ART__?: Record<string, string> }).__BETWEEN_ART__?.[name] ?? `${import.meta.env.BASE_URL}art/${name}`;
export const cityName = (id: 'hk' | 'sz') => id === 'hk' ? 'Hong Kong' : 'Shenzhen';
export const money = (amount: number | null) => amount === null ? 'Unknown' : `HK$${amount.toLocaleString('en-HK', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
export const nativeMoney = (amount: number | null, currency: string) => amount === null ? 'Unknown' : `${currency} ${amount.toFixed(2)}`;
const SCALE_START = DECISION_TIMELINE_RANGE.startMinutes;
const SCALE_END = DECISION_TIMELINE_RANGE.endMinutes;
export const shortClock = (minutes: number) => formatClock(minutes % 1440);
export const clockLabel = (minutes: number) => `${shortClock(minutes)}${minutes >= 1440 ? ' next day' : ''}`;
export const fieldName = (field: TimeChangeField) => field === 'departureMinutes' ? 'Departure' : 'Home-by';
export const fitSummary = (option: DecisionOption) => `${option.homeFeasible ? `${option.spareMinutes} min modeled slack.` : `${-option.spareMinutes} min past home-by.`}${!option.crossingFeasible ? ' Modeled crossing window or closing buffer not met.' : ''}`;
const position = (minute: number) => `${(minute - SCALE_START) / (SCALE_END - SCALE_START) * 100}%`;
export function inputLeaves(value: unknown, path = ''): { key: string; value: string }[] {
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => inputLeaves(child, path ? `${path}.${key}` : key));
  return [{ key: path, value: String(value) }];
}

const inputLabels: Record<string, string> = {
  origin: 'Origin', departureMinutes: 'Departure (minute of day)', homeByMinutes: 'Home by (minute of day)',
  budgetPerPersonHKD: 'Budget per person, HKD', partySize: 'Adults', mealMinutes: 'Base dinner, minutes', walkMinutes: 'Base walk, minutes',
  'weights.price': 'Price scoring weight (off)', 'weights.ease': 'Ease scoring weight (off)', 'weights.discovery': 'Discovery scoring weight (off)',
  szRoute: 'Shenzhen route', fxHKDPerCNY: 'HKD per CNY', borderBufferMinutes: 'Clearance allowance each way, minutes',
  crossingClosingBufferMinutes: 'Before border closure, minutes', hkLocalMinutes: 'HK travel each way, minutes', szLocalMinutes: 'SZ transfer each way, minutes',
  entryEligibility: 'Entry eligibility',
};
export const inputLabel = (key: string) => {
  if (inputLabels[key]) return inputLabels[key];
  const [, city, field] = key.split('.');
  const prefix = city === 'hk' ? 'Hong Kong' : 'Shenzhen';
  if (key.startsWith('familiarity.')) return `${prefix} · ${field} familiarity`;
  return `${prefix} · ${{ mealMinutes: 'dinner minutes', walkMinutes: 'walk minutes', includeSharedOrder: 'shared order included', storyDelayMinutes: 'added delay minutes' }[field] ?? field}`;
};

/** Presentation only: these boundaries come from a single matched engine option. */
export function segmentsFor(option: DecisionOption): Segment[] {
  const crossing = option.crossingPlan;
  const outward: Segment[] = crossing ? [
    { id: 'outward-rail', label: 'Rail to Lo Wu', start: option.departureMinutes, end: crossing.outwardStartMinutes, kind: 'travel' },
    { id: 'outward-clearance', label: 'Outward clearance allowance', start: crossing.outwardStartMinutes, end: crossing.outwardEndMinutes, kind: 'clearance' },
    { id: 'outward-transfer', label: 'Transfer to Luohu dinner', start: crossing.outwardEndMinutes, end: option.arrivalMinutes, kind: 'travel' },
  ] : [{ id: 'outward-local', label: 'Local trip out', start: option.departureMinutes, end: option.arrivalMinutes, kind: 'travel' }];
  const inward: Segment[] = crossing ? [
    { id: 'return-transfer', label: 'Transfer back to Lo Wu', start: option.experienceEndMinutes, end: crossing.inwardStartMinutes, kind: 'travel' },
    { id: 'return-clearance', label: 'Return clearance allowance', start: crossing.inwardStartMinutes, end: crossing.inwardEndMinutes, kind: 'clearance' },
    { id: 'return-rail', label: 'Rail back to Kowloon', start: crossing.inwardEndMinutes, end: option.returnMinutes, kind: 'travel' },
  ] : [{ id: 'return-local', label: 'Local trip home', start: option.experienceEndMinutes, end: option.returnMinutes, kind: 'travel' }];
  return [...outward,
    { id: 'dinner', label: 'Dinner + shared order', start: option.arrivalMinutes, end: option.arrivalMinutes + option.mealMinutes, kind: 'dinner' },
    { id: 'walk', label: 'Walk', start: option.arrivalMinutes + option.mealMinutes, end: option.experienceEndMinutes, kind: 'walk' },
    ...inward];
}

const objects: { id: SceneObject; x: number; y: number; label: string; symbol: string }[] = [
  { id: 'menu', x: .61, y: .62, label: 'Menu See both bills', symbol: '≡' },
  { id: 'map', x: .69, y: .65, label: 'Map Unfold both routes', symbol: '↔' },
  { id: 'phone', x: .76, y: .66, label: 'Phone Adjust one time', symbol: '◷' },
];

/** The bitmap and every physical target use this one measured transform. */
export function DecisionStreet({ attended, surface, onOpen, failed, onFailure, idPrefix = 'decision', objectLabels, objectCaptions, decoration }: {
  attended: SceneObject; surface: string | null; idPrefix?: string; objectLabels?: Record<SceneObject, string>; objectCaptions?: Record<SceneObject, string>; decoration?: (geometry: StreetGeometry) => ReactNode; onOpen: (object: SceneObject) => void; failed: boolean; onFailure: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ width: 1672, height: 941, left: 0, top: 0 });
  const [fallbackOpen, setFallbackOpen] = useState(false);
  useLayoutEffect(() => {
    if (!frame.current) return;
    const measure = () => {
      const box = frame.current!.getBoundingClientRect();
      // A hidden sibling keeps its last geometry for an exact return.
      if (!box.width || !box.height) return;
      const mobile = window.matchMedia('(max-width: 899px)').matches;
      const scale = Math.max(box.width / 1672, box.height / 941, mobile ? 640 / 1672 : 0);
      const width = 1672 * scale;
      const height = 941 * scale;
      const left = mobile ? Math.min(0, Math.max(box.width - width, box.width / 2 - width * .69)) : (box.width - width) / 2;
      setGeometry({ width, height, left, top: (box.height - height) / 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  return <section className="decision-world" aria-label="An imagined Hong Kong street at dusk">
    <div ref={frame} className="decision-world-image-frame" data-testid={`${idPrefix}-world-frame`}>
      {!failed ? <img className="decision-world-image" src={art('decision-hk-pixel.webp')} width="1672" height="941"
        style={geometry} alt="A Hong Kong-inspired street at dusk, with a rail entrance and a small dining counter. A menu, folded map and phone rest on the counter."
        onError={onFailure}/> : <div className="decision-world-fallback"><svg className="decision-desk-art" viewBox="0 0 640 360" aria-hidden="true"><path fill="#807060" d="M0 0h640v360H0z"/><path fill="#3e514f" d="M0 195h640v165H0z"/><path fill="#b99b70" d="M90 35h440v270H90z"/><path fill="#69775e" d="M70 40h480v35H70z"/><path fill="#ead0a0" d="M115 90h175v118H115zM315 90h185v118H315z"/><path fill="#705146" d="M70 238h500v18H70zM100 256h15v90h-15zM525 256h15v90h-15z"/><path fill="#ead8ae" d="M330 201h38v34h-38zM395 210h55v25h-55z"/><path fill="#344f58" d="M470 207h21v28h-21z"/><path fill="#c6a162" d="M150 295h72v8h-72zM365 294h72v8h-72z"/><path fill="#35433f" d="M150 303h8v57h-8zM214 303h8v57h-8zM365 302h8v58h-8zM429 302h8v58h-8z"/></svg><p>The illustration couldn’t load. The comparison and every object still work.</p></div>}
      {decoration?.(geometry)}
      <div className="decision-physical-objects" role="group" aria-label="Objects on the counter">
        {objects.map(object => <button key={object.id} id={`${idPrefix}-object-${object.id}`} type="button" className={`decision-hotspot ${attended === object.id ? 'is-attended' : ''}`}
          data-object-id={object.id} data-source-x={object.x} data-source-y={object.y}
          style={{ left: geometry.left + geometry.width * object.x, top: geometry.top + geometry.height * object.y }}
          aria-label={objectLabels?.[object.id] ?? object.label} aria-expanded={surface === object.id} aria-controls={surface ? `${idPrefix}-sheet` : undefined} onClick={() => onOpen(object.id)}>
          <span className="decision-hotspot-mark" aria-hidden="true">{object.symbol}</span><span className="decision-hotspot-label" aria-hidden="true">{objectCaptions?.[object.id] ?? (object.id === 'map' ? 'Map · compare' : object.id === 'phone' ? 'Phone · the clock' : 'Menu · the bill')}</span>
        </button>)}
      </div>
    </div>
    <div className="decision-world-visible" data-testid={`${idPrefix}-world-visible`} aria-hidden="true"/>
    <div className="decision-object-fallback" onKeyDown={event => { if (event.key === 'Escape' && fallbackOpen) { event.preventDefault(); event.stopPropagation(); setFallbackOpen(false); requestAnimationFrame(() => document.getElementById(`${idPrefix}-choose-object`)?.focus({ preventScroll: true })); } }}><button id={`${idPrefix}-choose-object`} type="button" aria-label="Choose an object" aria-expanded={fallbackOpen} onClick={() => setFallbackOpen(value => !value)}>Objects <span aria-hidden="true">⌄</span></button>{fallbackOpen && <div role="group" aria-label="Named object controls">{objects.map(object => <button key={object.id} type="button" onClick={() => { setFallbackOpen(false); onOpen(object.id); }}>{object.id === 'map' ? 'Open map' : object.id === 'phone' ? 'Open phone' : 'Open menu'}</button>)}</div>}</div>
    <p className="decision-world-caption">Imagined setting · authored example</p>
  </section>;
}

export function CompleteComparison({ snapshot, selected, idPrefix = 'decision', averageLabel = false }: { snapshot: ComparisonSnapshot; selected?: 'hk' | 'sz'; idPrefix?: string; averageLabel?: boolean }) {
  const deadline = snapshot.inputs.homeByMinutes;
  return <section className="decision-comparison" aria-label="Two complete evenings on the same clock">
    <div className="decision-comparison-brief"><span>90 min dinner + shared order</span><span>To 02:00 next day · UTC+8</span></div>
    <div role="group" className="decision-time-axis" aria-label="Common absolute time scale, 15:00 to 02:00 the next day, UTC plus eight">{[15, 17, 19, 21, 23, 26].map(hour => <span key={hour} data-hour={hour} style={{ left: position(hour * 60) }}>{shortClock(hour * 60)}</span>)}</div>
    <div className="decision-timeline-pair">
      <div className="decision-deadline-line" data-testid={`${idPrefix}-deadline-marker`} data-deadline-minute={deadline} style={{ left: position(deadline) }}><span>{shortClock(deadline)}<small>{deadline >= 1440 ? 'next day · home by' : 'home by'}</small></span></div>
      {snapshot.result.options.map(option => <article key={option.id} className={`decision-option decision-option-${option.id}${selected === option.id ? ' is-selected' : ''}`}
        aria-labelledby={`${idPrefix}-title-${option.id}`} data-testid={`${idPrefix}-outcome-${option.id.toUpperCase()}`}
        data-option-id={option.id} data-snapshot-id={snapshot.id} data-home-minute={option.returnMinutes} data-cost-hkd={option.perPersonHKD ?? 'unknown'} data-group-hkd={option.groupHKD ?? 'unknown'}
        data-dinner-minutes={option.mealMinutes} data-walk-minutes={option.walkMinutes} data-deadline-minute={option.homeByMinutes} data-departure-minute={option.departureMinutes} data-home-fit={option.homeFeasible} data-crossing-fit={option.crossingFeasible} data-entry-fit={option.entryFeasible === null ? 'unknown' : option.entryFeasible}>
        <div className="decision-lane-heading"><h3 id={`${idPrefix}-title-${option.id}`}>{cityName(option.id)}<small className={!option.crossingFeasible ? 'decision-border-failure' : undefined} data-testid={`${idPrefix}-border-${option.id.toUpperCase()}`} role="group" aria-label={option.id === 'sz' ? `Modeled border clearance ${option.crossingFeasible ? 'fits the modeled crossing window and closing buffer; entry and services remain unknown' : 'misses the modeled crossing window or closing buffer'}` : undefined}>{option.id === 'hk' ? 'local evening' : option.crossingFeasible ? 'rail via Lo Wu' : 'Crossing: no fit'}</small></h3><div className="decision-key-figures"><div><strong>{money(option.perPersonHKD)}</strong><small>{averageLabel ? 'average / person' : '/ person'}</small></div><div><strong>{shortClock(option.returnMinutes)}</strong><small>{option.returnMinutes >= 1440 ? <span className="decision-next-day" data-testid={`${idPrefix}-next-day-${option.id.toUpperCase()}`}>next day · home</span> : 'modeled home'}</small></div></div></div>
        <div role="group" className="decision-timeline-track" data-testid={`${idPrefix}-timeline-${option.id.toUpperCase()}`} data-option-id={option.id}
          data-scale-start-minute={SCALE_START} data-scale-end-minute={SCALE_END} aria-label={`${cityName(option.id)} complete evening on the 15:00 to 02:00 next-day scale`}>
          {segmentsFor(option).map(segment => <span key={segment.id} className={`decision-time-segment ${segment.kind}`} data-segment-id={segment.id} data-start-minute={segment.start} data-end-minute={segment.end}
            style={{ left: position(segment.start), width: `${(segment.end - segment.start) / (SCALE_END - SCALE_START) * 100}%` }}>
            <span className="decision-sr-only">{segment.label}: {clockLabel(segment.start)}–{clockLabel(segment.end)}, {segment.end - segment.start} minutes.</span></span>)}
          <span className={`decision-home-pin ${option.homeFeasible ? '' : 'is-late'}`} style={{ left: position(option.returnMinutes) }} aria-hidden="true"/>
        </div>
        <div className="decision-lane-facts"><span>Dinner {option.mealMinutes} min · walk {option.walkMinutes} min</span><span className={option.homeFeasible ? '' : 'is-late'}>{option.homeFeasible ? `${option.spareMinutes} min modeled slack` : `${-option.spareMinutes} min late`}</span></div>
        <p className="decision-lane-route decision-sr-only">{option.outwardMinutes} min out + {option.inwardMinutes} min home · shared order included</p>
      </article>)}
    </div>
    <div className="decision-time-key"><span><i className="travel"/>Travel</span><span><i className="clearance"/>Clearance</span><span><i className="dinner"/>Dinner</span><span><i className="walk"/>Walk</span><span>UTC+8</span></div>
  </section>;
}

