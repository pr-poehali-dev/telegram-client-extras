"""
Пользователи: поиск, получение профиля, обновление аватара.
GET  /search?q=... — поиск пользователей
GET  /:id          — профиль пользователя
POST /avatar       — загрузить аватар (base64)
"""
import json
import os
import base64
import boto3
import psycopg2

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
        f"SELECT u.id, u.email, u.username, u.display_name, u.avatar_url FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.id = '{session_id}' AND s.expires_at > NOW()"
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "username": row[2], "display_name": row[3], "avatar_url": row[4]}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    qs = event.get("queryStringParameters") or {}
    session_id = event.get("headers", {}).get("X-Session-Id", "")

    conn = get_conn()
    try:
        user = get_session_user(conn, session_id)
        if not user:
            return err("Не авторизован", 401)

        # GET /search
        if method == "GET" and "search" in path:
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
            rows = cur.fetchall()
            users = [{"id": r[0], "display_name": r[1], "username": r[2], "avatar_url": r[3],
                      "online": (r[4] and (r[4].timestamp() > (__import__('time').time() - 300)))} for r in rows]
            return ok({"users": users})

        # POST /avatar
        if method == "POST" and "avatar" in path:
            body = {}
            if event.get("body"):
                body = json.loads(event["body"])
            data_url = body.get("data", "")
            if not data_url or "base64," not in data_url:
                return err("Нет данных изображения")
            content_type = data_url.split(";")[0].replace("data:", "")
            ext = "jpg" if "jpeg" in content_type else content_type.split("/")[-1]
            raw = base64.b64decode(data_url.split(",")[1])
            key = f"avatars/{user['id']}.{ext}"
            s3 = boto3.client(
                "s3",
                endpoint_url="https://bucket.poehali.dev",
                aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            )
            s3.put_object(Bucket="files", Key=key, Body=raw, ContentType=content_type)
            url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            conn.cursor().execute(f"UPDATE {SCHEMA}.users SET avatar_url = '{url}' WHERE id = {user['id']}")
            conn.commit()
            return ok({"avatar_url": url})

        # GET /:id
        if method == "GET":
            parts = [p for p in path.split("/") if p]
            uid = parts[-1] if parts else ""
            if uid.isdigit():
                cur = conn.cursor()
                cur.execute(
                    f"SELECT id, display_name, username, avatar_url, bio, online_at FROM {SCHEMA}.users WHERE id = {uid}"
                )
                row = cur.fetchone()
                if not row:
                    return err("Не найдено", 404)
                return ok({"user": {"id": row[0], "display_name": row[1], "username": row[2],
                                    "avatar_url": row[3], "bio": row[4], "online_at": row[5]}})

        return err("Не найдено", 404)
    finally:
        conn.close()
