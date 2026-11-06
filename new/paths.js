// Background paths for the hero: two sets of 36 thin lines that slowly slide along their curves.
// Ported from the "Background Paths" component, with plain SVG + CSS instead of React.
(() => {
  const box = document.getElementById('paths');
  if (!box) return;
  const NS = 'http://www.w3.org/2000/svg';
  for (const pos of [1, -1]) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 696 316');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('fill', 'none');
    if (pos === -1) svg.classList.add('paths-b');
    for (let i = 0; i < 36; i++) {
      const k = i * 5 * pos;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d',
        `M-${380 - k} -${189 + i * 6}C-${380 - k} -${189 + i * 6} -${312 - k} ${216 - i * 6} ${152 - k} ${343 - i * 6}` +
        `C${616 - k} ${470 - i * 6} ${684 - k} ${875 - i * 6} ${684 - k} ${875 - i * 6}`);
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', (0.5 + i * 0.03).toFixed(2));
      p.setAttribute('stroke-opacity', (0.1 + i * 0.03).toFixed(2));
      p.style.setProperty('--d', (20 + Math.random() * 10).toFixed(1) + 's');
      svg.appendChild(p);
    }
    box.appendChild(svg);
  }
})();
