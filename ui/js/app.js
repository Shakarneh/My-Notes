window.addEventListener('pywebviewready', async () => {
    // 1. Apply theme
    await Theme.init();

    // 2. Apply language (must run before refreshList so translated strings are ready)
    await I18n.init();

    // 3. Load notes list
    await Notes.refreshList();

    // 4. Load trash badge on the header icon
    await Trash.refreshBadge();

    // 5. Init editor
    Editor.init();

    // 6. New note button — open blank editor immediately; note is created in DB on first keystroke
    document.getElementById('btn-new-note').addEventListener('click', () => {
        Editor.openBlankNote();
        setActiveNav('nav-all-notes');
        document.getElementById('notes-panel').style.display = 'flex';
        document.getElementById('btn-trash-icon')?.classList.remove('active');
    });

    // 7. Trash icon button in header
    document.getElementById('btn-trash-icon')?.addEventListener('click', () => {
        setActiveNav(null);
        document.getElementById('notes-panel').style.display = 'none';
        document.getElementById('btn-trash-icon')?.classList.add('active');
        Trash.show();
    });

    // 8. Search with debounce
    const searchBox = document.getElementById('search-box');
    let searchTimer = null;
    searchBox.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => Notes.refreshList(searchBox.value), 300);
    });

    // 9. Nav: All Notes
    document.getElementById('nav-all-notes').addEventListener('click', () => {
        setActiveNav('nav-all-notes');
        document.getElementById('notes-panel').style.display = 'flex';
        document.getElementById('btn-trash-icon')?.classList.remove('active');
        Notes.showNoNoteSelected();
        Notes.refreshList(searchBox.value);
    });

    // 10. Empty trash
    document.getElementById('btn-empty-trash').addEventListener('click', async () => {
        if (confirm(I18n.t('confirm_empty_trash'))) {
            await window.pywebview.api.empty_trash();
            await Trash.refresh();
            await Trash.refreshBadge();
        }
    });

    // 11. Update banner (compares hardcoded latest vs current; replace with API call in production)
    const currentVersion = '1.0';
    const latestVersion  = '1.1';
    const dismissedKey   = 'update-dismissed';
    const updateBanner   = document.getElementById('update-banner');

    if (latestVersion > currentVersion && localStorage.getItem(dismissedKey) !== latestVersion) {
        const label = document.getElementById('update-version-label');
        if (label) label.textContent = `v${latestVersion} ${I18n.t('update_available')}`;
        if (updateBanner) updateBanner.style.display = 'flex';
    }

    document.getElementById('btn-dismiss-update')?.addEventListener('click', () => {
        if (updateBanner) updateBanner.style.display = 'none';
        localStorage.setItem(dismissedKey, latestVersion);
    });

    document.getElementById('btn-download-update')?.addEventListener('click', () => {
        window.pywebview.api.open_url('https://github.com/your-username/notes-app/releases/latest');
    });

    // 12. Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            Editor.openBlankNote();
            setActiveNav('nav-all-notes');
            document.getElementById('notes-panel').style.display = 'flex';
            document.getElementById('btn-trash-icon')?.classList.remove('active');
        }
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchBox.focus();
            searchBox.select();
        }
    });
});

function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (id) document.getElementById(id)?.classList.add('active');
}
