from app import database, theme
import os
import base64


class Api:
    APP_VERSION = "1.0"

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
            "language":       database.get_setting("language") or "ar",
        }

    def update_setting(self, key, value):
        database.set_setting(key, value)
        return True

    def get_version(self):
        return self.APP_VERSION

    def pick_image(self):
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.wm_attributes('-topmost', True)
            path = filedialog.askopenfilename(
                title="Select Image",
                filetypes=[("Images", "*.png *.jpg *.jpeg *.gif *.bmp *.webp")]
            )
            root.destroy()
            if not path:
                return None
            ext = os.path.splitext(path)[1].lower().lstrip('.')
            mime_map = {
                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'png': 'image/png', 'gif': 'image/gif',
                'bmp': 'image/bmp', 'webp': 'image/webp',
            }
            mime = mime_map.get(ext, 'image/png')
            with open(path, 'rb') as f:
                data = base64.b64encode(f.read()).decode()
            return f"data:{mime};base64,{data}"
        except Exception:
            return None

    def open_url(self, url):
        import webbrowser
        webbrowser.open(url)
        return True
