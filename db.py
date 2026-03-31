"""PostgreSQL persistence for TBM meetings.

Requires DATABASE_URL environment variable (Neon / Supabase / any PostgreSQL).
Falls back gracefully when DATABASE_URL is not set (file-based storage used instead).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

_pool = None


def _get_pool():
    global _pool
    if _pool is not None:
        return _pool

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return None

    from psycopg2 import pool as pg_pool
    _pool = pg_pool.SimpleConnectionPool(1, 5, database_url)
    return _pool


def is_available() -> bool:
    """Return True if PostgreSQL is configured and reachable."""
    return _get_pool() is not None


def init_tables() -> None:
    """Create the meetings table if it does not exist."""
    pool = _get_pool()
    if pool is None:
        return

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS meetings (
                    id          TEXT PRIMARY KEY,
                    payload     JSONB NOT NULL,
                    pdf_data    BYTEA,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
        conn.commit()
    finally:
        pool.putconn(conn)


def save_meeting(meeting_id: str, payload: dict, pdf_bytes: bytes | None) -> None:
    pool = _get_pool()
    if pool is None:
        raise RuntimeError('DATABASE_URL not configured')

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO meetings (id, payload, pdf_data, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                    SET payload  = EXCLUDED.payload,
                        pdf_data = EXCLUDED.pdf_data
                """,
                (meeting_id, json.dumps(payload, ensure_ascii=False),
                 pdf_bytes, datetime.now(timezone.utc)),
            )
        conn.commit()
    finally:
        pool.putconn(conn)


def list_meetings() -> list[dict]:
    pool = _get_pool()
    if pool is None:
        return []

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, payload, created_at FROM meetings ORDER BY created_at DESC"
            )
            rows = cur.fetchall()
    finally:
        pool.putconn(conn)

    results = []
    for row in rows:
        meeting_id, payload, created_at = row
        if isinstance(payload, str):
            payload = json.loads(payload)
        pdf_file = f'{meeting_id}.pdf'
        results.append({
            **payload,
            'id': meeting_id,
            'pdfFile': pdf_file,
            'pdfUrl': f'/storage/pdfs/{pdf_file}',
            'logUrl': f'/storage/logs/{meeting_id}.json',
            'savedAt': created_at.isoformat() if created_at else '',
        })
    return results


def get_pdf(meeting_id: str) -> bytes | None:
    pool = _get_pool()
    if pool is None:
        return None

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pdf_data FROM meetings WHERE id = %s", (meeting_id,))
            row = cur.fetchone()
    finally:
        pool.putconn(conn)

    if row and row[0]:
        return bytes(row[0])
    return None


def get_log(meeting_id: str) -> dict | None:
    pool = _get_pool()
    if pool is None:
        return None

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM meetings WHERE id = %s", (meeting_id,))
            row = cur.fetchone()
    finally:
        pool.putconn(conn)

    if row and row[0]:
        payload = row[0]
        if isinstance(payload, str):
            payload = json.loads(payload)
        return payload
    return None


def delete_meeting(meeting_id: str) -> bool:
    pool = _get_pool()
    if pool is None:
        return False

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM meetings WHERE id = %s", (meeting_id,))
            deleted = cur.rowcount > 0
        conn.commit()
    finally:
        pool.putconn(conn)

    return deleted
