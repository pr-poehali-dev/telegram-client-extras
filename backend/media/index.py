"""
Загрузка медиафайлов (фото, видео) в S3.
POST / — загрузить файл {data: base64DataUrl, conversation_id}
"""
import json
import os
import base64
import boto3
import psycopg2
import time

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p25604669_telegram_client_extr")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data, status=200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, default=str)}


def err(msg, status=400):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    session_id = event.get("headers", {}).get("X-Session-Id", "")
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT u.id FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.id = '{session_id}' AND s.expires_at > NOW()"
        )
        row = cur.fetchone()
        if not row:
            return err("Не авторизован", 401)
        uid = row[0]

        body = json.loads(event.get("body") or "{}")
        data_url = body.get("data", "")
        if not data_url or "base64," not in data_url:
            return err("Нет данных")

        content_type = data_url.split(";")[0].replace("data:", "")
        if content_type.startswith("image/"):
            ext = content_type.split("/")[-1].replace("jpeg", "jpg")
            folder = "photos"
        elif content_type.startswith("video/"):
            ext = content_type.split("/")[-1]
            folder = "videos"
        else:
            ext = "bin"
            folder = "files"

        raw = base64.b64decode(data_url.split(",")[1])
        key = f"media/{folder}/{uid}/{int(time.time())}.{ext}"

        s3 = boto3.client(
            "s3",
            endpoint_url="https://bucket.poehali.dev",
            aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        )
        s3.put_object(Bucket="files", Key=key, Body=raw, ContentType=content_type)
        url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

        return ok({"url": url, "media_type": folder.rstrip("s")})
    finally:
        conn.close()
