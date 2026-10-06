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

## Compact research landing and capture packaging, pending exact-commit verification

The optional desk replaces its large branded header and green sidebar with a small Return control and a collapsed Sections disclosure. The business question and unchanged spending context come first. Section selection moves focus to the visible heading; Escape closes navigation and restores its trigger. A new scoped stylesheet keeps this reading area separate from the story and practical planner.

The future artifact upload retains one canonical walkthrough video and full metadata per recorded attempt, with a small path/hash pointer in the HTML report. It excludes only the duplicate raw recording path. Failure traces, screenshots and reports remain available, and no past artifacts are removed. The captured actions, assertions and reading pauses are unchanged. Actual navigation, 360/390px composition and uploaded archive contents still require their own run.

## Delivery and coverage limits

The verified browser setup is Chrome stable on Ubuntu, with desktop and resized phone/tablet viewports. Physical phones, Safari and full assistive-technology behavior have not been verified. Automated axe checks gate serious/critical findings; they are not full WCAG certification. Most interaction tests run against Vite development output, while the offline file test exercises the actual production portable build.

All scene/font data, JavaScript and notices were checked against embedded source bytes in the portable export. No required runtime external service is present. Optional source links require connectivity. Resource sizes and CI timing do not establish low-end mobile performance.

Ship the private repository or a clean manifest-only source archive plus the identified portable file. Working snapshot directories contain local dependency symlinks and generated verification files and are not a distribution package.

## Browser infrastructure and export history

The cloud workspace blocks local Chromium process sockets. Its browser tool also disallows local file URLs. No workaround or weakening of local security was used.

Private GitHub CI initially failed before page load because downloaded Chromium headless-shell lacked a usable sandbox on Ubuntu 24.04. A documented, supported stable Chrome channel on the same hosted image solved this with `chromiumSandbox:true`; AppArmor/sysctl/security settings stayed unchanged. See [the diagnosis and sources](CI_BROWSER.md).

The first real run exposed an invalid portable export: string replacement interpreted literal dollar sequences inside the bundled React source. Callback replacement, exact embedded-source comparison and syntax validation fixed it. Subsequent offline browser execution verified the exported file, rather than relying only on static parsing.

Repository visibility remains private. No public deployment or hosting configuration is included.
