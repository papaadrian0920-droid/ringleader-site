// Faint flickering dot grid behind the "One missed call. Start to finish." section.
// Ideas from the "Flickering Grid" component, in plain canvas JS instead of React.
// Only the squares that change get redrawn, so it stays cheap even on a tall section.
// Move your mouse over the section and the dots near it light up and lean toward it.
(() => {
  const box = document.getElementById('grid-bg');
  if (!box) return;
  const SIZE = 3, GAP = 9, PITCH = SIZE + GAP;
  const MAX = 0.2;            // brightest a resting square can get (low on purpose: this is only depth)
  const CHANCE = 0.12;        // share of squares that change per second
  const RGB = '200, 255, 46'; // Ringleader lime
  const R = 150;              // how far the mouse reaches, in px
  const PULL = 16;            // most a dot leans toward the mouse, in px
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  box.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let cols = 0, rows = 0, dpr = 1, cells = new Float32Array(0), visible = true, last = 0, raf = 0;

  // mouse state: cx/cy are screen coords (so the effect follows while you scroll), px/py are the eased position in the box
  let cx = 0, cy = 0, hasPointer = false, inside = false, amount = 0, px = 0, py = 0, drawn = null;

  // one square, at its home spot, or pulled toward the mouse when it is close
  const drawCell = (i, m) => {
    const col = i % cols, row = (i / cols) | 0;
    let x = col * PITCH + SIZE / 2, y = row * PITCH + SIZE / 2, a = cells[i], s = SIZE;
    if (m) {
      const dx = m.x - x, dy = m.y - y, d = Math.hypot(dx, dy);
      if (d < R) {
        const k = 1 - d / R, glow = k * k * m.a;
        const pull = Math.min(PULL * glow * 1.6, d);   // never overshoots the mouse
        if (d > 0.5) { x += (dx / d) * pull; y += (dy / d) * pull; }
        a = Math.min(0.9, a + glow * 0.75);
        s = SIZE * (1 + glow * 0.9);
      }
    }
    ctx.fillStyle = `rgba(${RGB}, ${a.toFixed(3)})`;
    ctx.fillRect((x - s / 2) * dpr, (y - s / 2) * dpr, s * dpr, s * dpr);
  };
  // wipe a square patch of the canvas and redraw the dots whose home is inside it
  const box4 = (m) => {
    const pad = R + PITCH;
    return { c0: Math.max(0, Math.floor((m.x - pad) / PITCH)), c1: Math.min(cols - 1, Math.ceil((m.x + pad) / PITCH)),
             r0: Math.max(0, Math.floor((m.y - pad) / PITCH)), r1: Math.min(rows - 1, Math.ceil((m.y + pad) / PITCH)) };
  };
  const clearBox = (b) => ctx.clearRect(b.c0 * PITCH * dpr, b.r0 * PITCH * dpr, (b.c1 - b.c0 + 1) * PITCH * dpr, (b.r1 - b.r0 + 1) * PITCH * dpr);
  const drawBox = (b, m, skip) => {
    for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) {
      if (skip && c >= skip.c0 && c <= skip.c1 && r >= skip.r0 && r <= skip.r1) continue;
      drawCell(r * cols + c, m);
    }
  };
  const inZone = (i, m) => m && Math.hypot(m.x - ((i % cols) * PITCH), m.y - (((i / cols) | 0) * PITCH)) < R + PITCH * 2;

  const build = () => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cols = Math.floor(w / PITCH); rows = Math.floor(h / PITCH);
    cells = new Float32Array(cols * rows);
    for (let i = 0; i < cells.length; i++) { cells[i] = Math.random() * MAX; drawCell(i, null); }
    drawn = null;
  };

  const tick = (t) => {
    raf = 0;
    if (!visible) return;
    // eased mouse
    const target = inside && hasPointer ? 1 : 0;
    amount += (target - amount) * 0.12;
    if (amount < 0.004 && target === 0) amount = 0;
    if (hasPointer) {
      const r = box.getBoundingClientRect(), tx = cx - r.left, ty = cy - r.top;
      if (!px && !py) { px = tx; py = ty; }
      px += (tx - px) * 0.22; py += (ty - py) * 0.22;
    }
    const now = amount > 0 ? { x: px, y: py, a: amount } : null;

    // 1. flicker: a few random squares change (skip the ones the mouse is currently handling)
    const dt = Math.min((t - last) / 1000, 0.25);
    if (dt >= 0.05) {
      last = t;
      const n = Math.round(cells.length * CHANCE * dt);
      for (let k = 0; k < n; k++) {
        const i = (Math.random() * cells.length) | 0;
        cells[i] = Math.random() * MAX;
        if (inZone(i, now) || inZone(i, drawn)) continue;
        const x = (i % cols) * PITCH * dpr, y = ((i / cols) | 0) * PITCH * dpr, s = SIZE * dpr;
        ctx.clearRect(x, y, s, s); drawCell(i, null);
      }
    }
    // 2. mouse: redraw the patch where it was and the patch where it is now
    if (now || drawn) {
      const a = drawn && box4(drawn), b = now && box4(now);
      if (a) clearBox(a);
      if (b) clearBox(b);
      if (a) drawBox(a, now, null);
      if (b) drawBox(b, now, a);
      drawn = now;
    }
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!still && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  const area = box.parentElement;
  if (!still) {
    area.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; cx = e.clientX; cy = e.clientY; hasPointer = true; inside = true; });
    area.addEventListener('pointerleave', () => { inside = false; });
  }
  build();
  new ResizeObserver(() => { build(); }).observe(box);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(box);
  start();
})();
