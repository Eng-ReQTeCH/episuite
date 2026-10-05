from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime, timezone

app = Flask(__name__)
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)
STATS_FILE = os.path.join(DATA_DIR, 'stats.json')

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

def load_data():
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print("Error loading stats:", e)
    return DEFAULT_DATA.copy()

def save_data(data):
    try:
        with open(STATS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print("Error saving stats:", e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/manifest.json')
def manifest():
    return jsonify({
        "name": "Epidoro",
        "short_name": "Epidoro",
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
    js = '''const C='epidoro-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});'''
    return js, 200, {'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/'}

@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify(load_data())

@app.route('/api/stats', methods=['POST'])
def post_stats():
    data = request.get_json()
    if data:
        save_data(data)
    return jsonify({"status": "saved"})

@app.route('/api/export')
def export_data():
    return jsonify(load_data())

@app.route('/api/import', methods=['POST'])
def import_data():
    data = request.get_json()
    if data:
        save_data(data)
    return jsonify({"status": "imported"})

@app.route('/api/redeem/status')
def redeem_status():
    data = load_data()
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
        save_data(data)
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

    data = load_data()
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
    save_data(data)
    return jsonify({"status": "started", "minutes": minutes})

@app.route('/api/redeem/stop', methods=['POST'])
def redeem_stop():
    data = load_data()
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
    save_data(data)
    return jsonify({"status": "stopped", "used": round(used, 1), "refunded": round(remaining, 1)})

if __name__ == '__main__':
    # 0.0.0.0 makes it accessible from other devices on your network
    app.run(host='0.0.0.0', port=5000, debug=False)
