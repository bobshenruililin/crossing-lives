# Bounded WebKit navigation diagnosis

The b8d569c CI installed WebKit 26.6/build 2359 and produced the portable world export, then failed at `page.goto(file:///.../crossing-lives-world.html)` with an internal WebKit error before Play. This is an observed file-navigation failure, not evidence of an application interaction defect or a Safari/physical-iPhone result.

The original offline smoke spec and config remain byte-identical. Its existing JSON and PNG outcomes remain in their original paths. The workflow still fails when that test fails. The two added diagnostics run independently afterward, even when the original file test fails:

1. Tiny offline file baseline: a minimal self-contained HTML document at a file URL must load and receive a trusted native touch. It writes tiny-file.json with its own outcome and error stage.
2. Exact served export: a loopback HTTP server returns the existing `artifacts/crossing-lives-world.html` bytes without rewriting. Before browser navigation, a separate Node HTTP stream hashes the returned bytes and requires matching SHA-256 and byte length against the source export. The browser remains at about:blank throughout this independent request. Browser navigation then verifies Content-Length, the source-hash header, content type and no-store behavior without asking the WebKit inspector for its response body. It then runs the same small movement/choice/commit/close smoke with native touches. served-world.json explicitly records HTTP and offline:false. Hosted success does not establish that file navigation works.

The server only exposes the export and one readiness response. No runtime code or generated export is modified. There are no security flags, alternate WebKit installation, route interception or future-image preload. The current rendered background alone is decoded by the existing smoke checks.

Interpret the independent outcomes cautiously. Tiny file failure indicates the problem is broader than this export under this environment; tiny-file success with export-file failure narrows it to content/loading conditions. Served success establishes only the served compatibility path. None establishes the reason for the internal engine error without further evidence.

Run the original WebKit command first. Then run `npx playwright test --config=playwright.webkit-diagnostics.config.ts` after the existing export exists. The installed workflow adds this sequence with `always()` for the diagnostics and prerequisite checks. Both reports and failure PNGs remain in the existing 32 MiB bounded WebKit artifact. No local browser execution is claimed.


## Dependency and export evidence

The existing b8d569c WebKit log reports that its extra `@types/node@25.9.5` install added two packages, removed two and changed three. Its export is 28,363,232 bytes; c969ef3's world-job export is 28,363,329 bytes. Both report Vite8.3.3, but their JavaScript bundle filenames differ. This establishes package-tree mutation and different output bytes, without identifying the cause of the WebKit error or the byte difference.

The revised workflow installs the pinned Node declarations under RUNNER_TEMP and passes that explicit typeRoots path to tsc. It saves actual project package versions before and after the isolated install, compares additions/removals/version changes, and records lockfile/package hashes plus Node/npm versions. A separate declarations.json captures the temporary compiler declarations tree. After its existing export it records the exact portable SHA-256 and byte count. The file smoke and served-response comparison continue to use that same export. The project-level extra install is removed; the before/after project snapshots make dependency preservation observable. No comparison result is fabricated from the package lock.

The isolated local package-only comparison did not complete. After its authorization was clarified, the one exact npm-ci retry exited254 because npm could not create /home/agent/.npm, with accompanying tar extraction errors. The partial tree is not a valid baseline and no before/after package versions are inferred from it. The passive CI metadata collector can establish the actual versions on the next authorized run.


The actual produced HTML is also preserved in `crossing-lives-webkit-exact-export`, separately from the 32 MiB review. Its receipt verifies the file still matches the recorded portable SHA-256 and byte count, includes both dependency snapshots and their diff, and enforces a 384 MiB payload ceiling before upload. The original HTML stays outside the small-review roots, so its approximately 28.4 MB size cannot crowd out failure PNGs. No derived or re-exported replacement is substituted.


The e897 diagnostic run failed both offline file navigation and the tiny-file baseline with an internal WebKit error. Its served navigation reached HTTP200, but retrieving the large response body through the inspector failed after cache eviction, before the touch smoke. The bounded repair replaces only that inspector-body proof with independent Node transport and matching browser response metadata. Neither failed-file result is reclassified, and served compatibility remains pending until actual touch assertions run.
