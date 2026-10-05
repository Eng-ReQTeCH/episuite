from flask import Flask, render_template, request, jsonify
import json
import os
import time
import fcntl
from datetime import datetime, timedelta, timezone

try:
    import caldav
    import caldav.lib.error as caldav_err
    CALDAV_AVAILABLE = True
except ImportError:
    CALDAV_AVAILABLE = False

def ical_escape(text):
    return str(text).replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\n").replace(",", "\\,").replace(";", "\\;")

def build_rrule(recurrence):
    if recurrence == "daily":
        return "RRULE:FREQ=DAILY"
    if recurrence == "weekly":
        return "RRULE:FREQ=WEEKLY"
    if isinstance(recurrence, str) and recurrence.startswith("interval_"):
        try:
            n = max(1, int(float(recurrence[len("interval_"):])))
            return f"RRULE:FREQ=DAILY;INTERVAL={n}"
        except ValueError:
            return None
    return None

def sync_block_to_calendar(block, date_str, caldav_config):
    if not CALDAV_AVAILABLE:
        return {"error": "caldav library not installed"}
    if not block.get("scheduled") or not block.get("startTime") or not block.get("endTime"):
        return {"error": "Block not scheduled"}
    url = caldav_config.get("url", "").strip()
    username = caldav_config.get("username", "").strip()
    password = caldav_config.get("password", "").strip()
    cal_name = caldav_config.get("calendarName", "").strip()
    if not url or not username or not password:
        return {"error": "CalDAV not configured"}
    try:
        client = caldav.DAVClient(url=url, username=username, password=password)
        principal = client.principal()
        cals = principal.calendars()
        calendar = None
        if cal_name:
            calendar = next((c for c in cals if cal_name in str(c)), None)
        if not calendar and cals:
            calendar = cals[0]
        if not calendar:
            return {"error": "No calendar found"}
        start_dt = datetime.strptime(f"{date_str}T{block['startTime']}:00", "%Y-%m-%dT%H:%M:%S")
        end_dt = datetime.strptime(f"{date_str}T{block['endTime']}:00", "%Y-%m-%dT%H:%M:%S")
        if end_dt <= start_dt:
            end_dt += timedelta(hours=1)
        uid = f"tb-{block['id']}@{'epiproducitv'}"
        task_names = block.get("taskNames", [])
        desc = "Timeblock: " + ical_escape(block.get("name", ""))
        if task_names:
            desc += "\\nTasks: " + ical_escape(", ".join(str(n) for n in task_names))
        rrule = build_rrule(block.get("recurrence"))
        parts = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//epiproducitv//EN",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%S')}",
            f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%S')}",
        ]
        if rrule:
            parts.append(rrule)
        parts.append(f"SUMMARY:{ical_escape(block.get('name', 'Timeblock'))}")
        parts.append(f"DESCRIPTION:{desc}")
        parts.append("END:VEVENT")
        parts.append("END:VCALENDAR")
        ical_str = "\r\n".join(parts)
        existing_url = block.get("calEventUrl")
        if existing_url:
            try:
                event = caldav.Event(client=client, url=existing_url, data=ical_str)
                event.save()
                return {"status": "updated", "url": existing_url}
            except Exception:
                pass
        event = calendar.save_event(ical_str)
        return {"status": "created", "url": str(event.url)}
    except caldav_err.AuthorizationError:
        return {"error": "CalDAV auth failed"}
    except Exception as e:
        return {"error": f"CalDAV error: {str(e)}"}

def delete_calendar_event(caldav_config, event_url):
    if not CALDAV_AVAILABLE or not event_url:
        return False
    try:
        client = caldav.DAVClient(url=caldav_config.get("url",""), username=caldav_config.get("username",""), password=caldav_config.get("password",""))
        event = caldav.Event(client=client, url=event_url)
        event.delete()
        return True
    except Exception:
        return False

app = Flask(__name__)
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
os.makedirs(DATA_DIR, exist_ok=True)

SHARED_STATS = os.path.join(DATA_DIR, 'stats.json')
PRODUCTIVITY_FILE = os.path.join(DATA_DIR, 'epiproducitv.json')

DEFAULT_PRODUCTIVITY = {
    "tasks": [],
    "categories": [
        {"id": "personal", "name": "Personal", "color": "#a78bfa"},
        {"id": "work", "name": "Work", "color": "#3b82f6"},
        {"id": "health", "name": "Health", "color": "#22c55e"},
        {"id": "learning", "name": "Learning", "color": "#f59e0b"},
        {"id": "chores", "name": "Chores", "color": "#f97316"}
    ],
    "productivityStreak": {"current": 0, "lastActiveDate": None},
    "lastResetDate": None,
    "timeblocks": {
        "blocks": [
            {"id": "tb_deep", "name": "Deep Work", "color": "#ef4444", "taskIds": [], "order": 0, "scheduled": False, "startTime": "09:00", "endTime": "11:00", "calEventUrl": None},
            {"id": "tb_admin", "name": "Admin & Commms", "color": "#3b82f6", "taskIds": [], "order": 1, "scheduled": False, "startTime": "11:00", "endTime": "12:00", "calEventUrl": None},
            {"id": "tb_breaks", "name": "Breaks & Reset", "color": "#22c55e", "taskIds": [], "order": 2, "scheduled": False, "startTime": "15:00", "endTime": "16:00", "calEventUrl": None}
        ]
    },
    "blockPresets": [],
    "deletedTasks": []
}

def safe_read_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, 'r', encoding='utf-8') as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            data = json.load(f)
            fcntl.flock(f, fcntl.LOCK_UN)
            return data
    except Exception as e:
        print(f"Error reading {path}:", e)
        return default

def safe_write_json(path, data):
    tmp_path = path + '.tmp'
    try:
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_path, path)
    except Exception as e:
        print(f"Error writing {path}:", e)

def load_shared_stats():
    default_shared = {
        "stats": {
            "days": {},
            "allTime": {"pomodoros": 0, "focusMinutes": 0, "tasksCompleted": 0, "coins": 0, "totalCoinsEarned": 0, "redeemableMinutes": 0},
            "shopPurchases": {},
            "equippedTitle": None,
            "equippedColor": None,
            "equippedGlow": None,
            "unlockedTimeItems": [],
            "customShopItems": [],
            "streak": {"current": 0, "lastActiveDate": None},
            "dailyQuests": None,
            "dailyCounters": None
        },
        "tasks": [],
        "config": {}
    }
    return safe_read_json(SHARED_STATS, default_shared)

def save_shared_stats(data):
    safe_write_json(SHARED_STATS, data)

def load_productivity():
    data = safe_read_json(PRODUCTIVITY_FILE, DEFAULT_PRODUCTIVITY)
    if isinstance(data, dict):
        merged = DEFAULT_PRODUCTIVITY.copy()
        merged.update(data)
        return merged
    return DEFAULT_PRODUCTIVITY.copy()

def save_productivity(data):
    safe_write_json(PRODUCTIVITY_FILE, data)

def get_today():
    return datetime.now().strftime("%Y-%m-%d")

def get_yesterday():
    return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

def parse_repeat(raw):
    if isinstance(raw, bool) or raw is None:
        return "none"
    if isinstance(raw, (int, float)):
        if raw <= 0:
            return "none"
        if raw == 1:
            return "daily"
        return f"interval_{raw}"
    s = str(raw).strip().lower()
    if s in ("none", "daily") or s.startswith("interval_"):
        return s
    try:
        n = float(s)
        if n <= 0:
            return "none"
        if n == 1:
            return "daily"
        return f"interval_{n}"
    except ValueError:
        return "none"

def repeat_interval_days(repeat):
    if repeat == "daily":
        return 1.0
    if isinstance(repeat, str) and repeat.startswith("interval_"):
        try:
            return float(repeat[len("interval_"):])
        except ValueError:
            return None
    return None

def repeat_limit_per_day(repeat):
    interval = repeat_interval_days(repeat)
    if interval is None:
        return 1
    return max(1, int(round(1.0 / interval)))

def get_task_completions(task, date_str):
    hist = task.get("history") or {}
    entry = hist.get(date_str)
    if entry is None:
        return []
    if isinstance(entry, list):
        return entry
    if isinstance(entry, dict) and isinstance(entry.get("completions"), list):
        return entry["completions"]
    coins = entry.get("coins") if isinstance(entry, dict) else 0
    if not isinstance(coins, (int, float)):
        coins = 0
    return [{"coins": coins}]

def migrate_history_entry(task, date_str):
    hist = task.setdefault("history", {})
    entry = hist.get(date_str)
    if entry is None:
        entry = {"date": date_str, "completions": []}
        hist[date_str] = entry
        return entry["completions"]
    if isinstance(entry, list):
        return entry
    if isinstance(entry, dict) and isinstance(entry.get("completions"), list):
        return entry["completions"]
    coins = entry.get("coins") if isinstance(entry, dict) else 0
    if not isinstance(coins, (int, float)):
        coins = 0
    hist[date_str] = {"date": date_str, "completions": [{"coins": coins}]}
    return hist[date_str]["completions"]

def recompute_task_streak(task, today):
    dates = sorted(task.get("history", {}).keys())
    streak = 0
    check = datetime.strptime(today, "%Y-%m-%d") - timedelta(days=1)
    while True:
        if check.strftime("%Y-%m-%d") in dates:
            streak += 1
            check -= timedelta(days=1)
        else:
            break
    task["streak"] = streak

def any_task_done_today(prod, today, exclude_id=None):
    for t in prod.get("tasks", []):
        if t.get("id") == exclude_id:
            continue
        if t.get("repeat") == "none":
            if t.get("history", {}).get("__once__", {}).get("date") == today:
                return True
        elif today in (t.get("history") or {}):
            return True
    return False

def update_productivity_streak(prod):
    today = get_today()
    if prod.get("lastResetDate") == today:
        return False
    for task in prod.get("tasks", []):
        interval = repeat_interval_days(task.get("repeat"))
        if interval is None:
            continue
        last = task.get("lastCompleted")
        if not last:
            continue
        try:
            last_dt = datetime.strptime(last, "%Y-%m-%d")
            if last_dt < datetime.strptime(today, "%Y-%m-%d") - timedelta(days=interval):
                task["streak"] = 0
        except ValueError:
            continue
    prod["lastResetDate"] = today
    return True

def update_prod_streak_counter(prod, today):
    ps = prod.setdefault("productivityStreak", {"current": 0, "lastActiveDate": None})
    if ps["lastActiveDate"] == today:
        return False
    if not any_task_done_today(prod, today):
        return False
    if ps["lastActiveDate"] == get_yesterday():
        ps["current"] += 1
    else:
        ps["current"] = 1
    ps["lastActiveDate"] = today
    return True

def award_shared_coins(shared, today, coins):
    stats = shared["stats"]
    stats["allTime"]["coins"] = stats["allTime"].get("coins", 0) + coins
    stats["allTime"]["totalCoinsEarned"] = stats["allTime"].get("totalCoinsEarned", 0) + coins
    stats["allTime"]["tasksCompleted"] = stats["allTime"].get("tasksCompleted", 0) + 1
    if today not in stats.get("days", {}):
        stats["days"][today] = {"pomodoros": 0, "shortBreaks": 0, "longBreaks": 0, "focusMinutes": 0, "tasksCompleted": 0}
    stats["days"][today]["tasksCompleted"] = stats["days"][today].get("tasksCompleted", 0) + 1

def validate_block(block):
    if not isinstance(block, dict):
        return None
    if not (block.get("name") or "").strip():
        return None
    start = str(block.get("startTime", "09:00"))
    end = str(block.get("endTime", "10:00"))
    try:
        datetime.strptime(start, "%H:%M")
        datetime.strptime(end, "%H:%M")
    except ValueError:
        return None
    task_ids = block.get("taskIds", [])
    if not isinstance(task_ids, list):
        task_ids = []
    try:
        order = int(block.get("order", 0) or 0)
    except (TypeError, ValueError):
        order = 0
    return {
        "id": str(block.get("id") or "tb_" + str(int(time.time() * 1000))),
        "name": str(block.get("name")).strip()[:60],
        "color": str(block.get("color") or "#64748b").strip(),
        "taskIds": [str(t) for t in task_ids],
        "order": order,
        "scheduled": bool(block.get("scheduled", False)),
        "startTime": start,
        "endTime": end,
        "calEventUrl": block.get("calEventUrl"),
        "scheduledDate": block.get("scheduledDate"),
        "recurrence": block.get("recurrence"),
        "timerMinutes": block.get("timerMinutes")
    }

def calculate_coins(difficulty, streak=0, first_today=False):
    base = {1: 5, 2: 10, 3: 20}.get(difficulty, 5)
    streak_bonus = min(streak, 10)
    first_bonus = 5 if first_today else 0
    return base + streak_bonus + first_bonus

def update_shared_streak(shared):
    today = get_today()
    s = shared["stats"].setdefault("streak", {"current": 0, "lastActiveDate": None})
    if s["lastActiveDate"] == today:
        return
    if s["lastActiveDate"] == get_yesterday():
        s["current"] += 1
    else:
        s["current"] = 1
    s["lastActiveDate"] = today

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def api_data():
    shared = load_shared_stats()
    prod = load_productivity()
    changed = update_productivity_streak(prod)
    today = get_today()
    for t in prod.get("tasks", []):
        t["todayCompletions"] = len(get_task_completions(t, today))
        t["completionsLimit"] = repeat_limit_per_day(t.get("repeat"))
    if changed:
        save_productivity(prod)
    return jsonify({"shared": shared, "productivity": prod, "today": today})

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    if not data or not data.get("text"):
        return jsonify({"error": "Missing text"}), 400
    prod = load_productivity()
    repeat = parse_repeat(data.get("repeat", "none"))
    task = {
        "id": str(int(time.time() * 1000)),
        "text": data["text"].strip(),
        "difficulty": max(1, min(3, int(float(data.get("difficulty", 1))))),
        "category": data.get("category", "personal"),
        "repeat": repeat,
        "history": {},
        "streak": 0,
        "lastCompleted": None,
        "createdAt": get_today(),
        "order": len(prod.get("tasks", []))
    }
    prod["tasks"].append(task)
    save_productivity(prod)
    return jsonify(task)

@app.route('/api/tasks/<task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    shared = load_shared_stats()
    prod = load_productivity()
    update_productivity_streak(prod)
    today = get_today()
    task = next((t for t in prod["tasks"] if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Not found"}), 404

    coins = 0
    completed = False

    if task.get("repeat") == "none":
        if task.get("completed"):
            task["completed"] = False
            prev = task.get("history", {}).get("__once__", {}).get("coins", 0)
            coins = -prev
            shared["stats"]["allTime"]["coins"] = max(0, shared["stats"]["allTime"].get("coins", 0) - prev)
            shared["stats"]["allTime"]["totalCoinsEarned"] = max(0, shared["stats"]["allTime"].get("totalCoinsEarned", 0) - prev)
            shared["stats"]["allTime"]["tasksCompleted"] = max(0, shared["stats"]["allTime"].get("tasksCompleted", 0) - 1)
            if today in shared["stats"].get("days", {}):
                shared["stats"]["days"][today]["tasksCompleted"] = max(0, shared["stats"]["days"][today].get("tasksCompleted", 0) - 1)
            task["history"] = {}
        else:
            any_done_today = any_task_done_today(prod, today, task_id)
            coins = calculate_coins(task["difficulty"], 0, not any_done_today)
            task["completed"] = True
            task["history"] = {"__once__": {"coins": coins, "date": today}}
            award_shared_coins(shared, today, coins)
            update_shared_streak(shared)
            completed = True
    else:
        limit = repeat_limit_per_day(task.get("repeat"))
        comps = migrate_history_entry(task, today)
        if len(comps) >= limit:
            prev = comps.pop()
            if not comps:
                task["history"].pop(today, None)
            coins = -prev.get("coins", 0)
            shared["stats"]["allTime"]["coins"] = max(0, shared["stats"]["allTime"].get("coins", 0) + coins)
            shared["stats"]["allTime"]["totalCoinsEarned"] = max(0, shared["stats"]["allTime"].get("totalCoinsEarned", 0) + coins)
            shared["stats"]["allTime"]["tasksCompleted"] = max(0, shared["stats"]["allTime"].get("tasksCompleted", 0) - 1)
            if today in shared["stats"].get("days", {}):
                shared["stats"]["days"][today]["tasksCompleted"] = max(0, shared["stats"]["days"][today].get("tasksCompleted", 0) - 1)
            recompute_task_streak(task, today)
            dates = sorted(task.get("history", {}).keys())
            task["lastCompleted"] = dates[-1] if dates else None
        else:
            recompute_task_streak(task, today)
            any_done_today = any_task_done_today(prod, today, task_id)
            coins = calculate_coins(task["difficulty"], task["streak"], not any_done_today)
            comps.append({"coins": coins, "date": today})
            task["lastCompleted"] = today
            award_shared_coins(shared, today, coins)
            update_shared_streak(shared)
            completed = True

    if completed:
        update_prod_streak_counter(prod, today)

    save_productivity(prod)
    save_shared_stats(shared)
    task["todayCompletions"] = len(get_task_completions(task, today))
    task["completionsLimit"] = repeat_limit_per_day(task.get("repeat"))
    return jsonify({"task": task, "coinsDelta": coins, "totalCoins": shared["stats"]["allTime"]["coins"]})

@app.route('/api/tasks/<task_id>', methods=['POST', 'PUT'])
def update_task(task_id):
    data = request.get_json() or {}
    prod = load_productivity()
    task = next((t for t in prod["tasks"] if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Not found"}), 404
    if data.get("text") and str(data["text"]).strip():
        task["text"] = str(data["text"]).strip()[:200]
    if data.get("difficulty") is not None:
        try:
            task["difficulty"] = max(1, min(3, int(float(data["difficulty"]))))
        except (TypeError, ValueError):
            pass
    if data.get("category") is not None:
        task["category"] = str(data["category"])
    if "repeat" in data:
        new_repeat = parse_repeat(data["repeat"])
        if new_repeat != task.get("repeat"):
            task["repeat"] = new_repeat
            task["completed"] = False
    save_productivity(prod)
    return jsonify(task)

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    prod = load_productivity()
    task = next((t for t in prod["tasks"] if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Not found"}), 404
    prod["tasks"] = [t for t in prod["tasks"] if t["id"] != task_id]
    for b in prod.get("timeblocks", {}).get("blocks", []):
        b["taskIds"] = [tid for tid in b.get("taskIds", []) if tid != task_id]
    task["deletedAt"] = get_today()
    deleted = prod.setdefault("deletedTasks", [])
    deleted.append(task)
    prod["deletedTasks"] = deleted[-20:]
    save_productivity(prod)
    return jsonify({"status": "deleted", "task": task})

@app.route('/api/tasks/deleted')
def get_deleted_tasks():
    prod = load_productivity()
    return jsonify({"deletedTasks": prod.get("deletedTasks", [])})

@app.route('/api/tasks/clear-completed', methods=['POST'])
def clear_completed_tasks():
    prod = load_productivity()
    removed = []
    kept = []
    for t in prod.get("tasks", []):
        if t.get("repeat") == "none" and t.get("completed"):
            t["deletedAt"] = get_today()
            removed.append(t)
        else:
            kept.append(t)
    if not removed:
        return jsonify({"status": "cleared", "deleted": []})
    prod["tasks"] = kept
    removed_ids = {t["id"] for t in removed}
    for b in prod.get("timeblocks", {}).get("blocks", []):
        b["taskIds"] = [tid for tid in b.get("taskIds", []) if tid not in removed_ids]
    deleted = prod.setdefault("deletedTasks", [])
    deleted.extend(removed)
    prod["deletedTasks"] = deleted[-20:]
    save_productivity(prod)
    return jsonify({"status": "cleared", "deleted": list(removed_ids)})

@app.route('/api/tasks/<task_id>/restore', methods=['POST'])
def restore_task(task_id):
    prod = load_productivity()
    deleted = prod.get("deletedTasks", [])
    task = next((t for t in deleted if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Not found"}), 404
    deleted.remove(task)
    task.pop("deletedAt", None)
    task["order"] = len(prod.get("tasks", []))
    prod["tasks"].append(task)
    save_productivity(prod)
    return jsonify(task)

@app.route('/api/categories', methods=['POST'])
def create_category():
    data = request.get_json() or {}
    name = str(data.get("name") or "").strip()[:40]
    if not name:
        return jsonify({"error": "Missing name"}), 400
    prod = load_productivity()
    existing = {c["id"] for c in prod.get("categories", [])}
    base = name.lower().replace(" ", "_")
    cat_id = base
    n = 1
    while cat_id in existing:
        n += 1
        cat_id = f"{base}_{n}"
    cat = {"id": cat_id, "name": name, "color": str(data.get("color") or "#64748b").strip()}
    prod.setdefault("categories", []).append(cat)
    save_productivity(prod)
    return jsonify(cat)

@app.route('/api/categories/<cat_id>', methods=['POST', 'PUT'])
def update_category(cat_id):
    data = request.get_json() or {}
    prod = load_productivity()
    cat = next((c for c in prod.get("categories", []) if c["id"] == cat_id), None)
    if not cat:
        return jsonify({"error": "Not found"}), 404
    if data.get("name") and str(data["name"]).strip():
        cat["name"] = str(data["name"]).strip()[:40]
    if data.get("color") and str(data["color"]).strip():
        cat["color"] = str(data["color"]).strip()
    save_productivity(prod)
    return jsonify(cat)

@app.route('/api/categories/<cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    prod = load_productivity()
    cats = prod.get("categories", [])
    if not any(c["id"] == cat_id for c in cats):
        return jsonify({"error": "Not found"}), 404
    if len(cats) <= 1:
        return jsonify({"error": "Cannot delete the last category"}), 400
    prod["categories"] = [c for c in cats if c["id"] != cat_id]
    fallback = prod["categories"][0]["id"]
    for t in prod.get("tasks", []):
        if t.get("category") == cat_id:
            t["category"] = fallback
    save_productivity(prod)
    return jsonify({"status": "deleted"})

@app.route('/api/focus/session', methods=['POST'])
def focus_session():
    data = request.get_json() or {}
    try:
        minutes = max(1, int(float(data.get("minutes", 0))))
    except (TypeError, ValueError):
        minutes = 0
    if minutes <= 0:
        return jsonify({"error": "Invalid minutes"}), 400
    shared = load_shared_stats()
    stats = shared["stats"]
    today = get_today()
    if today not in stats.get("days", {}):
        stats["days"][today] = {"pomodoros": 0, "shortBreaks": 0, "longBreaks": 0, "focusMinutes": 0, "tasksCompleted": 0}
    stats["days"][today]["pomodoros"] = stats["days"][today].get("pomodoros", 0) + 1
    stats["days"][today]["focusMinutes"] = stats["days"][today].get("focusMinutes", 0) + minutes
    all_time = stats["allTime"]
    all_time["pomodoros"] = all_time.get("pomodoros", 0) + 1
    all_time["focusMinutes"] = all_time.get("focusMinutes", 0) + minutes
    streak = stats.get("streak", {}).get("current", 0)
    mult = 1.0 if streak < 3 else min(1.5, 1.0 + (streak - 2) * 0.1)
    coins = int(round((10 + max(0, (minutes - 25) // 5)) * mult))
    all_time["coins"] = all_time.get("coins", 0) + coins
    all_time["totalCoinsEarned"] = all_time.get("totalCoinsEarned", 0) + coins
    update_shared_streak(shared)
    save_shared_stats(shared)
    return jsonify({"status": "ok", "coins": coins, "focusMinutes": all_time.get("focusMinutes", 0)})

@app.route('/api/tasks/reorder', methods=['POST'])
def reorder_tasks():
    data = request.get_json()
    if not data or not data.get("order"):
        return jsonify({"error": "Missing order"}), 400
    prod = load_productivity()
    order_map = {id: i for i, id in enumerate(data["order"])}
    for task in prod["tasks"]:
        if task["id"] in order_map:
            task["order"] = order_map[task["id"]]
    prod["tasks"].sort(key=lambda t: t.get("order", 0))
    save_productivity(prod)
    return jsonify({"status": "reordered"})

@app.route('/api/config', methods=['POST'])
def update_config():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400
    shared = load_shared_stats()
    if isinstance(data.get("config"), dict):
        cfg = shared.setdefault("config", {})
        for k, v in data["config"].items():
            cfg[k] = v if isinstance(v, (str, int, float, bool)) or v is None else str(v)
    save_shared_stats(shared)
    return jsonify({"status": "saved", "config": shared.get("config", {})})

@app.route('/api/export')
def export_data():
    return jsonify({"epiproducitv": load_productivity(), "shared": load_shared_stats()})

@app.route('/api/import', methods=['POST'])
def import_data():
    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid data"}), 400
    if isinstance(data.get("epiproducitv"), dict):
        prod = data["epiproducitv"]
        if not isinstance(prod.get("tasks"), list):
            prod["tasks"] = []
        else:
            prod["tasks"] = [t for t in prod["tasks"] if isinstance(t, dict)]
        if not isinstance(prod.get("categories"), list) or not prod.get("categories"):
            prod["categories"] = list(DEFAULT_PRODUCTIVITY["categories"])
        if not isinstance(prod.get("timeblocks"), dict):
            prod["timeblocks"] = {"blocks": []}
        blocks = prod.get("timeblocks", {}).get("blocks")
        if isinstance(blocks, list):
            prod["timeblocks"]["blocks"] = [b for b in (validate_block(b) for b in blocks) if b is not None]
        else:
            prod["timeblocks"]["blocks"] = []
        save_productivity(prod)
    if isinstance(data.get("shared"), dict):
        shared = data["shared"]
        if not isinstance(shared.get("stats"), dict):
            shared["stats"] = {}
        if not isinstance(shared.get("config"), dict):
            shared["config"] = {}
        save_shared_stats(shared)
    return jsonify({"status": "imported"})

@app.route('/manifest.json')
def manifest():
    return jsonify({
        "name": "epiproducitv",
        "short_name": "epiproducitv",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0b1021",
        "theme_color": "#f59e0b",
        "icons": [
            {"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}
        ]
    })

@app.route('/icon.svg')
def app_icon():
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#g)"/>
<polygon points="155,195 115,55 230,145" fill="#fef3c7"/>
<polygon points="153,180 128,80 208,145" fill="#b45309"/>
<polygon points="357,195 397,55 282,145" fill="#fef3c7"/>
<polygon points="359,180 384,80 304,145" fill="#b45309"/>
<path d="M 256 155 C 350 155 380 245 380 305 C 380 370 320 410 256 410 C 192 410 132 370 132 305 C 132 245 162 155 256 155 Z" fill="#fef3c7"/>
<ellipse cx="200" cy="265" rx="11" ry="13" fill="#292524"/>
<ellipse cx="312" cy="265" rx="11" ry="13" fill="#292524"/>
<ellipse cx="203" cy="260" rx="4" ry="5" fill="white"/>
<ellipse cx="315" cy="260" rx="4" ry="5" fill="white"/>
<ellipse cx="256" cy="340" rx="14" ry="9" fill="#292524"/>
</svg>'''
    return svg, 200, {'Content-Type': 'image/svg+xml'}

@app.route('/sw.js')
def sw():
    js = '''const C='epiproducitv-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});'''
    return js, 200, {'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/'}

@app.route('/api/redeem/status')
def redeem_status():
    shared = load_shared_stats()
    stats = shared["stats"]
    redemption = stats.get("currentRedemption")
    redeemable = stats["allTime"].get("redeemableMinutes", 0)

    if not redemption or not redemption.get("active"):
        return jsonify({"active": False, "redeemableMinutes": redeemable})

    started_at = datetime.fromisoformat(redemption["startedAt"])
    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds() / 60
    remaining = max(0, redemption["minutes"] - elapsed)

    if remaining <= 0:
        redemption["active"] = False
        save_shared_stats(shared)
        return jsonify({"active": False, "redeemableMinutes": redeemable})

    return jsonify({
        "active": True,
        "startedAt": redemption["startedAt"],
        "minutes": redemption["minutes"],
        "minutesRemaining": round(remaining, 1),
        "secondsRemaining": round(remaining * 60),
        "redeemableMinutes": redeemable
    })

@app.route('/api/redeem/start', methods=['POST'])
def redeem_start():
    body = request.get_json() or {}
    minutes = int(body.get("minutes", 0))
    if minutes <= 0:
        return jsonify({"error": "Invalid minutes"}), 400

    shared = load_shared_stats()
    stats = shared["stats"]
    redeemable = stats["allTime"].get("redeemableMinutes", 0)
    if minutes > redeemable:
        return jsonify({"error": "Not enough redeemable minutes"}), 400

    old = stats.get("currentRedemption") or {}
    if old.get("active"):
        started = datetime.fromisoformat(old["startedAt"])
        elapsed = (datetime.now(timezone.utc) - started).total_seconds() / 60
        used = min(old["minutes"], elapsed)
        stats["allTime"]["redeemableMinutes"] += old["minutes"] - used

    stats["currentRedemption"] = {
        "active": True,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "minutes": minutes
    }
    stats["allTime"]["redeemableMinutes"] -= minutes
    save_shared_stats(shared)
    return jsonify({"status": "started", "minutes": minutes})

@app.route('/api/redeem/stop', methods=['POST'])
def redeem_stop():
    shared = load_shared_stats()
    stats = shared["stats"]
    redemption = stats.get("currentRedemption") or {}
    if not redemption.get("active"):
        return jsonify({"error": "No active redemption"}), 400

    started = datetime.fromisoformat(redemption["startedAt"])
    elapsed = (datetime.now(timezone.utc) - started).total_seconds() / 60
    used = min(redemption["minutes"], elapsed)
    remaining = redemption["minutes"] - used

    stats["allTime"]["redeemableMinutes"] += remaining
    stats["currentRedemption"]["active"] = False
    save_shared_stats(shared)
    return jsonify({"status": "stopped", "used": round(used, 1), "refunded": round(remaining, 1)})

@app.route('/api/calendar/config', methods=['GET', 'POST'])
def calendar_config():
    shared = load_shared_stats()
    cal_key = "caldav"
    if request.method == 'POST':
        data = request.get_json() or {}
        cfg = shared.setdefault("config", {}).setdefault(cal_key, {})
        cfg["url"] = data.get("url", "").strip()
        cfg["username"] = data.get("username", "").strip()
        if data.get("password"):
            cfg["password"] = data["password"]
        cfg["calendarName"] = data.get("calendarName", "").strip()
        save_shared_stats(shared)
        return jsonify({"status": "saved"})
    cfg = shared.get("config", {}).get(cal_key, {})
    safe = {k: v for k, v in cfg.items() if k != "password"}
    safe["hasPassword"] = bool(cfg.get("password"))
    return jsonify(safe)

@app.route('/api/calendar/test', methods=['POST'])
def calendar_test():
    shared = load_shared_stats()
    data = request.get_json() or {}
    cfg = data if data.get("url") else shared.get("config", {}).get("caldav", {})
    if not CALDAV_AVAILABLE:
        return jsonify({"error": "caldav library not installed. Run: pip install caldav"}), 400
    url = cfg.get("url", "").strip()
    username = cfg.get("username", "").strip()
    password = cfg.get("password", "").strip()
    if not url or not username or not password:
        return jsonify({"error": "Missing CalDAV URL, username, or password"}), 400
    try:
        client = caldav.DAVClient(url=url, username=username, password=password)
        principal = client.principal()
        cals = principal.calendars()
        names = [str(c) for c in cals]
        return jsonify({"status": "ok", "calendars": names})
    except caldav_err.AuthorizationError:
        return jsonify({"error": "Authentication failed"}), 401
    except Exception as e:
        return jsonify({"error": f"Connection failed: {str(e)}"}), 400

@app.route('/api/calendar/sync', methods=['POST'])
def calendar_sync():
    data = request.get_json() or {}
    block = data.get("block")
    if not isinstance(block, dict) or not block.get("id"):
        return jsonify({"error": "Missing block"}), 400
    nb = validate_block(block)
    if nb is None:
        return jsonify({"error": "Invalid block"}), 400
    date_str = str(block.get("scheduledDate") or data.get("date") or get_today())
    nb["scheduledDate"] = date_str
    nb["recurrence"] = block.get("recurrence")
    shared = load_shared_stats()
    cfg = shared.get("config", {}).get("caldav", {})
    result = sync_block_to_calendar(nb, date_str, cfg)
    if result.get("error"):
        return jsonify(result), 400
    prod = load_productivity()
    for b in prod.get("timeblocks", {}).get("blocks", []):
        if b.get("id") == nb["id"]:
            b["calEventUrl"] = result.get("url")
            b["scheduledDate"] = nb["scheduledDate"]
            b["recurrence"] = nb.get("recurrence")
            save_productivity(prod)
            break
    return jsonify(result)

@app.route('/api/calendar/event/delete', methods=['POST'])
def calendar_event_delete():
    data = request.get_json() or {}
    event_url = data.get("url")
    block_id = data.get("blockId")
    if not event_url and not block_id:
        return jsonify({"error": "Missing URL or block ID"}), 400
    prod = load_productivity()
    block = None
    if block_id:
        block = next((b for b in prod.get("timeblocks", {}).get("blocks", []) if b.get("id") == block_id), None)
        if not block:
            return jsonify({"error": "Block not found"}), 404
        if not event_url:
            event_url = block.get("calEventUrl")
    if not event_url:
        return jsonify({"status": "deleted"})
    shared = load_shared_stats()
    cfg = shared.get("config", {}).get("caldav", {})
    ok = delete_calendar_event(cfg, event_url)
    if block:
        block["calEventUrl"] = None
        block["scheduledDate"] = None
        block["recurrence"] = None
        block["scheduled"] = False
        save_productivity(prod)
    else:
        for b in prod.get("timeblocks", {}).get("blocks", []):
            if b.get("calEventUrl") == event_url:
                b["calEventUrl"] = None
                save_productivity(prod)
                break
    return jsonify({"status": "deleted" if ok else "not_found"})

@app.route('/api/timeblocks')
def get_timeblocks():
    prod = load_productivity()
    return jsonify({
        "timeblocks": prod.get("timeblocks", {"blocks": []}),
        "presets": prod.get("blockPresets", [])
    })

@app.route('/api/timeblocks/save', methods=['POST'])
def save_timeblocks():
    data = request.get_json()
    if not data or not isinstance(data.get("timeblocks"), dict):
        return jsonify({"error": "Missing timeblocks"}), 400
    raw_blocks = data["timeblocks"].get("blocks")
    if not isinstance(raw_blocks, list):
        return jsonify({"error": "Invalid timeblocks"}), 400
    blocks = [b for b in (validate_block(b) for b in raw_blocks) if b is not None]
    prod = load_productivity()
    prod["timeblocks"] = {"blocks": blocks}
    save_productivity(prod)
    return jsonify({"status": "saved", "blocks": blocks})

@app.route('/api/timeblocks/preset/save', methods=['POST'])
def save_preset():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Missing name"}), 400
    prod = load_productivity()
    blocks = prod.get("timeblocks", {}).get("blocks", [])
    preset = {
        "id": "preset_" + str(int(time.time() * 1000)),
        "name": data["name"].strip()[:60],
        "blocks": [{"name": b.get("name", "Block"), "color": b.get("color", "#64748b"), "taskIds": list(b.get("taskIds", [])), "scheduled": b.get("scheduled", False), "startTime": b.get("startTime", "09:00"), "endTime": b.get("endTime", "10:00")} for b in blocks]
    }
    prod.setdefault("blockPresets", []).append(preset)
    save_productivity(prod)
    return jsonify(preset)

@app.route('/api/timeblocks/preset/<preset_id>/load', methods=['POST'])
def load_preset(preset_id):
    prod = load_productivity()
    presets = prod.get("blockPresets", [])
    preset = next((p for p in presets if p["id"] == preset_id), None)
    if not preset:
        return jsonify({"error": "Preset not found"}), 404
    existing = prod.get("timeblocks", {}).get("blocks", [])
    kept_task_ids = set()
    for b in existing:
        kept_task_ids.update(b.get("taskIds", []))
    new_blocks = []
    for i, pb in enumerate(preset["blocks"]):
        tb_id = "tb_" + str(int(time.time() * 1000)) + str(i)
        new_blocks.append({
            "id": tb_id,
            "name": pb["name"],
            "color": pb["color"],
            "taskIds": [tid for tid in pb.get("taskIds", []) if tid in kept_task_ids],
            "order": i,
            "scheduled": pb.get("scheduled", False),
            "startTime": pb.get("startTime", "09:00"),
            "endTime": pb.get("endTime", "10:00"),
            "calEventUrl": None
        })
    prod["timeblocks"]["blocks"] = new_blocks
    save_productivity(prod)
    return jsonify({"status": "loaded", "timeblocks": prod["timeblocks"]})

@app.route('/api/timeblocks/preset/<preset_id>', methods=['DELETE'])
def delete_preset(preset_id):
    prod = load_productivity()
    prod["blockPresets"] = [p for p in prod.get("blockPresets", []) if p["id"] != preset_id]
    save_productivity(prod)
    return jsonify({"status": "deleted"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
