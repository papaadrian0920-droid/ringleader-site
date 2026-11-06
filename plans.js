// The plans page: the Monthly / Yearly switch and the rolling price.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const PRICE = { monthly: 99, yearly: 79 };
  let billing = 'monthly';

  // The rolling price: each digit is a strip of 0-9 twice, moved up and down.
  const roll = $('#roll');
  const strips = [0, 1].map(() => {
    const digit = document.createElement('span');
    digit.className = 'roll-digit';
    const strip = document.createElement('span');
    strip.className = 'roll-strip';
    strip.innerHTML = [...'01234567890123456789'].map(n => `<i>${n}</i>`).join('');
    digit.append(strip);
    roll.append(digit);
    return strip;
  });
  // Which cell shows: 99 uses the far 9 on the last digit, so that digit spins too.
  const CELLS = { monthly: [9, 19], yearly: [7, 9] };
  const showPrice = () => strips.forEach((strip, i) => {
    strip.style.transform = `translateY(calc(${CELLS[billing][i]} * -1.1em))`;
  });
  showPrice();

  function setBilling(next) {
    if (next === billing) return;
    billing = next;
    $('.bill').dataset.billing = billing;
    $$('[data-bill]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bill === billing)));
    $$('[data-when]').forEach(el => { el.hidden = el.dataset.when !== billing; });
    $('#tbPrice').setAttribute('aria-label', `$${PRICE[billing]} a month`);
    showPrice();
  }
  $$('[data-bill]').forEach(b => b.addEventListener('click', () => setBilling(b.dataset.bill)));
})();
