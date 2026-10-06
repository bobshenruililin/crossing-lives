import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Clock3, Compass, Home, MapPin, MoreHorizontal, RotateCcw, Smartphone, TrainFront, Utensils, Wallet, X } from 'lucide-react';
import { formatClock } from '../domain/engine';
import type { OptionId, OutingInputs, OutingOption } from '../domain/model';
import { homeScene, tableObjects, tableScenes } from '../data/scene-art';
import { RouteNote } from './RouteNote';
import { selectRouteView } from '../story/route-view';
import { selectJunDialogue } from '../story/dialogue';
import type { RouteReturnIntent } from '../story/route-view';
import { createStoryState, decodeStoryState, previewStoryAction, selectStoryComparison, selectStoryInputs, selectStoryOption, selectStoryProgress, STORY_PRESETS, storyReducer } from '../story/engine';
import type { StoryAction, StoryHotspot, StoryState } from '../story/model';
import './playable-evening.css';
import { temporaryDemo, buildTemporaryDemoUrl, TEMPORARY_DEMO_LABEL, TEMPORARY_DEMO_GUIDANCE } from '../runtime-mode';

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
  if(temporaryDemo) {inTabStory=createStoryState('wander');return {state:inTabStory,warning:''};}
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
  if(temporaryDemo) return;
  try {localStorage.removeItem(PLAYABLE_STORAGE_KEY);}
  catch {protectSavedBytes=true;inTabWarning='The story was reset in this tab, but this browser could not clear its saved copy. That older copy may return after a reload.';}
}


type Panel = 'invitation'|'observation'|'wallet'|'plannerImport'|'phone'|'phoneNote'|'destination'|'arrived'|'dinner'|'afterDinner'|'walkChoice'|'walked'|'return'|'home'|'options'|'reset'|'legacyReplay';
type Place = {id:StoryHotspot;label:string;icon:typeof Utensils;x:number;y:number};
const approximateMoney = (value:number|null) => value===null?'Unknown total':`about HK$${Math.round(value).toLocaleString('en-HK')}/person`;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type SceneStatus = 'loading'|'ready'|'failed';
type SceneImage = {source:string;alt:string};
type SceneFrame = {request:string;generation:number;visible:SceneImage|null;pending:SceneImage|null;failed:boolean};

function SceneImageLayer({image,visible,onReady,onError}: {image:SceneImage;visible:boolean;onReady:(source:string)=>void;onError:(source:string)=>void}) {
  const element = useRef<HTMLImageElement>(null);
  useEffect(()=>{
    const node=element.current;
    if(!node || visible) return;
    let cancelled=false;
    let decoding=false;
    const fail=()=>{if(!cancelled) onError(image.source);};
    const loaded=async()=>{
      if(decoding || !node.complete || node.naturalWidth===0) return;
      decoding=true;
      try {
        await node.decode();
        if(!cancelled) onReady(image.source);
      } catch {fail();}
    };
    node.addEventListener('load',loaded);
    node.addEventListener('error',fail);
    // Cached and portable images may have completed before this effect attached.
    if(node.complete){if(node.naturalWidth>0) void loaded();else fail();}
    return ()=>{cancelled=true;node.removeEventListener('load',loaded);node.removeEventListener('error',fail);};
  },[image.source,visible,onReady,onError]);
  return <img ref={element} className={visible?'play-world-image':'play-scene-pending-image'} data-art={image.source} data-scene-layer={visible?'visible':'pending'} src={art(image.source)} alt={visible?image.alt:''} aria-hidden={visible?undefined:true}/>;
}

function SceneVisual({city,phase,children,onStatusChange}: {city:OptionId|null;phase:string;children:React.ReactNode;onStatusChange:(status:SceneStatus)=>void}) {
  const table = city && ['arrival','afterDinner'].includes(phase) ? tableScenes[city] : null;
  const sceneMeta=phase==='home'?homeScene:table;
  const original = sceneMeta?.image ?? (city === 'hk' ? 'hong-kong-evening.webp' : city === 'sz' ? 'shenzhen-evening.webp' : 'two-shores.webp');
  const preferred = city && phase==='walk' ? city==='hk'?'hk-evening-night.webp':'sz-evening-night.webp' : original;
  const alt=sceneMeta?.alt ?? (city === 'hk' ? 'An imagined Hong Kong restaurant beside the harbor, with a table under warm lights.' : city === 'sz' ? 'An imagined Shenzhen dining terrace beside a leafy avenue and transit entrance.' : 'An imagined two-city harbor at dusk, with two inviting shores.');
  const [frame,setFrame]=useState<SceneFrame>(()=>({request:preferred,generation:0,visible:null,pending:{source:preferred,alt},failed:false}));
  // Reset only this local request before its children commit. Keep the actual
  // decoded node, including when a rapid preview returns to the visible scene.
  if(frame.request!==preferred) setFrame({request:preferred,generation:frame.generation+1,visible:frame.visible,pending:frame.visible?.source===preferred?null:{source:preferred,alt},failed:false});
  const generation=frame.generation;
  const ready=useCallback((source:string)=>setFrame(current=>{
    if(current.generation!==generation || current.request!==preferred || current.pending?.source!==source) return current;
    return {...current,visible:current.pending,pending:null,failed:false};
  }),[generation,preferred]);
  const failed=useCallback((source:string)=>setFrame(current=>{
    if(current.generation!==generation || current.request!==preferred || current.pending?.source!==source) return current;
    if(source!==original) return {...current,pending:current.visible?.source===original?null:{source:original,alt},failed:false};
    return {...current,visible:null,pending:null,failed:true};
  }),[generation,preferred,original,alt]);
  const status:SceneStatus=frame.failed?'failed':frame.pending?'loading':'ready';
  useEffect(()=>onStatusChange(status),[status,onStatusChange]);
  const layers=[frame.visible,frame.pending].filter((image):image is SceneImage=>image!==null);
  return <div className={`play-world world-${phase==='home'?'home':city ?? 'both'} world-phase-${phase}`} style={{'--scene-ratio':sceneMeta?sceneMeta.width/sceneMeta.height:1672/941} as React.CSSProperties} data-scene-state={status} data-scene-requested={preferred} data-scene-visible={frame.visible?.source} aria-busy={status==='loading'}>
    {/* Keys follow source identity, not visible/pending role: neither the old
        painted image nor the newly decoded image is remounted during the swap. */}
    {layers.map(image=><SceneImageLayer key={image.source} image={image} visible={image===frame.visible} onReady={ready} onError={failed}/>)}
    {frame.failed && <div className="play-image-fallback" role="img" aria-label="Illustrated scene unavailable"><span>{phase==='home'?'Back home':city ? cityName(city) : 'Hong Kong · Shenzhen'}</span><p>You can still look around and make every choice using the named place controls.</p></div>}
    {children}
  </div>;
}
function JunPortrait() {
  const [failed,setFailed] = useState(false);
  return <div className="jun-avatar"><span aria-hidden="true">J</span>{!failed && <img data-art="jun-portrait.webp" src={art('jun-portrait.webp')} alt="Jun, a fictional adult companion." onError={()=>setFailed(true)}/>}</div>;
}

interface PlayableEveningProps {
  onExit:()=>void;
  onBrowsePlanner:()=>void;
  onPlanner:(inputs:OutingInputs)=>void;
  onResearch:()=>void;
  onBusinessLens:(option:OutingOption|null,partySize:number)=>void;
  resumePanel?:'wallet';
  onResumeHandled?:()=>void;
}

export default function PlayableEvening({onBrowsePlanner,onPlanner,onResearch,onBusinessLens,resumePanel,onResumeHandled}:PlayableEveningProps) {
  const initial = useMemo(readPlayable,[]);
  const [state,dispatch] = useReducer(storyReducer,initial.state);
  const [warning,setWarning] = useState(initial.warning);
  const [panel,setPanel] = useState<Panel|null>(()=>resumePanel==='wallet'?'wallet':initial.state.currentAttempt.phase==='fork'&&!initial.state.previewCity?'invitation':null);
  const [line,setLine] = useState(0);
  const [pendingReplay,setPendingReplay] = useState<{action:StoryAction;nextPanel:Panel;fromPanel:Panel|null}|null>(null);
  const [attended,setAttended] = useState<StoryHotspot>('table');
  const [tableTarget,setTableTarget] = useState<keyof typeof tableObjects>(resumePanel==='wallet'?'wallet':'jun');
  const [tableFrameHeight,setTableFrameHeight] = useState<number|null>(null);
  const [sceneStatus,setSceneStatus] = useState<SceneStatus>('loading');
  const [phoneContext,setPhoneContext] = useState<{from:Panel|null;line:number;object:keyof typeof tableObjects;returnFirst:boolean;returnIntent:RouteReturnIntent;changeRoute:boolean}>({from:null,line:0,object:'jun',returnFirst:false,returnIntent:'planned',changeRoute:false});
  const phoneSourceLabel = useRef<string|null>(null);
  const restorePhoneFocus = useRef<string|null>(null);
  const dialogue = useRef<HTMLDialogElement>(null);
  const dialogueTitle = useRef<HTMLHeadingElement>(null);
  const previousDialoguePanel = useRef<Panel|null>(null);
  const returnFocus = useRef<HTMLElement|null>(null);
  const walletControl = useRef<HTMLButtonElement>(null);
  const plannerImportControl = useRef<HTMLButtonElement>(null);
  const restorePlannerImportFocus = useRef(false);
  const resumeAtMount = useRef(resumePanel);
  const resumeConsumed = useRef(false);
  const nextPlace = useRef<HTMLButtonElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const attempt = state.currentAttempt;
  const junDialogue = selectJunDialogue(state);
  const phase = attempt.phase;
  const city = attempt.city ?? state.previewCity;
  const visualCity = city ?? 'hk';
  const atTable = phase==='arrival'||phase==='afterDinner';
  const atHome = phase==='home';
  const option = selectStoryOption(state);
  const routeView = selectRouteView(state);
  const walletWarningOption = routeView?.conditionalOption ?? option;
  const progress = selectStoryProgress(state);
  const comparison = selectStoryComparison(state);
  const homeDeadline = option?.homeByMinutes ?? comparison.normalizedHomeByMinutes ?? state.baseInputs.homeByMinutes;
  const preset = STORY_PRESETS.find(item=>item.id===state.presetId)!;
  useEffect(()=>{
    inTabStory=state;
    if(temporaryDemo) return;
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
      if(panel==='wallet' && restorePlannerImportFocus.current){
        restorePlannerImportFocus.current=false;
        plannerImportControl.current?.focus();
      }
    } else if(dialogue.current?.open) dialogue.current.close();
    previousDialoguePanel.current=panel;
  },[panel,line]);
  useEffect(()=>{
    if(resumeAtMount.current==='wallet'&&!resumeConsumed.current&&panel==='wallet'&&dialogue.current?.open){
      returnFocus.current=walletControl.current;
      resumeConsumed.current=true;
      onResumeHandled?.();
    }
  },[panel,onResumeHandled]);
  const action = (next:StoryAction) => {
    if(next.type==='RESET'){protectSavedBytes=false;inTabWarning='';setWarning('');}
    dispatch(next);
  };
  const places:Place[] = visualCity==='hk' ? [
    {id:'table',label:'the table',icon:Utensils,x:28,y:57},{id:'wander',label:'the harbor',icon:Compass,x:79,y:47},{id:'home',label:'the way home',icon:Home,x:53,y:80},
  ] : [{id:'table',label:'the table',icon:Utensils,x:28,y:59},{id:'wander',label:'the avenue',icon:Compass,x:58,y:63},{id:'home',label:'the way home',icon:TrainFront,x:90,y:50}];
  const cameraMode=phase==='walk'?(attempt.walkChoice==='short'?'nearby':'wider'):atHome?'home':null;
  const cameraPlace=cameraMode==='nearby'?places[0]:cameraMode==='wider'?places[1]:cameraMode==='home'?homeScene.focal:null;
  const panTo = (x:number,animate=true,alignment=.5) => {
    const viewport=scene.current;
    if(!viewport) return;
    viewport.scrollTo({left:viewport.scrollWidth*x/100-viewport.clientWidth*alignment,behavior:animate&&!reducedMotion()?'smooth':'instant'});
  };
  useEffect(()=>{
    // On a phone the complete coordinate plane can be panned. Named controls
    // always bring their own physical hotspot into view; no place is cropped away.
    const focusX=atHome?homeScene.focal.x:atTable ? tableObjects[tableTarget].x : state.openHotspot ? places.find(place=>place.id===state.openHotspot)!.x : cameraPlace ? cameraPlace.x : 28;
    const resize=()=>panTo(focusX,false,cameraMode&&!atHome&&scene.current&&scene.current.clientWidth>900?(focusX>50?.78:.32):.5);
    const frame=requestAnimationFrame(resize);
    window.addEventListener('resize',resize);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
  },[city,phase,attempt.walkChoice]);
  useEffect(()=>{
    if((!atTable&&!atHome) || !panel){setTableFrameHeight(null);return;}
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
  },[atTable,atHome,panel,line]);
  useEffect(()=>{
    if(!atTable&&!atHome) return;
    const focusX=atHome?(panel==='phone'||panel==='phoneNote'?homeScene.phone.x:homeScene.focal.x):tableObjects[tableTarget].x;
    const frame=requestAnimationFrame(()=>panTo(focusX,false));
    return ()=>cancelAnimationFrame(frame);
  },[atTable,atHome,tableTarget,tableFrameHeight,panel]);
  const openPanel = (next:Panel,place?:StoryHotspot,object?:keyof typeof tableObjects,route?:{returnFirst?:boolean;returnIntent?:RouteReturnIntent;changeRoute?:boolean}) => {
    const requestedPanel=next==='phone'&&atHome&&!route?'phoneNote':next;
    if(!panel) returnFocus.current=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if(next==='phone'){
      phoneSourceLabel.current=document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent?.trim()??null;
      setPhoneContext({from:panel,line,object:tableTarget,returnFirst:route?.returnFirst??['walk','home'].includes(phase),returnIntent:route?.returnIntent??'planned',changeRoute:route?.changeRoute??false});
    }
    if(place) setAttended(place);
    if(atTable) setTableTarget(object ?? (next==='wallet'?'wallet':next==='phone'?'phone':next==='dinner'||(next==='observation'&&place==='table')?'menu':'jun'));
    setLine(0);setPanel(requestedPanel);
  };
  const openRoute = (returnFirst=false,returnIntent:RouteReturnIntent='planned',changeRoute=false) => openPanel('phone',undefined,'phone',{returnFirst,returnIntent,changeRoute});
  const backFromPhone = () => {
    if(phoneContext.from){
      restorePhoneFocus.current=phoneSourceLabel.current;
      setTableTarget(phoneContext.object);setLine(phoneContext.line);setPanel(phoneContext.from);
    } else closePanel();
  };
  const closePanel = () => {
    if(panel==='plannerImport'){
      restorePlannerImportFocus.current=true;
      setPanel('wallet');setLine(0);
      return;
    }
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
  const confirmPlannerImport = () => {
    dialogue.current?.close();setPanel(null);setLine(0);
    onPlanner(selectStoryInputs(state));
  };
  const inspect = (place:Place) => {if(!city) action({type:'PREVIEW_CITY',city:'hk'});panTo(place.x,true,cameraMode&&scene.current&&scene.current.clientWidth>900?(place.x>50?.78:.32):.5);action({type:'INSPECT',hotspot:place.id});openPanel('observation',place.id);};
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
  const dialogueOnLeft=atHome?true:atTable?(tableTarget==='phone'||tableTarget==='wallet'):panel==='walked'||panel==='return'?attempt.walkChoice==='long':panel==='observation'&&spot.x>50;
  const dialogueAtTop=!atTable&&!atHome&&((panel==='observation'&&spot.y>=70)||(panel==='walked'&&(attempt.walkChoice==='short'||(city==='sz'&&attempt.walkChoice==='long'))));
  const openTableMenu = () => {if(phase==='arrival') openPanel('dinner',undefined,'menu');else {action({type:'INSPECT',hotspot:'table'});openPanel('observation','table','menu');}};

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
  const dialogueHeading = panel==='invitation'?'Dinner, then a walk?':panel==='observation'?attended==='table'?'By the table':attended==='wander'?city==='hk'?'By the harbor':'Along the avenue':'The way home':panel==='wallet'?'Wallet':panel==='plannerImport'?'Use this evening in planner?':panel==='phone'?'Out and home':panel==='phoneNote'?'From Jun':panel==='destination'?'Shall we eat here?':panel==='arrived'?'At the table':panel==='dinner'?'The menu':panel==='afterDinner'?'After dinner':panel==='walkChoice'?'A little walk?':panel==='walked'?attempt.walkChoice==='short'?'Just outside':city==='hk'?'By the water':'On the avenue':panel==='return'?'Time to head back?':panel==='home'?'Back home':panel==='reset'?'Begin a fresh evening?':panel==='legacyReplay'?'Clear an older saved detail?':'Story options';
  const isJun=!atHome&&panel!==null&&!['wallet','plannerImport','phone','options','reset','legacyReplay'].includes(panel);
  const continueLine = () => setLine(value=>value+1);

  return <section className={`playable-evening play-phase-${phase} ${atTable?'at-table':''} ${atHome?'at-home':''} ${panel?'dialogue-active':''} ${atTable&&panel?'table-dialogue-open':''} ${atHome&&panel?'home-dialogue-open':''} ${cameraMode?`scene-camera-${cameraMode}`:''}`} style={tableFrameHeight===null?undefined:{'--table-frame-height':`${tableFrameHeight}px`} as React.CSSProperties} data-temporary-demo={temporaryDemo?'true':undefined} data-camera={cameraMode??undefined} data-camera-anchor-x={cameraPlace?.x} data-attended-object={atHome&&panel?panel==='phone'||panel==='phoneNote'?'phone':'home':atTable&&panel?tableTarget:undefined} data-table-framed={atTable&&panel&&tableFrameHeight!==null?'true':undefined} data-home-framed={atHome&&panel&&tableFrameHeight!==null?'true':undefined} aria-label="Play an illustrative evening">
    <h1 className="story-screenreader-title">{phase==='home'?'Back home from an illustrative evening':'An evening between Hong Kong and Shenzhen'}</h1>
    <div className="world-scroller" ref={scene} tabIndex={panel?-1:0} role="region" aria-label="Evening scene. On a narrow screen, swipe or use the named place controls to look around." onKeyDown={event=>{if(event.target===event.currentTarget&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();scene.current?.scrollBy({left:event.key==='ArrowRight'?180:-180,behavior:reducedMotion()?'instant':'smooth'});}}}>
      <SceneVisual city={visualCity} phase={phase} onStatusChange={setSceneStatus}>
        {atHome ? <button className="scene-place home-phone" data-scene-object="phone" data-anchor-x={homeScene.phone.x} data-anchor-y={homeScene.phone.y} style={{left:`${homeScene.phone.x}%`,top:`${homeScene.phone.y}%`}} tabIndex={panel?-1:0} aria-label="Open phone in the illustration" onClick={()=>openPanel('phone')}><Smartphone size={19}/><span>Phone</span></button> : atTable ? <>
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
    <div className="scene-caption"><span className="scene-fiction">Illustrated fiction · not a map</span><span className="scene-load-status" role="status" aria-atomic="true">{sceneStatus==='loading'?'Loading scene…':sceneStatus==='failed'?'Scene unavailable':''}</span></div>
    {warning && <button className="scene-save-notice" onClick={()=>openPanel('options')}>Read save notice</button>}
    {temporaryDemo && !panel && <aside className="temporary-demo-notice temporary-demo-world" aria-label="Temporary demo"><p>{TEMPORARY_DEMO_LABEL}</p><small>{TEMPORARY_DEMO_GUIDANCE}</small></aside>}
    <div className="world-interface" hidden={!!panel}>
      <div className="world-controls">
        {!atHome&&<nav className="scene-places" aria-label={atTable?'Objects on the table':city?'Places in this scene':'Look at either city'}>
          {atTable ? <><button onClick={openTableMenu} aria-label={phase==='arrival'?'Read the menu':'Look at the table'}><Utensils size={16}/><span>Menu</span></button><button onClick={()=>openPanel('phone')} aria-label="Open phone"><Smartphone size={16}/><span>Phone</span></button><button ref={walletControl} onClick={()=>openPanel('wallet')} aria-label="Open wallet"><Wallet size={16}/><span>Wallet</span></button></> : city ? places.map(place=><button key={place.id} onClick={()=>inspect(place)} aria-label={`Look at ${place.label}`}><place.icon size={17}/><span>{place.id==='table'?'Table':place.id==='wander'?city==='hk'?'Harbor':'Avenue':'Way home'}</span></button>) : (['hk','sz'] as const).map(id=><button key={id} onClick={()=>chooseCity(id)} aria-label={`Look at ${cityName(id)}`}><MapPin size={17}/><span>{cityName(id)}</span></button>)}
        </nav>}
        <div className="scene-actions">
          {city && <button className="scene-next" ref={nextPlace} onClick={()=>phase==='home'?commit({type:'TRY_OTHER_CITY'},'destination'):openPanel(contextPanel,undefined,atTable?'jun':undefined)}>{nextLabel}<ArrowRight size={17}/></button>}
          <div className="pocket-tools" role="group" aria-label="Things with you">{!atTable&&<><button ref={walletControl} onClick={()=>openPanel('wallet')} aria-label="Open wallet"><Wallet size={21}/><span>Wallet</span></button><button onClick={()=>openPanel('phone')} aria-label="Open phone"><Smartphone size={21}/><span>Phone</span></button></>}<button onClick={()=>openPanel('options')} aria-label="Story options"><MoreHorizontal size={23}/><span>More</span></button></div>
        </div>
      </div>
      {city && phase==='fork' && <button className="other-shore" onClick={()=>chooseCity(city==='hk'?'sz':'hk')} aria-label={`Look at ${cityName(city==='hk'?'sz':'hk')}`}><ArrowLeft size={14}/> Look at {cityName(city==='hk'?'sz':'hk')}</button>}
      {!atHome&&<span className="scene-pan-hint">Swipe to look around · or choose a place below</span>}
    </div>

    <dialog className={`world-dialogue ${dialogueOnLeft?'dialogue-left':'dialogue-right'} ${dialogueAtTop?'dialogue-top':''} ${isJun&&!atTable?'with-jun':'object-dialogue'} ${atTable?'table-dialogue':''} ${atHome?'home-dialogue':''}`} ref={dialogue} aria-labelledby="world-dialogue-title" onKeyDown={containDialogueFocus} onCancel={event=>{event.preventDefault();closePanel();}} onClick={event=>{if(event.target===event.currentTarget) closePanel();}}>
      {panel && <div className="dialogue-surface">
        <button className="dialogue-close" aria-label={panel==='plannerImport'?'Return to Wallet':'Return to the scene'} onClick={closePanel}><X size={20}/></button>
        {isJun && !atTable && <div className="dialogue-portrait"><JunPortrait/><span>JUN {panel==='invitation'&&<small>Fictional companion</small>}</span></div>}
        <div className="dialogue-body"><h2 id="world-dialogue-title" ref={dialogueTitle} tabIndex={-1}>{dialogueHeading}</h2>{temporaryDemo && <p className="temporary-demo-dialogue-note">{TEMPORARY_DEMO_LABEL}<small>{TEMPORARY_DEMO_GUIDANCE}</small></p>}
          {panel==='invitation' && <><p className="spoken-line">{junDialogue.invitation}</p><div className="spoken-replies"><button onClick={()=>{chooseCity('hk');openPanel('destination');}}>Let’s stay nearby. <ArrowRight size={16}/></button><button onClick={()=>{chooseCity('sz');openPanel('destination');}}>Let’s cross for dinner. <ArrowRight size={16}/></button></div><button className="dialogue-next" onClick={closePanel}>Look around first <ChevronDown size={17}/></button></>}
          {panel==='observation' && <><p className="spoken-line">{observation[Math.min(line,observation.length-1)]}</p><p className="dialogue-footnote">Looking around doesn’t advance the story clock.</p>{line<observation.length-1?<Continue onClick={continueLine}/>:<button className="dialogue-next" onClick={closePanel}>Back to looking around <ChevronDown size={17}/></button>}{attended==='home'&&<button className="object-model-link" onClick={()=>openRoute(true)}>Unfold the return route <ArrowRight size={15}/></button>}</>}
          {panel==='wallet' && <><p className="object-intro">An allowance for this fictional outing, not cash or a live account balance.</p><dl className="pocket-facts"><div><dt>Spending allowance / person</dt><dd>{money(state.baseInputs.budgetPerPersonHKD)}</dd></div>{(option?[option]:comparison.options).map(item=><div key={item.id}><dt>{cityName(item.id)} · projected outing / person</dt><dd>{money(item.perPersonHKD)}</dd></div>)}</dl><p className="dialogue-footnote">Estimates include dinner, drinks and the return journey. Optional shared orders are split between two adults. CNY costs use the model’s exchange assumption, not a live rate.</p><div className="wallet-business-bridge"><button className="object-model-link" onClick={()=>{dialogue.current?.close();setPanel(null);setLine(0);onBusinessLens(option,state.baseInputs.partySize);}}>Who benefits from this spending? <ArrowRight size={15}/></button><p className="dialogue-footnote">This is customer spending. Pay, costs and profits need different evidence.</p></div>{walletWarningOption && <>{routeView?.isConditional&&(!walletWarningOption.homeFeasible||!walletWarningOption.crossingFeasible)&&<p className="dialogue-footnote wallet-forecast">{routeView.forecastText}</p>}<ConstraintWarnings option={walletWarningOption}/></>}<button ref={plannerImportControl} className="object-model-link" onClick={()=>openPanel('plannerImport',undefined,'wallet')}>Use this evening in planner <ArrowRight size={15}/></button><p className="dialogue-footnote">After confirmation, this replaces your separate plan inputs. The planner recalculates the other city from this evening’s starting assumptions, rather than comparing saved playthroughs.</p><button className="dialogue-next" onClick={closePanel}>Put the wallet away <ChevronDown size={17}/></button></>}
          {panel==='plannerImport' && <><p className="object-intro">This replaces your separate plan inputs with this evening’s inputs. Your story and older saved notes stay as they are.</p><p className="dialogue-footnote">The planner recalculates the other city from this evening’s starting assumptions, rather than comparing saved playthroughs.</p><button className="dialogue-commit" onClick={confirmPlannerImport}>Replace plan and explore <ArrowRight size={17}/></button><button className="dialogue-next" onClick={closePanel}>Keep my plan <ArrowLeft size={17}/></button></>}
          {panel==='phone' && <RouteNote state={state} onSelectRoute={route=>action({type:'SET_ROUTE',route})} onBack={backFromPhone} onReconsiderDeparture={()=>commit({type:'REWIND',checkpoint:'fork'},'destination')} returnFirst={phoneContext.returnFirst} returnIntent={phoneContext.returnIntent} backLabel={phoneContext.from==='phoneNote'?'Back to the message':phoneContext.from?'Back to Jun':'Put the phone away'} showRouteChoicesInitially={phoneContext.changeRoute}/>}
          {panel==='phoneNote' && <div className="authored-phone-note"><p className="phone-note-label">Authored fictional story message</p><p className="spoken-line">{junDialogue.homeMessage}</p><button className="dialogue-next" onClick={()=>openRoute(true)}>Check the journey <ArrowRight size={16}/></button><button className="object-model-link" onClick={closePanel}>Put the phone away <ChevronDown size={15}/></button></div>}
          {panel==='destination' && city && <><p className="spoken-line">{city==='hk'?'We can stay nearby and eat by the harbor.':'We could take the train or go by road. Either way, we’ll need time to get back.'}</p>{routeView&&<><div className="departure-selected-route"><span>{routeView.routeLabel}</span>{city==='sz'&&<button onClick={()=>openRoute(false,'planned',true)}>Change route <ChevronDown size={14}/></button>}</div><p className="departure-facts complete-evening-estimate"><strong>Complete evening estimate</strong>{routeView.consequence}</p><p className="dialogue-footnote departure-forecast">{routeView.forecastText}</p><button className="object-model-link" onClick={()=>openRoute()}>Unfold the route <ArrowRight size={15}/></button><ConstraintWarnings option={routeView.conditionalOption} entry/></>}<button className="dialogue-commit" onClick={()=>commit({type:'COMMIT_DEPARTURE',city,route:attempt.route},'arrived')}>{city==='hk'?'Head to the table':attempt.route==='rail'?'Head to the station':'Take the road route'} <ArrowRight size={17}/></button></>}
          {panel==='arrived' && <><p className="spoken-line">{junDialogue.tableArrival}</p><button className="dialogue-next" onClick={()=>openPanel('dinner')}>Read the menu <ArrowRight size={17}/></button></>}
          {panel==='dinner' && <><p className="spoken-line">Keep it simple, or stay for another dish?</p><div className="menu-choices">{([{id:'simple',title:'Let’s keep dinner simple.',body:'60 minutes · no shared order.'},{id:'linger',title:'Let’s have one more dish.',body:`90 minutes · one shared ${city==='hk'?'dessert':'order'}.`}] as const).map(choice=><Choice key={choice.id} state={state} action={{type:'COMMIT_DINNER',choice:choice.id}} title={choice.title} body={choice.body} dispatch={next=>commit(next,'afterDinner')}/>)}</div></>}
          {panel==='afterDinner' && <><p className="spoken-line">{junDialogue.afterDinner}{progress.delayApplied?' Dinner ran half an hour longer than expected.':''}</p><p className="fictional-event play-event-note">{progress.delayApplied?'The disclosed dinner delay has added 30 minutes once. It adds no extra charge.':'This is the calm version. No fictional delay is applied.'}</p><button className="dialogue-next" onClick={()=>openPanel('walkChoice')}>Step outside <ArrowRight size={17}/></button><DirectReturn state={state} dispatch={next=>commit(next,'home')} onRoute={()=>openRoute(true,'direct')}/></>}
          {panel==='walkChoice' && <><p className="spoken-line">A small loop nearby, or the longer way round?</p><div className="menu-choices">{([{id:'long',title:'Let’s take the longer walk.',body:city==='hk'?'45 minutes along the harbor.':'45 minutes along the avenue.'},{id:'short',title:'A short loop sounds good.',body:'15 minutes nearby · home 30 minutes earlier.'}] as const).map(choice=><Choice key={choice.id} state={state} action={{type:'COMMIT_WALK',choice:choice.id}} title={choice.title} body={choice.body} dispatch={next=>commit(next,'walked')}/>)}</div><DirectReturn state={state} dispatch={next=>commit(next,'home')} onRoute={()=>openRoute(true,'direct')}/></>}
          {panel==='walked' && <><p className="spoken-line">{junDialogue.afterWalk}</p><p className="spoken-line secondary-line">{junDialogue.returnInvitation}</p><button className="dialogue-next" onClick={closePanel}>Look around <ChevronDown size={17}/></button></>}
          {panel==='return' && <><p className="spoken-line">{junDialogue.returnInvitation}</p>{option&&<><p className="departure-facts">{minutes(option.inwardMinutes)} back · modelled home arrival {formatClock(option.returnMinutes)}<br/>Whole outing estimate {money(option.perPersonHKD)}/person</p><ConstraintWarnings option={option} entry/></>}<button className="object-model-link" onClick={()=>openRoute(true)}>Check the return route <ArrowRight size={15}/></button><button className="dialogue-commit" onClick={()=>commit({type:'RETURN_HOME'},'home')}>Follow the return journey <ArrowRight size={17}/></button></>}
          {panel==='home' && <><p className="spoken-line">You’re back.</p><p className="departure-facts">Home at {formatClock(progress.clockMinutes)} in this model.</p>{option&&<ConstraintWarnings option={option} entry/>}<button className="dialogue-next" onClick={closePanel}>Finish the evening <ChevronDown size={17}/></button></>}
          {panel==='options' && <><p className="object-intro">A fictional evening for two adults. Dialogue, costs and travel durations are authored examples. No booking, live queue, eligibility check or AI conversation is taking place.</p>{warning&&<p className="save-warning" role="status">{warning}</p>}<details className="story-setup"><summary>Evening setup <ChevronDown size={15}/></summary><p>{preset.label} · {formatClock(state.baseInputs.departureMinutes)}–{formatClock(homeDeadline)} · allowance {money(state.baseInputs.budgetPerPersonHKD)}/person</p><p>{state.delayScenario==='dinner30'?'Includes one fictional 30-minute dinner delay.':'Calm version · no fictional delay.'}</p>{phase==='fork'&&!state.previousAttempt&&<><div className="setup-presets" role="group" aria-label="Choose the shape of the evening">{STORY_PRESETS.map(item=><button key={item.id} aria-pressed={item.id===state.presetId} onClick={()=>action({type:'RECONFIGURE',presetId:item.id,delayScenario:state.delayScenario})}><strong>{item.label}</strong><small>{formatClock(item.departureMinutes)}–{formatClock(item.homeByMinutes)} · HK${item.budgetPerPersonHKD}/person</small></button>)}</div><label className="delay-setting"><input type="checkbox" checked={state.delayScenario==='dinner30'} onChange={event=>action({type:'RECONFIGURE',delayScenario:event.target.checked?'dinner30':'none'})}/>Include one fictional 30-minute dinner delay</label></>}</details><div className="story-option-actions">{!temporaryDemo && <a id="start-temporary-demo" href={buildTemporaryDemoUrl(window.location.href)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-describedby="temporary-demo-opening-note">Start temporary demo <ArrowRight size={16}/></a>}<button onClick={()=>{closePanel();onBrowsePlanner();}}>Open my plan <ArrowRight size={16}/></button><button onClick={()=>{closePanel();onResearch();}}>Open research desk <ArrowRight size={16}/></button>{phase!=='fork'&&<button onClick={()=>commit({type:'REWIND',checkpoint:'fork'},'destination')}><RotateCcw size={15}/> Rewind to the fork</button>}{['afterDinner','walk','home'].includes(phase)&&<button onClick={()=>commit({type:'REWIND',checkpoint:'arrival'},'dinner')}>Reconsider dinner</button>}{['walk','home'].includes(phase)&&<button onClick={()=>commit({type:'REWIND',checkpoint:'afterDinner'},'walkChoice')}>Reconsider the walk</button>}<button onClick={()=>openPanel('reset')}>Start a fresh evening</button></div><p className="dialogue-footnote">{temporaryDemo ? 'Story and planner changes last only in this tab. Your saved evening stays as it is.' : 'Progress resumes in this browser when storage is available. Your practical planner has a separate save.'}</p>{!temporaryDemo && <p id="temporary-demo-opening-note" className="dialogue-footnote">The temporary demo opens Room to wander in a new tab. Your current tab stays as it is, and demo changes won’t be saved. If a new tab does not appear, use the link’s browser menu to open it in a new tab.</p>}</>}
          {panel==='legacyReplay' && pendingReplay && <><p className="object-intro">{pendingReplay.action.type==='TRY_OTHER_CITY'?'Continuing will replace an older saved note or detail from the previous evening.':'Rewinding will clear an older saved note or detail from this evening.'}</p><div className="story-option-actions"><button onClick={closePanel}>Keep this evening</button><button className="dialogue-commit" onClick={()=>{const next=pendingReplay;setPendingReplay(null);action(next.action);setLine(0);setPanel(next.nextPanel);}}>Clear older detail and continue</button></div></>}
          {panel==='reset' && <><p className="object-intro">{temporaryDemo ? 'This resets both story attempts in this temporary demo. Your temporary planner and saved evening stay as they are.' : 'This replaces both saved story attempts, including any notes from older versions. Your separate practical planner stays as it is.'}</p><div className="story-option-actions"><button className="dialogue-commit" onClick={()=>commit({type:'RESET',presetId:'wander'},'invitation')}>Start a fresh story</button><button onClick={()=>openPanel('options')}>Keep this evening</button></div></>}
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
