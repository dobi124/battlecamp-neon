import hashlib
import hmac
import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qsl

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
DB_PATH = os.getenv("DATABASE_PATH", "./battlecamp.sqlite3")
CORS_ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]

app = FastAPI(title="Battle Camp Neon Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ORIGINS == ["*"] else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            username TEXT,
            avatar TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_id TEXT NOT NULL,
            from_name TEXT,
            to_id TEXT NOT NULL,
            to_name TEXT,
            give_json TEXT NOT NULL,
            get_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            text TEXT NOT NULL,
            trade_id INTEGER,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS saved_teams (
            user_id TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_title TEXT NOT NULL,
            team_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(user_id, event_id)
        );

        CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_id TEXT NOT NULL,
            to_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(from_id, to_id)
        );
        """)

init_db()

class TelegramAuthIn(BaseModel):
    initData: str = ""
    user: dict[str, Any] = {}
    localMiniId: Optional[str] = None

class TradeIn(BaseModel):
    id: Optional[int] = None
    fromId: str
    fromName: Optional[str] = None
    toId: str
    toName: Optional[str] = None
    give: list[dict[str, Any]] = []
    get: list[dict[str, Any]] = []
    status: str = "pending"

class TradeRespondIn(BaseModel):
    userId: str
    status: str

class TeamIn(BaseModel):
    userId: str
    eventId: str
    eventTitle: str
    team: list[dict[str, Any]] = []

class FriendRequestIn(BaseModel):
    fromId: str
    toId: str

class FriendRespondIn(BaseModel):
    userId: str
    status: str

def verify_init_data(init_data: str) -> Optional[dict[str, Any]]:
    """
    Returns Telegram user if initData is valid.
    If BOT_TOKEN is not set, returns None and local fallback is used.
    """
    if not init_data or not BOT_TOKEN:
        return None

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated, received_hash):
        raise HTTPException(status_code=401, detail="Invalid Telegram initData")

    auth_date = int(pairs.get("auth_date", "0") or "0")
    if auth_date and time.time() - auth_date > 86400:
        raise HTTPException(status_code=401, detail="Telegram initData expired")

    if "user" in pairs:
        return json.loads(pairs["user"])
    return None

def upsert_user(user_id: str, name: str, username: str = "", avatar: str = ""):
    now = int(time.time())
    with db() as con:
        con.execute("""
        INSERT INTO users(id,name,username,avatar,created_at,updated_at)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            username=excluded.username,
            avatar=excluded.avatar,
            updated_at=excluded.updated_at
        """, (user_id, name, username, avatar, now, now))
    return get_user(user_id)

def get_user(user_id: str):
    with db() as con:
        row = con.execute("SELECT * FROM users WHERE id=?", (str(user_id),)).fetchone()
    return dict(row) if row else None

def add_notification(user_id: str, text: str, trade_id: Optional[int] = None):
    with db() as con:
        con.execute(
            "INSERT INTO notifications(user_id,text,trade_id,created_at) VALUES(?,?,?,?)",
            (str(user_id), text, trade_id, int(time.time()))
        )

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/auth/telegram")
def auth_telegram(payload: TelegramAuthIn):
    tg_user = verify_init_data(payload.initData) or payload.user or {}
    user_id = str(tg_user.get("id") or payload.localMiniId or int(time.time() * 1000))
    name = (str(tg_user.get("first_name") or "") + " " + str(tg_user.get("last_name") or "")).strip() or "Игрок"
    username = ("@" + tg_user["username"]) if tg_user.get("username") else ""
    avatar = tg_user.get("photo_url") or ""
    user = upsert_user(user_id, name, username, avatar)
    return {"user": user}

@app.get("/api/users/{user_id}")
def api_get_user(user_id: str):
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}

@app.post("/api/trades")
def create_trade(trade: TradeIn):
    now = int(time.time())
    with db() as con:
        cur = con.execute("""
        INSERT INTO trades(from_id,from_name,to_id,to_name,give_json,get_json,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?)
        """, (
            trade.fromId, trade.fromName or "", trade.toId, trade.toName or "",
            json.dumps(trade.give, ensure_ascii=False),
            json.dumps(trade.get, ensure_ascii=False),
            "pending", now, now
        ))
        trade_id = cur.lastrowid

    add_notification(trade.toId, f"Новый запрос обмена от {trade.fromName or trade.fromId}", trade_id)
    return {"trade": {"id": trade_id, "status": "pending"}}

@app.get("/api/trades/{user_id}")
def list_trades(user_id: str):
    with db() as con:
        rows = con.execute("""
        SELECT * FROM trades
        WHERE from_id=? OR to_id=?
        ORDER BY created_at DESC
        """, (user_id, user_id)).fetchall()

    trades = []
    for r in rows:
        d = dict(r)
        d["give"] = json.loads(d.pop("give_json") or "[]")
        d["get"] = json.loads(d.pop("get_json") or "[]")
        trades.append(d)
    return {"trades": trades}

@app.post("/api/trades/{trade_id}/respond")
def respond_trade(trade_id: int, payload: TradeRespondIn):
    if payload.status not in {"accepted", "declined"}:
        raise HTTPException(status_code=400, detail="Bad status")

    with db() as con:
        trade = con.execute("SELECT * FROM trades WHERE id=?", (trade_id,)).fetchone()
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        if str(trade["to_id"]) != str(payload.userId):
            raise HTTPException(status_code=403, detail="Only receiver can respond")

        con.execute(
            "UPDATE trades SET status=?, updated_at=? WHERE id=?",
            (payload.status, int(time.time()), trade_id)
        )

    text = "Обмен подтверждён" if payload.status == "accepted" else "Обмен отклонён"
    add_notification(trade["from_id"], text, trade_id)
    return {"ok": True, "status": payload.status}

@app.get("/api/notifications/{user_id}")
def list_notifications(user_id: str):
    with db() as con:
        rows = con.execute("""
        SELECT * FROM notifications
        WHERE user_id=?
        ORDER BY created_at DESC
        LIMIT 100
        """, (user_id,)).fetchall()
    return {"notifications": [dict(r) for r in rows]}

@app.post("/api/notifications/{user_id}/read")
def mark_notifications_read(user_id: str):
    with db() as con:
        con.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (user_id,))
    return {"ok": True}


@app.get("/api/home-feed")
def home_feed():
    now = int(time.time())
    base_events = [
        {"id":"event1","title":"Rockalypse","icon":"🪨","status":"АКТИВНО"},
        {"id":"event2","title":"PVP League","icon":"🏆","status":"СКОРО"},
        {"id":"event3","title":"Dominion","icon":"👑","status":"СКОРО"},
        {"id":"event6","title":"Serpenta's Ascension","icon":"🐍","status":"СКОРО"},
    ]
    events = [{**e, "startsAt": time.strftime("%Y-%m-%dT12:00:00", time.gmtime(now + i*86400))} for i, e in enumerate(base_events)]
    news = [
        {"title":"Боевой штаб обновлён", "text":"На главной теперь только ближайшие события, новости и быстрые действия.", "date":time.strftime("%d.%m.%Y", time.localtime())},
        {"title":"Профили друзей", "text":"Открывайте друга и смотрите его сохранённые команды по событиям.", "date":time.strftime("%d.%m.%Y", time.localtime())},
        {"title":"Карточки событий", "text":"Карточки получили дополнительные иконки статуса и переход к сборке команды.", "date":time.strftime("%d.%m.%Y", time.localtime())},
    ]
    return {"events": events, "news": news}

@app.post("/api/teams")
def save_team(payload: TeamIn):
    with db() as con:
        con.execute("""
        INSERT INTO saved_teams(user_id,event_id,event_title,team_json,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(user_id,event_id) DO UPDATE SET event_title=excluded.event_title, team_json=excluded.team_json, updated_at=excluded.updated_at
        """, (payload.userId, payload.eventId, payload.eventTitle, json.dumps(payload.team, ensure_ascii=False), int(time.time())))
    return {"ok": True}

@app.get("/api/teams/{user_id}")
def list_saved_teams(user_id: str):
    with db() as con:
        rows = con.execute("SELECT * FROM saved_teams WHERE user_id=? ORDER BY updated_at DESC", (user_id,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["team"] = json.loads(d.pop("team_json") or "[]")
        out.append(d)
    return {"teams": out}

@app.post("/api/friends/request")
def friend_request(payload: FriendRequestIn):
    now = int(time.time())
    with db() as con:
        con.execute("""
        INSERT INTO friendships(from_id,to_id,status,created_at,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(from_id,to_id) DO UPDATE SET status='pending', updated_at=excluded.updated_at
        """, (payload.fromId, payload.toId, "pending", now, now))
    add_notification(payload.toId, f"Новая заявка в друзья от {payload.fromId}")
    return {"ok": True}

@app.get("/api/friends/{user_id}")
def list_friends(user_id: str):
    with db() as con:
        rows = con.execute("SELECT * FROM friendships WHERE from_id=? OR to_id=? ORDER BY updated_at DESC", (user_id, user_id)).fetchall()
    return {"friends": [dict(r) for r in rows]}

@app.post("/api/friends/{friendship_id}/respond")
def respond_friend(friendship_id: int, payload: FriendRespondIn):
    if payload.status not in {"accepted", "declined"}:
        raise HTTPException(status_code=400, detail="Bad status")
    with db() as con:
        row = con.execute("SELECT * FROM friendships WHERE id=?", (friendship_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Friend request not found")
        if str(row["to_id"]) != str(payload.userId):
            raise HTTPException(status_code=403, detail="Only receiver can respond")
        con.execute("UPDATE friendships SET status=?, updated_at=? WHERE id=?", (payload.status, int(time.time()), friendship_id))
    return {"ok": True}
