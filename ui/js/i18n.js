const I18n = (() => {
    const translations = {
        ar: {
            dir: 'rtl',
            app_title: 'ملاحظاتي',
            all_notes: 'كل الملاحظات',
            trash: 'سلة المهملات',
            search_placeholder: 'بحث... (Ctrl+F)',
            new_note_tooltip: 'ملاحظة جديدة (Ctrl+N)',
            new_note_title: 'ملاحظة جديدة',
            editor_placeholder: 'ابدأ الكتابة...',
            no_note_msg: 'اختر ملاحظة أو أنشئ واحدة جديدة',
            empty_trash_btn: 'تفريغ السلة',
            trash_title: 'سلة المهملات',
            restore_btn: 'استرداد',
            delete_perm_btn: 'حذف نهائي',
            saved: 'تم الحفظ ✓',
            saving: 'جاري الحفظ...',
            days_until_delete: 'يُحذف نهائياً خلال {n} يوم',
            deleted_on: 'حُذف:',
            trash_empty_msg: 'سلة المهملات فارغة',
            no_notes_msg: 'لا توجد ملاحظات\nاضغط + لإنشاء ملاحظة',
            no_results_msg: 'لا توجد نتائج',
            confirm_empty_trash: 'هل أنت متأكد؟ سيتم حذف جميع الملاحظات في السلة نهائياً.',
            title_placeholder: 'عنوان الملاحظة...',
            notes_count: 'الملاحظات ({n})',
            search_results: 'نتائج البحث ({n})',
            version: 'ملاحظاتي v1.0',
            no_content: 'لا يوجد محتوى',
            time_now: 'الآن',
            time_min: '{n} د',
            time_hour: '{n} س',
            time_day: '{n} ي',
        },
        en: {
            dir: 'ltr',
            app_title: 'My Notes',
            all_notes: 'All Notes',
            trash: 'Trash',
            search_placeholder: 'Search... (Ctrl+F)',
            new_note_tooltip: 'New Note (Ctrl+N)',
            new_note_title: 'New Note',
            editor_placeholder: 'Start writing...',
            no_note_msg: 'Select a note or create a new one',
            empty_trash_btn: 'Empty Trash',
            trash_title: 'Trash',
            restore_btn: 'Restore',
            delete_perm_btn: 'Delete Forever',
            saved: 'Saved ✓',
            saving: 'Saving...',
            days_until_delete: 'Deletes in {n} days',
            deleted_on: 'Deleted:',
            trash_empty_msg: 'Trash is empty',
            no_notes_msg: 'No notes yet\nPress + to create one',
            no_results_msg: 'No results found',
            confirm_empty_trash: 'Are you sure? All notes in trash will be permanently deleted.',
            title_placeholder: 'Note title...',
            notes_count: 'Notes ({n})',
            search_results: 'Search results ({n})',
            version: 'My Notes v1.0',
            no_content: 'No content',
            time_now: 'Just now',
            time_min: '{n}m',
            time_hour: '{n}h',
            time_day: '{n}d',
        },
        ru: {
            dir: 'ltr',
            app_title: 'Мои заметки',
            all_notes: 'Все заметки',
            trash: 'Корзина',
            search_placeholder: 'Поиск... (Ctrl+F)',
            new_note_tooltip: 'Новая заметка (Ctrl+N)',
            new_note_title: 'Новая заметка',
            editor_placeholder: 'Начните писать...',
            no_note_msg: 'Выберите заметку или создайте новую',
            empty_trash_btn: 'Очистить корзину',
            trash_title: 'Корзина',
            restore_btn: 'Восстановить',
            delete_perm_btn: 'Удалить',
            saved: 'Сохранено ✓',
            saving: 'Сохранение...',
            days_until_delete: 'Удалится через {n} дн.',
            deleted_on: 'Удалено:',
            trash_empty_msg: 'Корзина пуста',
            no_notes_msg: 'Нет заметок\nНажмите + для создания',
            no_results_msg: 'Ничего не найдено',
            confirm_empty_trash: 'Вы уверены? Все заметки в корзине будут удалены навсегда.',
            title_placeholder: 'Заголовок...',
            notes_count: 'Заметки ({n})',
            search_results: 'Результаты ({n})',
            version: 'Мои заметки v1.0',
            no_content: 'Нет содержимого',
            time_now: 'Только что',
            time_min: '{n}м',
            time_hour: '{n}ч',
            time_day: '{n}д',
        },
    };

    let current = 'ar';

    function t(key, vars = {}) {
        const str = (translations[current] || translations.ar)[key]
                 || translations.en[key]
                 || key;
        return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    }

    function apply(lang) {
        if (!translations[lang]) return;
        current = lang;
        const data = translations[lang];

        document.documentElement.dir  = data.dir;
        document.documentElement.lang = lang;

        // Static text elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });

        // Placeholder attributes
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPh);
        });

        // Title attributes (tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.dataset.i18nTitle);
        });

        // Active lang button highlight
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        // Update Quill placeholder if editor is ready
        const editorRoot = document.querySelector('.ql-editor');
        if (editorRoot) editorRoot.dataset.placeholder = t('editor_placeholder');
    }

    async function init() {
        const settings = await window.pywebview.api.get_settings();
        const lang = settings.language || 'ar';
        apply(lang);

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                apply(btn.dataset.lang);
                await window.pywebview.api.update_setting('language', btn.dataset.lang);
                await Notes.refreshList();
                await Trash.refreshBadge();
            });
        });
    }

    return { init, t, apply, get current() { return current; } };
})();
