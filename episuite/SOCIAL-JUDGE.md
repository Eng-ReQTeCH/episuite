# Calendar, habits, Social and PWA judge review

This is a building-agent self-review of this release against the owner's requested workflows. It is not an independent user study, a clinical assessment, or a claim of universal usability. Scores describe the tested release rubric; physical phone installation and the owner's production tailnet are not available in this workspace.

## First walkthrough: 9.4/10

The feature set was present but incomplete in use. Social needed inclusion in the page routing guard. The service worker's duplicated cache requests could prevent activation. The browser walkthrough exposed both issues; they were fixed before proceeding. Habit spacing also needed proof through the real task form rather than only through domain functions.

## Recovery and visual pass: 9.7/10

The owner's exact brush-teeth scenario worked, but a partial completion needed its own undo control. A completion acknowledgment could stay over the next page on a phone. Social's upcoming list also needed to exclude ended events and use an exact 30-day range. Those defects were corrected. Imported malformed Social records now produce validation errors, and stale person/circle drafts are rejected instead of overwriting another device's changes. The copy was reviewed for singular/plural counts.

## Final scoped release review: 9.9/10

| Criterion | Score | Observed evidence |
| --- | ---: | --- |
| Requested behavior and reliability | 9.9 | Automatic/custom colors remain stable; twice-daily eligibility waits for the configured gap; partial undo restores both history and rewards; Social records and linked plans persist through restart and backup import. All regression tests pass. |
| Integration and usefulness | 9.9 | Check-in tasks deduplicate and update/remove linked history on completion/undo. Person links follow tasks and blocks; plans appear in Social, Calendar, Now, calendar exports and the watch feed. Progress records the last seven days without introducing a streak. Search, multiple circles and filtering work through real forms. |
| Clarity, recovery and phone flow | 9.9 | Desktop and 390px light/dark screenshots were inspected. Names/times remain readable without color dependence. Calendar and Social are directly accessible in the phone dock, with other pages in More. Series/single-occurrence controls remain distinct. Deletion explains what is removed and retains unlinked tasks/plans. Navigating away dismisses acknowledgment overlays. |
| Installation and continuity | 9.9 | Chrome's app-manifest and installability checks report no errors in a disposable ordinary profile. The service worker activates, controls the page, and caches every new module/icon. Offline Social reopens with the saved workspace; offline captures queue and sync after reconnection. Install guidance distinguishes plain-HTTP testing from HTTPS production. |

Equal weighting: `(9.9 + 9.9 + 9.9 + 9.9) / 4 = 9.9`.

The remaining 0.1 reflects external validation: an actual iPhone/Android installation, real CalDAV-provider behavior, and long-term use have not been observed. HTTPS cannot be created merely by changing the app manifest. The owner's `elysium:3210` and `192.168.1.113:3210` testing addresses remain usable online; production phone installation requires the HTTPS `.ts.net` address provided by Tailscale Serve. No production network settings or live personal records were changed during testing.

Verification commands: `npm test`, `npm run check`, `node scripts/check-social-browser.mjs`, and `node scripts/check-calendar-browser.mjs`. The acceptance ledger records the final rerun's evidence. Browser checks use disposable data and a disposable profile. Screenshots are local test artifacts, excluded from Git.
