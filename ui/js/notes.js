const Notes = (() => {
    let activeId = null;

    // Any of these DB values means "untitled" — show the localized placeholder instead
    const DEFAULT_TITLES = ['ملاحظة جديدة', 'New Note', 'Новая заметка', ''];

    function getDisplayTitle(title) {
        return DEFAULT_TITLES.includes(title) ? I18n.t('new_note_title') : title;
    }

    // Returns the date-section label for a given ISO timestamp
    function getDateSection(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr.replace(' ', 'T') + 'Z');
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const noteDay   = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
        const diffDays  = Math.round((todayStart - noteDay) / 86400000);

        if (diffDays === 0) return I18n.t('today');
        if (diffDays === 1) return I18n.t('yesterday');

        const locale = I18n.current === 'ar' ? 'ar-SA'
                     : I18n.current === 'ru' ? 'ru-RU'
                     : 'en-US';

        if (diffDays < 7) {
            return d.toLocaleDateString(locale, { weekday: 'long' });
        }
        // Older than a week: show weekday + full date
        return d.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Short timestamp shown inside the card (time context already given by section header)
    function formatCardTime(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr.replace(' ', 'T') + 'Z');
        const diff = Date.now() - d;
        if (diff < 60000)    return I18n.t('time_now');
        if (diff < 3600000)  return I18n.t('time_min',  { n: Math.floor(diff / 60000) });
        if (diff < 86400000) return I18n.t('time_hour', { n: Math.floor(diff / 3600000) });
        const locale = I18n.current === 'ar' ? 'ar-SA'
                     : I18n.current === 'ru' ? 'ru-RU'
                     : 'en-US';
        return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }

    function renderCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card' + (note.id === activeId ? ' active' : '');
        card.dataset.id = note.id;

        const preview = (note.content_plain || '').slice(0, 80).trim().replace(/\n/g, ' ');
        const title   = getDisplayTitle(note.title);

        card.innerHTML = `
            <div class="note-card-title">${esc(title)}</div>
            <div class="note-card-preview">${
                preview
                    ? esc(preview)
                    : `<span class="note-card-empty">${esc(I18n.t('no_content'))}</span>`
            }</div>
            <div class="note-card-meta">
                <span class="note-card-date">${formatCardTime(note.updated_at)}</span>
                <div class="note-card-actions">
                    <button class="btn-icon danger btn-trash" title="Delete">
                        <svg viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5.5 1a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5ZM3 3h10v1H3V3Zm1 1.5v8A1.5 1.5 0 0 0 5.5 14h5A1.5 1.5 0 0 0 12 12.5v-8H4Zm2 1.5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6Zm3 0a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6Z"/>
                        </svg>
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
            if (activeId === note.id) { activeId = null; showNoNoteSelected(); }
            await refreshList();
            await Trash.refreshBadge();
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
        const list   = document.getElementById('notes-list');
        const header = document.getElementById('notes-panel-header');
        let notes;

        if (searchQuery && searchQuery.trim()) {
            notes = await window.pywebview.api.search_notes(searchQuery.trim());
            if (header) {
                header.textContent = I18n.t('search_results', { n: notes.length });
                header.dataset.count = notes.length;
            }
        } else {
            notes = await window.pywebview.api.get_all_notes();
            if (header) {
                header.textContent = I18n.t('notes_count', { n: notes.length });
                header.dataset.count = notes.length;
            }
        }

        list.innerHTML = '';

        if (!notes.length) {
            list.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
                </svg>
                <p>${esc(I18n.t(searchQuery ? 'no_results_msg' : 'no_notes_msg'))}</p>
            </div>`;
            return;
        }

        // Render notes grouped under date-section labels
        let currentSection = null;
        notes.forEach(note => {
            const section = getDateSection(note.updated_at);
            if (section !== currentSection) {
                currentSection = section;
                const labelEl = document.createElement('div');
                labelEl.className = 'notes-section-label';
                labelEl.textContent = section;
                list.appendChild(labelEl);
            }
            list.appendChild(renderCard(note));
        });
    }

    function showEditorView() {
        document.getElementById('no-note-selected').style.display = 'none';
        document.getElementById('editor-content').style.display   = 'flex';
        document.getElementById('trash-panel').style.display      = 'none';
    }

    function showNoNoteSelected() {
        Editor.clear();
        document.getElementById('no-note-selected').style.display = 'flex';
        document.getElementById('editor-content').style.display   = 'none';
        document.getElementById('trash-panel').style.display      = 'none';
    }

    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return { refreshList, openNote, showEditorView, showNoNoteSelected };
})();
