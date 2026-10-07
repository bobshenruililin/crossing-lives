# Separate phone world recording gate

This adds a cold Chromium touch recording at 390×844. It does not modify or replace the successful desktop tour or retained checks. No browser was launched during reconstruction, and no film or CI pass is claimed.

## Integration prerequisites

- Integrate the lead's parcel `Options` consequence label. The destination picker still uses `Back`.
- Integrate `lease-comparison-delta` with the visible prefix `Compared with the other offer:` (no textContent space after the colon) followed by exact A text `3,000 less cash now; 1,500 less rent/month.` and B text `3,000 more cash now; 1,500 more rent/month.`.
- Integrate the office replacement: default `data-choice=2` / `data-measure=time`; day radios `2 days / week` and `4 days / week`; `Compare travel` combobox; headline `data-world-number` rows `Hong Kong home` and `Shenzhen home` read 12/28 then 24/56; `Calendar & route comparison` opens `[data-mechanism=office-workweek]`, with 28 calendar cells and sixteen return marks after four days. The phone tour covers time, without pretending to select Money.
- Keep the existing desktop and retained workflow unchanged. The proposed separate workflow is `docs/phone-tour/phone-ci.yml`; copy it to `.github/workflows/phone.yml` when ready to run authorized CI.
- Source checks: `npx tsc --noEmit -p tsconfig.phone.json` and `node --test scripts/phone-integrity.test.mjs scripts/phone-evidence.test.mjs`. CI supplies exact `@types/node@25.9.5` in an ephemeral install; local verification used those same runtime declarations.

## What the recording proves when it passes

The recording uses a new context, actual `Locator.tap` events, and native Chromium touchscreen swipes for scrollable evidence. D-pad taps bring the player to the first nearby Enter control. Each later transition uses an ordinary visible physical door. The final map is read without navigating. Each tap is preceded by viewport, per-axis ancestor clipping and hit-point checks; target controls require at least 44×44 CSS pixels. No force, injected focus, fake DOM pointer events, keyboard/mouse controls, art warm-up or world state seeding is used.

One exception is explicit: the home Activity to adjust menu uses `selectOption('exhibition')`. Its untrusted input/change events are reported and strictly limited to that select. The trusted input log observes all touch/pointer/keyboard/input/change/click events. The film contains meaningful decisions, a 5-second pause on every parcel destination-picker visit, initial rental delta/commit visibility, office first-view checks, museum evidence scrolling, and the carried home plan. The approved untrimmed duration is 300–480 seconds, with roughly 397 seconds of authored reading/transit pauses plus ordinary rendering and movement.

Storage instrumentation is passive. It seeds only synthetic predecessor-save canaries in the one world document and delegates observed native access unchanged. Any observed active-document acquisition fails. Exact local/session bytes are checked while the document is active; durable localStorage bytes are independently checked after closing the page. The audit does not prove zero acquisition during final unload, and does not claim post-close sessionStorage preservation.

## Evidence and limits

On failure the interrupted full film, explicit failure PNG, trace, input log, geometry observations and recording report remain available. `completed:false` is never promoted to success because a video exists. Exact GITHUB_SHA / CROSSING_WORLD_COMMIT metadata is required.

The small review is separate from the film/traces and is bounded to 32 MiB, including at most 24 MiB of PNGs. It includes trusted-input, geometry and storage JSON. The full film uploads byte-for-byte if its payload is at most 500 MiB; otherwise it remains in the complete tar archive split into 384 MiB parts. Each uploaded artifact is checked against the 512 MiB connector ceiling. SHA-256 manifests allow exact reassembly. No editing, transcoding or speed change occurs.

These are Chromium emulator results only when run. They are not physical iPhone or Safari validation. The WebKit smoke proposal is deliberately separate and cannot replace this full tour or the laptop film.

The independent `phone-observer.spec.ts` negative control boots the same observer before a separate real world page, then reads local/session getters, getItem and length. It requires six exact page events and matching host events without clearing logs or changing the synthetic canaries. It does not run inside the canonical film. Browser execution remains pending.

Completion metadata additionally requires a nonempty saved film file and successful trace, page/context and storage cleanup. A failed trace stop cannot leave completed:true. Missing, nonnumeric, NaN and infinite duration values are rejected by the pure completion contract.
