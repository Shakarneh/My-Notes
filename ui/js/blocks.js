// Block editing: custom blocks (divider, callout), a "/" command menu,
// Markdown-style shortcuts, and a floating toolbar for tables.
const Blocks = (() => {
    let quill = null;
    let slash = null;          // { index, query, selected, items } while the menu is open

    I18n.extend({
        ar: {
            blk_text: 'نص', blk_text_d: 'فقرة عادية',
            blk_h1: 'عنوان 1', blk_h1_d: 'عنوان قسم كبير',
            blk_h2: 'عنوان 2', blk_h2_d: 'عنوان متوسط',
            blk_h3: 'عنوان 3', blk_h3_d: 'عنوان صغير',
            blk_bullet: 'قائمة نقطية', blk_bullet_d: 'قائمة بسيطة',
            blk_ordered: 'قائمة مرقّمة', blk_ordered_d: 'قائمة بأرقام',
            blk_todo: 'قائمة مهام', blk_todo_d: 'تتبّع المهام بمربعات اختيار',
            blk_quote: 'اقتباس', blk_quote_d: 'اقتباس أو ملاحظة جانبية',
            blk_callout: 'تنبيه', blk_callout_d: 'صندوق بارز لفكرة مهمة',
            blk_code: 'كود', blk_code_d: 'مقطع برمجي',
            blk_divider: 'فاصل', blk_divider_d: 'خط يفصل الأقسام',
            blk_table: 'جدول', blk_table_d: 'جدول 3×3 مثل Excel',
            blk_image: 'صورة', blk_image_d: 'إدراج صورة من جهازك',
            blk_drawing: 'رسم', blk_drawing_d: 'ارسم بخط يدك',
            blk_date: 'تاريخ اليوم', blk_date_d: 'إدراج تاريخ اليوم',
            blk_time: 'الوقت الآن', blk_time_d: 'إدراج الوقت الحالي',
            slash_empty: 'لا توجد أوامر مطابقة',
            tbl_row_above: 'صف فوق', tbl_row_below: 'صف تحت',
            tbl_col_before: 'عمود قبل', tbl_col_after: 'عمود بعد',
            tbl_del_row: 'حذف الصف', tbl_del_col: 'حذف العمود', tbl_del: 'حذف الجدول',
        },
        en: {
            blk_text: 'Text', blk_text_d: 'Plain paragraph',
            blk_h1: 'Heading 1', blk_h1_d: 'Big section heading',
            blk_h2: 'Heading 2', blk_h2_d: 'Medium heading',
            blk_h3: 'Heading 3', blk_h3_d: 'Small heading',
            blk_bullet: 'Bullet list', blk_bullet_d: 'A simple list',
            blk_ordered: 'Numbered list', blk_ordered_d: 'A list with numbers',
            blk_todo: 'To-do list', blk_todo_d: 'Track tasks with checkboxes',
            blk_quote: 'Quote', blk_quote_d: 'Capture a quote',
            blk_callout: 'Callout', blk_callout_d: 'Make an idea stand out',
            blk_code: 'Code', blk_code_d: 'A code snippet',
            blk_divider: 'Divider', blk_divider_d: 'Separate sections',
            blk_table: 'Table', blk_table_d: 'A 3×3 grid, like Excel',
            blk_image: 'Image', blk_image_d: 'Insert a picture',
            blk_drawing: 'Drawing', blk_drawing_d: 'Sketch by hand',
            blk_date: 'Today’s date', blk_date_d: 'Insert today’s date',
            blk_time: 'Current time', blk_time_d: 'Insert the time',
            slash_empty: 'No matching blocks',
            tbl_row_above: 'Row above', tbl_row_below: 'Row below',
            tbl_col_before: 'Column before', tbl_col_after: 'Column after',
            tbl_del_row: 'Delete row', tbl_del_col: 'Delete column', tbl_del: 'Delete table',
        },
        ru: {
            blk_text: 'Текст', blk_text_d: 'Обычный абзац',
            blk_h1: 'Заголовок 1', blk_h1_d: 'Крупный заголовок',
            blk_h2: 'Заголовок 2', blk_h2_d: 'Средний заголовок',
            blk_h3: 'Заголовок 3', blk_h3_d: 'Мелкий заголовок',
            blk_bullet: 'Маркированный список', blk_bullet_d: 'Простой список',
            blk_ordered: 'Нумерованный список', blk_ordered_d: 'Список с цифрами',
            blk_todo: 'Список задач', blk_todo_d: 'Задачи с галочками',
            blk_quote: 'Цитата', blk_quote_d: 'Выделить цитату',
            blk_callout: 'Выноска', blk_callout_d: 'Выделить важную мысль',
            blk_code: 'Код', blk_code_d: 'Фрагмент кода',
            blk_divider: 'Разделитель', blk_divider_d: 'Разделить разделы',
            blk_table: 'Таблица', blk_table_d: 'Таблица 3×3, как в Excel',
            blk_image: 'Изображение', blk_image_d: 'Вставить картинку',
            blk_drawing: 'Рисунок', blk_drawing_d: 'Нарисовать от руки',
            blk_date: 'Сегодняшняя дата', blk_date_d: 'Вставить дату',
            blk_time: 'Текущее время', blk_time_d: 'Вставить время',
            slash_empty: 'Ничего не найдено',
            tbl_row_above: 'Строка выше', tbl_row_below: 'Строка ниже',
            tbl_col_before: 'Столбец до', tbl_col_after: 'Столбец после',
            tbl_del_row: 'Удалить строку', tbl_del_col: 'Удалить столбец', tbl_del: 'Удалить таблицу',
        },
    });

    // ─── Custom blots ─────────────────────────────────────────────────────

    function register() {
        const BlockEmbed = Quill.import('blots/block/embed');
        class DividerBlot extends BlockEmbed {}
        DividerBlot.blotName = 'divider';
        DividerBlot.tagName = 'HR';
        Quill.register(DividerBlot, true);

        const Block = Quill.import('blots/block');
        class CalloutBlot extends Block {}
        CalloutBlot.blotName = 'callout';
        CalloutBlot.tagName = 'ASIDE';
        Quill.register(CalloutBlot, true);
    }

    // ─── Commands ─────────────────────────────────────────────────────────

    const I = {
        text: '<path d="M3 3h10v2h-1V4H9v8h1.5v1h-5v-1H7V4H4v1H3z"/>',
        h: n => `<text x="8" y="12" text-anchor="middle" font-size="9" font-weight="700" font-family="sans-serif">H${n}</text>`,
        bullet: '<circle cx="3" cy="4" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="3" cy="12" r="1.2"/><rect x="6" y="3.4" width="8" height="1.2" rx=".6"/><rect x="6" y="7.4" width="8" height="1.2" rx=".6"/><rect x="6" y="11.4" width="8" height="1.2" rx=".6"/>',
        ordered: '<text x="1" y="6" font-size="5" font-family="sans-serif">1</text><text x="1" y="13" font-size="5" font-family="sans-serif">2</text><rect x="6" y="3.4" width="8" height="1.2" rx=".6"/><rect x="6" y="10.4" width="8" height="1.2" rx=".6"/>',
        todo: '<rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 8.2l2 2 4-4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        quote: '<rect x="2" y="2" width="1.6" height="12" rx=".8"/><rect x="6" y="4" width="8" height="1.2" rx=".6"/><rect x="6" y="7.4" width="8" height="1.2" rx=".6"/><rect x="6" y="10.8" width="5" height="1.2" rx=".6"/>',
        callout: '<rect x="1.5" y="2.5" width="13" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="8" r="1.4"/><rect x="7.5" y="7.4" width="5" height="1.2" rx=".6"/>',
        code: '<path d="M5.85 4.85a.5.5 0 1 0-.7-.7l-3.5 3.5a.5.5 0 0 0 0 .7l3.5 3.5a.5.5 0 0 0 .7-.7L2.71 8zm4.3 0a.5.5 0 0 1 .7-.7l3.5 3.5a.5.5 0 0 1 0 .7l-3.5 3.5a.5.5 0 0 1-.7-.7L13.29 8z"/>',
        divider: '<rect x="1" y="7.4" width="14" height="1.2" rx=".6"/><rect x="4" y="3" width="8" height="1" rx=".5" opacity=".4"/><rect x="4" y="12" width="8" height="1" rx=".5" opacity=".4"/>',
        table: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 6.2h13M1.5 9.8h13M6 2.5v11M10.5 2.5v11" stroke="currentColor" stroke-width="1"/>',
        image: '<path d="M6 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm12 1a1 1 0 0 1 1 1v6.5l-3.78-1.95a.5.5 0 0 0-.58.1l-3.7 3.7-2.66-1.77a.5.5 0 0 0-.63.06L1 12V3a1 1 0 0 1 1-1h12z"/>',
        drawing: '<path d="M12.15.85a.5.5 0 0 1 .7 0l2.3 2.3a.5.5 0 0 1 0 .7l-9 9a.5.5 0 0 1-.23.13l-3.5 1a.5.5 0 0 1-.62-.62l1-3.5a.5.5 0 0 1 .13-.23l9-9zM11.2 3.2 12.8 4.8 14.1 3.5 12.5 1.9z"/>',
        date: '<rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.2"/>',
        time: '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    };

    // keys: extra search words (all languages) so "/جدول", "/table" and "/табл" all work
    const COMMANDS = [
        { id: 'text',    icon: I.text,    keys: 'text paragraph p نص فقرة текст абзац absatz 文本 段落 texto párrafo testo paragrafo', run: () => setBlock(null) },
        { id: 'h1',      icon: I.h(1),    keys: 'h1 heading title # عنوان заголовок überschrift 标题 título titolo', run: () => setBlock('header', 1) },
        { id: 'h2',      icon: I.h(2),    keys: 'h2 heading ## عنوان заголовок überschrift 标题 título titolo', run: () => setBlock('header', 2) },
        { id: 'h3',      icon: I.h(3),    keys: 'h3 heading ### عنوان заголовок überschrift 标题 título titolo', run: () => setBlock('header', 3) },
        { id: 'todo',    icon: I.todo,    keys: 'todo task check checkbox مهام مهمة задачи чек aufgabe checkliste 待办 任务 清单 tarea tareas attività compiti', run: () => setBlock('list', 'unchecked') },
        { id: 'bullet',  icon: I.bullet,  keys: 'bullet list ul قائمة نقاط список маркер liste aufzählung 列表 项目 lista viñetas elenco puntato', run: () => setBlock('list', 'bullet') },
        { id: 'ordered', icon: I.ordered, keys: 'numbered ordered list ol 1. مرقمة ارقام нумерованный nummeriert 编号 numerada numerato', run: () => setBlock('list', 'ordered') },
        { id: 'table',   icon: I.table,   keys: 'table grid excel sheet جدول таблица tabelle 表格 tabla tabella', run: insertTable },
        { id: 'callout', icon: I.callout, keys: 'callout note info tip تنبيه ملاحظة выноска hinweis 标注 提示 destacado riquadro', run: () => setBlock('callout', true) },
        { id: 'quote',   icon: I.quote,   keys: 'quote blockquote اقتباس цитата zitat 引用 cita citazione', run: () => setBlock('blockquote', true) },
        { id: 'code',    icon: I.code,    keys: 'code snippet كود برمجة код 代码 código codice', run: () => setBlock('code-block', true) },
        { id: 'divider', icon: I.divider, keys: 'divider line hr separator فاصل خط разделитель trennlinie 分隔 separador divisore', run: insertDivider },
        { id: 'image',   icon: I.image,   keys: 'image picture photo صورة изображение фото bild 图片 imagen immagine foto', run: () => document.getElementById('btn-insert-image')?.click() },
        { id: 'drawing', icon: I.drawing, keys: 'draw drawing sketch pen رسم ارسم рисунок zeichnung zeichnen 手绘 绘图 dibujo disegno', run: () => Drawing.open() },
        { id: 'date',    icon: I.date,    keys: 'date today تاريخ اليوم дата сегодня datum heute 日期 今天 fecha hoy data oggi', run: () => insertText(new Date().toLocaleDateString(UI.locale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })) },
        { id: 'time',    icon: I.time,    keys: 'time now وقت الآن время uhrzeit zeit 时间 现在 hora ahora ora adesso', run: () => insertText(new Date().toLocaleTimeString(UI.locale(), { hour: '2-digit', minute: '2-digit' })) },
    ];

    function cursorIndex() {
        return (quill.getSelection(true) || { index: quill.getLength() - 1 }).index;
    }

    function setBlock(format, value) {
        const index = cursorIndex();
        // Clear every block format first so e.g. a heading can become a list cleanly
        ['header', 'list', 'blockquote', 'code-block', 'callout'].forEach(f => {
            if (f !== format) quill.formatLine(index, 0, f, false, 'user');
        });
        if (format) quill.formatLine(index, 0, format, value, 'user');
        quill.setSelection(index, 0, 'silent');
    }

    function insertText(text) {
        const index = cursorIndex();
        quill.insertText(index, text, 'user');
        quill.setSelection(index + text.length, 0, 'user');
    }

    function insertDivider() {
        let index = cursorIndex();
        const [line, offset] = quill.getLine(index);
        // Put the divider on its own line; an empty line is replaced
        if (line && line.length() <= 1) {
            quill.insertEmbed(index, 'divider', true, 'user');
        } else {
            index = index - offset + line.length();
            quill.insertEmbed(index, 'divider', true, 'user');
        }
        quill.setSelection(index + 1, 0, 'user');
    }

    function insertTable() {
        const table = quill.getModule('table');
        if (!table) return;
        const index = cursorIndex();
        const [line] = quill.getLine(index);
        if (line && line.length() > 1) {
            // Start the table on a fresh line
            const end = quill.getIndex(line) + line.length() - 1;
            quill.insertText(end, '\n', 'user');
            quill.setSelection(end + 1, 0, 'silent');
        }
        table.insertTable(3, 3);
    }

    // ─── Slash menu ───────────────────────────────────────────────────────

    function menuEl() { return document.getElementById('slash-menu'); }

    function filtered(query) {
        const q = query.trim().toLowerCase();
        if (!q) return COMMANDS;
        return COMMANDS.filter(c =>
            I18n.t('blk_' + c.id).toLowerCase().includes(q) || c.keys.toLowerCase().includes(q));
    }

    function renderMenu() {
        const el = menuEl();
        if (!el || !slash) return;
        slash.items = filtered(slash.query);
        slash.selected = Math.min(slash.selected, Math.max(0, slash.items.length - 1));
        el.innerHTML = slash.items.length
            ? slash.items.map((c, i) => `
                <button class="slash-item${i === slash.selected ? ' active' : ''}" data-i="${i}">
                    <span class="slash-icon"><svg viewBox="0 0 16 16" fill="currentColor">${c.icon}</svg></span>
                    <span class="slash-text">
                        <span class="slash-label">${UI.esc(I18n.t('blk_' + c.id))}</span>
                        <span class="slash-desc">${UI.esc(I18n.t('blk_' + c.id + '_d'))}</span>
                    </span>
                </button>`).join('')
            : `<div class="slash-empty">${UI.esc(I18n.t('slash_empty'))}</div>`;
        el.querySelector('.slash-item.active')?.scrollIntoView({ block: 'nearest' });
    }

    function positionMenu() {
        const el = menuEl();
        // Measure the "/" itself; a zero-length range can make Quill's getBounds throw
        let b;
        try { b = quill.getBounds(slash.index, 1); } catch { b = null; }
        if (!b) {
            const r = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).getBoundingClientRect() : null;
            const c = quill.container.getBoundingClientRect();
            b = r ? { top: r.top - c.top, bottom: r.bottom - c.top, left: r.left - c.left, right: r.right - c.left }
                  : { top: 0, bottom: 20, left: 0, right: 0 };
        }
        const rect = quill.container.getBoundingClientRect();
        el.style.display = 'block';
        const h = el.offsetHeight, w = el.offsetWidth;
        let top = rect.top + b.bottom + 6;
        if (top + h > window.innerHeight - 10) top = rect.top + b.top - h - 6;
        const rtl = getComputedStyle(quill.root).direction === 'rtl' ||
                    quill.getFormat(slash.index, 0).direction === 'rtl';
        let left = rtl ? rect.left + b.right - w : rect.left + b.left;
        left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
        el.style.top = Math.max(10, top) + 'px';
        el.style.left = left + 'px';
    }

    function openMenu(index) {
        slash = { index, query: '', selected: 0, items: COMMANDS };
        renderMenu();
        positionMenu();
    }

    function closeMenu() {
        slash = null;
        const el = menuEl();
        if (el) el.style.display = 'none';
    }

    function choose(i) {
        if (!slash) return;
        const cmd = slash.items[i];
        const { index, query } = slash;
        closeMenu();
        if (!cmd) return;
        quill.deleteText(index, query.length + 1, 'user');
        quill.setSelection(index, 0, 'silent');
        cmd.run();
    }

    // Where the cursor ends up after a change, computed from the delta itself
    // (quill.getSelection() can still report the old position at this point).
    function cursorAfter(delta) {
        let index = 0, cursor = null;
        for (const op of delta.ops) {
            if (op.retain !== undefined) index += typeof op.retain === 'number' ? op.retain : 1;
            else if (op.insert !== undefined) { index += typeof op.insert === 'string' ? op.insert.length : 1; cursor = index; }
            else if (op.delete !== undefined) cursor = index;
        }
        return cursor;
    }

    function onTextChange(delta, old, source) {
        if (source !== 'user') return;
        const cursor = cursorAfter(delta);
        if (cursor === null) return;

        if (slash) {
            // Keep the query in sync; close once the "/" is gone or a space/newline is typed
            const text = cursor > slash.index ? quill.getText(slash.index, cursor - slash.index) : '';
            if (text[0] !== '/' || /\s/.test(text.slice(1)) || text.length > 24) {
                closeMenu();
            } else {
                slash.query = text.slice(1);
                slash.selected = 0;
                renderMenu();
                positionMenu();
            }
            return;
        }

        // Just typed a "/" at the start of a line or after a space?
        const inserts = delta.ops.filter(op => op.insert !== undefined);
        if (inserts.length === 1 && inserts[0].insert === '/') {
            const at = cursor - 1;
            const before = at === 0 ? '\n' : quill.getText(at - 1, 1);
            if (/\s/.test(before) && !quill.getFormat(at, 1)['code-block']) openMenu(at);
        }
    }

    function onKeyDown(e) {
        if (!slash) return;
        const n = slash.items.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!n) return;
            slash.selected = (slash.selected + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
            renderMenu();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (!n) { closeMenu(); return; }
            e.preventDefault();
            e.stopImmediatePropagation();
            choose(slash.selected);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeMenu();
        }
    }

    // ─── Markdown shortcuts ("# " → heading, "- " → list, "> " → quote …) ──

    function markdownBindings() {
        const make = (prefix, apply) => ({
            key: ' ',
            collapsed: true,
            format: { 'code-block': false, list: false, blockquote: false, header: false, callout: false, table: false },
            prefix,
            handler(range, context) {
                const len = context.prefix.length;
                const start = range.index - len;
                quill.deleteText(start, len, 'user');
                apply(start, context.prefix);
                quill.setSelection(start, 0, 'silent');
                return false;
            },
        });
        return {
            'md-header': make(/^#{1,3}$/, (i, p) => quill.formatLine(i, 1, 'header', p.length, 'user')),
            'md-quote': make(/^>$/, i => quill.formatLine(i, 1, 'blockquote', true, 'user')),
            'md-callout': make(/^!!$/, i => quill.formatLine(i, 1, 'callout', true, 'user')),
            'md-code': make(/^```$/, i => quill.formatLine(i, 1, 'code-block', true, 'user')),
            'md-divider': make(/^(---|\*\*\*|___)$/, i => {
                quill.insertEmbed(i, 'divider', true, 'user');
                quill.setSelection(i + 1, 0, 'silent');
            }),
            'md-todo-done': make(/^\[x\]$/i, i => quill.formatLine(i, 1, 'list', 'checked', 'user')),
            // Enter on an empty quote/callout/heading line leaves the block (instead of repeating it)
            'exit-empty-block': {
                key: 'Enter',
                collapsed: true,
                empty: true,
                format: ['blockquote', 'callout', 'header'],
                handler(range) {
                    quill.formatLine(range.index, 1, { blockquote: false, callout: false, header: false }, 'user');
                    return false;
                },
            },
            // Backspace at the start of a quote/callout/heading turns it back into plain text
            'unwrap-block': {
                key: 'Backspace',
                collapsed: true,
                offset: 0,
                format: ['blockquote', 'callout', 'header'],
                handler(range) {
                    quill.formatLine(range.index, 1, { blockquote: false, callout: false, header: false }, 'user');
                    return false;
                },
            },
        };
    }

    // ─── Table toolbar ────────────────────────────────────────────────────

    function updateTableToolbar() {
        const bar = document.getElementById('table-toolbar');
        if (!bar) return;
        const range = quill.getSelection();
        const inTable = range && quill.getFormat(range.index, 0).table;
        if (!inTable) { bar.style.display = 'none'; return; }
        const [leaf] = quill.getLeaf(range.index);
        const tableEl = leaf?.domNode?.parentElement?.closest?.('table') ||
                        (leaf?.domNode?.nodeType === 3 ? leaf.domNode.parentElement : leaf?.domNode)?.closest?.('table');
        if (!tableEl) { bar.style.display = 'none'; return; }
        const r = tableEl.getBoundingClientRect();
        bar.style.display = 'flex';
        const w = bar.offsetWidth;
        const rtl = getComputedStyle(tableEl).direction === 'rtl';
        let left = rtl ? r.right - w : r.left;
        left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
        bar.style.left = left + 'px';
        // Below the table so it never hides the text above; above only if there's no room
        const below = r.bottom + 6;
        bar.style.top = (below + bar.offsetHeight < window.innerHeight - 30
            ? below
            : Math.max(10, r.top - bar.offsetHeight - 6)) + 'px';
    }

    function initTableToolbar() {
        const bar = document.getElementById('table-toolbar');
        if (!bar) return;
        bar.addEventListener('mousedown', e => e.preventDefault());
        bar.addEventListener('click', e => {
            const act = e.target.closest('[data-tbl]')?.dataset.tbl;
            const table = quill.getModule('table');
            if (!act || !table) return;
            const fn = {
                'row-above': 'insertRowAbove', 'row-below': 'insertRowBelow',
                'col-before': 'insertColumnLeft', 'col-after': 'insertColumnRight',
                'del-row': 'deleteRow', 'del-col': 'deleteColumn', 'del': 'deleteTable',
            }[act];
            table[fn]();
            setTimeout(updateTableToolbar, 0);
        });
        quill.on('editor-change', () => setTimeout(updateTableToolbar, 0));
        quill.root.addEventListener('scroll', updateTableToolbar);
        window.addEventListener('resize', updateTableToolbar);
    }

    // ─── Wiring ───────────────────────────────────────────────────────────

    function attach(q) {
        quill = q;
        quill.on('text-change', onTextChange);
        quill.on('selection-change', range => { if (!range) closeMenu(); });
        quill.root.addEventListener('keydown', onKeyDown, true);
        quill.root.addEventListener('scroll', () => slash && positionMenu());
        const el = menuEl();
        el?.addEventListener('mousedown', e => e.preventDefault());
        el?.addEventListener('click', e => {
            const btn = e.target.closest('.slash-item');
            if (btn) choose(Number(btn.dataset.i));
        });
        el?.addEventListener('mousemove', e => {
            const btn = e.target.closest('.slash-item');
            if (btn && slash && Number(btn.dataset.i) !== slash.selected) {
                slash.selected = Number(btn.dataset.i);
                el.querySelectorAll('.slash-item').forEach((b, i) => b.classList.toggle('active', i === slash.selected));
            }
        });
        initTableToolbar();
    }

    function run(id) {
        COMMANDS.find(c => c.id === id)?.run();
    }

    return { register, attach, markdownBindings, closeMenu, run, isOpen: () => !!slash };
})();
