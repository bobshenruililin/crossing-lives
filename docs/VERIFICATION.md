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

The actual recording completed in 82 seconds and identifies that commit. Both city flows, night assets, offline portable execution, accessibility scanning and the existing reflow case ran successfully. Human review found the scene much more prominent, while menu duplication and the lack of a distinct table-arrival composition still need work.

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

Human inspection found a defect the then-current suite missed: at 390px, the Wallet's `HK$304.00` wrapped its final digit onto a new line. The phone also forecast home before including the future disclosed dinner delay, while the menu included it. The next pass addresses both rather than treating the passing count as visual clearance.

The exact verified portable is 5,758,453 bytes with SHA-256 `7b4fab48f85ac63fe7fb1b6a6d719aca62fb5888e6ff6d9c2cd6be804a3da514`. It is the tested fallback, with the two review findings above disclosed.

## Unfolding route note, pending exact-commit verification

The next source pass replaces stacked route details with one optional phone schematic of the outward and return journeys. Before departure, choosing rail or road previews consequences without advancing time. After departure the chosen route is read-only; changing it goes through the existing explicit reconsideration. Leg, cost and source details open one at a time.

A pure presentation selector composes existing story previews. Its conditional full-evening forecast includes the disclosed delay and states the assumed simple dinner and walk, while the actual story clock remains separate. It does not invent a live queue, timetable, last service, fare or venue location. Thirteen new unit tests cover these contracts, bringing the source suite to 94. An independent read-only source/component audit also checked 288 scenario combinations and 8,064 route views against the ordinary completed-engine outcomes. It found and verified a correction to Wallet timing warnings, which had still excluded the future delay. This is calculation/component evidence, not browser or visual clearance.

The Wallet correction keeps complete currency strings together without shrinking essential text. Rendered text-line and clipping checks are required at 360px and 390px, including larger amounts. Actual map captures, radio/back focus, return-route clarity and the offline loop must be inspected from the new exact-commit browser run before this pass is called verified.

## Browser infrastructure and export history

The cloud workspace blocks local Chromium process sockets. Its browser tool also disallows local file URLs. No workaround or weakening of local security was used.

Private GitHub CI initially failed before page load because downloaded Chromium headless-shell lacked a usable sandbox on Ubuntu 24.04. A documented, supported stable Chrome channel on the same hosted image solved this with `chromiumSandbox:true`; AppArmor/sysctl/security settings stayed unchanged. See [the diagnosis and sources](CI_BROWSER.md).

The first real run exposed an invalid portable export: string replacement interpreted literal dollar sequences inside the bundled React source. Callback replacement, exact embedded-source comparison and syntax validation fixed it. Subsequent offline browser execution verified the exported file, rather than relying only on static parsing.

Repository visibility remains private. No public deployment or hosting configuration is included.
