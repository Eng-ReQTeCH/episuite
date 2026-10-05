from flask import Flask, render_template, request, jsonify
import json
import os
import time
from datetime import datetime, timedelta, timezone

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
os.makedirs(DATA_DIR, exist_ok=True)

STATS_FILE = os.path.join(DATA_DIR, 'stats.json')
PRODUCTIVITY_FILE = os.path.join(DATA_DIR, 'epiproducitv.json')

DEFAULT_DATA = {
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
        "dailyCounters": None,
        "currentRedemption": None
    },
    "tasks": [],
    "config": {}
}

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
    "lastResetDate": None
}

def load_stats():
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print("Error loading stats:", e)
    return DEFAULT_DATA.copy()

def save_stats(data):
    tmp = STATS_FILE + '.tmp'
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, STATS_FILE)
    except Exception as e:
        print("Error saving stats:", e)

def load_productivity():
    if not os.path.exists(PRODUCTIVITY_FILE):
        return DEFAULT_PRODUCTIVITY.copy()
    try:
        with open(PRODUCTIVITY_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            merged = DEFAULT_PRODUCTIVITY.copy()
            merged.update(data)
            return merged
        return DEFAULT_PRODUCTIVITY.copy()
    except Exception as e:
        print("Error loading productivity:", e)
        return DEFAULT_PRODUCTIVITY.copy()

def save_productivity(data):
    tmp = PRODUCTIVITY_FILE + '.tmp'
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, PRODUCTIVITY_FILE)
    except Exception as e:
        print("Error saving productivity:", e)

def get_today():
    return datetime.now().strftime("%Y-%m-%d")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def api_data():
    return jsonify({"shared": load_stats(), "productivity": load_productivity(), "today": get_today()})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify(load_stats())

@app.route('/api/stats', methods=['POST'])
def post_stats():
    data = request.get_json()
    if data:
        save_stats(data)
    return jsonify({"status": "saved"})

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    if not data or not data.get("text"):
        return jsonify({"error": "Missing text"}), 400
    prod = load_productivity()
    r = data.get("repeat", "none")
    if isinstance(r, (int, float)) and not isinstance(r, bool):
        n = int(r + 0.5)
        repeat = "none" if n <= 0 else ("daily" if n == 1 else f"interval_{n}")
    else:
        s = str(r) if r is not None else "none"
        if s.isdigit():
            n = int(s); repeat = "none" if n == 0 else ("daily" if n == 1 else f"interval_{n}")
        elif s in ("none", "daily") or s.startswith("interval_"):
            repeat = s
        else:
            repeat = "none"
    task = {
        "id": str(int(time.time() * 1000)),
        "text": data["text"].strip(),
        "difficulty": int(data.get("difficulty", 1)),
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
    shared = load_stats()
    prod = load_productivity()
    today = get_today()
    task = next((t for t in prod["tasks"] if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Not found"}), 404

    is_done_today = today in task.get("history", {})
    coins = 0

    if task.get("repeat") == "none":
        if task.get("completed"):
            task["completed"] = False
            prev = task.get("history", {}).get("__once__", {}).get("coins", 0)
            shared["stats"]["allTime"]["coins"] = max(0, shared["stats"]["allTime"].get("coins", 0) - prev)
            shared["stats"]["allTime"]["totalCoinsEarned"] = max(0, shared["stats"]["allTime"].get("totalCoinsEarned", 0) - prev)
            shared["stats"]["allTime"]["tasksCompleted"] = max(0, shared["stats"]["allTime"].get("tasksCompleted", 0) - 1)
            if today in shared["stats"].get("days", {}):
                shared["stats"]["days"][today]["tasksCompleted"] = max(0, shared["stats"]["days"][today].get("tasksCompleted", 0) - 1)
            task["history"] = {}
        else:
            any_done_today = any(
                (t.get("repeat") == "none" and t.get("completed") and t["id"] != task_id) or
                (t.get("repeat") != "none" and today in t.get("history", {}) and t["id"] != task_id)
                for t in prod["tasks"]
            )
            is_first = not any_done_today
            coins = calculate_coins(task["difficulty"], 0, is_first)
            task["completed"] = True
            task["history"] = {"__once__": {"coins": coins, "date": today}}
            shared["stats"]["allTime"]["coins"] = shared["stats"]["allTime"].get("coins", 0) + coins
            shared["stats"]["allTime"]["totalCoinsEarned"] = shared["stats"]["allTime"].get("totalCoinsEarned", 0) + coins
            shared["stats"]["allTime"]["tasksCompleted"] = shared["stats"]["allTime"].get("tasksCompleted", 0) + 1
            if today not in shared["stats"].get("days", {}):
                shared["stats"]["days"][today] = {"pomodoros": 0, "shortBreaks": 0, "longBreaks": 0, "focusMinutes": 0, "tasksCompleted": 0}
            shared["stats"]["days"][today]["tasksCompleted"] = shared["stats"]["days"][today].get("tasksCompleted", 0) + 1
            update_shared_streak(shared)
    else:
        if is_done_today:
            prev = task["history"].pop(today, {"coins": 0})
            coins = -prev["coins"]
            dates = sorted(task["history"].keys())
            streak = 0
            check_dt = datetime.strptime(today, "%Y-%m-%d") - timedelta(days=1)
            while True:
                if check_dt.strftime("%Y-%m-%d") in dates:
                    streak += 1
                    check_dt -= timedelta(days=1)
                else:
                    break
            task["streak"] = streak
            task["lastCompleted"] = dates[-1] if dates else None
            shared["stats"]["allTime"]["coins"] = max(0, shared["stats"]["allTime"].get("coins", 0) + coins)
            shared["stats"]["allTime"]["totalCoinsEarned"] = max(0, shared["stats"]["allTime"].get("totalCoinsEarned", 0) + coins)
            shared["stats"]["allTime"]["tasksCompleted"] = max(0, shared["stats"]["allTime"].get("tasksCompleted", 0) - 1)
            if today in shared["stats"].get("days", {}):
                shared["stats"]["days"][today]["tasksCompleted"] = max(0, shared["stats"]["days"][today].get("tasksCompleted", 0) - 1)
        else:
            task.setdefault("history", {})[today] = {"date": today}
            task["lastCompleted"] = today
            dates = sorted(task["history"].keys())
            streak = 0
            check_dt = datetime.strptime(today, "%Y-%m-%d") - timedelta(days=1)
            while True:
                if check_dt.strftime("%Y-%m-%d") in dates:
                    streak += 1
                    check_dt -= timedelta(days=1)
                else:
                    break
            task["streak"] = streak
            any_done_today = any(
                (t.get("repeat") == "none" and t.get("completed") and t["id"] != task_id) or
                (t.get("repeat") != "none" and today in t.get("history", {}) and t["id"] != task_id)
                for t in prod["tasks"]
            )
            is_first = not any_done_today
            coins = calculate_coins(task["difficulty"], streak, is_first)
            task["history"][today]["coins"] = coins
            shared["stats"]["allTime"]["coins"] = shared["stats"]["allTime"].get("coins", 0) + coins
            shared["stats"]["allTime"]["totalCoinsEarned"] = shared["stats"]["allTime"].get("totalCoinsEarned", 0) + coins
            shared["stats"]["allTime"]["tasksCompleted"] = shared["stats"]["allTime"].get("tasksCompleted", 0) + 1
            if today not in shared["stats"].get("days", {}):
                shared["stats"]["days"][today] = {"pomodoros": 0, "shortBreaks": 0, "longBreaks": 0, "focusMinutes": 0, "tasksCompleted": 0}
            shared["stats"]["days"][today]["tasksCompleted"] = shared["stats"]["days"][today].get("tasksCompleted", 0) + 1
            update_shared_streak(shared)

    save_productivity(prod)
    save_stats(shared)
    return jsonify({"task": task, "coinsDelta": coins, "totalCoins": shared["stats"]["allTime"]["coins"]})

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    prod = load_productivity()
    prod["tasks"] = [t for t in prod["tasks"] if t["id"] != task_id]
    save_productivity(prod)
    return jsonify({"status": "deleted"})

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
    shared = load_stats()
    if "config" in data:
        shared["config"] = {**shared.get("config", {}), **data["config"]}
    save_stats(shared)
    return jsonify({"status": "saved", "config": shared["config"]})

@app.route('/api/redeem/status')
def redeem_status():
    data = load_stats()
    stats = data["stats"]
    redemption = stats.get("currentRedemption")
    redeemable = stats["allTime"].get("redeemableMinutes", 0)

    if not redemption or not redemption.get("active"):
        return jsonify({"active": False, "redeemableMinutes": redeemable})

    started_at = datetime.fromisoformat(redemption["startedAt"])
    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds() / 60
    remaining = max(0, redemption["minutes"] - elapsed)

    if remaining <= 0:
        redemption["active"] = False
        save_stats(data)
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

    data = load_stats()
    stats = data["stats"]
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
    save_stats(data)
    return jsonify({"status": "started", "minutes": minutes})

@app.route('/api/redeem/stop', methods=['POST'])
def redeem_stop():
    data = load_stats()
    stats = data["stats"]
    redemption = stats.get("currentRedemption") or {}
    if not redemption.get("active"):
        return jsonify({"error": "No active redemption"}), 400

    started = datetime.fromisoformat(redemption["startedAt"])
    elapsed = (datetime.now(timezone.utc) - started).total_seconds() / 60
    used = min(redemption["minutes"], elapsed)
    remaining = redemption["minutes"] - used

    stats["allTime"]["redeemableMinutes"] += remaining
    stats["currentRedemption"]["active"] = False
    save_stats(data)
    return jsonify({"status": "stopped", "used": round(used, 1), "refunded": round(remaining, 1)})

@app.route('/api/export')
def export_data():
    return jsonify({"shared": load_stats(), "productivity": load_productivity()})

@app.route('/api/import', methods=['POST'])
def import_data():
    data = request.get_json()
    if data:
        if "shared" in data:
            save_stats(data["shared"])
        if "productivity" in data:
            save_productivity(data["productivity"])
    return jsonify({"status": "imported"})

@app.route('/manifest.json')
def manifest():
    return jsonify({
        "name": "epimix",
        "short_name": "epimix",
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
<circle cx="256" cy="210" r="90" fill="#fef3c7"/>
<circle cx="210" cy="190" r="10" fill="#292524"/>
<circle cx="302" cy="190" r="10" fill="#292524"/>
<path d="M230 250 Q256 275 282 250" fill="none" stroke="#292524" stroke-width="6" stroke-linecap="round"/>
<rect x="220" y="320" width="72" height="96" rx="8" fill="#fef3c7"/>
<rect x="228" y="340" width="56" height="8" rx="4" fill="#292524"/>
<rect x="228" y="356" width="56" height="8" rx="4" fill="#292524"/>
<rect x="228" y="372" width="56" height="8" rx="4" fill="#292524"/>
<line x1="256" y1="416" x2="256" y2="440" stroke="#fef3c7" stroke-width="6" stroke-linecap="round"/>
<line x1="240" y1="440" x2="272" y2="440" stroke="#fef3c7" stroke-width="6" stroke-linecap="round"/>
</svg>'''
    return svg, 200, {'Content-Type': 'image/svg+xml'}

@app.route('/sw.js')
def sw():
    js = '''const C='epimix-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});'''
    return js, 200, {'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/'}

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
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    if s["lastActiveDate"] == yesterday:
        s["current"] += 1
    else:
        s["current"] = 1
    s["lastActiveDate"] = today

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)