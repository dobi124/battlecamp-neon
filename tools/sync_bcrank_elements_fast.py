#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Очень быстрая синхронизация элементов с BC Rank.

Запуск:
    python tools/sync_bcrank_elements_fast.py

Настройки:
    MAX_WORKERS = 80      # очень быстро, но может быть нагрузкой на сайт
    SKIP_EXISTING = True  # пропускать уже заполненных монстров
"""

from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, re, time, threading

ROOT = Path(__file__).resolve().parents[1]
MONSTERS = ROOT / "data" / "monsters.json"
OUT = ROOT / "data" / "monster-elements.json"
REPORT = ROOT / "data" / "elements-sync-report.json"

MAX_WORKERS = 80
TIMEOUT = 12
SKIP_EXISTING = True
SAVE_EVERY = 25

VALID = ["fire", "water", "rock", "wind", "leaf"]
lock = threading.Lock()

def fetch_html(name):
    url = f"https://bcrank.us/catalog/?q={quote_plus(name)}"
    req = Request(url, headers={
        "User-Agent": "Mozilla/5.0 BattleCampNeonFastSync/2.0",
        "Accept": "text/html,application/xhtml+xml",
    })
    with urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8", errors="ignore")

def parse_elements(html):
    low = html.lower()
    idx = low.find("element:")
    chunk = low[idx:idx+700] if idx != -1 else low[:2500]
    found = []
    for el in VALID:
        if re.search(rf"(image:\s*)?{el}\b", chunk):
            found.append(el)
    return found[:2]

def check_monster(name):
    html = fetch_html(name)
    elements = parse_elements(html)
    return name, elements

def atomic_save(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)

def main():
    monsters = json.loads(MONSTERS.read_text(encoding="utf-8"))
    existing = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}

    names = [m["name"] for m in monsters]
    if SKIP_EXISTING:
        names = [n for n in names if n not in existing or not existing.get(n)]

    result = dict(existing)
    failed = []
    done = 0
    start = time.time()

    print(f"Всего к проверке: {len(names)}")
    print(f"Потоков: {MAX_WORKERS}")
    print("Старт...")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(check_monster, name): name for name in names}

        for fut in as_completed(futures):
            name = futures[fut]
            try:
                n, elements = fut.result()
                if elements:
                    result[n] = elements
                else:
                    result.setdefault(n, [])
                status = ",".join(elements) if elements else "нет"
            except Exception as e:
                failed.append({"name": name, "error": str(e)})
                status = "FAIL"

            done += 1
            if done % SAVE_EVERY == 0:
                atomic_save(OUT, result)
                elapsed = max(0.1, time.time() - start)
                speed = done / elapsed
                left = (len(names) - done) / speed
                print(f"[{done}/{len(names)}] speed={speed:.1f}/sec left={left:.0f}s last={name}: {status}")
            else:
                print(f"[{done}/{len(names)}] {name}: {status}")

    atomic_save(OUT, result)
    REPORT.write_text(json.dumps({
        "checked_this_run": done,
        "mapped_total": sum(1 for v in result.values() if v),
        "failed": failed,
        "workers": MAX_WORKERS,
        "skip_existing": SKIP_EXISTING,
        "seconds": round(time.time() - start, 2)
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("ГОТОВО")
    print("Найдено элементов всего:", sum(1 for v in result.values() if v))
    print("Ошибок:", len(failed))
    print("Время:", round(time.time() - start, 2), "сек.")

if __name__ == "__main__":
    main()
