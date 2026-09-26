const Editor = (() => {
    let quill = null;
    let currentNoteId = null;
    let currentPinned = false;
    let currentUpdatedAt = null;   // Date of the last save, for the header row
    let dirty = false;            // unsaved edits since the last save started
    let saveTimer = null;
    let saveChain = Promise.resolve();   // saves run strictly one after another
    let blank = { creating: null };      // the current unsaved ("blank") note session
    let currentSelection = null;
    let selectedText = '';
    let colorRange = null;
    const SAVE_DELAY = 600;
    const MAX_IMAGE_DIM = 1920;
    const HIGHLIGHT = '#fde68a';

    // ─── Direction: auto RTL for Arabic paragraphs ─────────────────────────

    const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;

    function detectDirection(text) {
        const plain = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
        if (!plain.length) return null;
        const arabicCount = (plain.match(ARABIC_RE) || []).length;
        return arabicCount / plain.length > 0.4 ? 'rtl' : 'ltr';
    }

    function applyDirectionAtCursor() {
        const selection = quill.getSelection();
        if (!selection) return;
        const [line] = quill.getLine(selection.index);
        if (!line || !line.domNode) return;
        const dir = detectDirection(line.domNode.textContent || '');
        if (!dir) return;
        const lineIndex = quill.getIndex(line);
        const newDir = dir === 'rtl' ? 'rtl' : false;
        const currentDir = quill.getFormat(lineIndex, 0).direction || false;
        if (currentDir === newDir) return;
        quill.formatLine(lineIndex, 1, { direction: newDir }, 'silent');
    }

    // ─── Saving ────────────────────────────────────────────────────────────

    function setIndicator(state) {
        const el = document.getElementById('save-indicator');
        if (!el) return;
        clearTimeout(setIndicator._t);
        el.className = state || '';
        el.textContent = state ? I18n.t(state === 'error' ? 'save_failed' : state) : '';
        if (state === 'saved') setIndicator._t = setTimeout(() => setIndicator(null), 1800);
    }

    function snapshot() {
        const rawTitle = (document.getElementById('note-title-input')?.value || '').trim();
        return {
            rawTitle,
            content: JSON.stringify(quill.getContents()),
            plain: quill.getText().replace(/\n+$/, '').trim(),
        };
    }

    function scheduleSave() {
        dirty = true;
        clearTimeout(saveTimer);
        setIndicator('saving');
        saveTimer = setTimeout(flushSave, SAVE_DELAY);
    }

    /**
     * Persist the editor's current content. The note id and content are captured
     * synchronously, so switching notes while a save is in flight can never
     * write one note's text into another.
     */
    function flushSave() {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (!quill || !dirty) return saveChain;
        dirty = false;

        const snap = snapshot();
        const isNew = !currentNoteId;
        if (isNew && !snap.plain && !snap.rawTitle && !quill.getContents().ops.some(op => op.insert?.image)) {
            setIndicator(null);
            return saveChain;
        }

        // Resolve (or create) the id for *this* content right now. A blank note
        // gets exactly one create_note() per editing session, however many
        // saves fire while it is in flight.
        let idPromise;
        if (currentNoteId) {
            idPromise = Promise.resolve(currentNoteId);
        } else {
            const session = blank;
            if (!session.creating) {
                session.creating = window.pywebview.api.create_note();
                session.creating.then(id => {
                    // Adopt the id only if the user is still on this blank note.
                    if (blank === session && currentNoteId === null) {
                        currentNoteId = id;
                        Notes.setActive(id);
                    }
                }, () => {});
            }
            idPromise = session.creating;
        }

        saveChain = saveChain
            .catch(() => {})
            .then(async () => {
                const id = await idPromise;
                const ok = await window.pywebview.api.save_note(id, snap.rawTitle, snap.content, snap.plain);
                if (!ok) throw new Error('save rejected');
                if (!dirty) setIndicator('saved');
                if (id === currentNoteId || isNew) { currentUpdatedAt = new Date(); updateNoteDate(); }
                Notes.onNoteSaved(id, isNew);
            })
            .catch(err => {
                console.error(err);
                setIndicator('error');
            });
        return saveChain;
    }

    // ─── Stats ─────────────────────────────────────────────────────────────

    function updateStats() {
        const el = document.getElementById('word-count');
        if (!el) return;
        if (!quill || !currentNoteVisible()) { el.textContent = ''; return; }
        const text = quill.getText().trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const chars = text.replace(/\s/g, '').length;
        el.textContent = words
            ? I18n.t('stats', { w: words, c: chars, m: Math.max(1, Math.round(words / 200)) })
            : '';
    }

    function updateNoteDate() {
        const el = document.getElementById('note-date');
        if (!el) return;
        el.textContent = currentUpdatedAt
            ? I18n.t('edited_at', { t: currentUpdatedAt.toLocaleString(UI.locale(), { dateStyle: 'medium', timeStyle: 'short' }) })
            : '';
    }

    function currentNoteVisible() {
        return document.getElementById('editor-content')?.style.display === 'flex';
    }

    // ─── Floating selection toolbar ───────────────────────────────────────

    function showSelectionToolbar(range) {
        const toolbar = document.getElementById('selection-toolbar');
        if (!toolbar || !range || range.length === 0) { hideSelectionToolbar(); return; }
        try {
            const bounds = quill.getBounds(range.index, range.length);
            const editorRect = quill.container.getBoundingClientRect();
            toolbar.style.display = 'flex';
            const toolbarW = toolbar.offsetWidth || 320;
            let x = editorRect.left + bounds.left + bounds.width / 2 - toolbarW / 2;
            let y = editorRect.top + bounds.top - 50;
            if (y < 10) y = editorRect.top + bounds.bottom + 10;
            x = Math.max(10, Math.min(x, window.innerWidth - toolbarW - 10));
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

    // ─── Images ────────────────────────────────────────────────────────────

    // Downscale very large images before embedding: notes stay fast and small.
    function shrinkImage(dataUrl) {
        return new Promise(resolve => {
            if (!/^data:image\/(png|jpeg|webp|bmp)/.test(dataUrl)) return resolve(dataUrl);
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
                if (scale >= 1 && dataUrl.length < 1.5e6) return resolve(dataUrl);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                const isPng = dataUrl.startsWith('data:image/png');
                const out = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88);
                // PNG screenshots can grow when re-encoded; keep whichever is smaller.
                resolve(out.length < dataUrl.length ? out : dataUrl);
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    async function insertImage(dataUrl) {
        const src = await shrinkImage(dataUrl);
        const range = quill.getSelection(true) || { index: quill.getLength() };
        quill.insertEmbed(range.index, 'image', src, 'user');
        quill.setSelection(range.index + 1, 0, 'silent');
    }

    // ─── Context menu (native one is disabled in the packaged app) ────────

    function closeContextMenu() {
        document.getElementById('spell-context-menu')?.remove();
    }

    function wordRangeAt(x, y) {
        const caret = document.caretRangeFromPoint?.(x, y);
        if (!caret || !quill.root.contains(caret.startContainer)) return null;
        const node = caret.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return null;
        const text = node.textContent;
        let start = caret.startOffset, end = caret.startOffset;
        const isWordChar = ch => /[\p{L}\p{M}\p{N}'’-]/u.test(ch);
        while (start > 0 && isWordChar(text[start - 1])) start--;
        while (end < text.length && isWordChar(text[end])) end++;
        if (start === end) return null;
        const blot = Quill.find(node, true);
        if (!blot) return null;
        const index = blot.offset(quill.scroll) + start;
        return { index, length: end - start, word: text.slice(start, end) };
    }

    function openContextMenu(e) {
        e.preventDefault();
        closeContextMenu();
        hideSelectionToolbar();

        const sel = quill.getSelection(true);
        const hasSelection = sel && sel.length > 0;
        const wordInfo = hasSelection ? null : wordRangeAt(e.clientX, e.clientY);

        const menu = document.createElement('div');
        menu.id = 'spell-context-menu';
        const items = [];
        if (wordInfo) items.push(`<div class="ctx-word">${UI.esc(wordInfo.word)}</div>`);
        if (hasSelection) {
            items.push(`<button class="ctx-item" data-act="cut">${UI.esc(I18n.t('cut'))}<kbd>Ctrl+X</kbd></button>`);
            items.push(`<button class="ctx-item" data-act="copy">${UI.esc(I18n.t('copy'))}<kbd>Ctrl+C</kbd></button>`);
        }
        items.push(`<button class="ctx-item" data-act="paste">${UI.esc(I18n.t('paste'))}<kbd>Ctrl+V</kbd></button>`);
        items.push(`<button class="ctx-item" data-act="selectall">${UI.esc(I18n.t('select_all'))}<kbd>Ctrl+A</kbd></button>`);
        if (wordInfo || hasSelection) {
            items.push('<div class="ctx-sep"></div>');
            items.push(`<button class="ctx-item" data-act="ignore">${UI.esc(I18n.t('ignore_spell'))}</button>`);
        }
        menu.innerHTML = items.join('');
        document.body.appendChild(menu);

        const rect = menu.getBoundingClientRect();
        menu.style.left = Math.min(e.clientX, window.innerWidth  - rect.width  - 8) + 'px';
        menu.style.top  = Math.min(e.clientY, window.innerHeight - rect.height - 8) + 'px';

        menu.addEventListener('mousedown', ev => ev.preventDefault());
        menu.addEventListener('click', async ev => {
            const act = ev.target.closest('[data-act]')?.dataset.act;
            if (!act) return;
            closeContextMenu();
            if (act === 'cut' || act === 'copy') {
                const text = quill.getText(sel.index, sel.length);
                try { await navigator.clipboard.writeText(text); } catch { document.execCommand('copy'); }
                if (act === 'cut') quill.deleteText(sel.index, sel.length, 'user');
            } else if (act === 'paste') {
                await pasteFromClipboard(sel);
            } else if (act === 'selectall') {
                quill.setSelection(0, quill.getLength(), 'user');
            } else if (act === 'ignore') {
                const r = hasSelection ? sel : wordInfo;
                quill.formatText(r.index, r.length, 'no-spell', true, 'user');
            }
        });
    }

    async function pasteFromClipboard(sel) {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            const range = sel || quill.getSelection(true);
            if (range.length > 0) quill.deleteText(range.index, range.length, 'user');
            quill.insertText(range.index, text, 'user');
            quill.setSelection(range.index + text.length, 0, 'user');
        } catch {
            document.execCommand('paste');
        }
    }

    // ─── Formatting helpers ───────────────────────────────────────────────

    function coerce(val) {
        return /^\d+$/.test(val) ? Number(val) : val;
    }

    function toggleFormat(fmt, rawVal) {
        const val = rawVal === undefined ? true : coerce(rawVal);
        const current = quill.getFormat()[fmt];
        if (fmt === 'list' && val === 'unchecked') {
            // Checklist button toggles both checked and unchecked items off
            quill.format('list', current === 'checked' || current === 'unchecked' ? false : 'unchecked', 'user');
        } else if (rawVal !== undefined) {
            quill.format(fmt, current === val ? false : val, 'user');
        } else {
            quill.format(fmt, !current, 'user');
        }
        updateToolbarState();
    }

    // ─── Init ──────────────────────────────────────────────────────────────

    function registerFormats() {
        Blocks.register();
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

        // Allow an explicit "left" so Arabic (RTL) lines can be left-aligned too
        const Align = Quill.import('attributors/class/align');
        if (!Align.whitelist.includes('left')) Align.whitelist.push('left');
        Quill.register(Align, true);

        const Size = Quill.import('attributors/style/size');
        Size.whitelist = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
        Quill.register(Size, true);
    }

    function init() {
        registerFormats();

        quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: I18n.t('editor_placeholder'),
            modules: {
                toolbar: false,
                table: true,
                history: { delay: 800, maxStack: 300, userOnly: true },
                keyboard: { bindings: Blocks.markdownBindings() },
            },
        });

        Blocks.attach(quill);
        Find.attach(quill);

        // Native spellcheck (Quill disables it by default)
        quill.root.setAttribute('spellcheck', 'true');
        quill.root.setAttribute('dir', 'auto');

        // ── Toolbar: formats ──
        document.querySelectorAll('[data-format]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                toggleFormat(btn.dataset.format, btn.dataset.value);
            });
        });

        // ── Toolbar: alignment. A line's natural side (left for LTR, right for
        //    RTL) is stored as "no align" so it follows the text direction. ──
        document.querySelectorAll('[data-align]').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                const a = btn.dataset.align;
                const natural = quill.getFormat().direction === 'rtl' ? 'right' : 'left';
                quill.format('align', a === natural ? false : a, 'user');
                updateToolbarState();
            });
        });

        // ── Undo / redo ──
        document.getElementById('btn-undo')?.addEventListener('mousedown', e => { e.preventDefault(); quill.history.undo(); });
        document.getElementById('btn-redo')?.addEventListener('mousedown', e => { e.preventDefault(); quill.history.redo(); });

        // ── Font size / family ──
        document.getElementById('font-size-select')?.addEventListener('change', e => {
            quill.format('size', e.target.value || false, 'user');
            quill.focus();
        });
        document.getElementById('font-family-select')?.addEventListener('change', e => {
            quill.format('font', e.target.value || false, 'user');
            quill.focus();
        });

        // ── Text colour ──
        const colorBtn   = document.getElementById('btn-text-color');
        const colorInput = document.getElementById('color-picker-input');
        const colorBar   = document.getElementById('color-btn-bar');
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

        // ── Highlight ──
        document.getElementById('btn-highlight')?.addEventListener('mousedown', e => {
            e.preventDefault();
            const cur = quill.getFormat().background;
            quill.format('background', cur ? false : HIGHLIGHT, 'user');
            updateToolbarState();
        });

        // ── Clear formatting ──
        document.getElementById('btn-clear-format')?.addEventListener('mousedown', e => {
            e.preventDefault();
            const r = quill.getSelection();
            if (!r) return;
            if (r.length) quill.removeFormat(r.index, r.length, 'user');
            else {
                const [line, offset] = quill.getLine(r.index);
                const start = r.index - offset;
                quill.removeFormat(start, line.length(), 'user');
            }
            updateToolbarState();
        });

        // ── Table / drawing / find ──
        document.getElementById('btn-insert-table')?.addEventListener('mousedown', e => {
            e.preventDefault();
            quill.focus();
            quill.getModule('table')?.insertTable(3, 3);
        });
        document.getElementById('btn-draw')?.addEventListener('click', () => Drawing.open());

        // ── Insert image via file picker ──
        document.getElementById('btn-insert-image')?.addEventListener('click', async () => {
            const result = await window.pywebview.api.pick_image();
            if (result && result.error === 'too_large') { UI.toast(I18n.t('image_too_large'), { kind: 'error' }); return; }
            if (typeof result === 'string') await insertImage(result);
        });

        // ── Paste / drop images ──
        quill.root.addEventListener('paste', e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const reader = new FileReader();
                    reader.onload = ev => insertImage(ev.target.result);
                    reader.readAsDataURL(item.getAsFile());
                    break;
                }
            }
        }, true);
        quill.root.addEventListener('drop', e => {
            const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'));
            if (!files.length) return;
            e.preventDefault();
            e.stopPropagation();
            files.forEach(f => {
                const reader = new FileReader();
                reader.onload = ev => insertImage(ev.target.result);
                reader.readAsDataURL(f);
            });
        }, true);

        // ── Title ──
        const titleEl = document.getElementById('note-title-input');
        titleEl?.addEventListener('input', scheduleSave);
        titleEl?.addEventListener('keydown', e => {
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) {
                e.preventDefault();
                quill.focus();
                quill.setSelection(0, 0, 'user');
            }
        });

        // ── Content changes ──
        quill.on('text-change', (delta, old, source) => {
            if (source !== 'user') return;
            applyDirectionAtCursor();
            scheduleSave();
            updateStats();
        });

        // ── Selection changes → floating toolbar ──
        quill.on('selection-change', range => {
            currentSelection = range;
            if (range && range.length > 0) {
                selectedText = quill.getText(range.index, range.length);
                showSelectionToolbar(range);
            } else {
                selectedText = '';
                hideSelectionToolbar();
            }
            if (range) updateToolbarState();
        });
        quill.root.addEventListener('scroll', hideSelectionToolbar);

        // ── Selection toolbar actions ──
        const selToolbar = document.getElementById('selection-toolbar');
        selToolbar?.addEventListener('mousedown', e => e.preventDefault());

        document.getElementById('sel-copy')?.addEventListener('click', async () => {
            if (!selectedText) return;
            try { await navigator.clipboard.writeText(selectedText); } catch { document.execCommand('copy'); }
            hideSelectionToolbar();
            UI.toast(I18n.t('copy') + ' ✓');
        });
        document.getElementById('sel-paste')?.addEventListener('click', async () => {
            await pasteFromClipboard(quill.getSelection() || currentSelection);
            hideSelectionToolbar();
        });
        document.getElementById('sel-translate')?.addEventListener('click', () => {
            if (!selectedText.trim()) return;
            window.pywebview.api.open_url(`https://translate.google.com/?sl=auto&text=${encodeURIComponent(selectedText.trim())}&op=translate`);
            hideSelectionToolbar();
        });
        document.getElementById('sel-search')?.addEventListener('click', () => {
            if (!selectedText.trim()) return;
            window.pywebview.api.open_url(`https://www.google.com/search?q=${encodeURIComponent(selectedText.trim())}`);
            hideSelectionToolbar();
        });
        document.getElementById('sel-ignore-spell')?.addEventListener('click', () => {
            if (!currentSelection || !currentSelection.length) return;
            quill.formatText(currentSelection.index, currentSelection.length, 'no-spell', true, 'user');
            hideSelectionToolbar();
        });

        // Close popups when clicking elsewhere
        document.addEventListener('mousedown', e => {
            if (!e.target.closest('#selection-toolbar') && !e.target.closest('.ql-editor')) hideSelectionToolbar();
            if (!e.target.closest('#spell-context-menu')) closeContextMenu();
        });
        window.addEventListener('blur', () => { closeContextMenu(); flushSave(); });
        window.addEventListener('resize', () => { closeContextMenu(); hideSelectionToolbar(); });

        quill.root.addEventListener('contextmenu', openContextMenu);

        // ── Note-level actions ──
        document.getElementById('btn-pin-note')?.addEventListener('click', togglePin);
        document.getElementById('btn-export-note')?.addEventListener('click', exportNote);
        document.getElementById('btn-email-note')?.addEventListener('click', emailNote);
        document.getElementById('btn-print-note')?.addEventListener('click', async () => {
            await flushSave();
            window.print();
        });
        document.getElementById('btn-delete-note')?.addEventListener('click', async () => {
            await flushSave();
            if (currentNoteId) Notes.trashNote(currentNoteId);
            else Notes.showNoNoteSelected();
        });
    }

    // ─── Toolbar state sync ───────────────────────────────────────────────

    function updateToolbarState() {
        if (!quill) return;
        const fmt = quill.getFormat();

        document.querySelectorAll('[data-format]').forEach(btn => {
            const f = btn.dataset.format;
            const v = btn.dataset.value;
            let on;
            if (f === 'list' && v === 'unchecked') on = fmt.list === 'checked' || fmt.list === 'unchecked';
            else on = v !== undefined ? fmt[f] === coerce(v) : !!fmt[f];
            btn.classList.toggle('ql-active', on);
        });

        const activeAlign = fmt.align || (fmt.direction === 'rtl' ? 'right' : 'left');
        document.querySelectorAll('[data-align]').forEach(btn => {
            btn.classList.toggle('ql-active', activeAlign === btn.dataset.align);
        });

        document.getElementById('btn-highlight')?.classList.toggle('ql-active', !!fmt.background);

        const sizeEl = document.getElementById('font-size-select');
        if (sizeEl) sizeEl.value = fmt.size || '';
        const fontEl = document.getElementById('font-family-select');
        if (fontEl) fontEl.value = fmt.font || '';
    }

    function updatePinButton() {
        const btn = document.getElementById('btn-pin-note');
        if (!btn) return;
        btn.classList.toggle('ql-active', !!currentPinned);
        btn.title = I18n.t(currentPinned ? 'unpin' : 'pin');
    }

    // ─── Note-level actions ───────────────────────────────────────────────

    async function togglePin() {
        await flushSave();
        if (!currentNoteId) return;
        currentPinned = await window.pywebview.api.set_pinned(currentNoteId, !currentPinned);
        updatePinButton();
        UI.toast(I18n.t(currentPinned ? 'note_pinned' : 'note_unpinned'));
        await Notes.refreshList();
    }

    async function exportNote() {
        await flushSave();
        const title = (document.getElementById('note-title-input')?.value || '').trim() || I18n.t('new_note_title');
        const text = quill.getText();
        const html = quill.getSemanticHTML();
        const res = await window.pywebview.api.export_note(title, title + '\n\n' + text, html);
        if (res?.ok) UI.toast(I18n.t('exported'), { kind: 'success' });
        else if (res && !res.cancelled) UI.toast(I18n.t('error_generic', { e: res.error || '' }), { kind: 'error' });
    }

    function emailNote() {
        const title = (document.getElementById('note-title-input')?.value || '').trim() || I18n.t('new_note_title');
        // mailto links are length-limited, so long notes are trimmed
        let body = quill.getText().trim();
        if (body.length > 1800) body = body.slice(0, 1800) + '…';
        window.pywebview.api.open_url(
            `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`);
    }

    // ─── Note lifecycle ───────────────────────────────────────────────────

    function showEditor() {
        document.getElementById('no-note-selected').style.display = 'none';
        document.getElementById('editor-content').style.display   = 'flex';
        document.getElementById('trash-panel').style.display      = 'none';
    }

    function resetView() {
        Blocks.closeMenu();
        Find.hide();
        document.getElementById('table-toolbar').style.display = 'none';
        dirty = false;
        blank = { creating: null };
        hideSelectionToolbar();
        closeContextMenu();
        setIndicator(null);
    }

    function openBlankNote(opts = {}) {
        flushSave();
        resetView();
        currentNoteId = null;
        currentPinned = false;
        currentUpdatedAt = null;
        updateNoteDate();
        document.getElementById('note-title-input').value = '';
        quill.setText('', 'silent');
        quill.history.clear();
        showEditor();
        updatePinButton();
        updateToolbarState();
        updateStats();
        if (opts.block) {
            // Quick-create from the home screen: start the note with that block
            setTimeout(() => {
                quill.focus();
                quill.setSelection(0, 0, 'silent');
                Blocks.run(opts.block);
            }, 60);
        } else {
            setTimeout(() => document.getElementById('note-title-input')?.focus(), 50);
        }
    }

    function loadNote(noteId, note) {
        resetView();
        currentNoteId = noteId;
        currentPinned = !!note.is_pinned;
        currentUpdatedAt = UI.parseDbDate(note.updated_at);
        updateNoteDate();
        const titleEl = document.getElementById('note-title-input');
        // Old versions stored a localized "New Note" as the title — show the placeholder instead
        titleEl.value = Notes.isDefaultTitle(note.title) ? '' : (note.title || '');
        try {
            const delta = JSON.parse(note.content || 'null');
            if (delta) quill.setContents(delta, 'silent');
            else quill.setText('', 'silent');
        } catch {
            quill.setText(note.content || '', 'silent');
        }
        quill.history.clear();
        showEditor();
        quill.setSelection(quill.getLength(), 0, 'silent');
        quill.focus();
        updatePinButton();
        updateToolbarState();
        updateStats();
    }

    function clear() {
        resetView();
        currentNoteId = null;
        currentPinned = false;
        currentUpdatedAt = null;
        if (quill) {
            quill.setText('', 'silent');
            quill.history.clear();
        }
        const titleEl = document.getElementById('note-title-input');
        if (titleEl) titleEl.value = '';
        updateStats();
    }

    function setPinnedExternally(id, pinned) {
        if (id === currentNoteId) { currentPinned = pinned; updatePinButton(); }
    }

    return {
        init, loadNote, clear, openBlankNote, flushSave, setPinnedExternally,
        updateStats: () => { updateStats(); updateNoteDate(); },
        insertImage,
        isVisible: currentNoteVisible,
        getCurrentId: () => currentNoteId,
        focus: () => quill?.focus(),
    };
})();
