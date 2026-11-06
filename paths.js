// Background paths for the hero: two bundles of thin curved lines that slowly drift (the whole bundle moves, which keeps it cheap for phones and laptops).
// Ideas from the "Background Paths" component, done with plain SVG + CSS instead of React.
(() => {
  const box = document.getElementById('paths');
  if (!box) return;
  const NS = 'http://www.w3.org/2000/svg';
  const N = 30;
  for (const pos of [1, -1]) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1440 800');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('fill', 'none');
    if (pos === -1) svg.classList.add('paths-b');
    for (let i = 0; i < N; i++) {
      const p = document.createElementNS(NS, 'path');
      if (pos === 1) {
        // sweeps up from the lower left, then dips toward the right
        const y = 380 + i * 15;
        p.setAttribute('d', `M-200 ${y + 160} C 260 ${y - 260 - i * 5}, 760 ${y + 300 + i * 3}, 1640 ${y - 120 + i * 7}`);
      } else {
        // sweeps down from the upper right toward the lower left
        const y = -100 + i * 14;
        p.setAttribute('d', `M1640 ${y} C 1180 ${y + 320 + i * 4}, 620 ${y - 160}, -200 ${y + 420 + i * 6}`);
      }
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', (1 + i * 0.04).toFixed(2));
      p.setAttribute('stroke-opacity', (0.16 + i * 0.015).toFixed(3));
      svg.appendChild(p);
    }
    box.appendChild(svg);
  }
})();
