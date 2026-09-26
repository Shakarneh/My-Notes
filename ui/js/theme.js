const Theme = (() => {
    // Accent presets: [dark-theme colour, light-theme colour, text colour on the accent]
    const ACCENTS = {
        violet: ['#9d8cff', '#6a55e8', '#ffffff'],
        blue:   ['#63a4ff', '#2f6fe0', '#ffffff'],
        teal:   ['#3fd0b0', '#0e9478', '#ffffff'],
        amber:  ['#f7b955', '#c7850c', '#1a1206'],
        rose:   ['#ff7a98', '#d6456a', '#ffffff'],
        mono:   ['#f2f2f2', '#1a1a1a', null],
    };
    const MODES = ['auto', 'light', 'dark'];

    let mode = 'auto';
    let accent = 'violet';
    let resolved = 'dark';

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    }

    function paint() {
        const root = document.documentElement;
        root.classList.toggle('theme-light', resolved === 'light');
        root.classList.toggle('theme-dark',  resolved !== 'light');

        const [dark, light, on] = ACCENTS[accent] || ACCENTS.violet;
        const color = resolved === 'light' ? light : dark;
        root.style.setProperty('--accent', color);
        root.style.setProperty('--accent-rgb', hexToRgb(color));
        root.style.setProperty('--on-accent', on || (resolved === 'light' ? '#ffffff' : '#111111'));
        root.dataset.accent = accent;

        const btn = document.getElementById('btn-theme');
        if (btn) {
            btn.dataset.mode = mode;
            btn.title = I18n.t('theme_' + mode);
        }
        document.querySelectorAll('.accent-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.accent === accent);
        });
    }

    async function refresh() {
        resolved = await window.pywebview.api.get_theme();
        paint();
    }

    async function init(settings) {
        mode = MODES.includes(settings.theme_override) ? settings.theme_override : 'auto';
        accent = ACCENTS[settings.accent] ? settings.accent : 'violet';
        await refresh();

        document.getElementById('btn-theme')?.addEventListener('click', async () => {
            await setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
            UI.toast(I18n.t('theme_' + mode));
        });

        // Accent picker popover
        const popover = document.getElementById('accent-popover');
        const accentBtn = document.getElementById('btn-accent');
        if (popover && accentBtn) {
            popover.innerHTML = Object.keys(ACCENTS).map(name => {
                const [dark, light] = ACCENTS[name];
                return `<button class="accent-swatch" data-accent="${name}"
                            style="--sw-dark:${dark};--sw-light:${light}"
                            title="${name}"></button>`;
            }).join('');
            accentBtn.addEventListener('click', e => {
                e.stopPropagation();
                popover.classList.toggle('open');
            });
            popover.addEventListener('click', async e => {
                const sw = e.target.closest('.accent-swatch');
                if (!sw) return;
                popover.classList.remove('open');
                await setAccent(sw.dataset.accent);
            });
            document.addEventListener('mousedown', e => {
                if (!e.target.closest('#accent-popover') && !e.target.closest('#btn-accent')) {
                    popover.classList.remove('open');
                }
            });
        }
        paint();

        // Re-check every 5 minutes in case day/night changes while the app is open
        setInterval(refresh, 5 * 60 * 1000);
    }

    async function setMode(next) {
        if (!MODES.includes(next)) return;
        mode = next;
        await window.pywebview.api.update_setting('theme_override', mode);
        await refresh();
    }

    async function setAccent(name) {
        if (!ACCENTS[name]) return;
        accent = name;
        paint();
        await window.pywebview.api.update_setting('accent', accent);
    }

    function accents() {
        return Object.entries(ACCENTS).map(([name, [dark, light]]) => ({ name, dark, light }));
    }

    return { init, refresh, paint, setMode, setAccent, accents };
})();
