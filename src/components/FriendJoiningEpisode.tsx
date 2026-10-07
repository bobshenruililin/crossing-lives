import { useLayoutEffect, useMemo, useReducer, useState } from 'react';
import type { DecisionSession, Priority } from '../decision/session';
import { createFriendJoiningSession, friendJoiningReducer, previewFriendJoining, selectFriendJoiningView } from '../decision/friendJoining';
import type { FriendJoiningSnapshot } from '../decision/friendJoining';
import { CompleteComparison, DecisionStreet, cityName, clockLabel, fitSummary, inputLabel, inputLeaves, money, nativeMoney } from './DecisionPresentation';
import type { SceneObject, StreetGeometry } from './DecisionPresentation';
import './friend-joining.css';

type Step = 'invitation' | 'preview' | 'comparison' | 'choice' | 'finished' | 'replay';
type Surface = 'main' | 'menu' | 'timeline' | 'history' | 'invitation';
const priorityNames: Record<Priority, string> = { food: 'Food', company: 'Company', comfort: 'Comfort', exploration: 'Exploration' };
const priorities = Object.keys(priorityNames) as Priority[];
const objectLabels = { phone: 'Phone Read the invitation', map: 'Map Compare this evening', menu: 'Menu See the party bills' };
const objectCaptions = { phone: 'Phone · invitation', map: 'Map · same clock', menu: 'Menu · party bill' };
const focus = (id = 'friend-sheet-heading') => requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));

const art = (name: string) => (globalThis as typeof globalThis & { __FRIEND_EPISODE_ART__?: Record<string, string> }).__FRIEND_EPISODE_ART__?.[name] ?? `${import.meta.env.BASE_URL}art/${name}`;

/** Ordinary side/back presence beside the existing pair; no raster alteration. */
function JoiningFriend({ geometry }: { geometry: StreetGeometry }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const size = geometry.height * .145 * 1254 / 1066;
  return <div className="friend-world-npc" data-testid="friend-world-npc" data-source-x="0.72" data-source-y="0.75" data-art-status={failed ? 'fallback' : ready ? 'ready' : 'pending'} aria-hidden="true" style={{ width: size, height: size, left: geometry.left + geometry.width * .72, top: geometry.top + geometry.height * .75 }}>
    {!failed && <img src={art('decision-joining-friend.webp')} width="1254" height="1254" alt="" style={{ visibility: ready ? 'visible' : 'hidden' }} onLoad={event => { const image = event.currentTarget; void image.decode().then(() => setReady(true), () => setFailed(true)); }} onError={() => setFailed(true)}/>}
    {!ready && <svg viewBox="0 0 40 100"><path d="M14 2h12v20H14z" fill="#b3906b"/><path d="M9 24h22v35H9z" fill="#4c7872"/><path d="M11 60h7v35h-7zM23 60h7v35h-7z" fill="#d4c4a6"/></svg>}
  </div>;
}

/** Schematic presence only, never a portrait or an invented relationship. */
function PartyPresence({ party, preview = false }: { party: number; preview?: boolean }) {
  return <div className="friend-party-presence" role="img" aria-label={`${party} adults${preview ? ', preview only' : ''}; schematic party indicator`} data-testid="friend-party-presence" data-party={party}>
    <svg viewBox="0 0 144 68" aria-hidden="true"><path d="M8 62h126" stroke="#a99474" strokeWidth="2"/>{[26, 67, 108].map((x, index) => <g key={x} opacity={index === 2 && party === 2 ? .25 : 1}>
      <path d={`M${x - 5} 5h10v4h4v13h-4v4h-10v-4h-4V9h4z`} fill={index === 2 ? '#88664d' : '#b9936b'}/>
      <path d={`M${x - 10} 27h20v23h-20zM${x - 14} 30h4v18h-4zM${x + 10} 30h4v18h-4z`} fill={index === 2 ? '#4c7872' : index === 1 ? '#78846b' : '#b3904f'}/>
      <path d={`M${x - 8} 50h6v12h-6zM${x + 2} 50h6v12h-6z`} fill="#3d494a"/>
      {index === 2 && party === 2 && <path d={`M${x - 14} 1h28v65h-28z`} fill="none" stroke="#635b4f" strokeDasharray="3 3"/>}
    </g>)}</svg><span>{party === 2 ? 'Two now · one possible guest' : preview ? 'Three together · preview' : 'Three from the same origin'}</span>
  </div>;
}

function Invitation({ sourceCity }: { sourceCity: 'hk' | 'sz' | undefined }) {
  return <section className="friend-invitation" aria-label="An optional invitation for another evening">
    <div className="friend-message"><span className="friend-message-icon" aria-hidden="true">◷</span><p>Can I join next time?<br/>I’ll meet you before you leave.</p></div>
    <p>Another evening, before departure. Meet at the same Hong Kong origin and travel together.</p>
    <p className="decision-small">Start from your chosen {sourceCity ? cityName(sourceCity) : ''} outing: the same departure, home-by, routes and activity durations. Your current arrival stays where it is.</p>
  </section>;
}

/** The two model snapshots, including known/unknown costs, are the sole money source. */
function PartyComparison({ before, after, preview }: { before: FriendJoiningSnapshot; after: FriendJoiningSnapshot; preview: boolean }) {
  return <section className="friend-payoff" data-testid="friend-payoff" aria-label="Average per person and complete group spending">
    <p className="friend-payoff-thought">One more adult. <strong>The same one shared extra.</strong></p>
    <div className="friend-cost-pair">{before.result.options.map(old => {
      const next = after.result.options.find(option => option.id === old.id)!;
      return <article key={old.id} data-testid={`friend-cost-${old.id.toUpperCase()}`} data-group-before={old.groupHKD ?? 'unknown'} data-group-after={next.groupHKD ?? 'unknown'} data-average-before={old.perPersonHKD ?? 'unknown'} data-average-after={next.perPersonHKD ?? 'unknown'}>
        <h3>{cityName(old.id)} <small>2 → 3 adults{preview && ' · preview'}</small></h3>
        <dl><div><dt>Average / person</dt><dd><span>{money(old.perPersonHKD)}</span> <i aria-hidden="true">→</i> <strong>{money(next.perPersonHKD)}</strong></dd></div>
          <div><dt>Whole group</dt><dd><span>{money(old.groupHKD)}</span> <i aria-hidden="true">→</i> <strong>{money(next.groupHKD)}</strong></dd></div></dl>
        {(old.groupHKD === null || next.groupHKD === null) && <p className="decision-small">Some costs are unknown. Known group subtotals: {money(old.knownGroupSubtotalHKD)} → {money(next.knownGroupSubtotalHKD)}.</p>}
      </article>;
    })}</div>
    <p className="friend-same-clock" data-testid="friend-time-unchanged"><strong>Same clock.</strong> {after.result.options.map(option => `${cityName(option.id)} home ${clockLabel(option.returnMinutes)}`).join(' · ')}. Both time tracks and return constraints stay the same.</p>
    <p className="decision-small">The average can fall while total group spending rises. A rounded average isn’t an exact payment split.</p>
  </section>;
}

function PartyBills({ snapshot }: { snapshot: FriendJoiningSnapshot }) {
  return <section className="decision-bills friend-bills" data-testid="friend-bills" aria-label={`Complete bills for ${snapshot.inputs.partySize} adults`}>
    <p>Every adult has their own meal, drinks and round-trip fares. Each city keeps ONE fixed shared extra. Its quantity and group price stay the same; this says nothing about serving capacity.</p>
    <div className="decision-bill-pair">{snapshot.result.options.map(option => <section key={option.id} aria-labelledby={`friend-bill-title-${option.id}`}>
      <h3 id={`friend-bill-title-${option.id}`}>{cityName(option.id)} · {snapshot.inputs.partySize} adults</h3>
      <ul>{option.lineItems.map(line => <li key={line.id} data-cost-line-id={line.id} data-quantity={line.quantity} data-scope={line.scope} data-native-group-amount={line.nativeGroupAmount ?? 'unknown'} data-hkd-group-amount={line.hkdGroupAmount ?? 'unknown'} data-currency={line.currency}>
        <div><strong>{line.label}</strong><small>{line.scope === 'group' ? `${line.quantity} × fixed shared extra for the whole group` : `${line.quantity} × ${snapshot.inputs.partySize} adults`}</small><small>Unit price: {nativeMoney(line.nativeUnitAmount, line.currency)}</small></div>
        <div><span>{nativeMoney(line.nativeGroupAmount, line.currency)}</span>{line.currency === 'CNY' && <small>≈ {money(line.hkdGroupAmount)}</small>}</div>
      </li>)}</ul>
      <p className="decision-bill-total"><strong>Whole group · HKD</strong><strong>{money(option.groupHKD)}</strong></p>
      <p>{money(option.perPersonHKD)} average / person · {option.budgetFeasible === true ? `within the ${money(snapshot.inputs.budgetPerPersonHKD)} per-person budget` : option.budgetFeasible === false ? 'over the per-person budget' : 'budget fit unknown'}</p>
      {option.missingCostLabels.length > 0 && <p>Total unknown. Missing: {option.missingCostLabels.join(', ')}. Known subtotal only: {money(option.knownGroupSubtotalHKD)}.</p>}
    </section>)}</div>
    <p className="decision-small">Authored prices, not live quotes. 1 CNY = {snapshot.inputs.fxHKDPerCNY} HKD. Converted group lines round to cents before adding; averages round separately. An average isn’t a payment allocation.</p>
    <details className="decision-assumptions"><summary>Inputs used in this comparison <span aria-hidden="true">+</span></summary>
      <p>Only party size changes. Origin, both clocks, routes, activities, prices and FX stay fixed. Entry eligibility, real queues, services and availability are unknown for every adult.</p>
      <dl>{snapshot.result.options.map(option => <div key={option.id}><dt>{cityName(option.id)} · same full outing</dt><dd>{option.routeLabel}. Dinner {option.mealMinutes} min · walk {option.walkMinutes} min. Leave {clockLabel(option.departureMinutes)} · home {clockLabel(option.returnMinutes)}. {fitSummary(option)}</dd></div>)}</dl>
      <section className="decision-exact-inputs"><h4>Exact inputs used by the model</h4><p className="decision-small">Clock values are minutes after midnight. “Unsure” stays unknown; zero weights keep scoring off.</p><dl>{inputLeaves(snapshot.inputs).map(fact => <div key={fact.key} data-input-key={fact.key} data-input-value={fact.value}><dt>{inputLabel(fact.key)}</dt><dd>{fact.value}</dd></div>)}</dl></section>
    </details>
  </section>;
}

/** Owns only this optional episode; the source comparison and journey never dispatch here. */
export function FriendJoiningEpisode({ source, active, onReturn }: { source: DecisionSession; active: boolean; onReturn: () => void }) {
  const [session, dispatch] = useReducer(friendJoiningReducer, source, createFriendJoiningSession);
  const [step, setStep] = useState<Step>('invitation');
  const [surface, setSurface] = useState<Surface>('main');
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const [confirmedPriorities, setConfirmedPriorities] = useState<Priority[]>([]);
  const [prioritiesChecked, setPrioritiesChecked] = useState(false);
  const [reasonDraft, setReasonDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const preview = useMemo(() => step === 'preview' ? previewFriendJoining(session) : null, [session, step]);
  const view = selectFriendJoiningView(session);
  const displayed = preview?.valid ? preview.snapshot : session.snapshots[session.displayedSnapshotId]!;
  const changed = preview?.valid ? preview.snapshot : session.snapshots.changed;
  const isPreview = step === 'preview';
  const remainingFailures = displayed.result.options.filter(option => !option.homeFeasible || !option.crossingFeasible);
  const compactForFailure = (step === 'preview' || step === 'comparison') && remainingFailures.length > 0;
  const showRemainingFailures = surface === 'main' && compactForFailure;
  const choice = session.choices.changed;
  const selected = choice ? displayed.result.options.find(option => option.id === choice.optionId) : null;
  const historical = view.historicalContext;
  const origin = displayed.inputs.origin === 'kowloon' ? 'Kowloon' : 'Hong Kong Island';
  const main = surface === 'main';
  const attended: SceneObject = surface === 'menu' ? 'menu' : surface === 'timeline' || main && (step === 'comparison' || step === 'replay') ? 'map' : 'phone';
  useLayoutEffect(() => { if (active) focus(); }, [active]);
  const open = (next: Surface) => { setInspectionOpen(false); setSurface(next); focus(); };
  const back = () => open('main');
  const beginPreview = () => { if (session.stage !== 'before') return; setStep('preview'); setSurface('main'); focus(); setAnnouncement('Three-adult preview only. The two-adult plan and current journey are unchanged.'); };
  const cancelPreview = () => { setStep('invitation'); setSurface('main'); focus('friend-preview-button'); setAnnouncement('Preview canceled. Two adults and the exact starting outing are restored.'); };
  const commit = () => { if (!preview?.valid) return; dispatch({ type: 'commit-friend-joining' }); setStep('comparison'); focus(); setAnnouncement('Three adults planned for another evening. Choose either city explicitly; no city was selected for you.'); };
  const choose = (optionId: 'hk' | 'sz') => {
    if (choice?.optionId !== optionId) { setReasonDraft(''); setPrioritiesChecked(false); setConfirmedPriorities([]); }
    dispatch({ type: 'choose-option', snapshotId: 'changed', optionId }); setStep('finished'); focus(); setAnnouncement(`You chose ${cityName(optionId)} for three adults. You can add a reason or reconsider priorities if you want.`);
  };
  const confirm = () => {
    if (!choice) return;
    dispatch({ type: 'set-reason', snapshotId: 'changed', reason: reasonDraft }); setStep('finished'); focus();
    setAnnouncement(`Your ${cityName(choice.optionId)} choice remains. ${reasonDraft.trim() ? 'Your own reason is included.' : 'No reason was stated.'} ${prioritiesChecked ? 'Priorities were reconsidered.' : 'Priorities remain unconfirmed.'}`);
  };
  const replay = () => { dispatch({ type: 'view-snapshot', snapshotId: 'changed' }); setStep('replay'); focus(); };
  const title = surface === 'menu' ? `The bill for ${displayed.inputs.partySize}` : surface === 'timeline' ? 'The same two time tracks' : surface === 'history' ? 'Earlier context, kept separate' : surface === 'invitation' || step === 'invitation' ? 'One more for another evening?' : step === 'preview' ? 'What changes with three?' : step === 'comparison' ? 'Which evening for three?' : step === 'choice' ? 'What matters this time?' : step === 'replay' ? `${displayed.inputs.partySize === 2 ? 'Two' : 'Three'} adults, the same outing` : 'Your choice for another evening';
  return <main className="decision-experience friend-experience" hidden={!active} inert={!active || undefined} data-testid="friend-experience" data-stage={step} data-party-size={displayed.inputs.partySize} data-choice={choice?.optionId ?? 'none'} data-displayed-snapshot={displayed.id} data-active-object={surface} data-preview={isPreview} data-remaining-failure={compactForFailure} aria-label="Crossing Lives, a friend joins another evening" onKeyDown={event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    if (inspectionOpen) { setInspectionOpen(false); focus('friend-inspect-summary'); } else if (!main) back(); else if (isPreview) cancelPreview(); else onReturn();
  }}>
    <DecisionStreet idPrefix="friend" attended={attended} surface={attended} onOpen={object => open(object === 'phone' ? 'invitation' : object === 'map' ? 'timeline' : 'menu')} failed={artFailed} onFailure={() => setArtFailed(true)} objectLabels={objectLabels} objectCaptions={objectCaptions} decoration={displayed.inputs.partySize === 3 ? geometry => <JoiningFriend geometry={geometry}/> : undefined}/>
    <div className="decision-context friend-context" data-testid="friend-context" role="group" aria-label="Another evening before departure, authored planning context">
      <span className="friend-context-when">Another evening · before departure</span>
      <span>{origin} · leave <strong>{clockLabel(displayed.inputs.departureMinutes)}</strong> · <strong>{displayed.inputs.partySize} adults</strong>{isPreview && <em>preview</em>}</span>
      <span>Home by <strong>{clockLabel(displayed.inputs.homeByMinutes)}</strong> · {money(displayed.inputs.budgetPerPersonHKD)} / person</span>
    </div>
    <section id="friend-sheet" className="decision-sheet friend-sheet" data-testid="friend-sheet" aria-labelledby="friend-sheet-heading">
      <header className="decision-sheet-header">{!main && <button type="button" className="decision-back" aria-label="Close friend detail" onClick={back}>←</button>}<div><p className="decision-eyebrow">{surface === 'menu' ? 'The menu' : surface === 'timeline' ? 'The map' : 'The phone'} · {isPreview ? 'free preview' : 'another evening'}</p><h2 id="friend-sheet-heading" tabIndex={-1}>{title}</h2></div></header>
      <div key={main ? step : surface} className="decision-sheet-body decision-detail-body friend-sheet-body" role="region" aria-label="Friend invitation and comparison" tabIndex={0}>
        {surface === 'menu' ? <PartyBills snapshot={displayed}/>
        : surface === 'timeline' ? <><p className="friend-inspection-intro">Party {displayed.inputs.partySize}. These are the exact time tracks from your earlier chosen outing. Only the bill can change here.</p><CompleteComparison idPrefix="friend" snapshot={displayed} selected={displayed.id === 'changed' ? choice?.optionId : session.choices.before?.optionId} averageLabel/><p className="decision-small">Entry, queues and actual services remain unknown for every adult. Extra company doesn’t repair a late return or a crossing-window failure.</p></>
        : surface === 'history' ? <section className="friend-history"><p>Historical context from the chosen {historical.sourceSnapshotId} outing. These words and priorities are not a reason for the new decision.</p><dl><div><dt>Earlier choice</dt><dd>{historical.choice ? cityName(historical.choice.optionId) : 'None'}</dd></div><div><dt>Earlier reason</dt><dd>{historical.choice?.reason ?? 'No reason was stated.'}</dd></div><div><dt>Earlier priorities</dt><dd>{historical.priorities.length ? historical.priorities.map(item => priorityNames[item]).join(', ') : 'None selected'}</dd></div></dl><p>No priorities are automatically selected or scored for this evening. Reconsider them when you make your new choice.</p></section>
        : surface === 'invitation' ? <><PartyPresence party={displayed.inputs.partySize} preview={isPreview}/><Invitation sourceCity={historical.choice?.optionId}/></>
        : step === 'invitation' ? <><PartyPresence party={2}/><Invitation sourceCity={historical.choice?.optionId}/></>
        : step === 'preview' || step === 'comparison' ? changed && <PartyComparison before={session.snapshots.before} after={changed} preview={isPreview}/>
        : step === 'choice' ? <section className="decision-priorities friend-priorities"><p>You chose <strong>{choice && cityName(choice.optionId)} for three adults</strong>. Add a reason or reconsider priorities if you want. Earlier priorities haven’t been copied.</p><div className="decision-priority-buttons" role="group" aria-label="Priorities for this evening">{priorities.map(priority => <button key={priority} type="button" aria-pressed={confirmedPriorities.includes(priority)} onClick={() => { setPrioritiesChecked(false); setConfirmedPriorities(previous => previous.includes(priority) ? previous.filter(item => item !== priority) : [...previous, priority]); }}>{priorityNames[priority]}</button>)}</div><p className="decision-small">No city scores. Choosing no priorities is fine.</p><label className="friend-reconfirm"><input type="checkbox" checked={prioritiesChecked} onChange={event => setPrioritiesChecked(event.target.checked)}/><span>I’ve reconsidered what matters for this evening</span></label><label htmlFor="friend-reason">Your reason for this choice (optional)</label><textarea id="friend-reason" maxLength={500} rows={3} value={reasonDraft} onChange={event => setReasonDraft(event.target.value)} placeholder="What makes this outing work for the three of you?"/><p className="decision-small">Your words. Earlier reasons stay with the earlier outing.</p></section>
        : step === 'replay' ? <><nav className="decision-stage-nav" aria-label="Replay the party change">{(['before', 'changed'] as const).map(id => <button key={id} type="button" aria-current={session.displayedSnapshotId === id ? 'step' : undefined} onClick={() => dispatch({ type: 'view-snapshot', snapshotId: id })}>{id === 'before' ? 'Two adults' : 'Three adults'}</button>)}</nav><p className="friend-replay-note">{displayed.id === 'before' ? `Earlier choice: ${session.choices.before ? cityName(session.choices.before.optionId) : 'none'}.` : choice ? `New choice: ${cityName(choice.optionId)}.` : 'No new city choice yet.'} Same routes, clocks and activities.</p><CompleteComparison idPrefix="friend" snapshot={displayed} selected={displayed.id === 'changed' ? choice?.optionId : session.choices.before?.optionId} averageLabel/><div className="friend-replay-totals">{displayed.result.options.map(option => <p key={option.id}>{cityName(option.id)} whole group: <strong>{money(option.groupHKD)}</strong></p>)}</div></>
        : <section className="friend-finished" data-testid="friend-choice-status"><h3>{choice && cityName(choice.optionId)} · three adults</h3><p className="friend-stated-reason">{choice?.reason ?? 'No reason stated.'}</p><p>{prioritiesChecked ? `Priorities reconsidered: ${confirmedPriorities.length ? confirmedPriorities.map(item => priorityNames[item]).join(', ') : 'none selected'}.` : 'Priorities: not reconfirmed.'}</p>{selected && <p>{money(selected.groupHKD)} whole group · {money(selected.perPersonHKD)} average / person. Modeled home {clockLabel(selected.returnMinutes)}. {fitSummary(selected)}</p>}<p className="decision-small">A new planning choice. Your current journey and its earlier choice remain intact.</p></section>}
      </div>
      <footer className="decision-sheet-footer friend-sheet-footer">
        <div className="decision-action-area">
          {showRemainingFailures && <div className="friend-remaining-failures" role="group" aria-label="Known constraints remain unchanged">{remainingFailures.map(option => <p key={option.id} data-testid={`friend-constraint-${option.id.toUpperCase()}`} data-home-fit={option.homeFeasible} data-crossing-fit={option.crossingFeasible}><strong>{cityName(option.id)}:</strong> {fitSummary(option)}</p>)}</div>}
          {main ? step === 'invitation' ? <button id="friend-preview-button" type="button" className="decision-primary" onClick={beginPreview}>Preview three adults</button>
          : step === 'preview' ? <><p data-testid="friend-preview-state" className="friend-preview-state decision-sr-only">Preview only · same outing, party 2 → 3</p><div className="decision-action-pair"><button type="button" className="decision-primary" onClick={commit}>Plan with three adults</button><button type="button" className="decision-secondary" onClick={cancelPreview}>Cancel preview</button></div></>
          : step === 'comparison' ? <div className="decision-action-pair"><button type="button" className="decision-choice" onClick={() => choose('hk')}>Choose Hong Kong for three</button><button type="button" className="decision-choice" onClick={() => choose('sz')}>Choose Shenzhen for three</button></div>
          : step === 'choice' ? <div className="decision-action-pair"><button type="button" className="decision-primary" onClick={confirm}>Keep this reflection</button><button type="button" className="decision-secondary" onClick={() => { setStep('comparison'); focus(); }}>Reconsider the city</button></div>
          : step === 'replay' ? <button type="button" className="decision-primary" onClick={() => { dispatch({ type: 'view-snapshot', snapshotId: 'changed' }); setStep('finished'); focus(); }}>Back to the three-adult choice</button>
          : <><button type="button" className="decision-primary" onClick={replay}>Replay two and three</button><button type="button" className="friend-reflect" onClick={() => { setStep('choice'); focus(); }}>What matters this time?</button></>
          : <button type="button" className="decision-secondary" onClick={back}>Back to friend comparison</button>}
        </div>
        <p className="decision-core-caveat">Authored prices and times. Entry and real services unknown for all adults.</p>
        <details className="friend-details" open={inspectionOpen} onToggle={event => setInspectionOpen(event.currentTarget.open)}><summary id="friend-inspect-summary">Inspect this evening</summary><div><button type="button" onClick={() => open('menu')}>Inspect the bill and assumptions</button><button type="button" onClick={() => open('timeline')}>Compare the same time tracks</button><button type="button" onClick={() => open('history')}>Earlier choice and priorities</button></div></details>
        <button type="button" className="friend-return" aria-label="Return to the current arrival" onClick={onReturn}>← Return to the current arrival</button>
      </footer>
    </section>
    <p className="decision-sr-only" role="status" aria-live="polite" aria-atomic="true">{active ? announcement : ''}</p>
  </main>;
}
