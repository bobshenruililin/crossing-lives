# Consequential world choices

The home, parcel and rental interactions replace earlier explanatory toggles with visible trade-offs. The office notebook adds a recurring-life comparison with the Hong Kong job held fixed. They use the world’s existing per-interaction values and dismissal contract. The source game, artwork, independent regional geography, navigation and prior saved-data boundaries remain separate.

## Home: keep the crossing, reconsider the visits

The fictional Hong Kong–Shenzhen day begins at 11:00. It reserves an invented 360 minutes for the round trip: travel, clearance, local connections and getting home. This is not a measured Futian route, border guarantee or live clock. Lunch takes 90 minutes, the neighborhood walk 150 and the exhibition 120, giving an example finish at 23:00.

Changing home-by 23:30 to 22:30 changes only the deadline: the same full day becomes 30 minutes late. The person explicitly keeps, shortens or leaves out one visit. Short alternatives are 60 minutes for lunch, 90 for the walk and 60 for the exhibition. The visible strip keeps the crossing allowance unchanged while the selected visit segment contracts. No automatic repair or inferred priority occurs.

Take this plan commits the local draft. Its map summary retains the same activity choices, finish, margin and assumed cross-border round trip. All places remain open; the plan is an intention, not an elapsed-play clock or mandatory checklist. Cancel, Escape and Close discard an uncommitted draft.

## Parcel: a detour or a dedicated trip

This is a separate fictional logistics comparison, outside the day plan. Already-going collection is 6 handling + 10 local transport = 16 CNY-equivalent and 20 additional minutes. A dedicated trip adds 100 and 140 minutes, producing 116 and 160. Home delivery is an invented 35 CNY-equivalent quote; delivery duration and personal waiting time remain unknown.

Choose the context, preview collection or delivery, then explicitly Use collection or Use delivery. Options returns to the labelled collection/delivery picker while preserving the preview; Back returns from that picker to the trip context. Cancel discards an uncommitted draft. A quote does not imply arrival time, item eligibility, refund terms, operator profit or a real currency conversion.

## Rental: cash available now and rent later

The same fictional room and 12-month term have two authored HKD offers. Starting cash is 24,000; other move-in charges are assumed zero. Lower monthly rent pays 6,000 and holds 12,000 as a deposit, leaving 6,000 liquid cash. Less cash tied up pays 7,500 and holds 7,500, leaving 9,000 liquid cash with higher recurring rent. Neither option dominates both cash now and rent later.

Selecting a paper contract previews proportional rent/deposit/liquid stacks and exactly two headline figures. A compact comparison against the other offer makes both dimensions explicit: the less-upfront offer leaves 3,000 HKD more cash now and costs 1,500 HKD more per month. The inverse comparison appears for the lower-rent offer; both differences are computed from the same snapshots. The deposit is held and not spendable; any return remains conditional, with amount and timing unknown. Choose lease commits the in-tab example, not a real tenancy. This comparison never charges the day plan or a shared wallet.

## Office: same job, two home bases

The separate authored workweek comparison concerns one adult and the same Hong Kong job/pay, regardless of the scene's selected cast. Two or four office days over a fixed four-week window means eight or sixteen return commutes. Illustrative daily return allowances are 90 minutes/40 HKD from the Hong Kong home and 210 minutes/100 HKD from the Shenzhen home. This yields 12/28 hours and 320/800 HKD at two days; 24/56 hours and 640/1,600 HKD at four days. Money and time remain separate measures.

The calendar marks return days and both home bars share one fixed scale per measure. Changing days repeats the same assumptions; it cannot choose a home or erase border friction. All prices and timings are invented. Rent, actual routes, fares, eligibility and observed-building occupancy remain unknown. These notebook choices stay in-tab and never charge the day plan. See [the office scope and checks](OFFICE_WORKWEEK_REBUILD.md).

## Integration and compact presentation

The hook-free interaction wrapper selects HomeDecision, ParcelDecision or RentalDecision for the three scene IDs. WorldApp adds only the read-only PlanSummary and a compact class for the parcel/rental sheets. The fixed 44 px title/Close row stays outside the scrolling content. Duplicate room kickers are omitted for these panels.

Parcel and rental show one choice step or one selected consequence at a time. Evidence starts closed. Their actual phone sheet sizes depend on the prop: around 248 px and 284 px respectively at 390×844 in the current geometry. Primary result, unit, caveat and commit controls must fit the real viewport and overflow clip before any automatic scrolling; source estimates do not certify that fit. The new header and compact body padding together consume about 68 px.

Each explicit commit copies only scoped scalar choices and preserves unrelated keys. No panel accesses persistence, network data, party-derived prices or the older story/outing engine. Day, party and scenario never infer capabilities, eligibility, fares or preferences.

## Verification status

The preceding 062214d edition passed all 16 world browser cases and retained checks, with a complete untrimmed desktop tour and reviewed consequence frames. The next assembled candidate adds the bounded office and cast changes alongside choice clarity. Its source/type/build checks are recorded with the release manifest; those checks do not establish rendered fit. The pure numerical model remains unchanged. Its own browser execution, compact delta fit and revised recording are still pending.

The browser gates use actual controls for preview, commit, cancellation, revisits, later map footprint, cash/clock geometry, touch, reduced motion, sources and old-storage canaries. The other scene mechanisms and physical traversal remain covered. The standalone/offline route and full cold recording use every scene. The approved recording design is an untrimmed 5–8-minute tour, with exact duration, actions and failures preserved. This is scripted browser evidence and model-assisted review, not a human user study.
