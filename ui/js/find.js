// Find & replace inside the open note (Ctrl+H), plus auto-detected links.
const Find = (() => {
    let quill = null;
    let matches = [];
    let current = -1;

    I18n.extend({
        ar: { find_ph: 'بحث في الملاحظة', replace_ph: 'استبدال بـ', find_replace: 'بحث واستبدال (Ctrl+H)', replace_one: 'استبدال', replace_all: 'استبدال الكل', find_none: 'لا نتائج', replaced_n: 'تم استبدال {n}', link_hint: 'Ctrl + نقرة لفتح الرابط' },
        en: { find_ph: 'Find in note', replace_ph: 'Replace with', find_replace: 'Find & replace (Ctrl+H)', replace_one: 'Replace', replace_all: 'Replace all', find_none: 'No results', replaced_n: '{n} replaced', link_hint: 'Ctrl + click to open' },
        ru: { find_ph: 'Найти в заметке', replace_ph: 'Заменить на', find_replace: 'Найти и заменить (Ctrl+H)', replace_one: 'Заменить', replace_all: 'Заменить все', find_none: 'Нет совпадений', replaced_n: 'Заменено: {n}', link_hint: 'Ctrl + клик, чтобы открыть' },
    });

    const $ = id => document.getElementById(id);

    // Case-insensitive; Arabic diacritics ignored so "مدرسة" finds "مَدْرَسَة"
    const DIACRITIC = /[ؐ-ًؚ-ٰٟـ]/;

    // The note's text with every embed (image, drawing, divider) counted as one
    // character, so positions line up exactly with Quill's own indexes.
    // (quill.getText() drops embeds, which shifted every match after an image.)
    function indexedText() {
        return quill.getContents().ops
            .map(op => (typeof op.insert === 'string' ? op.insert : '\uFFFC'))
            .join('');
    }

    function search() {
        const q = $('find-input').value;
        matches = [];
        if (q) {
            const text = indexedText();
            // Build a normalized copy while remembering each char's original index
            let norm = '';
            const map = [];
            for (let i = 0; i < text.length; i++) {
                if (DIACRITIC.test(text[i])) continue;
                norm += text[i].toLowerCase();
                map.push(i);
            }
            map.push(text.length);
            const needle = [...q].filter(ch => !DIACRITIC.test(ch)).join('').toLowerCase();
            if (needle) {
                let at = norm.indexOf(needle);
                while (at !== -1) {
                    const start = map[at];
                    const end = map[at + needle.length - 1] + 1;
                    matches.push({ index: start, length: end - start });
                    at = norm.indexOf(needle, at + needle.length);
                }
            }
        }
        if (current >= matches.length) current = matches.length - 1;
        if (current < 0 && matches.length) current = 0;
        updateCount();
    }

    // Highlight matches with the CSS Custom Highlight API: nothing in the note
    // changes and keyboard focus stays in the find box.
    function domPoint(index) {
        const [leaf, offset] = quill.getLeaf(index);
        if (!leaf || !leaf.domNode || leaf.domNode.nodeType !== Node.TEXT_NODE) return null;
        return [leaf.domNode, offset];
    }

    function toRange(m) {
        const a = domPoint(m.index);
        const b = domPoint(m.index + m.length);
        if (!a || !b) return null;
        try {
            const r = new Range();
            r.setStart(a[0], a[1]);
            r.setEnd(b[0], b[1]);
            return r;
        } catch {
            return null;
        }
    }

    function paintHighlights() {
        if (!window.CSS?.highlights) return;
        CSS.highlights.delete('find-match');
        CSS.highlights.delete('find-current');
        if (!isOpen()) return;
        const others = [], cur = [];
        matches.forEach((m, i) => {
            const r = toRange(m);
            if (r) (i === current ? cur : others).push(r);
        });
        if (others.length) CSS.highlights.set('find-match', new Highlight(...others));
        if (cur.length) CSS.highlights.set('find-current', new Highlight(...cur));
    }

    function updateCount() {
        const el = $('find-count');
        el.textContent = matches.length ? `${current + 1}/${matches.length}` : ($('find-input').value ? I18n.t('find_none') : '');
        el.classList.toggle('none', !matches.length && !!$('find-input').value);
    }

    // Show the current match: highlight + scroll. Never calls quill.setSelection,
    // which would move focus into the note and let typing overwrite its text.
    function select() {
        updateCount();
        paintHighlights();
        if (current < 0 || !matches[current]) return;
        const m = matches[current];
        try {
            const b = quill.getBounds(m.index, m.length);
            const root = quill.root;
            if (b && (b.top < 0 || b.bottom > root.clientHeight)) root.scrollTop += b.top - root.clientHeight / 3;
        } catch {}
    }

    function step(dir) {
        search();
        if (!matches.length) return;
        current = (current + dir + matches.length) % matches.length;
        select();
    }

    function replaceOne() {
        search();
        if (current < 0 || !matches[current]) return;
        const m = matches[current];
        const formats = quill.getFormat(m.index, 1);
        const rep = $('replace-input').value;
        quill.deleteText(m.index, m.length, 'user');
        quill.insertText(m.index, rep, formats, 'user');
        search();
        if (matches.length) {
            // continue from the next match after the replaced one
            const next = matches.findIndex(x => x.index >= m.index + rep.length);
            current = next === -1 ? 0 : next;
            select();
        }
    }

    function replaceAll() {
        search();
        if (!matches.length) return;
        const rep = $('replace-input').value;
        const n = matches.length;
        // Replace back-to-front so earlier indexes stay valid
        for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            const formats = quill.getFormat(m.index, 1);
            quill.deleteText(m.index, m.length, 'user');
            quill.insertText(m.index, rep, formats, 'user');
        }
        search();
        select();
        UI.toast(I18n.t('replaced_n', { n }), { kind: 'success' });
    }

    function open(withReplace) {
        const bar = $('find-bar');
        bar.classList.add('open');
        bar.classList.toggle('with-replace', !!withReplace);
        const sel = quill.getSelection();
        if (sel && sel.length && sel.length < 80) $('find-input').value = quill.getText(sel.index, sel.length);
        $('find-input').focus();
        $('find-input').select();
        current = -1;
        search();
        select();
    }

    function close() {
        const m = matches[current];
        $('find-bar').classList.remove('open');
        matches = [];
        current = -1;
        paintHighlights();
        // Leave the cursor on the match the user was looking at
        if (m) quill.setSelection(m.index, m.length, 'user');
        else quill.focus();
    }

    // Called when the note changes underneath an open find bar (typing, switching notes)
    function refresh() {
        if (!isOpen()) return;
        search();
        paintHighlights();
    }

    function isOpen() {
        return $('find-bar')?.classList.contains('open');
    }

    // ─── Auto links (URLs and e-mail addresses) ───────────────────────────

    const URL_RE = /^(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+)$/i;
    const EMAIL_RE = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;

    function autoLink(delta, old, source) {
        if (source !== 'user') return;
        const last = delta.ops[delta.ops.length - 1];
        if (!last || typeof last.insert !== 'string' || !/^[\s]$/.test(last.insert)) return;
        const sel = quill.getSelection();
        if (!sel) return;
        const end = sel.index - 1;
        const [line, offset] = quill.getLine(end);
        if (!line) return;
        const lineStart = end - offset;
        const before = quill.getText(lineStart, offset);
        const m = before.match(/(\S+)$/);
        if (!m) return;
        let word = m[1].replace(/[.,;:!?)\]]+$/, '');
        const start = end - m[1].length;
        if (quill.getFormat(start, word.length).link || quill.getFormat(start, 1)['code-block']) return;
        let href = null;
        if (URL_RE.test(word)) href = /^www\./i.test(word) ? 'https://' + word : word;
        else if (EMAIL_RE.test(word)) href = 'mailto:' + word;
        if (href) quill.formatText(start, word.length, 'link', href, 'api');
    }

    function initLinks() {
        quill.on('text-change', autoLink);
        quill.root.addEventListener('click', e => {
            const a = e.target.closest('a[href]');
            if (!a) return;
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) window.pywebview.api.open_url(a.getAttribute('href'));
        });
        quill.root.addEventListener('mouseover', e => {
            const a = e.target.closest('a[href]');
            if (a) a.title = `${a.getAttribute('href').replace(/^mailto:/, '')}\n${I18n.t('link_hint')}`;
        });
    }

    function attach(q) {
        quill = q;
        initLinks();
        quill.on('text-change', () => setTimeout(refresh, 0));
        $('find-input').addEventListener('input', () => { current = 0; search(); select(); });
        $('find-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
            if (e.key === 'Escape') { e.preventDefault(); close(); }
        });
        $('replace-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); (e.ctrlKey ? replaceAll : replaceOne)(); }
            if (e.key === 'Escape') { e.preventDefault(); close(); }
        });
        $('find-prev').addEventListener('click', () => step(-1));
        $('find-next').addEventListener('click', () => step(1));
        $('find-toggle-replace').addEventListener('click', () => {
            $('find-bar').classList.toggle('with-replace');
            if ($('find-bar').classList.contains('with-replace')) $('replace-input').focus();
        });
        $('replace-one').addEventListener('click', replaceOne);
        $('replace-all').addEventListener('click', replaceAll);
        $('find-close').addEventListener('click', close);
        $('find-bar').addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        });
        document.getElementById('btn-find')?.addEventListener('click', () => open(true));
    }

    function hide() {
        $('find-bar')?.classList.remove('open');
        matches = [];
        current = -1;
        paintHighlights();
    }

    return { attach, open, close, hide, isOpen };
})();
