"""Updater tests with a fake GitHub: python -m unittest discover tests"""
import hashlib
import io
import json
import os
import shutil
import tempfile
import time
import unittest
from unittest import mock

_TMP = tempfile.mkdtemp(prefix="mynotes-upd-")
os.environ["LOCALAPPDATA"] = _TMP

from app import updater as upd  # noqa: E402

REPO = "Shakarneh/My-Notes"
PAYLOAD = b"MZ fake installer " * 1000


class _Resp(io.BytesIO):
    def __init__(self, data, url):
        super().__init__(data)
        self._url = url
        self.headers = {"Content-Length": str(len(data))}

    def geturl(self):
        return self._url

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def fake_github(tag="v9.0.0", body="- New stuff", payload=PAYLOAD, digest=True,
                url=None, final_host="release-assets.githubusercontent.com"):
    url = url or f"https://github.com/{REPO}/releases/download/{tag}/MyNotes-Setup-{tag}.exe"
    release = {
        "tag_name": tag,
        "body": body,
        "html_url": f"https://github.com/{REPO}/releases/tag/{tag}",
        "assets": [{
            "name": f"MyNotes-Setup-{tag}.exe",
            "browser_download_url": url,
            "size": len(PAYLOAD),
            "digest": "sha256:" + hashlib.sha256(PAYLOAD).hexdigest() if digest else None,
        }],
    }

    def urlopen(req, timeout=0):
        u = req.full_url if hasattr(req, "full_url") else req
        if "api.github.com" in u:
            return _Resp(json.dumps(release).encode(), u)
        return _Resp(payload, f"https://{final_host}/file")

    return urlopen


def wait(u, timeout=5):
    end = time.time() + timeout
    while u.status()["status"] in ("checking", "downloading") and time.time() < end:
        time.sleep(0.02)
    return u.status()


class TestUpdater(unittest.TestCase):
    def setUp(self):
        shutil.rmtree(os.path.join(_TMP, "NotesApp"), ignore_errors=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_TMP, ignore_errors=True)

    def run_check(self, current="1.3.0", **kw):
        u = upd.Updater(current, REPO)
        with mock.patch("urllib.request.urlopen", fake_github(**kw)):
            u.check()
            return u, wait(u)

    def test_version_parsing(self):
        self.assertGreater(upd.parse_version("v1.10.0"), upd.parse_version("1.9.9"))
        self.assertEqual(upd.parse_version("garbage"), (0, 0, 0))

    def test_newer_version_downloads_and_is_ready(self):
        u, st = self.run_check()
        self.assertEqual(st["status"], "ready")
        self.assertEqual(st["latest"], "9.0.0")
        self.assertEqual(st["progress"], 1.0)
        self.assertFalse(st["required"])
        with open(u._installer_path, "rb") as f:
            self.assertEqual(f.read(), PAYLOAD)

    def test_same_version_is_up_to_date(self):
        _, st = self.run_check(current="9.0.0")
        self.assertEqual(st["status"], "up_to_date")

    def test_required_marker(self):
        _, st = self.run_check(body="[required]\n- Security fix")
        self.assertTrue(st["required"])
        self.assertNotIn("[required]", st["notes"])

    def test_corrupted_download_rejected(self):
        _, st = self.run_check(payload=b"X" * len(PAYLOAD))
        self.assertEqual(st["status"], "error")
        self.assertIn("checksum", st["error"])

    def test_truncated_download_rejected(self):
        _, st = self.run_check(payload=PAYLOAD[:100], digest=False)
        self.assertEqual(st["status"], "error")

    def test_foreign_url_rejected(self):
        _, st = self.run_check(url="https://evil.example.com/Shakarneh/My-Notes/releases/download/v9/x.exe")
        self.assertEqual(st["status"], "error")

    def test_foreign_redirect_rejected(self):
        _, st = self.run_check(final_host="evil.example.com")
        self.assertEqual(st["status"], "error")

    def test_cached_installer_reused(self):
        self.run_check()
        calls = []
        base = fake_github()

        def counting(req, timeout=0):
            calls.append(getattr(req, "full_url", req))
            return base(req, timeout)

        u = upd.Updater("1.3.0", REPO)
        with mock.patch("urllib.request.urlopen", counting):
            u.check()
            st = wait(u)
        self.assertEqual(st["status"], "ready")
        self.assertEqual(len([c for c in calls if "releases/download" in c]), 0)

    def test_install_requires_ready(self):
        u = upd.Updater("1.3.0", REPO)
        self.assertFalse(u.install()["ok"])

    def test_network_error(self):
        u = upd.Updater("1.3.0", REPO)
        with mock.patch("urllib.request.urlopen", side_effect=OSError("offline")):
            st = u.check()
        self.assertEqual(st["status"], "error")


if __name__ == "__main__":
    unittest.main()
