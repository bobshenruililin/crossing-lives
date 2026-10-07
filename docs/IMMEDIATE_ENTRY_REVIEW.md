# Immediate street entry and single-commit boarding

This isolated candidate starts on the pixel street with the small existing player at the counter. The comparison sheet is closed, no city is selected, and Counter / Station entrance buttons and left/right arrow keys work immediately. The station asks about dinner, walking and getting home; the map is a contextual comparison, not a required movement wizard. The departure clock, home-by deadline and per-person budget remain visible. No new art, scoring or engine is introduced.

## State boundary

- Free exploration is a node in the presentation. It does not capture a journey, advance time, select a city or change the comparison.
- `selectedDeparturePlan` reads the current stage, ignoring historical display. Only an explicitly selected baseline or revised plan may depart. Changed circumstances need an explicit revised choice.
- `depart-selected` atomically captures the exact existing snapshot, selected option, source session, explicit reasons and priorities. It rejects a preview, wrong node, missing choice or repeated commitment. Baseline departure requires no invented time change.
- An open clock/walk preview survives putting down its sheet. The street allows movement and offers **Finish the preview**; boarding is unavailable until Apply/Cancel resolves it. Preview values are never silently adopted.
- After departure, session controls allow only inspection and explicit reset. Map, Phone, bill, priorities and reason are read-only. Deliberate detail links within historical inspection preserve that history. After departure, physical/named world objects always restore the captured comparison; before departure, objects preserve an open historical sheet and a fresh world opening restores the current comparison. Neither changes the physical trip.
- The optional friend episode captures the journey's source session, including an unchanged baseline if that was the departure choice. It remains a separate planning what-if.

## Boarding and geometry

Board / Head to local dinner is the single commitment. The street and player remain beneath a compact outward route/time cue. Decoded arrival art advances automatically, without Continue, a minimum delay, ticking clock or simulated live service. A pending image offers a schematic arrival; failure or the existing eight-second readiness limit settles a truthful fallback. A late image cannot replace an already settled fallback. Optional route inspection remains available while waiting. A deliberately opened inspection stays open; ready arrival waits until the player closes it. The outward route’s Back action returns directly to the world, then ready art advances without another commitment.

Arrival uses the existing direct framing cut: art, player, place and clock switch together. Node walking alone pans the scene; initial and inspection framing are immediate. All objects keep their source-image anchors. Complete 44 px object targets must fit the scene crop and stay clear of the sheet/dialogue; named Objects controls retain access when physical targets cannot fit. Physical node targets also use their complete target bounds. Closing a sheet restores visible object focus, or the world heading/arrival button when the object is cropped.

## Verification and entry-path changes

The old initial-map assumption is removed from browser helpers. Existing comparison tests now explicitly open Objects → Open map, preserving all exact money, timing, unknown, history and explicit-reason assertions. Explore the chosen evening and Continue to arrival were removed because those actions no longer exist. Tests use visible controls and attach the first-arrival frame probe before Board so fast ready-art arrival cannot be missed.

Additional browser evidence covers the first five seconds, keyboard and touch movement, HK/SZ baseline departures, preview blocking, immutable captured inspection, predeparture history, slow/failed art, reduced motion and offline portable use. The short entry film starts from a fresh 390 × 844 touch load and records actual paced actions for at least 30 seconds. There is no state injection, artificial asset warming, manually restarted tracing, frame replacement or compositing.

At source freeze, report application/browser TypeScript, all source tests, both builds/portable exports and test enumeration separately from actual browser execution. Local browser execution is policy blocked and was not attempted. Private Actions with sandboxed official Chrome must run the exact frozen source; review the complete new entry/boarding films, physical-marker screenshots and first-arrival evidence before publication. Passing source checks are not a rendered or experiential pass.

The final candidate also includes two parent-reviewed friend fixes from actual private CI: Hong Kong's unchanged engine output is `entryFeasible: true` because that option requires no border crossing, while Shenzhen remains unknown; the friend test now asserts those distinct facts. The friend payoff visibly labels the user's submitted text **Your reason**. Neither change alters inputs, money, time, choices or the separate episode state.
