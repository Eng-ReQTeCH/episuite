# EpiBlock — Developer Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Host                                   │
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐                              │
│  │   Frontend    │     │   Backend    │                              │
│  │  (Nginx+React│────▶│  (Fastify)   │──▶ SQLite (persistent)      │
│  │   :8082)      │     │   :3001      │                              │
│  └──────────────┘     └──────────────┘                              │
│         │                    │                                        │
│         │   WebSocket ───────┘                                       │
│         │   (live block updates)                                    │
│         └─────────────────────────────────────────────────────────── │
│                                                                      │
│  Smartwatch App ──▶ HTTPS API ──▶ Backend                           │
└──────────────────────────────────────────────────────────────────────┘
```

- **Frontend**: React SPA served by Nginx, proxies `/api/*` to backend
- **Backend**: Fastify (Node.js) with SQLite via better-sqlite3
- **Database**: SQLite stored on a Docker volume, auto-initialized on first run
- **WebSocket**: `/api/v1/live` for real-time block updates

---

## Project Structure

```
epiblock/
├── docker-compose.yml          # Two services: backend + frontend
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Fastify server entry, WebSocket, hooks
│       ├── db/
│       │   ├── connection.js   # SQLite connection singleton
│       │   └── schema.js       # Schema init, all DB access functions
│       ├── routes/
│       │   ├── lifecycle.js    # /lifecycle/* endpoints
│       │   ├── tasks.js        # /tasks/* endpoints
│       │   └── blocks.js       # /blocks/* endpoints
│       └── services/
│           └── scheduler.js    # Relative time calculation engine
│           └── flowtracker.js  # Velocity/flow tracking
└── frontend/
    ├── Dockerfile              # Multi-stage: build + nginx serve
    ├── nginx.conf              # Reverse proxy /api/ → backend:3001
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx             # Top-level FSM, ticker, initialization
        ├── index.css           # Tailwind + custom animations
        ├── api/
        │   └── client.js       # HTTP API client (fetch wrapper)
        ├── store/
        │   └── useStore.js     # Zustand store — all state + actions
        ├── hooks/
        │   └── useWebSocket.js # WebSocket connection hook
        ├── utils/
        │   ├── time.js         # Date formatting helpers
        │   └── templates.js    # Preset day templates
        └── components/
            ├── SleepScreen.jsx     # Pre-wakeup state
            ├── WokenUpScreen.jsx   # Main app layout
            ├── BlockGrid.jsx       # 4×3 grid of block squares
            ├── TaskSidebar.jsx     # Left sidebar task inbox
            ├── TaskModal.jsx       # Create/edit task form
            └── PrepScreen.jsx      # Day preparation sandbox
```

---

## Running the App

```bash
cd epiblock
docker compose up -d     # Start both services
docker compose logs -f   # Watch logs
docker compose down      # Stop
docker compose build     # Rebuild after changes
```

The app is served at **http://localhost:8082**.

---

## Key CSS Classes

| Class | Purpose |
|-------|---------|
| `.block-grid` | 4-column grid for PrepScreen (scrollable content) |
| `.block-grid-fill` | 4-column × 3-row grid filling available height, used in BlockGrid |
| `.glass-card` / `.glass-header` | Frosted glass effect with backdrop blur |
| `.block-glow` / `.block-glow-active` | Subtle border glow on grid cells, pulse animation on active |
| `.sidebar-card` | Frosted glass for sidebar task items |
| `.dot-online` | Small green pulse dot for API/status indicators |
| `.animate-glow-pulse` | Pulsing glow keyframe for the current active block |

---

## Core Concepts

### Relative Time Engine

The day is divided into 96 blocks of 15 minutes each (block 0–95). Instead of being tied to wall-clock time, blocks are calculated relative to a **T₀ anchor** — the moment you tap "WAKE UP".

```
T₀ = wake_time (e.g., 07:15:00)
Block N starts at T₀ + (N × 15 minutes)
Block 0 = 07:15:00 – 07:30:00
Block 1 = 07:30:00 – 07:45:00
...
Block 95 = T₀ + 23h45m
```

### Hybrid Absolute/Pinned Tasks

Tasks can be pinned to real-world time (`is_absolute: true` with a `target_time`). When a pinned task conflicts with the relative schedule (e.g., you wake up late and a 9:00 meeting overlaps your morning routine), the UI detects the "crunch" and offers resolution options.

### Grid Pagination (4×3)

96 blocks ÷ 12 per page = 8 pages. Each page shows a 4×3 grid (4 columns, 3 rows) covering 3 hours:

| Page | Blocks | Hours |
|------|--------|-------|
| 0    | 0–11   | 0–3   |
| 1    | 12–23  | 3–6   |
| 2    | 24–35  | 6–9   |
| 3    | 36–47  | 9–12  |
| 4    | 48–59  | 12–15 |
| 5    | 60–71  | 15–18 |
| 6    | 72–83  | 18–21 |
| 7    | 84–95  | 21–24 |

### Application States (FSM)

```
SLEEP ──[Wake Up]──▶ WOKEN_UP ──[Prep]──▶ PREP
                       ▲                    │
                       └──────[Back]────────┘
```

### Sidebar Inbox & Drag-to-Grid

Tasks can be created as **unassigned** (inbox/sidebar items) via `POST /tasks/sidebar`. These appear in the left TaskSidebar panel (w-80) with a color chip and a 6-dot drag handle. Drag any sidebar task onto a grid block to move it there (`PATCH /tasks/:id { block_index }`). Tasks can also be dragged between grid blocks to rearrange them. Sidebar tasks persist in the database (`block_id IS NULL`) and survive page reloads. The sidebar is available in both WokenUpScreen and PrepScreen.

### Prep Screen & Multi-Block Selection

The Prep Screen (PREP macro state) is a full planning view with a sidebar, Today/Tomorrow tabs, date picker, Clone Today, preset templates (Work Day, Weekend, Travel), and a "7h Sleep at End" button that fills blocks 84–95 with "Deep Sleep" tasks. In the Tomorrow tab, tapping individual blocks toggles a selection checkbox. When at least one block is selected, a floating pill appears at the bottom to mass-create the same task across all selected blocks.

### WokenUpScreen — Today & Tomorrow Tabs

The main active-day screen (WOKEN_UP macro) now uses the same PREP-style UI. The Today tab shows the 4×3 block-grid-fill view with page navigation (8 pages × 12 blocks). The Tomorrow tab shows a scrollable prep view identical to PrepScreen. The "7h Sleep at End" button appears only in the Tomorrow tabs. The sidebar is available from both tabs.

---

## REST API

Base URL: `http://<host>:8082/api/v1`

### Health

```
GET /health

Response 200:
{
  "status": "ok",
  "time": "2026-07-10T04:28:19.434Z"
}
```

### Lifecycle

#### Wake Up
```
POST /lifecycle/wakeup

Body (optional):
{
  "timestamp": "2026-07-10T07:15:00Z"   // ISO 8601, defaults to now
}

Response 200:
{
  "day": {
    "id": "uuid",
    "date": "2026-07-10",
    "wakeup_time": "2026-07-10T07:15:00.000Z",
    "is_active": 1,
    "is_finalized": 1,
    "created_at": "2026-07-10 07:14:00",
    "updated_at": "2026-07-10 07:15:00"
  }
}

Error 400: { "error": "Already woken up today" }
```
Note: If the day hasn't been finalized, wakeup will finalize it first using the default template.

#### Running Late (Shift Schedule)
```
POST /lifecycle/later

Body:
{
  "minutes": 15      // 15 or 30, shifts T₀ anchor backward
}

Response 200:
{
  "shifted": true,
  "minutes": 15
}

Error 400: { "error": "Not woken up yet" }
```

#### Prepare Day (Get Sandbox)
```
POST /lifecycle/prep

Body:
{
  "date": "2026-07-11"   // ISO date string
}

Response 200:
{
  "day": { ... },
  "blocks": [ ... ]
}
```

#### Finalize Day
```
POST /lifecycle/finalize

Body:
{
  "date": "2026-07-11"   // ISO date string, defaults to today
}

Response 200:
{
  "day": { ... }
}
```
If no blocks exist for this date, they are cloned from the default template.

---

### Blocks

#### Get All Blocks for a Day
```
GET /blocks?date=2026-07-10

Response 200:
{
  "day": { ... },
  "blocks": [
    {
      "id": "uuid",
      "day_id": "uuid",
      "block_index": 0,
      "is_pinned": 0,
      "pinned_time": null,
      "created_at": "...",
      "updated_at": "...",
      "tasks": [ ... ],         // tasks assigned to this block
      "start": "2026-07-10T07:15:00.000Z",   // calculated from T₀ (null if not woken)
      "end": "2026-07-10T07:30:00.000Z",
      "pinned": false           // true if block contains a pinned task
    },
    // ... 96 blocks total
  ]
}
```

#### Get Active Blocks (for Smartwatch)
```
GET /blocks/active

Response 200:
{
  "currentIndex": 5,                          // index of current block
  "blocks": [
    { /* block with start/end/tasks */ },      // current
    { /* next */ },
    { /* next +1 */ },
    { /* next +2 */ }
  ]
}

Error 400: { "error": "Not woken up today" }
```

#### Shift All Relative Blocks
```
POST /blocks/shift

Body:
{
  "minutes": 15       // positive shifts schedule forward (runs late)
}

Response 200:
{
  "blocks": [ ... ]   // all blocks with recalculated times
}
```

#### Block Feedback (Flow Tracking)
```
POST /blocks/feedback

Body:
{
  "block_id": "uuid",
  "completed": true    // boolean: did you finish everything in this block?
}

Response 200:
{
  "success": true
}
```

---

### Tasks

#### List Tasks
```
GET /tasks?date=2026-07-10

Response 200:
{
  "day": { ... },
  "tasks": [
    {
      "id": "uuid",
      "day_id": "uuid",
      "block_id": "uuid",
      "title": "Code Review",
      "description": "",
      "status": "pending",          // pending | in_progress | completed | rolled_over
      "is_absolute": 0,             // 0 or 1
      "target_time": null,          // ISO timestamp if absolute
      "duration_minutes": 15,
      "sort_order": 0,
      "color": "blue",              // color identifier string
      "icon": "💻",                 // emoji/icon string
      "random_order": 0,            // 0 or 1
      "block_index": 5,             // joined from blocks table
      "created_at": "...",
      "updated_at": "...",
      "completed_at": null
    }
  ]
}
```

#### Get Single Task
```
GET /tasks/:id

Response 200: { /* task object */ }
Response 404: { "error": "Task not found" }
```

#### Create Task
```
POST /tasks

Body:
{
  "title": "Code Review",           // required
  "block_index": 5,                 // optional, null or -1 for unassigned (sidebar), omitted for first available block
  "day_id": "uuid",                 // optional, defaults to today
  "description": "Review PR #42",   // optional
  "is_absolute": false,             // optional, default false
  "target_time": null,              // optional, ISO timestamp if absolute
  "duration_minutes": 15,           // optional, default 15
  "color": "blue",                  // optional, default "slate"
  "icon": "💻",                     // optional, default ""
  "random_order": 0                 // optional, default 0
}

Valid colors:
  slate, red, orange, amber, lime, green, teal, cyan,
  blue, indigo, violet, purple, pink, rose

Response 201: { /* task object */ }
Response 400: { "error": "title required" }
```

#### Update Task
```
PATCH /tasks/:id

Body (any subset):
{
  "title": "Updated Title",
  "status": "completed",
  "block_index": 6,
  "color": "green",
  "icon": "🎯",
  "random_order": 1,
  "is_absolute": true,
  "target_time": "2026-07-10T09:00:00",
  "duration_minutes": 30,
  "description": "new desc",
  "sort_order": 1
}

Response 200: { /* updated task object */ }
Response 404: { "error": "Task not found" }
```

**Status transitions**: When status is set to `"completed"`, `completed_at` is automatically set to the current timestamp.

#### Delete Task
```
DELETE /tasks/:id

Response 200: { "success": true }
Response 404: { "error": "Task not found" }
```

#### Clear Remaining Tasks
```
POST /tasks/clear-remaining

Body:
{
  "date": "2026-07-10"    // optional, defaults to today
}

Response 200: { "success": true }
```
Deletes all non-completed tasks for the specified day. Used for the "mid-day reset" feature.

#### List Sidebar (Unassigned) Tasks
```
GET /tasks/sidebar?date=2026-07-10

Response 200:
{
  "day": { ... },
  "tasks": [
    {
      "id": "uuid",
      "day_id": "uuid",
      "block_id": null,               // null = unassigned to any block
      "title": "Buy groceries",
      "description": "",
      "status": "pending",
      "color": "blue",
      "icon": "🛒",
      "duration_minutes": 15,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

#### Create Sidebar Task (Unassigned)
```
POST /tasks/sidebar

Body:
{
  "title": "Buy groceries",      // required
  "day_id": "uuid",              // optional, defaults to today
  "description": "",             // optional
  "color": "blue",               // optional, default "slate"
  "icon": "🛒"                   // optional
}

Response 201: { /* task object with block_id: null */ }
Response 400: { "error": "title required" }
```

#### Assign Sidebar Task to a Block
Tasks are assigned to blocks via `PATCH /tasks/:id` with `block_index`:
```
PATCH /tasks/:id
Body: { "block_index": 5 }

Response 200: { /* task object with block_id and block_index set */ }
```

---

### Velocity/Flow Score

```
GET /velocity

Response 200:
{
  "score": 67,      // percentage, or null if no data
  "total": 12,      // blocks with feedback
  "done": 8         // blocks marked completed
}
```
Score is calculated from block feedback (Yes/No after each block ends).

---

## Database Schema

### days
| Column       | Type    | Description                        |
|-------------|---------|------------------------------------|
| id          | TEXT PK | UUID                               |
| date        | TEXT    | ISO date (YYYY-MM-DD), unique      |
| wakeup_time | TEXT    | ISO timestamp when T₀ was set      |
| is_active   | INT     | 0 = sleeping, 1 = active           |
| is_finalized| INT     | 0 = needs prep, 1 = ready          |
| created_at  | TEXT    | Auto timestamp                     |
| updated_at  | TEXT    | Auto timestamp                     |

### blocks
| Column       | Type    | Description                        |
|-------------|---------|------------------------------------|
| id          | TEXT PK | UUID                               |
| day_id      | TEXT FK | References days(id)                |
| block_index | INT     | 0–95, unique per day               |
| is_pinned   | INT     | 0 or 1                             |
| pinned_time | TEXT    | ISO timestamp if pinned             |
| created_at  | TEXT    |                                    |
| updated_at  | TEXT    |                                    |

### tasks
| Column           | Type    | Description                           |
|-----------------|---------|---------------------------------------|
| id              | TEXT PK | UUID                                  |
| day_id          | TEXT FK | References days(id)                   |
| block_id        | TEXT FK | References blocks(id), NULL = unassigned (inbox) |
| title           | TEXT    | Task name                             |
| description     | TEXT    | Optional details                      |
| status          | TEXT    | pending / in_progress / completed / rolled_over |
| is_absolute     | INT     | 0 = relative, 1 = pinned to real time |
| target_time     | TEXT    | ISO timestamp if absolute             |
| duration_minutes| INT     | Default 15                            |
| sort_order      | INT     | Within-block ordering                 |
| color           | TEXT    | Color identifier (slate, blue, etc.)  |
| icon            | TEXT    | Emoji string                          |
| random_order    | INT     | 0 = sorted, 1 = shuffle on display    |
| created_at      | TEXT    |                                       |
| updated_at      | TEXT    |                                       |
| completed_at    | TEXT    | Timestamp when completed              |

### templates / template_blocks / template_tasks
Same structure as days/blocks/tasks but for saved routine templates. The "Default Routine" template is auto-created on first run.

### block_feedback
| Column     | Type    | Description                    |
|-----------|---------|--------------------------------|
| id        | TEXT PK | UUID                           |
| day_id    | TEXT FK | References days(id)            |
| block_id  | TEXT FK | References blocks(id)          |
| completed | INT     | 0 or 1 (did you finish?)       |
| created_at| TEXT    |                                |

---

## Frontend Architecture

### State Management (Zustand)

The single store (`useStore`) holds all application state:

```
macro:         SLEEP | WOKEN_UP | PREP     (FSM state)
day:           Current day object from API
blocks:        All 96 blocks for today
tasks:         All tasks for today
tomorrowBlocks: Blocks for the prep/tomorrow date
tomorrowTasks:  Tasks for the prep/tomorrow date
sidebarTasks:  Unassigned tasks in the sidebar inbox (persisted via API)
currentPage:   Active grid page (0–7)
prepDate:      ISO date string for the Prep screen target
velocity:      Flow score data
apiStatus:     online | offline | checking
openBlockMenu: Which block's ⋮ menu is open (null | blockIndex)
dragTask:      Task being dragged from sidebar
showSidebar:   Toggle sidebar visibility
selectedBlocks: Array of block indices selected in Prep mode
showMassEdit:  Boolean, shows the mass-create floating pill in Prep mode
loading:       Initial data load in progress
now:           Current timestamp, updated every 1s
```

### Key Actions

| Action | Description |
|--------|-------------|
| `initialize()` | Load all data from API, determine initial macro state |
| `wakeup()` | Finalize day (if needed), set T₀, transition to WOKEN_UP |
| `enterPrep()` | Transition to PREP, load tomorrow's data |
| `finalizePrep(date)` | Finalize a future day, reload |
| `loadBlocks()` | Refresh blocks and velocity from API |
| `loadTasks()` | Refresh tasks from API |
| `loadTomorrow()` | Load blocks, tasks, and sidebar tasks for the prep date |
| `addToSidebar(title)` | Persist a task to the inbox sidebar (via `POST /tasks/sidebar`) |
| `removeFromSidebar(id)` | Remove a task from the sidebar (via `DELETE /tasks/:id`) |
| `dropOnBlock(blockIndex, task)` | Assign a sidebar task to a grid block (via `PATCH /tasks/:id`) |
| `toggleBlockRandomize(blockIndex)` | Toggle random order for all tasks in a block |
| `addSleepAtEnd()` | Fill blocks 84–95 with "Deep Sleep" tasks |
| `clearRemaining()` | Delete all uncompleted tasks for today |
| `setPage(page)` | Navigate to a grid page (0–7) |
| `toggleBlockSelection(idx)` | Multi-select blocks in Prep mode for mass-create |
| `massCreateTask(title)` | Create same task on all selected blocks |
| `clearSelection()` | Clear Prep mode block selection |
| `tick()` | Update `now` timestamp (called every 1s) |
| `checkStatus()` | Poll API health (called every 10s) |

### Component Tree

```
<App>
  ├── <SleepScreen>              (macro === SLEEP)
  ├── <WokenUpScreen>            (macro === WOKEN_UP)
  │   ├── <TaskSidebar>          (left panel, toggleable, w-80)
  │   ├── Header                 (T₀, elapsed, Today/Tomorrow tabs, page nav, status)
  │   │   ├── Today tab          → <BlockGrid> (4×3 fill grid, drag-drop, active glow)
  │   │   └── Tomorrow tab       → .block-grid scrollable, multi-select, clone, templates, 7h Sleep
  │   └── Floating mass-create   (when blocks selected in Tomorrow tab)
  ├── <PrepScreen>               (macro === PREP, full-screen prep with sidebar)
  └── <TaskModal>                (when taskModal or editingTask is set)
```

### WebSocket Events

Connection: `ws://<host>/api/v1/live`

Server pushes:
```
{ "type": "BLOCKS_UPDATE", "blocks": [...] }
```

Client sends:
```
{ "type": "ping" }   →  { "type": "pong" }
```

---

## Extending & Integrating

### Adding a New API Endpoint

1. Define the endpoint in `backend/src/routes/` (create a new file or add to existing)
2. Register it in `backend/src/index.js` with `await routeFile(app)`
3. Add the DB function to `backend/src/db/schema.js`
4. Add the frontend call in `frontend/src/api/client.js`
5. Add the store action in `frontend/src/store/useStore.js`

### Building a Smartwatch Companion

The `/api/v1/blocks/active` endpoint is designed specifically for wearable devices. It returns only the current and next 3 blocks with calculated start/end times so the watch can display a glanceable timeline. The WebSocket is also available for live push updates.

### Docker Customization

- Change ports in `docker-compose.yml`
- For production HTTPS, add a reverse proxy (Caddy, Traefik, Nginx) in front
- The SQLite database persists in a Docker volume (`epiblock-data`)

### Environment Variables

Backend:
- `PORT` — server port (default 3001)
- `DATABASE_PATH` — path to SQLite file (default `/data/epiblock.db`)
- `CORS_ORIGIN` — CORS origin header (default `*`)
