# Calendar acceptance

- [x] Month, week, agenda and day navigation work across date boundaries.
- [x] Sunday/Monday commitments appear only on selected weekdays within their date range.
- [x] Commitments persist, edit as a series, and allow skipping an occurrence.
- [x] Reminders use the workspace timezone and calendar exports contain alarms.
- [x] Calendar export and CalDAV sync accept date ranges and reconcile removed occurrences.
- [x] Existing tests and source checks pass; new tests cover recurrence, alarms and persistence.

Verification: `npm test` and `npm run check` from `episuite`, plus browser inspection.

Evidence: 56 tests pass; source checks and diff whitespace checks pass. The isolated Chrome browser check creates a Sunday/Monday commitment, switches all four views, skips one date, edits the series, reloads, and checks the 390px phone layout. Desktop and phone screenshots were inspected. CalDAV coverage uses a local mock rather than a live provider. In-app reminders require an open app; exported/synced alarms depend on the receiving calendar.
