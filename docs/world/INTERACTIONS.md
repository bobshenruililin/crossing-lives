# World interactions

The 12 interaction IDs and shell contract are unchanged. The shell owns the dialog, title, focus, dismissal and per-interaction values. Its separate world thought does not repeat inside the open modal. `interactions/panel.tsx` owns the native radio choice, one SVG diagram, immediate outcome values and one short outcome sentence. Evidence and inputs stay in native collapsed details.

## Mechanisms

| Scene | Controlled change | Evidence boundary |
| --- | --- | --- |
| Hong Kong home | Accurate clock hands and shorter/later home-by window | Deadline only; no timed itinerary or service claim |
| Rail carriage | Train segment expands to full access/checks/rail/onward/return sequence | No time scale or measured durations |
| Border arrival | One gate unfolds into four separately unknown gates | No inferred entry permission or checked service |
| Parcel counter | Pickup detour expands to an extra outward/return trip | Invented common-unit logistics 16 → 116; time 20 → 160 minutes; original outing excluded |
| Food court | Tables, wayfinding and pickup counter become quick lunch, repeat board and delivery bike | Hypothetical frontage response, not measured demand |
| Neighborhood lane | Park moves into a recurring slot, displacing open time | No inferred belonging or measured opportunity cost |
| Urban village | Gate closes and path visibly detours around the block | Toy 6 → 14 minutes; no actual neighborhood classification |
| Rental home | Deposit cash stack becomes a return-claim envelope | HKD 6,000 rent / 12,000 deposit; fictional refundable terms |
| Ownership home | Exact payment split becomes known debt reduction plus unknown future asset value | HKD 8,000 interest / 4,000 principal; no exaggerated total-debt bar |
| Office floor | Observed corridor plus one room changes to entirely unknown lease lens | All leases stay unknown; no vacancy percentage |
| Learning center | Class start moves across a fixed arrival on one scale | Fictional adult: 18:00 finish, 45-minute journey, 18:45 arrival; 15 minutes late or 45 minutes early |
| Planning museum | Dashed proposed connection appears on an explicitly fictional network | Never presented as real HK/SZ geography or an operating service |

`PlanningDiagram` is an isolated export in `diagrams.tsx`, ready to replace with a separately verified geographic layer. It does not put real city pins onto fictional art.

## Numerical and state rules

- `content.ts` is the unchanged frozen public pack. SHA-256: `67f9201b86b2b80487920ca1d00cd7cf31235c2cecafc25e26f8c9ebe7269f98`.
- `sceneNumbers` recomputes arithmetic from the disclosed fixtures. Context is deliberately not an argument. Party, weekday and scenario cannot multiply figures, infer fares, or change eligibility.
- `changeChoice` validates the scene's choice and returns a new local value record without changing other keys or other scenes. There is no browser storage, network request, timer or legacy-state import.
- Mortgage bars encode allocation of one payment with exact widths 200:100. The asset view does not use before/after debt bars. Remaining debt is 2,396,000 internally; only the approved one or two key numbers are surfaced.
- Timetable coordinates derive from a single 2.4-units-per-minute scale. Finish x=36, arrival x=144, earlier class x=108 and later class x=252.
- Values are final immediately. Every numeric result has an adjacent visible 12px illustrative caption; money examples explicitly say they are not price quotes. Brief path/object motion only explains the visual change. Reduced motion disables all interaction animation and transitions.

## Controls and verification

Native radios have grouped names, associated labels and 44px label targets. Captions, sources and numerical labels are at least 12px. SVG text is 16 units; at the shell's 286px content width that is about 12.7 CSS px. Focus styles are explicit. The shell must include native details summaries and links in its dialog focus traversal.

Tests in `tests/world-interactions.test.ts` cover all 24 choices, geometry/paint class changes beyond text/metadata, native markup, default restoration, invalid values, exact arithmetic, all 30 party/day/scenario combinations, local value isolation, public source hosts, short thoughts, unknown gate/lease statuses, financial proportions and shared timetable scale.

Verified after implementation:

- Focused interaction tests: 34 passed.
- `npm test`: 231 passed, including the 34 interaction tests.
- `npm run typecheck`: passed.
- `npm run typecheck:world`: passed.

These are pure-model, source and server-rendered checks. They do not certify rendered accessibility, small-screen fitting, motion pacing, browser input or cold whole-world exploration. The separate browser pass owns those checks and recordings.
