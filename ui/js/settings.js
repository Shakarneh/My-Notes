// Settings window (Ctrl+,): appearance, editor, language, updates, data, about.
const Settings = (() => {
    const $ = id => document.getElementById(id);

    const LANGUAGES = [
        { code: 'ar', name: 'العربية',  en: 'Arabic',  short: 'ع' },
        { code: 'en', name: 'English',  en: 'English', short: 'EN' },
        { code: 'ru', name: 'Русский',  en: 'Russian', short: 'РУ' },
        { code: 'de', name: 'Deutsch',  en: 'German',  short: 'DE' },
        { code: 'zh', name: '中文',      en: 'Chinese', short: '中' },
        { code: 'es', name: 'Español',  en: 'Spanish', short: 'ES' },
        { code: 'it', name: 'Italiano', en: 'Italian', short: 'IT' },
    ];

    const WIDTHS = { narrow: '640px', medium: '760px', wide: '960px', full: '100%' };
    const SPACING = { compact: '1.55', normal: '1.8', relaxed: '2.1' };
    const FONTS = {
        default: 'var(--font-ui)',
        tajawal: "'Tajawal', 'IBM Plex Sans', sans-serif",
        plex: "'IBM Plex Sans', 'Tajawal', sans-serif",
        serif: "Georgia, 'Times New Roman', 'Amiri', serif",
        mono: 'var(--font-mono)',
    };

    let settings = {};
    let section = 'appearance';

    I18n.extend({
        ar: {
            settings: 'الإعدادات', settings_tip: 'الإعدادات (Ctrl+,)',
            set_appearance: 'المظهر', set_editor: 'المحرر', set_language: 'اللغة', set_updates: 'التحديثات', set_data: 'النسخ الاحتياطي والبيانات', set_about: 'حول',
            set_theme: 'السمة', set_theme_d: 'تلقائي يتبع وقت اليوم (فاتح من 7 صباحاً إلى 7 مساءً).',
            theme_opt_auto: 'تلقائي', theme_opt_light: 'فاتح', theme_opt_dark: 'داكن',
            set_accent: 'لون التمييز', set_accent_d: 'يُستخدم للأزرار والتحديد والروابط.',
            set_motion: 'تقليل الحركة', set_motion_d: 'إيقاف الرسوم المتحركة والانتقالات.',
            set_size: 'حجم النص', set_size_d: 'حجم خط الملاحظات.',
            set_width: 'عرض الصفحة', width_narrow: 'ضيق', width_medium: 'متوسط', width_wide: 'عريض', width_full: 'كامل',
            set_spacing: 'تباعد الأسطر', spacing_compact: 'متقارب', spacing_normal: 'عادي', spacing_relaxed: 'مريح',
            set_font: 'خط الملاحظات', font_default: 'افتراضي', font_serif: 'كلاسيكي', font_mono: 'ثابت العرض',
            set_spell: 'التدقيق الإملائي', set_spell_d: 'وضع خط تحت الكلمات الخاطئة.',
            set_preview: 'معاينة: هكذا ستبدو ملاحظاتك. The quick brown fox.',
            set_lang_d: 'تتغير لغة الواجهة فوراً. تبقى ملاحظاتك كما هي.',
            set_version: 'الإصدار الحالي', set_auto_update: 'تحديث تلقائي', set_auto_update_d: 'البحث عن الإصدارات الجديدة وتنزيلها في الخلفية.',
            set_check_now: 'البحث عن تحديثات', upd_up_to_date: 'لديك أحدث إصدار ✓', upd_checking: 'جاري البحث…', upd_error: 'تعذّر الاتصال. تحقق من الإنترنت.',
            set_backup_d: 'احفظ كل ملاحظاتك في ملف واحد يمكنك استيراده على أي جهاز.',
            set_restore_d: 'أضف ملاحظات من ملف نسخة احتياطية. لا يتم استبدال أي ملاحظة موجودة.',
            set_folder: 'مجلد البيانات', set_open_folder: 'فتح المجلد',
            set_trash_d: 'تُحذف الملاحظات في السلة نهائياً بعد {n} يوماً.',
            about_tagline: 'ملاحظات جميلة، بكل لغة.', about_made: 'صُنع بواسطة', about_github: 'المشروع على GitHub', about_credits: 'يستخدم Quill و pywebview وخطَّي Tajawal و IBM Plex Sans.',
            close: 'إغلاق',
        },
        en: {
            settings: 'Settings', settings_tip: 'Settings (Ctrl+,)',
            set_appearance: 'Appearance', set_editor: 'Editor', set_language: 'Language', set_updates: 'Updates', set_data: 'Backup & data', set_about: 'About',
            set_theme: 'Theme', set_theme_d: 'Automatic follows the time of day (light from 7 am to 7 pm).',
            theme_opt_auto: 'Auto', theme_opt_light: 'Light', theme_opt_dark: 'Dark',
            set_accent: 'Accent colour', set_accent_d: 'Used for buttons, selection and links.',
            set_motion: 'Reduce motion', set_motion_d: 'Turn off animations and transitions.',
            set_size: 'Text size', set_size_d: 'Font size of your notes.',
            set_width: 'Page width', width_narrow: 'Narrow', width_medium: 'Medium', width_wide: 'Wide', width_full: 'Full',
            set_spacing: 'Line spacing', spacing_compact: 'Compact', spacing_normal: 'Normal', spacing_relaxed: 'Relaxed',
            set_font: 'Note font', font_default: 'Default', font_serif: 'Serif', font_mono: 'Monospace',
            set_spell: 'Spell check', set_spell_d: 'Underline misspelled words.',
            set_preview: 'Preview: this is how your notes will look. مرحباً بالعالم.',
            set_lang_d: 'The interface changes instantly. Your notes stay as they are.',
            set_version: 'Current version', set_auto_update: 'Automatic updates', set_auto_update_d: 'Look for new versions and download them in the background.',
            set_check_now: 'Check for updates', upd_up_to_date: 'You have the latest version ✓', upd_checking: 'Checking…', upd_error: 'Could not connect. Check your internet connection.',
            set_backup_d: 'Save all your notes to one file you can import on any computer.',
            set_restore_d: 'Add notes from a backup file. Existing notes are never replaced.',
            set_folder: 'Data folder', set_open_folder: 'Open folder',
            set_trash_d: 'Notes in the trash are deleted forever after {n} days.',
            about_tagline: 'Beautiful notes, in every language.', about_made: 'Made by', about_github: 'Project on GitHub', about_credits: 'Uses Quill, pywebview, and the Tajawal and IBM Plex Sans fonts.',
            close: 'Close',
        },
        ru: {
            settings: 'Настройки', settings_tip: 'Настройки (Ctrl+,)',
            set_appearance: 'Оформление', set_editor: 'Редактор', set_language: 'Язык', set_updates: 'Обновления', set_data: 'Резервные копии', set_about: 'О программе',
            set_theme: 'Тема', set_theme_d: 'Авто следует времени суток (светлая с 7:00 до 19:00).',
            theme_opt_auto: 'Авто', theme_opt_light: 'Светлая', theme_opt_dark: 'Тёмная',
            set_accent: 'Акцентный цвет', set_accent_d: 'Для кнопок, выделения и ссылок.',
            set_motion: 'Меньше анимации', set_motion_d: 'Отключить анимации и переходы.',
            set_size: 'Размер текста', set_size_d: 'Размер шрифта заметок.',
            set_width: 'Ширина страницы', width_narrow: 'Узкая', width_medium: 'Средняя', width_wide: 'Широкая', width_full: 'Во всю ширину',
            set_spacing: 'Межстрочный интервал', spacing_compact: 'Плотный', spacing_normal: 'Обычный', spacing_relaxed: 'Свободный',
            set_font: 'Шрифт заметок', font_default: 'По умолчанию', font_serif: 'С засечками', font_mono: 'Моноширинный',
            set_spell: 'Проверка орфографии', set_spell_d: 'Подчёркивать слова с ошибками.',
            set_preview: 'Пример: так будут выглядеть ваши заметки. Hello world.',
            set_lang_d: 'Интерфейс меняется сразу. Заметки остаются без изменений.',
            set_version: 'Текущая версия', set_auto_update: 'Автообновление', set_auto_update_d: 'Искать новые версии и загружать их в фоне.',
            set_check_now: 'Проверить обновления', upd_up_to_date: 'У вас последняя версия ✓', upd_checking: 'Проверка…', upd_error: 'Нет соединения. Проверьте интернет.',
            set_backup_d: 'Сохранить все заметки в один файл для переноса на другой компьютер.',
            set_restore_d: 'Добавить заметки из резервной копии. Существующие не заменяются.',
            set_folder: 'Папка данных', set_open_folder: 'Открыть папку',
            set_trash_d: 'Заметки в корзине удаляются навсегда через {n} дней.',
            about_tagline: 'Красивые заметки на любом языке.', about_made: 'Автор', about_github: 'Проект на GitHub', about_credits: 'Использует Quill, pywebview и шрифты Tajawal и IBM Plex Sans.',
            close: 'Закрыть',
        },
    });

    // ─── Applying settings to the page ────────────────────────────────────

    function applyEditorPrefs() {
        const root = document.documentElement.style;
        root.setProperty('--editor-size', (Number(settings.editor_size) || 16) + 'px');
        root.setProperty('--editor-width', WIDTHS[settings.editor_width] || WIDTHS.medium);
        root.setProperty('--editor-lh', SPACING[settings.editor_spacing] || SPACING.normal);
        root.setProperty('--editor-font', FONTS[settings.editor_font] || FONTS.default);
        document.documentElement.classList.toggle('reduce-motion', !!settings.reduce_motion);
        document.querySelector('.ql-editor')?.setAttribute('spellcheck', settings.spellcheck ? 'true' : 'false');
    }

    async function save(key, value) {
        const stored = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
        settings[key] = value;
        applyEditorPrefs();
        await window.pywebview.api.update_setting(key, stored);
    }

    // ─── Rendering ────────────────────────────────────────────────────────

    const ICONS = {
        appearance: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>',
        editor: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
        language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
        updates: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>',
        data: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.66 3.58 3 8 3s8-1.34 8-3v-13"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
        about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    };
    const SECTIONS = ['appearance', 'editor', 'language', 'updates', 'data', 'about'];
    const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
    const t = (k, v) => UI.esc(I18n.t(k, v));

    function segmented(key, options, labelPrefix) {
        return `<div class="seg" data-key="${key}">${options.map(o =>
            `<button class="seg-btn${String(settings[key]) === o ? ' active' : ''}" data-value="${o}">${t(labelPrefix + o)}</button>`
        ).join('')}</div>`;
    }

    function toggle(key) {
        return `<button class="switch${settings[key] ? ' on' : ''}" data-toggle="${key}" role="switch" aria-checked="${!!settings[key]}"><span></span></button>`;
    }

    function row(title, desc, control, extraClass = '') {
        return `<div class="set-row ${extraClass}">
            <div class="set-text"><div class="set-title">${title}</div>${desc ? `<div class="set-desc">${desc}</div>` : ''}</div>
            <div class="set-control">${control}</div>
        </div>`;
    }

    function pane() {
        switch (section) {
            case 'appearance': {
                const accents = Theme.accents();
                return `
                    ${row(t('set_theme'), t('set_theme_d'), segmented('theme_override', ['auto', 'light', 'dark'], 'theme_opt_'))}
                    ${row(t('set_accent'), t('set_accent_d'), `<div class="set-swatches">${accents.map(a =>
                        `<button class="accent-swatch${settings.accent === a.name ? ' active' : ''}" data-accent="${a.name}" style="--sw-dark:${a.dark};--sw-light:${a.light}" title="${a.name}"></button>`).join('')}</div>`)}
                    ${row(t('set_motion'), t('set_motion_d'), toggle('reduce_motion'))}`;
            }
            case 'editor':
                return `
                    ${row(t('set_size'), t('set_size_d'), `<div class="set-range"><input type="range" min="12" max="26" step="1" value="${settings.editor_size}" data-range="editor_size"><output>${settings.editor_size}px</output></div>`)}
                    ${row(t('set_width'), '', segmented('editor_width', ['narrow', 'medium', 'wide', 'full'], 'width_'))}
                    ${row(t('set_spacing'), '', segmented('editor_spacing', ['compact', 'normal', 'relaxed'], 'spacing_'))}
                    ${row(t('set_font'), '', `<div class="seg" data-key="editor_font">${[['default', t('font_default')], ['tajawal', 'Tajawal'], ['plex', 'IBM Plex'], ['serif', t('font_serif')], ['mono', t('font_mono')]].map(([v, l]) =>
                        `<button class="seg-btn${settings.editor_font === v ? ' active' : ''}" data-value="${v}">${l}</button>`).join('')}</div>`)}
                    ${row(t('set_spell'), t('set_spell_d'), toggle('spellcheck'))}
                    <div class="set-preview" dir="auto">${t('set_preview')}</div>`;
            case 'language':
                return `
                    <p class="set-lead">${t('set_lang_d')}</p>
                    <div class="lang-grid">${LANGUAGES.map(l => `
                        <button class="lang-card${I18n.current === l.code ? ' active' : ''}" data-lang-pick="${l.code}">
                            <span class="lang-short">${UI.esc(l.short)}</span>
                            <span class="lang-names"><b>${UI.esc(l.name)}</b><small>${UI.esc(l.en)}</small></span>
                        </button>`).join('')}</div>`;
            case 'updates': {
                const st = Updater.status();
                let line = '';
                if (st?.status === 'checking') line = t('upd_checking');
                else if (st?.status === 'up_to_date') line = t('upd_up_to_date');
                else if (st?.status === 'downloading') line = t('upd_downloading', { v: st.latest, p: Math.round((st.progress || 0) * 100) });
                else if (st?.status === 'ready') line = t('upd_ready', { v: st.latest });
                else if (st?.status === 'error') line = t('upd_error');
                return `
                    ${row(t('set_version'), `<span class="upd-line">${line}</span>`, `<span class="version-pill">v${UI.esc(settings.version || '')}</span>`)}
                    ${row(t('set_auto_update'), t('set_auto_update_d'), toggle('auto_update'))}
                    <div class="set-actions">
                        ${st?.status === 'ready'
                            ? `<button class="primary-btn" data-act="install">${t('upd_restart')}</button>`
                            : `<button class="primary-btn" data-act="check" ${['checking', 'downloading'].includes(st?.status) ? 'disabled' : ''}>${t('set_check_now')}</button>`}
                        ${['downloading', 'ready'].includes(st?.status) ? `<button class="draw-btn" data-act="notes">${t('upd_whats_new')}</button>` : ''}
                    </div>`;
            }
            case 'data':
                return `
                    ${row(t('backup'), t('set_backup_d'), `<button class="draw-btn" data-act="backup">${t('backup')}</button>`)}
                    ${row(t('restore_backup'), t('set_restore_d'), `<button class="draw-btn" data-act="restore">${t('restore_backup')}</button>`)}
                    ${row(t('set_folder'), `<code class="set-path" dir="ltr">${UI.esc(settings.data_folder || '')}</code>`, `<button class="draw-btn" data-act="folder">${t('set_open_folder')}</button>`)}
                    ${row(t('trash'), t('set_trash_d', { n: settings.trash_days || 90 }), '')}`;
            case 'about':
                return `
                    <div class="about">
                        <div class="about-logo"><img src="assets/logo.svg" alt=""></div>
                        <h3>My Note <span class="version-pill">v${UI.esc(settings.version || '')}</span></h3>
                        <p class="about-tag">${t('about_tagline')}</p>
                        <p class="about-by">${t('about_made')} <b>Mohammed Shakarneh</b></p>
                        <div class="about-actions">
                            <button class="primary-btn" data-act="whatsnew">${t('wn_reopen')}</button>
                            <button class="draw-btn" data-act="github">${t('about_github')}</button>
                        </div>
                        <p class="about-credits">${t('about_credits')}</p>
                    </div>`;
        }
        return '';
    }

    function render() {
        const modal = $('settings-modal');
        if (!modal) return;
        modal.querySelector('.set-nav').innerHTML = SECTIONS.map(s =>
            `<button class="set-nav-item${s === section ? ' active' : ''}" data-section="${s}">${icon(s)}<span>${t('set_' + s)}</span></button>`
        ).join('');
        modal.querySelector('.set-head h2').textContent = I18n.t('set_' + section);
        modal.querySelector('.set-pane').innerHTML = pane();
        modal.querySelector('.set-title-main').textContent = I18n.t('settings');
    }

    // ─── Open / close / events ────────────────────────────────────────────

    async function open(target) {
        if (target) section = target;
        settings = { ...settings, ...(await window.pywebview.api.get_settings()), version: await window.pywebview.api.get_version() };
        close();
        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.innerHTML = `
            <div class="set-dialog" role="dialog" aria-modal="true">
                <aside class="set-side">
                    <div class="set-title-main"></div>
                    <nav class="set-nav"></nav>
                </aside>
                <section class="set-main">
                    <header class="set-head">
                        <h2></h2>
                        <button class="set-close" data-act="close" title="Esc">
                            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                        </button>
                    </header>
                    <div class="set-pane"></div>
                </section>
            </div>`;
        document.body.appendChild(modal);
        render();
        modal.tabIndex = -1;
        modal.focus();

        modal.addEventListener('click', onClick);
        modal.addEventListener('input', e => {
            const r = e.target.closest('[data-range]');
            if (!r) return;
            r.nextElementSibling.textContent = r.value + 'px';
            settings[r.dataset.range] = r.value;
            applyEditorPrefs();
        });
        modal.addEventListener('change', e => {
            const r = e.target.closest('[data-range]');
            if (r) save(r.dataset.range, r.value);
        });
        document.addEventListener('keydown', onKeyDown, true);
    }

    // Registered on the document (not the dialog) so Esc works even after a
    // re-render has removed the focused button.
    function onKeyDown(e) {
        if (e.key === 'Escape' && $('settings-modal')) {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }

    async function onClick(e) {
        const modal = $('settings-modal');
        if (e.target === modal) return close();
        const el = e.target.closest('button');
        if (!el) return;

        if (el.dataset.section) { section = el.dataset.section; render(); return; }
        if (el.dataset.toggle) {
            const key = el.dataset.toggle;
            await save(key, !settings[key]);
            if (key === 'auto_update' && settings.auto_update) Updater.check();
            render();
            return;
        }
        if (el.dataset.langPick) {
            await setLanguage(el.dataset.langPick);
            return;
        }
        if (el.dataset.accent) {
            await Theme.setAccent(el.dataset.accent);
            settings.accent = el.dataset.accent;
            render();
            return;
        }
        const seg = el.closest('.seg');
        if (seg && el.dataset.value) {
            const key = seg.dataset.key;
            if (key === 'theme_override') await Theme.setMode(el.dataset.value);
            else await save(key, el.dataset.value);
            settings[key] = el.dataset.value;
            render();
            return;
        }
        switch (el.dataset.act) {
            case 'close': close(); break;
            case 'check':
                await Updater.check(true);
                render();
                watchUpdates();
                break;
            case 'install': close(); Updater.install(); break;
            case 'notes': close(); Updater.showNotes(); break;
            case 'backup': App.runBackup(); break;
            case 'restore': App.runRestore(); break;
            case 'folder': window.pywebview.api.open_data_folder(); break;
            case 'github': window.pywebview.api.open_url('https://github.com/Shakarneh/My-Notes'); break;
            case 'whatsnew': close(); WhatsNew.open({ version: settings.version }); break;
        }
    }

    // Keep the Updates pane live while a check/download is running
    function watchUpdates() {
        const tick = () => {
            if (!$('settings-modal') || section !== 'updates') return;
            render();
            const st = Updater.status()?.status;
            if (st === 'checking' || st === 'downloading') setTimeout(tick, 500);
        };
        setTimeout(tick, 500);
    }

    function close() {
        document.removeEventListener('keydown', onKeyDown, true);
        $('settings-modal')?.remove();
    }

    async function setLanguage(code) {
        if (!LANGUAGES.some(l => l.code === code)) return;
        I18n.apply(code);
        await window.pywebview.api.update_setting('language', code);
        document.dispatchEvent(new CustomEvent('languagechange'));
        renderLangButton();
        render();
    }

    // ─── Sidebar language button + popover ────────────────────────────────

    function renderLangButton() {
        const btn = $('btn-language');
        const lang = LANGUAGES.find(l => l.code === I18n.current) || LANGUAGES[1];
        if (btn) btn.querySelector('.lang-current').textContent = lang.name;
        const pop = $('language-popover');
        if (pop) pop.innerHTML = LANGUAGES.map(l =>
            `<button class="lang-option${l.code === I18n.current ? ' active' : ''}" data-lang-pick="${l.code}">
                <span>${UI.esc(l.name)}</span><small>${UI.esc(l.short)}</small>
            </button>`).join('');
    }

    function init(initial) {
        settings = { ...initial };
        applyEditorPrefs();
        renderLangButton();

        $('btn-settings')?.addEventListener('click', () => open());
        const btn = $('btn-language');
        const pop = $('language-popover');
        btn?.addEventListener('click', e => {
            e.stopPropagation();
            pop.classList.toggle('open');
        });
        pop?.addEventListener('click', async e => {
            const opt = e.target.closest('[data-lang-pick]');
            if (!opt) return;
            pop.classList.remove('open');
            await setLanguage(opt.dataset.langPick);
        });
        document.addEventListener('mousedown', e => {
            if (!e.target.closest('#language-popover') && !e.target.closest('#btn-language')) pop?.classList.remove('open');
        });
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.code === 'Comma') {
                e.preventDefault();
                $('settings-modal') ? close() : open();
            }
        });
    }

    return { init, open, close, languages: LANGUAGES, get: key => settings[key] };
})();
