import os
import sys

APP_NAME = "NotesApp"
APP_TITLE = "My Note"
APP_VERSION = "1.2.0"
APP_WIDTH = 1200
APP_HEIGHT = 800
TRASH_DAYS = 90

GITHUB_REPO = "Shakarneh/My-Notes"


def resource_path(relative_path: str) -> str:
    if hasattr(sys, "_MEIPASS"):
        base = sys._MEIPASS
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative_path)


def get_db_path() -> str:
    db_dir = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), APP_NAME)
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "notes.db")
