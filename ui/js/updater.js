// In-app updates: background download, "Restart & update", required updates,
// and a one-time "Updated to vX" notice after an update.
const Updater = (() => {
    const CHECK_EVERY = 6 * 60 * 60 * 1000;   // long-running sessions still hear about new versions
    const $ = id => document.getElementById(id);

    let state = null;
    let pollTimer = null;
    let toastShownFor = null;
    let installing = false;

    I18n.extend({
        ar: {
            upd_downloading: 'جاري تنزيل الإصدار {v}… {p}%',
            upd_ready: 'الإصدار {v} جاهز',
            upd_restart: 'أعد التشغيل وحدّث',
            upd_whats_new: 'ما الجديد',
            upd_later: 'لاحقاً',
            upd_title: 'إصدار جديد {v}',
            upd_required_title: 'تحديث مطلوب',
            upd_required_msg: 'يلزم تثبيت الإصدار {v} لمتابعة استخدام التطبيق. ستبقى ملاحظاتك كما هي.',
            upd_installing: 'جاري تثبيت التحديث…',
            upd_updated: 'تم التحديث إلى الإصدار {v}',
            upd_failed: 'فشل التحديث: {e}',
            upd_ready_toast: 'تم تنزيل الإصدار {v}',
            upd_no_notes: 'تحسينات وإصلاحات.',
            upd_retry: 'إعادة المحاولة', upd_dl_failed: 'تعذّر تنزيل التحديث. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.',
        },
        en: {
            upd_downloading: 'Downloading v{v}… {p}%',
            upd_ready: 'Version {v} is ready',
            upd_restart: 'Restart & update',
            upd_whats_new: 'What’s new',
            upd_later: 'Later',
            upd_title: 'New version {v}',
            upd_required_title: 'Update required',
            upd_required_msg: 'Version {v} is required to keep using My Note. Your notes stay exactly as they are.',
            upd_installing: 'Installing update…',
            upd_updated: 'Updated to v{v}',
            upd_failed: 'Update failed: {e}',
            upd_ready_toast: 'Version {v} downloaded',
            upd_no_notes: 'Improvements and fixes.',
            upd_retry: 'Try again', upd_dl_failed: 'The update could not be downloaded. Check your internet connection and try again.',
        },
        ru: {
            upd_downloading: 'Загрузка v{v}… {p}%',
            upd_ready: 'Версия {v} готова',
            upd_restart: 'Перезапустить и обновить',
            upd_whats_new: 'Что нового',
            upd_later: 'Позже',
            upd_title: 'Новая версия {v}',
            upd_required_title: 'Требуется обновление',
            upd_required_msg: 'Для работы My Note нужна версия {v}. Ваши заметки останутся без изменений.',
            upd_installing: 'Установка обновления…',
            upd_updated: 'Обновлено до v{v}',
            upd_failed: 'Ошибка обновления: {e}',
            upd_ready_toast: 'Версия {v} загружена',
            upd_no_notes: 'Улучшения и исправления.',
            upd_retry: 'Повторить', upd_dl_failed: 'Не удалось загрузить обновление. Проверьте интернет и повторите попытку.',
        },
    });

    // Release notes are Markdown-ish text from GitHub: render safely as paragraphs and bullets
    function notesHtml(text) {
        const lines = (text || '').replace(/\r/g, '').split('\n');
        let html = '', inList = false;
        for (const raw of lines) {
            const line = raw.trim();
            const bullet = line.match(/^[-*•]\s+(.*)$/);
            if (bullet) {
                if (!inList) { html += '<ul>'; inList = true; }
                html += `<li>${inline(bullet[1])}</li>`;
                continue;
            }
            if (inList) { html += '</ul>'; inList = false; }
            if (!line) continue;
            const heading = line.match(/^#{1,6}\s+(.*)$/);
            html += heading ? `<h4>${inline(heading[1])}</h4>` : `<p>${inline(line)}</p>`;
        }
        if (inList) html += '</ul>';
        return html || `<p>${UI.esc(I18n.t('upd_no_notes'))}</p>`;
    }

    function inline(s) {
        return UI.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
    }

    // ─── Sidebar card ─────────────────────────────────────────────────────

    function renderCard() {
        const card = $('update-card');
        if (!card) return;
        if (!state || !['downloading', 'ready'].includes(state.status)) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';
        if (installing) {
            card.innerHTML = `<div class="upd-row"><span class="upd-spinner"></span><span>${UI.esc(I18n.t('upd_installing'))}</span></div>`;
            return;
        }
        if (state.status === 'downloading') {
            const pct = Math.round((state.progress || 0) * 100);
            card.innerHTML = `
                <div class="upd-row"><span class="upd-spinner"></span><span>${UI.esc(I18n.t('upd_downloading', { v: state.latest, p: pct }))}</span></div>
                <div class="upd-bar"><span style="width:${pct}%"></span></div>`;
        } else {
            card.innerHTML = `
                <div class="upd-row upd-ready"><span class="upd-dot"></span><b>${UI.esc(I18n.t('upd_ready', { v: state.latest }))}</b></div>
                <div class="upd-actions">
                    <button class="upd-primary" data-upd="install">${UI.esc(I18n.t('upd_restart'))}</button>
                    <button class="upd-link" data-upd="notes">${UI.esc(I18n.t('upd_whats_new'))}</button>
                </div>`;
        }
    }

    // ─── Modal (what's new / required) ────────────────────────────────────

    function openModal() {
        closeModal();
        if (!state) return;
        const required = !!state.required;
        const ready = state.status === 'ready';
        const failed = state.status === 'error';
        const pct = Math.round((state.progress || 0) * 100);
        const overlay = document.createElement('div');
        overlay.id = 'update-modal';
        overlay.className = required ? 'required' : '';
        overlay.innerHTML = `
            <div class="upd-dialog" role="dialog" aria-modal="true">
                <div class="upd-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>
                </div>
                <h2>${UI.esc(required ? I18n.t('upd_required_title') : I18n.t('upd_title', { v: state.latest }))}</h2>
                ${required ? `<p class="upd-required-msg">${UI.esc(I18n.t('upd_required_msg', { v: state.latest }))}</p>` : ''}
                <div class="upd-notes" dir="auto">${notesHtml(state.notes)}</div>
                ${failed ? `<p class="upd-error">${UI.esc(I18n.t('upd_dl_failed'))}</p>`
                  : ready ? '' : `<div class="upd-bar big"><span style="width:${pct}%"></span></div>
                    <p class="upd-progress-label">${UI.esc(I18n.t('upd_downloading', { v: state.latest, p: pct }))}</p>`}
                <div class="upd-dialog-actions">
                    ${required ? '' : `<button class="draw-btn" data-upd="later">${UI.esc(I18n.t('upd_later'))}</button>`}
                    ${failed
                        ? `<button class="primary-btn" data-upd="retry">${UI.esc(I18n.t('upd_retry'))}</button>`
                        : `<button class="primary-btn" data-upd="install" ${ready && !installing ? '' : 'disabled'}>
                            ${UI.esc(installing ? I18n.t('upd_installing') : I18n.t('upd_restart'))}
                          </button>`}
                </div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => {
            const act = e.target.closest('[data-upd]')?.dataset.upd;
            if (act === 'install') install();
            else if (act === 'retry') check(true);
            else if (act === 'later') closeModal();
            else if (e.target === overlay && !required) closeModal();
        });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !required) { e.stopPropagation(); closeModal(); }
        });
        overlay.tabIndex = -1;
        overlay.focus();
    }

    function closeModal() {
        $('update-modal')?.remove();
    }

    // ─── Flow ─────────────────────────────────────────────────────────────

    function apply(next) {
        const was = state?.status;
        state = next;
        renderCard();
        const modal = $('update-modal');

        if (modal && state?.status === 'downloading' && was === 'downloading') {
            // Just move the progress bar; don't rebuild the dialog on every poll
            const pct = Math.round((state.progress || 0) * 100);
            const bar = modal.querySelector('.upd-bar span');
            const label = modal.querySelector('.upd-progress-label');
            if (bar) bar.style.width = pct + '%';
            if (label) label.textContent = I18n.t('upd_downloading', { v: state.latest, p: pct });
        } else if (state?.required && ['downloading', 'ready'].includes(state.status)) {
            // Required updates block the app until installed
            if (!modal || was !== state.status) openModal();
        } else if (modal && was !== state?.status) {
            openModal();   // refresh (e.g. download finished while "What's new" is open)
        }

        if (state?.status === 'ready' && !state.required && toastShownFor !== state.latest) {
            toastShownFor = state.latest;
            UI.toast(I18n.t('upd_ready_toast', { v: state.latest }), {
                action: I18n.t('upd_restart'),
                onAction: install,
                duration: 9000,
            });
        }

        clearTimeout(pollTimer);
        if (state?.status === 'downloading') pollTimer = setTimeout(poll, 600);
        // A required update must not leave the user stuck: keep retrying quietly
        else if (state?.status === 'error' && state.required) pollTimer = setTimeout(() => check(true), 60 * 1000);
    }

    async function poll() {
        try { apply(await window.pywebview.api.get_update_status()); } catch {}
    }

    // Automatic checks honour the "Automatic updates" setting; the Settings
    // window's "Check for updates" button passes manual=true.
    async function check(manual = false) {
        if (!manual && Settings.get('auto_update') === false) return;
        try { apply(await window.pywebview.api.check_for_update()); } catch {}
    }

    async function install() {
        if (installing || state?.status !== 'ready') return;
        installing = true;
        renderCard();
        if ($('update-modal')) openModal();
        await Editor.flushSave();
        const res = await window.pywebview.api.install_update();
        if (!res?.ok) {
            installing = false;
            renderCard();
            if ($('update-modal')) openModal();
            UI.toast(I18n.t('upd_failed', { e: res?.error || '' }), { kind: 'error' });
        }
        // On success the app closes and the installer opens the new version.
    }

    async function init() {
        $('update-card')?.addEventListener('click', e => {
            const act = e.target.closest('[data-upd]')?.dataset.upd;
            if (act === 'install') install();
            else if (act === 'notes') openModal();
        });
        document.addEventListener('languagechange', () => {
            renderCard();
            if ($('update-modal')) openModal();
        });

        // First launch of a new version (or a fresh install) → the "What's new" showcase
        try {
            const change = await window.pywebview.api.consume_version_change();
            if (change?.show) WhatsNew.open({ version: change.version, firstRun: change.first_run });
        } catch {}

        check();
        setInterval(check, CHECK_EVERY);
    }

    return { init, check, install, showNotes: openModal, status: () => state };
})();
