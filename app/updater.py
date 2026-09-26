"""Background auto-updater backed by GitHub Releases.

Flow: check() finds the latest release -> if it is newer, the installer is
downloaded in a background thread (verified by size and SHA-256 when GitHub
provides a digest) -> the UI polls status() and offers "Restart & update"
-> install() runs the Inno Setup installer silently and closes the app; the
installer relaunches the new version.

A release whose notes contain "[required]" is marked as required and the UI
will not let the user dismiss it.
"""
from __future__ import annotations

import glob
import hashlib
import json
import os
import re
import subprocess
import threading
import time
import urllib.parse
import urllib.request

import webview

_USER_AGENT = "MyNote-Updater"
_REQUIRED_MARK = re.compile(r"\[required\]", re.I)


def parse_version(v: str):
    if not v:
        return (0, 0, 0)
    m = re.match(r"v?(\d+)(?:\.(\d+))?(?:\.(\d+))?", v.strip())
    if not m:
        return (0, 0, 0)
    return tuple(int(x or 0) for x in m.groups())


def _is_github_host(host) -> bool:
    # Release downloads start on github.com and redirect to a *.githubusercontent.com CDN.
    host = (host or "").lower()
    return host == "github.com" or host.endswith(".githubusercontent.com")


def _updates_dir() -> str:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or os.path.expanduser("~")
    path = os.path.join(base, "NotesApp", "updates")
    os.makedirs(path, exist_ok=True)
    return path


class Updater:
    def __init__(self, current_version: str, repo: str):
        self.current = current_version
        self.repo = repo
        self._lock = threading.Lock()
        self._thread = None
        self._state = {
            "status": "idle",          # idle | checking | up_to_date | downloading | ready | error
            "current": current_version,
            "latest": None,
            "notes": "",
            "required": False,
            "release_url": "",
            "progress": 0.0,           # 0..1 while downloading
            "error": None,
        }
        self._asset = None
        self._installer_path = None

    # ─── public ────────────────────────────────────────────────────────────

    def status(self) -> dict:
        with self._lock:
            return dict(self._state)

    def check(self) -> dict:
        """Look for a newer release and start downloading it in the background."""
        with self._lock:
            if self._state["status"] in ("checking", "downloading", "ready"):
                return dict(self._state)
            self._state.update(status="checking", error=None)
        try:
            release = self._fetch_latest()
        except Exception as e:
            self._set(status="error", error=str(e))
            return self.status()

        latest = (release.get("tag_name") or "").lstrip("vV")
        asset = next(
            (a for a in release.get("assets") or []
             if a.get("name", "").lower().endswith(".exe") and a.get("browser_download_url")),
            None,
        )
        notes = release.get("body") or ""
        self._set(
            latest=latest,
            notes=_REQUIRED_MARK.sub("", notes).strip(),
            required=bool(_REQUIRED_MARK.search(notes)),
            release_url=release.get("html_url") or "",
        )
        if parse_version(latest) <= parse_version(self.current) or not asset:
            self._set(status="up_to_date")
            return self.status()

        self._asset = asset
        self._set(status="downloading", progress=0.0)
        self._thread = threading.Thread(target=self._download, daemon=True)
        self._thread.start()
        return self.status()

    def install(self) -> dict:
        """Run the downloaded installer silently, then close the app."""
        with self._lock:
            path = self._installer_path
            ready = self._state["status"] == "ready"
        if not ready or not path or not os.path.exists(path):
            return {"ok": False, "error": "Update is not ready"}
        try:
            flags = (getattr(subprocess, "DETACHED_PROCESS", 0)
                     | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))
            subprocess.Popen(
                [path, "/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART",
                 "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"],
                creationflags=flags,
                close_fds=True,
            )
        except Exception as e:
            return {"ok": False, "error": str(e)}

        def _shutdown():
            for w in list(webview.windows):
                try:
                    w.destroy()
                except Exception:
                    pass

        # Give the installer a moment to start before the app exits;
        # the installer relaunches the new version when it finishes.
        threading.Timer(1.5, _shutdown).start()
        return {"ok": True}

    # ─── internals ─────────────────────────────────────────────────────────

    def _set(self, **kw):
        with self._lock:
            self._state.update(kw)

    def _fetch_latest(self) -> dict:
        url = f"https://api.github.com/repos/{self.repo}/releases/latest"
        req = urllib.request.Request(url, headers={
            "User-Agent": _USER_AGENT,
            "Accept": "application/vnd.github+json",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _validate_url(self, url: str) -> bool:
        parsed = urllib.parse.urlparse(url or "")
        return (
            parsed.scheme == "https"
            and (parsed.hostname or "").lower() == "github.com"
            and parsed.path.lower().startswith(f"/{self.repo}/releases/download/".lower())
        )

    def _download(self):
        asset = self._asset
        latest = self.status()["latest"]
        try:
            url = asset["browser_download_url"]
            if not self._validate_url(url):
                raise ValueError("Invalid download URL")
            expected_size = int(asset.get("size") or 0)
            digest = (asset.get("digest") or "").lower()
            expected_sha = digest.split(":", 1)[1] if digest.startswith("sha256:") else None

            folder = _updates_dir()
            target = os.path.join(folder, f"MyNotes-Setup-v{latest}.exe")

            # Already downloaded on a previous run?
            if os.path.exists(target) and self._verify(target, expected_size, expected_sha):
                self._finish(target, folder)
                return

            partial = target + ".part"
            req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
            sha = hashlib.sha256()
            received = 0
            with urllib.request.urlopen(req, timeout=60) as resp:
                if not _is_github_host(urllib.parse.urlparse(resp.geturl()).hostname):
                    raise ValueError("Unexpected download host")
                total = expected_size or int(resp.headers.get("Content-Length") or 0)
                last_report = 0.0
                with open(partial, "wb") as f:
                    while True:
                        chunk = resp.read(256 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
                        sha.update(chunk)
                        received += len(chunk)
                        now = time.monotonic()
                        if total and now - last_report > 0.2:
                            self._set(progress=min(received / total, 0.999))
                            last_report = now

            if expected_size and received != expected_size:
                raise ValueError("Download incomplete")
            if expected_sha and sha.hexdigest() != expected_sha:
                raise ValueError("Download is corrupted (checksum mismatch)")
            os.replace(partial, target)
            self._finish(target, folder)
        except Exception as e:
            self._set(status="error", error=str(e), progress=0.0)

    def _verify(self, path, expected_size, expected_sha) -> bool:
        if expected_size and os.path.getsize(path) != expected_size:
            return False
        if expected_sha:
            h = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
            return h.hexdigest() == expected_sha
        return bool(expected_size)

    def _finish(self, target, folder):
        # Remove installers from older updates
        for old in glob.glob(os.path.join(folder, "MyNotes-Setup-*.exe*")):
            if os.path.abspath(old) != os.path.abspath(target):
                try:
                    os.remove(old)
                except OSError:
                    pass
        with self._lock:
            self._installer_path = target
            self._state.update(status="ready", progress=1.0)
