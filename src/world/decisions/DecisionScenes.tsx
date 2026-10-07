import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { InteractionProps } from '../types';
import { sceneContent } from '../interactions/model';
import { HOME_ACTIVITIES, HOME_FIXTURE, LEASE_OFFERS, PARCEL_FIXTURE, RENTAL_FIXTURE, RENTAL_REFUND_TERMS, clockText, commitHomePlan, commitLeaseChoice, commitParcelDecision, homeSnapshot, keepEverything, parcelSnapshot, readHomePlan, readLeaseChoice, readParcelDecision, rentalSnapshot, setHomeActivity, setHomeDeadline, setParcelContext, setParcelMethod } from './model';
import type { ActivityId, LeaseChoice } from './model';

const money = (amount: number) => amount.toLocaleString('en-HK');
function useStepFocus(step: string) {
  const root = useRef<HTMLElement>(null), previous = useRef(step);
  useLayoutEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    root.current?.closest<HTMLElement>('.world-modal-scroll')?.scrollTo({ top: 0 });
    const target = root.current?.querySelector<HTMLElement>('[data-step-focus]');
    target?.focus({ preventScroll: true });
  }, [step]);
  return root;
}
function Amount({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return <div data-world-number={label}><dt>{label}</dt><dd><strong>{typeof value === 'number' ? money(value) : value}</strong><span>{unit}</span></dd></div>;
}
function Evidence({ sceneId, children }: { sceneId: InteractionProps['sceneId']; children: ReactNode }) {
  const { action } = sceneContent(sceneId);
  return <details className="wd-evidence"><summary>Assumptions &amp; sources</summary>{children}
    <ul>{action.unknowns.map(unknown => <li key={unknown}>{unknown}</li>)}</ul>
    {action.publicSources.map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><br/>{source.supports}<br/>{source.limit}</p>)}
  </details>;
}
function Actions({ onCancel, onCommit, onBack, backLabel = 'Back', children, disabled = false }: { onCancel: () => void; onCommit?: () => void; onBack?: () => void; backLabel?: string; children?: ReactNode; disabled?: boolean }) {
  return <div className="wd-actions">{onBack && <button type="button" className="wd-back" onClick={onBack}>{backLabel}</button>}<button type="button" className="wd-cancel" onClick={onCancel}>Cancel</button>{onCommit && <button type="button" className="wd-commit" disabled={disabled} onClick={onCommit}>{children}<span aria-hidden="true"> →</span></button>}</div>;
}

export function HomeDecision({ values, onChange, onClose }: InteractionProps) {
  const [plan, setPlan] = useState(() => readHomePlan(values));
  const [attended, setAttended] = useState<ActivityId>('lunch');
  const snapshot = homeSnapshot(plan), activity = snapshot.activities.find(item => item.id === attended)!;
  const clockId = useId();
  const hour = ((snapshot.deadlineMinute % 720) / 720) * Math.PI * 2;
  const minute = ((snapshot.deadlineMinute % 60) / 60) * Math.PI * 2;
  const fullScaleMinutes = 780;
  const status = snapshot.lateMinutes ? `${snapshot.lateMinutes} minutes late` : snapshot.spareMinutes ? `${snapshot.spareMinutes} minutes spare` : 'Exactly on time';
  const commit = () => { onChange(commitHomePlan(values, plan)); onClose(); };
  return <section className="world-decision wd-home" aria-label="Move the home-by clock. What stays in your day?" data-testid="world-insight-hk-home" data-mechanism="home-plan" data-preview="true">
    <p className="wd-caption">Fictional day plan · travel times unverified</p>
    <div className="wd-clock-row">
      <svg className="wd-clock" viewBox="0 0 110 110" role="img" aria-label={`Home-by clock set to ${clockText(snapshot.deadlineMinute)}`}>
        <circle cx="55" cy="55" r="49" className="wd-clock-rim"/><circle cx="55" cy="55" r="43" className="wd-clock-face"/>
        {[0, 1, 2, 3].map(tick => <path key={tick} d="M55 16v6" transform={`rotate(${tick * 90} 55 55)`} className="wd-clock-tick"/>)}
        <path data-clock-hand="hour" d={`M55 55L${55 + 25 * Math.sin(hour)} ${55 - 25 * Math.cos(hour)}`} className="wd-clock-hour"/>
        <path data-clock-hand="minute" d={`M55 55L${55 + 35 * Math.sin(minute)} ${55 - 35 * Math.cos(minute)}`} className="wd-clock-minute"/>
        <circle cx="55" cy="55" r="3.5" className="wd-clock-pin"/>
      </svg>
      <div className="wd-clock-control"><label htmlFor={clockId}>Home by <strong>{clockText(snapshot.deadlineMinute)}</strong></label>
        <input id={clockId} type="range" min={HOME_FIXTURE.earlier} max={HOME_FIXTURE.later} step={60} value={snapshot.deadlineMinute} aria-valuetext={`${clockText(snapshot.deadlineMinute)}, ${plan.deadline === 'earlier' ? 'earlier home' : 'more time'}`} onChange={event => setPlan(setHomeDeadline(plan, Number(event.target.value) === HOME_FIXTURE.earlier ? 'earlier' : 'later'))}/>
        <div className="wd-range-labels"><span>Earlier</span><span>More time</span></div>
      </div>
    </div>
      <figure className="wd-time-figure" aria-label={`Illustrative Hong Kong–Shenzhen day: ${HOME_FIXTURE.fixedCommitmentMinutes} minutes assumed round-trip travel and clearance, ${snapshot.activityMinutes} minutes activities; ${status}.`}><div className="wd-time-strip" aria-hidden="true"><span className="wd-time-fixed" style={{ width: `${HOME_FIXTURE.fixedCommitmentMinutes / fullScaleMinutes * 100}%` }}/>{snapshot.activities.map(item => <span key={item.id} className={`wd-time-activity wd-activity-${item.id}`} data-activity={item.id} data-minutes={item.minutes} style={{ width: `${item.minutes / fullScaleMinutes * 100}%` }}/>)}<i className="wd-deadline-marker" style={{ left: `${snapshot.availableMinutes / fullScaleMinutes * 100}%` }}/></div><figcaption>HK ⇄ Shenzhen · striped 6h assumed round trip</figcaption></figure>
    <div className="wd-activity-card" data-attended-activity={attended}>
      <div className="wd-activity-heading"><span className={`wd-activity-token wd-activity-${attended}`} aria-hidden="true">{attended === 'lunch' ? '♧' : attended === 'neighborhood' ? '⌁' : '▥'}</span><select aria-label="Activity to adjust" value={attended} onChange={event => setAttended(event.target.value as ActivityId)}>{HOME_ACTIVITIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
      <div className="wd-activity-actions" role="group" aria-label={`Choose time for ${activity.label.toLowerCase()}`}>
        <button type="button" aria-pressed={activity.choice === 'full'} onClick={() => setPlan(setHomeActivity(plan, attended, 'full'))}>Keep<span>{activity.fullMinutes} min</span></button>
        <button type="button" aria-pressed={activity.choice === 'short'} onClick={() => setPlan(setHomeActivity(plan, attended, 'short'))}>Shorten<span>{activity.shortMinutes} min</span></button>
        <button type="button" aria-pressed={activity.choice === 'omit'} onClick={() => setPlan(setHomeActivity(plan, attended, 'omit'))}>Leave out<span>0 min</span></button>
      </div>
    </div>
    <div className="wd-home-outcome" role="status" aria-live="polite" aria-atomic="true" data-plan-status={snapshot.lateMinutes ? 'late' : 'fits'}><strong>{status}</strong><span>Example finish {clockText(snapshot.finishMinute)}</span></div>
    <Actions onCancel={onClose} onCommit={commit}>Take this plan</Actions>
    <Evidence sceneId="hk-home"><button className="wd-keep-all" type="button" onClick={() => setPlan(keepEverything(plan))}>Keep everything at full length</button>

      <p>Invented planning exercise, starting at 11:00. Travel and clearance times are unverified; the illustration is not a live clock. Every place stays open.</p><p>All allowances are invented for this exercise. The round-trip allowance stays at 360 minutes for travel, clearance, local connections and getting home. It is an invented allowance, not a measured Hong Kong–Futian route. Shortening a visit does not erase that journey.</p><p>Full activities: lunch 90, walk 150, exhibition 120 minutes. Short activities: 60, 90 and 60 minutes. Leaving one out removes only that activity allowance. Earlier home never chooses an activity for you.</p><p>No full Futian itinerary, opening hours, last service or personal eligibility has been established. This plan neither measures elapsed play nor reuses a Lo Wu itinerary.</p></Evidence>
  </section>;
}

export function ParcelDecision({ values, onChange, onClose }: InteractionProps) {
  const [decision, setDecision] = useState(() => readParcelDecision(values));
  const [step, setStep] = useState<'context' | 'destination' | 'consequence'>(() => readParcelDecision(values).method ? 'consequence' : 'context');
  const snapshot = parcelSnapshot(decision), root = useStepFocus(step);
  const selected = decision.method;
  const commit = () => { onChange(commitParcelDecision(values, decision)); onClose(); };
  const place = (method: 'collection' | 'delivery') => { setDecision(setParcelMethod(decision, method)); setStep('consequence'); };
  return <section ref={root} className="world-decision wd-parcel" aria-label="How will this parcel get home?" data-testid="world-insight-parcel-counter" data-mechanism="parcel-destination" data-preview="true" data-step={step}>
    <p className="wd-caption">Separate fictional costs · CNY-equivalent</p>
    {step === 'context' && <><fieldset className="wd-context-cards"><legend>Were you already going?</legend>{(['already-going', 'dedicated-trip'] as const).map(context => { const preview = parcelSnapshot({ context, method: 'collection' }); return <button key={context} type="button" data-step-focus={context === 'already-going' ? true : undefined} aria-pressed={decision.context === context} onClick={() => { setDecision(setParcelContext(decision, context)); setStep('destination'); }}><b>{context === 'already-going' ? 'Already going' : 'Go just for it'}</b><small>Collection {preview.pickupCost} · {preview.pickupMinutes} min</small></button>; })}</fieldset><Actions onCancel={onClose}/></>}
    {step === 'destination' && <><div className="wd-parcel-destinations" role="group" aria-label="Place the parcel">
      <button type="button" data-step-focus aria-pressed={selected === 'collection'} onClick={() => place('collection')}><b>Collect it</b><span data-world-number="Collection cost"><strong>{money(snapshot.pickupCost)}</strong></span><small data-pickup-minutes={snapshot.pickupMinutes}>{snapshot.pickupMinutes} extra minutes</small></button>
      <button type="button" aria-pressed={selected === 'delivery'} onClick={() => place('delivery')}><b>Home delivery</b><span data-world-number="Delivery quote"><strong>{snapshot.deliveryCost}</strong></span><small>Delivery time unknown</small></button>
    </div><Actions onCancel={onClose} onBack={() => setStep('context')}/></>}
    {step === 'consequence' && <><div className="wd-parcel-result" data-step-focus tabIndex={-1} data-destination={selected ?? 'unplaced'} data-context={decision.context} role="status" aria-live="polite" aria-atomic="true"><div className="wd-parcel-mini" aria-hidden="true"><div className="wd-parcel-object"><span/><i/></div><span className="wd-parcel-place">{selected === 'collection' ? 'Counter' : 'Home'}</span></div><dl className="wd-numbers"><Amount label="Extra money" value={snapshot.selectedCost!} unit=""/><Amount label={selected === 'collection' ? 'Extra time' : 'Delivery time'} value={selected === 'collection' ? snapshot.pickupMinutes : 'Unknown'} unit={selected === 'collection' ? 'min' : ''}/></dl></div><Actions onCancel={onClose} onBack={() => setStep('destination')} backLabel="Options" onCommit={commit}>{selected === 'collection' ? 'Use collection' : 'Use delivery'}</Actions></>}
    <Evidence sceneId="parcel-counter"><p>This separate parcel comparison does not change your day plan or its allowances. Invented figures are not fares or an exchange rate. Delivery timing, item eligibility and return terms are unknown. The original outing is outside this calculation.</p><p>Collection: {PARCEL_FIXTURE.handling} handling + {PARCEL_FIXTURE.detourTransport} local transport = 16 CNY-equivalent, with a 20-minute detour. A dedicated trip adds 100 CNY-equivalent and 140 minutes, making 116 and 160.</p><p>Home delivery is an invented 35 CNY-equivalent quote. No delivery duration or personal waiting time is supplied. These figures do not measure operator profit, guarantee a refund, convert currency or add to an HKD outing.</p></Evidence>
  </section>;
}

export function RentalDecision({ values, onChange, onClose }: InteractionProps) {
  const [choice, setChoice] = useState<LeaseChoice | null>(() => readLeaseChoice(values));
  const [step, setStep] = useState<'contract' | 'consequence'>(() => readLeaseChoice(values) ? 'consequence' : 'contract');
  const root = useStepFocus(step);
  const snapshot = choice ? rentalSnapshot(choice) : null;
  const other = choice ? rentalSnapshot(choice === 'lower-rent' ? 'less-upfront' : 'lower-rent') : null;
  const cashDelta = snapshot && other ? snapshot.liquidCash - other.liquidCash : 0;
  const rentDelta = snapshot && other ? snapshot.recurringRent - other.recurringRent : 0;
  const commit = () => { if (choice) { onChange(commitLeaseChoice(values, choice)); onClose(); } };
  return <section ref={root} className="world-decision wd-rental" aria-label="More cash available today, or less rent each month?" data-testid="world-insight-rental-home" data-mechanism="lease-tradeoff" data-preview="true" data-step={step}>
    <p className="wd-caption">Separate fictional lease · {step === 'contract' ? 'HKD 24,000 to start' : 'HKD'}</p>
    {step === 'contract' && <><div className="wd-lease-offers" role="group" aria-label="Choose a fictional lease">{Object.values(LEASE_OFFERS).map(offer => <button key={offer.id} type="button" data-step-focus={offer.id === 'lower-rent' ? true : undefined} aria-pressed={choice === offer.id} onClick={() => { setChoice(offer.id); setStep('consequence'); }} className="wd-contract"><span className="wd-contract-lines" aria-hidden="true"/><b>{offer.label}</b><span className="wd-contract-mark" aria-hidden="true">{choice === offer.id ? '✓' : '○'}</span></button>)}</div><Actions onCancel={onClose}/></>}
    {step === 'consequence' && snapshot && <><div className="wd-lease-result" data-step-focus tabIndex={-1} role="status" aria-live="polite" aria-atomic="true"><div className="wd-cash-scene" data-lease={choice} aria-hidden="true">
      {[{ role: 'rent', amount: snapshot.rentPaid, label: 'Rent' }, { role: 'deposit', amount: snapshot.conditionalDeposit, label: 'Held' }, { role: 'liquid', amount: snapshot.liquidCash, label: 'Cash' }].map(stack => <div key={stack.role} className={`wd-cash-stack wd-cash-${stack.role}`} data-money-role={stack.role} data-amount={stack.amount} style={{ '--stack-height': `${stack.amount / RENTAL_FIXTURE.startingCash * 56}px` } as CSSProperties}><span className="wd-stack-bills"/><span className="wd-stack-label">{stack.label}</span></div>)}
    </div><dl className="wd-numbers"><Amount label="Cash now" value={snapshot.liquidCash} unit=""/><Amount label="Monthly rent" value={snapshot.recurringRent} unit=""/></dl><p className="wd-lease-delta" data-testid="lease-comparison-delta"><span>Compared with the other offer:</span>{money(Math.abs(cashDelta))} {cashDelta > 0 ? 'more' : 'less'} cash now; {money(Math.abs(rentDelta))} {rentDelta > 0 ? 'more' : 'less'} rent/month.</p></div><p className="wd-deposit-claim"><b>{money(snapshot.conditionalDeposit)} held, not spendable.</b> Return conditional; amount and timing unknown.</p><Actions onCancel={onClose} onBack={() => setStep('contract')} onCommit={commit}>Choose lease</Actions></>}
    <Evidence sceneId="rental-home"><p>{RENTAL_REFUND_TERMS}</p><p>First month paid now; other move-in charges assumed zero. This separate authored comparison does not change your day plan. It is not a Shenzhen quote or financial advice.</p><p>Both offers concern the same invented room, a 12-month term and 24,000 HKD starting cash. Only first-month rent and the conditional deposit leave cash here. There is no recommendation or inferred household budget.</p><p>Lower monthly rent: 6,000 paid + 12,000 held + 6,000 liquid = 24,000. Less cash tied up: 7,500 paid + 7,500 held + 9,000 liquid = 24,000. A deposit remains a conditional claim, not a promised refund or a consumed rent expense.</p></Evidence>
  </section>;
}
