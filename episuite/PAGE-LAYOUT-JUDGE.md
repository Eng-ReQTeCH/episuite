# Independent page-layout judge

## Scope and method

Review of every primary page for an easily overwhelmed ADHD user. Scores separately cover **layout** (hierarchy, readability, control placement and responsive behavior) and **content load** (how much is exposed before asking, competing choices, repetition and unbounded lists). A page's acceptance score is the lower of its two scores. The requested threshold is 95 for every page; scores are design judgments rather than measured clinical outcomes.

Round 1 independently inspected the rendered populated desktop and phone pages, full-page captures, empty phone states, idle/active Focus, and Calendar day/week/agenda alternatives in `test-results/page-layouts/`. Read the relevant render functions in `public/app.js`, `public/social.js`, `public/reward-shop.js`, `public/calendar.js` and responsive CSS. The saved metrics helped locate long pages; graph data squares were not counted as ordinary competing actions. Toasts visible in these first captures are transient test leftovers and were not treated as permanent page content.

## Round 1 — revisions required

| Page | Layout | Content load | Acceptance |
|---|---:|---:|---:|
| LIFE OS | 96 | 96 | 96 |
| Today | 90 | 78 | 78 |
| Tasks | 91 | 86 | 86 |
| Calendar, including alternative views | 88 | 80 | 80 |
| Social | 92 | 85 | 85 |
| Focus, idle and active | 92 | 91 | 91 |
| Capture | 95 | 90 | 90 |
| Progress | 90 | 79 | 79 |
| Rewards | 91 | 82 | 82 |
| Settings | 88 | 60 | 60 |

### Concrete changes needed

- **Today:** phone capture is 3084px tall. Next action competes with a second full timer configurator, cue, goal, daily strip, starter, shortlist, capture form, restart controls and social panel. Keep the actionable task/timer and shortlist first. Put supporting motivation, day statistics and social context behind clearly named optional disclosure. Prefer one timer entry path rather than two competing Start choices.
- **Tasks:** flame and count are appropriately small and the gray/active distinction is clear. However, phone rows become roughly 200px high because Focus/Today, Remove from today, History and edit controls stack beside a narrow task title. Keep checkbox, full readable title/flame, concise metadata, one primary action and one More action; move secondary tools into More/details. Avoid adding permanent labels around each flame.
- **Calendar:** agenda renders all 30 dates, including roughly 27 separate empty-day messages; the phone capture reaches 4271px. Collapse/skip empty agenda dates, provide a brief range summary, and bound visible entries. Put export/sync/reminder/series instructions behind optional tools. On phone week view, today's Friday appointments are offscreen while Sunday–Tuesday fill the visible strip; orient the scroll to today or clearly signal the horizontal range. In day view, show real time blocks before the explanatory planning sidebar.
- **Social:** seven full person cards create a 2853px phone page with repeated dates, notes and three actions per person. Use more concise initial records, keep check-in primary, and disclose notes, next-plan/task actions and larger history in person details or More. Bound initial visible people and keep search/circle filtering apparent. Upcoming plan context can be optional below the people list.
- **Focus:** primary Start/Pause controls fall near or behind the phone dock because of oversized stage spacing and repeated explanatory copy. Tighten vertical spacing and prioritize task, remaining time and primary timer controls within the first usable viewport. Keep the long session receipt and secondary extras optional. Preserve the large readable clock and explicit break states.
- **Capture:** capture form has a clear primary purpose and works well empty. With saved notes, every full card and its two actions is exposed; show a bounded initial set and make older notes searchable/show-more/paged. Do not remove notes or move capture itself behind a disclosure.
- **Progress:** five colorful keepsake cards precede the main statistics, followed by graph, two support panels, ten sessions, reflections and social. Phone capture is 3440px. Lead with a compact real-progress summary; make collection, session history and reflections optional sections. Do not present a large locked-card collection on an empty workspace.
- **Rewards:** eight full shop cards, payout explanation, goals, milestones and redemption history create 3601px on the phone. Keep shop/balance primary, use more compact bounded reward cards, and put goals/collection/payout details behind named secondary views. Preserve ready-to-use purchased keys/timers as prominent when present.
- **Settings:** phone capture is 6584px, exposing every notification service credential field, integrations, sound/timer controls, backup actions and help at once. Organize into named categories with only the selected category exposed. Begin with ordinary appearance/focus settings. Treat credentials and infrequent integrations as deliberate secondary destinations. Every existing setting must remain findable and saveable.
- **LIFE OS:** already meets the threshold. Selected compact graphs, a single flame focal point and configurable sections make its content bounded; no new expansion is warranted for this task.

Round 1 does not meet acceptance. Re-review must inspect regenerated images and the actual revised controls, rather than changing only scores.

## Round 2 — accepted

| Page | Layout | Content load | Acceptance |
|---|---:|---:|---:|
| LIFE OS | 96 | 96 | 96 |
| Today | 95 | 96 | 95 |
| Tasks | 96 | 95 | 95 |
| Calendar, including month/day/week/agenda | 95 | 95 | 95 |
| Social | 95 | 96 | 95 |
| Focus, idle and active | 96 | 95 | 95 |
| Capture | 96 | 96 | 96 |
| Progress | 96 | 96 | 96 |
| Rewards | 95 | 95 | 95 |
| Settings | 95 | 96 | 95 |

Every primary page now meets the requested 95 threshold in both dimensions. These scores follow material layout changes, not merely shorter copy or smaller type.

### Independent evidence

Re-read `public/calm-layout.js`, the task-flame rendering and final responsive CSS. Inspected the regenerated populated phone full-page views of all ten pages, their desktop views, empty phone states, active Focus, the provider-specific Settings connection view, and explicit Calendar day/week/agenda/month captures. Independently reran `node scripts/check-page-layouts.mjs`; it passed with `Page layout browser checks passed`. The walkthrough exercises real settings-section saves, category creation, provider-specific controls, task search and its More/history action, note search, and expansion of the Progress collection, in addition to completion/undo streak updates.

- **LIFE OS:** retains its compact chosen-graph board and single flame focal point. No unrelated content was added to it.
- **Today:** primary action and the three-item shortlist now define the default screen. The alternate timer is a deliberate disclosure, and motivation, day statistics, capture and people are grouped behind one clearly named supporting section. Phone main-content height fell from 2961px to 1184px in the same fixture.
- **Tasks:** each row keeps completion, readable title, small flame/count, concise metadata, one main action and More. Secondary controls no longer force a vertical action stack. The six-row page bound prevents the task library from determining screen length, while search works across the library. The flame is visibly quiet when today is unrecorded; completing and undoing updates its number and active state.
- **Calendar:** agenda now contains dates with actual plans, rather than repeating dozens of empty-day messages. Export/sync and recurring-plan instructions are optional. Day view starts with the timeline; its setup/routine explanation follows behind a disclosure. The phone week capture opens around today's appointments with an explicit swipe hint. The explicit populated phone month image shows all seven date columns at 390px width, readable date targets and appointment counts; full appointment text belongs in the selected day view. Phone main-content height for the agenda fixture fell from 4148px to 1413px.
- **Social:** four people per page, one check-in action each, and optional notes/extra actions give the list a predictable rhythm. Circle management and upcoming plans remain available without competing with the initial people list. Search remains prominent. The same phone fixture fell from 2730px to 1347px.
- **Focus:** the clock remains large, but Start and active Pause/Finish now fit in the usable first phone viewport. The active-phone image demonstrates these controls above the dock. Sound and the longer saved-session receipt no longer fill the default screen.
- **Capture:** writing and saving a thought stays first. A visible note search and four-note page bound make a populated capture area manageable without losing older thoughts or adding configuration before capture.
- **Progress:** real statistics and one weekly chart now lead; collection, session history, reflection and support material open only when wanted. Both populated and zero-state pages avoid a wall of colorful or locked keepsakes. Phone main-content height fell from 3317px to 1043px.
- **Rewards:** balance and four compact shop cards are the main content. Editing/removal is in More, and goals, payout history, collection and saved-timer setup are named secondary sections. Two-column phone cards retain readable names and ordinary action targets. The fixture fell from 3478px to 1110px.
- **Settings:** one named section is visible at a time. The ordinary appearance/accessibility category is the initial destination, Save remains accessible, and infrequent connections are intentional destinations. The phone connection view shows only the chosen provider's credentials. Phone main-content height fell from 6461px to 1084px for the initial category.

### Remaining design limits

Calendar still has several necessary navigation/view controls, and phone content with real records requires some scrolling. Long names can wrap in task/reward cards. Opening every optional section intentionally makes a page longer; the acceptance scores apply to the calm default with secondary functionality available on demand. This assessment covers the supplied populated/empty desktop and phone fixtures and inspected controls, not a longitudinal user study or physical-device touch study.


### Screenshot freshness follow-up

The earlier empty-month capture ambiguity is resolved. The capture script now waits for the selected Calendar view and explicitly asserts an empty fixture has zero server blocks and zero calendar events/counts in the DOM. Independently inspected the uniquely named fresh image `test-results/page-layouts/empty-month-verified.png`: the month is empty, with no appointment counts, while all seven date columns remain legible. The previously viewed file path appeared to retain an older image in the image viewer. This follow-up does not change the accepted scores.
