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

## World-first redesign, pending exact-commit verification

Direct audience feedback identified two problems with the page-and-sidebar direction: it felt like a dashboard rather than a place to explore, and explicit memento/recording tasks made the experience feel like something to complete. That intermediate candidate was not published.

The current source instead opens directly into the illustrated world. Objects and short contextual conversations lead to explicit meal, walk and travel commitments. Planner, evidence and detailed assumptions are optional tools; a normal home ending replaces the journal task. Quiet resume preserves existing data without presenting it as a collection goal. Pure domain/story contracts remain the known-green foundation.

Two additional persistence edges also travel with this revision: an empty-string rejected story save stays protected, and an explicit in-tab reset wins even if removing its older saved copy fails. A new exact-commit browser run must verify the replacement interaction, both city endings, offline assets and these recovery paths. The verified v2 above remains the fallback until then.

The opening will be reviewed as actual browser interaction and a short recording, alongside desktop/phone viewport captures. Passing calculations alone is not evidence that the new place is engaging.

## Browser infrastructure and export history

The cloud workspace blocks local Chromium process sockets. Its browser tool also disallows local file URLs. No workaround or weakening of local security was used.

Private GitHub CI initially failed before page load because downloaded Chromium headless-shell lacked a usable sandbox on Ubuntu 24.04. A documented, supported stable Chrome channel on the same hosted image solved this with `chromiumSandbox:true`; AppArmor/sysctl/security settings stayed unchanged. See [the diagnosis and sources](CI_BROWSER.md).

The first real run exposed an invalid portable export: string replacement interpreted literal dollar sequences inside the bundled React source. Callback replacement, exact embedded-source comparison and syntax validation fixed it. Subsequent offline browser execution verified the exported file, rather than relying only on static parsing.

Repository visibility remains private. No public deployment or hosting configuration is included.
