# Optional WebKit smoke

This independent proposal tests the exported standalone world HTML with Linux Playwright WebKit at 390×844, hasTouch/isMobile enabled and the network offline. It checks default Play, trusted touch movement, Shorten lunch, Take this plan, the carried plan and actual Close control. Targets are measured for clipping and hit coverage before `.tap`; no mouse, keyboard, state seed, focus injection, select exception or security override is used.

This is intentionally a short compatibility signal, not a full-world tour, physical iPhone check or Safari validation. It does not change the desktop or full Chromium phone gates. Strict TypeScript passed locally; WebKit has not been launched. CI is proposed, not executed.

Apply webkit-smoke-additions.patch from the repository root, then copy docs/phone-tour/webkit-smoke-ci.yml to .github/workflows/webkit-smoke.yml when authorized. It requires npm ci, exact @types/node@25.9.5, the supported `npx playwright install --with-deps webkit`, and npm run export:world. No browser is launched by this proposal itself. The evidence is actual PNG/JSON when run; no film or trace is created. A 32 MiB bound gates artifact upload, well below the connector ceiling.

Bounded proof revision: the current embedded background is visibly rendered and natively decoded to positive dimensions. The trusted Walk-left tap must move the actual player rectangle left relative to the world plane, independently of the data-x attribute. Both observations are written to the smoke JSON. No future-room art is read or preloaded.
