# Independent social, calendar and app review

Reviewed 2026-11-24 by an independent judge agent. The judge did not change implementation files.

## Round 1 — changes requested

The social and calendar core flows are sound in the exercised cases. The layout pass initially replaced collapsed catch-all sections with expanded catch-all sections, retaining empty content and duplicate headings. That did not yet meet the request to blend useful content into the main UI and give unnecessary content no space.

### Independently verified

- Ran `node scripts/check-checkins-browser.mjs` with installed Edge: passed. The exercise creates a person through the real form, enables automatic tasks, completes the generated task from LIFE OS, verifies the Social check-in, undoes it, imports one-off and recurring mock calendar events automatically, changes to a future date and verifies automatic import, and opens eleven main pages at desktop and phone widths.
- Ran `npm test`: all 119 tests passed, including HTTP persistence, completion/undo integration, task deduplication and one-off versus recurring calendar classification.
- Read the changed server/domain/UI code and inspected desktop/phone screenshots for LIFE OS, Social, Calendar, Today, Focus, Progress and Rewards.
- LIFE OS's new due-people section is clear, appears early, groups by primary circle and shows other memberships without duplicating the person. Completion uses the existing task completion path and records a Social check-in.
- Automatic sync is debounced, serialized in the browser, throttled per range/connection, retries after failure and shows visible status. One-off imports now have `commitment: false`; recurring imports retain recurrence metadata.

### Required improvements

1. **Honor deletion of an automatic task.** Reproduced directly: create an opted-in due person, generate their task, set that task deleted and run reconciliation. A fresh open task appears immediately. Restoring the deleted task can then leave two open tasks. Preserve the user's deletion decision for that due cycle, or make deletion clearly disable automation, and cover deletion/restoration in a regression.
2. **Finish integrating useful page content.** The initial phone Rewards screenshot repeats Gentle goals; Progress repeats Focus history/Recent focus; empty Upcoming plans, saved timers and empty histories still occupy substantial space. Remove redundant wrappers/headings and render supporting sections only when meaningful.
3. **Keep appointments ahead of planning tools on phones.** The initial Calendar day screenshot placed the full routine/setup panel above the actual Future meeting, pushing the event roughly 1,300px down. Preserve the appointment timeline as the first content after date controls; keep setup/routine actions secondary and compact.
4. **Update existing browser checks to the intended UI.** Social, calendar and layout scripts still query removed details/summary selectors. Maintain their behavioral coverage using visible sections; do not leave routine regression scripts waiting for deleted controls.

### Overall app assessment

The app has substantial local-first functionality and useful regression coverage: tasks and habits, history corrections, social records, reading, calendar reconciliation, timers, backups, offline operations and notification delivery. Domain tests provide good evidence of persistence and transaction behavior. The new social addition fits this model well.

The main weakness observed in this pass is the presentation layer's post-render relocation of unrelated nodes. Generic wrapping can create duplicate headings and promote secondary tools over primary content; passing overflow checks cannot establish a useful information hierarchy. Phone screenshots should be assessed for ordering and unnecessary length as well as fit.

The review uses temporary workspaces and a mock CalDAV server. It does not establish compatibility with the owner's actual calendar provider, physical-device behavior, or a production data migration. No claim of comprehensive live production validation is made.

## Round 2 — accepted after independent rereview

The requested changes are accepted within the tested scope. No unresolved blocking defect was found in the final reviewed implementation.

Independently reran `node scripts/check-checkins-browser.mjs` against the revised code: passed. Re-read the revised code and inspected refreshed empty/populated phone screenshots, the new LIFE OS check-in panel on desktop/phone, and the actual dark-mode panel after explicitly waiting for `body.dark` (`test-results/judge-checkins-dark-phone.png`). The independently run unit/HTTP suite passed all 119 tests. The judge also ran a separate HTTP reproduction covering generated-task deletion, restoration and conflicting restoration.

The required improvements are resolved:

- Deleting an automatically generated task explicitly turns off that person's automatic-task setting, disclosed in person-editor help and a toast. Restoring reenables it. The independent HTTP reproduction confirmed no replacement task appears on deletion and restoring an older task while another is active returns 409 rather than introducing a duplicate.
- Calendar's phone day view now shows appointments before setup and routines. Export remains in the toolbar; automatic sync has visible status. One-off imported events are excluded from recurring commitments; real remote series appear once per calendar resource with truthful connected-calendar wording and a View event action.
- Progress starts with real totals and the weekly chart. Empty focus history, empty reflections, undiscovered-only keepsake grids and zero-activity growth panels no longer occupy space. Existing earned progress follows the primary metrics. Populated history has pagination.
- Empty Social upcoming-plan panels and empty reward timers are removed. Rewards headings are no longer duplicated. Phone automation instructions open from a small action. Focus sound controls remain with the timer, and saved session receipts remain visible when relevant.
- Project tasks are visible with pagination on both Projects and LIFE OS; finished books use the book library. Existing regression scripts were updated to target the visible content instead of deleted disclosure summaries.

The final app is coherent and useful in the observed states. Its strongest qualities are persistent local-first records, synchronized task/check-in history, recoverable task actions, and broad automated domain coverage. The revised layout gives primary work priority and avoids the previous bottom-of-page catch-all drawers.

Remaining non-blocking refinements: Calendar routine controls are still tall on a phone; populated Progress can remain long when all keepsakes are earned; and the layout is still partly assembled through DOM relocation, which requires careful regression checks when page markup changes. These do not prevent the requested behaviors or hide primary information in the tested states.

This acceptance is an independent engineering and usability assessment, not user research. Actual calendar-provider interoperability and physical-device behavior remain outside the observed test scope. The independent judge changed only this report.
