import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, CircleHelp, FlaskConical, FolderOpen, Landmark, Layers3, Search, ShieldCheck } from 'lucide-react';

import { sources } from '../data/evidence';

export default function EvidenceDesk({onBack}: {onBack: () => void}) {
  const [section, setSection] = useState<'sources'|'economics'|'roadmap'>('sources');
  const [query, setQuery] = useState('');
  const filtered = sources.filter(source => (source.label + source.body + source.source).toLowerCase().includes(query.toLowerCase()));
  return <main id="main-content" className="evidence-layout">
    <aside className="desk-sidebar">
      <button className="desk-back" onClick={onBack}><ArrowLeft size={16}/> Return to your evening</button>
      <div className="desk-mark"><Layers3 size={27}/><span>BETWEEN<br/><small>RESEARCH DESK</small></span></div>
      <p className="eyebrow">THE OTHER SIDE OF THE TABLE</p>
      <nav aria-label="Research desk"><button className={section === 'sources' ? 'active' : ''} onClick={() => setSection('sources')}><BookOpen size={17}/> Evidence library <span>04</span></button><button className={section === 'economics' ? 'active' : ''} onClick={() => setSection('economics')}><Landmark size={17}/> Business questions</button><button className={section === 'roadmap' ? 'active' : ''} onClick={() => setSection('roadmap')}><FlaskConical size={17}/> Model roadmap</button></nav>
      <div className="desk-foot"><span className="status-dot"/> Early research workspace<p>Transparent sources.<br/>Open questions kept open.</p></div>
    </aside>
    <div className="desk-main">
      <div className="desk-topline"><span>WORKSPACE / {section === 'sources' ? 'EVIDENCE LIBRARY' : section === 'economics' ? 'BUSINESS QUESTIONS' : 'MODEL ROADMAP'}</span><span><ShieldCheck size={14}/> No live AI</span></div>
      {section === 'sources' ? <>
        <div className="desk-title"><p className="eyebrow">GROUND THE STORY</p><h1>What do we actually know?</h1><p>Published facts, working assumptions and open questions. Every claim gets a place to stand.</p></div>
        <div className="source-summary"><div><span className="evidence-dot verified"/>2 published references</div><div><span className="evidence-dot illustrative"/>1 authored scenario</div><div><span className="evidence-dot unknown"/>1 needs verification</div><small>Checked 6 Oct 2026</small></div>
        <label className="source-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sources, claims or assumptions" aria-label="Search evidence"/>{query && <button onClick={() => setQuery('')} aria-label="Clear evidence search">×</button>}</label>
        <div className="source-list">{filtered.length ? filtered.map((source, index) => <article className="source-card" key={source.id}><span className="source-index">0{index + 1}</span><div><div className="source-card-top"><h2>{source.label}</h2><span className={`source-tag ${source.kind === 'Published fact' ? 'verified' : ''}`}>{source.kind === 'Published fact' ? <Check size={12}/> : <CircleHelp size={12}/>} {source.kind}</span></div><p>{source.body}</p><p className="source-note">{source.note}</p>{source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.source} <ArrowUpRight size={14}/></a> : <span className="authored-source">{source.source}</span>}</div></article>) : <div className="empty-evidence"><FolderOpen size={34}/><h2>No matching evidence yet.</h2><p>Try “border”, “fare” or “dinner”.</p><button className="text-button" onClick={() => setQuery('')}>Show all sources</button></div>}</div>
      </> : section === 'economics' ? <>
        <div className="desk-title"><p className="eyebrow">A SEPARATE LENS</p><h1>A cheaper dinner isn’t a business model.</h1><p>Personal spending tells one story. Explaining firm costs or who benefits needs different evidence.</p></div>
        <div className="research-banner"><CircleHelp size={22}/><div><strong>Research scaffold, not a completed market study</strong><p>No business cost dataset is connected. No causal claims or extra returns are estimated.</p></div></div>
        <div className="business-grid">{[{title:'What explains the price?',subtitle:'Cost structure',text:'Collect comparable rent, labor, ingredients, taxes, scale and service-format evidence. A menu price alone cannot identify the cause.',fields:'Needed: venue type · period · currency · source · comparability'}, {title:'Who keeps the margin?',subtitle:'Distribution',text:'Separate revenue from profit, and wages from ownership returns. Track who bears risk as well as who receives a share.',fields:'Needed: contracts · ownership · costs · distribution rules'}, {title:'What might change?',subtitle:'Governance',text:'A fixed-pool allocation is a thought experiment. Compare rules for an existing surplus without assuming ownership creates additional returns.',fields:'Needed: defined pool · decision rights · consent · constraints'}].map(item => <article key={item.title}><p className="eyebrow">{item.subtitle}</p><h2>{item.title}</h2><p>{item.text}</p><small>{item.fields}</small><span className="open-question">Evidence needed</span></article>)}</div>
      </> : <>
        <div className="desk-title"><p className="eyebrow">BUILD ON AN HONEST FOUNDATION</p><h1>A model should earn your trust.</h1><p>Useful rules today. Richer evidence when it is ready.</p></div>
        <ol className="roadmap">{[{status:'Working now',title:'Deterministic outing engine',text:'Editable costs, currency, party size, complete travel time and return constraints. Rule-based explanations stay inspectable.'},{status:'Scaffold',title:'Evidence-backed business comparisons',text:'A separate data model will distinguish costs, prices, margins and governance. Missing evidence must remain visible.'},{status:'Future, not connected',title:'An optional AI research layer',text:'Retrieval with source provenance, uncertainty and user approval for any action. There is no chat model or live AI service behind this prototype.'}].map((item,index)=><li key={item.title}><span>{index + 1}</span><div><small>{item.status}</small><h2>{item.title}</h2><p>{item.text}</p></div></li>)}</ol>
      </>}
      <footer className="desk-disclaimer">A public prototype with illustrative personas. No accounts, location tracking or personal information are required.</footer>
    </div>
  </main>;
}
