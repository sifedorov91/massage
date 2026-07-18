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
- `index.html` — **SPA**: вёрстка, календарь на чистом JS, модальное окно бронирования, админ-панель. Вся маршрутизация клиентская (pushState / popstate)
- `bookings.db` — создаётся автоматически при запуске (`CREATE TABLE IF NOT EXISTS`), без миграций. Используется PRAGMA journal_mode=WAL
- Синхронный sqlite3 (не async) в FastAPI endpoint'ах

## Роутинг

| Путь | Что происходит |
|------|----------------|
| `GET /` | Сервер отдаёт index.html |
| `GET /admin` | Сервер отдаёт **тот же** index.html; JS переключает вьюху |

## API

| Метод | Путь | Параметры |
|-------|------|-----------|
| GET | `/api/calendar` | `year`, `month` |
| GET | `/api/available-slots` | `date_str=YYYY-MM-DD` |
| POST | `/api/book` | body: `{full_name, phone, date, time}` |
| GET | `/api/admin/bookings` | `password=admin123` |
| POST | `/api/admin/confirm/{id}` | `password=admin123` |
| DELETE | `/api/admin/delete/{id}` | `password=admin123` |
| POST | `/api/admin/change-password` | body: `{current_password, new_password}` |

## Особенности

- Пароль админа по умолчанию: `admin123` (query-параметр). Хранится в таблице `settings`, можно сменить через интерфейс
- Слоты: 10:00–20:00 (11 шт, каждый час)
- Для сегоднящней даты в выпадающем списке — только будущие слоты
- Прошедшие даты некликабельны
- Календарь обновляется после бронирования без перезагрузки
- БД: `bookings.db`, таблица `clients`, поле `is_confirmed` (0/1)
