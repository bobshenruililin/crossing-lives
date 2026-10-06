# Between · Architecture

An original, individual-first Hong Kong–Shenzhen interactive evening and practical comparison. This GitHub-targeted application has no live AI, booking service, tracking, external runtime API, account, or private data dependency.

## Vertical slice

1. A world-led fictional evening, with one adult companion, free observations and meaningful commitments.
2. Editable two-option planner: whole-outing cost, transport, border assumptions, experience time, home deadline and eligibility.
3. Quiet optional local resume, explicit reconsideration and an ordinary home ending. Older saved notes remain compatible but are not a task in play.
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

`src/story` derives time, bill and retained legacy journal data from immutable commitments plus phase. It never keeps independent mutable money/time counters and never confirms real entry eligibility. `src/domain` handles per-itinerary duration, optional shared orders, a labelled authored delay and explicit familiarity. Unknown familiarity is not a low score. The story does not render a composite winner. The practical planner and fictional story use separate versioned local saves; explicit copying to the planner retains an open entry check.

The research desk owns the fixed-pool allocation experiment. It is not part of a consumer saving calculation. Jun and all dialogue are authored fiction, with no generated chat or hidden emotion score.


## Route presentation

`src/story/route-view.ts` is a pure presentation selector over the same story/domain engine. Before meal commitment it composes departure and simple-dinner previews, including the disclosed future delay, then labels the walk and meal as conditional. It retains the actual progress clock separately. It never dispatches actions or owns a second timing formula.

`RouteNote` renders one schematic out-and-back journey in the existing native phone dialogue. Its mutually exclusive folds are transient React state, not saved story progress. Route changes are accepted only at the fork; later changes use the same explicit rewind and legacy-data protection as other reconsiderations. The host owns modal focus, Back navigation and attended-object framing.


## Authored character copy

`src/story/dialogue.ts` selects a few fixed fictional lines from the existing city, meal, walk and phase. It is pure and adds no persisted fields, inferred player familiarity, emotional score or chat backend. Legacy notes are not inputs to the returned text. The home phone note is transient presentation; the real completed route and its evidence still use the existing route-view selector.
