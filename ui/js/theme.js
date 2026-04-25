const Theme = (() => {
    function apply(theme) {
        document.documentElement.className = theme === 'light' ? 'theme-light' : 'theme-dark';
    }

    async function init() {
        const theme = await window.pywebview.api.get_theme();
        apply(theme);
    }

    // Re-check every 10 minutes in case day/night transitions while app is open
    setInterval(async () => {
        const theme = await window.pywebview.api.get_theme();
        apply(theme);
    }, 10 * 60 * 1000);

    return { init, apply };
})();
