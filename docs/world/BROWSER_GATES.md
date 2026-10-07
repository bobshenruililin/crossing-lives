# Connected-world browser gates

Status: 12 tests in five spec files are discoverable; strict test/config TypeScript passes. Actual browser execution and visual acceptance are **pending CI**. The cloud workspace's verified loopback restriction prevents local browser execution. No sandbox flags or alternate local-browser route are added.

Run the approved private artifact-only CI with official Chrome:

```sh
CROSSING_BROWSER_CHANNEL=chrome CROSSING_WORLD_COMMIT=<exact-40-character-commit> npx playwright test --config=playwright.world.config.ts
```

The config independently builds/exports the production world, then serves `vite.world.config.ts` on port 4177. It never launches the legacy or decision test suites. `GITHUB_SHA` identifies the commit in CI; the explicit world variable supports an equivalent authorized environment. Separate output roots are `test-results/world`, `playwright-report/world`, and `artifacts/world`. The integration workflow must retain these, including failures, for seven days.

Coverage:

- Cold one-click default Play at 390×844, 1440×900 and 360×844; decoded artwork and sprite; actual keyboard/touch movement relative to the image; compact controls and world-dominant first view.
- Actual source-alpha bounds (>8/255), crop preservation and viewport containment, including home, carriage and rental scale. Aspect ratios use a 1e-6 tolerance, with independent rectangle/alpha containment. Visible entrance, point and control targets are at least 44 CSS pixels and pass multi-point hit testing against sibling overlays.
- Real walking to a marked entrance, Enter, and animation-frame DOM observations of coherent outgoing/arriving art. Loaded dimensions alone do not prove native decode or compositor paint; explicit decode checks and the untrimmed film are separate gates. Twelve physical scene visits check twelve distinct approved-file hashes and twelve distinct decoded image hashes. Both controls in all twelve scenes change actual SVG geometry or computed paint; text, metadata and selected-radio styling are excluded from the fingerprint. Explicit fact oracles also check deposit and payment proportions, known/unknown coverage and consistent class time coordinates. The museum uses real region/timeline/pin controls, ordered geographic anchors, a fixed present-day base across four historical chapters, legible active labels and OSM/ODbL attribution with embedded source-data download.
- One traversal plus map revisits verifies scoped choices. Optional people alter the visible cast; housing/daily-life change start/focus routes; day and family context do not generate fares. Exact synthetic prior-save canary bytes survive. Getter/prototype acquisition traps have deliberate negative controls. The audit observes active documents and reported earlier access; it does not claim exhaustive final-unload coverage.
- Native Tab/Enter/Space/Escape, immediate E→Escape after Play, visible focus and focus return, open evidence, initial-world and five infographic axe checks. Reduced motion checks computed animation/transition values, not only a media preference.
- Cold failed art exercises the real fallback; cold held art exercises outgoing-world retention, cancel and superseding navigation. No helper preloads target images.
- The exported standalone HTML is opened with `file://`, network disabled and HTTP requests intercepted. All twelve scenes decode, both controls work, embedded dependencies remain local, the session reloads fresh and storage canaries remain unchanged.

The continuous film is `artifacts/world/walkthrough/crossing-lives-whole-world-1440x900.webm`. Its adjacent JSON records exact commit, input, viewport, action/pause times, page errors and `completed`. The first roughly four-minute route has a five-minute review bound and reports its exact untrimmed duration. It uses Play, visible walking, a marked home door and physical exits through every place, then the map. The first eleven scenes show both infographic states with reading pauses; the museum shows four geographic chapters and both regional views. It preserves the full failure film too; `completed:false` must not be presented as a completed walkthrough. The runner owns tracing; the recording does not restart it.

Review the actual first-view/body screenshots and film before approval. Test counts, assets, source checks and a video filename do not establish visual quality or completed play. The museum now uses the integrated real regional map. Its present-day generalized base is not a historical shoreline; the game’s walking connections remain fictional. The map is covered by the same mobile/offline/browser review requirements.

Local non-browser checks:

```sh
npx tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --lib ES2023,DOM,DOM.Iterable --typeRoots /opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/@types --types node playwright.world.config.ts tests/world-browser/*.ts
npx playwright test --config=playwright.world.config.ts --list
```
