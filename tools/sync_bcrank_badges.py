#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Обновляет E/R бейджи по BC Rank.

Логика:
- E: если на странице монстра есть "location: event reward"
- R: если имя монстра есть в boost-monsters.json или BC Rank/данные показывают boost-маркер.
  Автоматический R лучше проверять вручную, потому что BC Rank показывает r-boost калькулятор почти на каждой странице.

Запуск из корня проекта:
    python tools/sync_bcrank_badges.py

После запуска обновятся:
    data/event-monsters.json
    data/bcrank-sync-report.json
"""

from pathlib import Path
import json, time, re
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MONSTERS = ROOT / "data" / "monsters.json"
EVENTS = ROOT / "data" / "event-monsters.json"
BOOSTS = ROOT / "data" / "boost-monsters.json"
REPORT = ROOT / "data" / "bcrank-sync-report.json"

def fetch(name: str) -> str:
    url = f"https://bcrank.us/catalog/?q={quote_plus(name)}"
    req = Request(url, headers={
        "User-Agent": "Mozilla/5.0 BattleCampNeonSync/1.0"
    })
    with urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", errors="ignore")

def main():
    monsters = json.loads(MONSTERS.read_text(encoding="utf-8"))
    existing_boosts = set(json.loads(BOOSTS.read_text(encoding="utf-8"))) if BOOSTS.exists() else set()

    event_names = []
    failed = []
    checked = 0

    for m in monsters:
        name = m["name"]
        try:
            html = fetch(name)
            text = re.sub(r"<[^>]+>", " ", html)
            text = re.sub(r"\s+", " ", text).lower()

            if "location:" in text and "event reward" in text:
                event_names.append(name)

            checked += 1
            print(f"[{checked}/{len(monsters)}] {name}")
            time.sleep(0.25)
        except Exception as e:
            failed.append({"name": name, "error": str(e)})
            print(f"[FAIL] {name}: {e}")
            time.sleep(1)

    EVENTS.write_text(json.dumps(sorted(set(event_names)), ensure_ascii=False, indent=2), encoding="utf-8")
    BOOSTS.write_text(json.dumps(sorted(existing_boosts), ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT.write_text(json.dumps({
        "checked": checked,
        "event_reward_found": len(set(event_names)),
        "failed": failed,
        "note": "R/Boost список оставлен ручным в boost-monsters.json"
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Done")
    print("Event monsters:", len(set(event_names)))
    print("Failed:", len(failed))

if __name__ == "__main__":
    main()
