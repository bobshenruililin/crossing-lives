import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, FlaskConical, FolderOpen, Landmark, Search, ShieldCheck } from 'lucide-react';

import { sources } from '../data/evidence';
import type { SpendingContext } from '../business/context';
import SurplusLab from './SurplusLab';

type DeskSection = 'sources' | 'economics' | 'roadmap';
interface EvidenceDeskProps {
  onBack: () => void;
  initialSection?: DeskSection;
  spendingContext?: SpendingContext | null;
}

const exactHKD = (amount: number) => `HK$${amount.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EvidenceDesk({onBack, initialSection = 'sources', spendingContext = null}: EvidenceDeskProps) {
  const [section, setSection] = useState<DeskSection>(initialSection);
  const [query, setQuery] = useState('');
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionsTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingHeadingFocus = useRef<DeskSection | null>(initialSection);
  useEffect(() => {
    pendingHeadingFocus.current = initialSection;
    setSection(initialSection);
    setSectionsOpen(false);
  }, [initialSection]);
  useEffect(() => {
    if (pendingHeadingFocus.current === section) {
      headingRef.current?.focus({ preventScroll: true });
      pendingHeadingFocus.current = null;
    }
  }, [initialSection, section, sectionsOpen]);
  const selectSection = (nextSection: DeskSection) => {
    pendingHeadingFocus.current = nextSection;
    setSection(nextSection);
    setSectionsOpen(false);
  };
  const filtered = sources.filter(source => (source.label + source.body + source.source).toLowerCase().includes(query.toLowerCase()));
  return <main id="main-content" className="evidence-layout evidence-desk" onKeyDown={event => {
      if (event.key === 'Escape' && sectionsOpen) {
        event.preventDefault();
        setSectionsOpen(false);
        sectionsTriggerRef.current?.focus();
      }
    }}>
    <header className="desk-navigation">
      <div className="desk-toolbar">
        <button className="desk-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/> Return to your evening</button>
        <button ref={sectionsTriggerRef} className="desk-sections-trigger" aria-expanded={sectionsOpen} aria-controls="desk-sections" onClick={() => setSectionsOpen(open => !open)}>Sections <ChevronDown size={16} aria-hidden="true"/></button>
      </div>
      <nav id="desk-sections" className="desk-sections" aria-label="Research desk" hidden={!sectionsOpen}>
        <button className={section === 'sources' ? 'active' : ''} aria-current={section === 'sources' ? 'page' : undefined} onClick={() => selectSection('sources')}><BookOpen size={17} aria-hidden="true"/> Evidence library</button>
        <button className={section === 'economics' ? 'active' : ''} aria-current={section === 'economics' ? 'page' : undefined} onClick={() => selectSection('economics')}><Landmark size={17} aria-hidden="true"/> Business questions</button>
        <button className={section === 'roadmap' ? 'active' : ''} aria-current={section === 'roadmap' ? 'page' : undefined} onClick={() => selectSection('roadmap')}><FlaskConical size={17} aria-hidden="true"/> Model roadmap</button>
      </nav>
    </header>
    <div className="desk-main">
      {section === 'sources' ? <>
        <div className="desk-title"><h1 ref={headingRef} tabIndex={-1}>What do we actually know?</h1><p>Published facts, working assumptions and open questions. Every claim gets a place to stand.</p></div>
        <div className="source-summary"><div><span className="evidence-dot verified"/>2 published references</div><div><span className="evidence-dot illustrative"/>1 authored scenario</div><div><span className="evidence-dot unknown"/>1 needs verification</div><small>Checked 6 Oct 2026</small></div>
        <label className="source-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sources, claims or assumptions" aria-label="Search evidence"/>{query && <button onClick={() => setQuery('')} aria-label="Clear evidence search">×</button>}</label>
        <div className="source-list">{filtered.length ? filtered.map((source, index) => <article className="source-card" key={source.id}><span className="source-index">0{index + 1}</span><div><div className="source-card-top"><h2>{source.label}</h2><span className={`source-tag ${source.kind === 'Published fact' ? 'verified' : ''}`}>{source.kind === 'Published fact' ? <Check size={12}/> : <CircleHelp size={12}/>} {source.kind}</span></div><p>{source.body}</p><p className="source-note">{source.note}</p>{source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.source} <ArrowUpRight size={14}/></a> : <span className="authored-source">{source.source}</span>}</div></article>) : <div className="empty-evidence"><FolderOpen size={34}/><h2>No matching evidence yet.</h2><p>Try “border”, “fare” or “dinner”.</p><button className="text-button" onClick={() => setQuery('')}>Show all sources</button></div>}</div>
      </> : section === 'economics' ? <>
        <div className="desk-title"><h1 ref={headingRef} tabIndex={-1}>What does tonight’s spending tell us about who gained?</h1><p>Personal spending tells one story. Explaining firm costs or who benefits needs different evidence.</p></div>
        {spendingContext ? <div className="research-banner spending-context"><CircleHelp size={22} aria-hidden="true"/><div>
          <strong>Illustrative {spendingContext.cityId === 'hk' ? 'Hong Kong' : 'Shenzhen'} evening</strong>
          <p>{spendingContext.perPersonHKD === null || spendingContext.groupHKD === null
            ? `The whole-outing estimate is incomplete for ${spendingContext.partySize} ${spendingContext.partySize === 1 ? 'person' : 'people'}. Dinner, drinks and return travel must all be included before showing a per-person or group total in HKD.`
            : `${exactHKD(spendingContext.perPersonHKD)} per person · ${exactHKD(spendingContext.groupHKD)} for ${spendingContext.partySize} ${spendingContext.partySize === 1 ? 'person' : 'people'} (HKD), including dinner, drinks and return travel.`}</p>
          <p>That is modeled customer spending across the whole outing, including transport. We haven’t verified any restaurant’s wages, costs, ownership or profit.</p>
        </div></div> : <div className="research-banner"><CircleHelp size={22}/><div><strong>Research scaffold, not a completed market study</strong><p>No business cost dataset is connected. No causal claims or extra returns are estimated.</p></div></div>}
        <div className="business-grid">{[{title:'What explains the price?',subtitle:'Cost structure',text:'Collect comparable rent, labor, ingredients, taxes, scale and service-format evidence. A menu price alone cannot identify the cause.',fields:'Needed: venue type · period · currency · source · comparability'}, {title:'Who keeps the margin?',subtitle:'Distribution',text:'Separate revenue from profit, and wages from ownership returns. Track who bears risk as well as who receives a share.',fields:'Needed: contracts · ownership · costs · distribution rules'}, {title:'What might change?',subtitle:'Governance',text:'A fixed-pool allocation is a thought experiment. Compare rules for an existing surplus without assuming ownership creates additional returns.',fields:'Needed: defined pool · decision rights · consent · constraints'}].map(item => <article key={item.title}><p className="eyebrow">{item.subtitle}</p><h2>{item.title}</h2><p>{item.text}</p><small>{item.fields}</small><span className="open-question">Evidence needed</span></article>)}</div>
        <p className="business-pool-boundary">The fixed-pool exercise below is a separate hypothetical amount. It is not calculated from this outing estimate.</p>
        <SurplusLab/>
      </> : <>
        <div className="desk-title"><h1 ref={headingRef} tabIndex={-1}>A model should earn your trust.</h1><p>Useful rules today. Richer evidence when it is ready.</p></div>
        <ol className="roadmap">{[{status:'Working now',title:'Deterministic outing engine',text:'Editable costs, currency, party size, complete travel time and return constraints. Rule-based explanations stay inspectable.'},{status:'Scaffold',title:'Evidence-backed business comparisons',text:'A separate data model will distinguish costs, prices, margins and governance. Missing evidence must remain visible.'},{status:'Future, not connected',title:'An optional AI research layer',text:'Retrieval with source provenance, uncertainty and user approval for any action. There is no chat model or live AI service behind this prototype.'}].map((item,index)=><li key={item.title}><span>{index + 1}</span><div><small>{item.status}</small><h2>{item.title}</h2><p>{item.text}</p></div></li>)}</ol>
      </>}
      <footer className="desk-disclaimer"><span className="desk-ai-status"><ShieldCheck size={14} aria-hidden="true"/> No live AI</span><p>An interactive prototype with illustrative personas. No accounts, location tracking or personal information are required.</p></footer>
    </div>
  </main>;
}
