// The founding-shop deal: $69 a month for the first 3 months. It really ends on this date,
// so this counts down to it and hides the deal after. Change SPOTS_TAKEN as shops sign up.
const DEAL_ENDS = new Date('2027-02-01T00:00:00-05:00'); // the end of January 31, 2027, Toronto time
const DEAL_SPOTS = 20;
const SPOTS_TAKEN = 0;

(() => {
  const root = document.documentElement;
  const left = () => DEAL_ENDS - Date.now();
  const isOver = () => left() <= 0 || SPOTS_TAKEN >= DEAL_SPOTS;
  const show = over => {
    root.classList.toggle('deal-over', over);
    document.querySelectorAll('[data-deal]').forEach(el => { el.hidden = over; });
    document.querySelectorAll('[data-deal-ended]').forEach(el => { el.hidden = !over; });
  };
  show(isOver());
  if (isOver()) return;

  // The live countdown to the real end date: days, hours, minutes, seconds.
  const spots = DEAL_SPOTS - SPOTS_TAKEN;
  const clocks = [...document.querySelectorAll('[data-deal-left]')].map(el => {
    el.textContent = 'Ends January 31, 2027 · ';
    const clock = document.createElement('span');
    clock.className = 'deal-clock';
    clock.setAttribute('role', 'timer');
    el.append(clock, ` · ${spots} of ${DEAL_SPOTS} spots open`);
    return clock;
  });
  const two = n => String(n).padStart(2, '0');
  const tick = () => {
    if (left() <= 0) { show(true); clearInterval(timer); return; }
    const s = Math.floor(left() / 1000);
    const text = `${Math.floor(s / 86400)}d ${two(Math.floor(s / 3600) % 24)}h ${two(Math.floor(s / 60) % 60)}m ${two(s % 60)}s`;
    clocks.forEach(clock => { clock.textContent = text; });
  };
  const timer = setInterval(tick, 1000);
  tick();
})();
