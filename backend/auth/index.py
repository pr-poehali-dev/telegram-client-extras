"""
Авторизация: отправка кода на email, верификация, выход. v2
POST /send-code  — отправить 6-значный код на email
POST /verify     — проверить код, вернуть сессию
POST /logout     — завершить сессию
GET  /me         — получить текущего пользователя
"""
import json
import os
import random
import string
import secrets
import psycopg2
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p25604669_telegram_client_extr")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data, status=200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, default=str)}


def err(msg, status=400):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}


def get_session_user(conn, session_id):
    if not session_id:
        return None
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.email, u.username, u.display_name, u.avatar_url, u.bio FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.id = '{session_id}' AND s.expires_at > NOW()"
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "username": row[2], "display_name": row[3], "avatar_url": row[4], "bio": row[5]}


def send_email_code(email, code):
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))

    if not smtp_host:
        print(f"[DEV] Код для {email}: {code}")
        return True

    msg = MIMEText(
        f"Ваш код входа в Vault Messenger: {code}\n\nКод действует 10 минут.",
        "plain", "utf-8"
    )
    msg["Subject"] = f"Код входа: {code}"
    msg["From"] = smtp_user
    msg["To"] = email

    try:
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as s:
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, [email], msg.as_string())
        return True
    except Exception as e:
        print(f"SMTP error: {e}")
        return False


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    session_id = event.get("headers", {}).get("X-Session-Id", "")
    conn = get_conn()

    try:
        # GET /me
        if method == "GET" and path.endswith("/me"):
            user = get_session_user(conn, session_id)
            if not user:
                return err("Не авторизован", 401)
            conn.cursor().execute(
                f"UPDATE {SCHEMA}.users SET online_at = NOW() WHERE id = {user['id']}"
            )
            conn.commit()
            return ok({"user": user})

        # POST /send-code
        if method == "POST" and path.endswith("/send-code"):
            email = body.get("email", "").strip().lower()
            if not email or "@" not in email:
                return err("Укажите корректный email")
            code = "".join(random.choices(string.digits, k=6))
            expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {SCHEMA}.auth_codes (email, code, expires_at) VALUES ('{email}', '{code}', '{expires}')"
            )
            conn.commit()
            send_email_code(email, code)
            return ok({"sent": True, "email": email})

        # POST /verify
        if method == "POST" and path.endswith("/verify"):
            email = body.get("email", "").strip().lower()
            code = body.get("code", "").strip()
            display_name = body.get("display_name", "").strip()
            if not email or not code:
                return err("Укажите email и код")
            cur = conn.cursor()
            cur.execute(
                f"SELECT id FROM {SCHEMA}.auth_codes "
                f"WHERE email = '{email}' AND code = '{code}' AND used = FALSE AND expires_at > NOW() "
                f"ORDER BY created_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                return err("Неверный или устаревший код")
            cur.execute(f"UPDATE {SCHEMA}.auth_codes SET used = TRUE WHERE id = {row[0]}")

            cur.execute(f"SELECT id, display_name FROM {SCHEMA}.users WHERE email = '{email}'")
            user_row = cur.fetchone()
            if user_row:
                user_id = user_row[0]
                if display_name and not user_row[1]:
                    cur.execute(f"UPDATE {SCHEMA}.users SET display_name = '{display_name}' WHERE id = {user_id}")
            else:
                name = display_name or email.split("@")[0]
                cur.execute(
                    f"INSERT INTO {SCHEMA}.users (email, display_name) VALUES ('{email}', '{name}') RETURNING id"
                )
                user_id = cur.fetchone()[0]

            session_id_new = secrets.token_hex(32)
            expires_s = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (id, user_id, expires_at) VALUES ('{session_id_new}', {user_id}, '{expires_s}')"
            )
            conn.commit()

            cur.execute(f"SELECT id, email, username, display_name, avatar_url, bio FROM {SCHEMA}.users WHERE id = {user_id}")
            u = cur.fetchone()
            return ok({"session_id": session_id_new, "user": {"id": u[0], "email": u[1], "username": u[2], "display_name": u[3], "avatar_url": u[4], "bio": u[5]}})

        # POST /logout
        if method == "POST" and path.endswith("/logout"):
            if session_id:
                conn.cursor().execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE id = '{session_id}'")
                conn.commit()
            return ok({"ok": True})

        # POST /update-profile
        if method == "POST" and path.endswith("/update-profile"):
            user = get_session_user(conn, session_id)
            if not user:
                return err("Не авторизован", 401)
            name = body.get("display_name", user["display_name"]).strip()
            bio = body.get("bio", user["bio"] or "").strip()
            username = body.get("username", user["username"] or "").strip().lower()
            cur = conn.cursor()
            if username:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = '{username}' AND id != {user['id']}")
                if cur.fetchone():
                    return err("Имя пользователя уже занято")
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET display_name = '{name}', bio = '{bio}', username = '{username}' WHERE id = {user['id']}"
                )
            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET display_name = '{name}', bio = '{bio}' WHERE id = {user['id']}"
                )
            conn.commit()
            return ok({"ok": True})

        # GET /search?q=...
        if method == "GET" and "search" in path:
            user = get_session_user(conn, session_id)
            if not user:
                return err("Не авторизован", 401)
            qs = event.get("queryStringParameters") or {}
            q = qs.get("q", "").strip()
            if len(q) < 2:
                return ok({"users": []})
            safe_q = q.replace("'", "''")
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, display_name, username, avatar_url, online_at FROM {SCHEMA}.users "
                f"WHERE id != {user['id']} AND ("
                f"  lower(display_name) LIKE lower('%{safe_q}%') OR "
                f"  lower(email) LIKE lower('%{safe_q}%') OR "
                f"  lower(COALESCE(username,'')) LIKE lower('%{safe_q}%')"
                f") ORDER BY display_name LIMIT 20"
            )
            import time as _time
            rows = cur.fetchall()
            result = []
            for r in rows:
                online_at = r[4]
                is_online = bool(online_at and (online_at.timestamp() > (_time.time() - 300)))
                result.append({"id": r[0], "display_name": r[1], "username": r[2], "avatar_url": r[3], "online": is_online})
            return ok({"users": result})

        return err("Не найдено", 404)
    finally:
        conn.close()