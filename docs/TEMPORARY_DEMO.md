# A temporary example for presentations

This capability uses the existing story, planner, evidence views and decision engine. It is a separate page-local session, not a second guided engine, chapter-jump system or account. Its exact browser/visual verification status belongs in `VERIFICATION.md`.

## Entry and identity

In a normal evening, **More → Start temporary demo** is an ordinary user-clicked link opening the same app in a new tab/window. The URL builder preserves only the app's origin/path and adds `?temporary-demo=1`; it removes other query parameters, fragments and URL credentials. It passes no story, plan, note or other personal context.

The link uses `target="_blank"`, `rel="noopener noreferrer"` and a no-referrer policy. There is no `window.open` success guess, opener access or automatic window-close promise. If the browser does not open a tab, its normal link menu provides an explicit Open in new tab route; the app does not ask anyone to change popup/security settings.

The temporary page starts **Room to wander**, using the same `createStoryState('wander')`, reducer and selectors as normal play. It identifies itself with **Temporary demo · changes won’t be saved**. Close-tab guidance is literal: **Close this tab when you’re done. Reloading starts over.** The temporary tab is titled **Between · Temporary demo**, helping distinguish it from the original when closing. The original tab is left open, including its in-memory state when storage is unavailable.

The label appears inside an active story dialog, or as a small scene note during free exploration. The planner and research workspace retain the same identity. Normal play gains no permanent presentation header or timeline controls.

## Storage boundary

`src/runtime-mode.ts` captures the exact single flag/value before either application initializer runs. A mode change requires a new page; one tab's existing in-memory state is never switched into another mode.

Temporary operation skips storage before acquisition at all six current application paths:

1. Story restoration in `readPlayable`
2. Story state autosave
3. Story storage removal in `resetPlayableSave`
4. Practical-plan restoration at App initialization
5. Practical-plan autosave
6. Practical-plan writes in the broader reset action

The existing persistence adapter remains unchanged. Temporary story state can survive view changes in its page-local cache, but cannot survive reload. Both story-only and broader resets affect only that temporary page's state. They never read, replace, delete or restore the original browser's saved bytes.

There is no backup-and-restore mechanism. Restoring old bytes could overwrite a newer change made in the original tab. The safer invariant is no temporary storage access at all. Normal storage protection, legacy/future-version handling and blocked-storage behavior remain in their existing paths.

## Planner import

The existing explicit import confirmation is still required. **Use this evening in planner → Replace plan and explore** replaces the temporary planner inputs only when run inside the temporary page. Cancel/Escape returns to the Wallet without importing. In normal mode, the same confirmation protects the real separate plan.

The planner continues to use current story choices and regenerate the other city from starting assumptions; it does not compare the two preserved completed playthroughs. No extra financial or comparison model is introduced.

## Verification requirements

Pure tests cover flag parsing, duplicate/invalid values, HTTPS/file URL construction and removal of unrelated URL context. Production-path tests exercise initialization, autosave and reset guards, with storage acquisition counters and blocked-storage cases. These do not substitute for browser execution.

Actual browser acceptance must open the real new-tab link, retain the original tab and verify zero temporary local/session-storage acquisition or operation at instrumented active-document checkpoints through play, replay, import, research and resets, and after a fresh reload boot. Original legacy, corrupt/future and unrelated storage bytes must remain untouched. A concurrent change made in the original tab must not be reverted. Blocked-storage originals must retain their in-tab state after the demo closes.

The production portable must also open the file-URL query path and decode scenes with no HTTP requests. Phone-sized identity, focus, readable controls and unclipped scene actions require actual screenshots; passing source tests alone is not visual or human-presentation evidence.

The observer must have an isolated negative control proving that deliberate getter/method attempts produce exact nonempty logs without reaching native storage. Logs must not be cleared to manufacture a zero result. Playwright exposed bindings can drop notifications when a page is closing, so empty post-close telemetry does not establish an exhaustive absence of unload-time reads. After-close original-byte comparisons establish durable-data preservation; complete source-path guards provide separate evidence about the app's storage behavior.
