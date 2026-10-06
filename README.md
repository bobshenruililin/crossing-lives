# crossing-lives

**Between / 兩地之間** is the first interactive prototype of an individual-first Hong Kong–Shenzhen decision project: one evening, two possibilities.

It begins inside an original illustrated place. Short conversations and ordinary objects let an evening unfold; an optional practical comparison exposes the whole-outing arithmetic when wanted. Neither city is assigned an inherently better outcome.

## What is here

- A scene-led fictional Saturday with Jun, free observations, natural spoken choices and explicit travel/meal/walk commitments
- Dinner/shared-order choices, a disclosed optional delay, short/long walks or going straight home after dinner, and an ordinary home ending
- Editable departure, return deadline, budget, party size and personal weights
- Complete local and cross-border outings, including return travel and border closing margins
- Native-currency line items, per-person and group costs, explicit shared orders
- Rule-based explanations, with unknown data and unresolved eligibility kept visible
- Quiet local resume, with no collection, streak, recording or completion task in play; older notes remain preserved
- A separate research desk with published references, assumptions and honest business-research scaffolding
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
- `src/story/`: pure, guarded, replayable narrative state and derived journal
- `src/persistence/journal.ts`: versioned practical-plan storage, distinct from story storage
- `src/components/EvidenceDesk.tsx`: separate research workspace
- `tests/domain.test.ts`: money, timing, unknown data and preference edge cases
- `tests/story.test.ts`: idempotent commitments, explicit rewind, immutable alternate and safe decoding
- `tests/persistence.test.ts`: corrupt/blocked storage and last-valid-save protection
- `tests/browser/experience.spec.ts`: full interaction and responsive verification
- `scripts/export-portable.mjs`: self-contained artifact from the normal build

New cities and scenarios should add domain data and route/cost contracts before UI proliferation. A future AI layer should consume the same auditable engine and evidence records; it should never replace known constraints with invented facts.

See [architecture](docs/ARCHITECTURE.md), [creative decisions](docs/DECISIONS.md), the [short presenter path](docs/PRESENTER_PATH.md) and the [verification record](docs/VERIFICATION.md).

## Verification status

Known-green playable baseline `0e14f2f9529653bdcd85107190230f6c0f8acbd2` passed TypeScript, build/export, 74 unit tests and all 26 browser cases on their first attempt. This includes both city night scenes, Jun, complete journals and replay, navigation with blocked storage, rejected-save recovery and the portable file opened offline. Desktop and 360/390px screenshots were visually reviewed.

The first world-first commit `4199ead` ran in the browser: 27/34 cases passed, including both city flows, offline play and the actual 82-second recording. Three modal-focus failures and four ambiguous test locators require correction. Additional source/audience review prompted tablet-artwork, narrative-state and direct-return improvements. The next exact-commit run is still required; see the verification record rather than treating source checks as experience clearance. The intervening scene-and-sidebar candidate was superseded before publication. See the [verification record](docs/VERIFICATION.md) for commit-specific evidence.

## Publication

The project is designed for static hosting with relative assets. No hosting access setting, public deployment, repository visibility change or live AI integration is performed by its build scripts. CI verifies the build and produces reviewable artifacts; deployment is a separate decision.
