const Trash = (() => {
    let trashDays = 90;

    function init(settings) {
        if (settings?.trash_days) trashDays = settings.trash_days;
    }

    async function show() {
        document.getElementById('no-note-selected').style.display = 'none';
        document.getElementById('editor-content').style.display   = 'none';
        document.getElementById('trash-panel').style.display      = 'flex';
        await refresh();
    }

    function isVisible() {
        return document.getElementById('trash-panel')?.style.display === 'flex';
    }

    async function refresh() {
        const items = await window.pywebview.api.get_trash();
        const list  = document.getElementById('trash-list');
        const subtitle = document.getElementById('trash-subtitle');
        const emptyBtn = document.getElementById('btn-empty-trash');
        if (subtitle) subtitle.textContent = I18n.t('trash_subtitle', { n: trashDays });
        if (emptyBtn) emptyBtn.disabled = !items.length;
        list.innerHTML = '';

        if (!items.length) {
            list.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                <p>${UI.esc(I18n.t('trash_empty_msg'))}</p>
            </div>`;
            return;
        }

        items.forEach(item => {
            const remaining = Math.max(0, trashDays - (item.days_in_trash || 0));
            const title = Notes.getDisplayTitle(item.title);
            const preview = (item.content_plain || '').replace(/\s+/g, ' ').trim().slice(0, 140);
            const card = document.createElement('div');
            card.className = 'trash-card';
            card.innerHTML = `
                <div class="trash-card-info">
                    <div class="trash-card-title" dir="auto">${UI.esc(title)}</div>
                    ${preview ? `<div class="trash-card-preview" dir="auto">${UI.esc(preview)}</div>` : ''}
                    <div class="trash-card-meta">
                        <span>${UI.esc(I18n.t('deleted_on'))} ${UI.esc(formatDate(item.deleted_at))}</span>
                        <span class="trash-card-days${remaining <= 7 ? ' urgent' : ''}">${UI.esc(I18n.t('days_until_delete', { n: remaining }))}</span>
                    </div>
                </div>
                <div class="trash-card-actions">
                    <button class="btn-restore">${UI.esc(I18n.t('restore_btn'))}</button>
                    <button class="btn-delete-perm">${UI.esc(I18n.t('delete_perm_btn'))}</button>
                </div>`;

            card.querySelector('.btn-restore').addEventListener('click', async () => {
                await window.pywebview.api.restore_note(item.id);
                UI.toast(I18n.t('note_restored'), { kind: 'success' });
                await Notes.refreshList();
                await refresh();
                await refreshBadge();
            });

            card.querySelector('.btn-delete-perm').addEventListener('click', async () => {
                if (!confirm(I18n.t('confirm_delete_forever', { t: title }))) return;
                await window.pywebview.api.delete_permanently(item.id);
                await refresh();
                await refreshBadge();
            });

            list.appendChild(card);
        });
    }

    async function emptyAll() {
        if (!confirm(I18n.t('confirm_empty_trash'))) return;
        await window.pywebview.api.empty_trash();
        await refresh();
        await refreshBadge();
    }

    async function refreshBadge() {
        const count = await window.pywebview.api.count_trash();
        const badge = document.getElementById('trash-badge');
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count ? 'flex' : 'none';
        }
    }

    function formatDate(iso) {
        const d = UI.parseDbDate(iso);
        return d ? d.toLocaleDateString(UI.locale(), { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    }

    return { init, show, refresh, refreshBadge, emptyAll, isVisible };
})();
