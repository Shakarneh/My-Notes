const Editor = (() => {
    let quill = null;
    let currentNoteId = null;
    let saveTimer = null;
    const SAVE_DELAY = 800;

    const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;

    function detectDirection(text) {
        const plain = text.replace(/\s/g, '');
        if (!plain.length) return null;
        const arabicCount = (plain.match(ARABIC_RE) || []).length;
        return arabicCount / plain.length > 0.4 ? 'rtl' : 'ltr';
    }

    function applyDirectionAtCursor() {
        if (!quill) return;
        const selection = quill.getSelection();
        if (!selection) return;

        const [line] = quill.getLine(selection.index);
        if (!line) return;
        const text = line.domNode ? line.domNode.textContent : '';
        const dir = detectDirection(text);
        if (!dir) return;

        const lineIndex = quill.getIndex(line);
        const lineLength = line.length();
        quill.formatLine(lineIndex, lineLength, {
            direction: dir === 'rtl' ? 'rtl' : false,
            align: dir === 'rtl' ? 'right' : false,
        }, 'user');
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        const indicator = document.getElementById('save-indicator');
        if (indicator) { indicator.textContent = 'جاري الحفظ...'; indicator.className = 'saving'; }
        saveTimer = setTimeout(() => flushSave(), SAVE_DELAY);
    }

    async function flushSave() {
        if (!currentNoteId) return;
        clearTimeout(saveTimer);
        const title = document.getElementById('note-title-input').value || 'ملاحظة جديدة';
        const content = JSON.stringify(quill.getContents());
        const contentPlain = quill.getText().trim();
        await window.pywebview.api.save_note(currentNoteId, title, content, contentPlain);
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.textContent = 'تم الحفظ ✓';
            indicator.className = 'saved';
            setTimeout(() => { indicator.textContent = ''; indicator.className = ''; }, 2000);
        }
        // Refresh sidebar title
        Notes.refreshList();
    }

    function init() {
        const Font = Quill.import('formats/font');
        Font.whitelist = ['tajawal', 'ibmplexsans', 'monospace'];
        Quill.register(Font, true);

        const Size = Quill.import('attributors/style/size');
        Size.whitelist = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
        Quill.register(Size, true);

        quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'ابدأ الكتابة...',
            modules: {
                toolbar: false,
            },
        });

        // Wire manual toolbar buttons
        document.querySelectorAll('[data-format]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const fmt = btn.dataset.format;
                const val = btn.dataset.value || true;
                const current = quill.getFormat()[fmt];
                quill.format(fmt, current ? false : val, 'user');
                updateToolbarState();
            });
        });

        document.querySelectorAll('[data-align]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const align = btn.dataset.align;
                const current = quill.getFormat()['align'];
                quill.format('align', current === align ? false : align, 'user');
                updateToolbarState();
            });
        });

        document.getElementById('font-size-select')?.addEventListener('change', e => {
            quill.format('size', e.target.value || false, 'user');
        });

        document.getElementById('font-family-select')?.addEventListener('change', e => {
            quill.format('font', e.target.value || false, 'user');
        });

        // Title auto-save
        document.getElementById('note-title-input')?.addEventListener('input', scheduleSave);

        quill.on('text-change', (delta, old, source) => {
            if (source !== 'user') return;
            applyDirectionAtCursor();
            scheduleSave();
        });

        quill.on('selection-change', () => updateToolbarState());
    }

    function updateToolbarState() {
        if (!quill) return;
        const fmt = quill.getFormat();
        document.querySelectorAll('[data-format]').forEach(btn => {
            const f = btn.dataset.format;
            btn.classList.toggle('ql-active', !!fmt[f]);
        });
        document.querySelectorAll('[data-align]').forEach(btn => {
            btn.classList.toggle('ql-active', fmt.align === btn.dataset.align);
        });
        if (document.getElementById('font-size-select')) {
            document.getElementById('font-size-select').value = fmt.size || '';
        }
        if (document.getElementById('font-family-select')) {
            document.getElementById('font-family-select').value = fmt.font || '';
        }
    }

    function loadNote(noteId, note) {
        currentNoteId = noteId;
        document.getElementById('note-title-input').value = note.title || '';
        try {
            const delta = JSON.parse(note.content || 'null');
            if (delta) {
                quill.setContents(delta, 'silent');
            } else {
                quill.setText('', 'silent');
            }
        } catch {
            quill.setText(note.content || '', 'silent');
        }
        quill.setSelection(quill.getLength(), 0);
        updateToolbarState();
    }

    function clear() {
        currentNoteId = null;
        if (quill) quill.setText('', 'silent');
        const titleInput = document.getElementById('note-title-input');
        if (titleInput) titleInput.value = '';
    }

    function flushAndClear() {
        if (saveTimer) flushSave();
    }

    return { init, loadNote, clear, flushAndClear, getCurrentId: () => currentNoteId };
})();
