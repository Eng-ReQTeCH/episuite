# Task streaks and calmer page layouts

Each task row now shows a small flame and the number of consecutive calendar days with at least one recorded check-off. Completing a task lights its flame for today. Before today's check-off, the count through yesterday remains visible with a gray flame. Repeated check-offs on one day count as one day. A gap resets the current run; undo updates it immediately. The task streak uses completion history rather than focus minutes. The workspace-wide LIFE OS flame continues to count either completed work or recorded focus time.

The layout review covers all ten main pages, populated and empty workspaces, desktop and phone views, Calendar's four views, and active Focus. The independent judge's scores and iterations are in [PAGE-LAYOUT-JUDGE.md](PAGE-LAYOUT-JUDGE.md).

- **Today:** the next action and three-task shortlist come first. The idle timer is under **Choose a timer instead**. Progress, daily starters, thought parking, restart support, and social suggestions remain under **More for today**.
- **Tasks:** six rows per page, with library-wide search and existing filters. Completion, title, streak, and one main action remain visible. **More (⋯)** contains History, Remove from today, reorder, and edit tools. Tap the task name to edit directly.
- **Calendar:** phones open to Agenda. Empty agenda dates do not repeat down the screen. Month view fits the phone width with date targets and appointment counts; choose a date for full event details. Week view opens around today with a swipe cue. Export/sync, recurring commitments, reminders, and day routines have named optional sections.
- **Social:** four compact people cards per page with check-in as the primary action. Notes, circles, plans, and task creation remain available through **Notes & more**, **Manage circles**, and **Upcoming plans**. Search still covers all people.
- **Focus:** the clock and Start/Pause/Finish controls fit the initial phone view. Sound and saved-session details open separately. Thought parking, quiet view, floating mode, and task selection remain available.
- **Capture:** capture remains first. Notes are searchable and shown four at a time, with paging for the rest.
- **Progress:** real totals and the weekly chart lead. Growth/keepsakes, focus history, and reflections/support open separately.
- **Rewards:** balance and four compact shop options lead. More menus contain editing/removal. Goals, payouts, milestones, saved timers, and phone setup remain accessible in named optional sections. Live reward timers and outstanding phone keys stay visible.
- **Settings:** choose one named section instead of seeing every form at once. Ordinary appearance/accessibility controls come first. Focus, feedback, phone delivery, backups/categories, Calendar sync, backgrounds/local AI, and help each have a destination. Phone delivery shows only the selected provider's credential fields.
- **LIFE OS:** its existing compact personal board and customization remain unchanged.

These are presentation changes: existing tasks, histories, rewards, settings, and integrations remain in the same workspace. List pages and optional sections do not delete or archive records.


Social now has an always-visible search and circle filter bar. **Manage circles** opens a separate screen for creating/editing circles; individual filters have no edit menus. Upload or remove each person’s picture in their editor; uploads are cropped to a 160px thumbnail, saved with the person, and included in backups. Initials appear when no picture is set.

In **Settings → Mobile navigation**, select four different pages in the order you want. **More** remains the fifth dock button and exposes every page. Changes synchronize across devices.

**Float timer** uses the browser’s standard video Picture-in-Picture window with a drawn timer, mode, and task. The native play/pause control also pauses/resumes the shared timer. **Interactive PiP** uses Document Picture-in-Picture for additional buttons. Both need browser support; HTTPS or localhost is recommended. Closing either floating view leaves the timer running. Keep the original tab open. Browser/OS restrictions can affect placement; native video PiP was verified in Chromium, not by physically switching foreground desktop applications.


Profile photo uploads now open an inline crop editor. Zoom, rotate with the slider or 90° buttons, and drag to reposition; horizontal/vertical sliders support keyboard adjustment. **Use photo** applies a 160px thumbnail; **Cancel crop** keeps the previous photo. The person form cannot save an unfinished crop.

For recurring tasks, **All open** shows only currently eligible habits. **Habits** retains every routine on rest days. Interval/weekly streaks count consecutive scheduled check-offs: Sunday and Tuesday on an every-two-days habit produce a streak of two, without Monday breaking it. The streak remains valid through the next due day and resets after that day is missed. Daily routines still count consecutive calendar days. A partial check-off counts as recorded activity, consistent with the existing daily flame. Calendar cells and event tints are now brighter, while saved event colors remain intact.
Calendar now marks the current workspace-local day with a **Today** badge and a stronger outline. Under **Settings → Calendar appearance & sync → Calendar appearance**, choose **Gray out past days** or **Draw an X over past days**, then save. Both styles apply to month, week, and agenda cells, preserve access to their events, and synchronize across devices. The X overlay does not intercept clicks. Today and future days are never marked as past.


## Social check-ins and integrated pages — 2026-11-24

This update supersedes the earlier bottom-disclosure layout described above. Useful content now appears as ordinary sections in its page context. Empty Social plans, reward timers, Progress histories/reflections and undiscovered-only keepsakes are omitted. Progress starts with real totals and the weekly chart. Calendar day appointments precede routines on phones; desktop places routines beside the timeline. Sound controls stay with the Focus timer. Project task lists are paged on both Projects and LIFE OS; finished books open the existing library. Item action menus and settings navigation remain available.

LIFE OS shows people whose check-in rhythm is due today, grouped by their primary circle, with other circle memberships shown once. No due people means no panel. Each person's editor has an opt-in to automatically create a check-in task when due. Existing people stay opted out. The server creates at most one open contact task per person and recreates it when their next interval becomes due. Completing it records a Social check-in; undo removes that linked entry. A direct Social check-in retires an outstanding automatic task without claiming task completion. Deleting an automatic task turns off that person's opt-in; restoring reenables it, and restoration is rejected if another open contact task already exists.

A configured Calendar syncs the displayed date range automatically after navigation, with a short debounce and a one-minute refresh/retry interval while visible. Sync status and failures appear in the toolbar. No calendar credentials means no automatic network attempt. One-off imports remain one-off events; actual recurring imports retain calendar recurrence metadata and appear once per remote series in the recurring commitments list. Recurring remote series are managed in the connected calendar client.

Validation uses temporary workspaces and a mock CalDAV server, including navigation to an initially unloaded future range. It does not change the owner's live calendar. Independent findings and final review are in [SOCIAL-CALENDAR-JUDGE.md](SOCIAL-CALENDAR-JUDGE.md).
