#!/usr/bin/env python3
# Быстрая синхронизация R (Boost) монстров с BC Rank

from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, re, time

ROOT = Path(__file__).resolve().parents[1]
MONSTERS = ROOT / "data" / "monsters.json"
BOOSTS = ROOT / "data" / "boost-monsters.json"
EVENTS = ROOT / "data" / "event-monsters.json"
REPORT = ROOT / "data" / "boost-sync-report.json"

MAX_WORKERS = 80
TIMEOUT = 12
SAVE_EVERY = 25

def fetch_html(name):
    url = f"https://bcrank.us/catalog/?q={quote_plus(name)}"
    req = Request(url, headers={"User-Agent":"BattleCampBoostSync/1.0"})
    with urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8", errors="ignore")

def detect_boost(html):
    low = html.lower()
    markers = [
        "r-boost",
        "r boost",
        "boost monster",
        "boosts trophies",
        "boost trophies",
        "bonus trophies",
        "event boost",
        "boost attack",
        "boost defense"
    ]
    return any(m in low for m in markers)

def check(name):
    return name, detect_boost(fetch_html(name))

def main():
    monsters = json.loads(MONSTERS.read_text(encoding="utf-8"))
    current = set(json.loads(BOOSTS.read_text(encoding="utf-8"))) if BOOSTS.exists() else set()
    event_names = set(json.loads(EVENTS.read_text(encoding="utf-8"))) if EVENTS.exists() else set()
    current = {x for x in current if x not in event_names}

    names = [m["name"] for m in monsters]
    found = set(current)
    failed = []
    done = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(check, n): n for n in names}
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                n, is_boost = fut.result()
                if is_boost and n not in event_names:
                    found.add(n)
            except Exception as e:
                failed.append({"name": name, "error": str(e)})
            done += 1

            if done % SAVE_EVERY == 0:
                BOOSTS.write_text(json.dumps(sorted(found), ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"[{done}/{len(names)}] Boost найдено: {len(found)}")

    BOOSTS.write_text(json.dumps(sorted(found), ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT.write_text(json.dumps({
        "boost_monsters": len(found),
        "failed": failed,
        "workers": MAX_WORKERS,
        "seconds": round(time.time()-start,2)
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("ГОТОВО. Boost монстров:", len(found))

if __name__ == "__main__":
    main()
