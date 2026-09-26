// "What's new" showcase: shown once on the first launch of a new version
// (and as a welcome on a fresh install). Confetti, a live demo of the block
// editor, and the headline features of this release.
const WhatsNew = (() => {
    // Headline features of this release, in display order
    const FEATURES = [
        { id: 'blocks',    icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>' },
        { id: 'design',    icon: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 1 0 0 20c.93 0 1.5-.75 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16a6 6 0 0 0 6-6c0-4.97-4.48-9-10-9z"/>' },
        { id: 'tables',    icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>' },
        { id: 'find',      icon: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>' },
        { id: 'languages', icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
        { id: 'updates',   icon: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/><path d="M12 8v5l3 2"/>' },
    ];

    I18n.extend({
        ar: {
            wn_badge: 'جديد', wn_title: 'My Note {v}', wn_welcome: 'مرحباً بك في My Note',
            wn_sub: 'طريقة جديدة كلياً للكتابة. إليك ما الجديد.', wn_sub_first: 'ملاحظات جميلة، بكل لغة. إليك ما يمكنك فعله.',
            wn_blocks_t: 'كتل بلمسة /', wn_blocks_d: 'اكتب / لإضافة عناوين وجداول وقوائم مهام وتنبيهات والمزيد.',
            wn_design_t: 'تصميم جديد بالكامل', wn_design_d: 'واجهة أُعيد بناؤها من الصفر، مع سمات فاتحة وداكنة وستة ألوان.',
            wn_tables_t: 'جداول ورسومات', wn_tables_d: 'أنشئ جداول مثل Excel وارسم بيدك داخل ملاحظاتك.',
            wn_find_t: 'بحث واستبدال', wn_find_d: 'Ctrl+H يبحث ويستبدل في أي ملاحظة، حتى مع التشكيل.',
            wn_languages_t: '7 لغات', wn_languages_d: 'العربية، English، Русский، Deutsch، 中文، Español، Italiano.',
            wn_updates_t: 'دائماً محدَّث', wn_updates_d: 'تُنزَّل الإصدارات الجديدة في الخلفية وتُثبَّت بنقرة واحدة.',
            wn_start: 'ابدأ الكتابة', wn_demo_title: 'خطة الأسبوع', wn_demo_task1: 'تصميم الغلاف', wn_demo_task2: 'إرسال التقرير',
            wn_reopen: 'ما الجديد في هذا الإصدار',
        },
        en: {
            wn_badge: 'New', wn_title: 'My Note {v}', wn_welcome: 'Welcome to My Note',
            wn_sub: 'A brand-new way to write. Here’s what’s new.', wn_sub_first: 'Beautiful notes, in every language. Here’s what you can do.',
            wn_blocks_t: 'Blocks with /', wn_blocks_d: 'Type / to add headings, tables, to-dos, callouts and more.',
            wn_design_t: 'A fresh new look', wn_design_d: 'Redesigned from the ground up, with light and dark themes and six accent colours.',
            wn_tables_t: 'Tables & drawings', wn_tables_d: 'Build tables like in Excel and sketch by hand, right inside your notes.',
            wn_find_t: 'Find & replace', wn_find_d: 'Ctrl+H finds and replaces in any note, even across Arabic diacritics.',
            wn_languages_t: '7 languages', wn_languages_d: 'العربية, English, Русский, Deutsch, 中文, Español, Italiano.',
            wn_updates_t: 'Always up to date', wn_updates_d: 'New versions download in the background and install with one click.',
            wn_start: 'Start writing', wn_demo_title: 'Weekly plan', wn_demo_task1: 'Design the cover', wn_demo_task2: 'Send the report',
            wn_reopen: 'What’s new in this version',
        },
        ru: {
            wn_badge: 'Новое', wn_title: 'My Note {v}', wn_welcome: 'Добро пожаловать в My Note',
            wn_sub: 'Совершенно новый способ писать. Вот что нового.', wn_sub_first: 'Красивые заметки на любом языке. Вот что вы можете.',
            wn_blocks_t: 'Блоки через /', wn_blocks_d: 'Введите /, чтобы добавить заголовки, таблицы, задачи, выноски и другое.',
            wn_design_t: 'Новый облик', wn_design_d: 'Полностью новый дизайн, светлая и тёмная темы и шесть акцентных цветов.',
            wn_tables_t: 'Таблицы и рисунки', wn_tables_d: 'Создавайте таблицы как в Excel и рисуйте от руки прямо в заметках.',
            wn_find_t: 'Найти и заменить', wn_find_d: 'Ctrl+H ищет и заменяет текст в любой заметке.',
            wn_languages_t: '7 языков', wn_languages_d: 'العربية, English, Русский, Deutsch, 中文, Español, Italiano.',
            wn_updates_t: 'Всегда свежая версия', wn_updates_d: 'Новые версии загружаются в фоне и ставятся в один клик.',
            wn_start: 'Начать писать', wn_demo_title: 'План на неделю', wn_demo_task1: 'Сделать обложку', wn_demo_task2: 'Отправить отчёт',
            wn_reopen: 'Что нового в этой версии',
        },
    });

    const t = (k, v) => UI.esc(I18n.t(k, v));
    let timers = [];

    // ─── Confetti ─────────────────────────────────────────────────────────

    function confetti(canvas) {
        const reduce = document.documentElement.classList.contains('reduce-motion');
        if (reduce) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.width = innerWidth * dpr;
        const H = canvas.height = innerHeight * dpr;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#9d8cff';
        const colors = [accent, '#f7c55c', '#ff7a98', '#3fd0b0', '#63a4ff', '#ffffff'];
        const parts = Array.from({ length: 160 }, (_, i) => {
            const fromLeft = i % 2 === 0;
            const angle = (fromLeft ? -60 : -120) * Math.PI / 180 + (Math.random() - 0.5) * 0.9;
            const speed = (9 + Math.random() * 11) * dpr;
            return {
                x: fromLeft ? W * 0.12 : W * 0.88, y: H * 0.72,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                w: (5 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
                rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
                color: colors[i % colors.length], life: 0,
            };
        });
        const start = performance.now();
        function frame(now) {
            if (!canvas.isConnected) return;
            ctx.clearRect(0, 0, W, H);
            const elapsed = now - start;
            parts.forEach(p => {
                p.vy += 0.32 * dpr;
                p.vx *= 0.99;
                p.x += p.vx; p.y += p.vy; p.rot += p.vr;
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - elapsed / 3200);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
                ctx.restore();
            });
            if (elapsed < 3300) requestAnimationFrame(frame);
            else ctx.clearRect(0, 0, W, H);
        }
        requestAnimationFrame(frame);
    }

    // ─── Live demo: a tiny note that types "/table" and checks off tasks ──

    function runDemo(root) {
        const typed = root.querySelector('.wn-typed');
        const menu = root.querySelector('.wn-menu');
        const table = root.querySelector('.wn-table');
        const tasks = root.querySelectorAll('.wn-task');
        const later = (ms, fn) => timers.push(setTimeout(fn, ms));

        function cycle() {
            typed.textContent = '';
            menu.classList.remove('show');
            table.classList.remove('show');
            tasks.forEach(el => el.classList.remove('done', 'show'));
            let delay = 500;
            tasks.forEach((el, i) => later(delay + i * 350, () => el.classList.add('show')));
            delay += 900;
            tasks.forEach((el, i) => later(delay + i * 600, () => el.classList.add('done')));
            delay += 1500;
            '/table'.split('').forEach((ch, i) => later(delay + i * 130, () => {
                typed.textContent += ch;
                if (i === 0) menu.classList.add('show');
            }));
            delay += 6 * 130 + 700;
            later(delay, () => { menu.classList.remove('show'); typed.textContent = ''; table.classList.add('show'); });
            later(delay + 3600, cycle);
        }
        cycle();
    }

    // ─── Screen ───────────────────────────────────────────────────────────

    function open({ version, firstRun = false } = {}) {
        close();
        const el = document.createElement('div');
        el.id = 'whatsnew';
        el.innerHTML = `
            <canvas class="wn-confetti"></canvas>
            <div class="wn-glow"></div>
            <div class="wn-dialog" role="dialog" aria-modal="true">
                <div class="wn-hero">
                    <div class="wn-copy">
                        <span class="wn-badge">✦ ${t('wn_badge')}</span>
                        <h1 class="wn-title">${firstRun ? t('wn_welcome') : t('wn_title', { v: version })}</h1>
                        <p class="wn-sub">${firstRun ? t('wn_sub_first') : t('wn_sub')}</p>
                        <button class="primary-btn wn-start" data-wn="close">${t('wn_start')} <span class="wn-arrow">→</span></button>
                    </div>
                    <div class="wn-demo" aria-hidden="true">
                        <div class="wn-demo-bar"><span></span><span></span><span></span></div>
                        <div class="wn-demo-body" dir="auto">
                            <div class="wn-demo-title">${t('wn_demo_title')}</div>
                            <div class="wn-task"><i></i><span>${t('wn_demo_task1')}</span></div>
                            <div class="wn-task"><i></i><span>${t('wn_demo_task2')}</span></div>
                            <div class="wn-line"><span class="wn-typed"></span><span class="wn-caret"></span></div>
                            <div class="wn-menu">
                                <div class="wn-menu-item active"><b>▦</b>${t('blk_table')}</div>
                                <div class="wn-menu-item"><b>☑</b>${t('blk_todo')}</div>
                                <div class="wn-menu-item"><b>💡</b>${t('blk_callout')}</div>
                            </div>
                            <div class="wn-table">${'<span></span>'.repeat(9)}</div>
                        </div>
                    </div>
                </div>
                <div class="wn-grid">
                    ${FEATURES.map((f, i) => `
                        <div class="wn-card" style="animation-delay:${0.25 + i * 0.07}s">
                            <span class="wn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${f.icon}</svg></span>
                            <b>${t('wn_' + f.id + '_t')}</b>
                            <p>${t('wn_' + f.id + '_d')}</p>
                        </div>`).join('')}
                </div>
            </div>`;
        document.body.appendChild(el);
        el.tabIndex = -1;
        el.focus();
        el.addEventListener('click', e => {
            if (e.target.closest('[data-wn="close"]') || e.target === el) close();
        });
        el.addEventListener('keydown', e => {
            if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); }
        });
        confetti(el.querySelector('.wn-confetti'));
        runDemo(el);
    }

    function close() {
        timers.forEach(clearTimeout);
        timers = [];
        const el = document.getElementById('whatsnew');
        if (!el) return;
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 220);
    }

    return { open, close, isOpen: () => !!document.getElementById('whatsnew') };
})();
