import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Clock3, Coffee, Compass, Home, MapPin, RotateCcw, TrainFront, Utensils, Wallet, X } from 'lucide-react';
import { formatClock } from '../domain/engine';
import type { Familiarity, OptionId, OutingInputs, OutingOption } from '../domain/model';
import { createStoryState, decodeStoryState, previewStoryAction, selectStoryInputs, selectStoryJournal, selectStoryOption, selectStoryPreviousOption, selectStoryProgress, STORY_PRESETS, storyReducer } from '../story/engine';
import type { StoryAction, StoryHotspot, StoryState } from '../story/model';
import './playable-evening.css';

export const PLAYABLE_STORAGE_KEY = 'between-playable-v2';
const art = (name: string) => (globalThis as typeof globalThis & {__BETWEEN_ART__?: Record<string,string>}).__BETWEEN_ART__?.[name] ?? `${import.meta.env.BASE_URL}art/${name}`;
const money = (value: number | null) => value === null ? 'Unknown' : `HK$${value.toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const minutes = (value: number) => `${Math.floor(value/60) ? `${Math.floor(value/60)}h ` : ''}${value%60 ? `${value%60}m` : ''}`.trim() || '0m';
const cityName = (city: OptionId) => city === 'hk' ? 'Hong Kong' : 'Shenzhen';
function readPlayable(): {state: StoryState; warning: string} {
  try {
    const raw = localStorage.getItem(PLAYABLE_STORAGE_KEY);
    if (!raw) return {state:createStoryState(),warning:''};
    const restored = decodeStoryState(raw);
    return restored ? {state:restored,warning:''} : {state:createStoryState(),warning:'This saved story could not be restored. Your practical planner is separate and unchanged.'};
  } catch {return {state:createStoryState(),warning:'This browser cannot save the story. It still works while this tab stays open.'};}
}
export function resetPlayableSave() {try {localStorage.removeItem(PLAYABLE_STORAGE_KEY);} catch {/* In-memory reset still works. */}}

function SceneVisual({city, phase, children}: {city: OptionId|null; phase:string; children:React.ReactNode}) {
  const original = city === 'hk' ? 'hong-kong-evening.webp' : city === 'sz' ? 'shenzhen-evening.webp' : 'two-shores.webp';
  const preferred = city && ['walk','home'].includes(phase) ? city==='hk'?'hk-evening-night.webp':'sz-evening-night.webp' : original;
  const [source,setSource] = useState(preferred);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{setSource(preferred);setFailed(false);},[preferred]);
  return <div className={`play-world world-${city ?? 'both'} world-phase-${phase}`}>
    {failed ? <div className="play-image-fallback"><span>香港 ↔ 深圳</span><p>The scene can be explored through the controls below.</p></div> : <img className="play-world-image" data-art={source} src={art(source)} onError={()=>source!==original?setSource(original):setFailed(true)} alt={city === 'hk' ? 'An imagined Hong Kong restaurant beside the harbor, with a table under warm lights.' : city === 'sz' ? 'An imagined Shenzhen dining terrace beside a leafy avenue and transit entrance.' : 'An imagined two-city harbor at dusk, with two equally inviting shores.'}/>}
    <div className="play-world-wash"/>
    {children}
    <span className="play-art-caption">AN IMAGINED SCENE · NOT A NAVIGATION MAP</span>
  </div>;
}

function Jun({line}: {line:string}) {
  const [failed,setFailed] = useState(false);
  return <div className="jun-dialogue">
    <div className="jun-avatar"><span>J</span>{!failed && <img data-art="jun-portrait.webp" src={art('jun-portrait.webp')} alt="Jun, an original fictional adult companion with a teal overshirt and a sketchbook." onError={()=>setFailed(true)}/>}</div>
    <div><span className="jun-name">JUN <small>Fictional companion</small></span><p>{line}</p></div>
  </div>;
}

export default function PlayableEvening({onExit,onPlanner,onResearch}: {onExit:()=>void;onPlanner:(inputs:OutingInputs)=>void;onResearch:()=>void}) {
  const initial = useMemo(readPlayable,[]);
  const [state,dispatch] = useReducer(storyReducer,initial.state);
  const [warning,setWarning] = useState(initial.warning);
  const [showSetup,setShowSetup] = useState(false);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const phaseTitle = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(state.currentAttempt.phase);
  const attempt = state.currentAttempt;
  const phase = attempt.phase;
  const city = attempt.city ?? state.previewCity;
  const option = selectStoryOption(state);
  const previous = selectStoryPreviousOption(state);
  const progress = selectStoryProgress(state);
  const journal = selectStoryJournal(state);
  const atFork = phase === 'fork';
  const finished = phase === 'home';
  const preset = STORY_PRESETS.find(item=>item.id===state.presetId)!;
  useEffect(()=>{
    try {localStorage.setItem(PLAYABLE_STORAGE_KEY,JSON.stringify(state)); if(warning.startsWith('This browser'))setWarning('');}
    catch {setWarning('This browser cannot save the story. It still works while this tab stays open.');}
  },[state]);
  useEffect(()=>{
    if(previousPhase.current !== phase){phaseTitle.current?.focus({preventScroll:true});previousPhase.current=phase;}
  },[phase]);
  const action = (next:StoryAction) => dispatch(next);
  const reopenFork = () => action({type:'REWIND',checkpoint:'fork'});
  const title = atFork ? city ? city==='hk' ? 'A table around the corner.' : 'A table across the border.' : 'One table. One street.\nWhere shall we begin?' : phase === 'arrival' ? 'How much evening\nbelongs to the table?' : phase === 'afterDinner' ? progress.delayApplied ? 'The table took\na little longer.' : 'There’s a street\nstill waiting for us.' : phase === 'walk' ? attempt.walkChoice === 'long' ? 'A little room\nfor the city.' : 'One small loop.\nOne detail to keep.' : 'Something\nto bring home.';
  const junLine = atFork ? 'I brought the small sketchbook. One table, one street. Where shall we begin?' : phase === 'arrival' ? 'We can keep dinner simple, or give the table a little more of the evening.' : phase === 'afterDinner' ? progress.delayApplied ? 'Half an hour longer at the table. Let’s look at what we still want to keep.' : 'We have a walk ahead of us. A small loop or a longer wander?' : phase === 'walk' ? attempt.walkChoice === 'long' ? 'Then I’ll leave a corner of the page for the walk.' : 'A small loop, then. We can still bring back one detail.' : 'Which detail belongs on this page?';
  const phaseLabels = ['The fork','At the table','After dinner','In the street','Back home'];
  const phaseIndex = ['fork','arrival','afterDinner','walk','home'].indexOf(phase);
  const hotspots: {id:StoryHotspot;label:string;icon:typeof Coffee;x:number;y:number}[] = city === 'hk' ? [
    {id:'table',label:'The table',icon:Utensils,x:28,y:57},{id:'wander',label:'The harbor',icon:Compass,x:79,y:47},{id:'home',label:'The way home',icon:Home,x:53,y:80},
  ] : [{id:'table',label:'The table',icon:Utensils,x:28,y:59},{id:'wander',label:'The avenue',icon:Compass,x:58,y:63},{id:'home',label:'The way home',icon:TrainFront,x:90,y:50}];
  const inspected = (id:StoryHotspot) => city && attempt.inspectedHotspots.includes(`${city}:${id}`);
  const detail = state.openHotspot === 'table' ? {title:'A table, and a choice.',text:city === 'hk' ? 'Warm light under the awning. This example allows HK$248 per person for dinner, plus drinks. One shared dessert is optional.' : 'A dining terrace beside the avenue. This example allows CNY128 per person for dinner, plus drinks. One shared order is optional.',note:'Looking is free. The dinner choice decides the time and shared order.'} : state.openHotspot === 'wander' ? {title:city === 'hk' ? 'Leave a little room for the water.' : 'See where the avenue leads.',text:city === 'hk' ? 'Beyond the table, the harbor catches the last light. A short loop and a longer walk can both leave a detail for the sketchbook.' : 'The avenue opens past the trees and terraces. A short loop and a longer walk can both leave a detail for the sketchbook.',note:'Choose 15 or 45 minutes after dinner. No enjoyment score is assigned.'} : {title:'The evening includes getting home.',text:option ? `${option.routeLabel}. The model allows ${minutes(option.inwardMinutes)} for the return journey${city==='sz' ? ', including the assumed clearance buffer' : ''}.` : '',note:city==='sz' ? 'Real entry eligibility, transport services and queues remain unverified. This is a fictional branch.' : 'The return time comes from the same editable planner assumptions.'};
  const unresolved = option?.reasons.filter(reason=>!reason.startsWith('Within') && !reason.includes('before the deadline')) ?? [];

  return <section className={`playable-evening play-phase-${phase}`} aria-label="Play an illustrative evening">
    <div className="play-hud">
      <span className="play-hud-label"><span className="status-dot"/> FICTIONAL SATURDAY</span>
      <span><Clock3 size={15}/><strong>{formatClock(progress.clockMinutes)}</strong><small>story clock · UTC+8</small></span>
      <span><Wallet size={15}/><strong>{option ? money(option.perPersonHKD) : money(state.baseInputs.budgetPerPersonHKD)}</strong><small>{option ? 'whole outing estimate / person' : 'budget / person'}</small></span>
      <span className="play-deadline">Home by <strong>{formatClock(state.baseInputs.homeByMinutes)}</strong><span className="play-budget-limit">Budget HK${state.baseInputs.budgetPerPersonHKD}/person</span></span>
    </div>
    {warning && <p className="play-storage-notice" role="status">{warning}</p>}
    <div className="play-topline"><button onClick={onExit}><ArrowLeft size={14}/> Back to the cover</button><span>{preset.label} · two fictional adults</span><button onClick={()=>onPlanner(selectStoryInputs(state))}>Open this model in the planner <ArrowUpRight size={14}/></button></div>
    <div className="play-heading"><div><p className="eyebrow">{String(phaseIndex+1).padStart(2,'0')} / {phaseLabels[phaseIndex]}</p><h1 ref={phaseTitle} tabIndex={-1}>{title}</h1></div><div className="play-trail" role="group" aria-label={`Story progress: ${phaseLabels[phaseIndex]}`}>{phaseLabels.map((label,index)=><span key={label} className={index===phaseIndex?'current':index<phaseIndex?'complete':''}><i>{index<phaseIndex?<Check size={11}/>:index+1}</i><small>{label}</small></span>)}</div></div>

    {atFork && !state.previousAttempt && <details className="play-setup" open={showSetup} onToggle={event=>setShowSetup(event.currentTarget.open)}><summary><div><strong>{preset.label}</strong><span>{formatClock(state.baseInputs.departureMinutes)}–{formatClock(state.baseInputs.homeByMinutes)} · HK${state.baseInputs.budgetPerPersonHKD}/person · two adults</span><small>{state.delayScenario==='dinner30'?'Includes one fictional 30-minute dinner delay':'Calm version · no fictional delay'}</small></div><span>Change setup <ChevronDown size={15}/></span></summary><div className="play-setup-interior"><div className="play-presets" role="group" aria-label="Choose the shape of the evening">{STORY_PRESETS.map(item=><button key={item.id} aria-pressed={item.id===state.presetId} onClick={()=>{action({type:'RECONFIGURE',presetId:item.id,delayScenario:state.delayScenario});setShowSetup(false);}}><strong>{item.label}</strong><span>{formatClock(item.departureMinutes)}–{formatClock(item.homeByMinutes)} · HK${item.budgetPerPersonHKD}/person</span></button>)}</div><label className="play-delay-check"><input type="checkbox" checked={state.delayScenario==='dinner30'} onChange={event=>action({type:'RECONFIGURE',delayScenario:event.target.checked?'dinner30':'none'})}/><span>Include one fictional 30-minute dinner delay<small>A disclosed story event, not a queue forecast. Uncheck for a calm evening.</small></span></label></div></details>}
    {atFork && state.previousAttempt && <div className="play-returning-note"><BookOpen size={17}/><p>The first evening stays in your notebook. Begin the other possibility with the same starting time, budget and fictional delay.</p></div>}

    {!finished && <>
      {atFork && <div className="play-city-switch" role="group" aria-label="Preview a city"><span>LOOK BEFORE YOU CHOOSE</span>{(['hk','sz'] as const).map(id=><button aria-pressed={city===id} key={id} onClick={()=>action({type:'PREVIEW_CITY',city:id})}>{cityName(id)} <span>{id==='hk'?'香港':'深圳'}</span><ArrowRight size={14}/></button>)}</div>}
      <SceneVisual city={city} phase={phase}>
        <div className="play-scene-badge"><span className="status-dot"/>{city ? `${cityName(city).toUpperCase()} · ${atFork ? 'A FREE LOOK AROUND' : 'THIS EVENING’S CHOSEN BRANCH'}` : 'TWO POSSIBILITIES · ONE EVENING'}</div>
        {!city ? <><button className="play-world-city city-hk" onClick={()=>action({type:'PREVIEW_CITY',city:'hk'})}><MapPin size={19}/><span>Hong Kong<small>A table nearby</small></span></button><button className="play-world-city city-sz" onClick={()=>action({type:'PREVIEW_CITY',city:'sz'})}><MapPin size={19}/><span>Shenzhen<small>A table across the border</small></span></button></> : hotspots.map(spot=><button key={spot.id} className={`play-hotspot ${state.openHotspot===spot.id?'open':''} ${inspected(spot.id)?'seen':''}`} style={{left:`${spot.x}%`,top:`${spot.y}%`}} aria-label={`Inspect ${spot.label.toLowerCase()} in the illustration`} onClick={()=>action({type:'INSPECT',hotspot:spot.id})}><spot.icon size={17}/><span>{spot.label}</span>{inspected(spot.id)&&<i><Check size={9}/></i>}</button>)}
      </SceneVisual>
      {city && <div className="play-inspection-row"><span>LOOK CLOSER <small>doesn’t advance time</small></span><div role="group" aria-label="Scene inspections">{hotspots.map(spot=><button key={spot.id} aria-pressed={state.openHotspot===spot.id} onClick={()=>action({type:'INSPECT',hotspot:spot.id})}><spot.icon size={14}/>{spot.label}{inspected(spot.id)&&<Check size={12}/>}</button>)}</div></div>}
      {city && state.openHotspot && <div className="play-inspection-detail" role="region" aria-label="Scene detail"><div><p className="eyebrow">A DETAIL TO NOTICE</p><h2>{detail.title}</h2><p>{detail.text}</p><small>{detail.note}</small></div><button aria-label="Close scene detail" onClick={()=>action({type:'CLOSE_INSPECTION'})}><X size={18}/></button></div>}

      <div className="play-console"><Jun line={junLine}/><div className="play-actions">
        {atFork && !city && <p className="play-free-look">Choose a shore in the scene, or use the city buttons above. You can inspect both before committing any time.</p>}
        {atFork && city && <>
          {city==='sz' && <div className="play-route-options" role="group" aria-label="Shenzhen crossing route">{(['rail','bus'] as const).map(route=>{const preview=previewStoryAction(state,{type:'SET_ROUTE',route});const candidate=preview.comparison.options.find(item=>item.id==='sz');return <button key={route} aria-pressed={attempt.route===route} onClick={()=>action({type:'SET_ROUTE',route})}><strong>{route==='rail'?'Rail · Lo Wu':'Road · Lok Ma Chau'}</strong><span>{candidate ? `${minutes(candidate.outwardMinutes)} out · ${money(candidate.perPersonHKD)}/person whole outing` : 'Check model inputs'}</span></button>;})}</div>}
          <div className="play-departure-preview"><span><Clock3 size={16}/> Arrival {option && formatClock(option.arrivalMinutes)}</span><span>{option && minutes(option.outwardMinutes)} outward</span><span>{option && money(option.perPersonHKD)} / person, illustrative</span></div>
          <button className="play-primary" onClick={()=>action({type:'COMMIT_DEPARTURE',city,route:attempt.route})}>Make {cityName(city)} our evening <ArrowRight size={18}/></button>
          <p className="play-smallprint">The estimate starts with a 60-minute dinner and 45-minute walk. You’ll choose the meal and walk next.{city==='sz'?' The fiction remains open while real entry and transport checks remain unconfirmed.':''}</p>
        </>}
        {phase==='arrival' && <div className="play-choice-grid">{([{id:'simple',title:'Dinner, then out.',body:'60 minutes at the table. Keep the shared order off this bill.'},{id:'linger',title:'Stay for one more dish.',body:`90 minutes at the table. Add one shared ${city==='hk'?'dessert':'order of dishes'}.`}] as const).map(choice=><Choice key={choice.id} state={state} action={{type:'COMMIT_DINNER',choice:choice.id}} title={choice.title} body={choice.body} dispatch={action}/>)}</div>}
        {phase==='afterDinner' && <><p className="play-event-note">{progress.delayApplied ? 'The disclosed dinner delay has added 30 minutes once. It adds no extra charge.' : 'This is the calm version. No fictional delay is applied.'}</p><div className="play-choice-grid">{([{id:'long',title:'Keep the longer wander.',body:'45 minutes for the harbor or avenue. Let the return time move if it needs to.'},{id:'short',title:'Make it a small loop.',body:'15 minutes near the table. Keep a little of the walk and recover 30 minutes.'}] as const).map(choice=><Choice key={choice.id} state={state} action={{type:'COMMIT_WALK',choice:choice.id}} title={choice.title} body={choice.body} dispatch={action}/>)}</div></>}
        {phase==='walk' && <><p className="play-observation">{city==='hk' ? attempt.walkChoice==='long'?'From the waterfront, the small pools of restaurant light become part of a larger shore.':'Back near the awning, a plant pot catches the warm light from the table.' : attempt.walkChoice==='long'?'Farther along the avenue, the trees frame small tables against the evening towers.':'Near the terrace, a few leaves throw moving shapes across the pavement.'} <span>An authored observation, not a live report.</span></p><Mementos selected={attempt.memento} onChoose={memento=>action({type:'KEEP_MEMENTO',memento})}/><button className="play-primary" onClick={()=>action({type:'RETURN_HOME'})}>Follow the return journey <ArrowRight size={18}/></button><p className="play-smallprint">{option && `${minutes(option.inwardMinutes)} back · modelled home arrival ${formatClock(option.returnMinutes)}.`} Real-world checks remain separate.</p></>}
      </div></div>
      {city && <details className="play-familiarity"><summary>Would these activities be new to you? <span>Optional · no score in this story</span></summary><div>{(['dinner','walk'] as const).map(activity=><label key={activity}>{activity==='dinner'?'This dinner':'This wander'} in {cityName(city)}<select value={attempt.familiarity[city][activity]} onChange={event=>action({type:'SET_FAMILIARITY',city,activity,value:event.target.value as Familiarity})}><option value="unsure">Not sure</option><option value="new">New to me</option><option value="familiar">Familiar to me</option></select></label>)}</div><p>Only your explicit answers travel into the optional planner rubric. Neither city is assigned novelty by default.</p></details>}
      {!atFork && option && <div className="play-projection" aria-live="polite"><div><span>PROJECTED HOME</span><strong>{formatClock(option.returnMinutes)}</strong></div><div><span>WHOLE OUTING / PERSON</span><strong>{money(option.perPersonHKD)}</strong></div><div><span>YOUR HOME DEADLINE</span><strong>{formatClock(option.homeByMinutes)}</strong></div><p>{option.homeFeasible ? `${option.spareMinutes} minutes inside this story’s deadline.` : `${Math.abs(option.spareMinutes)} minutes beyond this story’s deadline. You can keep a tentative ending or rewind.`}{!option.crossingFeasible?' The planned crossing is outside the modelled clearance window.':''}{option.budgetFeasible===false?' The estimated bill also exceeds the per-person budget.':''}</p></div>}
    </>}

    {finished && option && <div className="play-ending"><div className="play-journal-art"><SceneVisual city={city} phase={phase}><span className="play-journal-seal">ONE TABLE<br/>ONE STREET<br/>ONE EVENING</span></SceneVisual><Jun line={junLine}/></div><article className="play-journal-page"><p className="eyebrow">ATTEMPT {attempt.id} · YOUR EVENING, ON ONE PAGE</p><h2>{cityName(option.id)}<br/><em>{attempt.walkChoice==='long'?'The longer way around.':'One small loop.'}</em></h2><dl className="play-journal-facts"><div><dt>Left</dt><dd>{formatClock(option.departureMinutes)}</dd></div><div><dt>Modelled home</dt><dd>{formatClock(option.returnMinutes)}</dd></div><div><dt>Whole outing / person</dt><dd>{money(option.perPersonHKD)}</dd></div><div><dt>Whole group · two adults</dt><dd>{money(option.groupHKD)}</dd></div></dl><ol className="play-journal-entries">{journal.map((line,index)=><li key={`${index}-${line}`}>{line}</li>)}</ol>{unresolved.length>0 && <div className="play-unresolved"><strong>Still a model, with checks to make</strong><ul>{unresolved.map(line=><li key={line}>{line}</li>)}</ul></div>}<Mementos selected={attempt.memento} onChoose={memento=>action({type:'KEEP_MEMENTO',memento})}/><label className="play-personal-note">One sentence to keep<textarea value={attempt.journalNote} maxLength={1000} rows={3} placeholder="What belongs on this page for you?" onChange={event=>action({type:'SET_JOURNAL_NOTE',text:event.target.value})}/></label><p className="play-smallprint">Saved only in this browser when storage is available. The costs and events are illustrative.</p><button className="play-primary" onClick={()=>action({type:'TRY_OTHER_CITY'})}>Try the other evening from the fork <RotateCcw size={17}/></button><button className="play-text-link" onClick={()=>onPlanner(selectStoryInputs(state))}>Inspect this model in the practical planner <ArrowUpRight size={14}/></button></article></div>}
    {finished && previous && state.previousAttempt && option && <section className="play-two-pages"><div><p className="eyebrow">TWO PLAYER-MADE EVENINGS</p><h2>Different choices. Kept side by side.</h2><p>The starting scenario is the same. Meal, walk and route choices can differ, so this is a comparison of your two plans, not a claim that a city caused the difference.</p></div><div className="play-attempt-comparison"><AttemptSummary option={previous} dinner={state.previousAttempt.dinnerChoice} walk={state.previousAttempt.walkChoice} label="Previous page"/><AttemptSummary option={option} dinner={attempt.dinnerChoice} walk={attempt.walkChoice} label="This page"/></div></section>}
    <div className="play-footer-controls"><div>{!atFork && <button onClick={reopenFork}><RotateCcw size={14}/> Rewind to the fork</button>}{['afterDinner','walk','home'].includes(phase)&&<button onClick={()=>action({type:'REWIND',checkpoint:'arrival'})}>Reconsider dinner</button>}{['walk','home'].includes(phase)&&<button onClick={()=>action({type:'REWIND',checkpoint:'afterDinner'})}>Reconsider the walk</button>}</div><button onClick={()=>resetDialog.current?.showModal()}>Start a fresh evening</button><button onClick={onResearch}>What would explain these prices? <ArrowUpRight size={14}/></button></div>
    <p className="play-fiction-note">Fictional adults, authored dialogue and one disclosed scenario event. No real journey, booking, live queue, immigration decision or AI-generated conversation is taking place.</p>
    <dialog className="dialog" ref={resetDialog} aria-labelledby="play-reset-title"><div className="dialog-content"><button className="dialog-close" aria-label="Close reset confirmation" onClick={()=>resetDialog.current?.close()}><X size={19}/></button><p className="eyebrow">A CLEAN PAGE</p><h2 id="play-reset-title">Begin a fresh story?</h2><p>This replaces both saved story attempts and their notes. Your separate practical planner stays as it is.</p><div className="dialog-actions"><button className="button-primary" onClick={()=>{action({type:'RESET',presetId:'wander'});resetDialog.current?.close();}}>Start a fresh story</button><button className="text-button" onClick={()=>resetDialog.current?.close()}>Keep these pages</button></div></div></dialog>
  </section>;
}

function Choice({state,action,title,body,dispatch}: {state:StoryState;action:StoryAction;title:string;body:string;dispatch:(action:StoryAction)=>void}) {
  const preview=previewStoryAction(state,action);
  const option=preview.option;
  return <button className="play-choice" disabled={!preview.allowed} onClick={()=>dispatch(action)}><strong>{title}</strong><p>{body}</p><span className="play-choice-consequence"><span><Clock3 size={14}/> Home {option ? formatClock(option.returnMinutes) : 'unknown'}</span><span>{option ? money(option.perPersonHKD) : 'Unknown bill'} / person</span></span><small className="play-choice-delta">{preview.perPersonDeltaHKD===null?'Price difference unknown':preview.perPersonDeltaHKD===0?'Same bill':`${preview.perPersonDeltaHKD>0?'+':'−'}${money(Math.abs(preview.perPersonDeltaHKD))}/person`}{action.type==='COMMIT_DINNER'&&preview.progress.dinnerEndMinutes!==null?` · Dinner ends ${formatClock(preview.progress.dinnerEndMinutes)}`:''}</small>{option && (!option.homeFeasible||!option.crossingFeasible||option.budgetFeasible===false) && <small className="play-choice-warning">{[!option.homeFeasible?`${Math.abs(option.spareMinutes)} min beyond the home deadline.`:'',!option.crossingFeasible?'Check the border timing.':'',option.budgetFeasible===false?'Over this per-person budget.':''].filter(Boolean).join(' ')} A tentative story outcome.</small>}<span className="play-choice-verb">Choose this version <ArrowRight size={16}/></span></button>;
}
function Mementos({selected,onChoose}: {selected:StoryState['currentAttempt']['memento'];onChoose:(value:'view'|'conversation'|'practical')=>void}) {
  return <div className="play-mementos" role="group" aria-label="Choose a memento"><span>WHAT WOULD YOU KEEP?</span>{([{id:'view',label:'Keep the view'},{id:'conversation',label:'Remember the conversation'},{id:'practical',label:'Just the practical note'}] as const).map(item=><button key={item.id} aria-pressed={selected===item.id} onClick={()=>onChoose(item.id)}>{selected===item.id?<Check size={13}/>:<BookOpen size={13}/>} {item.label}</button>)}</div>;
}
function AttemptSummary({option,dinner,walk,label}: {option:OutingOption;dinner:StoryState['currentAttempt']['dinnerChoice'];walk:StoryState['currentAttempt']['walkChoice'];label:string}) {
  return <article><p className="eyebrow">{label}</p><h3>{cityName(option.id)}</h3><dl><div><dt>Dinner</dt><dd>{dinner==='linger'?'90 min + shared order':'60 min, no shared order'}</dd></div><div><dt>Wander</dt><dd>{walk==='long'?'45 minutes':'15 minutes'}</dd></div><div><dt>Fictional delay</dt><dd>{option.storyDelayMinutes} minutes</dd></div><div><dt>Route</dt><dd>{option.routeLabel}</dd></div><div><dt>Modelled home</dt><dd>{formatClock(option.returnMinutes)}</dd></div><div><dt>Whole outing / person</dt><dd>{money(option.perPersonHKD)}</dd></div></dl></article>;
}
