// The moving parts of the site. All of them are extras: without JavaScript the page still shows everything.
// (The 3D phone at the top is in hero3d.js.)

// 1. "One missed call": on wide screens, one phone sticks on the right and changes screens as the steps scroll past.
(() => {
  const story = document.querySelector('.story');
  if (!story || !('IntersectionObserver' in window)) return;
  const steps = [...story.querySelectorAll('.step')];
  const phone = story.querySelector('.story-phone .phone');
  const screens = steps.map(step => phone.appendChild(step.querySelector('.screen').cloneNode(true)));

  const show = i => {
    steps.forEach((step, j) => step.classList.toggle('is-active', i === j));
    screens.forEach((screen, j) => screen.classList.toggle('is-active', i === j));
  };
  show(0);

  // A step counts as "current" when it crosses the middle of the screen.
  const watcher = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) show(steps.indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(step => watcher.observe(step));

  const wide = matchMedia('(min-width: 901px)');
  const apply = () => story.classList.toggle('is-sticky', wide.matches);
  wide.addEventListener('change', apply);
  apply();
})();

// 2. The missed-call cost calculator.
(() => {
  const form = document.getElementById('calc');
  if (!form) return;
  const money = n => '$' + Math.round(n).toLocaleString('en-CA');
  const out = name => form.querySelector(`[data-out="${name}"]`);

  function update() {
    const calls = Number(form.calls.value);
    const job = Number(form.job.value);
    const book = Number(form.book.value);
    // Missed calls a month, times how many would book, times the average job.
    const jobs = calls * 52 / 12 * book / 10;
    out('calls').textContent = calls;
    out('job').textContent = money(job);
    out('book').textContent = book;
    out('total').textContent = money(jobs * job);
    out('jobs').textContent = `About ${Math.round(jobs)} job${Math.round(jobs) === 1 ? '' : 's'} a month.`;
    // one little block per job, so you can see the pile grow
    const chips = out('chips'), n = Math.min(60, Math.round(jobs));
    if (chips && chips.children.length !== n) chips.innerHTML = '<i></i>'.repeat(n);
  }
  form.addEventListener('input', update);
  update();
})();

// 3. The dashboard preview: the same radar as the real dashboard, showing its example week.
//    Booked jobs stand up as green pillars (taller = bigger job), callers who texted back are white posts,
//    no-replies are grey dots. Drag to spin and tilt it, hover a call to see who it was.
(() => {
  const canvas = document.getElementById('radar');
  if (!canvas) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const PHONE = new Path2D('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2');
  // [days ago, what happened, job value, who]
  const WEEK = [
    [0, 'replied', 0, 'Maria Gomez'], [0, 'none', 0, '(555) 014-7731'], [0, 'replied', 0, 'Derek Hall'],
    [1, 'booked', 1450, 'Linda Park'], [1, 'none', 0, '(555) 014-9902'], [2, 'replied', 0, 'Tom Reyes'],
    [3, 'booked', 380, 'Sam Ortiz'], [3, 'none', 0, '(555) 014-4410'], [3, 'replied', 0, 'Aisha Khan'],
    [4, 'booked', 240, 'Priya Patel'], [4, 'none', 0, '(555) 014-6158'], [5, 'booked', 1650, 'Greg Wilson'],
    [6, 'booked', 400, 'Rosa Jimenez'], [6, 'none', 0, '(555) 014-5013']
  ];
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const sliceOf = ago => (new Date(Date.now() - ago * 864e5).getDay() + 6) % 7;
  const hash = n => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };
  const money = n => '$' + n.toLocaleString('en-CA');
  const items = WEEK.map(([ago, kind, value, who], i) => {
    const day = sliceOf(ago);
    return {
      kind, value, who, day,
      ang: (day + 0.15 + hash(i + 1) * 0.7) / 7 * Math.PI * 2,
      r: (kind === 'booked' ? 0.36 : kind === 'replied' ? 0.66 : 0.92) + (hash(i + 8) - 0.5) * 0.12,
      h: kind === 'booked' ? 0.2 + 0.5 * value / 1650 : kind === 'replied' ? 0.12 : 0,
      delay: hash(i + 3) * 0.6
    };
  });
  const today = sliceOf(0);
  const tip = document.createElement('div');
  tip.className = 'rtip'; tip.hidden = true;
  document.body.appendChild(tip);
  let W = 0, H = 0, dpr = 1, rot = 0, tilt = 0, grow = 0, last = 0, running = false, mouse = null, drag = null;

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  // a point on the floor (x, z) at height y, as seen from a camera looking down at it
  function project(x, y, z, R, cx, cy, elev) {
    const c = Math.cos(rot), s = Math.sin(rot), xr = x * c - z * s, zr = x * s + z * c;
    const depth = zr * Math.cos(elev) + y * Math.sin(elev), k = 1600 / (1600 - depth * R);
    return { x: cx + xr * R * k, y: cy + (-y * Math.cos(elev) + zr * Math.sin(elev)) * R * k, d: depth, k };
  }
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const R = Math.min(W * (W < 500 ? 0.39 : 0.46), H * 0.66), cx = W / 2, cy = H * 0.6, elev = 0.52 + tilt * 0.3;
    const P = (x, y, z) => project(x, y, z, R, cx, cy, elev);
    const circle = r => { ctx.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, q = P(Math.cos(a) * r, 0, Math.sin(a) * r); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } };
    const ring = (r, style, width, dash) => { circle(r); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); };

    circle(1.04);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    glow.addColorStop(0, 'rgba(200,255,46,.10)'); glow.addColorStop(1, 'rgba(200,255,46,.015)');
    ctx.fillStyle = glow; ctx.fill();
    ring(1.04, 'rgba(200,255,46,.45)', 1.5);
    ring(0.92, 'rgba(255,255,255,.10)', 1, [3, 5]);
    ring(0.66, 'rgba(255,255,255,.14)', 1, [3, 5]);
    ring(0.36, 'rgba(200,255,46,.28)', 1, [3, 5]);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, p0 = P(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), p1 = P(Math.cos(a) * 1.04, 0, Math.sin(a) * 1.04);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.stroke();
      const la = (i + 0.5) / 7 * Math.PI * 2, lp = P(Math.cos(la) * 1.17, 0, Math.sin(la) * 1.17);
      ctx.font = `600 ${Math.round(11 * lp.k)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = i === today ? '#C8FF2E' : `rgba(207,207,201,${0.45 + 0.4 * Math.max(0, lp.d)})`;
      ctx.fillText(DAYS[i], lp.x, lp.y);
    }
    // the sweep, and rings pulsing out like a phone ringing
    const sweep = still ? 0 : (t / 3200) % 1 * Math.PI * 2;
    for (let k = 0; k < 14; k++) {
      const a0 = sweep - k * 0.045, a1 = a0 - 0.045, o = P(0, 0, 0), pa = P(Math.cos(a0), 0, Math.sin(a0)), pb = P(Math.cos(a1), 0, Math.sin(a1));
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.closePath();
      ctx.fillStyle = `rgba(200,255,46,${0.13 * (1 - k / 14)})`; ctx.fill();
    }
    if (!still) for (let k = 0; k < 3; k++) { const q = ((t / 2600) + k / 3) % 1; ring(0.1 + q * 0.95, `rgba(200,255,46,${0.5 * (1 - q)})`, 2); }

    // every call, back to front
    const pts = items.map(it => {
      const x = Math.cos(it.ang) * it.r, z = Math.sin(it.ang) * it.r;
      const gi = Math.min(1, Math.max(0, (grow - it.delay) / 0.6)), e = 1 - Math.pow(1 - gi, 3);
      return { it, base: P(x, 0, z), top: P(x, it.h * e, z), e };
    }).sort((a, b) => a.base.d - b.base.d);
    let hover = null;
    for (const { it, base, top, e } of pts) {
      if (e <= 0) continue;
      const near = mouse && Math.hypot(mouse.x - top.x, mouse.y - top.y) < 14;
      if (near) hover = { it, top };
      ctx.beginPath(); ctx.ellipse(base.x, base.y, 7 * base.k, 3 * base.k, 0, 0, Math.PI * 2);
      ctx.fillStyle = it.kind === 'booked' ? 'rgba(200,255,46,.25)' : 'rgba(0,0,0,.35)'; ctx.fill();
      if (it.kind !== 'none') {
        const lg = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
        lg.addColorStop(0, it.kind === 'booked' ? 'rgba(200,255,46,.15)' : 'rgba(244,244,241,.1)');
        lg.addColorStop(1, it.kind === 'booked' ? 'rgba(200,255,46,.95)' : 'rgba(244,244,241,.75)');
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y);
        ctx.strokeStyle = lg; ctx.lineWidth = (it.kind === 'booked' ? 6 : 3) * base.k; ctx.lineCap = 'round'; ctx.stroke();
      }
      if (it.kind === 'booked') { ctx.shadowColor = 'rgba(200,255,46,.9)'; ctx.shadowBlur = 18; }
      ctx.beginPath(); ctx.arc(top.x, top.y, (it.kind === 'booked' ? 6.5 : it.kind === 'replied' ? 4.5 : 3.5) * top.k * (near ? 1.6 : 1) * e, 0, Math.PI * 2);
      ctx.fillStyle = it.kind === 'booked' ? '#C8FF2E' : it.kind === 'replied' ? '#F4F4F1' : '#55555C';
      ctx.fill(); ctx.shadowBlur = 0;
      if (it.kind === 'booked' && top.d > -0.2) {
        ctx.font = `800 ${Math.round(12 * top.k)}px Archivo, sans-serif`;
        ctx.fillStyle = 'rgba(244,244,241,.92)'; ctx.textAlign = 'center';
        ctx.fillText(money(it.value), top.x, top.y - 14 * top.k);
      }
    }
    // the Ringleader phone in the middle
    const c0 = P(0, 0.02, 0);
    ctx.shadowColor = 'rgba(200,255,46,.8)'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(c0.x, c0.y, 22, 0, Math.PI * 2); ctx.fillStyle = '#C8FF2E'; ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); ctx.translate(c0.x - 12, c0.y - 12); ctx.strokeStyle = '#0D0D0E'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(PHONE); ctx.restore();

    if (hover) {
      const rc = canvas.getBoundingClientRect(), it = hover.it;
      tip.textContent = `${it.who} · ${it.kind === 'booked' ? 'Booked ' + money(it.value) : it.kind === 'replied' ? 'Texted back' : 'No reply yet'}`;
      tip.style.left = rc.left + hover.top.x + 'px'; tip.style.top = rc.top + hover.top.y + 'px'; tip.hidden = false;
    } else tip.hidden = true;
  }

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (drag) { rot = drag.rot + (e.clientX - drag.x) * 0.008; tilt = Math.max(-1, Math.min(1, drag.tilt + (e.clientY - drag.y) * 0.006)); }
  });
  canvas.addEventListener('pointerleave', () => { mouse = null; tip.hidden = true; });
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, rot, tilt }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });

  function loop(now) {
    if (!running) return;
    const dt = Math.min(50, now - (last || now)); last = now;
    if (!still && !drag) rot += dt * 0.00006;
    grow = Math.min(2, grow + dt / 1000);
    draw(now);
    requestAnimationFrame(loop);
  }
  new ResizeObserver(size).observe(canvas);
  // only spin while it's on screen
  new IntersectionObserver(es => {
    if (es[0].isIntersecting) { if (!running) { running = true; last = 0; requestAnimationFrame(loop); } }
    else running = false;
  }).observe(canvas);
})();

// 4. Small extras: things slide in as you reach them, the price card's glow follows the cursor,
//    and the dashboard's big number counts up the first time you see it.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js-on');
  const els = document.querySelectorAll('.section-title, .rule, .faq > div, .price-block, .calc, .dash-frame, .stat, .contact .wrap > *, .later');
  els.forEach(el => el.classList.add('rv'));
  if (still || !('IntersectionObserver' in window)) els.forEach(el => el.classList.add('in'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }

  const price = document.querySelector('.price-block');
  if (price) price.addEventListener('pointermove', e => {
    const r = price.getBoundingClientRect();
    price.style.setProperty('--mx', (e.clientX - r.left) + 'px'); price.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  const big = document.querySelector('.dash-money');
  if (big && !still && 'IntersectionObserver' in window) {
    const to = Number(big.dataset.count);
    const once = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      once.disconnect();
      const t0 = performance.now();
      const tick = now => {
        const k = Math.min(1, (now - t0) / 1400);
        big.textContent = '$' + Math.round(to * (1 - Math.pow(1 - k, 4))).toLocaleString('en-CA');
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    once.observe(big);
  }
})();
