import { useId } from 'react';
import type { InteractionProps } from '../types';
import { WorldDiagram } from './diagrams';
import { changeChoice, sceneContent, sceneNumbers, selectedVariant } from './model';

/** The shell supplies the title, focus trap and dismissal; this panel owns the one thought. */
export function WorldInteraction({ sceneId, values, onChange }: InteractionProps) {
  const uid = useId();
  const content = sceneContent(sceneId), variant = selectedVariant(sceneId, values), numbers = sceneNumbers(sceneId, variant.value);
  return <section className="world-insight" data-testid={`world-insight-${sceneId}`} data-choice={variant.value} aria-label={content.action.question}>
    <fieldset className="wi-choices"><legend>{content.action.question}</legend>
      {content.action.input.choices.map(choice => <label key={choice.value} className={variant.value === choice.value ? 'is-selected' : ''}>
        <input type="radio" name={`${uid}-choice`} value={choice.value} checked={variant.value === choice.value} onChange={() => onChange(changeChoice(sceneId, values, choice.value))}/>
        <span>{choice.label}</span>
      </label>)}
    </fieldset>
    <WorldDiagram scene={sceneId} choice={variant.value}/>
    <div className="wi-result" role="status" aria-live="polite" aria-atomic="true">
      {numbers.length > 0 && <><span className="wi-example-caption">{numbers.some(number => number.unit === 'HKD' || number.unit === 'CNY-equivalent') ? 'Illustrative example · not a price quote' : 'Illustrative timing'}</span><dl className="wi-numbers" aria-label="Visible consequence">{numbers.map(number => <div key={number.label} data-world-number={number.label}>
        <dt>{number.label}</dt><dd><strong>{typeof number.value === 'number' ? number.value.toLocaleString('en-HK') : number.value}</strong><span className={sceneId === 'hk-home' ? 'world-sr-only' : undefined}>{number.unit}</span></dd>
      </div>)}</dl></>}
      <p className="wi-thought">{variant.thought}</p>
    </div>
    <details className="wi-evidence"><summary>Example, limits &amp; sources</summary>
      <p>{content.action.aha}</p>
      {content.action.evidenceStatus.startsWith('authored') && <p className="wi-status">Fictional example / diagram</p>}
      {content.action.scope && <p>{content.action.scope}</p>}
      <ul>{content.action.unknowns.map(unknown => <li key={unknown}>{unknown}</li>)}</ul>
      {content.action.fictionalInputs && <details><summary>Example inputs</summary><dl>{Object.entries(content.action.fictionalInputs).map(([key, value]) => <div key={key}>
        <dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/HKD/g, ' HKD')}</dt><dd>{Array.isArray(value) ? value.join(' + ') : String(value)}</dd>
      </div>)}</dl></details>}
      {content.action.publicSources.map(source => <p key={source.id}>
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><br/>{source.supports}<br/><small>{source.limit}</small>
      </p>)}
    </details>
  </section>;
}
