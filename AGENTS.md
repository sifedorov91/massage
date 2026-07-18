# MyFirstApp — Бронирование массажа

Full-stack: Python + FastAPI (backend), SQLite (DB), HTML + CSS + JS (frontend).

## Запуск

```bash
# venv: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# http://localhost:8000 или http://192.168.1.113:8000
```

Нет тестов, линтера, typechecker.

## Структура

- `main.py` — **единственный файл бекенда**: FastAPI app, SQLite инициализация, Pydantic модели, все API роуты, раздача HTML
- `index.html` — **SPA**: вёрстка. Вся маршрутизация клиентская (pushState / popstate)
- `style.css` — все стили
- `script.js` — весь JS (календарь, модальные окна, админ-панель, работа с API)
- `bookings.db` — создаётся автоматически при запуске (`CREATE TABLE IF NOT EXISTS`), без миграций. Используется PRAGMA journal_mode=WAL
- Синхронный sqlite3 (не async) в FastAPI endpoint'ах

## Роутинг

| Путь | Что происходит |
|------|----------------|
| `GET /` | Сервер отдаёт index.html |
| `GET /admin` | Сервер отдаёт **тот же** index.html; JS переключает вьюху |
| `GET /style.css` | Статика (явный роут) |
| `GET /script.js` | Статика (явный роут) |

## API

| Метод | Путь | Параметры |
|-------|------|-----------|
| GET | `/api/calendar` | `year`, `month` |
| GET | `/api/available-slots` | `date_str=YYYY-MM-DD` |
| GET | `/api/my-bookings` | `?token=` → `{bookings: [{appointment_date, appointment_time, is_confirmed}]}` |
| POST | `/api/book` | body: `{full_name, phone, date, time}` или `{token, date, time}` |
| POST | `/api/auth/register` | body: `{full_name, phone, password}` → `{token, full_name, role}` |
| POST | `/api/auth/login` | body: `{phone, password}` → `{token, full_name, role}` |
| GET | `/api/auth/me` | `?token=` → `{full_name, phone, role}` |
| GET | `/api/admin/bookings` | `password=admin123` **или** `token=<admin_token>` |
| POST | `/api/admin/confirm/{id}` | `password=admin123` **или** `token=<admin_token>` |
| DELETE | `/api/admin/delete/{id}` | `password=admin123` **или** `token=<admin_token>` |
| POST | `/api/admin/change-password` | body: `{current_password, new_password}` |
| GET | `/api/admin/users` | `password=admin123` **или** `token=<admin_token>` |
| DELETE | `/api/admin/user/{id}` | `password=admin123` **или** `token=<admin_token>` |

## Особенности

- Пароль админа по умолчанию: `admin123` (query-параметр). Хранится в таблице `settings`, можно сменить через интерфейс
- Слоты: 10:00–20:00 (11 шт, каждый час)
- Для сегоднящней даты в выпадающем списке — только будущие слоты
- Прошедшие даты некликабельны
- Календарь обновляется после бронирования без перезагрузки
- БД: `bookings.db`, таблица `clients`, поле `is_confirmed` (0/1)
