from __future__ import annotations

from app import database, theme
from app.config import TRASH_DAYS
import os
import base64
import json
import re
import subprocess
import tempfile
import threading
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
import webview


APP_VERSION = "1.3.0"
GITHUB_REPO = "Shakarneh/My-Notes"


def _is_github_host(host) -> bool:
    # Release downloads start on github.com and redirect to a *.githubusercontent.com CDN.
    host = (host or "").lower()
    return host == "github.com" or host.endswith(".githubusercontent.com")


_IMAGE_MIME = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "png": "image/png", "gif": "image/gif",
    "bmp": "image/bmp", "webp": "image/webp",
}
_MAX_IMAGE_BYTES = 25 * 1024 * 1024


def _parse_version(v: str):
    if not v:
        return (0, 0, 0)
    m = re.match(r"v?(\d+)(?:\.(\d+))?(?:\.(\d+))?", v.strip())
    if not m:
        return (0, 0, 0)
    return tuple(int(x or 0) for x in m.groups())


def _safe_filename(name: str, fallback: str = "note") -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name or "").strip().rstrip(".")
    return (name or fallback)[:100]


def _window():
    return webview.windows[0] if webview.windows else None


def _first_path(result):
    if not result:
        return None
    if isinstance(result, (list, tuple)):
        return result[0] if result else None
    return result


class Api:
    APP_VERSION = APP_VERSION

    # ─── Notes ────────────────────────────────────────────────────────────

    def get_all_notes(self):
        return database.get_all_notes()

    def get_note(self, note_id):
        return database.get_note(int(note_id))

    def create_note(self):
        return database.create_note()

    def save_note(self, note_id, title, content, content_plain):
        return database.save_note(int(note_id), title or "", content or "", content_plain or "")

    def set_pinned(self, note_id, pinned):
        return database.set_pinned(int(note_id), bool(pinned))

    def duplicate_note(self, note_id, suffix=""):
        return database.duplicate_note(int(note_id), suffix or "")

    def search_notes(self, query):
        return database.search_notes(query or "")

    # ─── Trash ────────────────────────────────────────────────────────────

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

    def count_trash(self):
        return database.count_trash()

    # ─── Settings ─────────────────────────────────────────────────────────

    def get_theme(self):
        return theme.get_current_theme()

    def get_settings(self):
        return {
            "theme_override": database.get_setting("theme_override") or "auto",
            "language":       database.get_setting("language") or "ar",
            "accent":         database.get_setting("accent") or "violet",
            "focus_mode":     database.get_setting("focus_mode") == "1",
            "trash_days":     TRASH_DAYS,
        }

    def update_setting(self, key, value):
        if key not in ("theme_override", "language", "accent", "focus_mode"):
            return False
        database.set_setting(key, value)
        return True

    def get_version(self):
        return self.APP_VERSION

    # ─── Files: images, export, backup ────────────────────────────────────

    def pick_image(self):
        # Uses the native dialog from pywebview — tkinter is excluded from the
        # PyInstaller build, so the old tkinter picker silently failed there.
        try:
            win = _window()
            if not win:
                return None
            path = _first_path(win.create_file_dialog(
                webview.FileDialog.OPEN,
                file_types=("Images (*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp)",),
            ))
            if not path:
                return None
            if os.path.getsize(path) > _MAX_IMAGE_BYTES:
                return {"error": "too_large"}
            ext = os.path.splitext(path)[1].lower().lstrip(".")
            mime = _IMAGE_MIME.get(ext, "image/png")
            with open(path, "rb") as f:
                data = base64.b64encode(f.read()).decode()
            return f"data:{mime};base64,{data}"
        except Exception:
            return None

    def export_note(self, title, text, html):
        """Save one note as .txt or .html (chosen in the save dialog)."""
        try:
            win = _window()
            if not win:
                return {"ok": False, "error": "no window"}
            path = _first_path(win.create_file_dialog(
                webview.FileDialog.SAVE,
                save_filename=_safe_filename(title) + ".txt",
                file_types=("Text (*.txt)", "Web page (*.html)"),
            ))
            if not path:
                return {"ok": False, "cancelled": True}
            ext = os.path.splitext(path)[1].lower()
            if ext not in (".txt", ".html", ".htm"):
                path += ".txt"
                ext = ".txt"
            if ext == ".txt":
                body = text or ""
            else:
                safe_title = (title or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                body = (
                    "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\">"
                    f"<title>{safe_title}</title>"
                    "<style>body{font-family:'Segoe UI',Tahoma,sans-serif;max-width:760px;margin:40px auto;"
                    "padding:0 20px;line-height:1.8;color:#1a1a1a}img{max-width:100%}"
                    "blockquote{border-inline-start:3px solid #ccc;margin:0;padding-inline-start:16px;color:#555}"
                    "pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow:auto}</style>"
                    f"</head><body dir=\"auto\"><h1>{safe_title}</h1>\n{html or ''}\n</body></html>\n"
                )
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(body)
            return {"ok": True, "path": path}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def backup_notes(self):
        """Write every (non-deleted) note to a JSON backup file."""
        try:
            win = _window()
            if not win:
                return {"ok": False, "error": "no window"}
            stamp = datetime.now().strftime("%Y-%m-%d")
            path = _first_path(win.create_file_dialog(
                webview.FileDialog.SAVE,
                save_filename=f"MyNotes-backup-{stamp}.json",
                file_types=("Backup (*.json)",),
            ))
            if not path:
                return {"ok": False, "cancelled": True}
            if not path.lower().endswith(".json"):
                path += ".json"
            notes = database.export_notes()
            payload = {
                "app": "MyNotes",
                "format": 1,
                "version": APP_VERSION,
                "exported_at": datetime.now().isoformat(timespec="seconds"),
                "notes": notes,
            }
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=1)
            return {"ok": True, "count": len(notes), "path": path}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def restore_backup(self):
        """Import notes from a JSON backup. Existing notes are never overwritten."""
        try:
            win = _window()
            if not win:
                return {"ok": False, "error": "no window"}
            path = _first_path(win.create_file_dialog(
                webview.FileDialog.OPEN,
                file_types=("Backup (*.json)",),
            ))
            if not path:
                return {"ok": False, "cancelled": True}
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            notes = payload.get("notes") if isinstance(payload, dict) else None
            if not isinstance(notes, list):
                return {"ok": False, "error": "invalid_backup"}
            count = database.import_notes(notes)
            return {"ok": True, "count": count}
        except (ValueError, UnicodeDecodeError):
            return {"ok": False, "error": "invalid_backup"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def open_url(self, url):
        if not isinstance(url, str) or not re.match(r"^(https?://|mailto:)", url, re.I):
            return False
        webbrowser.open(url)
        return True

    # ─── Updates ──────────────────────────────────────────────────────────

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
            parsed = urllib.parse.urlparse(url or "")
            if parsed.scheme != "https" or (parsed.hostname or "").lower() != "github.com":
                return {"ok": False, "error": "Invalid download URL"}
            if not parsed.path.lower().startswith(f"/{GITHUB_REPO}/releases/download/".lower()):
                return {"ok": False, "error": "Invalid download URL"}

            tmpdir = tempfile.gettempdir()
            filename = _safe_filename(parsed.path.rsplit("/", 1)[-1], "MyNotes-Setup.exe")
            if not filename.lower().endswith(".exe"):
                filename += ".exe"
            installer_path = os.path.join(tmpdir, filename)
            partial_path = installer_path + ".part"

            req = urllib.request.Request(url, headers={"User-Agent": "MyNote-Updater"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                final_host = urllib.parse.urlparse(resp.geturl()).hostname
                if not _is_github_host(final_host):
                    return {"ok": False, "error": "Unexpected download host"}
                with open(partial_path, "wb") as f:
                    while True:
                        chunk = resp.read(64 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
            # Only swap in a fully downloaded installer — never run a truncated one.
            os.replace(partial_path, installer_path)

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
