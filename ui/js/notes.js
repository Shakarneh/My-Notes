const Notes = (() => {
    let activeId = null;

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso.replace(' ', 'T') + 'Z');
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'الآن';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} د`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} س`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} ي`;
        return d.toLocaleDateString('ar', { month: 'short', day: 'numeric' });
    }

    function renderCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card' + (note.id === activeId ? ' active' : '');
        card.dataset.id = note.id;
        const preview = (note.content_plain || '').slice(0, 60).trim().replace(/\n/g, ' ');
        card.innerHTML = `
            <div class="note-card-title">${escHtml(note.title || 'ملاحظة جديدة')}</div>
            <div class="note-card-preview">${escHtml(preview) || '<span style="color:var(--text-tertiary)">لا يوجد محتوى</span>'}</div>
            <div class="note-card-meta">
                <span class="note-card-date">${formatDate(note.updated_at)}</span>
                <div class="note-card-actions">
                    <button class="btn-icon danger btn-trash" title="حذف">
                        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5ZM3 3h10v1H3V3Zm1 1.5v8A1.5 1.5 0 0 0 5.5 14h5A1.5 1.5 0 0 0 12 12.5v-8H4Zm2 1.5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6Zm3 0a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6Z"/></svg>
                    </button>
                </div>
            </div>`;

        card.addEventListener('click', e => {
            if (e.target.closest('.btn-trash')) return;
            openNote(note.id);
        });

        card.querySelector('.btn-trash').addEventListener('click', async e => {
            e.stopPropagation();
            Editor.flushAndClear();
            await window.pywebview.api.move_to_trash(note.id);
            if (activeId === note.id) {
                activeId = null;
                showNoNoteSelected();
            }
            await refreshList();
            Trash.refreshBadge();
        });

        return card;
    }

    async function openNote(id) {
        Editor.flushAndClear();
        const note = await window.pywebview.api.get_note(id);
        if (!note) return;
        activeId = id;
        Editor.loadNote(id, note);
        showEditorView();
        document.querySelectorAll('.note-card').forEach(c => {
            c.classList.toggle('active', parseInt(c.dataset.id) === id);
        });
    }

    async function refreshList(searchQuery = null) {
        const list = document.getElementById('notes-list');
        const header = document.getElementById('notes-panel-header');
        let notes;
        if (searchQuery && searchQuery.trim()) {
            notes = await window.pywebview.api.search_notes(searchQuery.trim());
            if (header) header.textContent = `نتائج البحث (${notes.length})`;
        } else {
            notes = await window.pywebview.api.get_all_notes();
            if (header) header.textContent = `الملاحظات (${notes.length})`;
        }
        list.innerHTML = '';
        if (!notes.length) {
            list.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
                </svg>
                <p>${searchQuery ? 'لا توجد نتائج' : 'لا توجد ملاحظات بعد\nاضغط + لإنشاء ملاحظة'}</p>
            </div>`;
        } else {
            notes.forEach(n => list.appendChild(renderCard(n)));
        }
    }

    function showEditorView() {
        document.getElementById('no-note-selected').style.display = 'none';
        document.getElementById('editor-content').style.display = 'flex';
        document.getElementById('trash-panel').style.display = 'none';
    }

    function showNoNoteSelected() {
        Editor.clear();
        document.getElementById('no-note-selected').style.display = 'flex';
        document.getElementById('editor-content').style.display = 'none';
        document.getElementById('trash-panel').style.display = 'none';
    }

    function escHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { refreshList, openNote, showEditorView, showNoNoteSelected };
})();
