// Home screen shown when no note is open: greeting, quick create, recent notes.
const Home = (() => {
    const $ = id => document.getElementById(id);

    function greetingKey(hour) {
        if (hour >= 5 && hour < 12) return 'greet_morning';
        if (hour >= 12 && hour < 17) return 'greet_afternoon';
        if (hour >= 17 && hour < 22) return 'greet_evening';
        return 'greet_night';
    }

    function renderCredit() {
        const el = $('status-credit');
        if (el) el.innerHTML = I18n.t('made_by');   // trusted, static translation string
    }

    async function render() {
        renderCredit();
        if (!isVisible()) return;
        const now = new Date();
        $('home-greeting').textContent = I18n.t(greetingKey(now.getHours()));
        $('home-date').textContent = now.toLocaleDateString(UI.locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const notes = await window.pywebview.api.get_all_notes();
        const recent = [...notes]
            .sort((a, b) => (b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0))
            .slice(0, 6);
        $('home-stats').textContent = notes.length
            ? I18n.t('home_stats', { n: notes.length, p: notes.filter(n => n.is_pinned).length })
            : '';
        $('home-recent-wrap').style.display = recent.length ? '' : 'none';
        $('home-recent').innerHTML = recent.map(n => {
            const preview = (n.content_plain || '').replace(/\s+/g, ' ').trim().slice(0, 110);
            const d = UI.parseDbDate(n.updated_at);
            return `
                <button class="recent-card" data-id="${n.id}">
                    <span class="recent-title" dir="auto">${n.is_pinned ? '<span class="recent-pin">●</span>' : ''}${UI.esc(Notes.getDisplayTitle(n.title))}</span>
                    <span class="recent-preview" dir="auto">${UI.esc(preview) || `<i>${UI.esc(I18n.t('no_content'))}</i>`}</span>
                    <span class="recent-date">${d ? UI.esc(d.toLocaleDateString(UI.locale(), { day: 'numeric', month: 'short' })) : ''}</span>
                </button>`;
        }).join('');
    }

    function isVisible() {
        return $('no-note-selected')?.style.display !== 'none';
    }

    function init() {
        renderCredit();
        $('home-recent').addEventListener('click', e => {
            const card = e.target.closest('.recent-card');
            if (card) Notes.openNote(Number(card.dataset.id));
        });
        $('home-quick').addEventListener('click', e => {
            const tile = e.target.closest('[data-quick]');
            if (!tile) return;
            const kind = tile.dataset.quick;
            App.newNote(kind === 'note' ? null : kind);
        });
        document.addEventListener('languagechange', render);
        // Keep the greeting current if the app stays open for hours
        setInterval(render, 10 * 60 * 1000);
    }

    return { init, render };
})();
