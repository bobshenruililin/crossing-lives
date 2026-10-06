# Sandboxed browser verification

The first private CI run passed installation, TypeScript, 28 domain tests, production build and portable export, then failed before loading any page. The downloaded Playwright `chrome-headless-shell` reported `No usable sandbox` under Ubuntu 24.04's user-namespace restrictions.

The verification job now pins `ubuntu-24.04` and uses the runner's existing Google Chrome stable through Playwright's supported `chrome` channel. `chromiumSandbox: true` remains enabled. The workflow neither changes AppArmor nor sysctl settings, installs a privileged container, nor adds a no-sandbox flag.

Why this is a supported configuration:

- GitHub's [Ubuntu 24.04 image manifest](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) lists Google Chrome as installed.
- [Playwright browser documentation](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge) supports using installed stable Chrome via the `chrome` channel.
- [Chromium's AppArmor documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md) identifies Ubuntu's existing profile for stable Chrome at its normal installation location.

These sources were checked 6 October 2026. The change is a configuration repair, not evidence of a passing browser test; only the subsequent run can establish that.

Local execution can select an installed Chrome with `CROSSING_BROWSER_CHANNEL=chrome npm run test:browser`. A browser blocked by host policy remains blocked; no local bypass is part of this project.
