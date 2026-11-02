// The founding-shop deal: $69 a month for the first 3 months. It really ends on this date,
// so this counts down to it and hides the deal after. Change SPOTS_TAKEN as shops sign up.
const DEAL_ENDS = new Date('2027-02-01T00:00:00-05:00'); // the end of January 31, 2027, Toronto time
const DEAL_SPOTS = 10;
const SPOTS_TAKEN = 0;

(() => {
  const over = Date.now() >= DEAL_ENDS || SPOTS_TAKEN >= DEAL_SPOTS;
  document.documentElement.classList.toggle('deal-over', over);
  document.querySelectorAll('[data-deal]').forEach(el => { el.hidden = over; });
  document.querySelectorAll('[data-deal-ended]').forEach(el => { el.hidden = !over; });
  if (over) return;

  const days = Math.ceil((DEAL_ENDS - Date.now()) / 86400000);
  const spots = DEAL_SPOTS - SPOTS_TAKEN;
  const left = `Ends January 31, 2027 · ${days} day${days === 1 ? '' : 's'} left · ${spots} of ${DEAL_SPOTS} spots open`;
  document.querySelectorAll('[data-deal-left]').forEach(el => { el.textContent = left; });
})();
