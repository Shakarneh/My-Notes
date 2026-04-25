window.addEventListener('pywebviewready', async () => {
    // 1. Apply theme
    await Theme.init();

    // 2. Apply language (must be before refreshList to get translated strings)
    await I18n.init();

    // 3. Load notes list
    await Notes.refreshList();

    // 4. Load trash badge
    await Trash.refreshBadge();

    // 5. Init editor
    Editor.init();

    // 6. New note button
    document.getElementById('btn-new-note').addEventListener('click', async () => {
        Editor.flushAndClear();
        const id = await window.pywebview.api.create_note();
        await Notes.refreshList();
        await Notes.openNote(id);
    });

    // 7. Search
    const searchBox = document.getElementById('search-box');
    let searchTimer = null;
    searchBox.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => Notes.refreshList(searchBox.value), 300);
    });

    // 8. Nav: All Notes
    document.getElementById('nav-all-notes').addEventListener('click', () => {
        setActiveNav('nav-all-notes');
        document.getElementById('notes-panel').style.display = 'flex';
        Notes.showNoNoteSelected();
        Notes.refreshList(searchBox.value);
    });

    // 9. Nav: Trash
    document.getElementById('nav-trash').addEventListener('click', () => {
        setActiveNav('nav-trash');
        document.getElementById('notes-panel').style.display = 'none';
        Trash.show();
    });

    // 10. Empty trash
    document.getElementById('btn-empty-trash').addEventListener('click', async () => {
        if (confirm(I18n.t('confirm_empty_trash'))) {
            await window.pywebview.api.empty_trash();
            await Trash.refresh();
            await Trash.refreshBadge();
        }
    });

    // 11. Keyboard shortcuts
    document.addEventListener('keydown', async e => {
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            Editor.flushAndClear();
            const id = await window.pywebview.api.create_note();
            await Notes.refreshList();
            await Notes.openNote(id);
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
    document.getElementById(id)?.classList.add('active');
}
