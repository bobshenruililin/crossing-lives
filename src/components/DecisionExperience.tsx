import { useMemo, useReducer, useRef, useState } from 'react';
import { formatClock } from '../domain/engine';
import { sources } from '../data/evidence';
import { createDecisionSession, decisionReducer, previewRevision, selectDecisionView } from '../decision/session';
import type { DecisionSnapshot, Priority, SnapshotId } from '../decision/session';
import './decision-experience.css';

type DecisionOption = DecisionSnapshot['result']['options'][number];
type Segment = { id: string; label: string; start: number; end: number; kind: 'travel' | 'clearance' | 'dinner' | 'walk' };
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
const elapsed = (minutes: number) => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() || '0m';
const SCALE_START = 17 * 60;
const SCALE_END = 24 * 60;
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

function DeskObjects() {
  return <svg className="decision-desk-art" viewBox="0 0 210 108" role="presentation" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#d9d7c9" d="M4 92h202v8H4z" />
    <path fill="#c4beaa" d="M15 100h180v4H15z" />
    <path fill="#8d9c8e" d="M151 10h34v5h8v9h8v20h-62V24h6v-9h6z" />
    <path fill="#334b42" d="M166 44h7v41h20v7h-47v-7h20z" />
    <path fill="#e9cc80" d="M145 44h50v6h-50z" />
    <path fill="#b8af9f" d="M17 22h53v65H17zM76 29h53v58H76z" />
    <path fill="#fffaf0" d="M13 18h53v65H13zM72 25h53v58H72z" />
    <path fill="#606881" d="M20 25h39v8H20zM20 40h25v4H20zM20 48h34v4H20zM20 56h28v4H20z" />
    <path fill="#3e7664" d="M79 32h39v8H79zM79 47h25v4H79zM79 55h34v4H79zM79 63h28v4H79z" />
    <path fill="#d7a05f" d="M91 78h43v8h-6v6h-31v-6h-6z" />
    <path fill="#f2db9c" d="M94 72h37v6H94z" />
    <path fill="#765646" d="M102 60h4v15h-4zM111 57h4v18h-4z" />
    <path fill="#48514a" d="M25 88h44v4H25z" />
  </svg>;
}

function ClockObject({ changed }: { changed: boolean }) {
  return <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="currentColor" d="M12 3h24v3h6v6h3v24h-3v6h-6v3H12v-3H6v-6H3V12h3V6h6z" />
    <path fill="#fcf7ed" d="M12 9h24v3h3v24h-3v3H12v-3H9V12h3z" />
    <path fill="currentColor" d={changed ? 'M22 22h4v14h-4zM13 15h6v4h7v7h-4v-4h-6v-3h-3z' : 'M22 22h4v14h-4zM18 12h4v6h4v8h-4v-6h-4z'} />
  </svg>;
}

function OptionCard({ option, snapshotId, selected, canChoose, onChoose }: {
  option: DecisionOption; snapshotId: SnapshotId; selected: boolean; canChoose: boolean; onChoose: () => void;
}) {
  return <article className={`decision-option decision-option-${option.id}${selected ? ' is-selected' : ''}`}
    aria-labelledby={`decision-title-${option.id}`} data-testid={`decision-outcome-${option.id.toUpperCase()}`}
    data-option-id={option.id} data-snapshot-id={snapshotId} data-home-minute={option.returnMinutes}
    data-cost-hkd={option.perPersonHKD ?? 'unknown'} data-dinner-minutes={option.mealMinutes}
    data-walk-minutes={option.walkMinutes} data-deadline-minute={option.homeByMinutes}>
    <header className="decision-option-title"><span className="decision-city-marker" aria-hidden="true">{option.id === 'hk' ? '港' : '深'}</span><div><p>{option.id === 'hk' ? 'Stay local' : 'Cross via Lo Wu'}</p><h3 id={`decision-title-${option.id}`}>{cityName(option.id)}</h3></div></header>
    <div className="decision-key-figures"><div><span>Whole evening / person</span><strong>{money(option.perPersonHKD)}</strong></div><div><span>Modeled home time</span><strong>{formatClock(option.returnMinutes)}</strong></div></div>
    <p className={`decision-margin ${option.homeFeasible ? 'is-within' : 'is-late'}`}><span aria-hidden="true">{option.homeFeasible ? '↳' : '!'}</span>{option.homeFeasible ? `${option.spareMinutes} min modeled slack` : `${-option.spareMinutes} min late in model`}</p>
    <div className="decision-compact-evening"><p><strong>Dinner {option.mealMinutes} min</strong><span> · </span><strong>Walk {option.walkMinutes} min</strong></p><p>Shared order included</p><p className="decision-compact-route">{option.outwardMinutes} min out + {option.inwardMinutes} min home</p></div>
    <p className="decision-option-foot">{elapsed(option.totalMinutes)} · complete round trip</p>
    {canChoose ? <button className={`decision-pick ${selected ? 'selected' : ''}`} type="button" aria-pressed={selected} onClick={onChoose}>Start with {cityName(option.id)}<span aria-hidden="true">{selected ? ' ✓' : ' →'}</span></button> : <p className="decision-selection-note">{selected ? `You selected ${cityName(option.id)}` : 'Alternative kept in view'}</p>}
  </article>;
}

function TimeAndRoute({ snapshot }: { snapshot: DecisionSnapshot }) {
  const [route, setRoute] = useState<'hk' | 'sz'>('sz');
  const selected = snapshot.result.options.find(option => option.id === route)!;
  const segments = segmentsFor(selected);
  const deadline = snapshot.inputs.homeByMinutes;
  return <section className="decision-unfolded" aria-labelledby="decision-time-title">
    <div className="decision-section-heading"><div><p className="decision-eyebrow">The same clock for both evenings</p><h3 id="decision-time-title">Where the time goes</h3></div><span>Both cities · UTC+8</span></div>
    <p className="decision-small">Every strip uses 17:00–00:00. Empty space is time left after arriving home.</p>
    <div className="decision-time-key"><span><i className="travel"/>Travel</span><span><i className="clearance"/>Clearance</span><span><i className="dinner"/>Dinner</span><span><i className="walk"/>Walk</span></div>
    <div className="decision-time-axis" aria-hidden="true">{[17, 18, 19, 20, 21, 22, 23, 24].map(hour => <span key={hour} style={{ left: position(hour * 60) }}>{hour === 24 ? '00' : hour}</span>)}</div>
    <div className="decision-timeline-pair">
      <div className="decision-deadline-line" data-testid="decision-deadline-marker" data-deadline-minute={deadline} style={{ left: position(deadline) }}><span>Home by<br/><b>{formatClock(deadline)}</b></span></div>
      {snapshot.result.options.map(option => <div key={option.id} className="decision-timeline-row">
        <div className="decision-timeline-label"><strong>{cityName(option.id)}</strong><span>{money(option.perPersonHKD)} / person · home {formatClock(option.returnMinutes)}</span></div>
        <div role="group" className="decision-timeline-track" data-testid={`decision-timeline-${option.id.toUpperCase()}`} data-scale-start-minute={SCALE_START} data-scale-end-minute={SCALE_END} aria-label={`${cityName(option.id)} complete evening, 17:00 to midnight scale`}>
          {segmentsFor(option).map(segment => <span key={segment.id} className={`decision-time-segment ${segment.kind}`} data-segment-id={segment.id} data-start-minute={segment.start} data-end-minute={segment.end} style={{ left: position(segment.start), width: `${(segment.end - segment.start) / (SCALE_END - SCALE_START) * 100}%` }}><span className="decision-sr-only">{segment.label}: {formatClock(segment.start)}–{formatClock(segment.end)}, {segment.end - segment.start} minutes.</span></span>)}
          <span className={`decision-home-pin ${option.homeFeasible ? '' : 'is-late'}`} style={{ left: position(option.returnMinutes) }} aria-hidden="true"/>
        </div>
      </div>)}
    </div>
    <div className="decision-route-inspector">
      <div role="group" className="decision-route-tabs" aria-label="Inspect a complete route">{(['hk', 'sz'] as const).map(id => <button key={id} type="button" aria-pressed={route === id} onClick={() => setRoute(id)}>{cityName(id)} route</button>)}</div>
      <p className="decision-small">Schematic only. Places are not positioned geographically.</p>
      <div role="group" className={`decision-route-map ${route}`} aria-label={route === 'sz' ? 'Kowloon, through Lo Wu, to dinner in Luohu, then back through Lo Wu to Kowloon' : 'Kowloon to a local dinner and walk, then back home'}>
        <span className="decision-route-place"><i aria-hidden="true">⌂</i><strong>Kowloon</strong><small>Start / home</small></span>
        <span className="decision-route-arrows" aria-hidden="true">→<br/>←</span>
        {route === 'sz' && <><span className="decision-route-place crossing"><i aria-hidden="true">▥</i><strong>Lo Wu</strong><small>Both crossings</small></span><span className="decision-route-arrows" aria-hidden="true">→<br/>←</span></>}
        <span className="decision-route-place"><i aria-hidden="true">▤</i><strong>{route === 'sz' ? 'Luohu' : 'Local evening'}</strong><small>Dinner + walk</small></span>
      </div>
      <details className="decision-route-legs"><summary>Inspect the trip out and home <span aria-hidden="true">+</span></summary><ol>{segments.map(segment => <li key={segment.id}><span className={`decision-step-dot ${segment.kind}`} aria-hidden="true"/><div><strong>{segment.label}</strong><span>{formatClock(segment.start)}–{formatClock(segment.end)} · {segment.end - segment.start} min</span>{segment.kind === 'clearance' && <small>Authored allowance; actual queues are unknown.</small>}</div></li>)}</ol></details>
    </div>
  </section>;
}

function Bills({ snapshot }: { snapshot: DecisionSnapshot }) {
  return <div className="decision-bills">
    <p>Every price, the FX rate and every journey duration below is an authored assumption. Shared orders are charged once for two adults. No live quotes.</p>
    <div className="decision-bill-pair">{snapshot.result.options.map(option => <section key={option.id} aria-labelledby={`bill-title-${option.id}`}><h3 id={`bill-title-${option.id}`}>{cityName(option.id)} · bill for two</h3><ul>{option.lineItems.map(line => <li key={line.id} data-cost-line-id={line.id} data-native-group-amount={line.nativeGroupAmount ?? 'unknown'} data-hkd-group-amount={line.hkdGroupAmount ?? 'unknown'} data-currency={line.currency}><div><strong>{line.label}</strong><small>{line.scope === 'group' ? 'One shared group charge' : `${line.quantity} × each person, for ${snapshot.inputs.partySize} adults`}</small></div><div><span>{nativeMoney(line.nativeGroupAmount, line.currency)}</span>{line.currency === 'CNY' && <small>≈ {money(line.hkdGroupAmount)}</small>}</div></li>)}</ul><p className="decision-bill-total"><strong>Group total</strong><strong>{money(option.groupHKD)}</strong></p><p>{money(option.perPersonHKD)} per person · {option.budgetFeasible === true ? `within the ${money(snapshot.inputs.budgetPerPersonHKD)} budget` : option.budgetFeasible === false ? 'over budget' : 'budget fit unknown'}</p>{option.missingCostLabels.length > 0 && <p>Total unknown. Missing: {option.missingCostLabels.join(', ')}. Known subtotal only: {money(option.knownGroupSubtotalHKD)}.</p>}</section>)}</div>
    <p className="decision-small">1 CNY = {snapshot.inputs.fxHKDPerCNY} HKD (authored). Native prices are rounded to cents; converted group line items are rounded before adding. Per-person amounts are rounded averages.</p>
    <details className="decision-assumptions"><summary>Read all authored starting facts <span aria-hidden="true">+</span></summary><dl>
      <div><dt>People and origin</dt><dd>{snapshot.inputs.partySize} adults · Kowloon</dd></div><div><dt>Departure</dt><dd>{formatClock(snapshot.inputs.departureMinutes)} · UTC+8</dd></div><div><dt>Home-by deadline</dt><dd>{formatClock(snapshot.inputs.homeByMinutes)} · UTC+8</dd></div><div><dt>Budget</dt><dd>{money(snapshot.inputs.budgetPerPersonHKD)} per person</dd></div>
      {snapshot.result.options.map(option => <div key={option.id}><dt>{cityName(option.id)} activities</dt><dd>Dinner {option.mealMinutes} min · walk {option.walkMinutes} min · shared order {option.includeSharedOrder ? 'included' : 'omitted'} · added delay {option.storyDelayMinutes} min</dd></div>)}
      <div><dt>Shenzhen route</dt><dd>Rail via Lo Wu · 50 min rail, 30 min clearance allowance and 25 min destination transfer each way</dd></div><div><dt>Hong Kong travel</dt><dd>15 min local travel each way</dd></div><div><dt>FX</dt><dd>{snapshot.inputs.fxHKDPerCNY} HKD per CNY</dd></div><div><dt>Real entry and familiarity</dt><dd>Entry unconfirmed; familiarity with either city’s dinner and walk unknown</dd></div><div><dt>Preference scoring</dt><dd>No composite scores. Your priorities do not change model inputs.</dd></div>
    </dl><section className="decision-exact-inputs"><h4>Exact input values used by the model</h4><p className="decision-small">Clock values below are minutes after midnight (17:00 = 1020). “Unsure” stays unknown. Zero scoring weights keep composite scores off.</p><dl>{inputLeaves(snapshot.inputs).map(fact => <div key={fact.key} data-input-key={fact.key} data-input-value={fact.value}><dt>{inputLabel(fact.key)}</dt><dd>{fact.value}</dd></div>)}</dl></section></details>
  </div>;
}

export function DecisionExperience() {
  const [session, dispatch] = useReducer(decisionReducer, undefined, createDecisionSession);
  const [preview, setPreview] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [artFailed, setArtFailed] = useState(false);
  const [reasonDrafts, setReasonDrafts] = useState<Partial<Record<SnapshotId, string>>>({});
  const previewSnapshot = useMemo(() => preview ? previewRevision(session, 'shorten-sz') : null, [session, preview]);
  const snapshot = (previewSnapshot ?? session.snapshots[session.displayedSnapshotId])!;
  const currentChoice = preview ? null : session.choices[snapshot.id];
  const view = selectDecisionView(session);
  const billRef = useRef<HTMLDetailsElement>(null);
  const clockRef = useRef<HTMLElement>(null);
  const routeRef = useRef<HTMLElement>(null);
  const viewingPast = session.displayedSnapshotId !== session.stage && !preview;
  const baselineChoice = session.choices.baseline;
  const changed = snapshot.id !== 'baseline';
  const hk = snapshot.result.options.find(option => option.id === 'hk')!;
  const sz = snapshot.result.options.find(option => option.id === 'sz')!;
  const baselineSz = session.snapshots.baseline.result.options.find(option => option.id === 'sz')!;
  const isChoosing = session.stage === 'baseline' && !viewingPast;
  const canRevise = session.stage === 'changed' && !viewingPast && !preview;
  const setStage = (id: SnapshotId) => { setPreview(false); dispatch({ type: 'view-snapshot', snapshotId: id }); setAnnouncement(`Viewing ${stages.find(stage => stage.id === id)!.label.toLowerCase()}. Both original comparison options are shown.`); };
  const focusFeedback = () => requestAnimationFrame(() => document.getElementById('decision-feedback')?.focus({ preventScroll: true }));
  const choose = (id: 'hk' | 'sz') => { if (session.choices.baseline?.optionId !== id) setReasonDrafts(previous => ({ ...previous, baseline: '' })); dispatch({ type: 'choose-option', snapshotId: 'baseline', optionId: id }); setAnnouncement(`You selected ${cityName(id)}. You can now try the earlier home-by time.`); };
  const revise = (revision: 'keep-hk' | 'shorten-sz') => { dispatch({ type: 'apply-revision', revision }); setPreview(false); focusFeedback(); setAnnouncement(revision === 'keep-hk' ? 'You selected the full Hong Kong evening. The full Shenzhen evening stays visible as the alternative.' : 'You selected Shenzhen with a 15-minute walk. Dinner and prices are unchanged.'); };
  return <div className="decision-page"><a className="decision-skip" href="#decision-comparison">Skip to the two evenings</a>
    <header className="decision-masthead"><a className="decision-brand" href="#decision-top" aria-label="Crossing Lives, top of this example"><span aria-hidden="true">▦</span> Crossing Lives</a><span>One evening, reconsidered</span><span className="decision-session-label">Fresh example · not saved</span></header>
    <main id="decision-top" className="decision-main" data-testid="decision-experience" data-stage={session.stage} data-displayed-snapshot={snapshot.id} data-preview={preview}>
      <section className="decision-intro"><div><p className="decision-eyebrow">An authored Hong Kong ↔ Shenzhen example</p><h1>What changes when we need to be home earlier?</h1><p>Dinner together, a walk, and time to get home. Choose an evening, then change one circumstance.</p></div></section>
      <section className="decision-world" aria-label="A place to think through the evening">
        <div className="decision-world-image-frame">{!artFailed ? <img className="decision-world-image" src={art('decision-hk-pixel.webp')} width="1672" height="941" alt="An imagined Hong Kong street at dusk: people walk past a rail entrance and a small dining counter. A menu, folded map and phone sit on the counter." onError={() => setArtFailed(true)}/> : <div className="decision-world-fallback"><DeskObjects/><p>The illustration couldn’t load. All three objects and the complete comparison still work below.</p></div>}
          {!artFailed && <><div className="decision-world-caption">An imagined Hong Kong evening<span>Menu, map, phone: inspect what matters.</span></div><span className="decision-world-pin menu" aria-hidden="true">1</span><span className="decision-world-pin map" aria-hidden="true">2</span><span className="decision-world-pin phone" aria-hidden="true">3</span></>}
        </div>
        <div className="decision-world-controls">
          <button className="menu" type="button" onClick={() => { if (billRef.current) { billRef.current.open = true; billRef.current.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true }); billRef.current.scrollIntoView({ block: 'start' }); } }}><span aria-hidden="true">1</span><strong>Menu</strong><small>See both bills</small></button>
          <button className="map" type="button" onClick={() => { setUnfolded(true); requestAnimationFrame(() => { routeRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); routeRef.current?.scrollIntoView({ block: 'start' }); }); }}><span aria-hidden="true">2</span><strong>Map</strong><small>Unfold both routes</small></button>
          <button className="phone" type="button" onClick={() => { clockRef.current?.focus({ preventScroll: true }); clockRef.current?.scrollIntoView({ block: 'center' }); }}><span aria-hidden="true">3</span><strong>Phone</strong><small>Inspect home-by time</small></button>
        </div>
      </section>
      <div className="decision-planning-paper">
      <div className="decision-starting-facts"><p><strong>2 adults</strong> leaving <strong>Kowloon at 17:00</strong><span aria-hidden="true"> · </span><strong>HK$400 each</strong></p><p>Same starting plan: 90-minute dinner, 45-minute walk, one shared order. No added delay. Fixed authored example.</p></div>
      <nav className="decision-stage-nav" aria-label="Replay your decision">{stages.map(stage => <button type="button" key={stage.id} aria-label={stage.label} disabled={!session.snapshots[stage.id]} aria-current={!preview && snapshot.id === stage.id ? 'step' : undefined} onClick={() => setStage(stage.id)}><span>{stage.number}</span>{stage.label}{session.snapshots[stage.id] && session.choices[stage.id] && <i aria-hidden="true">•</i>}</button>)}</nav>
      <section className="decision-comparison" id="decision-comparison" aria-labelledby="decision-comparison-title">
        <div className="decision-section-heading"><div><p className="decision-eyebrow">{preview ? 'Preview · shorter Shenzhen walk' : viewingPast ? 'Replay · the exact comparison from this step' : snapshot.id === 'baseline' ? 'Start with the whole evening' : snapshot.id === 'changed' ? 'One constraint changed' : 'Your reconsidered plan'}</p><h2 id="decision-comparison-title">{preview ? 'Thirty minutes come from the walk.' : viewingPast ? (snapshot.id === 'baseline' ? 'Before we moved the deadline.' : 'After only the deadline moved.') : snapshot.id === 'baseline' ? 'Which evening would you try?' : snapshot.id === 'changed' ? 'Same evenings. Less time to get home.' : session.snapshots.revised?.revision === 'shorten-sz' ? 'A shorter walk makes room to return.' : 'Keep the full evening in Hong Kong.'}</h2></div><p className="decision-authored-label">Modeled, not live<br/>No city is scored</p></div>
        {changed && !preview && baselineChoice && <p className="decision-starting-choice">Your starting choice: {cityName(baselineChoice.optionId)}.</p>}
        {preview && <p className="decision-preview-note">Preview only: Shenzhen walk {baselineSz.walkMinutes} → {sz.walkMinutes} min. You give up {baselineSz.walkMinutes - sz.walkMinutes} minutes of walking. Dinner, shared order and cost stay the same.</p>}
        <div className="decision-options">{snapshot.result.options.map(option => <OptionCard key={option.id} option={option} snapshotId={snapshot.id} selected={currentChoice?.optionId === option.id} canChoose={isChoosing} onChoose={() => choose(option.id)} />)}</div>
        <p className="decision-comparison-caveat">Both include dinner, walking, a shared order and travel home. Modeled time only; real entry, queues and services remain unresolved.</p>
        {isChoosing && baselineChoice && <p className="decision-inline-feedback" role="status">You selected {cityName(baselineChoice.optionId)} for now. Try the clock below to see what changes.</p>}
      </section>
      <section ref={clockRef} tabIndex={-1} className={`decision-clock-panel${changed ? ' is-changed' : ''}`} aria-label="The one changed circumstance">
        <div className="decision-clock-readout"><ClockObject changed={changed}/><div><span>Home by</span><strong>{formatClock(snapshot.inputs.homeByMinutes)}</strong>{changed && <small><s>23:30</s> → 22:30 · 60 min earlier</small>}</div></div>
        <div className="decision-clock-context">{!changed ? <><strong>What if you need to be home an hour earlier?</strong><p>{!baselineChoice ? 'Pick an evening above, then move this one deadline.' : 'Only the deadline moves. The outings themselves stay put.'}</p></> : <><strong>{snapshot.id === 'changed' ? 'Only the deadline moved.' : 'The earlier deadline stays at 22:30.'}</strong><p>Departure, dinner, shared order, prices and travel assumptions are unchanged.{snapshot.id === 'changed' && ' The 45-minute walks are unchanged.'}{snapshot.id === 'changed' && ' Both modeled home times are unchanged too.'}</p></>}</div>
        {!changed && !viewingPast && <button className="decision-action" type="button" disabled={!baselineChoice} onClick={() => { dispatch({ type: 'change-deadline' }); focusFeedback(); setAnnouncement('Home-by time changed from 23:30 to 22:30. Only the deadline changed.'); }}>Change home-by time to 22:30 <span aria-hidden="true">↶</span></button>}
        {changed && <span className="decision-change-stamp">1 circumstance<br/>changed</span>}
      </section>
      {changed && <section id={!preview ? "decision-feedback" : undefined} data-testid={!preview ? "decision-feedback" : undefined} tabIndex={-1} className="decision-consequence" aria-label="What the changed deadline means" role="status" aria-live="polite"><p><span aria-hidden="true">↳</span>{sz.homeFeasible ? `Shenzhen now gets home at ${formatClock(sz.returnMinutes)}, ${sz.spareMinutes} minutes before ${formatClock(sz.homeByMinutes)}, for the same ${money(sz.perPersonHKD)} per person.` : `Shenzhen still costs ${money(sz.perPersonHKD)} and gets home at ${formatClock(sz.returnMinutes)}. It now misses ${formatClock(sz.homeByMinutes)} by ${-sz.spareMinutes} minutes.`}</p><small>Hong Kong remains {money(hk.perPersonHKD)} / person, home {formatClock(hk.returnMinutes)}. Modeled slack is not a guarantee. Home-time fit does not verify travel feasibility.</small>{snapshot.id === 'revised' && !preview && <p className="decision-kept-choice" data-testid="decision-choice-status">{view.reconsideration.summary}</p>}</section>}
      {canRevise && <section className="decision-reconsider" aria-labelledby="decision-reconsider-title"><div><p className="decision-eyebrow">Reconsider the trade-off</p><h2 id="decision-reconsider-title">What are you willing to change?</h2><p>Keep the full Hong Kong evening, or preview giving up 30 minutes of the Shenzhen walk. Both keep dinner and the shared order.</p></div><div className="decision-reconsider-actions"><button type="button" className="decision-secondary-action" onClick={() => revise('keep-hk')}>Keep full Hong Kong evening <span aria-hidden="true">→</span></button><button type="button" className="decision-action" onClick={() => { setPreview(true); focusFeedback(); setAnnouncement('Previewing a 15-minute Shenzhen walk. No revised choice has been committed.'); }}>Preview a shorter Shenzhen walk <span aria-hidden="true">→</span></button></div></section>}
      {preview && <section id="decision-feedback" data-testid="decision-feedback" tabIndex={-1} className="decision-preview-actions" role="status" aria-label="Choose or cancel the preview"><p>Shenzhen walk: {baselineSz.walkMinutes} → {sz.walkMinutes} min. You give up {baselineSz.walkMinutes - sz.walkMinutes} minutes of walking. Modeled home: {formatClock(baselineSz.returnMinutes)} → {formatClock(sz.returnMinutes)}. Cost stays {money(sz.perPersonHKD)} per person.</p><div><button className="decision-action" type="button" onClick={() => revise('shorten-sz')}>Choose shorter Shenzhen walk <span aria-hidden="true">✓</span></button><button className="decision-text-button" type="button" onClick={() => { setPreview(false); focusFeedback(); setAnnouncement('Preview canceled. Back to the unchanged full evenings with the earlier deadline.'); }}>Cancel preview</button></div></section>}
      {viewingPast && <p className="decision-replay-note">You’re replaying {stages.find(stage => stage.id === snapshot.id)?.label.toLowerCase()}. No choice has been changed.<button type="button" onClick={() => setStage(session.stage)}>Return to current decision <span aria-hidden="true">→</span></button></p>}
      <details className="decision-priorities"><summary>What matters to you? <span>Optional</span><i aria-hidden="true">+</i></summary><div><p>Choose your priorities in your own terms. They don’t award either city points.</p><div className="decision-priority-buttons">{priorities.map(priority => <button key={priority} type="button" aria-pressed={session.priorities.includes(priority)} disabled={session.stage !== 'baseline' || viewingPast || preview} onClick={() => dispatch({ type: 'set-priorities', priorities: session.priorities.includes(priority) ? session.priorities.filter(item => item !== priority) : [...session.priorities, priority] })}>{priorityLabels[priority]}{session.priorities.includes(priority) && <span aria-hidden="true"> ✓</span>}</button>)}</div><p className="decision-small">{session.stage !== 'baseline' && 'Priorities stay fixed after the deadline changes. '}You selected: {session.priorities.length ? session.priorities.map(priority => priorityLabels[priority]).join(', ') : 'no priorities yet'}.</p><label htmlFor="decision-reason">Your reason (optional)</label><textarea id="decision-reason" rows={2} maxLength={500} value={(!viewingPast && !preview ? reasonDrafts[snapshot.id] ?? currentChoice?.reason : currentChoice?.reason) ?? ''} disabled={!currentChoice || viewingPast || preview} placeholder={!currentChoice ? 'Choose an evening first.' : 'What makes this choice right for you?'} onChange={event => { setReasonDrafts(previous => ({ ...previous, [snapshot.id]: event.target.value })); dispatch({ type: 'set-reason', snapshotId: snapshot.id, reason: event.target.value }); }}/><p className="decision-small">Your words stay with this decision step, in this tab only. We don’t infer your feelings or familiarity.</p></div></details>
      <section ref={routeRef} className="decision-inspect"><button type="button" className="decision-unfold-button" aria-expanded={unfolded} aria-controls="decision-unfolded" onClick={() => setUnfolded(value => !value)}><span aria-hidden="true">▤</span><div><strong>{unfolded ? 'Fold the evening away' : 'Unfold the evening'}</strong><small>A common clock, the route out and the way home</small></div><i aria-hidden="true">{unfolded ? '−' : '+'}</i></button><div id="decision-unfolded" hidden={!unfolded}>{unfolded && <TimeAndRoute snapshot={snapshot}/>}</div></section>
      <details ref={billRef} className="decision-disclosure"><summary>Open the bill and assumptions <span aria-hidden="true">+</span></summary><Bills snapshot={snapshot}/></details>
      <details className="decision-disclosure"><summary>Sources and what is still unknown <span aria-hidden="true">+</span></summary><div className="decision-evidence"><section><p className="decision-eyebrow">Authored assumptions</p><h3>Prices and durations are a worked example.</h3><p>Meals, drinks, shared orders, fares, travel, clearance allowances and FX are fixed illustrative inputs. They are not quotes, live queues, a timetable or a real travel plan.</p></section><section><p className="decision-eyebrow">Separate published fact</p><h3>Lo Wu passenger clearance: 06:30–00:00.</h3><p><a href={sources[0].href!} target="_blank" rel="noreferrer">Hong Kong Immigration Department · control points</a>. Checked 6 October 2026; page dated 26 June 2026. These are normal published hours, not live operating status.</p><p>The model also keeps a 15-minute closing buffer. Fitting the published window does not confirm a last train, seat, actual queue or entry permission.</p></section><section><p className="decision-eyebrow">Unresolved</p><h3>Real entry, service, prices and personal experience.</h3><p>Every traveler must check entry and return eligibility. Transport services, restaurant availability, real prices and actual queues remain unverified. Familiarity with dinner and walking in either city is unknown; no preference score is invented.</p><p><a href="https://www.mtr.com.hk/en/customer/jp/index.php" target="_blank" rel="noreferrer">MTR route and fare planner</a> is a place to check fares, not a source for this example’s numbers. A missing cost would remain unknown, never become zero.</p></section></div></details>
      {session.stage === 'revised' && !preview && <section className="decision-replay-summary" aria-labelledby="decision-replay-title"><p className="decision-eyebrow">See what changed</p><h2 id="decision-replay-title">Replay why the decision changed.</h2><div>{stages.map(stage => { const choice = session.choices[stage.id]; return <button key={stage.id} type="button" onClick={() => setStage(stage.id)} aria-label={`Replay ${stage.label.toLowerCase()}`}><span>{stage.number} · {stage.label}</span><strong>{stage.id === 'baseline' ? 'Home by 23:30' : stage.id === 'changed' ? 'Home by 22:30' : session.snapshots.revised?.revision === 'shorten-sz' ? 'Shenzhen walk: 15 min' : 'Hong Kong: full evening'}</strong><small>{choice ? `You selected ${cityName(choice.optionId)}` : 'A constraint to reconsider'}{choice?.reason ? ` · “${choice.reason}”` : ''}</small></button>; })}</div><p className="decision-small">The two complete options from each step are preserved. Your reasons come from you; the arithmetic comes from the same transparent model.</p></section>}
      </div>
      <footer className="decision-footer"><p>One fixed slice of Crossing Lives. Fresh in-memory example; no account, saving, tracking or AI-generated advice.</p><details><summary>What sits beyond this evening?</summary><p>The wider question includes cross-border work, commuting, housing, business costs and ownership: whose goals matter, which constraints change, and who benefits? Those need separate evidence and real participants. This example makes no company-performance claims.</p></details><button type="button" onClick={() => { dispatch({ type: 'reset' }); setReasonDrafts({}); setPreview(false); setUnfolded(false); setAnnouncement('A fresh authored example has started. Previous in-tab choices and reasons were cleared.'); }}>Start this example again <span aria-hidden="true">↺</span></button></footer>
      <p className="decision-sr-only" role="status" aria-atomic="true">{announcement}</p>
    </main>
  </div>;
}
