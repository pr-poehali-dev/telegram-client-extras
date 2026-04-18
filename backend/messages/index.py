"""
Сообщения и чаты.
GET  /conversations             — список чатов с последним сообщением
POST /conversations             — начать чат с пользователем {user_id}
GET  /conversations/:id/messages — история сообщений
POST /messages                  — отправить сообщение {conversation_id, text, media_url, media_type}
POST /messages/read             — отметить сообщения прочитанными {conversation_id}
"""
import json
import os
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
        f"SELECT u.id, u.display_name, u.avatar_url FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.id = '{session_id}' AND s.expires_at > NOW()"
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "display_name": row[1], "avatar_url": row[2]}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    session_id = event.get("headers", {}).get("X-Session-Id", "")

    conn = get_conn()
    try:
        user = get_session_user(conn, session_id)
        if not user:
            return err("Не авторизован", 401)

        uid = user["id"]
        cur = conn.cursor()

        # GET /conversations
        if method == "GET" and path.rstrip("/").endswith("/conversations"):
            cur.execute(f"""
                SELECT c.id,
                       CASE WHEN c.user_a = {uid} THEN u2.id ELSE u1.id END as partner_id,
                       CASE WHEN c.user_a = {uid} THEN u2.display_name ELSE u1.display_name END as partner_name,
                       CASE WHEN c.user_a = {uid} THEN u2.avatar_url ELSE u1.avatar_url END as partner_avatar,
                       CASE WHEN c.user_a = {uid} THEN u2.online_at ELSE u1.online_at END as partner_online,
                       m.text, m.media_url, m.media_type, m.created_at, m.sender_id,
                       (SELECT COUNT(*) FROM {SCHEMA}.messages mm WHERE mm.conversation_id = c.id AND mm.sender_id != {uid} AND mm.read = FALSE) as unread
                FROM {SCHEMA}.conversations c
                JOIN {SCHEMA}.users u1 ON u1.id = c.user_a
                JOIN {SCHEMA}.users u2 ON u2.id = c.user_b
                LEFT JOIN LATERAL (
                    SELECT text, media_url, media_type, created_at, sender_id
                    FROM {SCHEMA}.messages
                    WHERE conversation_id = c.id
                    ORDER BY created_at DESC LIMIT 1
                ) m ON TRUE
                WHERE c.user_a = {uid} OR c.user_b = {uid}
                ORDER BY COALESCE(m.created_at, c.created_at) DESC
            """)
            rows = cur.fetchall()
            import time
            convs = []
            for r in rows:
                online_at = r[4]
                is_online = bool(online_at and (online_at.timestamp() > (time.time() - 300)))
                last_msg = None
                if r[5] or r[6]:
                    last_msg = {"text": r[5], "media_url": r[6], "media_type": r[7],
                                "created_at": str(r[8]) if r[8] else None, "is_mine": r[9] == uid}
                convs.append({
                    "id": r[0], "partner_id": r[1], "partner_name": r[2],
                    "partner_avatar": r[3], "online": is_online,
                    "last_message": last_msg, "unread": int(r[10])
                })
            return ok({"conversations": convs})

        # POST /conversations
        if method == "POST" and path.rstrip("/").endswith("/conversations"):
            body = json.loads(event.get("body") or "{}")
            partner_id = body.get("user_id")
            if not partner_id:
                return err("Укажите user_id")
            partner_id = int(partner_id)
            if partner_id == uid:
                return err("Нельзя начать чат с собой")
            a, b = (uid, partner_id) if uid < partner_id else (partner_id, uid)
            cur.execute(
                f"INSERT INTO {SCHEMA}.conversations (user_a, user_b) VALUES ({a}, {b}) "
                f"ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = EXCLUDED.user_a RETURNING id"
            )
            conv_id = cur.fetchone()[0]
            conn.commit()
            return ok({"conversation_id": conv_id})

        # GET /conversations/:id/messages
        if method == "GET" and "/messages" in path:
            parts = [p for p in path.split("/") if p]
            conv_id = None
            for i, p in enumerate(parts):
                if p == "conversations" and i + 1 < len(parts):
                    conv_id = parts[i + 1]
            if not conv_id or not conv_id.isdigit():
                return err("Не найдено", 404)
            conv_id = int(conv_id)
            cur.execute(
                f"SELECT id FROM {SCHEMA}.conversations WHERE id = {conv_id} AND (user_a = {uid} OR user_b = {uid})"
            )
            if not cur.fetchone():
                return err("Нет доступа", 403)
            cur.execute(f"""
                SELECT m.id, m.sender_id, u.display_name, u.avatar_url, m.text, m.media_url, m.media_type, m.created_at, m.read
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE m.conversation_id = {conv_id}
                ORDER BY m.created_at ASC
                LIMIT 100
            """)
            rows = cur.fetchall()
            msgs = [{"id": r[0], "sender_id": r[1], "sender_name": r[2], "sender_avatar": r[3],
                     "text": r[4], "media_url": r[5], "media_type": r[6],
                     "created_at": str(r[7]), "read": r[8], "is_mine": r[1] == uid} for r in rows]
            return ok({"messages": msgs})

        # POST /messages/read
        if method == "POST" and path.endswith("/read"):
            body = json.loads(event.get("body") or "{}")
            conv_id = body.get("conversation_id")
            if conv_id:
                cur.execute(
                    f"UPDATE {SCHEMA}.messages SET read = TRUE "
                    f"WHERE conversation_id = {int(conv_id)} AND sender_id != {uid} AND read = FALSE"
                )
                conn.commit()
            return ok({"ok": True})

        # POST /messages
        if method == "POST" and path.rstrip("/").endswith("/messages"):
            body = json.loads(event.get("body") or "{}")
            conv_id = body.get("conversation_id")
            text = body.get("text", "").strip()
            media_url = body.get("media_url", "")
            media_type = body.get("media_type", "")
            if not conv_id:
                return err("Укажите conversation_id")
            if not text and not media_url:
                return err("Пустое сообщение")
            conv_id = int(conv_id)
            cur.execute(
                f"SELECT id FROM {SCHEMA}.conversations WHERE id = {conv_id} AND (user_a = {uid} OR user_b = {uid})"
            )
            if not cur.fetchone():
                return err("Нет доступа", 403)
            safe_text = text.replace("'", "''")
            safe_media = media_url.replace("'", "''")
            safe_type = media_type.replace("'", "''")
            cur.execute(f"""
                INSERT INTO {SCHEMA}.messages (conversation_id, sender_id, text, media_url, media_type)
                VALUES ({conv_id}, {uid}, '{safe_text}', '{safe_media}', '{safe_type}')
                RETURNING id, created_at
            """)
            row = cur.fetchone()
            conn.commit()
            return ok({"message": {"id": row[0], "created_at": str(row[1]), "conversation_id": conv_id,
                                   "sender_id": uid, "text": text, "media_url": media_url,
                                   "media_type": media_type, "is_mine": True}})

        return err("Не найдено", 404)
    finally:
        conn.close()
