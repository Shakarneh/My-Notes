from __future__ import annotations

import re
import sqlite3
import unicodedata
from contextlib import contextmanager
from app.config import get_db_path, TRASH_DAYS


# ─── Text normalization (used for search) ────────────────────────────────────
# Makes search forgiving: case-insensitive for every script (SQLite's LIKE is
# ASCII-only), ignores Arabic diacritics/tatweel and unifies letter variants.

_AR_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
_AR_VARIANTS = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
    "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي",
    "ё": "е", "Ё": "е",
})


def normalize(text) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", str(text))
    text = _AR_DIACRITICS.sub("", text)
    return text.translate(_AR_VARIANTS).casefold()


# ─── Connection handling ─────────────────────────────────────────────────────

def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.create_function("norm", 1, normalize, deterministic=True)
    return conn


@contextmanager
def connection():
    """Open a connection, commit on success, roll back on error, always close.

    (`with sqlite3.connect(...)` only manages the transaction — it never closes
    the connection, which leaked a handle on every API call.)
    """
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _rows(cursor) -> list:
    return [dict(r) for r in cursor.fetchall()]


# ─── Schema ──────────────────────────────────────────────────────────────────

def init_db():
    with connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS notes (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                title         TEXT    NOT NULL DEFAULT '',
                content       TEXT    NOT NULL DEFAULT '',
                content_plain TEXT    NOT NULL DEFAULT '',
                created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
                is_deleted    INTEGER NOT NULL DEFAULT 0,
                deleted_at    TEXT             DEFAULT NULL,
                is_pinned     INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);
            CREATE INDEX IF NOT EXISTS idx_notes_deleted_at  ON notes(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_notes_updated_at  ON notes(updated_at);

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            INSERT OR IGNORE INTO settings(key, value) VALUES ('theme_override', 'auto');
            INSERT OR IGNORE INTO settings(key, value) VALUES ('language', 'ar');
        """)
        purge_old_trash(conn)


def purge_old_trash(conn: sqlite3.Connection = None):
    if conn is None:
        with connection() as c:
            return purge_old_trash(c)
    conn.execute(
        "DELETE FROM notes WHERE is_deleted=1 AND deleted_at <= datetime('now', ?)",
        (f"-{TRASH_DAYS} days",),
    )


# ─── Notes ───────────────────────────────────────────────────────────────────

_LIST_COLUMNS = "id, title, substr(content_plain, 1, 300) AS content_plain, created_at, updated_at, is_pinned"


def get_all_notes():
    with connection() as conn:
        return _rows(conn.execute(
            f"""SELECT {_LIST_COLUMNS}
                FROM notes WHERE is_deleted=0
                ORDER BY is_pinned DESC, updated_at DESC, id DESC"""
        ))


def search_notes(query: str):
    q = normalize(query).strip()
    if not q:
        return get_all_notes()
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    with connection() as conn:
        return _rows(conn.execute(
            f"""SELECT {_LIST_COLUMNS}
                FROM notes WHERE is_deleted=0
                AND (norm(title) LIKE ? ESCAPE '\\' OR norm(content_plain) LIKE ? ESCAPE '\\')
                ORDER BY is_pinned DESC, updated_at DESC, id DESC""",
            (pattern, pattern),
        ))


def get_note(note_id: int):
    with connection() as conn:
        row = conn.execute(
            "SELECT * FROM notes WHERE id=? AND is_deleted=0", (note_id,)
        ).fetchone()
        return dict(row) if row else None


def create_note(title: str = "", content: str = "", content_plain: str = "") -> int:
    with connection() as conn:
        cursor = conn.execute(
            "INSERT INTO notes (title, content, content_plain) VALUES (?, ?, ?)",
            (title, content, content_plain),
        )
        return cursor.lastrowid


def save_note(note_id: int, title: str, content: str, content_plain: str) -> bool:
    with connection() as conn:
        cursor = conn.execute(
            """UPDATE notes
               SET title=?, content=?, content_plain=?, updated_at=datetime('now')
               WHERE id=? AND is_deleted=0""",
            (title, content, content_plain, note_id),
        )
        return cursor.rowcount > 0


def set_pinned(note_id: int, pinned: bool) -> bool:
    with connection() as conn:
        conn.execute(
            "UPDATE notes SET is_pinned=? WHERE id=? AND is_deleted=0",
            (1 if pinned else 0, note_id),
        )
    return bool(pinned)


def duplicate_note(note_id: int, suffix: str = "") -> int | None:
    with connection() as conn:
        row = conn.execute(
            "SELECT title, content, content_plain FROM notes WHERE id=? AND is_deleted=0",
            (note_id,),
        ).fetchone()
        if not row:
            return None
        cursor = conn.execute(
            "INSERT INTO notes (title, content, content_plain) VALUES (?, ?, ?)",
            ((row["title"] + suffix) if row["title"] else row["title"],
             row["content"], row["content_plain"]),
        )
        return cursor.lastrowid


# ─── Trash ───────────────────────────────────────────────────────────────────

def move_to_trash(note_id: int):
    with connection() as conn:
        conn.execute(
            "UPDATE notes SET is_deleted=1, deleted_at=datetime('now'), is_pinned=0 WHERE id=?",
            (note_id,),
        )


def restore_note(note_id: int):
    with connection() as conn:
        conn.execute(
            "UPDATE notes SET is_deleted=0, deleted_at=NULL WHERE id=?",
            (note_id,),
        )


def delete_permanently(note_id: int):
    with connection() as conn:
        conn.execute("DELETE FROM notes WHERE id=? AND is_deleted=1", (note_id,))


def empty_trash():
    with connection() as conn:
        conn.execute("DELETE FROM notes WHERE is_deleted=1")


def get_trash():
    with connection() as conn:
        return _rows(conn.execute(
            """SELECT id, title, substr(content_plain, 1, 300) AS content_plain, deleted_at,
                      CAST(julianday('now') - julianday(deleted_at) AS INTEGER) AS days_in_trash
               FROM notes WHERE is_deleted=1
               ORDER BY deleted_at DESC"""
        ))


def count_trash() -> int:
    with connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM notes WHERE is_deleted=1").fetchone()[0]


# ─── Backup ──────────────────────────────────────────────────────────────────

def export_notes():
    with connection() as conn:
        return _rows(conn.execute(
            """SELECT title, content, content_plain, created_at, updated_at, is_pinned
               FROM notes WHERE is_deleted=0
               ORDER BY created_at, id"""
        ))


def import_notes(notes: list) -> int:
    count = 0
    with connection() as conn:
        for n in notes:
            if not isinstance(n, dict):
                continue
            content = n.get("content")
            content_plain = n.get("content_plain")
            title = n.get("title")
            if not all(isinstance(v, str) for v in (content, content_plain, title)):
                continue
            created = n.get("created_at") if isinstance(n.get("created_at"), str) else None
            updated = n.get("updated_at") if isinstance(n.get("updated_at"), str) else None
            conn.execute(
                """INSERT INTO notes (title, content, content_plain, created_at, updated_at, is_pinned)
                   VALUES (?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')), ?)""",
                (title, content, content_plain, created, updated, 1 if n.get("is_pinned") else 0),
            )
            count += 1
    return count


# ─── Settings ────────────────────────────────────────────────────────────────

def get_setting(key: str) -> str | None:
    with connection() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None


def set_setting(key: str, value: str):
    with connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (key, str(value))
        )
