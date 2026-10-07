import { useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { formatClock } from '../domain/engine';
import { sources } from '../data/evidence';
import { createDecisionSession, decisionReducer, previewRevision, previewTimeChange, selectDecisionView, DECISION_TIME_LIMITS, DECISION_TIMELINE_RANGE } from '../decision/session';
import type { DecisionSnapshot, Priority, SnapshotId, RevisionId, TimeChange, TimeChangeField } from '../decision/session';
import './decision-experience.css';

type DecisionOption = DecisionSnapshot['result']['options'][number];
type Segment = { id: string; label: string; start: number; end: number; kind: 'travel' | 'clearance' | 'dinner' | 'walk' };
type CoreObject = 'map' | 'phone';
type SceneObject = CoreObject | 'menu';
type Surface = SceneObject | 'priorities' | 'sources' | 'history' | 'route' | 'details' | 'about' | null;
const stages: { id: SnapshotId; label: string; number: string }[] = [
  { id: 'baseline', label: 'Before', number: '01' },
  { id: 'changed', label: 'Changed', number: '02' },
  { id: 'revised', label: 'Revised', number: '03' },
];
const priorityLabels: Record<Priority, string> = { food: 'Food', company: 'Company', comfort: 'Comfort', exploration: 'Exploration' };
const priorities: Priority[] = ['food', 'company', 'comfort', 'exploration'];
const art = (name: string) => (globalThis as typeof globalThis & { __BETWEEN_ART__?: Record<string, string> }).__BETWEEN_ART__?.[name] ?? `${import.meta.env.BASE_URL}art/${name}`;
const cityName = (id: 'hk' | 'sz') => id === 'hk' ? 'Hong Kong' : 'Shenzhen';
const money = (amount: number | null) => amount === null ? 'Unknown' : `HK$${amount.toLocaleString('en-HK', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
const nativeMoney = (amount: number | null, currency: string) => amount === null ? 'Unknown' : `${currency} ${amount.toFixed(2)}`;
const SCALE_START = DECISION_TIMELINE_RANGE.startMinutes;
const SCALE_END = DECISION_TIMELINE_RANGE.endMinutes;
const shortClock = (minutes: number) => formatClock(minutes % 1440);
const clockLabel = (minutes: number) => `${shortClock(minutes)}${minutes >= 1440 ? ' next day' : ''}`;
const fieldName = (field: TimeChangeField) => field === 'departureMinutes' ? 'Departure' : 'Home-by';
const fitSummary = (option: DecisionOption) => `${option.homeFeasible ? `${option.spareMinutes} min modeled slack.` : `${-option.spareMinutes} min past home-by.`}${!option.crossingFeasible ? ' Modeled crossing window or closing buffer not met.' : ''}`;
const position = (minute: number) => `${(minute - SCALE_START) / (SCALE_END - SCALE_START) * 100}%`;
function inputLeaves(value: unknown, path = ''): { key: string; value: string }[] {
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
const inputLabel = (key: string) => {
  if (inputLabels[key]) return inputLabels[key];
  const [, city, field] = key.split('.');
  const prefix = city === 'hk' ? 'Hong Kong' : 'Shenzhen';
  if (key.startsWith('familiarity.')) return `${prefix} · ${field} familiarity`;
  return `${prefix} · ${{ mealMinutes: 'dinner minutes', walkMinutes: 'walk minutes', includeSharedOrder: 'shared order included', storyDelayMinutes: 'added delay minutes' }[field] ?? field}`;
};

/** Presentation only: these boundaries come from a single matched engine option. */
function segmentsFor(option: DecisionOption): Segment[] {
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
function DecisionStreet({ attended, surface, onOpen, failed, onFailure }: {
  attended: SceneObject; surface: Surface; onOpen: (object: SceneObject) => void; failed: boolean; onFailure: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ width: 1672, height: 941, left: 0, top: 0 });
  const [fallbackOpen, setFallbackOpen] = useState(false);
  useLayoutEffect(() => {
    if (!frame.current) return;
    const measure = () => {
      const box = frame.current!.getBoundingClientRect();
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
    <div ref={frame} className="decision-world-image-frame" data-testid="decision-world-frame">
      {!failed ? <img className="decision-world-image" src={art('decision-hk-pixel.webp')} width="1672" height="941"
        style={geometry} alt="A Hong Kong-inspired street at dusk, with a rail entrance and a small dining counter. A menu, folded map and phone rest on the counter."
        onError={onFailure}/> : <div className="decision-world-fallback"><svg className="decision-desk-art" viewBox="0 0 640 360" aria-hidden="true"><path fill="#807060" d="M0 0h640v360H0z"/><path fill="#3e514f" d="M0 195h640v165H0z"/><path fill="#b99b70" d="M90 35h440v270H90z"/><path fill="#69775e" d="M70 40h480v35H70z"/><path fill="#ead0a0" d="M115 90h175v118H115zM315 90h185v118H315z"/><path fill="#705146" d="M70 238h500v18H70zM100 256h15v90h-15zM525 256h15v90h-15z"/><path fill="#ead8ae" d="M330 201h38v34h-38zM395 210h55v25h-55z"/><path fill="#344f58" d="M470 207h21v28h-21z"/><path fill="#c6a162" d="M150 295h72v8h-72zM365 294h72v8h-72z"/><path fill="#35433f" d="M150 303h8v57h-8zM214 303h8v57h-8zM365 302h8v58h-8zM429 302h8v58h-8z"/></svg><p>The illustration couldn’t load. The comparison and every object still work.</p></div>}
      <div className="decision-physical-objects" role="group" aria-label="Objects on the counter">
        {objects.map(object => <button key={object.id} id={`decision-object-${object.id}`} type="button" className={`decision-hotspot ${attended === object.id ? 'is-attended' : ''}`}
          data-object-id={object.id} data-source-x={object.x} data-source-y={object.y}
          style={{ left: geometry.left + geometry.width * object.x, top: geometry.top + geometry.height * object.y }}
          aria-label={object.label} aria-expanded={surface === object.id} aria-controls={surface ? 'decision-sheet' : undefined} onClick={() => onOpen(object.id)}>
          <span className="decision-hotspot-mark" aria-hidden="true">{object.symbol}</span><span className="decision-hotspot-label" aria-hidden="true">{object.id === 'map' ? 'Map · compare' : object.id === 'phone' ? 'Phone · the clock' : 'Menu · the bill'}</span>
        </button>)}
      </div>
    </div>
    <div className="decision-world-visible" data-testid="decision-world-visible" aria-hidden="true"/>
    <div className="decision-object-fallback" onKeyDown={event => { if (event.key === 'Escape' && fallbackOpen) { event.preventDefault(); event.stopPropagation(); setFallbackOpen(false); requestAnimationFrame(() => document.getElementById('decision-choose-object')?.focus({ preventScroll: true })); } }}><button id="decision-choose-object" type="button" aria-label="Choose an object" aria-expanded={fallbackOpen} onClick={() => setFallbackOpen(value => !value)}>Objects <span aria-hidden="true">⌄</span></button>{fallbackOpen && <div role="group" aria-label="Named object controls">{objects.map(object => <button key={object.id} type="button" onClick={() => { setFallbackOpen(false); onOpen(object.id); }}>{object.id === 'map' ? 'Open map' : object.id === 'phone' ? 'Open phone' : 'Open menu'}</button>)}</div>}</div>
    <p className="decision-world-caption">Imagined setting · authored example</p>
  </section>;
}

function CompleteComparison({ snapshot, selected }: { snapshot: DecisionSnapshot; selected?: 'hk' | 'sz' }) {
  const deadline = snapshot.inputs.homeByMinutes;
  return <section className="decision-comparison" aria-label="Two complete evenings on the same clock">
    <div className="decision-comparison-brief"><span>90 min dinner + shared order</span><span>To 02:00 next day · UTC+8</span></div>
    <div role="group" className="decision-time-axis" aria-label="Common absolute time scale, 15:00 to 02:00 the next day, UTC plus eight">{[15, 17, 19, 21, 23, 26].map(hour => <span key={hour} data-hour={hour} style={{ left: position(hour * 60) }}>{shortClock(hour * 60)}</span>)}</div>
    <div className="decision-timeline-pair">
      <div className="decision-deadline-line" data-testid="decision-deadline-marker" data-deadline-minute={deadline} style={{ left: position(deadline) }}><span>{shortClock(deadline)}<small>{deadline >= 1440 ? 'next day · home by' : 'home by'}</small></span></div>
      {snapshot.result.options.map(option => <article key={option.id} className={`decision-option decision-option-${option.id}${selected === option.id ? ' is-selected' : ''}`}
        aria-labelledby={`decision-title-${option.id}`} data-testid={`decision-outcome-${option.id.toUpperCase()}`}
        data-option-id={option.id} data-snapshot-id={snapshot.id} data-home-minute={option.returnMinutes} data-cost-hkd={option.perPersonHKD ?? 'unknown'}
        data-dinner-minutes={option.mealMinutes} data-walk-minutes={option.walkMinutes} data-deadline-minute={option.homeByMinutes} data-departure-minute={option.departureMinutes} data-home-fit={option.homeFeasible} data-crossing-fit={option.crossingFeasible} data-entry-fit={option.entryFeasible === null ? 'unknown' : option.entryFeasible}>
        <div className="decision-lane-heading"><h3 id={`decision-title-${option.id}`}>{cityName(option.id)}<small className={!option.crossingFeasible ? 'decision-border-failure' : undefined} data-testid={`decision-border-${option.id.toUpperCase()}`} role="group" aria-label={option.id === 'sz' ? `Modeled border clearance ${option.crossingFeasible ? 'fits the modeled crossing window and closing buffer; entry and services remain unknown' : 'misses the modeled crossing window or closing buffer'}` : undefined}>{option.id === 'hk' ? 'local evening' : option.crossingFeasible ? 'rail via Lo Wu' : 'Crossing: no fit'}</small></h3><div className="decision-key-figures"><div><strong>{money(option.perPersonHKD)}</strong><small>/ person</small></div><div><strong>{shortClock(option.returnMinutes)}</strong><small>{option.returnMinutes >= 1440 ? <span className="decision-next-day" data-testid={`decision-next-day-${option.id.toUpperCase()}`}>next day · home</span> : 'modeled home'}</small></div></div></div>
        <div role="group" className="decision-timeline-track" data-testid={`decision-timeline-${option.id.toUpperCase()}`} data-option-id={option.id}
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

function RouteInspector({ snapshot }: { snapshot: DecisionSnapshot }) {
  const [route, setRoute] = useState<'hk' | 'sz'>('sz');
  const option = snapshot.result.options.find(item => item.id === route)!;
  return <section className="decision-route-inspector"><p>Complete journeys on a schematic. This is not geographic routing or a timetable.</p>
    <div role="group" className="decision-route-tabs" aria-label="Inspect a complete route">{(['hk', 'sz'] as const).map(id => <button key={id} type="button" aria-pressed={route === id} onClick={() => setRoute(id)}>{cityName(id)} route</button>)}</div>
    <div role="group" className={`decision-route-map ${route}`} aria-label={route === 'sz' ? 'Kowloon through Lo Wu to Luohu, then back through Lo Wu to Kowloon' : 'Kowloon to local dinner and walking, then home'}><span>Kowloon<br/><small>start / home</small></span><i aria-hidden="true">⇄</i>{route === 'sz' && <><span>Lo Wu<br/><small>both crossings</small></span><i aria-hidden="true">⇄</i></>}<span>{route === 'sz' ? 'Luohu' : 'Local area'}<br/><small>dinner + walk</small></span></div>
    {option.crossingPlan && <section className="decision-crossing-check" data-testid="decision-crossing-detail"><h3>Modeled crossing check</h3><p>Outward clearance: {clockLabel(option.crossingPlan.outwardStartMinutes)}–{clockLabel(option.crossingPlan.outwardEndMinutes)}.<br/>Return clearance: {clockLabel(option.crossingPlan.inwardStartMinutes)}–{clockLabel(option.crossingPlan.inwardEndMinutes)}.</p><p>Normal published hours: {shortClock(option.crossingPlan.openingMinutes)}–{shortClock(option.crossingPlan.closingMinutes)}. Chosen closing buffer: {option.crossingPlan.closingBufferMinutes} min.</p><p className={option.crossingFeasible ? undefined : 'decision-remaining-failure'}>{option.crossingFeasible ? 'Clearance fits the modeled window and closing buffer. Entry and actual service remain unverified.' : 'Clearance misses the modeled crossing window or closing buffer. This is not a claim that the border is already closed.'}</p><p>{fitSummary(option)} Modeled slack is not a guarantee.</p></section>}
    <div className="decision-route-legs"><h3>Inspect the trip out and home</h3><ol>{segmentsFor(option).map(segment => <li key={segment.id}><span className={`decision-step-dot ${segment.kind}`} aria-hidden="true"/><div><strong>{segment.label}</strong><span>{clockLabel(segment.start)}–{clockLabel(segment.end)} · {segment.end - segment.start} min</span>{segment.kind === 'clearance' && <small>Authored allowance. Actual queues are unknown.</small>}</div></li>)}</ol></div>
  </section>;
}
function Bills({ snapshot }: { snapshot: DecisionSnapshot }) {
  return <div className="decision-bills">
    <p>Every price, the FX rate and every journey duration below is an authored assumption. Shared orders are charged once for two adults. No live quotes.</p>
    <div className="decision-bill-pair">{snapshot.result.options.map(option => <section key={option.id} aria-labelledby={`bill-title-${option.id}`}><h3 id={`bill-title-${option.id}`}>{cityName(option.id)} · bill for two</h3><ul>{option.lineItems.map(line => <li key={line.id} data-cost-line-id={line.id} data-native-group-amount={line.nativeGroupAmount ?? 'unknown'} data-hkd-group-amount={line.hkdGroupAmount ?? 'unknown'} data-currency={line.currency}><div><strong>{line.label}</strong><small>{line.scope === 'group' ? 'One shared group charge' : `${line.quantity} × each person, for ${snapshot.inputs.partySize} adults`}</small></div><div><span>{nativeMoney(line.nativeGroupAmount, line.currency)}</span>{line.currency === 'CNY' && <small>≈ {money(line.hkdGroupAmount)}</small>}</div></li>)}</ul><p className="decision-bill-total"><strong>Group total</strong><strong>{money(option.groupHKD)}</strong></p><p>{money(option.perPersonHKD)} per person · {option.budgetFeasible === true ? `within the ${money(snapshot.inputs.budgetPerPersonHKD)} budget` : option.budgetFeasible === false ? 'over budget' : 'budget fit unknown'}</p>{option.missingCostLabels.length > 0 && <p>Total unknown. Missing: {option.missingCostLabels.join(', ')}. Known subtotal only: {money(option.knownGroupSubtotalHKD)}.</p>}</section>)}</div>
    <p className="decision-small">1 CNY = {snapshot.inputs.fxHKDPerCNY} HKD (authored). Native prices are rounded to cents; converted group line items are rounded before adding. Per-person amounts are rounded averages.</p>
    <details className="decision-assumptions"><summary>Inputs used in this comparison <span aria-hidden="true">+</span></summary><p className="decision-small">Any clock you change is your scenario input. Prices, durations and other numeric assumptions remain authored.</p><dl>
      <div><dt>People and origin</dt><dd>{snapshot.inputs.partySize} adults · Kowloon</dd></div><div><dt>Displayed departure</dt><dd>{clockLabel(snapshot.inputs.departureMinutes)} · UTC+8</dd></div><div><dt>Displayed home-by deadline</dt><dd>{clockLabel(snapshot.inputs.homeByMinutes)} · UTC+8</dd></div><div><dt>Budget</dt><dd>{money(snapshot.inputs.budgetPerPersonHKD)} per person</dd></div>
      {snapshot.result.options.map(option => <div key={option.id}><dt>{cityName(option.id)} activities</dt><dd>Dinner {option.mealMinutes} min · walk {option.walkMinutes} min · shared order {option.includeSharedOrder ? 'included' : 'omitted'} · added delay {option.storyDelayMinutes} min</dd></div>)}
      <div><dt>Shenzhen route</dt><dd>Rail via Lo Wu · 50 min rail, 30 min clearance allowance and 25 min destination transfer each way</dd></div><div><dt>Hong Kong travel</dt><dd>15 min local travel each way</dd></div><div><dt>FX</dt><dd>{snapshot.inputs.fxHKDPerCNY} HKD per CNY</dd></div><div><dt>Real entry and familiarity</dt><dd>Entry unconfirmed; familiarity with either city’s dinner and walk unknown</dd></div><div><dt>Preference scoring</dt><dd>No composite scores. Your priorities do not change model inputs.</dd></div>
    </dl><section className="decision-exact-inputs"><h4>Exact input values used by the model</h4><p className="decision-small">Clock values below are minutes after midnight (17:00 = 1020). “Unsure” stays unknown. Zero scoring weights keep composite scores off.</p><dl>{inputLeaves(snapshot.inputs).map(fact => <div key={fact.key} data-input-key={fact.key} data-input-value={fact.value}><dt>{inputLabel(fact.key)}</dt><dd>{fact.value}</dd></div>)}</dl></section></details>
  </div>;
}

function Evidence() {
  return <div className="decision-evidence"><section><p className="decision-eyebrow">Authored assumptions</p><h3>Prices and durations are a worked example.</h3><p>Meals, shared orders, fares, travel, clearance allowances and FX are illustrative, not live quotes, queues, a timetable or a real travel plan. Unknown costs remain unknown, never zero.</p></section><section><p className="decision-eyebrow">Separate published fact</p><h3>Lo Wu passenger clearance: 06:30–00:00.</h3><p><a href={sources[0].href!} target="_blank" rel="noreferrer">Hong Kong Immigration Department · control points</a>. Checked 6 October 2026; page dated 26 June 2026. These are normal published hours, not live operating status.</p><p>The model keeps a 15-minute closing buffer. Fitting the published window is not a guarantee of a last train, seat, actual queue or entry permission.</p></section><section><p className="decision-eyebrow">Still unresolved</p><h3>Entry, service, prices and familiarity.</h3><p>Every traveler must check entry and return eligibility. Real transport services, restaurant availability, prices and queues remain unverified. Familiarity with either city’s dinner and walk is unknown. No preference score is invented.</p><p><a href="https://www.mtr.com.hk/en/customer/jp/index.php" target="_blank" rel="noreferrer">MTR route and fare planner</a> is a place to check, not the source for this example’s numbers.</p></section></div>;
}

const detailTitles: Partial<Record<NonNullable<Surface>, string>> = {
  menu: 'Both complete bills', priorities: 'What matters to you?', sources: 'Sources and unknowns',
  history: 'Before → changed → revised', route: 'The trip out and home', details: 'Take a closer look', about: 'About this example',
};

function PhoneClock({ draft, baselineMinutes, valid, onSet, onApply, onCancel }: {
  draft: TimeChange; baselineMinutes: number; valid: boolean; onSet: (minutes: number) => void; onApply: () => void; onCancel: () => void;
}) {
  const limits = DECISION_TIME_LIMITS[draft.field];
  const values = Array.from({ length: (limits.max - limits.min) / limits.step + 1 }, (_, index) => limits.min + index * limits.step);
  return <section className="decision-clock-editor" data-testid="decision-time-editor" data-time-field={draft.field} data-time-minute={draft.minutes} aria-label={`${fieldName(draft.field)} time preview`}>
    <div className="decision-clock-controls"><button type="button" aria-label="15 minutes earlier" disabled={draft.minutes <= limits.min} onClick={() => onSet(draft.minutes - limits.step)}>−15</button><label className="decision-clock-value"><span className="decision-sr-only">{fieldName(draft.field)} time</span><select id="decision-time-select" aria-describedby="decision-time-preview-summary" value={draft.minutes} onChange={event => onSet(Number(event.target.value))}>{values.map(minutes => <option key={minutes} value={minutes}>{clockLabel(minutes)}</option>)}</select></label><button type="button" aria-label="15 minutes later" disabled={draft.minutes >= limits.max} onClick={() => onSet(draft.minutes + limits.step)}>+15</button></div>
    <p id="decision-time-preview-summary" data-testid="decision-time-preview-summary" className="decision-clock-summary" aria-live="polite">{valid ? `${fieldName(draft.field)} ${clockLabel(baselineMinutes)} → ${clockLabel(draft.minutes)}. Other inputs fixed.` : `${clockLabel(limits.min)}–${clockLabel(limits.max)}, in 15-minute steps. Choose a different time.`}</p>
    <div className="decision-action-pair"><button type="button" className="decision-primary" disabled={!valid} onClick={onApply}>Apply time change</button><button type="button" className="decision-secondary" onClick={onCancel}>Cancel time preview</button></div>
  </section>;
}

export function DecisionExperience() {
  const [session, dispatch] = useReducer(decisionReducer, undefined, createDecisionSession);
  const [surface, setSurface] = useState<Surface>('map');
  const [walkPreview, setWalkPreview] = useState(false);
  const [timeDraft, setTimeDraft] = useState<TimeChange | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [reasonDrafts, setReasonDrafts] = useState<Partial<Record<SnapshotId, string>>>({});
  const returnCore = useRef<CoreObject>('map');
  const timeResult = useMemo(() => timeDraft ? previewTimeChange(session, timeDraft) : null, [session, timeDraft]);
  const walkSnapshot = useMemo(() => walkPreview ? previewRevision(session, 'shorten-sz') : null, [session, walkPreview]);
  const preview = walkPreview || timeDraft !== null;
  const snapshot = (walkSnapshot ?? (timeResult?.valid ? timeResult.snapshot : null) ?? session.snapshots[session.displayedSnapshotId])!;
  const currentChoice = preview ? null : session.choices[snapshot.id];
  const view = selectDecisionView(session);
  const core = surface === 'map' || surface === 'phone';
  const viewingPast = session.displayedSnapshotId !== session.stage && !preview;
  const baseline = session.snapshots.baseline;
  const baselineChoice = session.choices.baseline;
  const sz = snapshot.result.options.find(option => option.id === 'sz')!;
  const baselineSz = baseline.result.options.find(option => option.id === 'sz')!;
  const selectedOption = currentChoice ? snapshot.result.options.find(option => option.id === currentChoice.optionId)! : null;
  const attended: SceneObject = surface === 'menu' ? 'menu' : core ? surface : baselineChoice ? 'phone' : 'map';
  const focus = (id = 'decision-sheet-heading') => requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
  const openObject = (object: SceneObject) => { if (object !== 'menu') returnCore.current = object; setSurface(object); focus(); };
  const openDetail = (next: Surface) => { if (core) returnCore.current = surface; setSurface(next); focus(); };
  const back = () => { setSurface(returnCore.current); focus(); };
  const close = () => { const object = attended; setSurface(null); focus(`decision-object-${object}`); };
  const choose = (optionId: 'hk' | 'sz') => {
    if (session.choices.baseline?.optionId !== optionId) setReasonDrafts(previous => ({ ...previous, baseline: '' }));
    dispatch({ type: 'choose-option', snapshotId: 'baseline', optionId });
    returnCore.current = 'phone'; setSurface('phone'); focus();
    setAnnouncement(`You selected ${cityName(optionId)} for now. Choose one time to reconsider on the phone.`);
  };
  const beginTimeChange = (field: TimeChangeField) => { setTimeDraft({ field, minutes: baseline.inputs[field] }); returnCore.current = 'phone'; setSurface('phone'); focus('decision-time-select'); };
  const cancelTime = () => { setTimeDraft(null); setSurface('phone'); returnCore.current = 'phone'; focus(); setAnnouncement('Time preview canceled. The exact starting comparison and your tentative choice are restored.'); };
  const applyTime = () => {
    if (!timeDraft || !timeResult?.valid) return;
    dispatch({ type: 'change-time', ...timeDraft });
    setTimeDraft(null); setSurface('phone'); returnCore.current = 'phone'; focus('decision-feedback');
    setAnnouncement(`${fieldName(timeDraft.field)} changed from ${clockLabel(baseline.inputs[timeDraft.field])} to ${clockLabel(timeDraft.minutes)}. Other inputs stayed fixed.`);
  };
  const revise = (revision: RevisionId) => { dispatch({ type: 'apply-revision', revision }); setWalkPreview(false); setSurface('phone'); focus('decision-feedback'); setAnnouncement(revision === 'shorten-sz' ? 'You selected Shenzhen with a 15-minute walk. Review its remaining modeled time and border constraints.' : `You selected the full ${revision === 'keep-hk' ? 'Hong Kong' : 'Shenzhen'} plan. Its modeled constraints remain visible.`); };
  const setStage = (id: SnapshotId) => {
    if (preview) return;
    dispatch({ type: 'view-snapshot', snapshotId: id }); returnCore.current = 'phone'; setSurface('phone'); focus();
    setAnnouncement(`Viewing ${stages.find(stage => stage.id === id)!.label.toLowerCase()}: the exact two options from that step.`);
  };
  const canChoose = session.stage === 'baseline' && !viewingPast && !preview && (surface === 'map' || !baselineChoice);
  const committedChange = view.timeChange;
  const changeText = committedChange ? `${fieldName(committedChange.field)} ${clockLabel(committedChange.beforeMinutes)} → ${clockLabel(committedChange.afterMinutes)}` : 'No time changed';
  const unchangedText = committedChange?.field === 'homeByMinutes' ? 'Costs, activities and home times unchanged.' : 'Costs and activity durations unchanged.';
  const walkTradeoff = `${session.priorities.includes('exploration') ? 'You selected exploration. ' : ''}Walk ${baselineSz.walkMinutes} → ${sz.walkMinutes} min gives up ${baselineSz.walkMinutes - sz.walkMinutes} minutes walking. Same cost.`;
  const title = !core ? detailTitles[surface ?? 'about'] : viewingPast ? `${stages.find(stage => stage.id === snapshot.id)!.label}: the same comparison`
    : timeDraft ? `${fieldName(timeDraft.field)} preview` : walkPreview ? 'Trade 30 minutes of walking?'
    : session.stage === 'changed' ? 'Which full plan would you keep?' : session.stage === 'revised' ? 'Your choice, with its constraints'
    : baselineChoice && surface === 'phone' ? 'Which time has changed?' : 'Which evening would you try?';
  return <main className="decision-experience" data-testid="decision-experience" data-stage={session.stage} data-displayed-snapshot={snapshot.id} data-preview={preview} data-preview-kind={timeDraft ? 'time' : walkPreview ? 'walk' : 'none'} data-active-object={surface ?? 'closed'} data-attended-object={attended} aria-label="Crossing Lives, one evening reconsidered" onKeyDown={event => { if (event.key === 'Escape' && surface) { event.preventDefault(); event.stopPropagation(); if (core) close(); else back(); } }}>
    <DecisionStreet attended={attended} surface={surface} onOpen={openObject} failed={artFailed} onFailure={() => setArtFailed(true)}/>
    <div className="decision-context" data-testid="decision-context" role="group" aria-label={`${preview ? 'Preview' : snapshot.id === 'baseline' ? 'Starting authored' : 'Changed authored'} context; prices, party and origin stay fixed`}><span>Leave <strong>{shortClock(snapshot.inputs.departureMinutes)}</strong> · {snapshot.inputs.origin === 'kowloon' ? 'Kowloon' : 'Hong Kong Island'} · {snapshot.inputs.partySize} adults {preview && <em>preview</em>}</span><span><strong>{money(snapshot.inputs.budgetPerPersonHKD)}</strong> / person <i aria-hidden="true">·</i> home by <strong>{shortClock(snapshot.inputs.homeByMinutes)}</strong>{snapshot.inputs.homeByMinutes >= 1440 && <b className="decision-context-day"> next day</b>}</span></div>
    {surface && <section id="decision-sheet" data-testid="decision-sheet" data-active-object={surface} data-core={core} className={`decision-sheet ${core ? 'is-core' : 'is-detail'}`} aria-labelledby="decision-sheet-heading">
      <header className="decision-sheet-header">{(!core || timeDraft && surface === 'phone') && <button type="button" className="decision-back" aria-label={core ? 'Choose another circumstance' : 'Back to evening'} onClick={core ? cancelTime : back}><span aria-hidden="true">←</span></button>}<div><p className="decision-eyebrow">{core ? `${surface === 'map' ? 'The map' : 'The phone'} · ${preview ? 'preview only' : viewingPast ? 'replay' : snapshot.id === 'baseline' ? 'authored starting plan' : snapshot.id === 'changed' ? 'one time changed' : 'your chosen adjustment'}` : surface === 'menu' ? 'The menu · authored prices' : 'Optional inspection'}</p><h2 id="decision-sheet-heading" tabIndex={-1}>{title}</h2></div>{core && <button type="button" className="decision-put-down" aria-label={`Put down ${surface}`} onClick={close}>×</button>}</header>
      <div key={core ? 'core' : surface} className={`decision-sheet-body ${core ? 'decision-core-body' : 'decision-detail-body'}`}>
        {core ? <>
          <CompleteComparison snapshot={snapshot} selected={currentChoice?.optionId ?? undefined}/>
          {viewingPast ? <div className="decision-replay-note"><p>{stages.find(stage => stage.id === snapshot.id)?.label} pair · read-only.</p><nav className="decision-stage-nav" aria-label="Replay your decision">{stages.map(stage => <button key={stage.id} type="button" disabled={!session.snapshots[stage.id]} aria-current={snapshot.id === stage.id ? 'step' : undefined} onClick={() => setStage(stage.id)}>{stage.label}</button>)}</nav><button type="button" className="decision-primary" onClick={() => setStage(session.stage)}>Return to current decision</button></div>
          : timeDraft ? surface === 'phone' ? <PhoneClock draft={timeDraft} baselineMinutes={baseline.inputs[timeDraft.field]} valid={timeResult?.valid === true} onSet={minutes => setTimeDraft({ field: timeDraft.field, minutes })} onApply={applyTime} onCancel={cancelTime}/>
            : <section className="decision-phone-question"><p>Time preview only. The starting comparison is unchanged until you apply it.</p><button type="button" className="decision-primary" onClick={() => openObject('phone')}>Return to phone clock</button></section>
          : canChoose ? <div role="group" className="decision-choice-actions" aria-label="Choose a tentative evening">{(['hk', 'sz'] as const).map(id => <button key={id} type="button" className="decision-choice" aria-label={`Start with ${cityName(id)}`} aria-pressed={baselineChoice?.optionId === id} onClick={() => choose(id)}>{cityName(id)} <span aria-hidden="true">→</span></button>)}</div>
          : session.stage === 'baseline' ? <section className="decision-phone-question"><p>You selected <strong>{cityName(baselineChoice!.optionId)}</strong>. Try changing one circumstance.</p><div className="decision-action-pair"><button type="button" className="decision-secondary" onClick={() => beginTimeChange('departureMinutes')}>Change departure</button><button type="button" className="decision-primary" onClick={() => beginTimeChange('homeByMinutes')}>Change home-by</button></div></section>
          : <section id="decision-feedback" data-testid="decision-feedback" tabIndex={-1} className="decision-feedback" aria-label="What changes, and what stays the same" role="status">
            {walkPreview ? <><p>{walkTradeoff} <strong>{fitSummary(sz)}</strong></p><div className="decision-action-pair"><button className="decision-primary" type="button" aria-label="Choose shorter Shenzhen walk" onClick={() => revise('shorten-sz')}>Choose shorter walk</button><button className="decision-secondary" type="button" onClick={() => { setWalkPreview(false); focus('decision-feedback'); setAnnouncement('Walk preview canceled. The exact full evenings at the committed time are restored.'); }}>Cancel preview</button></div></>
            : session.stage === 'changed' ? <><p data-testid="decision-time-change-fact"><strong>{changeText}.</strong> {unchangedText}</p><div className="decision-action-pair decision-full-plan-choices"><button className="decision-choice" type="button" aria-label="Keep full Hong Kong evening" onClick={() => revise('keep-hk')}>Keep full Hong Kong</button><button className="decision-choice" type="button" aria-label="Keep full Shenzhen evening" onClick={() => revise('keep-sz')}>Keep full Shenzhen</button></div><button className="decision-short-walk" type="button" aria-label="Preview a shorter Shenzhen walk" onClick={() => { setWalkPreview(true); focus('decision-feedback'); setAnnouncement('Previewing a 15-minute Shenzhen walk. Its actual home and crossing-window fit remain visible.'); }}>Or try a shorter Shenzhen walk <span aria-hidden="true">→</span></button></>
            : <><p data-testid="decision-choice-status"><strong>{view.reconsideration.summary}</strong> {session.snapshots.revised?.revision === 'shorten-sz' ? walkTradeoff : 'Full dinner and walk kept.'} {selectedOption && <span className={!selectedOption.homeFeasible || !selectedOption.crossingFeasible ? 'decision-remaining-failure' : undefined}>{fitSummary(selectedOption)}</span>}</p><button className="decision-primary" type="button" onClick={() => openDetail('history')}>Replay the comparison <span aria-hidden="true">↶</span></button></>}
          </section>}
          <p className="decision-core-caveat">Authored prices and times. Entry, queues and services unknown. Modeled slack is not a guarantee.</p>
        </> : surface === 'menu' ? <Bills snapshot={snapshot}/>
        : surface === 'route' ? <RouteInspector snapshot={snapshot}/>
        : surface === 'sources' ? <Evidence/>
        : surface === 'priorities' ? <section className="decision-priorities"><p>Food, company, comfort, exploration: choose what matters to you. Neither city receives a score.</p><div className="decision-priority-buttons">{priorities.map(priority => <button key={priority} type="button" aria-pressed={session.priorities.includes(priority)} disabled={session.stage !== 'baseline' || viewingPast || preview} onClick={() => dispatch({ type: 'set-priorities', priorities: session.priorities.includes(priority) ? session.priorities.filter(value => value !== priority) : [...session.priorities, priority] })}>{priorityLabels[priority]}{session.priorities.includes(priority) && <span aria-hidden="true"> ✓</span>}</button>)}</div><p>You selected: {session.priorities.length ? session.priorities.map(priority => priorityLabels[priority]).join(', ') : 'no priorities yet'}.</p>{session.stage !== 'baseline' && <p className="decision-small">Priorities stay fixed after the time change.</p>}{currentChoice && <><label htmlFor="decision-reason">Your reason (optional)</label><textarea id="decision-reason" rows={3} maxLength={500} value={(!viewingPast && !preview ? reasonDrafts[snapshot.id] ?? currentChoice.reason : currentChoice.reason) ?? ''} disabled={viewingPast || preview} placeholder="What makes this choice right for you?" onChange={event => { setReasonDrafts(previous => ({ ...previous, [snapshot.id]: event.target.value })); dispatch({ type: 'set-reason', snapshotId: snapshot.id, reason: event.target.value }); }}/><p className="decision-small">Your words only. We don’t infer feelings, preferences or familiarity.</p></>}</section>
        : surface === 'history' ? <section className="decision-history"><p>Starting facts stay immutable. One selected time changes; the other time, prices and activity durations stay fixed until an explicit walk adjustment.</p>{preview && <p className="decision-small">A preview is open. Back returns to it; finish or cancel it before replaying.</p>}{stages.map(stage => { const choice = session.choices[stage.id]; const historical = session.snapshots[stage.id]; const historicalSz = historical?.result.options.find(option => option.id === 'sz'); return <button key={stage.id} type="button" disabled={preview || !historical} aria-label={stage.label} onClick={() => setStage(stage.id)}><span>{stage.number} · {stage.label}</span><strong>{stage.id === 'baseline' ? `Starting: leave ${clockLabel(baseline.inputs.departureMinutes)}, home by ${clockLabel(baseline.inputs.homeByMinutes)}` : stage.id === 'changed' ? changeText : historical?.revision === 'shorten-sz' ? `Shenzhen walk: ${baselineSz.walkMinutes} → ${historicalSz!.walkMinutes} min` : historical?.revision === 'keep-sz' ? 'Keep the full Shenzhen evening' : 'Keep the full Hong Kong evening'}</strong><small>{historical ? `Displayed departure ${clockLabel(historical.inputs.departureMinutes)} · home by ${clockLabel(historical.inputs.homeByMinutes)}` : 'Not chosen yet'}</small><small>{choice ? `You selected ${cityName(choice.optionId)}` : 'No choice selected'}{choice?.reason ? ` · “${choice.reason}”` : ''}</small></button>; })}<p className="decision-small">Qualitative priorities: {session.priorities.length ? session.priorities.map(priority => priorityLabels[priority]).join(', ') : 'none selected'}.</p></section>
        : surface === 'details' ? <nav className="decision-inspection-list" aria-label="Optional details"><button type="button" onClick={() => openDetail('menu')}>Open the bill and assumptions <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('route')}>Unfold the evening <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('sources')}>Sources and what is still unknown <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('history')}>Replay the comparison <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('priorities')}>Priorities and your reason <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('about')}>About this example <span aria-hidden="true">→</span></button></nav>
        : <section className="decision-about"><p>A fresh authored example of Crossing Lives. You can change one time: departure 15:00–20:00, or home-by 20:00–01:00 the next day, in 15-minute steps. Other numeric inputs remain fixed. Start again to try a different circumstance.</p><p>Choices stay in this tab. No account, persistent saving, tracking, booking or AI advice. The larger questions of work, commuting, housing, business costs and ownership need separate research; this evening invents no company performance numbers.</p><button type="button" onClick={() => { dispatch({ type: 'reset' }); setWalkPreview(false); setTimeDraft(null); setReasonDrafts({}); returnCore.current = 'map'; setSurface('map'); focus(); setAnnouncement('A fresh authored example has started.'); }}>Start this example again</button></section>}
      </div>
      {core && <div className="decision-sheet-tools"><button type="button" onClick={() => openDetail('priorities')}>What matters to you?</button><button type="button" onClick={() => openDetail('details')}>Inspect the details <span aria-hidden="true">↗</span></button></div>}
    </section>}
    <p className="decision-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
  </main>;
}
