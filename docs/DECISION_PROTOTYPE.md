# One evening, reconsidered

This separate prototype restores the project's primary operation: compare two complete evenings under matched circumstances, change one requirement, and inspect why a decision changes or stays the same. It is an authored evening with one player-controlled time change, not a verified real-trip plan.

The original experience remains a separate fallback. The new entry imports no legacy App, personal journal or story-storage initialization. Its state exists only in the current page; reload starts a fresh example. No earlier story, planner, note or preference is loaded or overwritten.

## First controlled comparison

Both cities use the same starting snapshot: two adults from Kowloon at 17:00, HK$400 per person, home by 23:30, a 90-minute dinner with shared order, a 45-minute walk, no fictional delay, and FX 1.09 HKD/CNY. Rail via Lo Wu is the Shenzhen route. Entry eligibility, real transport service, actual queues and personal familiarity remain unresolved. Food/company/comfort/exploration are separately declared priorities, never automatic city scores.

The existing `compareOutings` engine gives these **authored fixture results**:

| View | Hong Kong | Shenzhen |
|---|---|---|
| Before: home by 23:30 | HK$336/person; home 19:45 | HK$291.83/person; home 22:45 |
| Changed: home by 22:30 only | Same bill and return; still inside modeled deadline | Same bill and return; 15 minutes after deadline |
| Revised: shorten only the Shenzhen walk to 15 minutes | Unchanged full local plan | Same bill; home 22:15, with 30 fewer walking minutes |

The person can also keep either complete city plan. The prototype does not force a city change or a shorter walk. The earlier deadline changes no price, route, dinner or walking time until the person explicitly chooses a revision. Fifteen minutes of modeled slack is not a confidence interval or a return guarantee.

## The adjustable Phone

After a tentative city choice, select either departure or home-by. One native clock selector and 15-minute earlier/later buttons preview that field only. Apply commits the displayed comparison; Cancel restores the untouched starting snapshot. A preview does not enter history. The other time, prices, party, route and activity durations stay fixed until an explicit walk revision.

- Departure window: 15:00–20:00 on the same day.
- Home-by window: 20:00–01:00, with after-midnight values explicitly labeled next day.
- Common axis: 15:00–02:00 next day, fixed for every preview and replay.
- One circumstance per attempt; start the example again to try another.

An authored 16:30 departure gets the full Hong Kong outing home at 19:15 and full Shenzhen outing home at 22:15, with both bills unchanged. Keeping full Shenzhen retains its 45-minute walk. At 19:00 departure, the full Shenzhen plan gets home at 00:45 next day and its modeled return clearance ends 23:55. That misses the chosen 15-minute closing buffer, even though it is before the normal published midnight closure. It must not be described simply as “border closed.” Shortening the walk is optional and can leave a different constraint unsolved.

Explicit priorities never change these calculations. If someone selected exploration, the view may factually connect that selection to giving up 30 walking minutes; it cannot infer that they must choose a city or convert the preference into points. The optional reason field appears only after an actual choice.

## Implementation boundary

- `src/decision/session.ts` is a thin immutable controller around `compareOutings`; it does not use the asymmetric story selector.
- One captured fixture/version is used for every snapshot and preview. Unknown costs remain null rather than becoming an incomplete saving.
- Before, changed and revised snapshots are independent. Historical choices/reasons and the original priorities are not rewritten by replay.
- An explicit reason is shown as the user's selection, never narrated as an inferred thought.
- The two-city time axis stays fixed through the deadline change and replay.
- The original pixel-inspired street is a semantic setting, not geographic routing evidence. All important text and route controls are HTML/SVG.

Other origin/budget/party editing, arbitrary dates, missing required-duration handling and broader daily-life scenarios are later work. The existing practical planner has more numeric inputs, but its required travel durations are authored numbers. This prototype does not hide that limitation behind a real-planning claim.

The larger research path remains everyday choices → flows of time, money and effort → business models/work/commuting → housing/rent/ownership/wealth → participation and distribution. Each layer needs its own appropriate evidence. A dinner-price difference does not establish company profit, wages, housing causality or household wealth. The independent business evidence and fixed-surplus workspace remain distinct from this first comparison slice.

## Run and package

Use `npm run dev:decision`, then open `/decision.html` on the existing 4173 local development server. For the separate production build, use `npm run export:decision`; it writes `artifacts/crossing-lives-decision-prototype.html` with the actual bundled module, fonts, approved image and notices embedded.

`npm run test:decision` uses the separate production preview on port 4175 and the existing sandboxed Chrome conventions. No public hosting or deployment is included. The export must pass its actual offline file-opening test before it is described as verified.

## Acceptance and present status

The person should be able to identify which input changed, which numbers did not, what a revision gives up, what remains unknown, and why their choice changed or stayed the same. An attractive scene alone does not meet that goal.

The first decision entry was rendered at commit `cccb130ce2c6d95f8c714e85df3dfdeeba8f4640`. Thirteen functional/browser cases passed, including matched inputs, replay, mobile geometry, storage isolation and opening the portable file offline. Its separate walkthrough failed before interaction because tracing was started twice; that recorder lifecycle has a narrow repair. These results do not establish that the experience is engaging or understood by a person.

The actual desktop and mobile captures failed the creative review: the illustration read as a website banner, while the decisive interaction became a long planning form. The first candidate is preserved as a working comparison-model proof, not an accepted experience milestone.

The next presentation pass keeps the matched model and changes how the person meets it: a full-height street, one attended object, and one compact scene overlay. The map holds both complete outings on the same clock. An optional priority question is available before a tentative choice. The phone exposes one time change; a deadline edit moves its marker while a departure edit shifts both journeys together. Full-plan choices and the explicit walking trade-off remain beside the consequence. Bills, history and sources are available on request. The current deadline and per-person budget must remain visible, including before anything changes.

The scene revision `2f426eb66f764515f5acaf9f1ecae7c606dcc532` passed its 15 decision browser cases and completed a 55-second real interaction recording. The reviewed desktop/mobile frames keep the city visible and place the changing deadline beside both complete outing tracks; this meets the basic spatial direction. This is visual review, not a claim that real users understand or enjoy it.

Revision `22d06c626f2333f091350cc94b0b3999f0550f54` corrected the crowded mobile tick labels and desktop replay-caveat clipping. Its 15 decision cases, real recording and offline check passed; actual 360/390px priority views and replay frames were reviewed. No real-user understanding claim is made.

The first adjustable-Phone run at `05b21d9dc280148c2ca5765157381f1582f0f839` exercised the four new clock cases and the actual recording successfully. Six older decision paths stopped before the phone because they still used its previous accessible name; 13 of 19 decision cases passed. The unchanged 96-case legacy suite and production capture passed. Actual mobile review also found the final assumptions line beneath the tools footer in a longer changed state. The narrow repair updates those exact test names and gives the sheet explicit header, bounded scroll body and reserved action/caveat footer rows. Its complete decision, offline and visual gate is pending; the broader episodes remain planned.



### Browser coverage after the scene recomposition

The previous 14 behavioral cases keep their exact matched inputs, bills, full routes, unchanged deadline-only facts, cancelable revision, explicit sacrifice, replay, priorities/reasons, source caveats, storage and offline assertions. Page-scroll and disclosure selectors have been replaced because the planning page no longer exists; those checks now use the actual object and sheet controls. One additional case follows the complete path with real mobile taps.

The presentation checks require both costs/home times, both route tracks, the current deadline and primary actions to be visible together. They measure the decoded image plane exposed outside the active sheet, rather than treating a tall wrapper as visible artwork. The deadline check retains the same track nodes and geometry while the marker moves. Keyboard return focus and actual reduced-motion transition durations remain checked. Detailed source facts may scroll inside their own inspection view. These source assertions still require an actual browser run; they do not establish that someone understands or enjoys the experience.
