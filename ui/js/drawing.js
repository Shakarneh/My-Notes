// Hand-drawing pad: sketch with a pen or mouse, insert the result as an image.
const Drawing = (() => {
    const COLORS = ['#1d1c1a', '#e5484d', '#2f6fe0', '#1f9d5c', '#f5a524', '#8e4ec6'];
    const SIZES = [2, 4, 9];

    let canvas, ctx, overlay;
    let color = COLORS[0];
    let size = SIZES[1];
    let erasing = false;
    let strokes = [];      // [{ color, size, erase, points: [[x,y,p]...] }]
    let current = null;
    let onInsert = null;

    I18n.extend({
        ar: { draw_title: 'رسم', draw_insert: 'إدراج', draw_cancel: 'إلغاء', draw_undo: 'تراجع', draw_clear: 'مسح الكل', draw_eraser: 'ممحاة', draw_pen: 'قلم' },
        en: { draw_title: 'Drawing', draw_insert: 'Insert', draw_cancel: 'Cancel', draw_undo: 'Undo', draw_clear: 'Clear', draw_eraser: 'Eraser', draw_pen: 'Pen' },
        ru: { draw_title: 'Рисунок', draw_insert: 'Вставить', draw_cancel: 'Отмена', draw_undo: 'Отменить', draw_clear: 'Очистить', draw_eraser: 'Ластик', draw_pen: 'Перо' },
    });

    function build() {
        overlay = document.createElement('div');
        overlay.id = 'drawing-overlay';
        overlay.innerHTML = `
            <div id="drawing-dialog" role="dialog" aria-modal="true">
                <div id="drawing-toolbar">
                    <span class="drawing-title">${UI.esc(I18n.t('draw_title'))}</span>
                    <div class="drawing-group">
                        <button class="draw-tool active" data-tool="pen" title="${UI.esc(I18n.t('draw_pen'))}">
                            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.15.85a.5.5 0 0 1 .7 0l2.3 2.3a.5.5 0 0 1 0 .7l-9 9a.5.5 0 0 1-.23.13l-3.5 1a.5.5 0 0 1-.62-.62l1-3.5a.5.5 0 0 1 .13-.23l9-9z"/></svg>
                        </button>
                        <button class="draw-tool" data-tool="eraser" title="${UI.esc(I18n.t('draw_eraser'))}">
                            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.09 2.2a2 2 0 0 1 2.83 0l3.88 3.88a2 2 0 0 1 0 2.83l-5.5 5.5A2 2 0 0 1 7.88 15H5.12a2 2 0 0 1-1.41-.59l-2.5-2.5a2 2 0 0 1 0-2.83l6.88-6.88zM8.75 13.55 3.45 8.25l-1.54 1.54a1 1 0 0 0 0 1.42l2.5 2.5a1 1 0 0 0 .71.29H7.88a1 1 0 0 0 .7-.3z"/></svg>
                        </button>
                    </div>
                    <div class="drawing-group">
                        ${COLORS.map((c, i) => `<button class="draw-color${i === 0 ? ' active' : ''}" data-color="${c}" style="--c:${c}"></button>`).join('')}
                    </div>
                    <div class="drawing-group">
                        ${SIZES.map((s, i) => `<button class="draw-size${i === 1 ? ' active' : ''}" data-size="${s}"><span style="width:${s + 2}px;height:${s + 2}px"></span></button>`).join('')}
                    </div>
                    <div class="drawing-spacer"></div>
                    <button class="draw-btn" data-act="undo" title="Ctrl+Z">${UI.esc(I18n.t('draw_undo'))}</button>
                    <button class="draw-btn" data-act="clear">${UI.esc(I18n.t('draw_clear'))}</button>
                </div>
                <div id="drawing-stage"><canvas id="drawing-canvas"></canvas></div>
                <div id="drawing-footer">
                    <button class="draw-btn" data-act="cancel">${UI.esc(I18n.t('draw_cancel'))}</button>
                    <button class="primary-btn" data-act="insert">${UI.esc(I18n.t('draw_insert'))}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        canvas = overlay.querySelector('#drawing-canvas');
        ctx = canvas.getContext('2d');

        overlay.addEventListener('click', e => {
            const t = e.target.closest('button');
            if (!t) { if (e.target === overlay) close(); return; }
            if (t.dataset.tool) {
                erasing = t.dataset.tool === 'eraser';
                overlay.querySelectorAll('.draw-tool').forEach(b => b.classList.toggle('active', b === t));
            } else if (t.dataset.color) {
                color = t.dataset.color;
                erasing = false;
                overlay.querySelectorAll('.draw-color').forEach(b => b.classList.toggle('active', b === t));
                overlay.querySelectorAll('.draw-tool').forEach(b => b.classList.toggle('active', b.dataset.tool === 'pen'));
            } else if (t.dataset.size) {
                size = Number(t.dataset.size);
                overlay.querySelectorAll('.draw-size').forEach(b => b.classList.toggle('active', b === t));
            } else if (t.dataset.act === 'undo') {
                strokes.pop(); redraw();
            } else if (t.dataset.act === 'clear') {
                strokes = []; redraw();
            } else if (t.dataset.act === 'cancel') {
                close();
            } else if (t.dataset.act === 'insert') {
                insert();
            }
        });

        canvas.addEventListener('pointerdown', e => {
            canvas.setPointerCapture(e.pointerId);
            current = { color, size, erase: erasing, points: [point(e)] };
            strokes.push(current);
            redraw();
        });
        canvas.addEventListener('pointermove', e => {
            if (!current) return;
            const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            evs.forEach(ev => current.points.push(point(ev)));
            redraw();
        });
        const end = () => { current = null; };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);

        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); strokes.pop(); redraw(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); insert(); }
        });
    }

    function point(e) {
        const r = canvas.getBoundingClientRect();
        const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
        return [e.clientX - r.left, e.clientY - r.top, pressure];
    }

    function resize() {
        const stage = overlay.querySelector('#drawing-stage');
        const dpr = window.devicePixelRatio || 1;
        const w = stage.clientWidth, h = stage.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
    }

    function redraw() {
        const w = canvas.width, h = canvas.height;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.restore();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        strokes.forEach(s => {
            ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
            ctx.strokeStyle = s.color;
            ctx.fillStyle = s.color;
            const pts = s.points;
            const width = p => (s.erase ? s.size * 4 : s.size * (0.6 + p * 0.8));
            if (pts.length === 1) {
                ctx.beginPath();
                ctx.arc(pts[0][0], pts[0][1], width(pts[0][2]) / 2, 0, Math.PI * 2);
                ctx.fill();
                return;
            }
            // Smooth the stroke with quadratic curves through segment midpoints
            for (let i = 1; i < pts.length; i++) {
                const [x0, y0] = i > 1 ? mid(pts[i - 2], pts[i - 1]) : pts[0];
                const [cx, cy] = pts[i - 1];
                const [x1, y1] = mid(pts[i - 1], pts[i]);
                ctx.beginPath();
                ctx.lineWidth = width(pts[i][2]);
                ctx.moveTo(x0, y0);
                ctx.quadraticCurveTo(cx, cy, x1, y1);
                ctx.stroke();
            }
        });
        ctx.globalCompositeOperation = 'source-over';
    }

    function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

    function insert() {
        if (!strokes.length) { close(); return; }
        // Crop to the drawn area (+ margin) and put it on a white card so it reads in both themes
        const pad = 24 * (window.devicePixelRatio || 1);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        for (let y = 0; y < canvas.height; y += 2) {
            for (let x = 0; x < canvas.width; x += 2) {
                if (data[(y * canvas.width + x) * 4 + 3] > 8) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < minX) { close(); return; }
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(canvas.width, maxX + pad); maxY = Math.min(canvas.height, maxY + pad);
        const out = document.createElement('canvas');
        out.width = maxX - minX;
        out.height = maxY - minY;
        const octx = out.getContext('2d');
        octx.fillStyle = '#ffffff';
        octx.fillRect(0, 0, out.width, out.height);
        octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
        const url = out.toDataURL('image/png');
        const cb = onInsert;
        close();
        cb?.(url);
    }

    function open(insertCallback) {
        onInsert = insertCallback || (url => Editor.insertImage(url));
        if (overlay) overlay.remove();
        strokes = [];
        erasing = false;
        color = COLORS[0];
        size = SIZES[1];
        build();
        overlay.classList.add('open');
        overlay.tabIndex = -1;
        overlay.focus();
        requestAnimationFrame(resize);
        window.addEventListener('resize', resize);
    }

    function close() {
        window.removeEventListener('resize', resize);
        overlay?.remove();
        overlay = null;
        current = null;
        Editor.focus();
    }

    return { open, close };
})();
