// Faint flickering dot grid behind the "One missed call. Start to finish." section.
// Ideas from the "Flickering Grid" component, in plain canvas JS instead of React.
// Only the squares that change get redrawn, so it stays cheap even on a tall section.
(() => {
  const box = document.getElementById('grid-bg');
  if (!box) return;
  const SIZE = 3, GAP = 9, PITCH = SIZE + GAP;
  const MAX = 0.2;          // brightest a square can get (kept low on purpose: this is only depth)
  const CHANCE = 0.12;      // share of squares that change per second
  // Ringleader lime on dark; a darker green on the light (white) version.
  const pick = () => document.documentElement.dataset.theme === 'light' ? '61, 122, 0' : '200, 255, 46';
  let RGB = pick();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  box.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let cols = 0, rows = 0, dpr = 1, cells = new Float32Array(0), visible = true, last = 0, raf = 0;

  const paint = (i) => {
    const x = (i % cols) * PITCH * dpr, y = Math.floor(i / cols) * PITCH * dpr, s = SIZE * dpr;
    ctx.clearRect(x, y, s, s);
    ctx.fillStyle = `rgba(${RGB}, ${cells[i].toFixed(3)})`;
    ctx.fillRect(x, y, s, s);
  };
  document.addEventListener('themechange', () => { RGB = pick(); for (let i = 0; i < cells.length; i++) paint(i); });
  const build = () => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cols = Math.floor(w / PITCH); rows = Math.floor(h / PITCH);
    cells = new Float32Array(cols * rows);
    for (let i = 0; i < cells.length; i++) { cells[i] = Math.random() * MAX; paint(i); }
  };
  const tick = (t) => {
    raf = 0;
    if (!visible) return;
    const dt = Math.min((t - last) / 1000, 0.25);
    if (dt >= 0.05) {   // about 20 updates a second is plenty for a twinkle
      last = t;
      const n = Math.round(cells.length * CHANCE * dt);
      for (let k = 0; k < n; k++) { const i = (Math.random() * cells.length) | 0; cells[i] = Math.random() * MAX; paint(i); }
    }
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!still && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  build();
  new ResizeObserver(() => { build(); }).observe(box);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(box);
  start();
})();
