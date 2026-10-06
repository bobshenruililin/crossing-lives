import { useId, useState } from 'react';
import {
  membershipBoundary,
  membershipCases,
  membershipSources,
  membershipStatusLabels,
  membershipTopics,
} from '../business/membership-evidence';
import type { MembershipTopic } from '../business/membership-evidence';

/** A pure reading view, also used to verify every topic without mounting the outing. */
export function MembershipReading({ topic }: { topic: MembershipTopic }) {
  const headingId = useId();
  return <section className="membership-reading" aria-labelledby={headingId}>
    <h3 id={headingId}>{topic.question}</h3>
    <div className="membership-reading-rows">
      {topic.readings.map(reading => <article className="membership-reading-row" key={reading.caseId}>
        <h4>{membershipCases[reading.caseId]}</h4>
        <div>
          <p className="membership-status">{membershipStatusLabels[reading.status]}</p>
          <p className="membership-answer">{reading.answer}</p>
          <p className="membership-limit"><strong>Evidence limit:</strong> {reading.limit}</p>
          <p className="membership-citation">{reading.evidenceLabel}</p>
          <ul className="membership-source-links" aria-label={`${membershipCases[reading.caseId]} sources`}>
            {reading.sourceIds.map(sourceId => {
              const source = membershipSources[sourceId];
              return <li key={sourceId}><a href={source.href} target="_blank" rel="noreferrer">{source.linkLabel}</a></li>;
            })}
          </ul>
        </div>
      </article>)}
    </div>
    <p className="membership-question"><strong>Before adapting this model</strong>{topic.dueDiligence}</p>
  </section>;
}

/** Local reading state only: deliberately accepts no spending context or allocation props. */
export default function MembershipLens() {
  const [activeTopic, setActiveTopic] = useState(membershipTopics[0]);
  const groupId = useId();
  return <details className="membership-lens">
    <summary><h2>What does membership let you do?</h2></summary>
    <div className="membership-body">
      <p className="membership-intro">Compare the rights described by two real organizations. Choose a question to inspect the evidence.</p>
      <p className="membership-boundary">{membershipBoundary}</p>
      <fieldset className="membership-topics">
        <legend>Choose a membership question</legend>
        <div>
          {membershipTopics.map(topic => <label key={topic.id}>
            <input type="radio" name={`membership-topic-${groupId}`} value={topic.id} checked={activeTopic.id === topic.id} onChange={() => setActiveTopic(topic)}/>
            <span>{topic.label}</span>
          </label>)}
        </div>
      </fieldset>
      <MembershipReading topic={activeTopic}/>
      <details className="membership-sources">
        <summary>Sources and limits · checked 6 October 2026</summary>
        <p>Cheese Board’s operating details come from a historical 2022 notice; current terms were not verified. Some evidence came from official indexed text because direct access failed.</p>
        <ul>
          {Object.entries(membershipSources).map(([sourceId, source]) => <li key={sourceId}>
            <a href={source.href} target="_blank" rel="noreferrer">{source.title}</a>
            <p>{source.date} · checked 6 October 2026.</p>
            <p><strong>Retrieval:</strong> {source.retrieval}</p>
            <p><strong>Scope:</strong> {source.limit}</p>
          </li>)}
        </ul>
      </details>
    </div>
  </details>;
}
