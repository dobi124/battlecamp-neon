# Battle Camp Neon Backend

## Запуск backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend по умолчанию обращается к:

```text
http://localhost:8000
```

## Telegram

В `.env` нужно указать токен бота:

```text
BOT_TOKEN=123456:YOUR_TELEGRAM_BOT_TOKEN
```

Backend проверяет `Telegram WebApp initData`, создаёт пользователя, хранит обмены и уведомления в SQLite.
