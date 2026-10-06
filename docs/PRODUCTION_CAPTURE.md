# Bounded production scene-readiness capture

This is one additional descriptive measurement, separate from the unchanged 90-case browser suite. It changes no application rendering, existing helper, package, test or security setting. It is intended to run first on the unfixed source, then unchanged on a narrowly fixed candidate. No speed budget determines a pass.

## Run and scope

Build with `npm run build` (CI's existing `export:portable` also builds). Then run:

`CROSSING_BROWSER_CHANNEL=chrome npx playwright test --config=playwright.production.config.ts`

The existing single Ubuntu 24.04 CI job runs this after the original browser suite. The separate configuration starts Vite **production preview** at port 4174 with `--strictPort`; it never uses the dev server. Chrome's ordinary sandbox remains enabled. There are no new packages or services. The list reporter and unique output directory preserve the existing HTML report and results.

One new isolated context opens `/` once, with 390 × 844 CSS pixels, DPR 1, mobile layout/touch emulation and normal motion. It applies a **4× CPU slowdown relative to the CI host**, **150 ms minimum request-to-response-header latency**, **1.6 Mbps aggregate download** and **750 Kbps upload** via Chrome DevTools Protocol. Mbps/Kbps use decimal units. This is a documented synthetic profile, not a real phone, low-end CPU, mobile radio or hosted-site speed claim. The fresh context is unseeded, and HTTP cache is cleared before navigation; normal cache behavior remains enabled thereafter.

The real controls take the initial nearby invitation to the first table, simple dinner, first longer-walk night view, return and shared home. State, expected artwork, the 19:15 clock and the quiet ending are checked. The 26 seconds of short explicit reading pauses are separate from load timings. The 30-second waits are eventual functional-failure guards, not performance assertions. No retry chooses a faster sample. Evidence completeness is a separate gate: finite ordered RAF samples must cover fork → arrival → afterDinner → walk → home, with ordered real action/phase marks, valid page/navigation/resource timing records, and each expected loaded-art candidate sampled in its intended phase after the commitment (initial street before the first click). JS, CSS and all four scene-resource records are required. Invalid or empty measurements are retained with diagnostic reasons and `complete: false` before the test fails. Native trace/decode absence remains optional and explicit; no measured latency determines this gate. Core completeness does not imply every ancillary metric was observed. Timing summary and metadata separately give status/count for paint, LCP, long tasks, DOM image-load events and image-error events: observed, not-observed or (for unsupported performance-entry types) not-supported. Missing page reports are unavailable. Absence is never reported as zero latency or proof of no visual gap.

There is no `Image()`, `fetch()`, `decode()`, preloading, route mock, storage seed or precommitment target-art wait in the instrumentation. Its postcommitment waits observe the mounted image's native complete/natural-size properties before continuing the story. Neither those properties nor an element's visible rectangle establish decoding or paint. A natural size of zero never qualifies as loaded artwork, even when the element/wrapper occupies the whole scene.

## Evidence and interpretation

Canonical files live under `artifacts/production-capture/`, with the exact source commit in every basename:

- One real 390 × 844 WebM recording with ordinary motion and labeled reading pauses in adjacent metadata
- `timings.json`: navigation/resource/paint/LCP/long-task observations, image load/error events, phase and actual click marks, and per-RAF scene/portrait readiness samples
- `metadata.json`: profile, exact commit/run/browser, production-build file sizes and SHA-256s, recording hash, evidence paths, clock limitations and errors
- One Playwright trace ZIP, with screenshots and DOM snapshots
- A gzip-compressed native Chrome trace, when available, with raw image-decode events and matching user-timing marks retained; absent events are explicitly `not-observed; decode timing unavailable`, never zero decode time

Image load and natural dimensions only yield a **load-ready candidate**. The summary's sampled runs without any load-ready artwork are diagnostic DOM observations, not painted blank-art durations. RAF runs before paint; it can miss inter-frame/compositor gaps, and its maximum gap is not a dropped-frame count. Geometry/style checks do not establish absence of occlusion. The observer's own cost is recorded; instrumentation, tracing and video add overhead. Keep them identical for before/after comparison.

Use actual video frames to establish visible blank-art intervals. Measure the file's real frame cadence and report intervals at that precision. Do not infer a painted gap from wrapper dimensions, image load, native decode events, or LCP. Native decode event durations can overlap and may be unattributable to an asset; do not add them into an invented per-scene decode latency. An absent native trace or decode event remains explicitly unavailable.

Page click/phase marks use `performance.now()` milliseconds and matching `crossing-capture:` names in the native trace (Chrome monotonic microseconds). Human-readable control labels and pause marks identify the same actions in the video. Playwright does not expose the video's encoder origin. Page-creation epoch timestamps provide only an approximate bracket; align the actual changed frames and do not claim exact cross-clock offsets. LCP is initial-page evidence, normally stopping after the first interaction, not a metric for later scenes.

CI uploads the canonical recording once. The original recorder copy is excluded from the artifact, as in the existing walkthrough; the tiny test attachment points to the canonical metadata/video instead of embedding another video in a report. It keeps both traces and timing data. No large recording is copied into a second report.

This capture does not replace offline portable coverage, measure both city branches, establish repeat-run variance, or prove real-device performance. Browser execution is pending until the additive candidate is authorized and run in the existing private CI environment.
