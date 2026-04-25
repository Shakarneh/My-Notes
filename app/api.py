from app import database, theme


class Api:
    def get_all_notes(self):
        return database.get_all_notes()

    def get_note(self, note_id):
        return database.get_note(int(note_id))

    def create_note(self):
        return database.create_note()

    def save_note(self, note_id, title, content, content_plain):
        database.save_note(int(note_id), title, content, content_plain)
        return True

    def move_to_trash(self, note_id):
        database.move_to_trash(int(note_id))
        return True

    def restore_note(self, note_id):
        database.restore_note(int(note_id))
        return True

    def delete_permanently(self, note_id):
        database.delete_permanently(int(note_id))
        return True

    def empty_trash(self):
        database.empty_trash()
        return True

    def get_trash(self):
        return database.get_trash()

    def search_notes(self, query):
        return database.search_notes(query)

    def get_theme(self):
        return theme.get_current_theme()

    def get_settings(self):
        return {
            "theme_override": database.get_setting("theme_override") or "auto",
        }

    def update_setting(self, key, value):
        database.set_setting(key, value)
        return True
