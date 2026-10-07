import { useId } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { mapProvenance } from './map-data';
import { cityTimeline } from './timeline-data';
import { boundarySourceGeoJson } from './boundary-source';
import { cityOrder, linePath, mapSelection, polygonPath, regionalInsight, selectPlace, selectRegion, selectStage, sourceTitles, stageDates } from './map-adapter';
import type { GeographicMap, MapPoint, MapValues } from './map-adapter';
import './regional-map.css';

export interface RegionalMapDiscoveryProps {
  values: MapValues;
  onChange: (nextValues: MapValues) => void;
}

const boundaryDownload = `data:application/geo+json;charset=utf-8,${encodeURIComponent(boundarySourceGeoJson)}`;
const externalLink = { target: '_blank', rel: 'noopener noreferrer' } as const;

function GeographicFigure({ map, point, uid, regional }: { map: GeographicMap; point: MapPoint; uid: string; regional: boolean }) {
  const [, , width, height] = map.viewBox;
  const labelStyle = { left: `${point.xy[0] * 100}%`, top: `${point.xy[1] * 100}%`, '--label-shift': point.xy[0] < .3 ? '0%' : point.xy[0] > .72 ? '-100%' : '-50%' } as CSSProperties;
  return <figure className="rmd-figure">
    <div className="rmd-map-frame">
      <svg viewBox={map.viewBox.join(' ')} role="img" aria-labelledby={`${uid}-map-title ${uid}-map-desc`} className="rmd-map" data-testid="regional-geographic-map" data-map={map.id}>
        <title id={`${uid}-map-title`}>{`${regional ? 'Greater Bay Area city locations' : 'Hong Kong and southern Shenzhen'}: ${point.name} selected`}</title>
        <desc id={`${uid}-map-desc`}>North is up. {regional ? 'Hong Kong and Shenzhen lie east of the Pearl River estuary, with Macao and Zhuhai to the west and Guangzhou farther north.' : 'Hong Kong lies south of Shenzhen. Luohu is east of Futian; Nanshan and Qianhai are farther west.'} A ring marks {point.name}. Other place anchors remain visible. The dashed line is the HK–mainland land and river boundary. Generalized present-day base, not a historical shoreline or walking route.</desc>
        <rect width={width} height={height} className="rmd-water"/>
        {map.land.map((part, index) => <path key={`${part.region}-${index}`} d={polygonPath(part.rings, map.viewBox)} className="rmd-land" fillRule="evenodd" data-layer="land"/>)}
        {map.coastlines.map((line, index) => <path key={index} d={linePath(line, map.viewBox)} className="rmd-coast" data-layer="coastline"/>)}
        <path d={linePath(map.landRiverBoundary, map.viewBox)} className="rmd-boundary" data-layer="hk-mainland-boundary"/>
        {map.points.filter(item => item.id !== point.id).map(item => <circle key={item.id} cx={item.xy[0] * width} cy={item.xy[1] * height} r={regional ? 7 : 6} className="rmd-other-place" data-place={item.id}/>)}
        <circle cx={point.xy[0] * width} cy={point.xy[1] * height} r="20" className="rmd-selection-ring"/>
        {point.kind === 'crossing-area' ? <rect x={point.xy[0] * width - 8} y={point.xy[1] * height - 8} width="16" height="16" className="rmd-active-place" data-place={point.id}/> : <circle cx={point.xy[0] * width} cy={point.xy[1] * height} r="8" className="rmd-active-place" data-place={point.id}/>}
      </svg>
      <span className="rmd-north" aria-hidden="true">↑<small>N</small></span>
      <span className="rmd-map-label" style={labelStyle} aria-hidden="true" data-testid="regional-active-label">{point.name}</span>
    </div>
    <figcaption>
      <span className="rmd-map-key"><i aria-hidden="true"/> HK–mainland land/river boundary</span>
      <a className="rmd-map-credit" href="https://www.openstreetmap.org/copyright" {...externalLink}>© OpenStreetMap contributors · ODbL</a>
    </figcaption>
  </figure>;
}

function SourceLinks({ urls }: { urls: readonly string[] }) {
  return <ul className="rmd-sources">{urls.map(url => <li key={url}><a href={url} {...externalLink}>{sourceTitles[url] ?? 'Read the source'} <span aria-hidden="true">↗</span></a></li>)}</ul>;
}

/** Embedded content only. The world shell owns its dialog, focus trap and return control. */
export function RegionalMapDiscovery({ values, onChange }: RegionalMapDiscoveryProps) {
  const uid = useId();
  const { region, stage, stageIndex, map, point } = mapSelection(values);
  const regional = region === 'gba';
  const places = regional ? [...map.points].sort((a, b) => cityOrder.indexOf(a.id) - cityOrder.indexOf(b.id)) : map.points;
  const changeChapter = (index: number) => onChange(selectStage(values, index));
  const chapterKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % 4 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null;
    if (next === null) return;
    event.preventDefault();
    changeChapter(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-chapter-index="${next}"]`)?.focus();
  };
  return <section className="regional-map-discovery" aria-label="Real regional geography" data-testid="regional-map-discovery" data-region={region} data-chapter={stage.id}>
    <div className="rmd-region-choices" role="group" aria-label="Map region">
      <button type="button" aria-pressed={!regional} onClick={() => onChange(selectRegion(values, 'hk-sz'))}>Hong Kong–Shenzhen</button>
      <button type="button" aria-pressed={regional} onClick={() => onChange(selectRegion(values, 'gba'))}>Greater Bay Area</button>
    </div>
    {!regional && <div className="rmd-timeline" role="group" aria-label="Development chapter; use arrow keys to move between chapters">
      {cityTimeline.stages.map((chapter, index) => <button key={chapter.id} type="button" data-chapter-index={index} aria-pressed={index === stageIndex} aria-label={`${chapter.dateLabel}: ${chapter.title}`} onClick={() => changeChapter(index)} onKeyDown={event => chapterKeys(event, index)}><span aria-hidden="true" className="rmd-timeline-dot"/>{stageDates[index]}</button>)}
    </div>}
    <div className="rmd-place-row"><label htmlFor={`${uid}-place`}>Locate</label><select id={`${uid}-place`} value={point.id} onChange={event => onChange(selectPlace(values, event.target.value))}>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></div>
    <GeographicFigure map={map} point={point} uid={uid} regional={regional}/>
    <div className="rmd-takeaway" role="status" aria-live="polite" aria-atomic="true" data-testid="regional-map-takeaway">
      <span className="rmd-status">{regional ? 'City locations · geographic context' : stage.dateLabel}</span>
      <p>{regional ? regionalInsight : stage.callout}</p>
    </div>
    <p className="rmd-scope">Real geography. Generalized present-day base. The game's walking route is fictional.</p>
    <details className="rmd-research" key={`${region}-${stage.id}`}>
      <summary>Look closer: evidence &amp; map sources</summary>
      {!regional && <>
        <h3>{stage.title}</h3>
        <p className="rmd-evidence-status">{stage.status}</p>
        <p>{stage.question}</p>
        <p>{stage.evidence}</p>
        <p>{stage.guardrail}</p>
        <SourceLinks urls={stage.sources}/>
      </>}
      <figure className="rmd-reading-guide" aria-label="Three different kinds of evidence">
        <figcaption>Three things to read differently</figcaption>
        <div><span aria-hidden="true">⌖</span><p><strong>A map</strong><small>Where places are</small></p></div>
        <div><span aria-hidden="true">▧</span><p><strong>A plan</strong><small>Intended roles and future structure</small></p></div>
        <div><span aria-hidden="true">▥</span><p><strong>Activity records</strong><small>Evidence of what happened</small></p></div>
      </figure>
      <details className="rmd-deeper"><summary>Two different lines</summary><p>{cityTimeline.boundaryCard.callout}</p><p>The former internal line is not drawn on this map.</p><SourceLinks urls={cityTimeline.boundaryCard.sources}/></details>
      <h3>About this map</h3>
      <p>{mapProvenance.caption} The same generalized present-day base is used in every chapter. It is not a reconstruction of historical coastlines.</p>
      <p>{regional ? 'The 11 city/SAR anchors locate GBA members. They do not outline municipal boundaries or the full regional extent.' : 'This close view shows Hong Kong and southern Shenzhen, not all of Shenzhen. Locality pins do not outline official planning centres.'}</p>
      <p>{point.name}: {['luohu', 'futian', 'nanshan'].includes(point.id) ? 'Approximate district anchor, not an official planning-centre centroid, district outline or building entrance.' : point.id === 'qianhai' ? 'Original-area locality anchor, not the outline or centroid of the enlarged cooperation zone.' : point.accuracy ?? 'Approximate city label anchor, not a municipal boundary or administrative centre.'}</p>
      {point.source.startsWith('https://') && <a className="rmd-place-source" href={point.source} {...externalLink}>Place-anchor source: {point.name} ↗</a>}
      <p>Natural Earth is 1:10 million cartography. Small islands and reclaimed shorelines can be simplified or dated. The community-mapped boundary is not a legal determination.</p>
      <ul className="rmd-sources">{mapProvenance.attributions.map(source => <li key={source.text}><a href={source.url} {...externalLink}>{source.text} · {source.license} ↗</a></li>)}<li><a href="https://opendatacommons.org/licenses/odbl/1-0/" {...externalLink}>Open Database License 1.0 ↗</a></li><li><a href={boundaryDownload} download="hk-mainland-land-border-odbl.geojson">Download boundary source data (.geojson)</a></li></ul>
      <p className="rmd-checked">Sources checked {mapProvenance.checkedAt}. No live route or border-operation data is loaded.</p>
    </details>
  </section>;
}

export default RegionalMapDiscovery;
