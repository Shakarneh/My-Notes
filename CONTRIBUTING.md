# Contributing to My Notes

Thanks for your interest! Bug reports, ideas, translations and code are all welcome.
شكراً لاهتمامك! نرحّب بالإبلاغ عن المشاكل والاقتراحات والترجمات والكود.

## Report a bug or suggest a feature

Open an issue: <https://github.com/Shakarneh/My-Notes/issues/new/choose>

## Run the app from source (Windows)

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python main.py
```

- Backend: Python + [pywebview](https://pywebview.flowrl.com/) in `app/`
- Frontend: plain HTML/CSS/JS in `ui/` (the editor is [Quill 2](https://quilljs.com/), bundled in `ui/vendor/`)
- Notes live in `%APPDATA%\NotesApp\notes.db` (SQLite)

## Tests

```powershell
python -m unittest discover tests
```

GitHub Actions runs the tests and builds the Windows installer on every push — download it from the run's **Artifacts** to try your change.

## Translations

Each language lives in `ui/js/i18n.js` (Arabic, English, Russian) or `ui/js/lang/<code>.js` (German, Chinese, Spanish, Italian). Feature modules (`blocks.js`, `find.js`, `updater.js`, `settings.js`, `whatsnew.js`) add their own strings with `I18n.extend`. To add a language, copy `ui/js/lang/de.js`, translate every value (keep `{placeholders}` exactly), add a `<script>` tag in `ui/index.html`, and add the code to `LANGUAGES` in `app/api.py` and `ui/js/settings.js`.

## Pull requests

- Keep changes focused; describe what and why.
- Make sure the tests pass.
- Arabic / RTL matters: please check your change in Arabic too.
