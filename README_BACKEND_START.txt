Запуск полного проекта:

1. Frontend:
   python -m http.server 5500

2. Backend:
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   copy .env.example .env
   uvicorn main:app --reload --port 8000

3. Открыть:
   http://127.0.0.1:5500

4. Для Telegram Mini App:
   - задеплой frontend на HTTPS
   - задеплой backend на HTTPS
   - укажи BOT_TOKEN в backend/.env
   - в localStorage можно поменять адрес API:
     localStorage.setItem('bc_api_base','https://your-backend-domain.com')
