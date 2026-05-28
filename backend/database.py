"""
SQLite-backed profile storage.

Profiles are stored as JSON blobs.  The DB path comes from config.
"""
import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_DB_PATH: str = ""


def init_db(db_path: str) -> None:
    global _DB_PATH
    _DB_PATH = db_path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                name        TEXT PRIMARY KEY,
                description TEXT NOT NULL DEFAULT '',
                settings    TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS link_labels (
                link_id    TEXT PRIMARY KEY,
                label      TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS link_impairments (
                link_id    TEXT PRIMARY KEY,
                settings   TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS link_cycles (
                link_id  TEXT PRIMARY KEY,
                on_secs  REAL NOT NULL,
                off_secs REAL NOT NULL
            )
        """)
    logger.info("Database ready: %s", db_path)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_profile(name: str, description: str, settings: dict) -> None:
    now = _now()
    payload = json.dumps(settings)
    with _connect() as conn:
        conn.execute("""
            INSERT INTO profiles (name, description, settings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                settings    = excluded.settings,
                updated_at  = excluded.updated_at
        """, (name, description, payload, now, now))
    logger.info("Profile saved: %s", name)


def get_profile(name: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE name = ?", (name,)
        ).fetchone()
    if row is None:
        return None
    return {
        "name": row["name"],
        "description": row["description"],
        "settings": json.loads(row["settings"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_profiles() -> List[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT name, description, created_at, updated_at FROM profiles ORDER BY name"
        ).fetchall()
    return [
        {
            "name": r["name"],
            "description": r["description"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def delete_profile(name: str) -> bool:
    with _connect() as conn:
        cursor = conn.execute("DELETE FROM profiles WHERE name = ?", (name,))
    deleted = cursor.rowcount > 0
    if deleted:
        logger.info("Profile deleted: %s", name)
    return deleted


def save_impairment(link_id: str, settings: dict) -> None:
    now = _now()
    with _connect() as conn:
        conn.execute("""
            INSERT INTO link_impairments (link_id, settings, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(link_id) DO UPDATE SET
                settings   = excluded.settings,
                updated_at = excluded.updated_at
        """, (link_id, json.dumps(settings), now))


def get_impairment(link_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT settings FROM link_impairments WHERE link_id = ?", (link_id,)
        ).fetchone()
    return json.loads(row["settings"]) if row else None


def delete_impairment(link_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM link_impairments WHERE link_id = ?", (link_id,))


def save_cycle(link_id: str, on_secs: float, off_secs: float) -> None:
    with _connect() as conn:
        conn.execute("""
            INSERT INTO link_cycles (link_id, on_secs, off_secs)
            VALUES (?, ?, ?)
            ON CONFLICT(link_id) DO UPDATE SET
                on_secs  = excluded.on_secs,
                off_secs = excluded.off_secs
        """, (link_id, on_secs, off_secs))


def get_all_cycles() -> List[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT link_id, on_secs, off_secs FROM link_cycles").fetchall()
    return [{"link_id": r["link_id"], "on_secs": r["on_secs"], "off_secs": r["off_secs"]} for r in rows]


def delete_cycle(link_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM link_cycles WHERE link_id = ?", (link_id,))


def get_label(link_id: str) -> str:
    with _connect() as conn:
        row = conn.execute(
            "SELECT label FROM link_labels WHERE link_id = ?", (link_id,)
        ).fetchone()
    return row["label"] if row else ""


def set_label(link_id: str, label: str) -> None:
    now = _now()
    with _connect() as conn:
        conn.execute("""
            INSERT INTO link_labels (link_id, label, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(link_id) DO UPDATE SET
                label      = excluded.label,
                updated_at = excluded.updated_at
        """, (link_id, label, now))
    logger.info("Label updated for %s", link_id)
