# LIFE OS and completion automation

Open **LIFE OS** from the sidebar or phone **More** menu. It shows dated contribution grids for tasks, habits, life-area categories (including hobbies), focus minutes, and app-opening days. Choose a year or find a task by name/category. Task histories expand individually, so a large task library does not mount hundreds of year grids at once. Individual squares have date/count labels; keyboard users can enter a grid once and use arrow keys. Deleted tasks with retained history still contribute. No streak or score penalizes time off.

Opening days begin with this release: older login history cannot be reconstructed. Work days are dates with retained check-offs or positive focus minutes. Focus time and check-offs are separate measures, so a focus session is not presented as a completed task. Categories represent life areas; create habits for hobbies such as German or music to track them.

**Tasks → All open** is the default and contains every unfinished task, including legacy Inbox and Someday records. **Today** is a selection of up to three from that same list. **Remove from today** keeps the task in All open. Habits, Done, and Recently deleted are filters. Task-row **History** opens its contribution graph. Storage/API lane names remain compatible with existing backups and integrations.

## n8n / Home Assistant / other automation

From LIFE OS, choose **Connect n8n / automation**, then **Create token**. Copy the token immediately into your automation's credential store. Replacement invalidates the old token; disabling prevents further calls. Tokens and receipt data stay on the server and are excluded from normal state responses and exported backups. Importing a backup preserves the current live automation credentials and receipt ledger.

In n8n, use an HTTP Request node with Header Auth: `Authorization: Bearer YOUR_TOKEN`. Use the Episuite address reachable from n8n, with authenticated HTTPS for access beyond your trusted network. This remains the existing single-owner home-server app; the dedicated completion API does not add account authentication to the rest of the app.

List available tasks with `GET /api/automation/tasks`. Each entry includes `id`, `title`, recurrence, target, today's count, and completion status.

Send `POST /api/automation/complete?date=2026-10-30` with `Content-Type: application/json`:

```json
{"taskId":"COPY_TASK_ID","eventId":"german-lesson-2026-10-30-001"}
```

Use an ID derived from the source event, not a new random value on each retry. Set the query date to the source event's day in your workspace timezone so retries after midnight retain the same date. Omitting it uses the workspace's current day. Dates are validated. The response envelope includes `result` with taskId, date, eventId, done, count and delta; a retry adds `duplicate: true`. Existing app state is also returned without secrets.

A new event adds one completion, up to the daily target. An already-complete task remains complete. Retrying the same event never toggles completion or pays twice, even after restart. Distinct events allow twice-daily habits to reach their target. Explicit automation events, like explicit manual check-offs, can record work during a habit's suggested waiting interval. Reusing an ID for another task/date returns 409. If a human undoes an event, retrying it still does not reapply it; send a genuinely new event to record new work.

Errors: 400 invalid body/date/eventId; 401 missing/invalid/disabled token; 404 unknown/deleted task; 409 event ID conflict or full receipt ledger; 415 wrong content type. Requests are serialized and saved atomically. The ledger retains up to 100,000 event IDs; new events then require token rotation. Rotation starts a fresh ledger, so do not replay old event streams with the new token.

## Webapp shortcuts

Choose **Create shortcut**, enter a name and full HTTP(S) URL. Links open in a new tab. The icon is requested directly from the website's `/favicon.ico`, without sending a referrer; no server-side arbitrary URL fetch is used. The shortcut name stays visible if the website has no icon. Edit and remove controls are beside each shortcut. Shortcuts and opening-day history are backed up and synchronized.

## Floating focus / break timer

Start a session, then choose **Float timer ↗** in Today or Focus. In a supported desktop browser over HTTPS or localhost, Document Picture-in-Picture opens an always-on-top window with remaining time, the task, pause/resume, finish and return controls. After finishing, start a break directly there. Closing this window leaves the shared timer running; closing the originating tab closes the floating document. Other-device changes and automatic breaks update the floating view through the existing state synchronization.

Unsupported browsers and plain LAN HTTP show setup guidance. An ordinary browser popup cannot guarantee always-on-top placement, so it is not presented as a substitute. Browser behavior follows the [Document Picture-in-Picture documentation](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/).
