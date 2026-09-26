const Notes = (() => {
    let activeId = null;
    let query = '';
    let refreshTimer = null;

    // Any of these DB values means "untitled" — show the localized placeholder instead
    const DEFAULT_TITLES = ['ملاحظة جديدة', 'New Note', 'Новая заметка', ''];

    const ICONS = {
        pin: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z"/></svg>',
        copy: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/></svg>',
        trash: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5ZM3 3h10v1H3V3Zm1 1.5v8A1.5 1.5 0 0 0 5.5 14h5A1.5 1.5 0 0 0 12 12.5v-8H4Zm2 1.5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6Zm3 0a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6Z"/></svg>',
    };

    function isDefaultTitle(title) {
        return DEFAULT_TITLES.includes((title || '').trim());
    }

    function getDisplayTitle(title) {
        return isDefaultTitle(title) ? I18n.t('new_note_title') : title;
    }

    // Date-section label for a timestamp
    function getDateSection(isoStr) {
        const d = UI.parseDbDate(isoStr);
        if (!d) return '';
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const noteDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays   = Math.round((todayStart - noteDay) / 86400000);

        if (diffDays <= 0) return I18n.t('today');
        if (diffDays === 1) return I18n.t('yesterday');
        if (diffDays < 7) return d.toLocaleDateString(UI.locale(), { weekday: 'long' });
        const sameYear = d.getFullYear() === now.getFullYear();
        return d.toLocaleDateString(UI.locale(), sameYear
            ? { month: 'long', year: undefined }
            : { month: 'long', year: 'numeric' });
    }

    // Short timestamp shown on the card
    function formatCardTime(isoStr) {
        const d = UI.parseDbDate(isoStr);
        if (!d) return '';
        const diff = Date.now() - d;
        if (diff < 60000)    return I18n.t('time_now');
        if (diff < 3600000)  return I18n.t('time_min',  { n: Math.floor(diff / 60000) });
        if (diff < 6 * 3600000) return I18n.t('time_hour', { n: Math.floor(diff / 3600000) });
        const today = new Date();
        const sameDay = d.toDateString() === today.toDateString();
        return sameDay || diff < 7 * 86400000
            ? d.toLocaleTimeString(UI.locale(), { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString(UI.locale(), { day: 'numeric', month: 'short' });
    }

    // Escape text and wrap case-insensitive matches of the search query in <mark>
    function highlight(text) {
        const safe = UI.esc(text);
        const q = query.trim();
        if (!q) return safe;
        const pattern = UI.esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return safe.replace(new RegExp(pattern, 'giu'), m => `<mark>${m}</mark>`);
    }

    function previewText(note) {
        const plain = (note.content_plain || '').replace(/\s+/g, ' ').trim();
        const q = query.trim().toLowerCase();
        if (q) {
            // Centre the preview on the first match so the hit is visible
            const i = plain.toLowerCase().indexOf(q);
            if (i > 40) return '…' + plain.slice(i - 30, i + 90);
        }
        return plain.slice(0, 120);
    }

    function renderCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card' + (note.id === activeId ? ' active' : '') + (note.is_pinned ? ' pinned' : '');
        card.dataset.id = note.id;
        card.tabIndex = 0;

        const preview = previewText(note);
        const title   = getDisplayTitle(note.title);

        card.innerHTML = `
            <div class="note-card-title">${note.is_pinned ? `<span class="pin-mark">${ICONS.pin}</span>` : ''}<span dir="auto">${highlight(title)}</span></div>
            <div class="note-card-preview" dir="auto">${
                preview
                    ? highlight(preview)
                    : `<span class="note-card-empty">${UI.esc(I18n.t('no_content'))}</span>`
            }</div>
            <div class="note-card-meta">
                <span class="note-card-date">${UI.esc(formatCardTime(note.updated_at))}</span>
                <div class="note-card-actions">
                    <button class="btn-icon btn-pin${note.is_pinned ? ' on' : ''}" title="${UI.esc(I18n.t(note.is_pinned ? 'unpin' : 'pin'))}">${ICONS.pin}</button>
                    <button class="btn-icon btn-dup" title="${UI.esc(I18n.t('duplicate'))}">${ICONS.copy}</button>
                    <button class="btn-icon danger btn-trash" title="${UI.esc(I18n.t('delete_note'))}">${ICONS.trash}</button>
                </div>
            </div>`;

        card.addEventListener('click', e => {
            if (e.target.closest('.note-card-actions')) return;
            openNote(note.id);
        });
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter') openNote(note.id);
            if (e.key === 'Delete') trashNote(note.id);
        });

        card.querySelector('.btn-pin').addEventListener('click', async e => {
            e.stopPropagation();
            const pinned = await window.pywebview.api.set_pinned(note.id, !note.is_pinned);
            Editor.setPinnedExternally(note.id, pinned);
            UI.toast(I18n.t(pinned ? 'note_pinned' : 'note_unpinned'));
            await refreshList();
        });
        card.querySelector('.btn-dup').addEventListener('click', async e => {
            e.stopPropagation();
            if (note.id === Editor.getCurrentId()) await Editor.flushSave();
            const newId = await window.pywebview.api.duplicate_note(note.id, I18n.t('copy_suffix'));
            if (newId) {
                UI.toast(I18n.t('duplicated'), { kind: 'success' });
                await openNote(newId);
            }
        });
        card.querySelector('.btn-trash').addEventListener('click', e => {
            e.stopPropagation();
            trashNote(note.id);
        });

        return card;
    }

    async function trashNote(id) {
        if (id === Editor.getCurrentId()) await Editor.flushSave();
        await window.pywebview.api.move_to_trash(id);
        if (id === activeId || id === Editor.getCurrentId()) {
            activeId = null;
            showNoNoteSelected();
        }
        await refreshList();
        await Trash.refreshBadge();
        UI.toast(I18n.t('note_deleted'), {
            action: I18n.t('undo'),
            onAction: async () => {
                await window.pywebview.api.restore_note(id);
                await Trash.refreshBadge();
                await openNote(id);
                UI.toast(I18n.t('note_restored'));
            },
        });
    }

    async function openNote(id) {
        await Editor.flushSave();
        const note = await window.pywebview.api.get_note(id);
        if (!note) return;
        App.showNotesView();
        activeId = id;
        Editor.loadNote(id, note);
        markActive();
        // New notes (e.g. duplicates) may not be in the list yet
        if (!document.querySelector(`.note-card[data-id="${id}"]`)) await refreshList();
        document.querySelector(`.note-card[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    }

    function markActive() {
        document.querySelectorAll('.note-card').forEach(c => {
            c.classList.toggle('active', Number(c.dataset.id) === activeId);
        });
    }

    function setActive(id) {
        activeId = id;
        markActive();
    }

    function setQuery(q) {
        query = q || '';
        return refreshList();
    }

    async function refreshList() {
        clearTimeout(refreshTimer);
        const list   = document.getElementById('notes-list');
        const header = document.getElementById('notes-panel-header');
        const q = query.trim();

        const notes = q
            ? await window.pywebview.api.search_notes(q)
            : await window.pywebview.api.get_all_notes();

        if (header) {
            header.textContent = q
                ? I18n.t('search_results', { n: notes.length })
                : I18n.t('notes_count', { n: notes.length });
        }

        const scrollTop = list.scrollTop;
        list.innerHTML = '';

        if (!notes.length) {
            list.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    ${q
                        ? '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'
                        : '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>'}
                </svg>
                <p>${UI.esc(I18n.t(q ? 'no_results_msg' : 'no_notes_msg'))}</p>
            </div>`;
            return;
        }

        const frag = document.createDocumentFragment();
        let currentSection = null;
        notes.forEach(note => {
            const section = note.is_pinned ? I18n.t('pinned') : getDateSection(note.updated_at);
            if (section !== currentSection) {
                currentSection = section;
                const labelEl = document.createElement('div');
                labelEl.className = 'notes-section-label' + (note.is_pinned ? ' pinned-label' : '');
                labelEl.textContent = section;
                frag.appendChild(labelEl);
            }
            frag.appendChild(renderCard(note));
        });
        list.appendChild(frag);
        list.scrollTop = scrollTop;
    }

    // Called by the editor after each save. Debounced so typing doesn't thrash the list.
    function onNoteSaved(id, isNew) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshList, isNew ? 0 : 400);
    }

    function showNoNoteSelected() {
        Editor.clear();
        activeId = null;
        markActive();
        document.getElementById('no-note-selected').style.display = 'flex';
        document.getElementById('editor-content').style.display   = 'none';
        document.getElementById('trash-panel').style.display      = 'none';
        Editor.updateStats();
        Home.render();
    }

    return {
        refreshList, openNote, trashNote, setActive, setQuery, onNoteSaved,
        showNoNoteSelected, isDefaultTitle, getDisplayTitle,
    };
})();
