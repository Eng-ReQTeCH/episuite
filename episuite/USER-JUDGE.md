# Simulated user judge

## Latest release: calendar colors, habit spacing, Social and PWA

The current scoped release review is **9.9/10**, following 9.4 and 9.7 walkthrough passes and their corrections. See [SOCIAL-JUDGE.md](SOCIAL-JUDGE.md) for the rubric, observed evidence, defects corrected, and external validation limits. This remains a building-agent self-review. The earlier reviews below are historical assessments of previous releases.

## Guided-onboarding pass

The owner accepted the revised appearance, then identified friction in turning the workspace into a daily system. They requested a general page-by-page guide that starts light, rather than personally preloaded routines.

The guide now covers all eight pages, links to real optional setup actions, saves its place, resumes after reload, permits skipping, respects disabled rewards, and ends with a small daily loop. Browser checks exercised task creation, commitment-form cancellation, two-minute selection, capture, a custom reward, a custom category, replay, pause/resume and saving a ten-minute preference on completion. The guided task list follows the task's chosen lane. Phone layout was checked at 390 × 844.

Revised simulated scores: functionality **8.6**, usefulness **8.8**, intuition/fluidity **8.7**, ADHD-oriented support **8.8**. Equal-weight total **8.725**, reported as **8.7/10**. The long Settings page and optional advanced planning still require learning. This remains a self-review, not an independent study or a measured ADHD outcome.

## Owner feedback and replacement visual pass

The owner rejected the look of the version previously scored 8.5 below. That score is historical and did not establish visual acceptance. The replacement uses a bold next-action panel, a readable timer, a progress strip and a finished-shortlist state that offers rest. See [DESIGN.md](DESIGN.md) for the research interpretation and aesthetic decisions.

| Criterion | Revised score | Evidence and limitation |
| --- | ---: | --- |
| Functionality | 8.5 | All 32 existing tests pass; new browser checks cover creation, first steps, completion, capture, break choices and paused timer persistence. External integration limits remain. |
| Usefulness | 8.7 | The current action and written first move are prominent. Shortlist completion offers a break instead of demanding more work. |
| Intuition and fluidity | 8.4 | Stronger hierarchy, explicit labels, visible progress and less vague copy. Phone navigation still requires a horizontal swipe to reach some tools; advanced settings remain lengthy. |
| ADHD-oriented support | 8.8 | Short focus options, reduced competition, thought parking, immediate acknowledgment, written cues, optional quieter surfaces, and rest without punishment. No clinical or dopamine outcome was measured. |

Equal-weight simulated total: **8.6 / 10**. This is the building agent's assessment, not an independent user study or the owner's approval of the new appearance.

The revision was exercised on desktop and at 390 × 844, with light, dark and low-stimulation modes. A preference-save bug found during the walkthrough was fixed: saving appearance no longer replaces a selected short break with the focus duration. Screenshot examples use disposable test data, separate from the owner's workspace.

The building agent switched to the requested user-judge role and assessed the application through browser walkthroughs. This is a candid self-assessment, not an independent participant study. The ADHD criterion concerns design support for starting, remembering, prioritizing, time awareness and returning after interruption; it does not measure clinical outcomes.

## First pass: 7.35 / 10

| Criterion | Score | User-judge finding |
| --- | ---: | --- |
| Functionality | 7.7 | The core works, but errors need better validation, and several advanced capabilities still need checking. |
| Usefulness | 8.0 | Tasks, focus and capture finally share one workspace. Small starts and partial credit are useful. |
| Intuition and fluidity | 6.1 | The first task opens too many fields. Phone navigation forces horizontal page overflow. Planning tools take precedence over the schedule. |
| ADHD-oriented support | 7.6 | Helpful defaults, but setup still asks for too many decisions. The interface needs better recovery and less visual competition. |

Equal weighting: `(7.7 + 8.0 + 6.1 + 7.6) / 4 = 7.35`. Below the user's threshold, so this version was revised.

## Revisions prompted by the walkthrough

- Task creation now starts with title, lane and time estimate. Categories, recurrence and tiny steps expand only when needed. The first field receives keyboard focus.
- Mobile layout constrains grid children correctly. Navigation scrolls within its own row instead of widening the document. Settings remains accessible on a phone.
- Mobile planning keeps day start visible and collapses routines and advanced controls so the schedule gets room.
- Capture continues without the server and safely synchronizes on reconnect with idempotent identifiers.
- The three-task cap counts completed habits correctly. Yesterday's completed one-off tasks no longer clutter Now. A new day returns unfinished one-off tasks to the inbox.
- Validation errors return useful messages. Timer credit is idempotent, and reopening a completed timer later credits its actual finish date.
- Reward undo accounting prevents repeating completion/undo to farm rewards. Imported reward minutes survive migration.
- Calendar sync/removal and optional AI responses have positive and failure-case mock checks. Watch responses contain real timestamps and task statuses.
- The original 55 cosmetic unlockables remain accessible in an optional collection. Ordinary breaks remain free; rewards can be switched off.

## Final pass: 8.5 / 10

| Criterion | Score | User-judge assessment |
| --- | ---: | --- |
| Functionality | 8.5 | Core workflows work, survive reload/restart, and have failure-case coverage. Calendar, local AI and watch paths exist, with clearly stated external testing limits. |
| Usefulness | 8.6 | One inbox, an intentionally small daily list, focus, time blocks and captured thoughts remove substantial switching and organizing work. |
| Intuition and fluidity | 8.2 | Starting a task, capturing an idea, pausing and returning are straightforward. Advanced planning and preferences still take some learning. |
| ADHD-oriented support | 8.7 | Concrete first steps, low-decision defaults, two-minute restarts, energy-aware suggestions, visible time, partial credit, free breaks and non-punitive progress support common friction points. |

Equal weighting: `(8.5 + 8.6 + 8.2 + 8.7) / 4 = 8.5`. The revised version exceeds the requested 8/10 threshold.

## Evidence

- **32 automated checks passed**, with zero failures, cancellations, skips or todos. They cover domain behavior, HTTP integration, persistence, concurrency, imports (including standalone Epidoro numeric task IDs), timers, CalDAV, optional AI response handling, offline capture deduplication and watch timestamps.
- Source syntax and required assets passed `scripts/check.mjs`.
- Actual original and test JSON datasets pass migration validation independently: 28 tasks in EpiApps; 9 tasks and one time block in EpiAppsTest. They were not automatically merged or overwritten.
- Desktop browser: created a task, added tiny steps, assigned it to Today, started focus, paused, reloaded, verified the paused timer, and saved two real elapsed focus minutes.
- Browser: captured a reminder, verified it in Capture, converted it into an inbox task, and opened the preserved 55-item unlockable collection.
- Offline browser: stopped the server, captured a thought, restarted, reloaded and verified successful synchronization.
- Phone viewport **390 × 844**: task editing, wake-relative block creation, task assignment, day start, calendar export control and settings remained usable. The document width after the overflow fix was 375 px within the 390 px viewport, including its scrollbar. Light and dark themes were inspected.
- Keyboard C opened capture and focused its text area. Native dialog controls, close/cancel behavior, visible focus styles, semantic navigation and a skip link are present. This is not a full assistive-technology certification.
- Evidence images: `test-results/mobile-plan.jpg` and `test-results/desktop-now.jpg`. They use disposable walkthrough data; the shipped workspace is reset to empty afterward with an automatic backup of that data.

## Why this is not a 10

There is no independent ADHD user study or long-term evaluation. The app requires its local server for task editing and new focus sessions. Calendar providers, a real Ollama model, physical watch behavior, installability across phone browsers, and Docker execution need environment-specific verification. No authentication or automatic multi-device conflict resolution is provided. Those are material limitations, not hidden completion claims.
