# Verification record

## Confirmed, 6 October 2026

- `npm run typecheck`: passed.
- `npm test`: 28 passed, 0 failed.
- `npm run build`: passed, production JS ~288 KB before gzip / ~90 KB gzip; CSS ~56 KB / ~15 KB gzip. Three WebP scenes total ~1.8 MB.
- Independent read-only adversarial suite: 10 passed, 0 failed, including 10,000 seeded allocation and 2,000 outing consistency cases.
- Separate domain-worker stress test: 100,000 allocation cases conserved cents.
- Source audit corrected known-cost lower-bound budget failure, half-cent rounding, restored timing display mismatch, party-wide eligibility semantics, conditional narrative time-benefit language and accurate editability disclosures.
- Original WebP images decoded and were visually inspected as individual assets.
- Portable production artifact generated successfully at ~2.81 MiB, no external module imports or external CSS assets allowed by export script.

## Not yet cleared

- Rendered application, responsive layout and interaction QA.
- Axe accessibility checks.
- Opening the portable artifact directly from `file://`, including offline behavior and saved state.
- Hosted/static asset-path verification and remote CI.

## Browser runtime blocker

The normal Vite server originally failed network-interface inspection when bound to all interfaces. Binding to loopback only resolved server startup and is the safer default.

Chromium then failed before page creation with `process_singleton_posix.cc: socket() failed: Operation not permitted`. A supported scoped execution escalation was attempted; the same process-socket error remained. Browser sandboxing was explicitly enabled. No security bypass, alternate browser launch flags or publication workaround was used.

The original eight attempted Playwright cases therefore did not run their page assertions. The current suite adds an offline export test and four storage/eligibility/restoration cases, for 13 total; these additional cases have only been listed and type-transformed, not browser-executed. These are environment-blocked, not eight discovered application failures and not passing tests. Keep this distinction in release notes.
