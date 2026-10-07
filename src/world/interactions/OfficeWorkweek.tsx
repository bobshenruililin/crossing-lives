import { useId } from 'react';
import type { InteractionProps } from '../types';
import { OFFICE_WORKWEEK, officeWorkweek, readOfficeWorkweek, setOfficeDays, setOfficeMeasure } from './office-workweek';

export function OfficeWorkweek({ values, onChange }: InteractionProps) {
  const uid = useId();
  const { days, measure } = readOfficeWorkweek(values), total = officeWorkweek(days);
  const money = measure === 'money', unit = money ? 'HKD' : 'hours';
  // The upper bound stays fixed at sixteen Shenzhen return commutes in both states.
  const maximum = officeWorkweek(4).shenzhen[money ? 'hkd' : 'hours'];
  const homes = [
    { id: 'hong-kong', label: 'Hong Kong home', short: 'HK home', value: total.hongKong[money ? 'hkd' : 'hours'] },
    { id: 'shenzhen', label: 'Shenzhen home', short: 'SZ home', value: total.shenzhen[money ? 'hkd' : 'hours'] },
  ];
  return <section className="world-insight office-workweek" data-testid="world-insight-office-floor" data-choice={days} data-measure={measure} aria-label="Same job, two home bases: change office days">
    <p className="ow-caption">Fictional four weeks · one adult commuter</p>
    <p className="ow-scope">Same Hong Kong job and pay.</p>
    <div className="ow-controls"><fieldset className="wi-choices ow-days"><legend>Office days / week</legend>
      {([2, 4] as const).map(option => <label key={option} className={days === option ? 'is-selected' : ''}>
        <input type="radio" name={`${uid}-office-days`} value={option} aria-label={`${option} days / week`} checked={days === option} onChange={() => onChange(setOfficeDays(values, option))}/><span>{option} days</span>
      </label>)}
    </fieldset>
    <label className="ow-measure">Compare<select aria-label="Compare travel" value={measure} onChange={event => onChange(setOfficeMeasure(values, event.target.value === 'money' ? 'money' : 'time'))}>
      <option value="time">Time</option><option value="money">Money</option>
    </select></label></div>
    <div className="wi-result" role="status" aria-live="polite" aria-atomic="true">
      <span className="wi-example-caption">{total.returns} return commutes · four-week {money ? 'travel cost' : 'travel time'}</span>
      <dl className="wi-numbers" aria-label="Four-week commute totals">{homes.map(home => <div key={home.id} data-world-number={home.label}>
        <dt>{home.label}</dt><dd><strong>{home.value.toLocaleString('en-HK')}</strong><span>{unit}</span></dd>
      </div>)}</dl>
    </div>
    <details className="ow-comparison"><summary>Calendar &amp; route comparison</summary>
    <figure className="wi-figure ow-figure" data-mechanism="office-workweek">
      <svg className="wi-visual ow-visual" viewBox="0 0 360 192" role="img" aria-label={`${total.returns} marked return days in four fictional weeks. ${homes.map(home => `${home.label}: ${home.value} ${unit}`).join('; ')}. Bars share a fixed zero to ${maximum} ${unit} scale.`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, column) => <text key={column} x={104 + column * 34} y="17" textAnchor="middle">{day}</text>)}
        {Array.from({ length: OFFICE_WORKWEEK.weeks }, (_, week) => <g key={week}>
          <text x="8" y={38 + week * 22}>Wk {week + 1}</text>
          {Array.from({ length: 7 }, (_, day) => <rect key={day} data-office-cell={`${week}-${day}`} data-office-return={day < days} x={92 + day * 34} y={24 + week * 22} width="24" height="16" rx="2" className={day < days ? 'ow-day is-return' : 'ow-day'}/>)}
        </g>)}
        {homes.map((home, index) => <g key={home.id}>
          <text x="8" y={126 + index * 40}>{home.short}</text>
          <rect data-office-track={home.id} x="8" y={133 + index * 40} width="336" height="11" rx="2" className="ow-route-track"/>
          <rect data-office-route={home.id} x="8" y={133 + index * 40} width={336 * home.value / maximum} height="11" rx="2" className="ow-route"/>
        </g>)}
      </svg>
      <figcaption>Marked days mean a return commute. Both bars use the same fixed {money ? 'cost' : 'time'} scale.</figcaption>
    </figure>
    </details>
    <details className="wi-evidence"><summary>Example &amp; limits</summary>
      <p>More office days repeat the home-to-work journey. This separate one-adult comparison does not depend on the people in your scene and cannot choose a home for you.</p>
      <p>All inputs are invented return-commute allowances, not measured routes or fare quotes. Each marked day includes going to the same Hong Kong job and returning home.</p>
      <p>Hong Kong home: {OFFICE_WORKWEEK.hongKong.minutesPerReturn} minutes and {OFFICE_WORKWEEK.hongKong.hkdPerReturn} HKD per return day. Shenzhen home: {OFFICE_WORKWEEK.shenzhen.minutesPerReturn} minutes and {OFFICE_WORKWEEK.shenzhen.hkdPerReturn} HKD per return day.</p>
      <p>Four weeks × office days per week gives return days. Return days × minutes ÷ 60 gives hours; return days × HKD gives travel cost. Time and money stay separate.</p>
      <p>Marked weekdays are an illustrative pattern, not a real schedule. Home-working days add no commute here; the job and pay stay fixed. No rent, household total or value for time is calculated.</p>
      <p>Actual fares, routes, queues, rent, eligibility and building occupancy are unknown.</p>
      <p>This notebook changes neither today’s outing money nor its clock. It makes no best-home recommendation.</p>
    </details>
  </section>;
}
