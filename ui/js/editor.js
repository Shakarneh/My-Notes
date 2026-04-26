const Editor = (() => {
    let quill = null;
    let currentNoteId = null;
    let saveTimer = null;
    let currentSelection = null;
    let selectedText = '';
    let colorRange = null;
    const SAVE_DELAY = 800;

    // Detect Arabic to auto-apply RTL direction
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
        if (indicator) { indicator.textContent = I18n.t('saving'); indicator.className = 'saving'; }
        saveTimer = setTimeout(() => flushSave(), SAVE_DELAY);
    }

    async function flushSave() {
        clearTimeout(saveTimer);
        saveTimer = null;

        const titleEl = document.getElementById('note-title-input');
        const rawTitle = (titleEl?.value || '').trim();
        const title = rawTitle || I18n.t('new_note_title');
        const content = JSON.stringify(quill.getContents());
        const contentPlain = quill.getText().trim();

        // Don't create or save a completely empty unsaved note
        if (!currentNoteId && !contentPlain && !rawTitle) return;

        // First type on a blank note: create it in DB and show in sidebar
        if (!currentNoteId) {
            currentNoteId = await window.pywebview.api.create_note();
            await Notes.refreshList();
        }

        await window.pywebview.api.save_note(currentNoteId, title, content, contentPlain);

        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.textContent = I18n.t('saved');
            indicator.className = 'saved';
            setTimeout(() => { indicator.textContent = ''; indicator.className = ''; }, 2000);
        }
        Notes.refreshList();
        updateWordCount();
    }

    function updateWordCount() {
        const text = quill?.getText() || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const el = document.getElementById('word-count');
        if (el) el.textContent = words > 0 ? I18n.t('word_count', { n: words }) : '';
    }

    // ─── Floating selection toolbar ──────────────────────────────────────────

    function showSelectionToolbar(range) {
        const toolbar = document.getElementById('selection-toolbar');
        if (!toolbar || !range || range.length === 0) { hideSelectionToolbar(); return; }
        try {
            const bounds = quill.getBounds(range.index, range.length);
            const editorEl = document.getElementById('editor');
            const editorRect = editorEl.getBoundingClientRect();

            toolbar.style.display = 'flex';
            const toolbarW = toolbar.offsetWidth || 320;
            let x = editorRect.left + bounds.left + bounds.width / 2 - toolbarW / 2;
            let y = editorRect.top + bounds.top - 54;

            x = Math.max(10, Math.min(x, window.innerWidth - toolbarW - 10));
            y = Math.max(10, y);

            toolbar.style.left = x + 'px';
            toolbar.style.top  = y + 'px';
        } catch {
            hideSelectionToolbar();
        }
    }

    function hideSelectionToolbar() {
        const toolbar = document.getElementById('selection-toolbar');
        if (toolbar) toolbar.style.display = 'none';
    }

    // ─── Init ────────────────────────────────────────────────────────────────

    function init() {
        // Register custom no-spell blot so user can silence red underlines
        try {
            const Inline = Quill.import('blots/inline');
            class NoSpellBlot extends Inline {
                static create(value) {
                    const node = super.create(value);
                    node.setAttribute('spellcheck', 'false');
                    return node;
                }
                static formats() { return true; }
            }
            NoSpellBlot.blotName = 'no-spell';
            NoSpellBlot.tagName = 'span';
            NoSpellBlot.className = 'no-spell';
            Quill.register(NoSpellBlot, true);
        } catch {}

        const Font = Quill.import('formats/font');
        Font.whitelist = ['tajawal', 'ibmplexsans', 'monospace'];
        Quill.register(Font, true);

        const Size = Quill.import('attributors/style/size');
        Size.whitelist = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
        Quill.register(Size, true);

        quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: I18n.t('editor_placeholder'),
            modules: { toolbar: false },
        });

        // Enable native browser spellcheck (Quill disables it by default)
        const qlEditor = document.querySelector('.ql-editor');
        if (qlEditor) qlEditor.setAttribute('spellcheck', 'true');

        // ── Format buttons (bold / italic / etc.) ──
        document.querySelectorAll('[data-format]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const fmt = btn.dataset.format;
                const val = btn.dataset.value || true;
                const current = quill.getFormat()[fmt];
                if (fmt === 'list') {
                    quill.format(fmt, current === val ? false : val, 'user');
                } else {
                    quill.format(fmt, current ? false : val, 'user');
                }
                updateToolbarState();
            });
        });

        // ── Alignment buttons ──
        // 'left' → remove align format in Quill (default); 'center'/'right' → set directly
        document.querySelectorAll('[data-align]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const alignAttr = btn.dataset.align;
                const quillAlign = alignAttr === 'left' ? false : alignAttr;
                quill.format('align', quillAlign, 'user');
                updateToolbarState();
            });
        });

        // ── Font size / family ──
        document.getElementById('font-size-select')?.addEventListener('change', e => {
            quill.format('size', e.target.value || false, 'user');
        });
        document.getElementById('font-family-select')?.addEventListener('change', e => {
            quill.format('font', e.target.value || false, 'user');
        });

        // ── Text color ──
        const colorBtn  = document.getElementById('btn-text-color');
        const colorInput = document.getElementById('color-picker-input');
        const colorBar  = document.getElementById('color-btn-bar');

        colorBtn?.addEventListener('mousedown', e => {
            e.preventDefault();
            colorRange = quill.getSelection();
        });
        colorBtn?.addEventListener('click', () => colorInput?.click());
        colorInput?.addEventListener('change', e => {
            const color = e.target.value;
            if (colorRange) quill.setSelection(colorRange, 'silent');
            quill.format('color', color, 'user');
            if (colorBar) colorBar.style.background = color;
            colorRange = null;
        });

        // ── Insert image via file picker ──
        document.getElementById('btn-insert-image')?.addEventListener('click', async () => {
            const dataUrl = await window.pywebview.api.pick_image();
            if (dataUrl) {
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', dataUrl, 'user');
                quill.setSelection(range.index + 1, 0, 'silent');
                scheduleSave();
            }
        });

        // ── Paste screenshot from clipboard ──
        const qlEditorEl = document.querySelector('#editor .ql-editor');
        if (qlEditorEl) {
            qlEditorEl.addEventListener('paste', e => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                    if (item.type.startsWith('image/')) {
                        e.preventDefault();
                        const blob = item.getAsFile();
                        const reader = new FileReader();
                        reader.onload = ev => {
                            const range = quill.getSelection(true);
                            quill.insertEmbed(range.index, 'image', ev.target.result, 'user');
                            quill.setSelection(range.index + 1, 0, 'silent');
                            scheduleSave();
                        };
                        reader.readAsDataURL(blob);
                        break;
                    }
                }
            });
        }

        // ── Title triggers save ──
        document.getElementById('note-title-input')?.addEventListener('input', scheduleSave);

        // ── Content changes ──
        quill.on('text-change', (delta, old, source) => {
            if (source !== 'user') return;
            applyDirectionAtCursor();
            scheduleSave();
            updateWordCount();
        });

        // ── Selection changes → show/hide floating toolbar ──
        quill.on('selection-change', (range) => {
            currentSelection = range;
            if (range && range.length > 0) {
                selectedText = quill.getText(range.index, range.length);
                showSelectionToolbar(range);
            } else {
                selectedText = '';
                hideSelectionToolbar();
            }
            updateToolbarState();
        });

        // ── Selection toolbar actions ──
        document.getElementById('sel-copy')?.addEventListener('click', async () => {
            if (!selectedText) return;
            try { await navigator.clipboard.writeText(selectedText); } catch { document.execCommand('copy'); }
            hideSelectionToolbar();
        });

        document.getElementById('sel-paste')?.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    const sel = quill.getSelection() || currentSelection;
                    if (sel) {
                        if (sel.length > 0) quill.deleteText(sel.index, sel.length, 'user');
                        quill.insertText(sel.index, text, 'user');
                    }
                }
            } catch { document.execCommand('paste'); }
            hideSelectionToolbar();
        });

        document.getElementById('sel-translate')?.addEventListener('click', () => {
            if (!selectedText?.trim()) return;
            const encoded = encodeURIComponent(selectedText.trim());
            window.pywebview.api.open_url(`https://translate.google.com/?text=${encoded}&op=translate`);
            hideSelectionToolbar();
        });

        document.getElementById('sel-search')?.addEventListener('click', () => {
            if (!selectedText?.trim()) return;
            const encoded = encodeURIComponent(selectedText.trim());
            window.pywebview.api.open_url(`https://www.google.com/search?q=${encoded}`);
            hideSelectionToolbar();
        });

        document.getElementById('sel-ignore-spell')?.addEventListener('click', () => {
            if (!currentSelection || !currentSelection.length) return;
            quill.formatText(currentSelection.index, currentSelection.length, 'no-spell', true, 'user');
            hideSelectionToolbar();
        });

        // Hide selection toolbar when clicking outside it
        document.addEventListener('mousedown', e => {
            if (!e.target.closest('#selection-toolbar')) hideSelectionToolbar();
        });
    }

    // ─── Toolbar state sync ───────────────────────────────────────────────────

    function updateToolbarState() {
        if (!quill) return;
        const fmt = quill.getFormat();

        document.querySelectorAll('[data-format]').forEach(btn => {
            const f = btn.dataset.format;
            const v = btn.dataset.value;
            btn.classList.toggle('ql-active', v ? fmt[f] === v : !!fmt[f]);
        });

        // Alignment: when no align is set, Quill defaults to left
        document.querySelectorAll('[data-align]').forEach(btn => {
            const activeAlign = fmt.align || 'left';
            btn.classList.toggle('ql-active', activeAlign === btn.dataset.align);
        });

        const sizeEl = document.getElementById('font-size-select');
        if (sizeEl) sizeEl.value = fmt.size || '';

        const fontEl = document.getElementById('font-family-select');
        if (fontEl) fontEl.value = fmt.font || '';
    }

    // ─── Note lifecycle ───────────────────────────────────────────────────────

    function openBlankNote() {
        // Flush any pending save for the previous note before clearing
        if (saveTimer && currentNoteId) flushSave();
        currentNoteId = null;
        const titleEl = document.getElementById('note-title-input');
        if (titleEl) titleEl.value = '';
        if (quill) quill.setText('', 'silent');
        document.getElementById('no-note-selected').style.display  = 'none';
        document.getElementById('editor-content').style.display    = 'flex';
        document.getElementById('trash-panel').style.display       = 'none';
        updateToolbarState();
        updateWordCount();
        setTimeout(() => quill?.focus(), 80);
    }

    function loadNote(noteId, note) {
        currentNoteId = noteId;
        const titleEl = document.getElementById('note-title-input');
        if (titleEl) {
            // Don't display any old-style default titles — show placeholder instead
            const defaultTitles = ['ملاحظة جديدة', 'New Note', 'Новая заметка'];
            titleEl.value = defaultTitles.includes(note.title) ? '' : (note.title || '');
        }
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
        updateWordCount();
    }

    function clear() {
        currentNoteId = null;
        if (quill) quill.setText('', 'silent');
        const titleEl = document.getElementById('note-title-input');
        if (titleEl) titleEl.value = '';
        updateWordCount();
    }

    function flushAndClear() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
            flushSave().catch(() => {});
        }
    }

    return { init, loadNote, clear, flushAndClear, openBlankNote, getCurrentId: () => currentNoteId };
})();
