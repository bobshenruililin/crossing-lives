# crossing-lives

**Crossing Lives** explores everyday cross-border decisions through an original pixel world, complete outing comparisons and visible changes in circumstances. The current flagship asks how an evening changes when departure or home-by time changes. Neither city is assigned an inherently better outcome.

## Current direction: the decision-led prototype

The active prototype is a **separate entry at `/decision.html`**. A map, phone and menu open one compact view over the street. Both complete city outings use the same immutable input snapshot and time scale. The phone lets the person preview one departure or home-by change, apply or cancel it, then keep either full plan or explicitly try a shorter Shenzhen walk. Qualitative priorities and optional reasons are stated by the person; no city score or hidden repair is inferred.

The clock controls operate within one authored evening: departure 15:00–20:00, or home-by 20:00–01:00 next day, in 15-minute steps. Other inputs remain fixed for this episode. These are illustrative prices and journey assumptions, not a verified travel plan. This candidate also implements a small optional node journey after a completed Revised choice: free counter/station inspection, an explicit local departure or rail boarding, and one modelled arrival. Its actual browser, offline, motion and visual gate is pending. An optional friend invitation is staged after arrival: a separate before-departure what-if captures the exact chosen outing and previews two adults becoming three. Its source journey stays intact. Work routines, housing and regional explainers remain planned extensions.

Run `npm run dev:decision`, or `npm run export:decision` for the independent production/offline artifact. The earlier entry remains a verified fallback, and the new page does not read or replace its saved data. Revision `22d06c626f2333f091350cc94b0b3999f0550f54` verified the scene, fixed deadline change, priorities, replay and offline opening. **The adjustable Phone is verified at `ed162b58aff24b0adb7d028e1f3676b8aff9338d`: all 19 decision cases, offline opening, keyboard scrolling and the real comparison recording passed, with mobile frames visually reviewed.** The separate movement candidate still awaits its own rendered gate. Passing source tests does not establish audience understanding. See [the episode scope](docs/DECISION_PROTOTYPE.md).

The movement source keeps the exact selected snapshot and whole-outing forecast. It does not charge again, treat planned meals as money already spent, or relabel the Lo Wu route as the separate Futian pilot route. A small sprite, day/evening destination art and a separately recorded mobile path are included in its verification plan. See [the bounded journey and review gates](docs/NODE_JOURNEY_REVIEW.md) and [the optional friend episode and review gates](docs/FRIEND_INVITATION_REVIEW.md).

## Earlier complete prototype

The original `/` entry, also known as Between / 兩地之間, retains these tested capabilities while the new decision-led episodes develop:

- A scene-led fictional Saturday with Jun, free observations, natural spoken choices and explicit travel/meal/walk commitments
- Dinner/shared-order choices, a disclosed optional delay, short/long walks or going straight home after dinner, and an ordinary home ending
- Editable departure, return deadline, budget, party size and personal weights
- Complete local and cross-border outings, including an optional out-and-back phone schematic, return travel and border closing margins
- Native-currency line items, per-person and group costs, explicit shared orders
- Rule-based explanations, with unknown data and unresolved eligibility kept visible
- Quiet local resume, with no collection, streak, recording or completion task in play; older notes remain preserved
- An optional temporary demo in a fresh tab, using the same engine without reading or writing personal story/plan storage
- A separate research desk with published references, assumptions and honest business-research scaffolding
- Two sourced institutional examples separating customer membership benefits, worker decision rights and historical surplus claims
- An optional fixed-surplus allocation lab that conserves the same pool to the cent
- Original generated illustrations, self-hosted fonts, reduced-motion styling, keyboard dialogs and media/storage recovery

There is **no live AI service, booking integration, tracking or account system**. No private research or personal information is included.

## Run

Node 24 is the supported baseline.

```sh
npm ci
npm run dev
```

Vite binds to `127.0.0.1:4173`. Open that address on the same computer.

```sh
npm run check           # TypeScript, domain tests, production build
npm run test:native     # Domain tests with Node 24; no third-party runner required
npm run test:browser    # Playwright; run export:portable first for the offline test
npm run export:portable
```

For standard Playwright setup, install its Chromium browser using `npx playwright install chromium`. CI uses installed stable Chrome with `CROSSING_BROWSER_CHANNEL=chrome` and the sandbox enabled. To use an existing compatible Chromium, set `CROSSING_CHROMIUM_PATH` to its actual executable path. Browser sandboxing remains enabled.

The portable command embeds the exact production build, fonts and illustrations into `artifacts/crossing-lives-portable.html`. It can be privately shared as one file; it is not a deployment. Offline file-opening must be verified in a supported browser before calling it tested.

## Model boundaries

The demo's prices, exchange rate and journey durations are **illustrative**, not current quotes. Meal budgets, local-travel time, border buffers, FX and dinner/walking time are editable. Transit fares, drinks and optional shared-order prices are authored fixtures, visible in the bill/rubric and source. Familiarity comes only from explicit new/familiar/not-sure answers; no city is assigned an intrinsic novelty score. A requested but unknown familiarity component prevents a composite preference winner.

Budget is HKD per person. CNY is converted using the explicit HKD-per-CNY input. Only group-scoped costs are split. Monetary inputs use one decimal half-up cents policy; displayed per-person averages can differ from the group total by rounding.

Both cities use UTC+8. A home-by clock before departure means the following day. Clearance-hour fit is independent of the home deadline. A modelled margin is not a guaranteed last-safe crossing time or confirmation of the last train/bus. Everyone in the party must independently verify entry and return eligibility.

The allocation lab is a **separate fixed-pool thought experiment**. It does not treat consumer savings as a business surplus, and it does not claim cooperative ownership causes additional productivity or returns.

## Evidence

Published border hours and one rail-time reference were checked on **6 October 2026**:

- [Hong Kong Immigration Department — control points](https://www.immd.gov.hk/eng/contactus/control_points.html): Lo Wu 06:30–00:00, Lok Ma Chau Spur Line 06:30–22:30, separate Lok Ma Chau road crossing 24 hours.
- [Hong Kong Transport Department — Lo Wu access](https://www.td.gov.hk/en/transport_in_hong_kong/land_based_cross_boundary_transport/access_to_lo_wu_control_point/?print=1): approximately 45 minutes Admiralty–Lo Wu, station-to-station, excluding clearance and local travel.
- [MTR route and fare planner](https://www.mtr.com.hk/en/customer/jp/index.php): official lookup; this project does not claim a date-specific fare was verified.

The art is an imagined setting, not a geographic or transport map. See [asset provenance](public/art/README.md) and [third-party licenses](public/THIRD_PARTY_NOTICES.txt). Font and dependency notices are included in static and portable builds.

## Architecture and extension

- `src/domain/model.ts`: scenario contracts and explicit currency/unknown types
- `src/domain/data.ts`: authored scenario data, separate from logic
- `src/domain/engine.ts`: pure deterministic comparison and allocation logic
- `src/data/evidence.ts`: source-labelled claims and limitations
- `src/App.tsx`: application shell and practical planner
- `src/components/PlayableEvening.tsx`: scene interactions and the fictional evening
- `src/story/`: pure, guarded, replayable narrative state, authored branch-copy selection and engine-derived route forecasts
- `src/components/RouteNote.tsx`: optional phone schematic and progressive route details
- `src/persistence/journal.ts`: versioned practical-plan storage, distinct from story storage
- `src/runtime-mode.ts`: page-local temporary flag and context-free new-tab URL builder
- `src/components/EvidenceDesk.tsx`: separate research workspace
- `src/business/context.ts`: immutable, whitelisted whole-outing spending context; no business-cost inference
- `src/business/membership-evidence.ts`: dated institutional claims, source scope and explicit evidence limits
- `src/components/MembershipLens.tsx`: optional question-led evidence reading, independent of the outing and pool
- `tests/domain.test.ts`: money, timing, unknown data and preference edge cases
- `tests/story.test.ts`: idempotent commitments, explicit rewind, immutable alternate and safe decoding
- `tests/persistence.test.ts`: corrupt/blocked storage and last-valid-save protection
- `tests/browser/experience.spec.ts`: full interaction and responsive verification
- `scripts/export-portable.mjs`: self-contained artifact from the normal build

New cities and scenarios should add domain data and route/cost contracts before UI proliferation. A future AI layer should consume the same auditable engine and evidence records; it should never replace known constraints with invented facts.

See [architecture](docs/ARCHITECTURE.md), [creative decisions](docs/DECISIONS.md), the [short presenter path](docs/PRESENTER_PATH.md), [business case sources and limits](docs/BUSINESS_CASES.md), and the [verification record](docs/VERIFICATION.md).

## Verification status

Known-tested edition `553006a3f34a9916a0b5b3318c30d1e662f0238b` passed TypeScript, build/export, **138 unit/SSR tests and all 90 browser cases without retries**. The real temporary new-tab and offline-file paths passed with original-state preservation, active-document storage isolation and visible unsaved-mode identity. Every planner import still needs explicit replacement consent. Both same-assumption presenter paths were exercised through one complete evening and the worker-rights question.

See the [verification record](docs/VERIFICATION.md), [temporary-session boundary](docs/TEMPORARY_DEMO.md) and [coverage rationale](docs/TEST_COVERAGE.md). Actual temporary-mode screenshots at 360/390px were reviewed. Review is model-assisted visual/code inspection, not a human user study, a timed human presentation or full accessibility certification. Browser coverage is Chrome stable on Ubuntu with resized viewports; physical phones and Safari remain unverified.

A separate constrained production capture at `b26b11b` confirmed blank and progressively filled artwork during scene changes. The retained-artwork correction and a narrow portrait-staging guard were then verified at `4ab69eee5dd9e2f94b3d34ffd16080a036c56cac`, with 96 browser cases and a separate production capture. The retained artwork and pending-state frames were visually reviewed. Measured timings describe one instrumented, emulated profile, not real-phone performance; see the verification record.

## Publication

The project is designed for static hosting with relative assets. No hosting access setting, public deployment, repository visibility change or live AI integration is performed by its build scripts. CI verifies the build and produces reviewable artifacts; deployment is a separate decision.
