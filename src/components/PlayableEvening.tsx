import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Clock3, Compass, Home, MapPin, MoreHorizontal, RotateCcw, Smartphone, TrainFront, Utensils, Wallet, X } from 'lucide-react';
import { formatClock } from '../domain/engine';
import type { OptionId, OutingInputs, OutingOption } from '../domain/model';
import { tableObjects, tableScenes } from '../data/scene-art';
import { RouteNote } from './RouteNote';
import { selectRouteView } from '../story/route-view';
import type { RouteReturnIntent } from '../story/route-view';
import { createStoryState, decodeStoryState, previewStoryAction, selectStoryComparison, selectStoryInputs, selectStoryOption, selectStoryProgress, STORY_PRESETS, storyReducer } from '../story/engine';
import type { StoryAction, StoryHotspot, StoryState } from '../story/model';
import './playable-evening.css';

export const PLAYABLE_STORAGE_KEY = 'between-playable-v2';
const art = (name: string) => (globalThis as typeof globalThis & {__BETWEEN_ART__?: Record<string,string>}).__BETWEEN_ART__?.[name] ?? `${import.meta.env.BASE_URL}art/${name}`;
const money = (value: number | null) => value === null ? 'Unknown' : `HK$${value.toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const minutes = (value: number) => `${Math.floor(value/60) ? `${Math.floor(value/60)}h ` : ''}${value%60 ? `${value%60}m` : ''}`.trim() || '0m';
const cityName = (city: OptionId) => city === 'hk' ? 'Hong Kong' : 'Shenzhen';
// The module lives for the tab's lifetime, so route changes do not depend on
// browser storage being available. Reducer states are immutable snapshots.
let inTabStory: StoryState | null = null;
let inTabWarning = '';
let protectSavedBytes = false;
const storageWarning = 'This browser cannot save the story. You can move between views in this tab; reloading or closing it will lose these pages.';
function readPlayable(): {state: StoryState; warning: string} {
  if(inTabStory) return {state:inTabStory,warning:inTabWarning};
  try {
    const raw = localStorage.getItem(PLAYABLE_STORAGE_KEY);
    const restored = raw !== null ? decodeStoryState(raw) : null;
    inTabStory = restored ?? createStoryState();
    protectSavedBytes = raw !== null && !restored;
    inTabWarning = protectSavedBytes ? 'This saved story could not be restored. The original saved data is untouched. You can play temporarily in this tab, or choose Start a fresh story to replace it.' : '';
  } catch {inTabStory=createStoryState();inTabWarning=storageWarning;protectSavedBytes=true;}
  return {state:inTabStory,warning:inTabWarning};
}
export function resetPlayableSave() {
  inTabStory=createStoryState();inTabWarning='';protectSavedBytes=false;
  try {localStorage.removeItem(PLAYABLE_STORAGE_KEY);}
  catch {protectSavedBytes=true;inTabWarning='The story was reset in this tab, but this browser could not clear its saved copy. That older copy may return after a reload.';}
}


type Panel = 'invitation'|'observation'|'wallet'|'phone'|'destination'|'arrived'|'dinner'|'afterDinner'|'walkChoice'|'walked'|'return'|'home'|'options'|'reset'|'legacyReplay';
type Place = {id:StoryHotspot;label:string;icon:typeof Utensils;x:number;y:number};
const approximateMoney = (value:number|null) => value===null?'Unknown total':`about HK$${Math.round(value).toLocaleString('en-HK')}/person`;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function SceneVisual({city,phase,children}: {city:OptionId|null;phase:string;children:React.ReactNode}) {
  const table = city && ['arrival','afterDinner'].includes(phase) ? tableScenes[city] : null;
  const original = table?.image ?? (city === 'hk' ? 'hong-kong-evening.webp' : city === 'sz' ? 'shenzhen-evening.webp' : 'two-shores.webp');
  const preferred = city && ['walk','home'].includes(phase) ? city==='hk'?'hk-evening-night.webp':'sz-evening-night.webp' : original;
  const [source,setSource] = useState(preferred);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{setSource(preferred);setFailed(false);},[preferred]);
  return <div className={`play-world world-${city ?? 'both'} world-phase-${phase}`} style={{'--scene-ratio':table?table.width/table.height:1672/941} as React.CSSProperties}>
    {failed ? <div className="play-image-fallback" role="img" aria-label="Illustrated scene unavailable"><span>{city ? cityName(city) : 'Hong Kong · Shenzhen'}</span><p>You can still look around and make every choice using the named place controls.</p></div> : <img className="play-world-image" data-art={source} src={art(source)} onError={()=>source!==original?setSource(original):setFailed(true)} alt={table?.alt ?? (city === 'hk' ? 'An imagined Hong Kong restaurant beside the harbor, with a table under warm lights.' : city === 'sz' ? 'An imagined Shenzhen dining terrace beside a leafy avenue and transit entrance.' : 'An imagined two-city harbor at dusk, with two inviting shores.')}/>}
    {children}
  </div>;
}
function JunPortrait() {
  const [failed,setFailed] = useState(false);
  return <div className="jun-avatar"><span aria-hidden="true">J</span>{!failed && <img data-art="jun-portrait.webp" src={art('jun-portrait.webp')} alt="Jun, a fictional adult companion." onError={()=>setFailed(true)}/>}</div>;
}

export default function PlayableEvening({onBrowsePlanner,onPlanner,onResearch}: {onExit:()=>void;onBrowsePlanner:()=>void;onPlanner:(inputs:OutingInputs)=>void;onResearch:()=>void}) {
  const initial = useMemo(readPlayable,[]);
  const [state,dispatch] = useReducer(storyReducer,initial.state);
  const [warning,setWarning] = useState(initial.warning);
  const [panel,setPanel] = useState<Panel|null>(()=>initial.state.currentAttempt.phase==='fork'&&!initial.state.previewCity?'invitation':null);
  const [line,setLine] = useState(0);
  const [pendingReplay,setPendingReplay] = useState<{action:StoryAction;nextPanel:Panel;fromPanel:Panel|null}|null>(null);
  const [attended,setAttended] = useState<StoryHotspot>('table');
  const [tableTarget,setTableTarget] = useState<keyof typeof tableObjects>('jun');
  const [tableFrameHeight,setTableFrameHeight] = useState<number|null>(null);
  const [phoneContext,setPhoneContext] = useState<{from:Panel|null;line:number;object:keyof typeof tableObjects;returnFirst:boolean;returnIntent:RouteReturnIntent;changeRoute:boolean}>({from:null,line:0,object:'jun',returnFirst:false,returnIntent:'planned',changeRoute:false});
  const phoneSourceLabel = useRef<string|null>(null);
  const restorePhoneFocus = useRef<string|null>(null);
  const dialogue = useRef<HTMLDialogElement>(null);
  const dialogueTitle = useRef<HTMLHeadingElement>(null);
  const previousDialoguePanel = useRef<Panel|null>(null);
  const returnFocus = useRef<HTMLElement|null>(null);
  const nextPlace = useRef<HTMLButtonElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const attempt = state.currentAttempt;
  const phase = attempt.phase;
  const city = attempt.city ?? state.previewCity;
  const visualCity = city ?? 'hk';
  const atTable = phase==='arrival'||phase==='afterDinner';
  const sceneKey = `${visualCity}-${atTable?'table':['walk','home'].includes(phase)?'night':'street'}`;
  const option = selectStoryOption(state);
  const routeView = selectRouteView(state);
  const walletWarningOption = routeView?.conditionalOption ?? option;
  const progress = selectStoryProgress(state);
  const comparison = selectStoryComparison(state);
  const homeDeadline = option?.homeByMinutes ?? comparison.normalizedHomeByMinutes ?? state.baseInputs.homeByMinutes;
  const preset = STORY_PRESETS.find(item=>item.id===state.presetId)!;
  useEffect(()=>{
    inTabStory=state;
    if(protectSavedBytes){setWarning(inTabWarning);return;}
    try {localStorage.setItem(PLAYABLE_STORAGE_KEY,JSON.stringify(state));inTabWarning='';setWarning('');}
    catch {inTabWarning=storageWarning;setWarning(storageWarning);}
  },[state]);
  useEffect(()=>{
    if(panel){
      if(!dialogue.current?.open) dialogue.current?.showModal();
      if(previousDialoguePanel.current!==panel && dialogue.current) dialogue.current.scrollTop=0;
      dialogueTitle.current?.focus({preventScroll:true});
      if(panel!=='phone' && restorePhoneFocus.current){
        const label=restorePhoneFocus.current;restorePhoneFocus.current=null;
        Array.from(dialogue.current?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(button=>(button.getAttribute('aria-label')??button.textContent?.trim())===label)?.focus();
      }
    } else if(dialogue.current?.open) dialogue.current.close();
    previousDialoguePanel.current=panel;
  },[panel,line]);
  const action = (next:StoryAction) => {
    if(next.type==='RESET'){protectSavedBytes=false;inTabWarning='';setWarning('');}
    dispatch(next);
  };
  const places:Place[] = visualCity==='hk' ? [
    {id:'table',label:'the table',icon:Utensils,x:28,y:57},{id:'wander',label:'the harbor',icon:Compass,x:79,y:47},{id:'home',label:'the way home',icon:Home,x:53,y:80},
  ] : [{id:'table',label:'the table',icon:Utensils,x:28,y:59},{id:'wander',label:'the avenue',icon:Compass,x:58,y:63},{id:'home',label:'the way home',icon:TrainFront,x:90,y:50}];
  const panTo = (x:number,animate=true) => {
    const viewport=scene.current;
    if(!viewport) return;
    viewport.scrollTo({left:viewport.scrollWidth*x/100-viewport.clientWidth/2,behavior:animate&&!reducedMotion()?'smooth':'instant'});
  };
  useEffect(()=>{
    // On a phone the complete coordinate plane can be panned. Named controls
    // always bring their own physical hotspot into view; no place is cropped away.
    const focusX=atTable ? tableObjects[tableTarget].x : state.openHotspot ? places.find(place=>place.id===state.openHotspot)!.x : city ? phase==='walk' ? (city==='hk'?79:58) : phase==='home' ? (city==='hk'?53:90) : 28 : 28;
    const resize=()=>panTo(focusX,false);
    const frame=requestAnimationFrame(resize);
    window.addEventListener('resize',resize);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
  },[city,phase]);
  useEffect(()=>{
    if(!atTable || !panel){setTableFrameHeight(null);return;}
    const measure=()=>{
      if(window.matchMedia('(max-width: 900px), (max-aspect-ratio: 4/3)').matches && dialogue.current?.open){
        setTableFrameHeight(Math.max(100,dialogue.current.getBoundingClientRect().top-12));
      } else setTableFrameHeight(null);
    };
    const observer=new ResizeObserver(measure);
    if(dialogue.current) observer.observe(dialogue.current);
    const frame=requestAnimationFrame(measure);
    window.addEventListener('resize',measure);
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',measure);};
  },[atTable,panel,line]);
  useEffect(()=>{
    if(!atTable) return;
    const frame=requestAnimationFrame(()=>panTo(tableObjects[tableTarget].x,false));
    return ()=>cancelAnimationFrame(frame);
  },[atTable,tableTarget,tableFrameHeight,panel]);
  const openPanel = (next:Panel,place?:StoryHotspot,object?:keyof typeof tableObjects,route?:{returnFirst?:boolean;returnIntent?:RouteReturnIntent;changeRoute?:boolean}) => {
    if(!panel) returnFocus.current=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if(next==='phone'){
      phoneSourceLabel.current=document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent?.trim()??null;
      setPhoneContext({from:panel,line,object:tableTarget,returnFirst:route?.returnFirst??['walk','home'].includes(phase),returnIntent:route?.returnIntent??'planned',changeRoute:route?.changeRoute??false});
    }
    if(place) setAttended(place);
    if(atTable) setTableTarget(object ?? (next==='wallet'?'wallet':next==='phone'?'phone':next==='dinner'||(next==='observation'&&place==='table')?'menu':'jun'));
    setLine(0);setPanel(next);
  };
  const openRoute = (returnFirst=false,returnIntent:RouteReturnIntent='planned',changeRoute=false) => openPanel('phone',undefined,'phone',{returnFirst,returnIntent,changeRoute});
  const backFromPhone = () => {
    if(phoneContext.from){
      restorePhoneFocus.current=phoneSourceLabel.current;
      setTableTarget(phoneContext.object);setLine(phoneContext.line);setPanel(phoneContext.from);
    } else closePanel();
  };
  const closePanel = () => {
    if(panel==='legacyReplay' && pendingReplay){
      const previous=pendingReplay.fromPanel;
      setPendingReplay(null);setPanel(previous);setLine(0);
      if(!previous){dialogue.current?.close();requestAnimationFrame(()=>nextPlace.current?.focus({preventScroll:true}));}
      return;
    }
    dialogue.current?.close();setPanel(null);setLine(0);
    if(state.openHotspot) action({type:'CLOSE_INSPECTION'});
    requestAnimationFrame(()=>{
      const target=returnFocus.current;
      if(target?.isConnected && !target.closest('dialog')) target.focus({preventScroll:true});
      else (nextPlace.current ?? scene.current)?.focus({preventScroll:true});
    });
  };
  const inspect = (place:Place) => {if(!city) action({type:'PREVIEW_CITY',city:'hk'});panTo(place.x);action({type:'INSPECT',hotspot:place.id});openPanel('observation',place.id);};
  const chooseCity = (id:OptionId) => {action({type:'PREVIEW_CITY',city:id});setAttended('table');};
  const commit = (next:StoryAction,nextPanel:Panel) => {
    const clearsLegacyDetail = next.type==='REWIND' ? !!(attempt.journalNote || attempt.memento)
      : next.type==='TRY_OTHER_CITY' && !!(state.previousAttempt?.journalNote || state.previousAttempt?.memento);
    if(clearsLegacyDetail){setPendingReplay({action:next,nextPanel,fromPanel:panel});openPanel('legacyReplay');return;}
    action(next);setTableTarget('jun');setLine(0);setPanel(nextPanel);
  };
  const containDialogueFocus = (event:React.KeyboardEvent<HTMLDialogElement>) => {
    if(event.key!=='Tab') return;
    const candidates=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'))
      .filter(element=>element.tabIndex>=0 && element.getClientRects().length>0 && getComputedStyle(element).visibility!=='hidden');
    if(!candidates.length){event.preventDefault();dialogueTitle.current?.focus();return;}
    const index=candidates.indexOf(document.activeElement as HTMLElement);
    if(event.shiftKey && index<=0){event.preventDefault();candidates[candidates.length-1].focus();}
    else if(!event.shiftKey && (index<0 || index===candidates.length-1)){event.preventDefault();candidates[0].focus();}
  };
  const contextPanel:Panel = phase==='fork'?'destination':phase==='arrival'?'dinner':phase==='afterDinner'?'walkChoice':phase==='walk'?'return':'home';
  const nextLabel = phase==='fork'?'Talk about dinner':phase==='arrival'?'Talk with Jun':phase==='afterDinner'?'Step outside':phase==='walk'?'Head home':'Try the other evening';
  const spot=places.find(item=>item.id===attended)!;
  const dialogueOnLeft=atTable?(tableTarget==='phone'||tableTarget==='wallet'):panel==='observation'&&spot.x>50;
  const openTableMenu = () => {if(phase==='arrival') openPanel('dinner',undefined,'menu');else {action({type:'INSPECT',hotspot:'table'});openPanel('observation','table','menu');}};
  const dinnerResponse = attempt.dinnerChoice==='simple'?'We kept the order simple.':city==='hk'?'One dessert for the table.':'One more dish for the table.';
  const lookingBack = phase==='home';
  const tableObservation = attempt.dinnerChoice ? [
    `${lookingBack?'Earlier tonight, we':'We'} ${attempt.dinnerChoice==='linger'?city==='hk'?'stayed for one shared dessert.':'stayed for a shared order.':'kept dinner simple, without a shared order.'}`,
    `The dinner choice was ${attempt.dinnerChoice==='linger'?90:60} minutes${progress.delayApplied?', plus the fictional 30-minute delay.':'.'}${lookingBack?' That part of the evening is over.':''}`,
  ] : city==='hk' ? ['A small table under the awning. The kitchen is still busy.','The example menu allows HK$248 per person for dinner, plus drinks. One shared dessert is optional.'] : ['There’s a table on the terrace, just back from the avenue.','The example menu allows CNY128 per person for dinner, plus drinks. A shared order is optional.'];
  const walkObservation = attempt.walkChoice==='none' ? ['Earlier tonight, we headed straight home after dinner, without a walk.','There was no walking time in this outing.'] : attempt.walkChoice ? [
    `${lookingBack?'Earlier tonight, we':'We'} ${attempt.walkChoice==='long'?`took the 45-minute walk along the ${city==='hk'?'harbor':'avenue'}.`:'made the 15-minute loop near the table.'}`,
    lookingBack?'The walk is over and we’re back home now.':'We can head back when you’re ready.',
  ] : city==='hk' ? ['The harbor is just beyond the restaurant lights.','We could make a small loop or keep walking along the water. There’s no need to decide yet.'] : ['Trees and small terraces line the avenue.','We could take a small loop or leave a little longer for the walk. There’s no need to decide yet.'];
  const homeObservation = lookingBack ? [
    `We’re home now. ${option?`The return took ${minutes(option.inwardMinutes)} in the model.`:''}`,
    city==='sz'?'This was a fictional crossing. Entry eligibility, transport services and queues still need checking before a real trip.':'The modelled local journey is complete. Its travel time was an editable assumption.',
  ] : [`The way back is part of the evening too. ${option ? `${minutes(option.inwardMinutes)} is allowed for the return.` : ''}`,city==='sz'?'That includes an assumed clearance buffer. Real entry eligibility, services and queues still need checking.':'The local journey time is an editable assumption. The phone has our modelled return time.'];
  const observation = attended==='table'?tableObservation:attended==='wander'?walkObservation:homeObservation;
  const dialogueHeading = panel==='invitation'?'Dinner, then a walk?':panel==='observation'?attended==='table'?'By the table':attended==='wander'?city==='hk'?'By the harbor':'Along the avenue':'The way home':panel==='wallet'?'Wallet':panel==='phone'?'Out and home':panel==='destination'?'Shall we eat here?':panel==='arrived'?'At the table':panel==='dinner'?'The menu':panel==='afterDinner'?'After dinner':panel==='walkChoice'?'A little walk?':panel==='walked'?city==='hk'?'By the water':'On the avenue':panel==='return'?'Time to head back?':panel==='home'?'Back home':panel==='reset'?'Begin a fresh evening?':panel==='legacyReplay'?'Clear an older saved detail?':'Story options';
  const isJun=panel!==null&&!['wallet','phone','options','reset','legacyReplay'].includes(panel);
  const continueLine = () => setLine(value=>value+1);

  return <section className={`playable-evening play-phase-${phase} ${atTable?'at-table':''} ${panel?'dialogue-active':''} ${atTable&&panel?'table-dialogue-open':''}`} style={tableFrameHeight===null?undefined:{'--table-frame-height':`${tableFrameHeight}px`} as React.CSSProperties} data-attended-object={atTable&&panel?tableTarget:undefined} data-table-framed={atTable&&panel&&tableFrameHeight!==null?'true':undefined} aria-label="Play an illustrative evening">
    <h1 className="story-screenreader-title">{phase==='home'?'Back home from an illustrative evening':'An evening between Hong Kong and Shenzhen'}</h1>
    <div className="world-scroller" ref={scene} tabIndex={panel?-1:0} role="region" aria-label="Evening scene. On a narrow screen, swipe or use the named place controls to look around." onKeyDown={event=>{if(event.target===event.currentTarget&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();scene.current?.scrollBy({left:event.key==='ArrowRight'?180:-180,behavior:reducedMotion()?'instant':'smooth'});}}}>
      <SceneVisual key={sceneKey} city={visualCity} phase={phase}>
        {atTable ? <>
          {(['menu','phone','wallet'] as const).map(object=>{const point=tableObjects[object];const Icon=object==='menu'?Utensils:object==='phone'?Smartphone:Wallet;const label=object==='menu'?phase==='arrival'?'Read the menu':'Look at the table':object==='phone'?'Open phone':'Open wallet';return <button key={object} className="scene-place table-object" data-scene-object={object} data-anchor-x={point.x} data-anchor-y={point.y} style={{left:`${point.x}%`,top:`${point.y}%`}} tabIndex={panel?-1:0} aria-label={`${label} in the illustration`} onClick={()=>object==='menu'?openTableMenu():openPanel(object,undefined,object)}><Icon size={19}/><span>{object}</span></button>;})}
          <button className="scene-companion table-jun" data-scene-object="jun" data-anchor-x={tableObjects.jun.x} data-anchor-y={tableObjects.jun.y} style={{left:`${tableObjects.jun.x}%`,top:`${tableObjects.jun.y}%`}} tabIndex={panel?-1:0} aria-label="Talk with Jun in the illustration" onClick={()=>openPanel(contextPanel,undefined,'jun')}>Jun <span>Talk</span></button>
        </> : <>
          {places.map(place=><button key={place.id} className="scene-place play-hotspot" data-anchor-x={place.x} data-anchor-y={place.y} style={{left:`${place.x}%`,top:`${place.y}%`}} tabIndex={panel?-1:0} aria-label={`Look at ${place.label} in the illustration`} onClick={()=>inspect(place)}><place.icon size={19}/><span>{place.label}</span></button>)}
          <button className="scene-companion" tabIndex={panel?-1:0} aria-label="Talk with Jun" onClick={()=>openPanel(city?contextPanel:'invitation')}>Jun <span>Talk</span></button>
        </>}
      </SceneVisual>
    </div>
    <div className="scene-atmosphere" aria-hidden="true"/>
    <div className="scene-time"><span>{phase==='home'?'Back home':phase==='fork'?city?`${cityName(city)} · a look ahead`:'Hong Kong · before heading out':cityName(visualCity)}</span><span><Clock3 size={13}/><time className="story-clock" aria-label="Story clock">{formatClock(progress.clockMinutes)}</time><small>story · UTC+8</small></span></div>
    <span className="scene-fiction">Illustrated fiction · not a map</span>
    {warning && <button className="scene-save-notice" onClick={()=>openPanel('options')}>Read save notice</button>}
    <div className="world-interface" hidden={!!panel}>
      <div className="world-controls">
        <nav className="scene-places" aria-label={atTable?'Objects on the table':city?'Places in this scene':'Look at either city'}>
          {atTable ? <><button onClick={openTableMenu} aria-label={phase==='arrival'?'Read the menu':'Look at the table'}><Utensils size={16}/><span>Menu</span></button><button onClick={()=>openPanel('phone')} aria-label="Open phone"><Smartphone size={16}/><span>Phone</span></button><button onClick={()=>openPanel('wallet')} aria-label="Open wallet"><Wallet size={16}/><span>Wallet</span></button></> : city ? places.map(place=><button key={place.id} onClick={()=>inspect(place)} aria-label={`Look at ${place.label}`}><place.icon size={17}/><span>{place.id==='table'?'Table':place.id==='wander'?city==='hk'?'Harbor':'Avenue':'Way home'}</span></button>) : (['hk','sz'] as const).map(id=><button key={id} onClick={()=>chooseCity(id)} aria-label={`Look at ${cityName(id)}`}><MapPin size={17}/><span>{cityName(id)}</span></button>)}
        </nav>
        <div className="scene-actions">
          {city && <button className="scene-next" ref={nextPlace} onClick={()=>phase==='home'?commit({type:'TRY_OTHER_CITY'},'destination'):openPanel(contextPanel,undefined,atTable?'jun':undefined)}>{nextLabel}<ArrowRight size={17}/></button>}
          <div className="pocket-tools" role="group" aria-label="Things with you">{!atTable&&<><button onClick={()=>openPanel('wallet')} aria-label="Open wallet"><Wallet size={21}/><span>Wallet</span></button><button onClick={()=>openPanel('phone')} aria-label="Open phone"><Smartphone size={21}/><span>Phone</span></button></>}<button onClick={()=>openPanel('options')} aria-label="Story options"><MoreHorizontal size={23}/><span>More</span></button></div>
        </div>
      </div>
      {city && phase==='fork' && <button className="other-shore" onClick={()=>chooseCity(city==='hk'?'sz':'hk')} aria-label={`Look at ${cityName(city==='hk'?'sz':'hk')}`}><ArrowLeft size={14}/> Look at {cityName(city==='hk'?'sz':'hk')}</button>}
      <span className="scene-pan-hint">Swipe to look around · or choose a place below</span>
    </div>

    <dialog className={`world-dialogue ${dialogueOnLeft?'dialogue-left':'dialogue-right'} ${!atTable&&panel==='observation'&&spot.y>=70?'dialogue-top':''} ${isJun&&!atTable?'with-jun':'object-dialogue'} ${atTable?'table-dialogue':''}`} ref={dialogue} aria-labelledby="world-dialogue-title" onKeyDown={containDialogueFocus} onCancel={event=>{event.preventDefault();closePanel();}} onClick={event=>{if(event.target===event.currentTarget) closePanel();}}>
      {panel && <div className="dialogue-surface">
        <button className="dialogue-close" aria-label="Return to the scene" onClick={closePanel}><X size={20}/></button>
        {isJun && !atTable && <div className="dialogue-portrait"><JunPortrait/><span>JUN {panel==='invitation'&&<small>Fictional companion</small>}</span></div>}
        <div className="dialogue-body"><h2 id="world-dialogue-title" ref={dialogueTitle} tabIndex={-1}>{dialogueHeading}</h2>
          {panel==='invitation' && <><p className="spoken-line">I’m free for dinner. Shall we stay nearby, or head to Shenzhen?</p><div className="spoken-replies"><button onClick={()=>{chooseCity('hk');openPanel('destination');}}>Let’s stay nearby. <ArrowRight size={16}/></button><button onClick={()=>{chooseCity('sz');openPanel('destination');}}>Let’s cross for dinner. <ArrowRight size={16}/></button></div><button className="dialogue-next" onClick={closePanel}>Look around first <ChevronDown size={17}/></button></>}
          {panel==='observation' && <><p className="spoken-line">{observation[Math.min(line,observation.length-1)]}</p><p className="dialogue-footnote">Looking around doesn’t advance the story clock.</p>{line<observation.length-1?<Continue onClick={continueLine}/>:<button className="dialogue-next" onClick={closePanel}>Back to looking around <ChevronDown size={17}/></button>}{attended==='home'&&<button className="object-model-link" onClick={()=>openRoute(true)}>Unfold the return route <ArrowRight size={15}/></button>}</>}
          {panel==='wallet' && <><p className="object-intro">An allowance for this fictional outing, not cash or a live account balance.</p><dl className="pocket-facts"><div><dt>Spending allowance / person</dt><dd>{money(state.baseInputs.budgetPerPersonHKD)}</dd></div>{(option?[option]:comparison.options).map(item=><div key={item.id}><dt>{cityName(item.id)} · projected outing / person</dt><dd>{money(item.perPersonHKD)}</dd></div>)}</dl><p className="dialogue-footnote">Estimates include dinner, drinks and the return journey. Optional shared orders are split between two adults. CNY costs use the model’s exchange assumption, not a live rate.</p>{walletWarningOption && <>{routeView?.isConditional&&(!walletWarningOption.homeFeasible||!walletWarningOption.crossingFeasible)&&<p className="dialogue-footnote wallet-forecast">{routeView.forecastText}</p>}<ConstraintWarnings option={walletWarningOption}/></>}<button className="object-model-link" onClick={()=>{closePanel();onPlanner(selectStoryInputs(state));}}>Compare this evening <ArrowRight size={15}/></button><button className="dialogue-next" onClick={closePanel}>Put the wallet away <ChevronDown size={17}/></button></>}
          {panel==='phone' && <RouteNote state={state} onSelectRoute={route=>action({type:'SET_ROUTE',route})} onBack={backFromPhone} onReconsiderDeparture={()=>commit({type:'REWIND',checkpoint:'fork'},'destination')} returnFirst={phoneContext.returnFirst} returnIntent={phoneContext.returnIntent} backLabel={phoneContext.from?'Back to Jun':'Put the phone away'} showRouteChoicesInitially={phoneContext.changeRoute}/>}
          {panel==='destination' && city && <><p className="spoken-line">{city==='hk'?'We can stay nearby and eat by the harbor.':'We could take the train or go by road. Either way, we’ll need time to get back.'}</p>{routeView&&<><div className="departure-selected-route"><span>{routeView.routeLabel}</span>{city==='sz'&&<button onClick={()=>openRoute(false,'planned',true)}>Change route <ChevronDown size={14}/></button>}</div><p className="departure-facts complete-evening-estimate"><strong>Complete evening estimate</strong>{routeView.consequence}</p><p className="dialogue-footnote departure-forecast">{routeView.forecastText}</p><button className="object-model-link" onClick={()=>openRoute()}>Unfold the route <ArrowRight size={15}/></button><ConstraintWarnings option={routeView.conditionalOption} entry/></>}<button className="dialogue-commit" onClick={()=>commit({type:'COMMIT_DEPARTURE',city,route:attempt.route},'arrived')}>{city==='hk'?'Head to the table':attempt.route==='rail'?'Head to the station':'Take the road route'} <ArrowRight size={17}/></button></>}
          {panel==='arrived' && <><p className="spoken-line">Here we are. What are you in the mood for?</p><button className="dialogue-next" onClick={()=>openPanel('dinner')}>Read the menu <ArrowRight size={17}/></button></>}
          {panel==='dinner' && <><p className="spoken-line">Keep it simple, or stay for another dish?</p><div className="menu-choices">{([{id:'simple',title:'Let’s keep dinner simple.',body:'60 minutes · no shared order.'},{id:'linger',title:'Let’s have one more dish.',body:`90 minutes · one shared ${city==='hk'?'dessert':'order'}.`}] as const).map(choice=><Choice key={choice.id} state={state} action={{type:'COMMIT_DINNER',choice:choice.id}} title={choice.title} body={choice.body} dispatch={next=>commit(next,'afterDinner')}/>)}</div></>}
          {panel==='afterDinner' && <><p className="spoken-line">{dinnerResponse} {progress.delayApplied?'Dinner ran half an hour longer than expected.':'Shall we step outside?'}</p><p className="fictional-event play-event-note">{progress.delayApplied?'The disclosed dinner delay has added 30 minutes once. It adds no extra charge.':'This is the calm version. No fictional delay is applied.'}</p><button className="dialogue-next" onClick={()=>openPanel('walkChoice')}>Step outside <ArrowRight size={17}/></button><DirectReturn state={state} dispatch={next=>commit(next,'home')} onRoute={()=>openRoute(true,'direct')}/></>}
          {panel==='walkChoice' && <><p className="spoken-line">A small loop nearby, or the longer way round?</p><div className="menu-choices">{([{id:'long',title:'Let’s take the longer walk.',body:city==='hk'?'45 minutes along the harbor.':'45 minutes along the avenue.'},{id:'short',title:'A short loop sounds good.',body:'15 minutes nearby · home 30 minutes earlier.'}] as const).map(choice=><Choice key={choice.id} state={state} action={{type:'COMMIT_WALK',choice:choice.id}} title={choice.title} body={choice.body} dispatch={next=>commit(next,'walked')}/>)}</div><DirectReturn state={state} dispatch={next=>commit(next,'home')} onRoute={()=>openRoute(true,'direct')}/></>}
          {panel==='walked' && <><p className="spoken-line">{attempt.walkChoice==='long'?city==='hk'?'We took the longer way round by the water.':'We took the longer way round along the avenue.':'Just a small loop near the table.'}</p><p className="spoken-line secondary-line">{city==='hk'?'The restaurant lights reach down to the water.':'The avenue looks different with the lights on.'} We can head back when you’re ready.</p><button className="dialogue-next" onClick={closePanel}>Look around <ChevronDown size={17}/></button></>}
          {panel==='return' && <><p className="spoken-line">Ready to call it an evening?</p>{option&&<><p className="departure-facts">{minutes(option.inwardMinutes)} back · modelled home arrival {formatClock(option.returnMinutes)}<br/>Whole outing estimate {money(option.perPersonHKD)}/person</p><ConstraintWarnings option={option} entry/></>}<button className="object-model-link" onClick={()=>openRoute(true)}>Check the return route <ArrowRight size={15}/></button><button className="dialogue-commit" onClick={()=>commit({type:'RETURN_HOME'},'home')}>Follow the return journey <ArrowRight size={17}/></button></>}
          {panel==='home' && <><p className="spoken-line">Made it back. Good night.</p><p className="departure-facts">Home at {formatClock(progress.clockMinutes)} in this model.</p>{option&&<ConstraintWarnings option={option} entry/>}<button className="dialogue-next" onClick={closePanel}>Finish the evening <ChevronDown size={17}/></button></>}
          {panel==='options' && <><p className="object-intro">A fictional evening for two adults. Dialogue, costs and travel durations are authored examples. No booking, live queue, eligibility check or AI conversation is taking place.</p>{warning&&<p className="save-warning" role="status">{warning}</p>}<details className="story-setup"><summary>Evening setup <ChevronDown size={15}/></summary><p>{preset.label} · {formatClock(state.baseInputs.departureMinutes)}–{formatClock(homeDeadline)} · allowance {money(state.baseInputs.budgetPerPersonHKD)}/person</p><p>{state.delayScenario==='dinner30'?'Includes one fictional 30-minute dinner delay.':'Calm version · no fictional delay.'}</p>{phase==='fork'&&!state.previousAttempt&&<><div className="setup-presets" role="group" aria-label="Choose the shape of the evening">{STORY_PRESETS.map(item=><button key={item.id} aria-pressed={item.id===state.presetId} onClick={()=>action({type:'RECONFIGURE',presetId:item.id,delayScenario:state.delayScenario})}><strong>{item.label}</strong><small>{formatClock(item.departureMinutes)}–{formatClock(item.homeByMinutes)} · HK${item.budgetPerPersonHKD}/person</small></button>)}</div><label className="delay-setting"><input type="checkbox" checked={state.delayScenario==='dinner30'} onChange={event=>action({type:'RECONFIGURE',delayScenario:event.target.checked?'dinner30':'none'})}/>Include one fictional 30-minute dinner delay</label></>}</details><div className="story-option-actions"><button onClick={()=>{closePanel();onBrowsePlanner();}}>Open my plan <ArrowRight size={16}/></button><button onClick={()=>{closePanel();onResearch();}}>Open research desk <ArrowRight size={16}/></button>{phase!=='fork'&&<button onClick={()=>commit({type:'REWIND',checkpoint:'fork'},'destination')}><RotateCcw size={15}/> Rewind to the fork</button>}{['afterDinner','walk','home'].includes(phase)&&<button onClick={()=>commit({type:'REWIND',checkpoint:'arrival'},'dinner')}>Reconsider dinner</button>}{['walk','home'].includes(phase)&&<button onClick={()=>commit({type:'REWIND',checkpoint:'afterDinner'},'walkChoice')}>Reconsider the walk</button>}<button onClick={()=>openPanel('reset')}>Start a fresh evening</button></div><p className="dialogue-footnote">Progress resumes in this browser when storage is available. Your practical planner has a separate save.</p></>}
          {panel==='legacyReplay' && pendingReplay && <><p className="object-intro">{pendingReplay.action.type==='TRY_OTHER_CITY'?'Continuing will replace an older saved note or detail from the previous evening.':'Rewinding will clear an older saved note or detail from this evening.'}</p><div className="story-option-actions"><button onClick={closePanel}>Keep this evening</button><button className="dialogue-commit" onClick={()=>{const next=pendingReplay;setPendingReplay(null);action(next.action);setLine(0);setPanel(next.nextPanel);}}>Clear older detail and continue</button></div></>}
          {panel==='reset' && <><p className="object-intro">This replaces both saved story attempts, including any notes from older versions. Your separate practical planner stays as it is.</p><div className="story-option-actions"><button className="dialogue-commit" onClick={()=>commit({type:'RESET',presetId:'wander'},'invitation')}>Start a fresh story</button><button onClick={()=>openPanel('options')}>Keep this evening</button></div></>}
        </div>
      </div>}
    </dialog>
  </section>;
}
function Continue({onClick}:{onClick:()=>void}) {return <button className="dialogue-next" onClick={onClick}>Continue dialogue <ChevronDown size={17}/></button>;}
function ConstraintWarnings({option,entry=false}:{option:OutingOption;entry?:boolean}) {
  const warnings=[!option.homeFeasible?`${Math.abs(option.spareMinutes)} minutes beyond the home deadline. A shorter choice or a rewind can change that.`:'',option.budgetFeasible===false?'The projected whole outing exceeds the per-person allowance. Reconsider the meal or city.':'',!option.crossingFeasible?'The planned crossing is outside the modelled clearance window. Recheck the route and timing.':'',entry&&option.id==='sz'?'Fictional crossing: real entry eligibility, transport services and queues remain unverified.':''].filter(Boolean);
  return warnings.length?<div className="commit-caveats" role="note">{warnings.map(text=><p key={text}>{text}</p>)}</div>:null;
}
function Choice({state,action,title,body,dispatch}:{state:StoryState;action:StoryAction;title:string;body:string;dispatch:(next:StoryAction)=>void}) {
  const preview=previewStoryAction(state,action),option=preview.option;
  return <button className="play-choice" disabled={!preview.allowed} onClick={()=>dispatch(action)}><span className="choice-heading">{title}<ArrowRight size={17}/></span><span className="choice-description">{body}</span><span className="choice-consequence">Home {option?formatClock(option.returnMinutes):'unknown'} · {option?approximateMoney(option.perPersonHKD):'Unknown total'}</span>{option&&(!option.homeFeasible||!option.crossingFeasible||option.budgetFeasible===false||(action.type==='RETURN_AFTER_DINNER'&&option.id==='sz'))&&<span className="choice-warning">{[!option.homeFeasible?`${Math.abs(option.spareMinutes)} min beyond the home deadline.`:'',!option.crossingFeasible?'Outside the modelled crossing window.':'',option.budgetFeasible===false?'Over the per-person allowance.':'',action.type==='RETURN_AFTER_DINNER'&&option.id==='sz'?'Real entry eligibility, transport services and queues remain unverified.':''].filter(Boolean).join(' ')} A tentative story outcome.</span>}</button>;
}

function DirectReturn({state,dispatch,onRoute}:{state:StoryState;dispatch:(next:StoryAction)=>void;onRoute:()=>void}) {
  return <div className="direct-return"><Choice state={state} action={{type:'RETURN_AFTER_DINNER'}} title="Let’s head home now." body="No walk · return after dinner." dispatch={dispatch}/><button className="object-model-link" onClick={onRoute}>Check direct return route <ArrowRight size={15}/></button></div>;
}
