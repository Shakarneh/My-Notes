window.addEventListener('pywebviewready', async () => {
    // 1. Apply theme
    await Theme.init();

    // 2. Load notes list
    await Notes.refreshList();

    // 3. Load trash badge
    await Trash.refreshBadge();

    // 4. Init editor
    Editor.init();

    // 5. New note button
    document.getElementById('btn-new-note').addEventListener('click', async () => {
        Editor.flushAndClear();
        const id = await window.pywebview.api.create_note();
        await Notes.refreshList();
        await Notes.openNote(id);
    });

    // 6. Search
    const searchBox = document.getElementById('search-box');
    let searchTimer = null;
    searchBox.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            Notes.refreshList(searchBox.value);
        }, 300);
    });

    // 7. Nav: All Notes
    document.getElementById('nav-all-notes').addEventListener('click', () => {
        setActiveNav('nav-all-notes');
        Notes.showNoNoteSelected();
        Notes.refreshList(searchBox.value);
        document.getElementById('notes-panel').style.display = 'flex';
    });

    // 8. Nav: Trash
    document.getElementById('nav-trash').addEventListener('click', () => {
        setActiveNav('nav-trash');
        document.getElementById('notes-panel').style.display = 'none';
        Trash.show();
    });

    // 9. Empty trash
    document.getElementById('btn-empty-trash').addEventListener('click', async () => {
        if (confirm('هل أنت متأكد؟ سيتم حذف جميع الملاحظات في السلة نهائياً.')) {
            await window.pywebview.api.empty_trash();
            await Trash.refresh();
            await Trash.refreshBadge();
        }
    });

    // 10. Keyboard shortcuts
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
