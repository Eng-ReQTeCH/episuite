# Independent LIFE OS judge review

Reviewed 2026-10-30. This is an independent code and browser review by a subagent, not measured clinical or longitudinal ADHD outcomes.

## Round 1

| Category | Score / 100 |
| --- | ---: |
| Usefulness | 94 |
| Completeness | 89 |
| Functionality / robustness | 85 |
| ADHD usability | 87 |

The feature set addresses the request directly. A unified All open view includes legacy Inbox and Someday tasks; Today is explicitly a selection, and removing an item preserves it in the main list. Existing completion history powers task, category, focus and opening-day grids without fabricated historical login counts. The completion API is monotonic, uses persisted event receipts, preserves normal reward/social behavior, and excludes secrets from exports/state. Shortcut CRUD and actual browser Picture-in-Picture controls work.

Independently executed `node --test tests/life.test.mjs` (2 passed) and `node scripts/check-life-browser.mjs` (passed). The browser exercise uses the real Picture-in-Picture API, not a mock. These checks do not currently cover the hidden-opener scenario central to the floating feature.

### Required improvements

1. **Keep shared state synchronized while the opener is hidden and the floating timer is open.** The existing `setInterval` in app.js only calls `load()` when `!document.hidden`. Working elsewhere with PiP visible can hide the opener. The floating view continues deriving time from its old state and stops at zero, missing completed-session transitions, automatic breaks, and changes from other devices. Expose whether lifeTools has an open floating window and allow polling during that condition. Add a browser check that hides the opener, applies a shared change or timer expiration, and verifies the floating document updates.
2. **Make recent days visible and orient mobile contribution graphs.** Full-year grids exceed phone width, initially showing January with today's October cells off-screen. There are no month markers or a latest-days affordance. Scroll new graphs to the latest end by default, provide month/date orientation, and verify a phone user can inspect today's day without manually searching across the year.
3. **Bring the in-app automation instructions in line with the date-safe API documentation.** LIFE-OS.md correctly recommends an explicit source-event query date, but the setup dialog shows a date-less endpoint. A retry after midnight defaults to a different date and returns 409. Include the `?date=YYYY-MM-DD` example and explain that the event date and ID must remain unchanged for retries.

### Non-blocking observations

- The favicon request is a conventional `/favicon.ico` lookup rather than HTML icon-link discovery. A site without that resource retains a readable shortcut name but may display a broken-image glyph. Hiding failed images or showing initials would improve polish.
- Opening days mean recorded server state reads from the app, not account logins; the UI truthfully says days opened and states the historical limitation.
- Individual task grids are lazy-rendered and use one keyboard tab stop plus arrow navigation. This avoids an otherwise excessive keyboard path and DOM size.

Round 1 does **not** meet the user's all-categories-at-least-90 threshold. Re-review is required after the improvements above.

## Round 2 — accepted

| Category | Score / 100 |
| --- | ---: |
| Usefulness | 94 |
| Completeness | 94 |
| Functionality / robustness | 93 |
| ADHD usability | 92 |

All four categories meet the requested threshold.

Independently re-read the changed implementation and reran `node scripts/check-life-browser.mjs`; it passed. The revised browser regression uses the genuine Picture-in-Picture API, simulates a hidden opener through the visibility property used by the polling condition, pauses the shared timer remotely, verifies floating controls update, resumes it, advances the isolated clocks past expiry and verifies the floating view switches to the automatic break. The test also verifies phone contribution scrollers open at their latest end and the phone page does not overflow. I visually inspected the generated 390px-wide LIFE OS phone screenshot: recent activity is visible at the right edge, month labels provide orientation, statistics and shortcut controls fit, and task histories remain compact until expanded.

The earlier defects are resolved:

- `lifeTools.isOpen()` now allows shared-state polling even while the opener is hidden. The floating timer receives remote transitions and automatic-break changes.
- Graphs open on recent days, show month labels, and make the latest date the single keyboard entry point. Arrow navigation remains available, and task graphs render on expansion.
- In-app automation instructions now show `?date=YYYY-MM-DD` and explicitly require retaining the source event's workspace date and event ID across retries.
- Failed favicon requests now become a letter tile rather than a broken image.

The scores retain room for measured improvements: these are designed ADHD accommodations rather than user-study results; browser always-on-top support still depends on the platform/secure context; favicon handling uses the conventional site-root icon; and cross-OS foreground-window behavior has not been physically observed in this headless run. Those limits are disclosed and do not block the scoped feature acceptance.
