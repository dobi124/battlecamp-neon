#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Синхронизация элементов монстров с BC Rank.

Запуск из корня проекта:
    python tools/sync_bcrank_elements.py

Создаёт/обновляет:
    data/monster-elements.json
    data/elements-sync-report.json

Важно:
- Скрипт делает запросы к bcrank.us по каждому монстру.
- 2068 монстров могут проверяться долго.
- Не запускайте слишком часто.
"""

from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
import json, re, time

ROOT = Path(__file__).resolve().parents[1]
MONSTERS = ROOT / "data" / "monsters.json"
OUT = ROOT / "data" / "monster-elements.json"
REPORT = ROOT / "data" / "elements-sync-report.json"

VALID = {"fire", "water", "rock", "wind", "leaf"}

def fetch_html(name):
    url = f"https://bcrank.us/catalog/?q={quote_plus(name)}"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 BattleCampNeonElements/1.0"})
    with urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="ignore")

def parse_elements(html):
    low = html.lower()
    # BC Rank detail pages have text like: element: Image: fire
    found = []
    # Limit parsing to the area after "element:" when possible.
    idx = low.find("element:")
    chunk = low[idx:idx+500] if idx != -1 else low
    for el in ["fire", "water", "rock", "wind", "leaf"]:
        if re.search(rf"(image:\s*)?{el}\b", chunk):
            found.append(el)
    return found[:2]

def main():
    monsters = json.loads(MONSTERS.read_text(encoding="utf-8"))
    existing = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}

    result = dict(existing)
    failed = []
    checked = 0

    for m in monsters:
        name = m["name"]
        try:
            html = fetch_html(name)
            elements = parse_elements(html)
            if elements:
                result[name] = elements
            checked += 1
            print(f"[{checked}/{len(monsters)}] {name}: {elements or 'not found'}")
            time.sleep(0.25)
        except Exception as e:
            failed.append({"name": name, "error": str(e)})
            print(f"[FAIL] {name}: {e}")
            time.sleep(1)

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT.write_text(json.dumps({
        "checked": checked,
        "mapped": len(result),
        "failed": failed,
        "valid_elements": sorted(VALID)
    }, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
