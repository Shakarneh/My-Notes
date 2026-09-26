// Small shared UI helpers: HTML escaping, toasts, date locale.
const UI = (() => {
    function esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Gregorian calendar everywhere ('ar-SA' alone defaults to the Hijri calendar).
    function locale() {
        return I18n.current === 'ar' ? 'ar-u-ca-gregory-nu-latn'
             : I18n.current === 'ru' ? 'ru-RU'
             : 'en-US';
    }

    function parseDbDate(iso) {
        return iso ? new Date(iso.replace(' ', 'T') + 'Z') : null;
    }

    /**
     * Show a toast. Options: { action: 'Undo', onAction: fn, duration: ms, kind: 'error'|'success' }
     */
    function toast(message, opts = {}) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'toast' + (opts.kind ? ` toast-${opts.kind}` : '');
        el.innerHTML = `<span class="toast-msg">${esc(message)}</span>`;

        let timer = null;
        const close = () => {
            clearTimeout(timer);
            el.classList.add('leaving');
            setTimeout(() => el.remove(), 200);
        };

        if (opts.action && opts.onAction) {
            const btn = document.createElement('button');
            btn.className = 'toast-action';
            btn.textContent = opts.action;
            btn.addEventListener('click', () => { close(); opts.onAction(); });
            el.appendChild(btn);
        }

        container.appendChild(el);
        requestAnimationFrame(() => el.classList.add('visible'));
        timer = setTimeout(close, opts.duration || (opts.action ? 6000 : 2600));
        return close;
    }

    return { esc, locale, parseDbDate, toast };
})();
