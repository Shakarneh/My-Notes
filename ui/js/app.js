const App = (() => {
    const $ = id => document.getElementById(id);

    function setActiveNav(id) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (id) $(id)?.classList.add('active');
    }

    function showNotesView() {
        setActiveNav('nav-all-notes');
        $('notes-panel').style.display = 'flex';
        $('btn-trash-icon')?.classList.remove('active');
    }

    async function showTrashView() {
        await Editor.flushSave();
        Editor.clear();
        Notes.setActive(null);
        setActiveNav(null);
        $('notes-panel').style.display = 'none';
        $('btn-trash-icon')?.classList.add('active');
        await Trash.show();
        Editor.updateStats();
    }

    function newNote(block = null) {
        if (document.body.classList.contains('focus-mode')) setFocusMode(false);
        showNotesView();
        Notes.setActive(null);
        Editor.openBlankNote({ block });
    }

    function setFocusMode(on) {
        document.body.classList.toggle('focus-mode', on);
        $('btn-focus')?.classList.toggle('ql-active', on);
        window.pywebview.api.update_setting('focus_mode', on ? '1' : '0');
    }

    async function runBackup() {
        const res = await window.pywebview.api.backup_notes();
        if (res?.ok) UI.toast(I18n.t('backup_done', { n: res.count }), { kind: 'success' });
        else if (res && !res.cancelled) UI.toast(I18n.t('error_generic', { e: res.error || '' }), { kind: 'error' });
    }

    async function runRestore() {
        const res = await window.pywebview.api.restore_backup();
        if (res?.ok) {
            UI.toast(I18n.t('restore_done', { n: res.count }), { kind: 'success' });
            await Notes.refreshList();
        } else if (res?.error === 'invalid_backup') {
            UI.toast(I18n.t('restore_invalid'), { kind: 'error' });
        } else if (res && !res.cancelled) {
            UI.toast(I18n.t('error_generic', { e: res.error || '' }), { kind: 'error' });
        }
    }

    async function checkForUpdate() {
        const updateDot = $('update-dot');
        const info = await window.pywebview.api.check_for_update();
        if (!info || !info.ok || !info.has_update || !updateDot) return;

        const label = () => `↑ v${info.latest} ${I18n.t('update_available')}`;
        updateDot.textContent = label();
        updateDot.style.display = 'block';
        document.addEventListener('languagechange', () => {
            if (!updateDot.disabled) updateDot.textContent = label();
        });

        updateDot.addEventListener('click', async () => {
            if (!confirm(I18n.t('confirm_update', { v: info.latest }))) return;
            await Editor.flushSave();
            updateDot.textContent = I18n.t('updating');
            updateDot.disabled = true;
            const result = await window.pywebview.api.download_and_install_update(info.download_url);
            if (!result || !result.ok) {
                UI.toast(I18n.t('update_failed', { e: (result && result.error) || 'unknown' }), { kind: 'error' });
                updateDot.textContent = label();
                updateDot.disabled = false;
            }
            // On success the app shuts down and the installer takes over.
        });
    }

    async function start() {
        const settings = await window.pywebview.api.get_settings();

        await I18n.init(settings);
        await Theme.init(settings);
        Trash.init(settings);
        Editor.init();
        Home.init();
        await Notes.refreshList();
        Home.render();
        await Trash.refreshBadge();
        if (settings.focus_mode) {
            document.body.classList.add('focus-mode');
            $('btn-focus')?.classList.add('ql-active');
        }

        // ── Header / nav ──
        $('btn-new-note').addEventListener('click', () => newNote());
        $('btn-trash-icon')?.addEventListener('click', showTrashView);
        $('nav-all-notes').addEventListener('click', async () => {
            if (!Trash.isVisible()) return;
            showNotesView();
            Notes.showNoNoteSelected();
        });
        $('btn-empty-trash').addEventListener('click', Trash.emptyAll);

        // ── Footer tools ──
        $('btn-backup')?.addEventListener('click', runBackup);
        $('btn-restore-backup')?.addEventListener('click', runRestore);
        $('btn-focus')?.addEventListener('click', () => setFocusMode(!document.body.classList.contains('focus-mode')));

        // ── Search ──
        const searchBox = $('search-box');
        const searchClear = $('search-clear');
        let searchTimer = null;
        const applySearch = () => {
            searchClear.style.display = searchBox.value ? 'flex' : 'none';
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                if (Trash.isVisible() && searchBox.value) {
                    showNotesView();
                    Notes.showNoNoteSelected();
                }
                Notes.setQuery(searchBox.value);
            }, 200);
        };
        searchBox.addEventListener('input', applySearch);
        searchBox.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                searchBox.value = '';
                applySearch();
                searchBox.blur();
            } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                document.querySelector('.note-card')?.focus();
            }
        });
        searchClear.addEventListener('click', () => {
            searchBox.value = '';
            applySearch();
            searchBox.focus();
        });

        // Arrow-key navigation inside the notes list
        $('notes-list').addEventListener('keydown', e => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            const cards = [...document.querySelectorAll('.note-card')];
            const i = cards.indexOf(document.activeElement);
            if (i < 0) return;
            e.preventDefault();
            const next = cards[i + (e.key === 'ArrowDown' ? 1 : -1)];
            if (next) next.focus();
            else if (e.key === 'ArrowUp') searchBox.focus();
        });

        // ── Language change: re-render everything that contains text ──
        document.addEventListener('languagechange', async () => {
            Theme.paint();
            Editor.updateStats();
            await Notes.refreshList();
            if (Trash.isVisible()) await Trash.refresh();
        });

        // ── Version ──
        const version = await window.pywebview.api.get_version();
        $('app-version').textContent = `v${version}`;
        $('status-version').textContent = `My Note v${version}`;

        // ── Keyboard shortcuts (use e.code so they work on Arabic/Russian layouts) ──
        document.addEventListener('keydown', e => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && !e.shiftKey && e.code === 'KeyN') {
                e.preventDefault();
                newNote();
            } else if (mod && e.code === 'KeyF') {
                e.preventDefault();
                if (document.body.classList.contains('focus-mode')) setFocusMode(false);
                searchBox.focus();
                searchBox.select();
            } else if (mod && e.code === 'KeyS') {
                e.preventDefault();
                Editor.flushSave();
            } else if (mod && e.code === 'KeyH') {
                if (Editor.isVisible()) {
                    e.preventDefault();
                    Find.open(true);
                }
            } else if (mod && e.code === 'Backslash') {
                e.preventDefault();
                setFocusMode(!document.body.classList.contains('focus-mode'));
            } else if (e.key === 'Escape' && document.body.classList.contains('focus-mode')
                       && !document.getElementById('spell-context-menu') && !Blocks.isOpen()
                       && !Find.isOpen() && !document.getElementById('drawing-overlay')) {
                setFocusMode(false);
            }
        });

        // Relative times ("5m ago") stay fresh
        setInterval(() => {
            if (!document.querySelector('.note-card:focus')) Notes.refreshList();
        }, 60 * 1000);

        checkForUpdate().catch(() => {});
    }

    return { start, showNotesView, showTrashView, newNote };
})();

window.addEventListener('pywebviewready', () => {
    App.start().catch(err => {
        console.error(err);
        UI.toast(I18n.t('error_generic', { e: err.message || err }), { kind: 'error', duration: 8000 });
    });
});
