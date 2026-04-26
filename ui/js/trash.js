const Trash = (() => {
    async function show() {
        document.getElementById('no-note-selected').style.display = 'none';
        document.getElementById('editor-content').style.display   = 'none';
        document.getElementById('trash-panel').style.display      = 'flex';
        await refresh();
    }

    async function refresh() {
        const items = await window.pywebview.api.get_trash();
        const list  = document.getElementById('trash-list');
        list.innerHTML = '';

        if (!items.length) {
            list.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                <p>${I18n.t('trash_empty_msg')}</p>
            </div>`;
            return;
        }

        items.forEach(item => {
            const remaining = 90 - (item.days_in_trash || 0);
            const card = document.createElement('div');
            card.className = 'trash-card';
            card.innerHTML = `
                <div class="trash-card-info">
                    <div class="trash-card-title">${esc(item.title || '—')}</div>
                    <div class="trash-card-date">${I18n.t('deleted_on')} ${formatDate(item.deleted_at)}</div>
                    <div class="trash-card-days">${I18n.t('days_until_delete', { n: remaining })}</div>
                </div>
                <div class="trash-card-actions">
                    <button class="btn-restore"      data-id="${item.id}">${I18n.t('restore_btn')}</button>
                    <button class="btn-delete-perm"  data-id="${item.id}">${I18n.t('delete_perm_btn')}</button>
                </div>`;

            card.querySelector('.btn-restore').addEventListener('click', async () => {
                await window.pywebview.api.restore_note(item.id);
                await Notes.refreshList();
                await refresh();
                await refreshBadge();
            });

            card.querySelector('.btn-delete-perm').addEventListener('click', async () => {
                await window.pywebview.api.delete_permanently(item.id);
                await refresh();
                await refreshBadge();
            });

            list.appendChild(card);
        });
    }

    async function refreshBadge() {
        const items = await window.pywebview.api.get_trash();
        const badge = document.getElementById('trash-badge');
        if (badge) {
            badge.textContent = items.length;
            badge.style.display = items.length ? 'flex' : 'none';
        }
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso.replace(' ', 'T') + 'Z');
        const locale = I18n.current === 'ar' ? 'ar' : 'en';
        return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    return { show, refresh, refreshBadge };
})();
