# Independent content hierarchy and copy review

Reviewed 2026-11-24. Review only: no app implementation was changed.

## Verdict

**Changes requested. The current content order and copy density do not meet the user's priorities. My earlier overall acceptance was too permissive.**

I checked functional integration, missing/duplicate content, phone fit and some ordering defects, but accepted the result without challenging the larger hierarchy. Calling the new social panel “well placed” at the top of LIFE OS was a poor judgment. Accepting Today while its chosen tasks remained below the timer and supporting panels was also a mistake. Functional correctness does not establish a good daily workspace.

The central problem is that the app repeatedly explains and encourages the user before showing their work. Removing disclosure arrows left too much supporting material expanded in the main flow. It needs editorial selection and clear page responsibilities, rather than more containers or smaller type.

## Evidence and scope

I rendered fresh populated and empty workspaces at 1440×1000 and 390×844, inspected phone full-page screenshots and desktop views, and inspected an active-session Today state. Evidence is in `test-results/content-hierarchy/`; measured positions and headings are in `metrics.json`. I read the current page renderers and `applyCalmLayout`. No broad unit rerun was needed for this design review.

Measurements are document-relative CSS pixels at scroll position zero, specific to the fixtures. They vary with user data and text wrapping. The phone dock occupies the bottom of the viewport, so a document position below 844 is certainly outside the initial view.

| Observed element | Phone position | Desktop position | Implication |
| --- | ---: | ---: | --- |
| Today next-action hero | 305 | 248 | One task is visible early, but the rest of the chosen list is not. |
| Today idle timer | 806 | 671 | A full timer interrupts the path to the task list. |
| Today first shortlist task | **2,549** | **2,176** | The chosen list starts roughly three phone viewport heights down. |
| LIFE OS due-people panel | **214** | **198** | Social takes the first main content slot. |
| LIFE OS flame | 794 | 519 | Pushed below the social panel; largely off-screen on phone. |
| LIFE OS chosen graph section | **1,100** | **877** | The user's chosen board is displaced by automatically inserted content. |
| Tasks first task | 564 | — | Header, two add routes and filters consume much of the initial phone view. |
| Social first person | 548 | — | Intro, counts and filters occupy more than half a phone screen. |
| Progress recent session list | 2,280 | — | Earned keepsakes and review material precede useful activity records. |
| Rewards first reward card | 585 | — | An explanation of payouts gets priority over spending coins. |

The empty Today state also puts its shortlist empty state at y=1,861, despite having no tasks. More content is not justified by the lack of user data.

## Findings

### P1 — Today buries the chosen tasks behind unrelated content

**Sources:** `public/app.js:443`, `public/app.js:451`, `public/app.js:458`, `public/app.js:460`, `public/app.js:461`; `public/calm-layout.js:54`, `public/calm-layout.js:11`.

The rendered sequence is page greeting/energy, large next-action hero, idle timer, outcome panel, cue, goal, progress, novelty card, social suggestions, then shortlist. The selected task in the hero is relevant, but it does not replace access to all three chosen tasks. Users cannot quickly check, complete or change the rest of today's work.

`integrateSection` inserts the combined supporting section at the earliest supporting node. This pulls Social from its original tail position ahead of the shortlist, preserving the wrong priority. The layout layer is actively affecting information order, rather than merely styling it.

**Recommendation:** Today should open with the selected task list. Merge the next-action emphasis into the selected row instead of a separate large hero. An explicitly saved outcome can be one short line above the list; the absence of an outcome should not create a panel. After tasks, show a compact completion summary and only directly relevant upcoming appointments. Social check-in tasks belong here through the ordinary task selection; a second social dashboard is unnecessary.

### P1 — The full timer does not belong on Today

**Sources:** `public/app.js:458`, `public/app.js:511`, `public/app.js:349`; `public/calm-layout.js:58`.

Today and Focus both expose timer modes, durations and start/session controls. Today even says “Open focus space” below its own complete timer UI. In the active state, the app shows an existing topbar countdown, a large saved-session hero, the complete timer panel, and another session reminder in the novelty panel.

**Recommendation:** Remove the idle timer from Today entirely. Starting focus from a task should open Focus. During an active session, retain one compact status/control strip or the existing global countdown, with a return-to-Focus action; do not repeat a full timer or session story. Pause/resume can remain a compact convenience if useful. Timer configuration, sound and floating controls belong on Focus.

### P1 — LIFE OS lets new automatic social content outrank the user's board

**Sources:** `public/life-board.js:86`, `public/life-board.js:98`, `public/life-board.js:101`.

The call to `socialCheckinsPanel` appears immediately after the header, ahead of both configured flame and pinned graphs. Four due people make the whole first phone view a Social page. More due people will make that displacement worse because the panel has no compact limit. The user requested a section, not the new primary purpose of LIFE OS.

**Recommendation:** Keep the personal board/flame first. Place a compact check-in section below the primary board, alongside other secondary day information. Show a bounded preview and due count with a Social link, rather than the whole due directory. Preserve the existing completion behavior. Make supplementary modules configurable through Customize; their presence should not implicitly redefine the page hierarchy.

### P2 — Repeated coaching and poetic headings consume space on almost every page

**Sources:** `public/app.js:384`, `public/app.js:433`, `public/app.js:437`, `public/app.js:451`, `public/app.js:511`, `public/app.js:517`; `public/life-board.js:65`, `public/life-board.js:101`; `public/social.js:12`; `public/reward-shop.js:14`.

The repeated structure is date, marketing-style title, reassuring subtitle, another eyebrow, another heading, then a sentence explaining the action. Advice appears again in empty states and footers. This creates reading and scanning work on every return visit. Individual sentences are gentle, but their cumulative presence competes with the user's task titles, dates and numbers.

**Recommendation:** Use the navigation name as the page heading. Retain text that identifies data, explains a consequence, resolves ambiguity or reports state. Remove persistent motivational sentences and move optional onboarding/help into a deliberate Help destination. Do not replace removed prose with extra badges, microcopy or smaller text.

### P2 — Supporting records and collections still outrank useful work on secondary pages

**Sources:** `public/calm-layout.js:71`, `public/app.js:390`, `public/app.js:395`, `public/app.js:520`, `public/app.js:529`; `public/reward-shop.js:15`, `public/reward-shop.js:18`, `public/reward-shop.js:19`; `public/books.js:33`, `public/projects.js:90`.

Progress correctly starts with metrics now, but five large earned keepsakes still precede recent activity; the fresh phone activity list begins around y=2,280. Rewards places the payout explanation before the shop. LIFE OS always adds Projects and Reading, even when they only contain setup prompts. These are the same editorial problem at a smaller scale.

**Recommendation:** Recent activity should follow progress metrics/chart. Rewards should lead with balance, available rewards and outstanding purchases/keys. Put collections in their existing dedicated collection/library destination, with a compact summary link. Show empty modules only when the page's purpose is to create that kind of item; an empty Reading or Projects module should not consume dashboard space by default.

### P2 — Repeated task and person metadata need compression

**Sources:** `public/app.js:420`, `public/app.js:465`; `public/social.js:15`, `public/social.js:16`.

Every ordinary due habit row repeats “Log habit” and “Plan rest for this opportunity” alongside its completion checkbox. A Social person can show a due badge, last date, next date, notes and three actions. These repeated rows amplify page length more than a single title does.

**Recommendation:** Keep task title, checkbox and one main action visible. Show metadata that distinguishes the item; move occasional habit-rest tools into its existing action menu or editor. For a due person, one last-contact/due summary is enough; keep “Checked in” primary, notes short, and occasional planning/task creation actions in the person editor. The user should still reach important details directly without a bottom-of-page catch-all.

## Recommended order for each main page

These are proposed priorities, not implemented changes.

| Page | Ordered main content | Remove or relocate |
| --- | --- | --- |
| **Today** | Small date/title → optional saved outcome line → chosen tasks with selected next task emphasized → compact completion count → relevant next appointment | Remove idle timer, separate oversized task hero, goal/cue/novelty panels and separate social dashboard. Use the global active-session indicator. |
| **LIFE OS** | Small title/Customize → compact flame and chosen graph board → saved shortcuts → compact secondary check-ins → active project/reading summaries only if wanted | Social must follow the board. Omit empty setup modules; keep totals optional. Avoid full project task libraries on the overview. |
| **Tasks** | Title plus one add route → list tabs/search → tasks → pagination | One compact filters action can expose infrequent filters. Remove duplicate New task and always-present quick-add entry points. Compress habit rows and remove repeated list-policy prose. |
| **Projects** | Title/New project → active outcomes with next task → compact waiting/completed destinations | Lead each card with outcome and next task. Full task breakdown follows only when inspecting a project. On an empty Projects page, one short creation prompt is appropriate. |
| **Calendar** | Current period/date and navigation → calendar/events → event creation action → secondary series management | Combine Add time block/Add commitment into one event creation flow with recurrence options. Move export and routine management into deliberate toolbar/dialog actions; keep sync status small. Day appointments remain ahead of setup tools. |
| **Social** | Title/Add person → search/circle filters → due people → other people → upcoming shared plans | Turn three summary counts into one compact “4 due” indicator. Avoid intro paragraphs and repeated last/next/due phrasing. Circle management stays in its own screen. |
| **Focus** | Task selector/name → countdown → start/pause/finish → duration/mode choices when idle → small optional sound/float controls | Remove greeting/date, repeated coaching, footer reassurance and persistent previous-session card while preparing new work. A just-finished receipt can be temporary/contextual. |
| **Capture** | Capture input and Save → search if there are records → saved notes | Already closest to a clear hierarchy. Remove repeated “organize later” language and shorten the empty state. |
| **Progress** | Metrics/period → chart → recent activity → saved reviews/reflections → small level/collection summary | Use the existing collection destination for full keepsake cards. Offer “Write review” as an action when no review exists. Avoid persistent reward formula explanations. |
| **Rewards** | Balance → outstanding key or active reward when relevant → shop → earned/saved rewards → compact goals/collection link | Payout mechanics belong in reward settings/help; recent payout history follows the shop. Remove explanatory cards before purchase options. |
| **Settings** | Title → section navigation → relevant controls → Save | Keep essential provider, credential, import and destructive-action guidance. Remove generic coaching and duplicate section introductions. Settings is the appropriate home for setup/help. |

For **Circles** (a secondary screen), use title/New circle → circle rows → Back to Social. For embedded **Reading**, show an actual current book/progress action; use the existing library to browse finished books. Empty dashboard setup invitations do not need permanent cards.

## Specific copy cuts

The following examples are directly present in the reviewed source. Cut these persistent sentences rather than merely restyling them.

| Location/source | Specific copy to remove or shorten | Keep instead |
| --- | --- | --- |
| Global `public/app.js:384`, `public/app.js:349` | Decorative date on every non-date page; persistent Setup guide action on every page | Dates on Today/Calendar and records; Setup guide in Settings/Help. Keep real offline/error status. |
| Today `public/app.js:451` | “Find your momentum, Monty.” and “One task. A short burst. Then a break.” | “Today” and the actual date. |
| Today `public/app.js:454`, `public/app.js:458` | “ONE THING AT A TIME”, generic “Choose one action you can do in the next two minutes.”, “Two minutes is a valid start.” | Actual next-action text if the user supplied it; otherwise omit the block. |
| Today `public/app.js:433`, `public/app.js:437` | “A small start for the life you want.”, generic cue, novelty/reassurance card | The user's saved outcome, if any, in one line. |
| LIFE OS `public/life-board.js:101` | “YOUR SPACE. YOUR PACE.”, “Only the graphs you chose.”, “Your board starts small. You decide what belongs.”, “Made for coming back, not keeping up.” | “Activity” / “Past 12 weeks”, actual graph names and values. |
| LIFE OS `public/life-board.js:65` | “Look at you, showing up.” and its supporting reassurance | Streak number, activity state and seven-day marks. |
| Tasks `public/app.js:465` | The list-behavior subtitle and repeated footer explanation of All open/Habits/Today | Concise tab names; one-time/help explanation if needed. |
| Calendar `public/app.js:495`, `public/app.js:497`, `public/calendar.js:35`, `public/calendar.js:39` | “Make room for the weeks ahead.”, “Your day, your pace.”, “Select a date to plan that day.”, “Save the schedule once. Every occurrence appears automatically.” | Date/period, event times, recurrence and sync status. Explain recurrence in its editor. |
| Social `public/social.js:14`, `public/social.js:18`, `public/social.js:24` | “ROOM FOR YOUR PEOPLE”, “Remember the last conversation. Make space for the next one.”, “Plans share your calendar, reminders, and watch day feed.”, “No streak to maintain. Just a memory…” | “Social”, due count, names, last-contact dates and real plan information. |
| Focus `public/app.js:511`, `public/app.js:515` | “Keep the next step in sight.”, “Make a little progress. It doesn’t need to be perfect.”, “Pausing is allowed. Partial focus earns credit. Breaks are always free.” | Task title, timer and controls. Put credit policy in Settings/help. |
| Capture `public/app.js:517` | Subtitle “Catch ideas and reminders. Organize them later.” plus placeholder “You don’t have to organize it yet.” | “Capture” and a short “Write a thought…” placeholder. |
| Progress `public/app.js:393`, `public/app.js:398`, `public/app.js:532` | “Keepsakes appear as you do real work. They stay yours when you rest.”, points formula prose, “See what you did. No streak to protect.” | Counts, chart period, level progress; formula via help if requested. |
| Rewards `public/reward-shop.js:14`, `public/reward-shop.js:15`, `public/reward-shop.js:19` | “coins to enjoy”, pre-shop “Every task is a fresh draw” explanation, “Milestones never expire. Ordinary breaks are always free.” | Coin balance, reward cost and duration; payout policy in its setting. |
| Settings `public/calm-layout.js:47`, `public/app.js:550` | “One thing to adjust at a time.” and “Tune your workspace.” | “Settings”, selected section name and precise control labels. |

Do not remove user-written notes/outcomes, actual task steps, status/error messages, form labels, accessibility names, or help needed to understand an irreversible action. Those carry operational meaning. The target is repeated product narration.

## What a corrected design review should require

- On Today, at least the first chosen task and its completion action are visible immediately; the whole three-task selection follows before any secondary module. Verify populated, empty and active-session states.
- On LIFE OS, the user's configured flame/board gets the first content slot. A new social reminder cannot automatically displace it.
- There is no idle timer on Today. An active session has one compact representation outside Focus.
- The reviewer must inspect rendered order and actual scrolling, not count zero overflows or zero disclosure elements as a design success.
- Every default sentence should identify data, explain an action/consequence or report state. Generic reassurance should earn a deliberate place in onboarding rather than repeat across the app.

The existing functional work can remain useful. It does not need to be undone to correct these priorities. This report does not authorize or claim implementation of its recommendations.

## Round 2 — implementation reassessment, accepted

Reviewed the implemented recommendations independently on 2026-11-24. **The earlier P1 content-hierarchy findings are resolved in the observed states. The revised hierarchy and copy are accepted.** This is acceptance of the rendered priorities reviewed here, not a claim that every feature has been exhaustively tested.

### Independent evidence

I read the implementation diff and rendered fresh populated/empty desktop (1440×1000) and phone (390×844) workspaces, plus an active-session Today state. Screenshots and measurements are in `test-results/content-hierarchy-reassessment/`. This used separate temporary workspaces rather than the owner's production data. I inspected the actual screenshots, including Today, LIFE OS, Tasks, Calendar, Social, Focus, Capture, Progress, Rewards, Settings and the empty Projects destination. Populated project behavior was also examined in source. No implementation files were edited by the judge.

| Element | Previous phone position | Revised phone position | Result |
| --- | ---: | ---: | --- |
| First Today task row | 2,549 | **273** | All three fixture tasks and their completion controls now appear before the phone dock. |
| LIFE OS Activity section | 1,100 | **378** | The user's board is visible immediately after the compact flame. |
| LIFE OS social check-ins | 214 | **1,012** | Social follows the board and shortcuts rather than taking the first slot. |
| First Today task, desktop | 2,176 | **180** | The list is the main content, rather than a destination below multiple panels. |

In the equivalent populated phone fixtures, visible text fell from 318 to 76 words on Today, 234 to 139 on LIFE OS, 204 to 107 on Tasks, 198 to 101 on Focus, and 207 to 59 on Rewards. These counts include task names, data and controls; they are supporting evidence of reduced density, not a quality score or a required percentage.

### What is materially better

- **Today:** `public/app.js:426` now directly renders the selected tasks. The separate hero, idle timer, cue/goal/novelty panels and social dashboard are absent. A real saved outcome can occupy one line, and summary/next appointment follow the work. I inspected both empty and active-session states: an active session uses one compact global indicator without displacing the task list.
- **LIFE OS:** `public/life-board.js:96` puts the compact flame and configured graphs first, then shortcuts and a bounded social preview. The check-in panel shows three people with the total due count and circle labels. Supplementary Social/Projects/Reading modules are configurable; empty Projects/Reading cards no longer consume dashboard space.
- **Focus:** task choice, timer and start/pause controls lead. Supporting controls follow; the previous-session receipt is a deliberate Last session action. The repeated coaching prose and persistent receipt no longer dominate preparation for the next session.
- **Tasks/Social:** ordinary task rows and person cards are substantially easier to scan. Habit-rest tools and occasional person actions are available through contextual menus/editors. There is one task-add route, with infrequent task filters behind a local Filters control.
- **Progress/Rewards:** recent focus now follows metrics/chart, ahead of compact collection/level information. Rewards leads with the actual shop and meaningful outstanding purchases; goals, collection and setup have deliberate destinations. The pre-shop payout lecture and large default keepsake grid are gone.
- **Other pages:** plain navigation names, concise empty states and retained operational labels replace most repeated narration. Calendar uses one Add event action with recurrence optional; routine/export tools have an explicit Tools destination. Projects separates Active/Waiting/Done and gives full tasks an explicit inspection action.

### Regression found and corrected during this reassessment

The first revised task-menu polling guard consumed incoming revisions while deferring DOM updates. I independently reproduced a remote task rename arriving while its action menu was open: the saved snapshot received the new title, but closing the menu left the old title on screen through subsequent polls.

The implementation now retains `renderDeferred` until an actual safe render (`public/app.js:296`, `public/app.js:307`, `public/app.js:344`). I reran the exact browser/HTTP reproduction. After closing the menu, the visible task title and saved snapshot both show the remote rename. This regression is resolved in the tested case.

### Remaining refinements, not acceptance blockers

- Today has some redundant empty-state actions (Choose tasks appears in both header and empty state). One can be removed later without changing the successful priority.
- Social cards still use generous vertical spacing; a long directory can be made denser while retaining readable notes and touch targets.
- Focus has several secondary preparation/audio controls. Its primary task/timer/start controls now appear first, so further reduction can be guided by actual use rather than removing useful controls indiscriminately.
- Some obsolete explanatory strings remain in renderer call sites even though the shared heading function suppresses them. Cleaning those source arguments would make the new editorial intent easier to maintain.

The distinction from my earlier acceptance is concrete: the user's work is now visible first in the rendered pages, and supporting content has been selected or moved to deliberate destinations. The verdict is based on that observed ordering and reading burden, not on a zero-overflow check or the absence of disclosure arrows. Broad functional-suite results remain the implementation agent's separate validation; this reassessment does not claim to have rerun them.
