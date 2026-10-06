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

## Table-arrival staging, pending exact-commit verification

The next source pass adds two original close table compositions, so committing the journey visibly changes the setting rather than only advancing the clock over the same wide street. Jun is part of the new painting; a second portrait must not be overlaid. Menu, phone and wallet remain real HTML controls aligned to shared image coordinates, with named keyboard/touch alternatives.

Asset inspection alone does not clear the integration. The next exact-commit run must decode both table files in the offline export, exercise their object controls, and capture the arrival/menu/phone/wallet at phone and desktop sizes. Dialogue must leave the attended face or object visible; reduced motion must preserve the same decisions without a timed input lock. Choice-specific acknowledgments must follow actual commitments without inventing spare time or emotions.

The known-good world-first correction above remains the fallback. The real opening recording and independent visual review will judge the new payoff and pacing; passing calculations alone is not evidence that the place is engaging.

## Browser infrastructure and export history

The cloud workspace blocks local Chromium process sockets. Its browser tool also disallows local file URLs. No workaround or weakening of local security was used.

Private GitHub CI initially failed before page load because downloaded Chromium headless-shell lacked a usable sandbox on Ubuntu 24.04. A documented, supported stable Chrome channel on the same hosted image solved this with `chromiumSandbox:true`; AppArmor/sysctl/security settings stayed unchanged. See [the diagnosis and sources](CI_BROWSER.md).

The first real run exposed an invalid portable export: string replacement interpreted literal dollar sequences inside the bundled React source. Callback replacement, exact embedded-source comparison and syntax validation fixed it. Subsequent offline browser execution verified the exported file, rather than relying only on static parsing.

Repository visibility remains private. No public deployment or hosting configuration is included.
