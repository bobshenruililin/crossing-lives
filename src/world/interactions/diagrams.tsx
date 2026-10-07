import type { ReactNode } from 'react';
import type { SceneId } from '../types';
import { clockHands, clockMinute, formatClock, learningSchedule, mortgageAllocation, sceneNumbers } from './model';

function Frame({ label, kind, caption, children }: { label: string; kind: string; caption: string; children: ReactNode }) {
  return <figure className="wi-figure" data-mechanism={kind}>
    <svg className="wi-visual" viewBox="0 0 360 176" role="img" aria-label={label}><g>{children}</g></svg>
    <figcaption>{caption}</figcaption>
  </figure>;
}
function Icon({ x, y, kind = 'home' }: { x: number; y: number; kind?: string }) {
  return <g transform={`translate(${x} ${y})`} className="wi-icon" aria-hidden="true">
    {kind === 'person' ? <><rect x="-5" y="-15" width="10" height="10"/><path d="M-8-3H8V10H4V21H-2V10H-5V21H-11V1z"/></>
      : kind === 'train' ? <><rect x="-17" y="-15" width="34" height="34" rx="3"/><path d="M-11-9H11V1H-11z" className="wi-paper"/><path d="M-11 22H-5M5 22H11"/></>
      : kind === 'box' ? <><path d="M-16-11H16V15H-16z"/><path d="M-2-11H3V1H-2z" className="wi-paper"/></>
      : kind === 'tree' ? <><path d="M-18-7L0-25 18-7 12-7 23 7H-23L-12-7z"/><rect x="-4" y="7" width="8" height="15"/></>
      : kind === 'clock' ? <><circle r="18" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M0-11V0L9 5" fill="none" stroke="currentColor" strokeWidth="3"/></>
      : <><path d="M-20-2L0-20 20-2H15V20H-15V-2z"/><path d="M-3 7H5V20H-3z" className="wi-paper"/></>}
  </g>;
}
function Path({ d, active = true, dashed = false, className = '' }: { d: string; active?: boolean; dashed?: boolean; className?: string }) {
  return <path d={d} pathLength="1" fill="none" className={`${active ? 'wi-path is-active' : 'wi-path'} ${dashed ? 'is-dashed' : ''} ${className}`}/>;
}
function HomeClock({ choice }: { choice: string }) {
  const minute = clockMinute('hk-home', choice), hands = clockHands(minute), earlier = choice === 'earlier';
  const edge = earlier ? 268 : 333;
  return <Frame kind="clock-window" label={`Home by ${formatClock(minute)}. The earlier marker shortens the illustrative window. This does not time a journey.`} caption="Illustrative window · return travel belongs inside it">
    <circle cx="85" cy="80" r="59" className="wi-dial"/>
    {Array.from({ length: 12 }, (_, i) => <path key={i} d="M85 28V34" transform={`rotate(${i * 30} 85 80)`} className="wi-tick"/>)}
    <path d={`M85 80L${hands.hour.x} ${hands.hour.y}`} className="wi-hand wi-hour-hand"/>
    <path d={`M85 80L${hands.minute.x} ${hands.minute.y}`} className="wi-hand"/>
    <circle cx="85" cy="80" r="4"/>
    <path d="M172 106H334" className="wi-track"/>
    <rect x="172" y="88" width={edge - 172} height="35" className="wi-window"/>
    <path d={`M${edge} 69V137`} className="wi-marker"/>
    <Icon x={edge - 20} y={104} kind="person"/>
    <text x="169" y="157">Leave</text><text x={edge} y="52" textAnchor="end">Home by</text>
  </Frame>;
}
function JourneyStrip({ choice }: { choice: string }) {
  const whole = choice === 'whole';
  const labels = ['Home', 'Walk', 'Checks', 'Train', 'Onward', 'Visit', 'Return'];
  return <Frame kind="journey-strip" label={whole ? 'The whole journey includes home access, clearance, rail, onward connection, activity and return. Every duration is unmeasured.' : 'Only the train leg is highlighted. Other journey parts remain visible but outside this comparison.'} caption="Sequence only · no time scale or measured duration">
    <Path d="M24 86H336" active={false}/>
    <Path key={choice} d={whole ? 'M24 86H336' : 'M154 86H206'}/>
    {labels.map((label, i) => <g key={label} data-journey-part={label.toLowerCase()} data-included={whole || i === 3}>
      <circle cx={24 + i * 52} cy="86" r={whole || i === 3 ? 8 : 5} className={whole || i === 3 ? 'wi-selected-node' : 'wi-unselected-node'}/>
      <text x={24 + i * 52} y={i % 2 ? 138 : 46} textAnchor="middle">{label}</text>
      {(whole || i === 3) && <text x={24 + i * 52} y={i % 2 ? 116 : 71} textAnchor="middle" className="wi-unknown-mark">?</text>}
    </g>)}
  </Frame>;
}
function GateChain({ choice }: { choice: string }) {
  const whole = choice === 'whole-trip', labels = whole ? ['Crossing', 'Train', 'Onward', 'Entry'] : ['Crossing'];
  return <Frame kind="gate-chain" label={whole ? 'Crossing, train, onward connection and entry permission are separate gates. All four are still unverified.' : 'One crossing gate. Its status remains unverified.'} caption="Every ? needs a check · none means permission">
    {whole && <Path d="M45 90H315" active={false}/>}
    {labels.map((label, i) => { const x = whole ? 7 + i * 90 : 142; return <g key={label} data-gate={label.toLowerCase()} data-status="not-checked">
      <rect x={x} y="35" width="76" height="86" className="wi-gate"/>
      <path d={`M${x + 10} 105H${x + 66}`} className="wi-gate-line"/>
      <text x={x + 38} y="86" textAnchor="middle" className="wi-question">?</text>
      <text x={x + 38} y="151" textAnchor="middle">{label}</text>
    </g>; })}
  </Frame>;
}
function ParcelPath({ choice }: { choice: string }) {
  const dedicated = choice === 'dedicated-trip';
  return <Frame kind="parcel-path" label={dedicated ? 'A dedicated collection adds the outward and return journey to the same handling and pickup detour.' : 'A trip already being made stays faint. Only the additional pickup detour is highlighted.'} caption="Invented extra cost only · original outing excluded">
    <Icon x={42} y={82}/><Icon x={300} y={108} kind="box"/>
    <text x="42" y="132" textAnchor="middle">Home</text><text x="300" y="153" textAnchor="middle">Pickup</text>
    {!dedicated && <><Path d="M66 68H301" active={false}/><circle cx="302" cy="68" r="5" className="wi-unselected-node"/><text x="295" y="42" textAnchor="end">Existing trip</text></>}
    <Path key={choice} d={dedicated ? 'M67 68H114V25H324V84M300 131H117V99H69' : 'M192 68V107H278M278 130H225V69'}/>
    <Icon x={dedicated ? 181 : 194} y={dedicated ? 26 : 106} kind="person"/>
    <text x="142" y="166" textAnchor="middle">{dedicated ? 'Whole extra trip' : 'Extra detour'}</text>
  </Frame>;
}
function ShopFront({ choice }: { choice: string }) {
  const routine = choice === 'local-routine';
  return <Frame kind="catchment-response" label={routine ? 'A hypothetical routine-led frontage changes to a quick-lunch counter, repeat-visit board and nearby delivery bike.' : 'A hypothetical visitor-led frontage changes to shared tables, wayfinding arrows and a take-home collection counter.'} caption="Shop response is a hypothesis · demand unmeasured">
    <path d="M23 43H337V137H23z" className="wi-building"/><path d="M14 29H346V52H14z" className="wi-awning"/>
    {[0, 1, 2].map(i => <path key={i} d={`M${74 + i * 100} 30V52`} className="wi-tick"/>)}
    {routine ? <g key="routine" className="wi-object-change" data-frontage="routine">
      <Icon x={71} y={80} kind="clock"/><path d="M42 111H105V132M52 112V132" className="wi-gate-line"/>
      <rect x="151" y="68" width="54" height="56" className="wi-board"/>{[0, 1, 2].map(i => <path key={i} d={`M160 ${80 + i * 14}H196`} className="wi-tick"/>)}
      <g className="wi-bike"><circle cx="264" cy="116" r="13"/><circle cx="315" cy="116" r="13"/><path d="M264 116L279 88 300 116H264M300 116L306 88M299 86H316M273 87H286"/><rect x="270" y="70" width="25" height="16" className="wi-awning"/></g>
    </g> : <g key="visitors" className="wi-object-change" data-frontage="visitors">
      <path d="M50 91H99V97H50zM61 97V121M90 97V121M40 85V115H53M108 85V115H97" className="wi-furniture"/>
      <path d="M179 67V126M151 78H204L195 69M204 78L195 87M203 106H151L160 97M151 106L160 115" className="wi-sign"/>
      <path d="M254 102H321V127H254z" className="wi-rent"/><Icon x={274} y={87} kind="box"/><Icon x={304} y={87} kind="box"/>
    </g>}
    {(routine ? ['Quick lunch', 'Repeat visits', 'Delivery'] : ['Shared tables', 'Wayfinding', 'Take-home']).map((label, i) => <text key={label} x={77 + i * 105} y="162" textAnchor="middle">{label}</text>)}
  </Frame>;
}
function RoutineCalendar({ choice }: { choice: string }) {
  const recurring = choice === 'returning';
  return <Frame kind="routine-map" label={recurring ? 'The park is placed into a recurring weekly slot. That same slot is no longer open; belonging is not inferred.' : 'A single passing path links the park, shop and home. The calendar remains open.'} caption="An illustrative weekly slot · no measured time cost">
    <Icon x={36} y={59} kind="tree"/><Icon x={113} y={59}/><Path d="M18 101H134" active={!recurring}/>
    <text x="76" y="143" textAnchor="middle">{recurring ? 'Park again' : 'Passing by'}</text>
    <rect x="158" y="24" width="189" height="119" className="wi-calendar"/>
    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <g key={i}>
      <text x={173 + i * 26} y="50" textAnchor="middle">{day}</text>
      <rect x={163 + i * 26} y="63" width="20" height="60" className={recurring && i === 5 ? 'wi-selected-cell' : 'wi-calendar-cell'}/>
    </g>)}
    {recurring && <g key="park-slot" className="wi-object-change"><path d="M303 103V86M295 90L303 78 311 90z" className="wi-calendar-tree"/><path d="M287 147Q280 164 263 159M265 151L263 160 272 162" className="wi-sign"/></g>}
    <text x="249" y="170" textAnchor="middle">{recurring ? 'Open time becomes park time' : 'Time still open'}</text>
  </Frame>;
}
function AlleyDetour({ choice }: { choice: string }) {
  const closed = choice === 'closed', minutes = sceneNumbers('urban-village', choice)[0].value;
  return <Frame kind="access-detour" label={`Only the passage ${closed ? 'closes' : 'opens'}. The invented walk is ${minutes} minutes. Rent and legal status are unchanged.`} caption="Toy layout · route length is not geographic distance">
    <rect x="119" y="51" width="123" height="90" className="wi-building"/><Icon x={43} y={96}/><Icon x={313} y={96}/>
    <Path d="M64 96H292" active={!closed} dashed={closed}/>
    {closed && <Path key={choice} d="M64 96H89V23H273V96H292"/>}
    <path d="M165 77V115M197 77V115" className="wi-gate-line"/>
    {closed ? <path d="M166 80L196 111M196 80L166 111" className="wi-closed-gate"/> : <path d="M167 77L151 66M195 77L211 66" className="wi-gate-line"/>}
    <text x="43" y="152" textAnchor="middle">Home</text><text x="313" y="152" textAnchor="middle">Shop</text>
    <text x="180" y="171" textAnchor="middle">{closed ? 'Around the block' : 'Through the passage'}</text>
  </Frame>;
}
function RentClaims({ choice }: { choice: string }) {
  const claims = choice === 'claims';
  return <Frame kind="rental-cash" label={claims ? 'The same rent stack pays for use. The twice-as-large deposit stack becomes a return claim, subject to the fictional lease.' : 'Rent and deposit both leave available cash. The deposit stack is twice the rent stack.'} caption="Fictional HKD lease · deposit return subject to terms">
    <Icon x={39} y={100} kind={claims ? 'home' : 'box'}/><Path d="M64 100H99"/>
    <rect x="113" y="83" width="78" height="48" className="wi-rent" data-money-role="rent"/>
    <rect x="225" y="35" width="78" height="96" className={claims ? 'wi-claim' : 'wi-deposit'} data-money-role="deposit"/>
    {[99, 115].map(y => <path key={y} d={`M120 ${y}H184`} className="wi-stack-line"/>)}
    {[51, 67, 83, 99, 115].map(y => <path key={y} d={`M232 ${y}H296`} className="wi-stack-line"/>)}
    {claims && <g key="claim" className="wi-object-change"><path d="M215 73L264 105 313 73V140H215z" className="wi-envelope"/><path d="M215 73L264 105 313 73" className="wi-gate-line"/></g>}
    <text x="152" y="160" textAnchor="middle">{claims ? 'Use paid' : 'Rent'}</text><text x="264" y="160" textAnchor="middle">{claims ? 'Return claim' : 'Deposit'}</text>
  </Frame>;
}
function MortgagePayment({ choice }: { choice: string }) {
  const asset = choice === 'asset', allocation = mortgageAllocation();
  const totalWidth = 300, splitX = 30 + totalWidth * allocation.interestShare;
  return <Frame kind="ownership-payment" label={asset ? 'The known principal allocation reduces debt. Future home value and sale proceeds remain unknown. This diagram shows allocation of the payment, not a percentage change in total debt.' : 'The fictional payment divides in an exact two-to-one ratio: interest paid versus principal reducing debt.'} caption={asset ? 'Payment allocation only · total debt is not drawn to scale' : 'Fictional first payment · bar widths match its split'}>
    <text x="180" y="24" textAnchor="middle">{asset ? 'What does that principal buy?' : 'One payment'}</text>
    <rect x="30" y="40" width={totalWidth * allocation.interestShare} height="44" className={asset ? 'wi-spent' : 'wi-rent'} data-payment-part="interest"/>
    <rect x={splitX} y="40" width={totalWidth * allocation.principalShare} height="44" className="wi-deposit" data-payment-part="principal"/>
    {asset ? <>
      <path d="M280 88V111H235" className="wi-sign"/>
      <rect x="191" y="112" width="104" height="31" className="wi-debt-label"/><text x="243" y="133" textAnchor="middle">Less debt</text>
      <Icon x={94} y={124}/><text x="94" y="133" textAnchor="middle" className="wi-paper-text">?</text>
      <text x="95" y="167" textAnchor="middle">Future value?</text>
    </> : <><text x="130" y="121" textAnchor="middle">Interest</text><text x="280" y="121" textAnchor="middle">Principal</text><path d="M280 129V151" className="wi-sign"/><text x="280" y="172" textAnchor="middle">Less debt</text></>}
  </Frame>;
}
function OfficeCoverage({ choice }: { choice: string }) {
  const leases = choice === 'leases';
  return <Frame kind="floor-coverage" label={leases ? 'The physical floor stays the same, but the lease lens contains only unknown entries. No lease information is available.' : 'Only the public corridor and one visible room are observed. Every other room and all lease statuses remain unknown.'} caption={leases ? 'Lease register unavailable · ? means unknown' : 'Visible coverage only · ? means unobserved'}>
    <rect x="37" y="14" width="286" height="129" className="wi-floor-outline"/>
    <rect x="43" y="67" width="274" height="27" className={leases ? 'wi-unknown-room' : 'wi-observed-room'} data-floor-part="public-corridor" data-observed={!leases}/>
    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const observed = !leases && i === 0; return <g key={i} data-floor-part={`room-${i}`} data-observed={observed} data-lease-status="unknown">
      <rect x={44 + (i % 4) * 69} y={i < 4 ? 21 : 100} width="65" height="37" className={observed ? 'wi-observed-room' : 'wi-unknown-room'}/>
      <text x={76 + (i % 4) * 69} y={i < 4 ? 46 : 126} textAnchor="middle">{observed ? '—' : '?'}</text>
    </g>; })}
    <text x="180" y="86" textAnchor="middle">{leases ? '?' : 'Public corridor'}</text>
    <text x="180" y="168" textAnchor="middle">{leases ? 'Every lease remains unknown' : 'One room is visible'}</text>
  </Frame>;
}
function ClassTimetable({ choice }: { choice: string }) {
  const s = learningSchedule(choice), late = s.margin < 0;
  return <Frame kind="schedule-overlap" label={`Work ends at ${formatClock(s.finish)}, followed by 45 minutes of travel. Arrival stays at ${formatClock(s.arrival)}. Class starts at ${formatClock(s.classStart)}, ${late ? `making arrival ${-s.margin} minutes late` : `leaving ${s.margin} minutes before class`}. Every marker uses one time scale.`} caption="Same adult, journey and class · only the start moves">
    <path d={`M${s.finishX} 108H${s.endX}`} className="wi-track"/>
    <rect x={s.finishX} y="81" width={s.arrivalX - s.finishX} height="29" className="wi-travel"/>
    <rect x={Math.min(s.classX, s.arrivalX)} y="116" width={Math.abs(s.classX - s.arrivalX)} height="12" className={late ? 'wi-late-gap' : 'wi-time-gap'} data-schedule-part="margin"/>
    <path d={`M${s.arrivalX} 62V138`} className="wi-marker" data-schedule-marker="arrival"/>
    <path d={`M${s.classX} 30V139`} className="wi-class-marker" data-schedule-marker="class"/>
    <path d={`M${s.classX} 35H${s.classX + 26}`} className="wi-class-marker"/>
    <Icon x={s.arrivalX} y={86} kind="person"/>
    <text x={s.arrivalX} y="56" textAnchor="middle">Arrive</text><text x={s.classX} y="22" textAnchor="middle">Class starts</text>
    <text x={s.finishX} y="159" textAnchor="middle">18:00</text><text x={s.hourX} y="159" textAnchor="middle">19:00</text><text x={s.endX} y="159" textAnchor="middle">20:00</text>
  </Frame>;
}
/** Replaceable presentation boundary: never overlays real place pins on fictional art. */
export function PlanningDiagram({ choice }: { choice: string }) {
  const proposed = choice === 'planned';
  return <Frame kind="city-layers" label={proposed ? 'A proposed connection appears as a dashed line on a fictional network. It is not represented as operating today, and travel times remain unknown.' : 'Solid connections on a fictional network. This is not a geographic map of Hong Kong or Shenzhen.'} caption="Illustrative network · not Hong Kong or Shenzhen geography">
    <Path d="M47 100L158 39 307 91 191 126 47 100"/>
    {proposed && <Path key={choice} d="M47 100Q169 -7 307 91" dashed className="wi-proposed-link"/>}
    {[[47, 100, 'Homes'], [158, 39, 'Work'], [307, 91, 'Services'], [191, 126, 'Public space']].map(([x, y, label]) => <g key={label}>
      <circle cx={x} cy={y} r="8" className={proposed && label !== 'Public space' && label !== 'Work' ? 'wi-proposed-node' : 'wi-selected-node'}/>
      <text x={x} y={Number(y) + 29} textAnchor="middle">{label}</text>
    </g>)}
    {proposed && <text x="266" y="31" textAnchor="middle">Proposed</text>}
  </Frame>;
}
export function WorldDiagram({ scene, choice }: { scene: SceneId; choice: string }) {
  switch (scene) {
    case 'hk-home': return <HomeClock choice={choice}/>;
    case 'metro-carriage': return <JourneyStrip choice={choice}/>;
    case 'border-arrival': return <GateChain choice={choice}/>;
    case 'parcel-counter': return <ParcelPath choice={choice}/>;
    case 'mall-foodcourt': return <ShopFront choice={choice}/>;
    case 'neighborhood-lane': return <RoutineCalendar choice={choice}/>;
    case 'urban-village': return <AlleyDetour choice={choice}/>;
    case 'rental-home': return <RentClaims choice={choice}/>;
    case 'luxury-home': return <MortgagePayment choice={choice}/>;
    case 'office-floor': return <OfficeCoverage choice={choice}/>;
    case 'learning-center': return <ClassTimetable choice={choice}/>;
    case 'planning-museum': return <PlanningDiagram choice={choice}/>;
  }
}
