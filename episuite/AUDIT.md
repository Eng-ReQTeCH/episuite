# Repository audit and consolidation

The source inventory covers **55 application/configuration files and 17,883 lines** across EpiApps, EpiAppsTest and EpiBlock. Vendored Zepp documentation, private data, bytecode and dependency directories are excluded. `SOURCE-INVENTORY.json` records paths, line counts, hashes, routes and function names. This is an application/source audit, not a claim to have reviewed every vendored SDK guide.

## Best versions

| App | Finding | Strongest source |
| --- | --- | --- |
| epiproducitv | Test version has 32 Flask routes and 1,002 backend lines, versus 15 routes and 417 lines in the original. Adds robust repeat parsing, multiple daily completions, editing, recovery, category management, focus-session credit, blocks, presets and CalDAV. | `EpiAppsTest/epiproducitv/app.py` and `templates/index.html` |
| Epidoro | The Python backends are byte-identical, at 190 lines and 11 routes. Most functionality is in the HTML/JavaScript. Richest focus, cosmetic, reward, achievement and IndexedDB implementation. | `EpiAppsTest/epidoro/templates/index.html` |
| Epimix | Backends are nearly identical, 416 vs 417 lines with 17 routes each. Combines basic tasks with a draggable timer but does not contain the later task/block capabilities. | Useful consolidation reference, not the most complete task foundation |
| EpiBlock | Separate React/Zustand + Fastify/SQLite architecture. Adds wake-relative 15-minute blocks, fixed tasks, day lifecycle, templates, tomorrow planning, schedule shifting, WebSocket updates and Zepp watch readout. | `epiblock/backend/src/`, `frontend/src/`, `Smartwatch app/epiblock-watch/` |

## How the legacy apps work

The Flask applications render large single-template interfaces and save shared stats and productivity to separate JSON files. Completion and focus work earn coins. Streaks, daily counters, quests and cosmetic unlocks are derived from those records. Epidoro also caches state and media in IndexedDB. Epimix offers a combined screen but duplicates task/reward logic. The test productivity app adds time-block assignments and CalDAV events.

EpiBlock stores days, blocks, tasks and templates in SQLite. Its wake timestamp is the anchor for up to 96 quarter-hour blocks. Fixed/pinned tasks are placed on the wall clock. The frontend store fetches routes and subscribes to updates, while the watch's phone-side service requests `/api/v1/day`. Flow tracking records completed block feedback.

## Problems found

- Cross-app read/modify/write of shared JSON is not transactional. Stats and task state can diverge or concurrent actions can overwrite each other.
- Flask apps import POSIX `fcntl`, so several cannot start directly on Windows. The test Epidoro backend uses an app-local data directory despite the compose shared-volume intent.
- Multiple places derive a day from UTC (`toISOString`) rather than the user's local timezone.
- Some countdowns use decrementing interval callbacks, which drift in throttled background tabs. Other implementations use timestamps; Episuite standardizes the stronger approach.
- The EpiBlock frontend suppresses many API errors. Some optimistic actions look successful even if persistence fails. Its clone/template calls omit the chosen date in places.
- EpiBlock `shiftBlocks` subtracts from the anchor for a positive shift, moving time earlier instead of later. The new app adds positive minutes to flexible blocks.
- The watch's legacy display assumes every block is 15 minutes relative to wake, so fixed appointments need a timestamp-aware companion.
- Dense settings, effects, gamified streak loss, randomized goals involving opening settings/muting/dragging, and several competing apps add work that is unrelated to the user's actual task.

## Coverage and redesign decisions

| Legacy capability | Episuite implementation |
| --- | --- |
| Tasks, categories, difficulty and repeats | Unified Tasks screen, effort, energy, duration, custom intervals and multiple daily completions |
| Editing, reordering, deleted task recovery | Essentials-first editor, explicit move up/down controls, recently deleted list and undo |
| Task history and habits | Date-keyed completion history, due calculation, partial habit targets and preserved imported history |
| Pomodoro and breaks | One persistent timer across the workspace, configurable focus/break lengths and cycle-based auto-breaks |
| Partial session credit | Elapsed minutes count; the configurable threshold distinguishes full sessions |
| Fullscreen/draggable timer | Fullscreen/quiet focus and persistent navigation timer replace dragging a floating card |
| Sounds and appearance | Gentle completion chime, synthesized soundscapes, volume, light/dark/system, font choice, optional image or browser-stored muted focus video, reduced motion and low stimulation |
| Rewards and redemption | Custom rewards, coins, timed redemption, purchases, unused-minute refunds and anti-farming undo accounting |
| 55 time unlockables | Original catalogue preserved; badges/titles/colors/glows are optional and can be cleared |
| Streaks and randomized daily quests | Accumulated active days and permanent milestones replace fragile streaks; goals reward actual starts and completion instead of clicking settings |
| Statistics and charts | Unified focus history, weekly chart, completion totals, reflections and block feedback |
| Fixed/relative blocks and conflicts | Variable-length fixed appointments and wake-relative blocks, with overlap warnings and positive schedule shifting |
| Day preparation/templates | Any-date planning, today/tomorrow shortcuts, saved routines, copy day and explicit day start/close |
| Sidebar inbox and assignment | Task lanes, a three-open-task shortlist and checkbox task assignment to blocks |
| WebSocket updates | Revision-aware five-second polling and immediate mutation responses keep views current without another dependency |
| Calendar | Per-date ICS export, CalDAV PUT synchronization and tracked event removal |
| Local model integration | Optional Ollama breakdown with review before saving; no model dependency for normal work |
| Watch | Adapted Zepp companion and a timestamp-based day API |
| Backup/import/PWA | Atomic server persistence, automatic pre-import backup, legacy JSON migration, cached shell, offline capture and reconnect sync |

This consolidates the functional purposes, rather than reproducing every visual option or interaction literally. External font catalogues, physics-based card dragging and animated aurora themes are replaced by calmer appearance/focus controls. Optional focus video remains available but is suppressed by reduced-motion and low-stimulation settings. The 96-square representation becomes a readable variable-length timeline. Legacy metadata is retained in archived backups, including old streak and cosmetic settings.

## ADHD-oriented design rationale

The defaults reduce simultaneous decisions: one suggested next action, a three-task shortlist, a visible first step, and optional details. Capture externalizes reminders without making organization a prerequisite. A two-minute restart lowers the cost of returning. Time estimates, a visible end time, wake-relative planning and transition blocks make time more concrete. Partial effort counts, ordinary breaks are free, and missed days do not remove progress.

Reduced distractions, short focus periods and movement breaks are consistent with [NICE NG87 environmental-modification guidance](https://www.nice.org.uk/guidance/ng87/chapter/recommendations). The particular product choices are design judgments. No clinical benefit is inferred from a simulated judge score.

## Known practical limits

- CalDAV was tested with a local mock, not a user's live provider. No account discovery or automatic two-way calendar reconciliation is claimed.
- Ollama needs a running local model; physical watch installation/display needs Zepp tooling and a supported device.
- The server is single-process and personal-use. It has no login or cross-device offline merge.
- Offline capture syncs; task mutations and new focus sessions still require the server. Existing timers use their saved deadline but settlement occurs when the server is reachable.
- JSON legacy migration is supported; automatic EpiBlock SQLite extraction is not included. Its data can be mapped through the task/block APIs.
- Local image and video backgrounds are supported; legacy video files remain in the old app's browser storage and must be selected again in Episuite. Video is stored per browser and is not included in JSON backups.
