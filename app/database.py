import sqlite3
from app.config import get_db_path, TRASH_DAYS


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS notes (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                title         TEXT    NOT NULL DEFAULT 'ملاحظة جديدة',
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
        """)
        purge_old_trash(conn)


def purge_old_trash(conn: sqlite3.Connection = None):
    close_after = conn is None
    if conn is None:
        conn = get_connection()
    try:
        conn.execute(
            f"DELETE FROM notes WHERE is_deleted=1 AND deleted_at <= datetime('now', '-{TRASH_DAYS} days')"
        )
        conn.commit()
    finally:
        if close_after:
            conn.close()


def get_all_notes(conn: sqlite3.Connection = None):
    close_after = conn is None
    if conn is None:
        conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT id, title, content_plain, created_at, updated_at, is_pinned
               FROM notes WHERE is_deleted=0
               ORDER BY is_pinned DESC, updated_at DESC"""
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if close_after:
            conn.close()


def get_note(note_id: int):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM notes WHERE id=? AND is_deleted=0", (note_id,)
        ).fetchone()
        return dict(row) if row else None


def create_note():
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO notes (title, content, content_plain) VALUES ('ملاحظة جديدة', '', '')"
        )
        conn.commit()
        return cursor.lastrowid


def save_note(note_id: int, title: str, content: str, content_plain: str):
    with get_connection() as conn:
        conn.execute(
            """UPDATE notes
               SET title=?, content=?, content_plain=?, updated_at=datetime('now')
               WHERE id=? AND is_deleted=0""",
            (title, content, content_plain, note_id),
        )
        conn.commit()


def move_to_trash(note_id: int):
    with get_connection() as conn:
        conn.execute(
            "UPDATE notes SET is_deleted=1, deleted_at=datetime('now') WHERE id=?",
            (note_id,),
        )
        conn.commit()


def restore_note(note_id: int):
    with get_connection() as conn:
        conn.execute(
            "UPDATE notes SET is_deleted=0, deleted_at=NULL WHERE id=?",
            (note_id,),
        )
        conn.commit()


def delete_permanently(note_id: int):
    with get_connection() as conn:
        conn.execute("DELETE FROM notes WHERE id=? AND is_deleted=1", (note_id,))
        conn.commit()


def empty_trash():
    with get_connection() as conn:
        conn.execute("DELETE FROM notes WHERE is_deleted=1")
        conn.commit()


def get_trash():
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT id, title, content_plain, deleted_at,
                      CAST(julianday('now') - julianday(deleted_at) AS INTEGER) AS days_in_trash
               FROM notes WHERE is_deleted=1
               ORDER BY deleted_at DESC"""
        ).fetchall()
        return [dict(r) for r in rows]


def search_notes(query: str):
    with get_connection() as conn:
        pattern = f"%{query}%"
        rows = conn.execute(
            """SELECT id, title, content_plain, updated_at
               FROM notes WHERE is_deleted=0
               AND (title LIKE ? OR content_plain LIKE ?)
               ORDER BY updated_at DESC""",
            (pattern, pattern),
        ).fetchall()
        return [dict(r) for r in rows]


def get_setting(key: str) -> str:
    with get_connection() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None


def set_setting(key: str, value: str):
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (key, value)
        )
        conn.commit()
