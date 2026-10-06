# Between · Architecture

An original, individual-first Hong Kong–Shenzhen outing decision journal. This GitHub-targeted application has no live AI, booking service, tracking, external runtime API, account, or private data dependency.

## Vertical slice

1. Illustrated introduction and a replayable six-beat fictional evening, with a fixed illustrative persona and meaningful branches.
2. Editable two-option planner: whole-outing cost, transport, border assumptions, experience time, home deadline and eligibility.
3. Explicit choice saved locally, replayable journey, return to editing.
4. Evidence workspace separates published facts, authored estimates, and a hypothetical fixed-pool allocation.

## Boundaries

- `src/domain`: typed fixtures and pure deterministic, independently tested comparison/allocation functions. Costs preserve original currency and shared/per-person scope. Missing values stay unknown.
- `src/components`: accessible UI and illustration composition.
- `src/App.tsx`: presentation modes, local versioned persistence, honest recovery paths.
- `public/art`: original illustrated settings, explicitly imaginary. The separate transport schematic carries route evidence.
- Business workspaces are a transparent scaffold for future sourced business evidence. No invented economic claims.

## Acceptance

Test budget/party/exchange/deadline/crossing/missing-data/math; exercise story/replay/edit/choose/reload; render 360px, 390px and desktop; keyboard/reduced-motion; local storage blocked or corrupt; public static build relative paths. No assertion of measured live queue, fare, restaurant price or guaranteed border eligibility.

## Playable-evening boundary

`src/story` derives time, bill and journal from immutable commitments plus phase. It never keeps independent mutable money/time counters and never confirms real entry eligibility. `src/domain` handles per-itinerary duration, optional shared orders, a labelled authored delay and explicit familiarity. Unknown familiarity is not a low score. The story does not render a composite winner. The practical planner and fictional story use separate versioned local saves; explicit copying to the planner retains an open entry check.

The research desk owns the fixed-pool allocation experiment. It is not part of a consumer saving calculation. Jun and all dialogue are authored fiction, with no generated chat or hidden emotion score.
