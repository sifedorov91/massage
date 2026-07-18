from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
import sqlite3
from datetime import date, datetime
from pydantic import BaseModel
from collections import defaultdict
import calendar as cal_mod
import hashlib, secrets

app = FastAPI()

DB_PATH = "bookings.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            appointment_date DATE NOT NULL,
            appointment_time TEXT NOT NULL,
            is_confirmed INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            token TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    try:
        conn.execute("ALTER TABLE clients ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
    except sqlite3.OperationalError:
        pass
    conn.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        ("admin_password", "admin123")
    )

    admin_pw_hash = hashlib.sha256(b"admin123").hexdigest()
    admin_token = secrets.token_hex(32)
    conn.execute(
        "INSERT OR IGNORE INTO users (full_name, phone, password_hash, token, role) VALUES (?, ?, ?, ?, ?)",
        ("Администратор", "admin", admin_pw_hash, admin_token, "admin")
    )
    conn.commit()
    conn.close()

init_db()


def get_admin_password():
    conn = get_db()
    cursor = conn.execute("SELECT value FROM settings WHERE key = ?", ("admin_password",))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else "admin123"

def check_admin(password="", token=""):
    if password and password == get_admin_password():
        return True
    if token:
        conn = get_db()
        cursor = conn.execute("SELECT id FROM users WHERE token = ? AND role = ?", (token, "admin"))
        row = cursor.fetchone()
        conn.close()
        if row:
            return True
    raise HTTPException(status_code=403, detail="Доступ запрещён")

class BookingRequest(BaseModel):
    full_name: str = ""
    phone: str = ""
    date: str
    time: str
    token: str = ""

class AuthRegisterRequest(BaseModel):
    full_name: str
    phone: str
    password: str

class AuthLoginRequest(BaseModel):
    phone: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

TOTAL_SLOTS = 11


@app.get("/style.css")
async def serve_css():
    return FileResponse("style.css", media_type="text/css")

@app.get("/script.js")
async def serve_js():
    return FileResponse("script.js", media_type="application/javascript")

@app.get("/")
@app.get("/admin")
async def serve_html():
    with open("index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/auth/register")
async def register(req: AuthRegisterRequest):
    name = req.full_name.strip()
    phone = req.phone.strip()
    if not name:
        raise HTTPException(400, "Укажите ФИО")
    if not phone:
        raise HTTPException(400, "Укажите телефон")
    if len(req.password) < 4:
        raise HTTPException(400, "Пароль минимум 4 символа")

    conn = get_db()
    cursor = conn.execute("SELECT id FROM users WHERE phone = ?", (phone,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(400, "Этот телефон уже зарегистрирован")

    pw_hash = hashlib.sha256(req.password.encode()).hexdigest()
    token = secrets.token_hex(32)
    conn.execute(
        "INSERT INTO users (full_name, phone, password_hash, token, role) VALUES (?, ?, ?, ?, ?)",
        (name, phone, pw_hash, token, "user")
    )
    conn.commit()
    conn.close()
    return {"token": token, "full_name": name, "role": "user"}


@app.post("/api/auth/login")
async def login(req: AuthLoginRequest):
    phone = req.phone.strip()
    if not phone:
        raise HTTPException(400, "Укажите телефон")

    conn = get_db()
    cursor = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(403, "Неверный телефон или пароль")

    pw_hash = hashlib.sha256(req.password.encode()).hexdigest()
    if user["password_hash"] != pw_hash:
        conn.close()
        raise HTTPException(403, "Неверный телефон или пароль")

    token = secrets.token_hex(32)
    conn.execute("UPDATE users SET token = ? WHERE id = ?", (token, user["id"]))
    conn.commit()
    conn.close()
    return {"token": token, "full_name": user["full_name"], "role": user["role"]}


@app.get("/api/auth/me")
async def get_me(token: str):
    if not token:
        raise HTTPException(401, "Требуется авторизация")
    conn = get_db()
    cursor = conn.execute("SELECT full_name, phone, role FROM users WHERE token = ?", (token,))
    user = cursor.fetchone()
    conn.close()
    if not user:
        raise HTTPException(401, "Недействительный токен")
    return {"full_name": user["full_name"], "phone": user["phone"], "role": user["role"]}


@app.get("/api/calendar")
async def get_calendar(year: int, month: int, token: str = ""):
    today = date.today()
    now = datetime.now()

    conn = get_db()
    cursor = conn.execute(
        "SELECT appointment_date, appointment_time FROM clients WHERE strftime('%Y', appointment_date) = ? AND strftime('%m', appointment_date) = ?",
        (str(year), f"{month:02d}")
    )
    rows = cursor.fetchall()

    my_dates = set()
    if token:
        cursor = conn.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = cursor.fetchone()
        if user:
            cursor = conn.execute(
                "SELECT appointment_date FROM clients WHERE user_id = ? AND strftime('%Y', appointment_date) = ? AND strftime('%m', appointment_date) = ?",
                (user["id"], str(year), f"{month:02d}")
            )
            my_dates = set(r["appointment_date"] for r in cursor.fetchall())
    conn.close()

    booked_by_date = defaultdict(set)
    for r in rows:
        booked_by_date[r["appointment_date"]].add(r["appointment_time"])

    _, days_in_month = cal_mod.monthrange(year, month)

    days = {}
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        date_str = str(d)
        booked = booked_by_date.get(date_str, set())

        if d == today:
            available = [h for h in range(10, 21) if f"{h:02d}:00" not in booked and h > now.hour]
            days[str(day)] = {
                "is_past": len(available) == 0,
                "is_full": len(available) == 0,
                "slots_remaining": len(available),
                "has_my_booking": date_str in my_dates,
            }
        else:
            days[str(day)] = {
                "is_past": d < today,
                "is_full": len(booked) >= TOTAL_SLOTS,
                "slots_remaining": max(0, TOTAL_SLOTS - len(booked)),
                "has_my_booking": date_str in my_dates,
            }

    return {"days": days, "year": year, "month": month}


@app.get("/api/available-slots")
async def get_available_slots(date_str: str):
    conn = get_db()
    cursor = conn.execute(
        "SELECT appointment_time FROM clients WHERE appointment_date = ?",
        (date_str,)
    )
    rows = cursor.fetchall()
    conn.close()

    booked_times = set(r["appointment_time"] for r in rows)
    all_times = [f"{h:02d}:00" for h in range(10, 21)]
    now = datetime.now()
    booking_date = datetime.strptime(date_str, "%Y-%m-%d").date()

    available = []
    for t in all_times:
        if t in booked_times:
            continue
        if booking_date == now.date():
            hour = int(t.split(":")[0])
            if hour <= now.hour:
                continue
        available.append(t)

    return {"available_slots": available}


@app.post("/api/book")
async def book_appointment(booking: BookingRequest):
    conn = get_db()

    user_id = None
    full_name = ""
    phone = ""

    if booking.token:
        cursor = conn.execute("SELECT id, full_name, phone FROM users WHERE token = ?", (booking.token,))
        user = cursor.fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=401, detail="Недействительный токен")
        user_id = user["id"]
        full_name = user["full_name"]
        phone = user["phone"]
    else:
        full_name = booking.full_name.strip()
        phone = booking.phone.strip()
        if not full_name:
            conn.close()
            raise HTTPException(status_code=400, detail="Укажите ФИО")
        if not phone:
            conn.close()
            raise HTTPException(status_code=400, detail="Укажите телефон")

    cursor = conn.execute(
        "SELECT COUNT(*) as cnt FROM clients WHERE appointment_date = ? AND appointment_time = ?",
        (booking.date, booking.time)
    )
    if cursor.fetchone()["cnt"] > 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Это время уже занято")

    cursor = conn.execute(
        "SELECT COUNT(*) as cnt FROM clients WHERE appointment_date = ?",
        (booking.date,)
    )
    if cursor.fetchone()["cnt"] >= TOTAL_SLOTS:
        conn.close()
        raise HTTPException(status_code=400, detail="На эту дату нет свободных мест")

    conn.execute(
        "INSERT INTO clients (full_name, phone, appointment_date, appointment_time, user_id) VALUES (?, ?, ?, ?, ?)",
        (full_name, phone, booking.date, booking.time, user_id)
    )
    conn.commit()
    conn.close()

    return {"success": True, "message": "Запись успешно создана!"}


@app.get("/api/my-bookings")
async def get_my_bookings(token: str):
    if not token:
        raise HTTPException(401, "Требуется авторизация")
    conn = get_db()
    cursor = conn.execute("SELECT id, full_name FROM users WHERE token = ?", (token,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(401, "Недействительный токен")
    cursor = conn.execute(
        "SELECT appointment_date, appointment_time, is_confirmed FROM clients WHERE user_id = ? ORDER BY appointment_date, appointment_time",
        (user["id"],)
    )
    bookings = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"bookings": bookings}


@app.get("/api/admin/bookings")
async def get_bookings(password: str = "", token: str = ""):
    check_admin(password, token)

    conn = get_db()
    cursor = conn.execute("""
        SELECT c.*, u.full_name as user_name, u.phone as user_phone
        FROM clients c
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY c.appointment_date, c.appointment_time
    """)
    bookings = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"bookings": bookings}


@app.post("/api/admin/confirm/{booking_id}")
async def confirm_booking(booking_id: int, password: str = "", token: str = ""):
    check_admin(password, token)

    conn = get_db()
    conn.execute("UPDATE clients SET is_confirmed = 1 WHERE id = ?", (booking_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@app.delete("/api/admin/delete/{booking_id}")
async def delete_booking(booking_id: int, password: str = "", token: str = ""):
    check_admin(password, token)

    conn = get_db()
    conn.execute("DELETE FROM clients WHERE id = ?", (booking_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@app.get("/api/admin/users")
async def get_users(password: str = "", token: str = ""):
    check_admin(password, token)

    conn = get_db()
    cursor = conn.execute("""
        SELECT u.*, COUNT(c.id) as bookings_count
        FROM users u
        LEFT JOIN clients c ON c.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    """)
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"users": users}


@app.delete("/api/admin/user/{user_id}")
async def delete_user(user_id: int, password: str = "", token: str = ""):
    check_admin(password, token)

    conn = get_db()
    conn.execute("DELETE FROM clients WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@app.post("/api/admin/change-password")
async def change_password(req: ChangePasswordRequest):
    if req.current_password != get_admin_password():
        raise HTTPException(status_code=403, detail="Неверный текущий пароль")
    if len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="Новый пароль должен быть минимум 4 символа")

    conn = get_db()
    conn.execute("UPDATE settings SET value = ? WHERE key = ?", (req.new_password, "admin_password"))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Пароль успешно изменён"}
