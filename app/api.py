from app import database, theme
import os
import base64
import json
import re
import subprocess
import sys
import tempfile
import threading
import urllib.request
import webview


APP_VERSION = "1.3.0"
GITHUB_REPO = "Shakarneh/My-Notes"


def _parse_version(v: str):
    if not v:
        return (0, 0, 0)
    m = re.match(r"v?(\d+)(?:\.(\d+))?(?:\.(\d+))?", v.strip())
    if not m:
        return (0, 0, 0)
    return tuple(int(x or 0) for x in m.groups())


class Api:
    APP_VERSION = APP_VERSION

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

    def check_for_update(self):
        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
            req = urllib.request.Request(url, headers={
                "User-Agent": "MyNote-Updater",
                "Accept": "application/vnd.github+json",
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            latest = (data.get("tag_name") or "").lstrip("v")
            release_url = data.get("html_url") or ""
            assets = data.get("assets") or []
            exe_asset = next(
                (a for a in assets if a.get("name", "").lower().endswith(".exe")),
                None,
            )
            download_url = exe_asset.get("browser_download_url") if exe_asset else None
            has_update = (
                _parse_version(latest) > _parse_version(self.APP_VERSION)
                and bool(download_url)
            )
            return {
                "ok": True,
                "current": self.APP_VERSION,
                "latest": latest,
                "has_update": has_update,
                "download_url": download_url,
                "release_url": release_url,
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def download_and_install_update(self, url: str):
        try:
            if not url or not url.startswith("https://"):
                return {"ok": False, "error": "Invalid download URL"}
            tmpdir = tempfile.gettempdir()
            filename = url.rsplit("/", 1)[-1] or "MyNotes-Setup.exe"
            installer_path = os.path.join(tmpdir, filename)

            req = urllib.request.Request(url, headers={"User-Agent": "MyNote-Updater"})
            with urllib.request.urlopen(req, timeout=60) as resp, open(installer_path, "wb") as f:
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)

            flags = (
                getattr(subprocess, "DETACHED_PROCESS", 0)
                | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            )
            subprocess.Popen(
                [installer_path, "/SILENT", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"],
                creationflags=flags,
                close_fds=True,
            )

            def _shutdown():
                for w in list(webview.windows):
                    try:
                        w.destroy()
                    except Exception:
                        pass

            threading.Timer(0.5, _shutdown).start()
            return {"ok": True, "installer_path": installer_path}
        except Exception as e:
            return {"ok": False, "error": str(e)}

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
