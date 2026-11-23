# Episuite

A single workspace for tasks, habits, time blocks, focus, ideas and optional rewards. Built alongside the original apps, which are unchanged.

## Daily outcomes, habit plans, and quieter focus

Life OS includes a **Reading** section. **Add a book** searches Open Library for title, author, and cover matches. Choose your book, check the page count against your edition, and save your starting page. **Log pages** records the page you reached and shows pages read today. Reaching the saved total moves the book to **Books read**. You can also mark a log as finished, or add an older book directly to the already-read shelf with its finish date. **Edit book** corrects metadata or page numbers. **All books** opens the full paginated shelf.

Reading logs automatically find a single reading task when possible. Use **Reading task** to select a task, disable check-offs, or choose one check-off per day (default), per session, or enough to complete the task's target. Task schedules still apply. The default respects a manual undo; optionally allow a new session to check it off again. Feedback reports partial task progress. Adding or editing book metadata does not create task progress.

**Details** shows the complete paginated session history. Backfill a reading date and starting page, edit a session's date or pages, or delete an incorrect session. These corrections recalculate the book position and reconcile check-offs owned by the affected sessions, preserving manual completions. Older records without completion ownership remain protected; review those historical task check-offs manually. **Change book match / cover** in the editor lets you select another edition while preserving progress and history. Pin books to Life OS; search the full library by title or author, filter by shelf, and sort by title, author, or recent reading.

Books and reading logs are stored with your workspace, synchronize across devices, and are included in JSON backups. Search needs a reachable Open Library service. **Add manually** works when a book cannot be found. Covers load from Open Library and fall back to a placeholder if unavailable.

Today offers a meaningful outcome linked to a task, with estimates for your shortlist and scheduled blocks. The linked eligible task becomes your next action. Closing the day lets you keep an unfinished priority in All tasks, carry its outcome to tomorrow, or schedule a block tomorrow.

Task editors include an explicit next action and optional habit cue, minimum version, and obstacle plan. Habits offer a minimum check-off, planned rest for an opportunity, and rest undo. History shows logged, rested, and missed opportunities over the last 28 days. Minimum check-offs count toward the existing daily target and keep the same undo/reward rules.

Focus includes **Save where I am**, quick capture, a free short break, a generic distraction reset plan, and optional device Focus instructions. **Quiet focus** is independent of rewards. It keeps Today simpler, reduces interruption effects and completion sounds, and defers queued rare-payout delivery while focusing. Calendar reminders remain controlled by their own preference. New workspaces start with quiet focus, fixed task payouts, and streak displays off. Existing reward choices remain available.

Progress includes a weekly review and optional audio/browsing-reset experiments. Trials store only condition, outcome, time, and optional friction on this browser. They expire after 30 days when next accessed or when the workspace opens. They are excluded from server state, backups, notifications, and automation. Use **Delete trial data** to remove them immediately. The browser cannot pause audio or enforce limits in other apps. Speech-free selection is a reminder to pause spoken audio on the device.

Offline captures, reading sessions and corrections, task check-offs, and locally started focus sessions use a durable IndexedDB queue scoped to the workspace. They survive a reload and sync when the server returns, with operation receipts preventing duplicate rewards. A timer started online can also be paused, resumed, finished, or reset during an outage: commands keep their original timer identity and timestamps, and sync in order. A timer changed on another device produces a reviewable conflict. Discarding unrelated queued work preserves the device's active timer. Pending-change review supports correcting, retrying, or discarding conflicts. Task metadata and project edits require the server. The app reports pending activity and local-storage failures.

## Projects, habit schedules, and recovery

**Projects** keeps an outcome, status, waiting reason, and chosen next task together. Add a task directly from a project card with its project preselected; use **Make next** to choose its next task. Waiting tasks and projects stay out of suggested next actions. Task rows show waiting reasons and project membership; project and status filters help review blocked work, including recurring habits. Life OS shows a compact project overview.

Habit repeat options include selected weekdays and a weekly quota. Quotas count Monday through Sunday in the workspace timezone; scheduled rest contributes to the period's target. History begins in the habit's creation week. Changing a quota updates the current week onward and preserves recorded targets for earlier weeks. Progress and streaks follow the chosen schedule.

Open a task's **More actions → History** to log a check-off on a past date, inspect a selected day, move an exact entry to another day, or remove a mistake. Moving preserves its original reward; removing reverses it. Reading-owned check-offs direct you to reading session history so the two histories stay consistent. Corrections require a connection and reject stale edits.

Task, project, reading, next-action, reflection, thought capture, quick-task, daily outcome, and calendar forms recover unsaved drafts on the same browser. If another device changed the record, review its latest values and explicitly accept the draft before saving. Drafts remain local to this browser and are excluded from portable backups. The library also offers **Recently read**, separate from pinned/newly added order, using the latest non-deleted reading session.

Settings → Data → **Manage automatic backups** shows freshness and saved versions. Snapshots default to every 24 hours with 14 versions retained while the server runs. Create one immediately, check its SHA-256 integrity and restore format, download it, or restore it after confirmation. Restore creates a recovery copy first. Portable snapshots exclude connection credentials and live redemption keys; keep your server configuration separately.

Direct Node startup writes snapshots to `data/backups` by default. Set `EPISUITE_BACKUP_DIR` to a mounted separate disk or network destination. Compose uses a separate backup volume; set `EPISUITE_BACKUP_PATH` in `.env` to a host directory on your backup disk. Configure that destination on your server to protect against loss of its primary disk. Checks validate integrity and import compatibility; periodically exercise a restore in a disposable workspace.

Portable JSON exports and imports share a 64 MiB UTF-8 byte limit. A successful export can be imported within that same limit. Larger workspaces require a stopped-service copy of the data directory. Imports validate first and save an owner-readable recovery copy before replacing state.

Use the root [setup and verification guide](../README.md) for current commands. **npm run test:browser** uses the locked Playwright development dependency. **EPISUITE_BROWSER** selects an existing Chromium-family executable. Existing visual scripts also accept that setting. **npm run profile** measures startup, sync, capture writes, and weekly metrics on disposable synthetic histories.

## People, plans, and repeat habits

The [release judge review](SOCIAL-JUDGE.md) records the walkthrough defects, fixes, and final scoped self-review score of **9.9/10**. Regression, browser, PWA installability and offline checks back the assessment; physical-phone installation and long-term outcomes have not been measured.

**Social** keeps people in any number of circles. Save notes and contact details, choose a check-in rhythm (or disable it), and record real conversations with dates and notes. Search by person or notes and filter by circle. A check-in task goes into your inbox; completing it updates Social history, and undoing it removes that linked entry. Open person details to edit or remove records and review history. Removing a circle keeps its people; removing a person unlinks existing tasks and plans instead of deleting them.

**Plans together** are ordinary calendar commitments linked to people: they appear in Social, Calendar, Now, the watch day feed, backups, and calendar exports/sync. They support recurring weekdays, locations, notes, accent colors, and reminders. Existing commitments and blocks can also be linked to people from their editor. Progress includes a seven-day record of check-ins without a streak or penalty. Social is a private planner; it does not send messages or invite other users.

**Calendar colors** are assigned automatically and stored, so renaming a block or moving between views preserves its accent. Change the accent in any block/commitment editor using a preset or custom picker. Names and times remain readable independently of color. Exports include color metadata; external calendars decide whether to display it.

**Twice-daily habits** wait six hours after a completion before returning to Now or the suggested-action picker. Choose a different minimum gap in the task editor (zero allows immediate repeats). The shortlist shows progress and the next eligible time. You can still explicitly record another completion, and **Undo last** reverses a partial completion and its reward. Eligibility resets for the next local calendar day; fully completed tasks stay complete for that day.

## A rewarding daily loop

Now puts one real action first. **Start 2-minute burst** immediately starts its timer and opens quiet focus. Check off a tiny step, park an interruption, pause, or finish early; actual invested minutes are saved. Finishing offers a free break. A persistent session receipt keeps your effort visible and lets you leave a next move for your return.

Choose a small daily goal: two focus minutes, one useful check-off, or ten minutes. A progress ring shows that finish line. Real focus minutes and check-offs grow an illustrated plant and unlock five keepsakes in Progress. One credited focus minute earns one growth point; one check-off earns ten. Browsing, stepping through prompts, and tapping tiny steps earn no growth points. Undo removes the associated check-off points. Taking days off never resets lifetime growth.

A starter responds to a saved session, a break, low energy or your actual next tiny step; otherwise it changes once per day. **Choose another move**, or **Pick something for me** when Today is empty, offers up to three eligible actions from your actual tasks, considering due dates and energy. It starts directly without adding extra tasks to Today. **My reason & cue** links your workspace to a purpose and an everyday moment you choose.

Phones have a thumb-friendly bottom navigation bar. An active session appears first in Now with **Return to my session**, including on another device; breaks have their own recharge screen. In Settings, choose acknowledgments, daily starters, and optional task chime or vibration (where supported). Low-stimulation and reduced-motion preferences quiet the effects. Rewards can be disabled entirely. A saved session’s optional **Too much → quieter** choice turns down acknowledgment, reward chimes and vibration; feedback remains local and earns no points.

The [engagement review](ENGAGEMENT-REVIEW.md) records the original twenty passes and two continued passes. The final simulated design score is **9.7/10**. This assesses the designed engagement loop; actual daily return, addictiveness and ADHD outcomes have not been measured with users.

## Run

Requires Node.js 22 or newer. Run `npm ci` once to install the locked calendar parsing dependencies. No build process or database installation is required. Python is only used by the optional Radicale interoperability test.

To run the isolated interoperability check, install Radicale with `python -m pip install --target test-results/radicale-runtime radicale`, then run `node scripts/check-radicale.mjs`. Set `RADICALE_PYTHON` if your Python executable has a different name or location. The check starts a disposable loopback server and does not access your calendar.

```powershell
cd "D:\ai inference\epi suite\episuite"
npm ci
node server.mjs
```

Open **http://127.0.0.1:3210**. Both `npm start` and the direct Node command are supported.

For another port, set `PORT`. Data is stored in `episuite/data/episuite.json`. `EPISUITE_DATA_DIR` changes that location. Run only one server process per data directory. Writes are serialized within that process and atomically replace the data file. Unreadable data stops startup rather than silently erasing it. Before imports, the server creates `before-import-*.json` recovery files in the same directory.

## One owner, one home server

Run these commands from the **episuite** directory on your home server:

```sh
docker compose up --build -d
docker compose ps
```

Compose publishes to loopback by default. Use Tailscale Serve or an authenticated HTTPS reverse proxy on the host and open its HTTPS address on every device. For intentional direct LAN access, set EPISUITE_BIND_ADDRESS to the host's LAN IP in .env. Each reachable client has owner access. Reverse-proxy the whole app at its own hostname/root, including /api/, and preserve the Host header.

For the Zepp day feed, optionally set EPISUITE_WATCH_TOKEN on the server and the same watch token in Zepp settings. The token grants read access to /api/v1/day. Keep this feed behind your device/network access boundary.

The named volume **episuite_episuite-data** keeps tasks, settings, captures, guide progress and sessions across container rebuilds. Run only one app container against that volume. Foreground clients check changes about every two seconds; unchanged responses carry no state payload. Stale task/block edits preserve your draft and request reopening the editor. Timer controls identify the shared session so an old device cannot stop a newer session. Automatic breaks are managed by the server.

Copy .env.example to .env if you want another port, bind address or initial timezone. Changes to timezone after first startup belong in Settings. Upgrade with docker compose up --build -d. Restart with docker compose restart. docker compose down keeps the volume; **down -v removes the saved workspace**. Export a JSON backup from Settings before upgrades, and keep a copy away from the server. Stop the container before taking a raw volume snapshot. Imports also write a recovery file into the data volume.

Tasks and timers work over plain HTTP on a LAN. App installation and service-worker offline caching require HTTPS, except on localhost. Settings → Add to my home screen explains installation or bookmarking. PNG phone icons and an Apple touch icon are included. See the [MDN service-worker requirements](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

### Install on your phone with Tailscale

For testing, `http://elysium:3210` and `http://192.168.1.113:3210` support the connected app. Those addresses use plain HTTP and cannot provide the full phone PWA/offline experience. When ready for production, run this on **elysium**, where Tailscale and Episuite are running:

```sh
tailscale serve --bg http://127.0.0.1:3210
tailscale serve status
```

Use the **HTTPS `.ts.net` address printed by that command** on your phone. Tailscale Serve stays private to your tailnet and provisions HTTPS; it may ask you to enable HTTPS in the tailnet. The exact hostname depends on your tailnet. See the [official Serve documentation](https://tailscale.com/docs/features/tailscale-serve). On a PC running Tailscale, use that same HTTPS address even while on the home network. You can also continue using the LAN IP for connected PC access to the same server data, but browser caches and offline queues belong to each address separately. Do not alternate addresses before queued offline activity has synced.

On Android, choose **More → Install Episuite** or the browser's Install app menu. On iPhone/iPad, open the HTTPS address in Safari, choose **Share → Add to Home Screen**, and leave **Open as Web App** enabled if shown. More → Install Episuite also reports the connection and offline-cache status. The manifest uses standalone mode and includes PNG icons and an Apple touch icon. Browser installation UI varies by platform; see [MDN's installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

The service worker caches all page modules and icons. When offline, the app reopens your last saved workspace; Capture queues notes and syncs them when the server returns. Reading, task check-offs, and locally started focus sessions queue for sync; metadata edits and shared timer controls need the server. In-app commitment reminders need an open app, and closed-app alarms remain the responsibility of an exported/synced calendar. Installation/offline behavior has been verified in a disposable Chrome profile and a phone-sized browser viewport, not on a physical iPhone or Android device.

Docker is not installed in this development environment, so the container itself has **not** been executed. The image/Compose configuration was reviewed, and the underlying Node server was tested with two independent browser origins, restart persistence, concurrent requests and stale controls.

## A useful first five minutes

New owner workspaces show a welcome with **Start guided setup**. This depends on shared server setup state, rather than an old browser flag. Dismissing the welcome saves a paused guide. **Setup guide** is always in the header and resumes your place on every device. The guide covers Now, Tasks, My day, Focus, Capture, Progress, Rewards and Settings.

Each page explains its purpose and offers an optional real setup action. Add one task, optionally add a commitment, choose a two-minute session, park a thought, create a reward or name a life-area category. Nothing is preloaded. You can continue without completing any action. Guided task creation recommends Today when there is space, and the task list follows the chosen destination.

**Pause & save my place** returns to Now; **Resume setup** picks up the saved step, including after server restart. Explore freely and use **Return to guide** if you navigate away. **Settings → Replay setup guide** starts again without replacing tasks, schedules or preferences. Paused guides also offer a separate restart option.

The final **Save & finish guide** validates and saves the preferences on screen. The closing summary teaches a light daily loop: choose one task, focus briefly, park interruptions and close the day. Scheduling, routines and integrations can grow later. Rewards remain optional, and Quiet view hides the guide while focusing.

Guide progress is saved on your server and included in backups. All first-run walkthrough tests use a separate test workspace.

1. Add a task in **Now**, or throw several things into **Tasks → Inbox** using quick add.
2. Choose up to three open tasks for **Today**. You can move something back to the inbox or someday.
3. Use **Make it smaller** to write a concrete first action. Optional fields stay collapsed.
4. Choose **Let’s focus**, then 2, 10, 25 or 45 minutes. Custom defaults live in preferences. Pausing and partial progress both work.
5. Park distracting thoughts in **Capture**. Convert them into tasks later.

**My day** holds fixed appointments and flexible blocks relative to when you start your day. Overlaps are visible. Shift flexible blocks forward without moving appointments. Prepare tomorrow or another date, clone today, and save/apply routines. Repeating blocks can be daily or weekly.

**Close the day** saves an optional reflection and returns unfinished tasks to the inbox. **Help me restart** offers a two-minute re-entry, without penalties. Energy preferences influence the next suggested task, alongside urgency and task size; they are not a diagnosis or a promise that a task is appropriate.

## Included functionality

- Task creation, editing, descriptions, categories, effort, duration, due dates, manual ordering, tiny steps, completion/undo, soft deletion/restore, search and filters.
- One-off, daily, weekly and custom-interval habits, including multiple completions per day and completion history.
- Focus, short/long breaks, configurable cycles, full-session threshold, partial-minute credit, timestamp-based pause/resume and persistent timers. Optional automatic breaks, gentle chime, noise soundscapes, fullscreen and quiet view.
- Time blocks, task assignment, fixed/flexible time, overnight schedules, recurring blocks, conflict warnings, schedule shifting, wake anchors, templates, future planning, copying and block feedback.
- Focus statistics, weekly chart, recent sessions, active days, reflections, optional coins, custom rewards, reward purchase/redemption timers, unused-time refunds, daily goals, and all 55 original Epidoro unlockables (badges, titles, colors and glows).
- Light/dark/system themes, reduced motion, less stimulation, timer typefaces, local image background, optional muted focus video stored in IndexedDB, name, timezone and volume preferences.
- JSON backup/restore and legacy EpiApps/Epimix imports, including completed/deleted tasks, habit histories, category names, time blocks, historical focus totals, custom rewards and unspent reward time. Additional legacy metadata is preserved in the backup archive.
- Calendar export, optional CalDAV PUT sync and removal of previously synced events, optional local Ollama task breakdown, and an updated Zepp watch companion.
- Service worker caches the app shell. Last-saved data remains readable when the server is unavailable. Thought capture works offline and syncs with idempotent IDs when the server returns. Reading activity, task check-offs, and local focus sessions queue offline; metadata edits require the server.

New JSON imports clear active timers and keep current calendar credentials. Exports exclude calendar passwords and credential-like fields inside archived legacy data. The local data file still contains credentials for optional CalDAV use; keep its directory private.

## Bring your existing data

In **Make it yours → Import backup**, choose an export from epiproducitv, Epimix, Epidoro or Episuite. Supported legacy envelopes include `epiproducitv + shared`, `productivity + shared`, standalone productivity data, and standalone stats data. Review the import dialog before applying it. Your original app files are never modified.

To combine the repository's separate task/stats JSON files, create a backup object with `productivity` containing `epiproducitv.json` and `shared` containing `stats.json`. Import one coherent version at a time. There is no automatic merging of the original and test directories, because those may contain overlapping records.

Alternatively, with Episuite running, `node scripts/import-legacy.mjs --source EpiAppsTest` imports a copy of that directory's existing task and stats files. Use `--source EpiApps` for the original. These commands replace matching new-app records and trigger the same automatic backup as the import screen.

EpiBlock uses SQLite, not these JSON formats. Use its task/block APIs to obtain records; import them through Episuite's task/block APIs with explicit dates and timings. There is no automatic SQLite database migration.

## Optional integrations

**Random task payouts:** Each task or habit completion receives a server-generated surprise amount. Small rewards are common and large rewards are rare; the payout distribution and possible amounts are not published in the interface or browser assets. Undo and redo preserve the original award. Focus and gentle goals keep their usual coins.

**Custom rewards and phone screentime:** Rewards → Create a reward supports personal rewards and phone screentime keys. Set a name, whole-coin price, and minutes; Edit adjusts existing shop options. Phone packages allow 1–1440 minutes, with built-in 15-minute and 60-minute options. Buying one deducts coins and generates a saved one-use key. Give that key to your Android automation, which POSTs it to `/api/screentime/redeem`; a successful response returns the purchased minutes and deletes the key atomically. Keys survive server restarts but are excluded from exports. Imports preserve live redemption records. See [SCREEN-TIME-API.md](SCREEN-TIME-API.md) for the exact request, response, errors, and automation behavior.

**Phone delivery:** Settings → Phone notifications supports either your own ntfy server or a Telegram bot. For ntfy, enter the server URL, topic, and optional access token; subscribe to the same server and topic in your phone's ntfy app. For Telegram, create a bot through @BotFather, send it `/start`, and retrieve your numeric chat ID from `https://api.telegram.org/bot<TOKEN>/getUpdates`; enter the token and chat ID in Settings. Save and enable the connection, then choose **Send test notification**. The delivery status appears below the form. Tokens remain in the server data file and are excluded from API state and exports; blank token fields keep saved credentials and the remove checkboxes clear them. Backup imports preserve the current phone connection.

The server checks every 30 seconds for rare task payout alerts, calendar reminders, and focus/break completion, independently of browser tabs. Keep Episuite running and the selected service reachable. Calendar reminders are sent when due until their event starts; old reminders are not replayed after an outage. Delivery jobs and receipts survive restarts, with up to five attempts and exponential backoff; expired messages are dropped. Switching connections discards pending messages. Delivery is at least once: a crash after the provider accepts a message but before its receipt is saved may produce a duplicate. Protect private ntfy topics with access controls. Browser notification permission is not needed for phone delivery. iOS self-hosted ntfy installations may need the upstream push configuration described in the [ntfy server documentation](https://docs.ntfy.sh/config/#ios-instant-notifications).

**Calendar and commitments:** Calendar offers month, week, a 30-day agenda, and daily planning. Navigate previous/next periods or pick any date. Add a commitment with a fixed time, duration, selected weekdays (for example Sunday and Monday), optional end date, location, notes, and reminder. Occurrences appear automatically throughout the calendar and watch day feed. Edit or delete the entire series, or skip an individual occurrence in the day view. The series editor can restore skipped occurrences. The default commitment reminder is 15 minutes before each occurrence.

**Reminders:** Enable device reminders from Calendar. Episuite checks due reminders every ten seconds while open, using your workspace timezone and suppressing repeated alerts on that browser. In-app reminders work without notification permission. Configure Phone notifications for server-driven delivery with the browser closed, or import the alarm-bearing .ics export into your calendar / sync to a CalDAV calendar that supports alarms.

**CalDAV:** Enter the full calendar collection URL, username, and password in preferences. Radicale is verified against an isolated real server. Use **Sync this range** in Calendar, or **Sync today** in settings: local commitments and blocks are uploaded if missing; server events are imported into Calendar, Now, Social where linked, and the watch feed. Sync tracks resource identities and ETags, avoids repeat uploads, propagates one-off edits and deletions both ways, and protects simultaneous edits with conditional requests. Local recurring commitments are uploaded as dated occurrences for the selected range (up to one year); sync later ranges when needed. Sync runs when requested, not on a background schedule. Server recurrence rules and exceptions remain on the server; imported occurrences are protected from local editing. All-day and events over eight hours appear as protected blocks of up to eight hours; edit them in your calendar client. Conflicts keep both copies and are reported; restore the local fields to their last synced values before syncing to accept a server edit. Export this range downloads alarm-bearing .ics. Use the original collection to reconcile tracked events before changing providers. HTTPS is recommended.

**Ollama:** install the configured model on a reachable Ollama server. Direct Node startup defaults to `127.0.0.1:11434`. Docker defaults to `host.docker.internal:11434`, mapped to the Docker host; Ollama must listen on an address reachable from that container. Set `EPISUITE_OLLAMA_URL` to its full `/api/generate` URL in .env when using another host/container. In task editing, choose **Break into small steps**. Suggestions fill the editor for review; they do not save automatically. Manual steps work without it. Live model generation has not been exercised here.

**Zepp watch:** the `watch/` directory contains the original companion with an updated display that uses Episuite's real block start/end timestamps and refreshes each minute. Build it with the existing Zepp workflow and device-specific assets from the original project. Point its server URL at a reachable Episuite address. `/api/v1/day?date=YYYY-MM-DD` supplies the day, blocks, task statuses and wake anchor. The API is tested; no physical watch or Zepp simulator was available.

Direct Node startup and the published Compose port bind to loopback by default. Set HOST or EPISUITE_BIND_ADDRESS explicitly for intended LAN access. This is a personal, single-owner app.

## Verify

```powershell
node --test tests/domain.test.mjs tests/server.test.mjs tests/integrations.test.mjs tests/extra.test.mjs tests/onboarding.test.mjs tests/engagement.test.mjs tests/home-server.test.mjs
node scripts/check.mjs
```

Run `npm run verify` for source checks, the full unit/integration suite, and browser walkthroughs. The tests use temporary directories and local HTTP mock services. They never read or modify your original app data. The inventory generator is `node scripts/audit.mjs`.

Read [AUDIT.md](AUDIT.md) for source comparisons and feature decisions, and [USER-JUDGE.md](USER-JUDGE.md) for the simulated evaluation and revisions. The user judge score is a usability assessment by the building agent, not independent user research or a clinical efficacy result.

## LIFE OS, simpler tasks, and automation

See [LIFE-OS.md](LIFE-OS.md) for contribution histories, the unified task list, n8n completion setup, webapp shortcuts, and the floating focus/break timer. **All open** now shows every unfinished task; **Today** is a small selection from that same list. LIFE OS is available from the sidebar and phone More menu.

LIFE OS now starts with a personal, empty graph board: pin only the graphs you want, view compact twelve-week cards in a grid, and hide unwanted sections in Customize. A growing daily flame lights after today’s first real work. Recently deleted tasks also support permanent deletion with confirmation. See [LIFE-OS.md](LIFE-OS.md).

Task rows now include a small daily streak flame. Pages show their main action first, with bounded lists and supporting tools available on demand; Settings displays one category at a time. See [PAGE-LAYOUT.md](PAGE-LAYOUT.md) for where to find each tool and [PAGE-LAYOUT-JUDGE.md](PAGE-LAYOUT-JUDGE.md) for the independent all-page review.
