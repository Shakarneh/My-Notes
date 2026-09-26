"""Backend tests: run with  python -m unittest discover tests"""
import os
import shutil
import sqlite3
import tempfile
import unittest

# Point the app at a throwaway data folder before importing it.
_TMP = tempfile.mkdtemp(prefix="mynotes-test-")
os.environ["APPDATA"] = _TMP

from app import database as db  # noqa: E402


class DatabaseTestCase(unittest.TestCase):
    def setUp(self):
        path = os.path.join(_TMP, "NotesApp", "notes.db")
        if os.path.exists(path):
            os.remove(path)
        db.init_db()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_TMP, ignore_errors=True)

    def _note(self, title, plain):
        note_id = db.create_note()
        db.save_note(note_id, title, "{}", plain)
        return note_id


class TestNormalize(unittest.TestCase):
    def test_case_insensitive_all_scripts(self):
        self.assertEqual(db.normalize("ПРИВЕТ Hello"), "привет hello")

    def test_arabic_diacritics_and_variants(self):
        self.assertEqual(db.normalize("مَدْرَسَة"), db.normalize("مدرسه"))
        self.assertEqual(db.normalize("إلى"), db.normalize("الي"))
        self.assertEqual(db.normalize("كـــتاب"), db.normalize("كتاب"))

    def test_empty(self):
        self.assertEqual(db.normalize(None), "")


class TestNotes(DatabaseTestCase):
    def test_create_save_get(self):
        note_id = self._note("Title", "Body")
        note = db.get_note(note_id)
        self.assertEqual(note["title"], "Title")
        self.assertEqual(note["content_plain"], "Body")

    def test_pinned_first(self):
        a = self._note("a", "")
        b = self._note("b", "")
        db.set_pinned(a, True)
        ids = [n["id"] for n in db.get_all_notes()]
        self.assertEqual(ids[0], a)
        self.assertIn(b, ids)

    def test_duplicate(self):
        a = self._note("Plan", "x")
        b = db.duplicate_note(a, " (copy)")
        self.assertEqual(db.get_note(b)["title"], "Plan (copy)")
        self.assertIsNone(db.duplicate_note(999999))

    def test_list_preview_is_truncated(self):
        self._note("Long", "x" * 5000)
        self.assertLessEqual(len(db.get_all_notes()[0]["content_plain"]), 300)
        # ...but the full text is still stored
        self.assertEqual(len(db.get_note(db.get_all_notes()[0]["id"])["content_plain"]), 5000)


class TestSearch(DatabaseTestCase):
    def test_russian_case_insensitive(self):
        a = self._note("Привет", "Заметка")
        self.assertEqual([n["id"] for n in db.search_notes("привет")], [a])
        self.assertEqual([n["id"] for n in db.search_notes("ЗАМЕТКА")], [a])

    def test_arabic_ignores_diacritics(self):
        a = self._note("مَدْرَسَة", "")
        self.assertEqual([n["id"] for n in db.search_notes("مدرسه")], [a])

    def test_wildcards_are_literal(self):
        a = self._note("100% done", "a_b")
        self._note("1000 things", "axb")
        self.assertEqual([n["id"] for n in db.search_notes("100%")], [a])
        self.assertEqual([n["id"] for n in db.search_notes("a_b")], [a])
        self.assertEqual(db.search_notes("1_0"), [])

    def test_blank_query_returns_all(self):
        self._note("a", "")
        self._note("b", "")
        self.assertEqual(len(db.search_notes("   ")), 2)

    def test_trashed_notes_hidden(self):
        a = self._note("secret", "")
        db.move_to_trash(a)
        self.assertEqual(db.search_notes("secret"), [])


class TestTrash(DatabaseTestCase):
    def test_trash_restore_delete(self):
        a = self._note("t", "")
        db.set_pinned(a, True)
        db.move_to_trash(a)
        self.assertIsNone(db.get_note(a))
        self.assertEqual(db.count_trash(), 1)
        self.assertFalse(db.save_note(a, "x", "{}", "x"), "saving a trashed note must fail")
        db.restore_note(a)
        self.assertEqual(db.get_note(a)["is_pinned"], 1, "restore keeps the pin")
        db.move_to_trash(a)
        db.delete_permanently(a)
        self.assertEqual(db.count_trash(), 0)

    def test_delete_permanently_only_trashed(self):
        a = self._note("keep", "")
        db.delete_permanently(a)
        self.assertIsNotNone(db.get_note(a))

    def test_purge_old_trash(self):
        a = self._note("old", "")
        db.move_to_trash(a)
        with db.connection() as conn:
            conn.execute("UPDATE notes SET deleted_at=datetime('now', '-100 days') WHERE id=?", (a,))
        db.purge_old_trash()
        self.assertEqual(db.count_trash(), 0)


class TestBackup(DatabaseTestCase):
    def test_round_trip(self):
        self._note("one", "1")
        self._note("two", "2")
        exported = db.export_notes()
        self.assertEqual(db.import_notes(exported), 2)
        self.assertEqual(len(db.get_all_notes()), 4)

    def test_import_skips_invalid_rows(self):
        rows = [
            {"title": "ok", "content": "{}", "content_plain": ""},
            {"title": 5, "content": "{}", "content_plain": ""},
            {"bad": True},
            "not a dict",
            None,
        ]
        self.assertEqual(db.import_notes(rows), 1)


class TestConnections(DatabaseTestCase):
    def test_connection_is_closed(self):
        with db.connection() as conn:
            pass
        with self.assertRaises(sqlite3.ProgrammingError):
            conn.execute("SELECT 1")

    def test_rollback_on_error(self):
        a = self._note("before", "")
        with self.assertRaises(RuntimeError):
            with db.connection() as conn:
                conn.execute("UPDATE notes SET title='after' WHERE id=?", (a,))
                raise RuntimeError("boom")
        self.assertEqual(db.get_note(a)["title"], "before")


class TestSettings(DatabaseTestCase):
    def test_defaults_and_update(self):
        self.assertEqual(db.get_setting("language"), "ar")
        db.set_setting("language", "en")
        self.assertEqual(db.get_setting("language"), "en")
        self.assertIsNone(db.get_setting("missing"))


if __name__ == "__main__":
    unittest.main()
