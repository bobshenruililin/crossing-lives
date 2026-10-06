import { useId, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, BusFront, ChevronDown, RotateCcw, TrainFront } from 'lucide-react';
import { formatClock } from '../domain/engine';
import type { ShenzhenRoute } from '../domain/model';
import { selectStoryProgress } from '../story/engine';
import type { StoryState } from '../story/model';
import { formatRouteDuration, formatRouteMoney, selectRouteView } from '../story/route-view';
import type { RouteJourney, RouteReturnIntent } from '../story/route-view';
import './route-note.css';

export interface RouteNoteProps {
  state: StoryState;
  onSelectRoute: (route: ShenzhenRoute) => void;
  onBack: () => void;
  onReconsiderDeparture?: () => void;
  returnFirst?: boolean;
  returnIntent?: RouteReturnIntent;
  backLabel?: string;
  showRouteChoicesInitially?: boolean;
}

/** One schematic in the host's native dialogue; all folds remain local UI state. */
export function RouteNote({state,onSelectRoute,onBack,onReconsiderDeparture,returnFirst=false,returnIntent='planned',backLabel='Back to Jun',showRouteChoicesInitially=false}:RouteNoteProps) {
  const id=useId();
  const view=selectRouteView(state,undefined,{returnIntent});
  const [expanded,setExpanded]=useState<string|null>(showRouteChoicesInitially?'route':null);
  const toggle=(detail:string)=>setExpanded(current=>current===detail?null:detail);
  const back=<button type="button" className="route-note-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>{backLabel}</button>;
  if(!view) return <div className="route-note"><p className="route-note-caption">Story clock · {formatClock(selectStoryProgress(state).clockMinutes)} · UTC+8</p><p>Choose a city with Jun to unfold the journey out and home.</p>{back}</div>;
  const journey=expanded==='outward'?view.outward:expanded==='inward'?view.inward:null;
  const direction=(item:RouteJourney)=><button type="button" className={`route-direction route-${item.id}`} key={item.id} aria-expanded={expanded===item.id} aria-controls={`${id}-detail`} onClick={()=>toggle(item.id)}>
    {item.id==='outward'?<ArrowDown size={17} aria-hidden="true"/>:<ArrowUp size={17} aria-hidden="true"/>}
    <span><span className="route-direction-label"><strong>{item.title}</strong><span>{formatRouteDuration(item.durationMinutes)}</span></span><small>{formatClock(item.startMinutes)}–{formatClock(item.endMinutes)}</small><small>{item.status} <ChevronDown size={13} aria-hidden="true"/></small></span>
  </button>;
  return <div className="route-note" data-route={view.route} data-return-intent={returnIntent}>
    <div className="route-note-top">{back}<span className="route-note-caption">Schematic · not live<br/>Story clock {formatClock(view.actualProgress.clockMinutes)} · UTC+8</span></div>
    <div className="route-note-selected"><strong>{view.routeLabel}</strong>{view.canSelectRoute?<button type="button" aria-expanded={expanded==='route'} aria-controls={`${id}-choices`} onClick={()=>toggle('route')}>Change route <ChevronDown size={14}/></button>:<small>Chosen route · read-only</small>}</div>
    {view.canSelectRoute&&<fieldset className="route-note-choices" id={`${id}-choices`} hidden={expanded!=='route'}><legend>Choose the crossing route</legend>{view.routeChoices.map(choice=>{const Icon=choice.route==='rail'?TrainFront:BusFront;return <label key={choice.route}><input type="radio" name={`${id}-route`} value={choice.route} checked={view.route===choice.route} onChange={()=>onSelectRoute(choice.route)}/><Icon size={18} aria-hidden="true"/><span>{choice.label}</span></label>;})}{view.tradeoff&&<p className="route-note-tradeoff">{view.tradeoff}</p>}</fieldset>}
    <div className="route-note-summary"><p className="route-note-forecast">{view.forecastText}</p><p className="route-note-deadline">{view.deadlineText}</p></div>
    <p className="route-note-sr-only" role="status" aria-atomic="true">{view.announcement}</p>
    <section className="route-loop" aria-label="Complete round-trip route">
      <div className="route-loop-node"><strong>{view.originLabel.replace(' (scenario)','')}</strong><small>Leave {formatClock(view.outward.startMinutes)} · home {formatClock(view.inward.endMinutes)}</small></div>
      <div className="route-loop-directions">{returnFirst?[direction(view.inward),direction(view.outward)]:[direction(view.outward),direction(view.inward)]}</div>
      <div className="route-loop-node"><strong>{view.destinationLabel.replace(' (scenario)','')}</strong><small>Arrive {formatClock(view.outward.endMinutes)} · leave {formatClock(view.inward.startMinutes)}</small></div>
    </section>
    {view.warnings.length>0&&<div className="route-note-warnings" role="note">{view.warnings.map(warning=><p key={warning}>{warning}</p>)}</div>}
    <div className="route-note-folds"><button type="button" aria-expanded={expanded==='costs'} aria-controls={`${id}-detail`} onClick={()=>toggle('costs')}>Whole-outing cost detail <ChevronDown size={15}/></button><button type="button" aria-expanded={expanded==='sources'} aria-controls={`${id}-detail`} onClick={()=>toggle('sources')}>Hours and sources <ChevronDown size={15}/></button></div>
    <div id={`${id}-detail`} className="route-note-detail" hidden={!expanded||expanded==='route'}>
      {journey&&<><h3>{journey.title} · leg details</h3><ol className="route-note-legs">{journey.legs.map(leg=><li key={leg.id}><strong>{leg.label}</strong><span>{formatClock(leg.startMinutes)}–{formatClock(leg.endMinutes)} · {formatRouteDuration(leg.durationMinutes)}</span>{leg.kind==='travel'?<p>{leg.from} → {leg.to}</p>:<p>Authored clearance allowance, not a current queue estimate.</p>}</li>)}</ol><p>Journey durations are authored allowances, not a timetable, live arrival estimate or confirmed transport service.</p></>}
      {expanded==='evening'&&<><h3>{view.middle.title}</h3><p>{view.middle.mealText}<br/>{view.middle.walkText}<br/>{view.middle.delayText}</p><p>Dinner ends {formatClock(view.middle.dinnerEndMinutes)} · leave area {formatClock(view.middle.endMinutes)}.</p></>}
      {expanded==='costs'&&<><h3>Whole-outing cost</h3><p>{view.middle.mealText}<br/>{view.middle.walkText}<br/>{view.middle.delayText}</p><p className="route-note-total">{view.costText}</p><p>Illustrative group amounts for two adults, including travel both ways. CNY uses {view.fxHKDPerCNY} HKD per CNY, an authored exchange assumption.</p><ul className="route-note-cost-lines">{view.costLines.map(line=><li key={line.id}><strong>{line.label}</strong><span>{line.nativeGroupAmount===null||line.hkdGroupAmount===null?'Unknown · required cost missing':<><span className="route-money">{line.currency} {line.nativeGroupAmount.toFixed(2)}</span>{line.currency==='CNY'&&<> = <span className="route-money">{formatRouteMoney(line.hkdGroupAmount)}</span></>} for two</>}</span><small>{line.note}</small></li>)}</ul></>}
      {expanded==='sources'&&(view.crossingHours?<><h3>Published crossing hours</h3><p>{view.crossingHours.label}</p><p>{view.crossingFitText} {view.crossingHours.marginText}</p><p>{view.crossingHours.source.note} <a href={view.crossingHours.source.url} target="_blank" rel="noreferrer">{view.crossingHours.source.title}</a> · checked {view.crossingHours.source.checkedDate}.</p><p>Times, fares, dinner prices and clearance allowances are authored scenario inputs. Luohu is this scenario’s dinner area, not a verified venue.</p></>:<><h3>Local journey assumptions</h3><p>Local travel times and costs are authored scenario inputs. Check current transport, prices and opening hours before real travel.</p></>)}
    </div>
    {view.entryText&&<p className="route-note-uncertainty">{view.entryText}</p>}
    {view.actualProgress.outwardComplete&&onReconsiderDeparture&&<button type="button" className="route-note-reconsider" onClick={onReconsiderDeparture}><RotateCcw size={15} aria-hidden="true"/>Reconsider departure</button>}
  </div>;
}
