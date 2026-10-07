import { useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { sources } from '../data/evidence';
import { createDecisionSession, decisionReducer, previewRevision, previewTimeChange, selectDecisionView, DECISION_TIME_LIMITS } from '../decision/session';
import type { DecisionEvent, DecisionSession, DecisionSnapshot, Priority, SnapshotId, RevisionId, TimeChange, TimeChangeField } from '../decision/session';
import './decision-experience.css';
import { DecisionJourneyScene } from './DecisionJourneyScene';
import { journeyReducer } from '../decision/journey';
import type { JourneyNode } from '../decision/journey';
import { CompleteComparison, cityName, money, nativeMoney, shortClock, clockLabel, fieldName, fitSummary, inputLeaves, inputLabel, segmentsFor } from './DecisionPresentation';
import type { SceneObject } from './DecisionPresentation';
import { FriendJoiningEpisode } from './FriendJoiningEpisode';

type CoreObject = 'map' | 'phone';
type Surface = SceneObject | 'priorities' | 'sources' | 'history' | 'route' | 'details' | 'about' | null;
const stages: { id: SnapshotId; label: string; number: string }[] = [
  { id: 'baseline', label: 'Before', number: '01' },
  { id: 'changed', label: 'Changed', number: '02' },
  { id: 'revised', label: 'Revised', number: '03' },
];
const priorityLabels: Record<Priority, string> = { food: 'Food', company: 'Company', comfort: 'Comfort', exploration: 'Exploration' };
const priorities: Priority[] = ['food', 'company', 'comfort', 'exploration'];
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
  const [session, sessionDispatch] = useReducer(decisionReducer, undefined, createDecisionSession);
  const [surface, setSurface] = useState<Surface>(null);
  const [journey, journeyDispatch] = useReducer(journeyReducer, null);
  const [explorationNode, setExplorationNode] = useState<JourneyNode>('counter');
  const locked = journey !== null;
  // Once departed, only inspection and explicit reset may change the source session.
  const dispatch = (event: DecisionEvent) => { if (!locked || event.type === 'view-snapshot' || event.type === 'reset') sessionDispatch(event); };
  const [friendSource, setFriendSource] = useState<DecisionSession | null>(null);
  const [friendOpen, setFriendOpen] = useState(false);
  const [walkPreview, setWalkPreview] = useState(false);
  const [timeDraft, setTimeDraft] = useState<TimeChange | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [reasonDrafts, setReasonDrafts] = useState<Partial<Record<SnapshotId, string>>>({});
  const [focusIntent, setFocusIntent] = useState<{ id: string } | null>(null);
  const returnCore = useRef<CoreObject>('map');
  const returnToWorld = useRef(false);
  // Opening a sheet can unmount the focused world button. Restore focus in
  // the same commit so an immediate Escape still bubbles through this main.
  useLayoutEffect(() => {
    if (surface && !friendOpen) document.getElementById('decision-sheet-heading')?.focus({ preventScroll: true });
  }, [surface, friendOpen]);
  // Focus the committed view before another key event can target its controls.
  // Each request has its own identity, even when consecutive targets are equal.
  useLayoutEffect(() => {
    if (focusIntent) document.getElementById(focusIntent.id)?.focus({ preventScroll: true });
  }, [focusIntent]);
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
  const focus = (id = 'decision-sheet-heading') => setFocusIntent({ id });
  const openObject = (object: SceneObject) => { returnToWorld.current = false; if (object !== 'menu') returnCore.current = object; setSurface(object); focus(); };
  const openDetail = (next: Surface) => { if (core) returnCore.current = surface; setSurface(next); focus(); };
  const back = () => { if (returnToWorld.current) { returnToWorld.current = false; close(); return; } setSurface(returnCore.current); focus(); };
  const close = () => { const object = attended; setSurface(null); requestAnimationFrame(() => { const target = document.getElementById(`decision-object-${object}`); const visible = target && target.getClientRects().length > 0 && !target.closest('[hidden]'); (visible ? target : document.getElementById(journey?.phase === 'arrived' ? 'decision-arrival-bill' : journey?.phase === 'outward' ? 'decision-outward-heading' : 'decision-journey-heading'))?.focus({ preventScroll: true }); }); };
  const choose = (optionId: 'hk' | 'sz') => {
    if (locked) return;
    if (session.choices.baseline?.optionId !== optionId) setReasonDrafts(previous => ({ ...previous, baseline: '' }));
    dispatch({ type: 'choose-option', snapshotId: 'baseline', optionId });
    returnCore.current = 'phone'; setSurface('phone'); focus();
    setAnnouncement(`You selected ${cityName(optionId)} for now. Put down the phone to explore, or try a time change.`);
  };
  const beginTimeChange = (field: TimeChangeField) => { if (locked) return; setTimeDraft({ field, minutes: baseline.inputs[field] }); returnCore.current = 'phone'; setSurface('phone'); focus('decision-time-select'); };
  const cancelTime = () => { setTimeDraft(null); setSurface('phone'); returnCore.current = 'phone'; focus(); setAnnouncement('Time preview canceled. The exact starting comparison and your tentative choice are restored.'); };
  const applyTime = () => {
    if (locked || !timeDraft || !timeResult?.valid) return;
    dispatch({ type: 'change-time', ...timeDraft });
    setTimeDraft(null); setSurface('phone'); returnCore.current = 'phone'; focus('decision-feedback');
    setAnnouncement(`${fieldName(timeDraft.field)} changed from ${clockLabel(baseline.inputs[timeDraft.field])} to ${clockLabel(timeDraft.minutes)}. Other inputs stayed fixed.`);
  };
  const revise = (revision: RevisionId) => { if (locked) return; dispatch({ type: 'apply-revision', revision }); setWalkPreview(false); setSurface('phone'); focus('decision-feedback'); setAnnouncement(revision === 'shorten-sz' ? 'You selected Shenzhen with a 15-minute walk. Review its remaining modeled time and border constraints.' : `You selected the full ${revision === 'keep-hk' ? 'Hong Kong' : 'Shenzhen'} plan. Its modeled constraints remain visible.`); };
  const setStage = (id: SnapshotId) => {
    if (preview) return;
    dispatch({ type: 'view-snapshot', snapshotId: id }); returnCore.current = 'phone'; setSurface('phone'); focus();
    setAnnouncement(`Viewing ${stages.find(stage => stage.id === id)!.label.toLowerCase()}: the exact two options from that step.`);
  };
  const openFriend = () => { if (journey?.phase !== 'arrived') return; setFriendSource(previous => previous ?? journey.source); setFriendOpen(true); };
  const returnFromFriend = () => { setFriendOpen(false); focus('decision-next-invitation'); };
  const depart = () => { journeyDispatch({ type: 'depart-selected', session, node: explorationNode, hasPreview: preview }); setSurface(null); };
  const openJourneyObject = (object: SceneObject) => { if (!preview && (journey || surface === null)) dispatch({ type: 'view-snapshot', snapshotId: journey?.snapshot.id ?? session.stage }); openObject(object); };
  const openJourneyComparison = () => { openJourneyObject('map'); };
  const canChoose = !locked && session.stage === 'baseline' && !viewingPast && !preview && (surface === 'map' || !baselineChoice);
  const committedChange = view.timeChange;
  const changeText = committedChange ? `${fieldName(committedChange.field)} ${clockLabel(committedChange.beforeMinutes)} → ${clockLabel(committedChange.afterMinutes)}` : 'No time changed';
  const unchangedText = committedChange?.field === 'homeByMinutes' ? 'Costs, activities and home times unchanged.' : 'Costs and activity durations unchanged.';
  const walkTradeoff = `${session.priorities.includes('exploration') ? 'You selected exploration. ' : ''}Walk ${baselineSz.walkMinutes} → ${sz.walkMinutes} min gives up ${baselineSz.walkMinutes - sz.walkMinutes} minutes walking. Same cost.`;
  const title = !core ? detailTitles[surface ?? 'about'] : viewingPast ? `${stages.find(stage => stage.id === snapshot.id)!.label}: the same comparison`
    : locked ? 'Your captured outing' : timeDraft ? `${fieldName(timeDraft.field)} preview` : walkPreview ? 'Trade 30 minutes of walking?'
    : session.stage === 'changed' ? 'Which full plan would you keep?' : session.stage === 'revised' ? 'Your choice, with its constraints'
    : baselineChoice && surface === 'phone' ? 'Your starting choice' : 'Which evening would you try?';
  const coreActions = (
    viewingPast ? <div className="decision-replay-note"><p>{stages.find(stage => stage.id === snapshot.id)?.label} pair · read-only.</p><nav className="decision-stage-nav" aria-label="Replay your decision">{stages.map(stage => <button key={stage.id} type="button" disabled={!session.snapshots[stage.id]} aria-current={snapshot.id === stage.id ? 'step' : undefined} onClick={() => setStage(stage.id)}>{stage.label}</button>)}</nav><button type="button" className="decision-primary" onClick={() => setStage(session.stage)}>Return to current decision</button></div>
          : locked ? <section className="decision-replay-note"><p>Your departed plan · read-only. Arrival, bill and inputs stay with the choice you left with.</p><button type="button" className="decision-primary" onClick={() => openDetail('history')}>Replay the comparison <span aria-hidden="true">↶</span></button></section>
          : timeDraft ? surface === 'phone' ? <PhoneClock draft={timeDraft} baselineMinutes={baseline.inputs[timeDraft.field]} valid={timeResult?.valid === true} onSet={minutes => setTimeDraft({ field: timeDraft.field, minutes })} onApply={applyTime} onCancel={cancelTime}/>
            : <section className="decision-phone-question"><p>Time preview only. The starting comparison is unchanged until you apply it.</p><button type="button" className="decision-primary" onClick={() => openObject('phone')}>Return to phone clock</button></section>
          : canChoose ? <div role="group" className="decision-choice-actions" aria-label="Choose a tentative evening">{(['hk', 'sz'] as const).map(id => <button key={id} type="button" className="decision-choice" aria-label={`Start with ${cityName(id)}`} aria-pressed={baselineChoice?.optionId === id} onClick={() => choose(id)}>{cityName(id)} <span aria-hidden="true">→</span></button>)}</div>
          : session.stage === 'baseline' ? <section className="decision-phone-question"><p>You selected <strong>{cityName(baselineChoice!.optionId)}</strong>. Put down the phone when you’re ready to explore. You can also try one time change.</p><div className="decision-action-pair"><button type="button" className="decision-secondary" onClick={() => beginTimeChange('departureMinutes')}>Change departure</button><button type="button" className="decision-primary" onClick={() => beginTimeChange('homeByMinutes')}>Change home-by</button></div></section>
          : <section id="decision-feedback" data-testid="decision-feedback" tabIndex={-1} className="decision-feedback" aria-label="What changes, and what stays the same" role="status">
            {walkPreview ? <><p>{walkTradeoff} <strong>{fitSummary(sz)}</strong></p><div className="decision-action-pair"><button className="decision-primary" type="button" aria-label="Choose shorter Shenzhen walk" onClick={() => revise('shorten-sz')}>Choose shorter walk</button><button className="decision-secondary" type="button" onClick={() => { setWalkPreview(false); focus('decision-feedback'); setAnnouncement('Walk preview canceled. The exact full evenings at the committed time are restored.'); }}>Cancel preview</button></div></>
            : session.stage === 'changed' ? <><p data-testid="decision-time-change-fact"><strong>{changeText}.</strong> {unchangedText}</p><div className="decision-action-pair decision-full-plan-choices"><button className="decision-choice" type="button" aria-label="Keep full Hong Kong evening" onClick={() => revise('keep-hk')}>Keep full Hong Kong</button><button className="decision-choice" type="button" aria-label="Keep full Shenzhen evening" onClick={() => revise('keep-sz')}>Keep full Shenzhen</button></div><button className="decision-short-walk" type="button" aria-label="Preview a shorter Shenzhen walk" onClick={() => { setWalkPreview(true); focus('decision-feedback'); setAnnouncement('Previewing a 15-minute Shenzhen walk. Its actual home and crossing-window fit remain visible.'); }}>Or try a shorter Shenzhen walk <span aria-hidden="true">→</span></button></>
            : <><p data-testid="decision-choice-status"><strong>{view.reconsideration.summary}</strong> {session.snapshots.revised?.revision === 'shorten-sz' ? walkTradeoff : 'Full dinner and walk kept.'} {selectedOption && <span className={!selectedOption.homeFeasible || !selectedOption.crossingFeasible ? 'decision-remaining-failure' : undefined}>{fitSummary(selectedOption)}</span>}</p><button className="decision-primary" type="button" onClick={() => openDetail('history')}>Replay the comparison <span aria-hidden="true">↶</span></button></>}
          </section>
  );
  return <><main hidden={friendOpen} inert={friendOpen || undefined} className="decision-experience" data-testid="decision-experience" data-stage={session.stage} data-displayed-snapshot={snapshot.id} data-preview={preview} data-preview-kind={timeDraft ? 'time' : walkPreview ? 'walk' : 'none'} data-active-object={surface ?? 'closed'} data-attended-object={attended} aria-label="Crossing Lives, one evening reconsidered" onKeyDown={event => { if (event.key === 'Escape' && surface) { event.preventDefault(); event.stopPropagation(); if (core) close(); else back(); } }}>
    <DecisionJourneyScene journey={journey} session={session} explorationNode={explorationNode} onMove={setExplorationNode} onDepart={depart} hasPreview={preview} dispatch={journeyDispatch} surfaceOpen={surface !== null} inspectionTarget={attended} onOpen={openJourneyObject} onCompare={openJourneyComparison} onRoute={() => { returnToWorld.current = true; dispatch({ type: 'view-snapshot', snapshotId: journey?.snapshot.id ?? session.stage }); openDetail('route'); }} originFailed={false} onNextInvitation={openFriend}/>
    {surface && <div className="decision-context" data-testid="decision-context" role="group" aria-label={`${preview ? 'Preview' : snapshot.id === 'baseline' ? 'Starting authored' : 'Changed authored'} context; prices, party and origin stay fixed`}><span>Leave <strong>{shortClock(snapshot.inputs.departureMinutes)}</strong> · {snapshot.inputs.origin === 'kowloon' ? 'Kowloon' : 'Hong Kong Island'} · {snapshot.inputs.partySize} adults {preview && <em>preview</em>}</span><span><strong>{money(snapshot.inputs.budgetPerPersonHKD)}</strong> / person <i aria-hidden="true">·</i> home by <strong>{shortClock(snapshot.inputs.homeByMinutes)}</strong>{snapshot.inputs.homeByMinutes >= 1440 && <b className="decision-context-day"> next day</b>}</span></div>}
    {surface && <section id="decision-sheet" data-testid="decision-sheet" data-active-object={surface} data-core={core} className={`decision-sheet ${core ? 'is-core' : 'is-detail'}`} aria-labelledby="decision-sheet-heading">
      <header className="decision-sheet-header">{(!core || timeDraft && surface === 'phone') && <button type="button" className="decision-back" aria-label={core ? 'Choose another circumstance' : 'Back to evening'} onClick={core ? cancelTime : back}><span aria-hidden="true">←</span></button>}<div><p className="decision-eyebrow">{core ? `${surface === 'map' ? 'The map' : 'The phone'} · ${preview ? 'preview only' : viewingPast ? 'replay' : snapshot.id === 'baseline' ? 'authored starting plan' : snapshot.id === 'changed' ? 'one time changed' : 'your chosen adjustment'}` : surface === 'menu' ? 'The menu · authored prices' : 'Optional inspection'}</p><h2 id="decision-sheet-heading" tabIndex={-1}>{title}</h2></div>{core && <button type="button" className="decision-put-down" aria-label={`Put down ${surface}`} onClick={close}>×</button>}</header>
      <div key={core ? 'core' : surface} className={`decision-sheet-body ${core ? 'decision-core-body' : 'decision-detail-body'}`} role="region" aria-label={core ? 'Comparison timeline' : 'Inspection details'} tabIndex={0}>
        {core ? <>
          <CompleteComparison snapshot={snapshot} selected={currentChoice?.optionId ?? undefined}/>
        </> : surface === 'menu' ? <Bills snapshot={snapshot}/>
        : surface === 'route' ? <RouteInspector snapshot={snapshot}/>
        : surface === 'sources' ? <Evidence/>
        : surface === 'priorities' ? <section className="decision-priorities"><p>Food, company, comfort, exploration: choose what matters to you. Neither city receives a score.</p><div className="decision-priority-buttons">{priorities.map(priority => <button key={priority} type="button" aria-pressed={session.priorities.includes(priority)} disabled={locked || session.stage !== 'baseline' || viewingPast || preview} onClick={() => dispatch({ type: 'set-priorities', priorities: session.priorities.includes(priority) ? session.priorities.filter(value => value !== priority) : [...session.priorities, priority] })}>{priorityLabels[priority]}{session.priorities.includes(priority) && <span aria-hidden="true"> ✓</span>}</button>)}</div><p>You selected: {session.priorities.length ? session.priorities.map(priority => priorityLabels[priority]).join(', ') : 'no priorities yet'}.</p>{session.stage !== 'baseline' && <p className="decision-small">Priorities stay fixed after the time change.</p>}{currentChoice && <><label htmlFor="decision-reason">Your reason (optional)</label><textarea id="decision-reason" rows={3} maxLength={500} value={(!viewingPast && !preview ? reasonDrafts[snapshot.id] ?? currentChoice.reason : currentChoice.reason) ?? ''} disabled={locked || viewingPast || preview} placeholder="What makes this choice right for you?" onChange={event => { setReasonDrafts(previous => ({ ...previous, [snapshot.id]: event.target.value })); dispatch({ type: 'set-reason', snapshotId: snapshot.id, reason: event.target.value }); }}/><p className="decision-small">Your words only. We don’t infer feelings, preferences or familiarity.</p></>}</section>
        : surface === 'history' ? <section className="decision-history"><p>Starting facts stay immutable. One selected time changes; the other time, prices and activity durations stay fixed until an explicit walk adjustment.</p>{preview && <p className="decision-small">A preview is open. Back returns to it; finish or cancel it before replaying.</p>}{stages.map(stage => { const choice = session.choices[stage.id]; const historical = session.snapshots[stage.id]; const historicalSz = historical?.result.options.find(option => option.id === 'sz'); return <button key={stage.id} type="button" disabled={preview || !historical} aria-label={stage.label} onClick={() => setStage(stage.id)}><span>{stage.number} · {stage.label}</span><strong>{stage.id === 'baseline' ? `Starting: leave ${clockLabel(baseline.inputs.departureMinutes)}, home by ${clockLabel(baseline.inputs.homeByMinutes)}` : stage.id === 'changed' ? changeText : historical?.revision === 'shorten-sz' ? `Shenzhen walk: ${baselineSz.walkMinutes} → ${historicalSz!.walkMinutes} min` : historical?.revision === 'keep-sz' ? 'Keep the full Shenzhen evening' : 'Keep the full Hong Kong evening'}</strong><small>{historical ? `Displayed departure ${clockLabel(historical.inputs.departureMinutes)} · home by ${clockLabel(historical.inputs.homeByMinutes)}` : 'Not chosen yet'}</small><small>{choice ? `You selected ${cityName(choice.optionId)}` : 'No choice selected'}{choice?.reason ? ` · “${choice.reason}”` : ''}</small></button>; })}<p className="decision-small">Qualitative priorities: {session.priorities.length ? session.priorities.map(priority => priorityLabels[priority]).join(', ') : 'none selected'}.</p></section>
        : surface === 'details' ? <nav className="decision-inspection-list" aria-label="Optional details"><button type="button" onClick={() => openDetail('menu')}>Open the bill and assumptions <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('route')}>Unfold the evening <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('sources')}>Sources and what is still unknown <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('history')}>Replay the comparison <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('priorities')}>Priorities and your reason <span aria-hidden="true">→</span></button><button type="button" onClick={() => openDetail('about')}>About this example <span aria-hidden="true">→</span></button></nav>
        : <section className="decision-about"><p>A fresh authored example of Crossing Lives. You can change one time: departure 15:00–20:00, or home-by 20:00–01:00 the next day, in 15-minute steps. Other numeric inputs remain fixed. Start again to try a different circumstance.</p><p>Choices stay in this tab. No account, persistent saving, tracking, booking or AI advice. The larger questions of work, commuting, housing, business costs and ownership need separate research; this evening invents no company performance numbers.</p><button type="button" onClick={() => { dispatch({ type: 'reset' }); journeyDispatch({ type: 'reset' }); setExplorationNode('counter'); setFriendSource(null); setFriendOpen(false); setWalkPreview(false); setTimeDraft(null); setReasonDrafts({}); returnCore.current = 'map'; returnToWorld.current = false; setSurface(null); focus('decision-journey-heading'); setAnnouncement('A fresh authored example has started.'); }}>Start this example again</button></section>}
      </div>
      {core && <footer className="decision-sheet-footer" data-testid="decision-sheet-footer">
        <div className="decision-action-area" data-testid="decision-action-area">{coreActions}</div>
        <p className="decision-core-caveat" data-testid="decision-core-caveat">Authored prices and times. Entry, queues and services unknown. Modeled slack is not a guarantee.</p>
        <div className="decision-sheet-tools"><button type="button" onClick={() => openDetail('priorities')}>What matters to you?</button><button type="button" onClick={() => openDetail('details')}>Inspect the details <span aria-hidden="true">↗</span></button></div>
      </footer>}
    </section>}
    <p className="decision-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
  </main>{friendSource && <FriendJoiningEpisode source={friendSource} active={friendOpen} onReturn={returnFromFriend}/>}</>;
}
