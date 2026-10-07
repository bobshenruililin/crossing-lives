# Optional friend invitation: isolated review candidate

This candidate adds one quiet phone invitation after the existing arrival: “Can I join next time? I’ll meet you before you leave.” It is a new planning example for another evening, before departure from the same Hong Kong origin. It is not a mid-trip pickup, extension of a journey clock, booking or payment.

## One controlled change

The episode captures the source decision’s current stage, even if the person was viewing an older comparison. Departure, home-by, origin, route, meal/walk durations, authored prices, FX and budget remain exact. This includes an explicitly shortened Shenzhen walk. The only changed input is party size, two adults to three.

Each adult still has a meal, drinks and complete round-trip transport. Each city retains exactly ONE group-scoped shared extra at quantity one and the same price. This is not a serving-capacity claim. Whole-group spending can rise while the rounded per-person average falls. The average is not an exact three-way payment allocation. Missing prices remain unknown; neither costs nor times claim to be live forecasts. Eligibility and actual services remain unknown for every adult.

The default derived totals are:

| City | Two-adult group | Two-adult average | Three-adult group | Three-adult average |
| --- | ---: | ---: | ---: | ---: |
| Hong Kong | HKD 672.00 | HKD 336.00 | HKD 976.00 | HKD 325.33 |
| Shenzhen | HKD 583.66 | HKD 291.83 | HKD 843.88 | HKD 281.29 |

These figures come from the engine snapshots and line items. They are not constants in the presentation.

## Interaction and state ownership

- The original arrival keeps its original Phone, Map, Menu and replay controls. A separate “A message about next time” entry opens the invitation.
- Preview is pure. Cancel restores the two-adult invitation; no clock, bill or source choice needs to be rolled back.
- “Plan with three adults” commits the new comparison once. It does not select either city.
- Either explicit city choice finishes the new decision immediately. Keeping the earlier city is valid. No typed reason, priority or checkbox is required.
- “What matters this time?” is optional reflection. Earlier reasons/priorities remain historical; empty values visibly say no reason stated and priorities not reconfirmed. Explicitly supplied new words are never inferred or copied.
- The same absolute time tracks, return facts, full party bills, quantities, native currencies, FX and exact inputs remain inspectable. Known lateness and crossing-window/buffer failures stay visible directly above the preview and city-choice actions; an extra adult never repairs them.
- “Return to the current arrival” restores the exact source scene and focuses its invitation. Reopening preserves the new episode’s comparison, choice, optional reflection and replay state within the tab.
- The source and new episode remain mounted with mutually exclusive hidden/inert roots. Distinct DOM ID prefixes prevent hidden duplicate-label/focus targets. Hidden surfaces preserve their last measured geometry.
- The original example’s explicit reset clears both in-tab attempts. There is no new persistence or storage behavior.

`friendJoining.ts` and its thirteen tests are copied unchanged from the separately audited model. The presentation owns only optional surface state, draft reflection and art readiness. Neither the domain engine, original decision session, journey reducer, persistence modules nor legacy application changes. The combined candidate also includes the separately reviewed shared-plane arrival-marker repair described in NODE_JOURNEY_REVIEW.md.

`DecisionPresentation.tsx` is a bounded extraction of the original street and comparison. Default markup was compared directly against the source for baseline, changed departure and shortened-walk snapshots, plus normal/fallback street renderings. It matches apart from additive group-total data attributes; its geometry formulas, default labels and timeline behavior are preserved. The optional decoration shares the same source-image transform.

## Artwork and scope

The existing original Hong Kong street, Shenzhen day/evening art and player remain. One approved anonymous teal-clad side/back adult appears beside the existing counter pair while previewing/planning three. It is a small scene presence, with an ordinary schematic party indicator and image-failure fallback. See `public-decision/art/FRIEND-ASSET.md` for public-safe provenance. There are no new portraits, relationship biographies, field-trip POIs or real-person dialogue.

The friend artwork’s original pixels and faint fringe are preserved. Scene-scale placement, occlusion and edge appearance require the actual viewport/film gate below. No private research documents or field notes are part of the public deliverable.

## Verification gates

Source checks completed during implementation: TypeScript, all 189 existing-plus-model tests, both production builds and self-contained decision export. All original 27 browser behaviors remain retained. The separately reviewed arrival-marker repair updates two existing specs and adds a shared projection helper; thirteen additive cases cover friend flows, for forty decision cases total. Source checks and test enumeration are not rendered proof.

Actual browser execution must run in the permitted private Chrome stable CI job with sandboxing enabled. It must verify:

1. Genuine 390px touch and 1440px Tab/Enter paths through invitation, cancel, commit, explicit city choice, optional reflection, replay and return.
2. Both original and new state, bill, time, focus and scene-node identity after repeated navigation, including source historical replay and the earlier-departure/short-walk variants.
3. Exact group and average totals, all meal/fare quantities, one unchanged shared extra per city, unchanged time tracks and visible unknown eligibility/services. A real-control 19:00 source path retains its 75-minute lateness and crossing-buffer failure visibly before both new commitments.
4. Empty reflection remains a complete choice; historical reasons/priorities do not silently become new values. A new city choice does not inherit the previous new reason.
5. Source/episode controls stay out of the tab and accessibility trees while hidden; IDs remain unique; serious/critical accessibility findings are not suppressed.
6. Real screenshots at 360, 390 and 1440px, reduced motion, failed artwork, native offline file opening with network disabled, and zero personal-storage calls.
7. A cold, paced phone-invitation film through real UI actions, with no state injection, art prewarming or nested tracing session. The test runner owns tracing.

No browser result, visual acceptance, publishing, deployment or audience-understanding claim is made by this candidate. The completed CI evidence and at-scale artwork review must be recorded separately.
