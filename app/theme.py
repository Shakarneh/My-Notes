from datetime import datetime
from app import database

DAYTIME_START = 7
NIGHTTIME_START = 19


def get_current_theme() -> str:
    override = database.get_setting("theme_override")
    if override and override != "auto":
        return override
    hour = datetime.now().hour
    return "light" if DAYTIME_START <= hour < NIGHTTIME_START else "dark"
