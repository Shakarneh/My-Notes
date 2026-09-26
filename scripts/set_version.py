"""Set the app version everywhere it appears.

    python scripts/set_version.py 1.4.0

app/api.py (APP_VERSION) is the single source of truth; installer.iss and
the README download filename are kept in sync with it.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

FILES = [
    ("app/api.py", r'APP_VERSION\s*=\s*"[^"]+"', 'APP_VERSION = "{v}"'),
    ("installer.iss", r'(#define AppVersion\s+)"[^"]+"', r'\g<1>"{v}"'),
    ("README.md", r"MyNotes-Setup-v\d+\.\d+\.\d+\.exe", "MyNotes-Setup-v{v}.exe"),
]


def current_version() -> str:
    text = (ROOT / "app/api.py").read_text(encoding="utf-8")
    return re.search(r'APP_VERSION\s*=\s*"([^"]+)"', text).group(1)


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
        sys.exit("usage: python scripts/set_version.py MAJOR.MINOR.PATCH")
    version = sys.argv[1]
    for rel, pattern, repl in FILES:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        new, count = re.subn(pattern, repl.replace("{v}", version), text, count=1)
        if count != 1:
            sys.exit(f"could not find the version in {rel}")
        path.write_text(new, encoding="utf-8", newline="")
        print(f"{rel}: {version}")


if __name__ == "__main__":
    main()
