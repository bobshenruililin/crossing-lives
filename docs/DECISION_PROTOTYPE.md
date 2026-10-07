# One evening, reconsidered

This separate prototype restores the project's primary operation: compare two complete evenings under matched circumstances, change one requirement, and inspect why a decision changes or stays the same. It is a fixed authored example, not a verified real-trip plan.

The original experience remains a separate fallback. The new entry imports no legacy App, personal journal or story-storage initialization. Its state exists only in the current page; reload starts a fresh example. No earlier story, planner, note or preference is loaded or overwritten.

## First controlled comparison

Both cities use the same starting snapshot: two adults from Kowloon at 17:00, HK$400 per person, home by 23:30, a 90-minute dinner with shared order, a 45-minute walk, no fictional delay, and FX 1.09 HKD/CNY. Rail via Lo Wu is the Shenzhen route. Entry eligibility, real transport service, actual queues and personal familiarity remain unresolved. Food/company/comfort/exploration are separately declared priorities, never automatic city scores.

The existing `compareOutings` engine gives these **authored fixture results**:

| View | Hong Kong | Shenzhen |
|---|---|---|
| Before: home by 23:30 | HK$336/person; home 19:45 | HK$291.83/person; home 22:45 |
| Changed: home by 22:30 only | Same bill and return; still inside modeled deadline | Same bill and return; 15 minutes after deadline |
| Revised: shorten only the Shenzhen walk to 15 minutes | Unchanged full local plan | Same bill; home 22:15, with 30 fewer walking minutes |

Keeping the complete Hong Kong plan is the other explicit revision. The prototype does not force someone to change cities. The earlier deadline changes no price, route, dinner or walking time until the person explicitly chooses a revision. Fifteen minutes of modeled slack is not a confidence interval or a return guarantee.

## Implementation boundary

- `src/decision/session.ts` is a thin immutable controller around `compareOutings`; it does not use the asymmetric story selector.
- One captured fixture/version is used for every snapshot and preview. Unknown costs remain null rather than becoming an incomplete saving.
- Before, changed and revised snapshots are independent. Historical choices/reasons and the original priorities are not rewritten by replay.
- An explicit reason is shown as the user's selection, never narrated as an inferred thought.
- The two-city time axis stays fixed through the deadline change and replay.
- The original pixel-inspired street is a semantic setting, not geographic routing evidence. All important text and route controls are HTML/SVG.

Arbitrary origin/budget/party/time editing, missing required-duration handling and broader daily-life scenarios are later work. The existing practical planner has more numeric inputs, but its required travel durations are authored numbers. This prototype does not hide that limitation behind a real-planning claim.

The larger research path remains everyday choices → flows of time, money and effort → business models/work/commuting → housing/rent/ownership/wealth → participation and distribution. Each layer needs its own appropriate evidence. A dinner-price difference does not establish company profit, wages, housing causality or household wealth. The independent business evidence and fixed-surplus workspace remain distinct from this first comparison slice.

## Run and package

Use `npm run dev:decision`, then open `/decision.html` on the existing 4173 local development server. For the separate production build, use `npm run export:decision`; it writes `artifacts/crossing-lives-decision-prototype.html` with the actual bundled module, fonts, approved image and notices embedded.

`npm run test:decision` uses the separate production preview on port 4175 and the existing sandboxed Chrome conventions. No public hosting or deployment is included. The export must pass its actual offline file-opening test before it is described as verified.

## Acceptance and present status

The person should be able to identify which input changed, which numbers did not, what a revision gives up, what remains unknown, and why their choice changed or stayed the same. An attractive scene alone does not meet that goal.

Current state: implementation and source tests are in progress. The new UI, interactions and portable artifact have not yet received their exact-commit browser or visual review. Old-experience verification is not evidence that this new thinking sequence works. The first real captures must be judged alongside mathematical and accessibility checks.
