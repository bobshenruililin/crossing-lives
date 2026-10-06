# Verification record

## Known-green baseline, 6 October 2026

Commit `c29034126c39a4971eb0eaf62bcf729954840f8c` passed the full private GitHub Actions workflow:
- TypeScript, 28 domain tests and production build/export
- All 13 browser cases, first attempt
- Real Chromium/Chrome rendering at 360px, 390px and 1440px
- Complete original story/planner/choice/reload/reset loop, constraints, group costs, FX, return route, allocation keyboard interaction, source navigation
- Keyboard dialog behavior, reduced motion, media failure, blocked/corrupt storage and restored defaults
- Axe checks for the main views
- The portable HTML opened from file with network offline and completed a choice

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37475455524)

Actual screenshots were independently reviewed. That review led to a mobile two-row header, an intentionally composed invitation strip, readable supporting text, a compact live two-city comparison, clear per-person/deadline labels and a common absolute timeline scale. Passing tests alone did not establish those visual improvements.

## Verified playable evening, 6 October 2026

Commit `0e14f2f9529653bdcd85107190230f6c0f8acbd2` passed TypeScript, the production build/export, all **74 unit tests** (37 domain, 20 persistence, 17 story) and all **26 browser cases on their first attempt**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37481828380)

Coverage includes both city endings, real night-scene and Jun image decoding, meal/walk costs and timing, the once-only delay, checkpoint rewind, the preserved alternate evening, eligibility remaining unconfirmed, source/planner navigation, keyboard/reduced-motion behavior, blocked-storage navigation, rejected-save recovery and the offline portable loop through both night scenes and replay. Original art was inspected independently; actual application screenshots were then reviewed separately.

The verified portable HTML is 4,801,871 bytes with SHA-256 `005d27585b660b550dc5b16c71eda8c6e43835270ef8ab292b6ed5b9747969ad`. This identifies that exact build, not later exports.

## First world-first rendering, 6 October 2026

Commit `4199ead7f518cd5124a1f1861d39afa2438fd5cb` passed TypeScript, all 74 then-current unit tests, build and export. Its actual browser run passed 27 of 34 cases. Four failures came from ambiguous warning locators; three exposed loss of document focus while tabbing through a modal. This commit is **not a fully cleared release**.

[Exact world-first run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37490862878)

The actual recording completed in 82 seconds and identifies that commit. Both city flows, night assets, offline portable execution, accessibility scanning and the existing reflow case ran successfully. Visual review found the scene much more prominent, while menu duplication and the lack of a distinct table-arrival composition still need work.

Evidence naming matters: the initial `world-opening` screenshots showed exploration after a helper dismissed the first dialogue. The recording's four-second frame shows the true initial Jun invitation, with unrelated tools hidden. Subsequent tests capture `initial-invitation` before dismissal and `exploration` afterward. A full-height wrapper alone is not accepted as proof of artwork coverage.

## Verified world-first correction, 6 October 2026

Commit `bde888c04222024c627750e33f03558eeec0ea73` passed TypeScript, the production build/export, all **81 unit tests** and all **44 browser cases on their first attempt**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37494497635)

This run resolved the modal-focus defect and warning-locator ambiguity. It also exercised genuine keyboard activation, forward/reverse modal traversal, computed reduced-motion behavior, real setup controls, direct zero-walk return, protected legacy-detail reconsideration, phase-aware observations and actual image-plane coverage at 768×1024 and 820×1180. Initial invitation and exploration captures are separately named. Both city flows and the offline portable still passed; the real opening recording was regenerated.

The verified portable is 4,789,137 bytes with SHA-256 `9aa1a4fc213b45c1c777ed491d4ad230e20310a99f814cef314d0e774a36dbf8`. This is now the known-good fallback. The new close table-art integration is a separate unverified change until its own browser run and visual review.

## Verified table-arrival staging, 6 October 2026

Commit `004b5a9125214f45b82021654c311c07e45db17d` passed TypeScript, build/export, all **81 unit tests** and all **52 browser cases on their first attempt**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37498416872)

Committing the journey now visibly changes to one of two original close table compositions. Jun is part of the painting, without a duplicate portrait. Menu, phone and wallet use semantic controls aligned to the image coordinate plane. Both table files decode in the offline export. Actual arrival/menu/phone/wallet captures were reviewed at phone sizes, and the real recording includes the arrival transition.

Visual inspection found a defect the then-current suite missed: at 390px, the Wallet's `HK$304.00` wrapped its final digit onto a new line. The phone also forecast home before including the future disclosed dinner delay, while the menu included it. The next pass addresses both rather than treating the passing count as visual clearance.

The exact verified portable is 5,758,453 bytes with SHA-256 `7b4fab48f85ac63fe7fb1b6a6d719aca62fb5888e6ff6d9c2cd6be804a3da514`. It is the tested fallback, with the two review findings above disclosed.

## Verified route-note calculations and interaction, 6 October 2026

Commit `8f8014219b7d7e77d54a5405682c21dcf17dfb00` passed TypeScript, build/export, all **94 unit tests** and all **62 browser cases on their first attempt**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37505936849)

This pass replaces stacked route details with one optional phone schematic of the outward and return journeys. Before departure, choosing rail or road previews consequences without advancing time. After departure the chosen route is read-only; changing it goes through the existing explicit reconsideration. Leg, cost and source details open one at a time.

A pure presentation selector composes existing story previews. Its conditional full-evening forecast includes the disclosed delay and states the assumed simple dinner and walk, while the actual story clock remains separate. It does not invent a live queue, timetable, last service, fare or venue location. Thirteen new unit tests cover these contracts, bringing the source suite to 94. An independent read-only source/component audit also checked 288 scenario combinations and 8,064 route views against the ordinary completed-engine outcomes. It found and verified a correction to Wallet timing warnings, which had still excluded the future delay. This independent audit is calculation/component evidence; the exact browser result is recorded separately above.

The Wallet correction keeps complete currency strings together without shrinking essential text. Rendered text-line and clipping checks passed at 360px and 390px, including larger amounts. The exact run exercised actual radio selection, Back/focus restoration, return-route state, the forecast-warning consistency regression and the offline local/rail/road flow. Visual review of the 390px rail/road notes and Wallet found the content legible and the currency wrapping fixed. It also found the route note still text-heavy: a clearer visible crossing and spatial path are a future craft refinement, not something established by the passing suite. A subsequently added keyboard-arrow radio case is not included in this 62-case result.

## Verified night framing and shared home arrival, 6 October 2026

Commit `7bc1460787ee023d018d6e969c0038bc7be3d245` passed TypeScript, build/export, all **94 unit tests** and all **67 browser cases on their first attempt**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37509219241)

This pass gives short and long walks different attention within the same original night scene. It recognizes the actual meal/walk combination in one authored line; no feelings, spare time or score are inferred. A separate original fictional home-arrival scene now ensures a Shenzhen return does not leave the player looking at Shenzhen under a home label.

The run verified actual framing and attended image regions at desktop and phone sizes, genuine keyboard-only route radio behavior, shared-home controls and offline decoding after both city returns and direct return. The real complete-evening recording is 159.68 seconds at 1440×900. Visual review confirmed the spatial difference between short and long walks and the quiet, distinct home ending.

Review also found the bottom fiction caption partly behind dialogue. The next pass repositions that caption and adds rendered-text bounds, overlap and default ending-control checks. A suspected missing Finish control was corrected after viewing the full-resolution screenshot; no such defect was established.

The exact verified portable is 5,952,426 bytes with SHA-256 `10c9e6c779fe0ba6857ee241c540afd3b34780307937f050f122516e273fb6aa`.

## Verified spatial route and caption refinement, 6 October 2026

Commit `301f8d8e535f8f6003960a2da37d7710508912aa` passed TypeScript, build/export, all **94 unit tests** and all **67 browser cases without retries**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37511665856)

The route note now presents one thin out-and-back line with the origin, named crossing and dinner area visible together. Local Hong Kong journeys do not invent a crossing. A compact conditional summary keeps the exact modeled home time and spare/past-deadline status; a real Evening assumptions disclosure contains the unchanged dinner, walk, delay and deadline explanation. Required warnings stay visible.

Tests open and inspect the visible assumptions rather than accidentally passing against the screen-reader announcement. Full legs, exact amounts, unchanged clock/state, native radio keyboard behavior, return/direct-return, sources and offline use remain checked. The complete recording explicitly opens the assumptions. Actual 390px review found the spatial line legible, the forecast less dense, and the fiction caption and default ending controls visible. It remains a schematic, not geographic navigation. The complete real-browser recording is 164.72 seconds. The verified portable is 5,955,456 bytes with SHA-256 `d78e7bb15d51a08e7881a3776685874a2a37d3d8568a15ba3abddb15001ff7db`.

## Verified Jun throughline and staging repair, 6 October 2026

Commit `d7f9a12d36e4862f85345946b27a32466c54a4df` passed 102 unit tests and 70 of 71 browser cases. The remaining case exposed a real overlap between Shenzhen's longer acknowledgment and the attended avenue region. No control or numeric failure was established.

The one-condition repair `1c723b5449b8094a5af7e871517757fb28141d30` passed TypeScript, build/export, all **102 unit tests** and all **71 browser cases on their first attempt**, with the original geometry assertions unchanged.

[Exact passing repair run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37516591106)

This narrative pass replaces generic interface-like recaps with a few authored lines about Jun's connection to both places. The player's own history and familiarity are not inferred. The optional home-phone note is plainly fictional, reflects the existing city/walk or direct-return choice, and keeps the completed route reachable. It has no notification badge, reply requirement, read state or message history.

Eight new pure selector tests bring the source suite to 102. They check approved branches, zero-walk copy, replay, uncommitted states, and preservation of time, bill, eligibility, familiarity and legacy notes. The exact browser run exercised opening/table text fit, optional-note focus/navigation, byte-preserving rereading, both city/direct-return callbacks and offline use. Visual inspection confirmed the repaired Shenzhen avenue remains clear and the home note stays quiet and plainly fictional. This is an independent visual/code review, not a human user study. The video duration is 179.96 seconds; the same run’s test metadata reports 175,892ms elapsed. These are separate artifact measurements, not a promised player completion time.

The verified portable is 5,957,641 bytes with SHA-256 `ec5cac38f407fcbd797256b5894303593d0573dd4c59d1f338979a5151bd227d`.

## Verified optional spending-to-research bridge, 6 October 2026

Commit `edb9fdcd0ea87308928fdc1383b14bfc0bbdcafb` passed TypeScript, build/export, all **115 unit/SSR tests** and all **75 browser cases on their first attempt**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37520682531)

This bounded bridge lets the Wallet open the existing Business questions section with a frozen whitelist of the selected whole-outing HKD totals and party count. It includes transport; no restaurant revenue, wage, cost or profit is inferred. Missing totals remain incomplete, no selection creates no amount, and the independent fixed surplus pool is unchanged.

The source suite adds 13 focused context/SSR tests for 115 total. They include all supported party counts, unknown/zero values, rounding, nonmutation, source navigation and byte-identical fixed-pool markup across contexts. The actual browser run verified Wallet entry/return focus, blocked-storage preservation, the optional receipt's real party count, no-selection behavior and offline use. Visual inspection of 360/390px captures found the spending context legible and the pool boundary clear. A subsequent strict receipt-return viewport check is separate: the first run asserted restored focus but did not establish that the bottom receipt action was onscreen. The same pass makes Jun's Shenzhen long-walk memory refer to the visible café lights under the trees.

The verified portable is 5,962,118 bytes with SHA-256 `3c48f1bdc9b34b3e55132dc856002c0d3faba9c291003b434fa48caf94f5c811`.

## Verified recovery and delivery corrections, 6 October 2026

Commit `5a27d92d95ca7c3a3d3c59c81bfc2c73d52a259a` passed TypeScript, build/export, all **115 unit/SSR tests** and all **76 browser cases on their first attempt**.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37523010020)

A read-only delivery audit found that the emergency reset label promised more than its planner-only deletion performed. The emergency view now offers a non-destructive reload with a clear unsaved-change warning; normal explicit reset flows remain separate. A fault-injected browser case verified the actual boundary, all stored bytes and successful reload without reseeding the fixture. Actual 390px visual review found the recovery action and preservation explanation clear.

The same correction allows a returned receipt action to scroll into view, with a strict viewport assertion rather than a test-side scroll. It records the bundled CJK font's exact Adobe copyright metadata alongside the retained OFL/distribution notices, and removes remaining wording that implied human user testing.

The verified portable is 5,962,996 bytes with SHA-256 `6d5832108e7342e54ad9c535b7ea4579a776672032759871618d7214f10869cf`.

## Verified compact research landing and capture packaging, 6 October 2026

The optional desk replaces its large branded header and green sidebar with a small Return control and a collapsed Sections disclosure. The business question and unchanged spending context come first. Section selection moves focus to the visible heading; Escape closes navigation and restores its trigger. A new scoped stylesheet keeps this reading area separate from the story and practical planner.

The future artifact upload retains one canonical walkthrough video and full metadata per recorded attempt, with a small path/hash pointer in the HTML report. It excludes only the duplicate raw recording path. Failure traces, screenshots and reports remain available, and no past artifacts are removed. The captured actions, assertions and reading pauses are unchanged. Run [37526514969](https://github.com/bobshenruililin/crossing-lives/actions/runs/37526514969), commit `5267ad8bbb20993074757a92a6ca06bcaee9e1e3`, passed 115 unit/SSR tests and 74 of 76 browser cases. Actual 360/390px spending captures show the complete question/context in the first viewport. The uploaded archive contains exactly one walkthrough WebM, with a matching report path, byte count and SHA-256.

The two phone failures were at the new return-to-planner focus assertion. The actual trace shows that the helper did not find the expected mobile Research desk name, entered the story's research route instead, then correctly returned to Jun. A narrow repair gives the real nav control a stable accessible name and makes the test assert/click the intended planner entry directly. Its return-focus assertions are unchanged. The separate two-file repair `f9df5f68322dc53ed8b526f26f9c8fa2cb5b39c6` passed all **115 unit/SSR tests** and **76 browser cases without retries**, including the direct planner entry and return focus at 360/390px, build/export and production offline use.

[Exact passing repair run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37528956253)

Archive inspection of the initial compact run verified one canonical 16,758,462-byte video, with SHA-256 `311de561221cb73ec8c58762cad6aeb7f219eb218354f2b379cf58823cb23084` matching its report pointer. Recording actions and readable pauses were not shortened to achieve this.

## Verified optional membership-rights evidence, 6 October 2026

This bounded addition is an initially closed, question-led comparison of Home Market and The Cheese Board Collective. It separates customer benefits, worker decisions and surplus claims, with immediate limits and exact sources. Cheese Board's 2022 operating details stay historical; current terms and audited amounts remain unverified. Sources retrieved through official indexed text are not described as a successful fresh PDF fetch.

The view accepts no outing or pool inputs and changes only its local reading selection. Thirteen new unit/render checks bring the source suite to **128 tests**. Two additional phone cases and the expanded offline path bring the browser suite to **78 cases**. Commit `cb8fb485e90e2355b75d634ec00512279963c583` passed all 128 unit/SSR tests, all 78 browser cases without retries, TypeScript, build and portable export.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37530682207)

The actual run exercised native radio behavior, visible historical/current uncertainty with Sources closed, real source disclosures, exact legacy storage preservation and the independent pool. One case changed the pool to HK$180 and worker weight to 51, then required those edited values and their allocation proof to survive topic changes before explicitly restoring defaults. The production portable opened the questions with no HTTP requests.

Visual inspection of actual 360/390px images confirmed the closed evidence entry immediately follows the spending context, and the worker/surplus questions remain readable without clipping. The optional reading is longer than a story exchange; it is not a mandatory part of play. This is not evidence of human audience understanding.

The exact verified portable is 5,977,643 bytes with SHA-256 `1237abfcd1dacfdef829a6bf841e0390465f5fc59343e8718f70075e2bd08dae`.

## Verified explicit planner import and presenter controls, 6 October 2026

A presenter-flow review found that the former “Compare this evening” label could suggest a comparison of two completed stories. The actual selector transfers current story choices into the separate practical planner and recalculates the other city from starting assumptions. It can replace a user's existing planner inputs.

The Wallet now calls this action “Use this evening in planner”, explains replacement and requires “Replace plan and explore” before invoking the unchanged import callback. Cancel, Escape and the confirmation's close control return to the Wallet without transferring inputs; focus returns to the import action. There is no new comparison engine, data migration or historical-playthrough renderer.

The presenter document now proposes one ten-minute arc: free same-assumption previews, one audience city choice, one completed evening and the direct worker-rights question. Its timings are a rehearsal plan, not observed human comprehension or an already recorded presentation. The initial consent run, commit `cee74c96c681c64f51d930904ac6b6c7e98ad141`, passed 80 of 83 browser cases. The three remaining cases stalled while preparing a modified plan: exact `getByLabel` did not resolve a wrapping select label. The actual failure accessibility tree exposed the correctly named “Shenzhen route” combobox and both options. A test-only repair targeted that exact role/name, preserving the route edit, value check and every consent assertion. No production bytes changed in the repair.

Commit `d901c5783b4646000ff18435bf0a5b36f3e4886a` passed all **128 unit/SSR tests** and **83 browser cases without retries**, plus TypeScript, build/export and offline execution. All four cancellation routes, modified-plan preservation, blocked storage and explicit import were exercised. Both unseeded same-assumption presenter paths completed an evening and reached Worker decisions. These establish actual controls and arithmetic, not human pacing or comprehension.

[Exact passing run](https://github.com/bobshenruililin/crossing-lives/actions/runs/37540439667)

The portable is byte-identical across the test-only repair: 5,978,895 bytes, SHA-256 `4356bc94765e5477d91c6f2e9e922f59340eb12e403f6c07a55131bc2d37c307`. Actual 360px consent inspection confirmed the replacement explanation, preserved-story boundary, explicit confirm, cancel and close are legible. Temporary-demo isolation remains the separate next browser gate.

## Temporary demo, pending browser verification

A five-file implementation adds a page-local temporary flag, a real new-tab link and quiet unsaved-mode identity. It uses the existing Room to wander story and skips all story/planner storage reads, writes and removals, including reset/legacy paths. It does not restore a saved backup or create another engine.

Ten new unit/SSR checks bring the source suite to **138 tests**. Independent full-component execution for HTTPS and file URLs exercised initialization, replay, remount, planner import/receipt/research and both resets with zero storage acquisitions/adapter calls. The final five-file delta was hash-checked onto the latest consent source; it did not replace newer browser tests or documentation with an older staged tree.

The prepared suite has **90 browser cases**: it retains the prior 83, adds six grouped temporary-session scenarios and a separate observer negative control, and extends the existing offline case. Actual new-tab navigation, active-document storage getter/method instrumentation, blocked original in-memory state, file-query offline use and phone identity/geometry remain browser gates. No passing temporary-mode browser result is claimed here yet.

Independent test review identified that exposed bindings may discard events once a page closes. The corrected design requires exact nonempty canary logs without native data access or log clearing, preserves all active-document zero-access assertions, and compares original bytes after close. It does not certify an unobservable unload interval from an empty host array.

## Delivery and coverage limits

The verified browser setup is Chrome stable on Ubuntu, with desktop and resized phone/tablet viewports. Physical phones, Safari and full assistive-technology behavior have not been verified. Automated axe checks gate serious/critical findings; they are not full WCAG certification. Most interaction tests run against Vite development output, while the offline file test exercises the actual production portable build.

All scene/font data, JavaScript and notices were checked against embedded source bytes in the portable export. No required runtime external service is present. Optional source links require connectivity. Resource sizes and CI timing do not establish low-end mobile performance.

Ship the private repository or a clean manifest-only source archive plus the identified portable file. Working snapshot directories contain local dependency symlinks and generated verification files and are not a distribution package.

## Browser infrastructure and export history

The cloud workspace blocks local Chromium process sockets. Its browser tool also disallows local file URLs. No workaround or weakening of local security was used.

Private GitHub CI initially failed before page load because downloaded Chromium headless-shell lacked a usable sandbox on Ubuntu 24.04. A documented, supported stable Chrome channel on the same hosted image solved this with `chromiumSandbox:true`; AppArmor/sysctl/security settings stayed unchanged. See [the diagnosis and sources](CI_BROWSER.md).

The first real run exposed an invalid portable export: string replacement interpreted literal dollar sequences inside the bundled React source. Callback replacement, exact embedded-source comparison and syntax validation fixed it. Subsequent offline browser execution verified the exported file, rather than relying only on static parsing.

Repository visibility remains private. No public deployment or hosting configuration is included.
