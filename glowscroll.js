// Ties the soft background light to scrolling: each glow fades up as its section comes onto the screen,
// fades down as it leaves, and slides a little as you scroll. Works with the .aurora layers in style.css.
(() => {
  const layers = [...document.querySelectorAll('.aurora')].map((el) => ({ el, sec: el.parentElement }));
  if (!layers.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  let queued = false;
  const update = () => {
    queued = false;
    const vh = innerHeight;
    for (const { el, sec } of layers) {
      const r = sec.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      const shown = (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.min(vh, r.height); // how much of the screen/section is covered
      el.style.setProperty('--v', smooth(shown * 1.4).toFixed(3));
      const c = (r.top + r.bottom) / 2;
      el.style.setProperty('--py', Math.max(-220, Math.min(220, (vh / 2 - c) * 0.14)).toFixed(1));
    }
  };
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  update();
})();
