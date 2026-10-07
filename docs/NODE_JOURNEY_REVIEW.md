# Node journey slice: review contract

This isolated next pass adds a playable, presentation-only continuation after choosing the revised evening. It does not change the comparison engine, session controller, fixture, storage, original experience, or opening comparison layout. Initial map and Phone interaction remain the existing implementation. A quiet scene button, **Explore the chosen evening**, appears only after the completed Revised plan. This bounded slice offers node-to-node exploration and one outward arrival; it does not implement free city walking, a complete evening, or a work episode. There is no baseline bypass.

## What is implemented

- A small ordinary adult moves between a counter and station using taps or the named Counter / Station entrance buttons. Image, physical targets and measured sprite foot anchors use one image-coordinate plane. The mobile camera follows the active node. Static idle/back poses translate gently; no walk-loop claim.
- Exploration keeps the exact chosen immutable snapshot, option, priorities and model values. Hong Kong departs directly from the counter into nearby local streets. Shenzhen departs from the station via Lo Wu toward Luohu. Repeated departure commits no additional leg, time or expense.
- The route is a short schematic with a user-controlled **Continue to arrival** action, not a timed cinematic. Reduced motion proceeds as soon as incoming art is settled. Arrival image decoding is guarded against unmount/reset, stale callbacks and late updates after fallback. Slow art has an explicit schematic option and an eight-second readiness fallback.
- Place, clock, physical objects, sprite and contextual line switch to the destination together. Local arrival reuses the original Hong Kong illustration with different framing and truthful nearby-dinner labeling. Shenzhen uses approved day/evening art, with an authored 18:00 threshold, not a real sunset calculation.
- The persistent compact context shows the captured budget, home-by and explicitly labeled journey clock. Inspection of historical comparisons does not rewind or recommit the journey. The bill action opens both complete outing forecasts. Forecasts include future dinner and return travel; there is no balance, money-spent counter, composite ranking or inferred feeling.
- The comparison, reasons, priorities, details, three-step replay and explicit reset remain reachable. Reset removes this journey alongside the existing example. No new storage or account calls exist.

## Verified locally

- All 176 unit/SSR cases, including nine new journey state cases, pass.
- Application TypeScript and strict TypeScript for all retained browser suites plus the new movement spec pass.
- Normal and decision production builds and both portable exports pass.
- Retained original portable SHA-256 stays `6057d15afd81bfb3368584893dee424c2654d0ed638a40901519c4209fb4635f`.
- 27 decision browser cases enumerate: the original 19 are untouched, eight additive journey cases are staged.
- Original image files were visually inspected at source size. Their supplied exact RGBA conversion provenance is retained. The sprite has a visible colored alpha fringe at source scale; runtime small-size appearance remains a visual gate.

No new browser test, screenshot, accessibility audit, or movement recording has been executed in this environment. Actual playback and rendered continuity are not established by the source checks. Integration awaits the separately reviewed Phone repair and private sandboxed browser CI.

## Actual browser evidence required

Run the production entry in the existing private CI browser job with `chromiumSandbox: true`; preserve all retained checks. The new `decision-journey.spec.ts` stages these seven behavior cases:

1. Shenzhen at 390 px using a touch-enabled context and real taps throughout initial choice, node movement, departure, arrival, bill inspection and replay. Checks exact snapshot/bill retention, explicit priority and missed deadline, and captures every scene stage.
2. The same at 1440 px using genuine Tab/Enter traversal throughout, with visible keyboard focus assertions. Counter, station, route and destination also receive axe scans without exclusions.
3. Hong Kong at 390 px with reduced motion: departure is available at the counter after its exact arrival/return/slack consequence. Checks computed zero camera/player transitions, exact arrival/cost and meaningful destination focus.
4. Slow then failed incoming Shenzhen art: origin/route presentation remains truthful; a usable semantically labeled fallback arrives with exact model time and bill access. The failed-art arrival receives an axe scan; held requests are released in cleanup.
5. File-URL portable with network disabled: all four approved image assets embedded; day-lit Shenzhen arrival with no HTTP dependency.
6. A 16:30 revised departure: arrive, replay Before, close without returning to current, then reopen the arrival bill and physical Menu/Map/Phone. All reopen the captured revised inputs while baseline/revised reasons remain intact.
7. The same interrupted-replay regression for a shortened Shenzhen walk.

Happy arrival paths require ready artwork, the correct visible destination image and a decoded nonempty player pose. Those bitmap checks are not proof of painted transition continuity.

The screenshot files are emitted under `artifacts/decision/movement/`. Review actual pixels at 100% for sprite red edge, scale, foot contact, overlap with NPCs, mobile camera alignment, clipped labels, legible budget/deadline, bill action and focus ring. Geometry assertions alone do not prove those properties.

Also manually review a shortened Shenzhen walk and latest departure (20:00) with a next-day return, an ordinary tap path from initial comparison through arrival, both image-failure and sprite-failure fallbacks, repeated rapid departure input, and reset during held incoming art. The state tests establish no duplicate commitment and stale callback rejection; browser interruption review must confirm the interface matches.

For accessibility, run axe on the active counter, station, route, destination and reopened comparison. Traverse the journey only with Tab/Shift+Tab/Enter/Escape, including named object fallback, and verify that clipped scene targets do not become invisible keyboard stops.

## Separate movement film

The existing comparison recording is unchanged. A separate executable recording spec, `decision-movement-recording.spec.ts`, records the cold production entry at 390 × 844 using real touch events throughout. It selects 16:30 and the full Shenzhen plan through the existing UI, moves counter → station → counter → station, reads the consequence, boards once, shows the schematic, arrives, opens the physical menu, replays Before and closes it directly back onto the retained arrival. A final bill opening checks that the captured revised plan is restored.

The film includes purposeful 2–4 second reading pauses. It requires the exact commit SHA, saves canonical `artifacts/decision/movement/decision-movement-390x844.webm` and a companion JSON action/timing report, and preserves failed/interrupted/blank frames with `completed: false` on failure. The runner owns tracing. There is no state seeding, image prewarming, artificial readiness, compositing or frame replacement.

This recording is staged for actual private CI execution. A generated file or passing screenshot check is not evidence that motion/coherent arrival was reviewed; inspect the resulting full video and its matching commit before accepting that gate.

## Narrow portrait target repair

The first actual movement run at commit `5dd081592d3e9b2d5b3443b7dc69010abc8e9f6b` passed all 27 decision cases. Render review still found the 390 px Shenzhen arrival Phone partly cut off by the scene crop. Its center was visible, but the complete 44 px target was not. The previous input path could let browser automation scroll a clipped ancestor to reach another physical object, so a successful locator action did not establish honest touch visibility.

Frame-by-frame review of the same film also showed the player briefly clipped on the first Luohu frames while the camera continued translating from the departure framing. Arrival now cuts directly to its final scene framing, with zero camera/player transition; free node exploration keeps its existing movement. A read-only animation-frame probe checks the first arrived frame for a fully visible player and zero transition durations. This supports, and does not replace, the actual film review.

The repair moves the whole shared scene plane just enough to include the attended Phone and map with eight pixels of edge room. On desktop it also moves the Phone clear of the arrival dialogue, including the target’s lower corners. Player position and every object's source anchor stay unchanged. A physical object whose complete target is outside the crop or covered by a sheet/dialogue is hidden from pointer and keyboard navigation; it remains explicitly available in Objects. Selecting an object there focuses the inspection camera on that object's original source anchor where the image bounds permit. Portrait Menu inspection shows its original target; a desktop target beneath the sheet remains accessible through the named controls. Closing the sheet restores the ordinary player/Phone arrival framing. The image frame uses non-scrollable clipping, so invisible objects cannot be reached by silently scrolling that ancestor. Physical object targets stay unavailable while the camera is translating between nodes. Inspection and arrival framing settle immediately, including reduced motion.

The counter instruction now reads “Look around. Leave when you’re ready.” The free-inspection rule is a quiet line underneath. An explicitly selected exploration priority is stated as “Your priority: exploration”; actual walk, arrival, return, deadline and late/border consequences remain before departure.

The repaired tests assert each displayed object's real projected 44 px box is fully inside both scene crop and viewport, remains aligned with its source image coordinate, is unobscured at its corners/center, and has not scrolled its image frame. These assertions run before physical tap or keyboard focus. The mobile film now taps the fully visible physical Phone, returns to the arrival, then uses Objects → Open menu for the distant restaurant menu. During Menu inspection, the camera shows that same original menu anchor. This is an explicit control-path correction, not a substitute marker at the screen edge.

Source tests (176), application and strict all-browser TypeScript, both production builds/exports and enumeration of the original 27 decision cases pass after the repair. Legacy portable bytes remain unchanged. The repair itself still requires actual private CI execution and inspection of its new mobile screenshots/film; passing source and projected-geometry assertions alone do not establish the rendered outcome.
