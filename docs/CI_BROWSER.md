# Sandboxed browser verification

The first private CI run passed installation, TypeScript, 28 domain tests, production build and portable export, then failed before loading any page. The downloaded Playwright `chrome-headless-shell` reported `No usable sandbox` under Ubuntu 24.04's user-namespace restrictions.

The verification job now pins `ubuntu-24.04` and uses the runner's existing Google Chrome stable through Playwright's supported `chrome` channel. `chromiumSandbox: true` remains enabled. The workflow neither changes AppArmor nor sysctl settings, installs a privileged container, nor adds a no-sandbox flag.

Why this is a supported configuration:

- GitHub's [Ubuntu 24.04 image manifest](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) lists Google Chrome as installed.
- [Playwright browser documentation](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge) supports using installed stable Chrome via the `chrome` channel.
- [Chromium's AppArmor documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md) identifies Ubuntu's existing profile for stable Chrome at its normal installation location.

These sources were checked 6 October 2026. The change is a configuration repair, not evidence of a passing browser test; only the subsequent run can establish that.

Local execution can select an installed Chrome with `CROSSING_BROWSER_CHANNEL=chrome npm run test:browser`. A browser blocked by host policy remains blocked; no local bypass is part of this project.

## First real browser result

Run [37471515288](https://github.com/bobshenruililin/crossing-lives/actions/runs/37471515288), commit `bd06480`, successfully launched sandboxed Chrome. Ten of thirteen browser cases passed, including the primary story/planner/reload loop, 360/390/1440 layouts, storage recovery and dialog keyboard behavior. The three failures exposed an ambiguous test locator, a low-contrast secondary strip label, and an invalid portable-module export.

The export issue was traced to passing bundled JavaScript as a String.replace replacement string: literal dollar substitution sequences inside React were interpolated into the HTML. Callback replacements now preserve the built source exactly; the exporter compares the embedded module to the source and syntax-checks it before writing. Browser confirmation remains required.

Rendered review also found a cramped phone invitation strip and distant comparison feedback. The follow-up repair uses a deliberate mobile invitation layout, readable annotations, a compact live two-city summary, explicit mobile time/currency labels and a common absolute timeline scale. These changes require the next run's screenshots and assertions.

The next run, [37474133114](https://github.com/bobshenruililin/crossing-lives/actions/runs/37474133114), confirmed the repaired portable file loads and completes an offline choice. Ten of thirteen tests passed. Remaining failures were a 360px header overflow, missing semantic roles on labelled timeline graphics, active-navigation contrast and a range-label association bug: each wrapping label's output appeared before its input, so the implicit association and test locator resolved to the output. Explicit input IDs/htmlFor now associate each control, with keyboard assertions targeting the slider role and checking the actual values after Home/ArrowRight. The narrowest header now uses two clear rows.


## One canonical walkthrough recording

The recording remains actual Playwright browser interaction with unchanged actions, assertions and reading pauses. Its canonical video and full metadata live under `artifacts/walkthrough/`; the HTML report gets a small pointer with relative paths and SHA-256 instead of another copy of the video.

The upload step excludes only the duplicated raw recording at `test-results/walkthrough-*/recording/*.webm`. Failure traces, screenshots and the report remain included. Existing uploaded artifacts are untouched. This uses the [official upload-artifact v4 multiple-path/exclusion syntax](https://github.com/actions/upload-artifact/tree/v4#upload-using-multiple-paths-and-exclusions), without changing the runner, sandbox, permissions or retention period.

A review of the verified spending artifact found four byte-identical 16,128,923-byte video copies. Deduplication reduces future archive volume; it does not reduce the captured journey or constitute a runtime performance measurement.
