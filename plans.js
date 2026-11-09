// The plans page: the Monthly / Yearly switch, the rolling price, Sign up early,
// and the sign-up sheet the Text-Back card grows into.
(() => {
  if (new URLSearchParams(location.search).get('step') === 'payment') return;
  // The Web3Forms key lives in leads.js. Without one nothing can send, so the page shows an honest "didn't send" message with Adrian's email and phone.
  const FORM_KEY = (window.RingleaderLeads && RingleaderLeads.formKey) || '';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const Details = window.RingleaderDetails;
  const checkout = window.RingleaderCheckout;
  // Paying on the website through a Stripe Payment Link (paylinks.js). ?testpay uses the sandbox link instead.
  const Pay = window.RingleaderPay || {};
  const testPay = new URLSearchParams(location.search).has('testpay');
  const payLink = (testPay ? Pay.testLink : Pay.link) || '';
  const payOnline = /^https:\/\/buy\.stripe\.com\//.test(payLink);
  const checkoutReady = checkout?.available().then(available => {
    $('#checkoutProvince').hidden = !(available || payOnline);
    return available;
  });
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PRICE = { monthly: 99 };
  const DEAL_PRICE = 69; // Yearly C$950 and the Work Line are held outside launch billing.
  const dealOn = () => !document.documentElement.classList.contains('deal-over');
  const billing = 'monthly';

  /* ---------- The rolling price ---------- */
  const strips = [0, 1].map(() => {
    const digit = document.createElement('span');
    digit.className = 'roll-digit';
    const strip = document.createElement('span');
    strip.className = 'roll-strip';
    strip.innerHTML = [...'01234567890123456789'].map(n => `<i>${n}</i>`).join('');
    digit.append(strip);
    $('#roll').append(digit);
    return strip;
  });
  // Each digit is a strip of 0-9 twice. 99 uses the far 9 on the last digit, so that digit spins too.
  const CELLS = { monthly: [9, 19], yearly: [7, 9] };
  const showPrice = () => strips.forEach((strip, i) => {
    strip.style.transform = `translateY(calc(${CELLS[billing][i]} * -1.1em))`;
  });
  showPrice();

  // Monthly only until the yearly cancellation and refund policy is confirmed.

  /* ---------- Sending to Adrian's email ---------- */
  async function send(subject, fields) {
    if (!FORM_KEY) throw new Error('No form key yet');
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 15000);
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: FORM_KEY, subject, from_name: 'Ringleader website', ...fields }),
        signal: stop.signal,
      });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok || !answer.success) throw new Error(answer.message || 'Send failed');
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- Sign up early (Front Desk and Crew). No payment, it only tells Adrian. ---------- */
  const earlyKey = plan => `ringleader-early-${plan}`;
  const remember = (key, value) => { try { localStorage.setItem(key, value); } catch { /* fine */ } };
  const recall = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const markEarly = button => {
    const msg = button.nextElementSibling;
    button.disabled = true;
    button.textContent = "You're on the list";
    msg.hidden = false;
    msg.classList.remove('bad');
    msg.textContent = "We'll tell you when it launches. No payment taken.";
  };
  $$('[data-early]').forEach(button => {
    if (recall(earlyKey(button.dataset.early))) markEarly(button);
    button.addEventListener('click', async () => {
      const plan = button.dataset.early, msg = button.nextElementSibling;
      const who = Details.get() || await Details.ask({ title: `Sign up early for ${plan}`, button: 'Sign up early' });
      if (!who) return;
      drawWho();
      button.disabled = true;
      button.textContent = 'Sending...';
      msg.hidden = true;
      try {
        await send(`Ringleader: early sign-up for ${plan} (${who.business})`, { Plan: plan, Name: who.name, Business: who.business, email: who.email });
        remember(earlyKey(plan), '1');
        if (window.RingleaderLeads) RingleaderLeads.send('early', { email: who.email, name: who.name, business: who.business, plan });
        markEarly(button);
      } catch {
        button.disabled = false;
        button.textContent = 'Sign up early';
        msg.hidden = false;
        msg.classList.add('bad');
        msg.innerHTML = "That didn't send. Reach Adrian at papaadrian.0920@gmail.com or <a href=\"tel:+14372322281\">437-232-2281</a>.";
      }
    });
  });

  /* ---------- "Filling in as..." line, with a way to clear it on a shared computer ---------- */
  function drawWho() {
    const who = Details.get(), line = $('#whoLine');
    line.hidden = !who;
    if (!who) return;
    line.textContent = `Saved on this device: ${who.name}, ${who.business}. `;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Not you?';
    button.addEventListener('click', () => {
      Details.clear();
      ['fName', 'fBusiness', 'fEmail'].forEach(id => { $('#' + id).value = ''; });
      drawWho();
    });
    line.append(button);
  }
  drawWho();

  /* ---------- The sheet: filling in, checking, moving between steps ---------- */
  const sheet = $('#sheet'), stage = $('#stage'), view = $('#plans'), card = $('#textBack');
  const STEPS = 3;
  const lastLabel = payOnline ? 'Continue to payment' : 'Request setup';
  let step = 0, isOpen = false, moving = false, sent = false;

  const fill = () => {
    const who = Details.get();
    if (!who) return;
    $('#fName').value = who.name;
    $('#fBusiness').value = who.business;
    $('#fEmail').value = who.email;
  };

  const digitsOf = v => v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const okPhone = v => /^[2-9]\d{2}[2-9]\d{6}$/.test(digitsOf(v));
  const prettyPhone = v => digitsOf(v).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');

  const line = () => $('input[name="line"]:checked', sheet);
  const sameInvoice = () => $('#fSameInvoice').checked;

  function mark(input, message) {
    const err = $(`#${input.id}-err`);
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    err.textContent = message;
    err.hidden = !message;
    return !message;
  }

  function checkFirstStep() {
    const val = id => $('#' + id).value.trim();
    const email = (v, what) => !v ? `Add ${what}.` : Details.okEmail(v) ? '' : "That doesn't look like an email. Check for the @.";
    const results = [
      mark($('#fName'), val('fName') ? '' : 'Add your name.'),
      mark($('#fBusiness'), val('fBusiness') ? '' : 'Add your business name.'),
      mark($('#fPhone'), !val('fPhone') ? 'Add a phone number so we can reach you.' : okPhone(val('fPhone')) ? '' : "That doesn't look like a phone number. Try 10 digits, like 416-555-0182."),
      mark($('#fEmail'), email(val('fEmail'), 'your email')),
      mark($('#fInvoice'), sameInvoice() ? '' : email(val('fInvoice'), 'the email for your invoices')),
      mark($('#fTrade'), val('fTrade') ? '' : 'Pick your trade.'),
    ];
    const lineErr = $('#fLine-err');
    lineErr.textContent = line() ? '' : 'Pick the one that fits.';
    lineErr.hidden = !!line();
    $('#fLine').classList.toggle('bad', !line());
    return results.every(Boolean) && !!line();
  }

  let tried = false;
  sheet.addEventListener('input', () => { if (tried && step === 0) checkFirstStep(); });
  sheet.addEventListener('change', () => {
    $('#personalHint').hidden = line()?.value !== 'My personal cell';
    $('#invoiceWrap').hidden = sameInvoice();
    if (tried && step === 0) checkFirstStep();
    drawSummary();
  });
  $('#fPhone').addEventListener('blur', e => { if (okPhone(e.target.value)) e.target.value = prettyPhone(e.target.value); });
  $('#setupForm').addEventListener('submit', e => e.preventDefault());
  sheet.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); next(); }
  });

  function drawSummary() {
    const deal = dealOn();
    const money = n => 'C$' + n.toLocaleString('en-CA');
    $('#sumRows').innerHTML = `<div class="sum-row"><span>Text-Back, monthly</span><span>${deal ? `<s>${money(PRICE.monthly)}</s> ` : ''}${money(deal ? DEAL_PRICE : PRICE.monthly)} a month</span></div>`;
    $('#sumTotal').textContent = payOnline ? money(deal ? DEAL_PRICE : PRICE.monthly) : 'C$0';
    $('#sumSmall').textContent = deal
      ? 'Founding shop price for your first 3 months, then C$99 a month. Cancel anytime. Canadian dollars, plus applicable tax.'
      : 'C$99 a month. Cancel anytime. Canadian dollars, plus applicable tax.';
  }

  // Draws whichever step we're on. step === 'done' is the finished state.
  function draw() {
    const done = step === 'done';
    $$('.stepper li').forEach((li, i) => {
      const isDone = done || i < step;
      li.classList.toggle('is-done', isDone);
      li.classList.toggle('is-on', i === step);
      const button = $('button', li);
      button.disabled = done || i >= step;
      if (i === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== String(step); });
    $('#sheetNav').hidden = done;
    $('#navNext').textContent = step === STEPS - 1 ? lastLabel : 'Next';
    drawSummary();
  }

  function showStep(n, focus = true) {
    step = n;
    draw();
    if (!isOpen || !focus) return;
    window.scrollTo({ top: Math.max(0, stage.getBoundingClientRect().top + scrollY - 76), behavior: calm() ? 'auto' : 'smooth' });
    $('#sheetTitle').focus({ preventScroll: true });
  }

  let openingCheckout = false;
  async function next() {
    if (openingCheckout) return;
    if (step === 0) {
      tried = true;
      if (!checkFirstStep()) { $('[aria-invalid="true"], .pick.bad input', sheet)?.focus(); return; }
      Details.save({ email: $('#fEmail').value.trim(), name: $('#fName').value.trim(), business: $('#fBusiness').value.trim() });
      drawWho();
      const error = $('#checkoutError'), button = $('#navNext');
      error.hidden = true;
      openingCheckout = true;
      button.disabled = true;
      try {
        if (payOnline && !$('#fOntario').checked) {
          error.textContent = 'Confirm your shop is based in Ontario to pay online.';
          error.hidden = false;
          $('#fOntario').focus();
          return;
        }
        if (await checkoutReady) {
          if (!$('#fOntario').checked) {
            error.textContent = 'Confirm your shop is based in Ontario to pay online.';
            error.hidden = false;
            $('#fOntario').focus();
            return;
          }
          const val = id => $('#' + id).value.trim();
          button.textContent = 'Opening checkout…';
          await checkout.start({
            name: val('fName'), business: val('fBusiness'), email: val('fEmail'),
            invoiceEmail: sameInvoice() ? val('fEmail') : val('fInvoice'),
            phone: val('fPhone'), trade: val('fTrade'), line: line().value, province: 'ON',
          });
          return;
        }
      } catch (failure) {
        error.textContent = failure.name === 'TypeError' || failure.name === 'TimeoutError'
          ? 'Checkout could not open. Try again in a moment.'
          : failure.message;
        error.hidden = false;
        return;
      } finally {
        openingCheckout = false;
        button.disabled = false;
        button.textContent = 'Next';
      }
    }
    if (step === STEPS - 1) { sendSignUp(); return; }
    history.pushState({ step: step + 1 }, '', '#setup');
    showStep(step + 1);
  }
  $('#navNext').addEventListener('click', next);
  $('#navBack').addEventListener('click', () => history.back());
  $$('.stepper li').forEach((li, i) => $('button', li).addEventListener('click', () => {
    history.pushState({ step: i }, '', '#setup');
    showStep(i);
  }));

  async function sendSignUp() {
    const nextBtn = $('#navNext'), fail = $('#sendFail');
    const val = id => $('#' + id).value.trim();
    fail.hidden = true;
    if (val('fWebsite')) { fail.hidden = false; return; } // only a bot fills in the hidden box
    nextBtn.disabled = true;
    nextBtn.textContent = 'Sending...';
    const fields = {
      Plan: `Text-Back, ${billing}`,
      Price: dealOn() ? 'C$69 a month for 3 months, then C$99' : 'C$99 a month',
      'Due now': payOnline ? 'Paying now on Stripe' : 'C$0 — setup request',
      'Founding deal': billing === 'monthly' && dealOn() ? 'Yes' : 'No',
      Name: val('fName'),
      Business: val('fBusiness'),
      Trade: val('fTrade'),
      Phone: prettyPhone(val('fPhone')),
      email: val('fEmail'),
      'Invoice email': sameInvoice() ? val('fEmail') : val('fInvoice'),
      'Customers call': line().value,
      'Anything else': val('fMessage') || '-',
    };
    if (payOnline) { await goPay(fields); return; }
    try {
      await send(`Ringleader sign-up: ${fields.Business}`, fields);
      if (window.RingleaderLeads) RingleaderLeads.send('signup', { email: fields.email, name: fields.Name, business: fields.Business, plan: fields.Plan, trade: fields.Trade, phone: fields.Phone, invoiceEmail: fields['Invoice email'], customersCall: fields['Customers call'], foundingDeal: fields['Founding deal'] });
      sent = true;
      $('#doneLine').textContent = `Thanks, ${fields.Name}. We'll get back to you within a day at ${fields.Phone} or ${fields.email}, and set it up with you in about 20 minutes.`;
      history.replaceState({ step: 'done' }, '', '#setup');
      showStep('done');
    } catch {
      fail.hidden = false;
      fail.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
    } finally {
      nextBtn.disabled = false;
      nextBtn.textContent = lastLabel;
    }
  }

  // Tells Adrian who's on the way (email and Sheet), then opens Stripe's checkout with their email filled in.
  // The reference goes to Stripe too, so the payment can be matched to this sign-up.
  async function goPay(fields) {
    const ref = 'rl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const founding = dealOn() && Pay.foundingCode;
    const shop = { ...fields, 'Due now': `${founding ? 'C$69' : 'C$99'} on Stripe${testPay ? ' (TEST)' : ''}`, 'Stripe reference': ref };
    if (window.RingleaderLeads) RingleaderLeads.send('signup', { email: shop.email, name: shop.Name, business: shop.Business, plan: shop.Plan, trade: shop.Trade, phone: shop.Phone, invoiceEmail: shop['Invoice email'], line: shop['Customers call'], message: shop['Anything else'], payment: 'Went to Stripe checkout', stripeReference: ref });
    // Stripe has the payment either way, so a failed email doesn't stop them from paying.
    try { await send(`Ringleader sign-up, paying now: ${shop.Business}${testPay ? ' (TEST)' : ''}`, shop); } catch { /* Stripe still emails Adrian about the payment */ }
    // Save the form on our server under the same reference, so the new shop gets this name and email.
    // Waits at most 3 seconds: paying never depends on it.
    if (Pay.signupApi) {
      try {
        await Promise.race([
          fetch(Pay.signupApi, {
            method: 'POST', headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ ref, email: shop.email, business: shop.Business, owner: shop.Name, phone: shop.Phone }),
          }),
          new Promise(done => setTimeout(done, 3000)),
        ]);
      } catch { /* they still pay; Adrian can fix the name with shop-admin.js */ }
    }
    const url = new URL(payLink);
    url.searchParams.set('prefilled_email', shop['Invoice email']);
    url.searchParams.set('client_reference_id', ref);
    if (founding) url.searchParams.set('prefilled_promo_code', Pay.foundingCode);
    location.assign(url.toString());
  }

  /* ---------- The move: Text-Back card <-> sheet. Only transform and opacity animate. ---------- */
  const EASE = 'cubic-bezier(.32, .72, 0, 1)';
  const radiusOf = el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const widthOf = el => parseFloat(getComputedStyle(el).borderTopWidth) || 0;
  // Wait for the move to end. Browsers pause animations in background tabs, so never wait forever.
  const settled = anims => Promise.race([
    Promise.allSettled(anims.map(a => a.finished)),
    new Promise(done => setTimeout(done, 900)),
  ]);

  // The surface starts (or ends) exactly on top of the card. Corners and border are un-stretched as it scales.
  const cardShape = (from, to, surface, r, b) => {
    const sx = from.width / to.width, sy = from.height / to.height;
    return {
      transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`,
      borderRadius: `${r / sx}px / ${r / sy}px`,
      borderWidth: `${b / sy}px ${b / sx}px`,
    };
  };

  async function openSheet() {
    if (isOpen || moving) return;
    moving = true;
    isOpen = true;
    const body = $('.sheet-body'), surface = $('.sheet-surface');
    const animate = !calm();
    const viewHeight = view.offsetHeight;
    const first = card.getBoundingClientRect();
    const cardR = radiusOf(card), cardB = widthOf(card);
    const others = $$('.card', view).filter(c => c !== card);

    fill();
    showStep(typeof step === 'number' ? step : 0, false);
    stage.classList.add('is-open');
    sheet.hidden = false;
    if (animate) {
      stage.style.minHeight = viewHeight + 'px'; // keeps the page from jumping while things swap
      stage.classList.add('moving');
      const last = surface.getBoundingClientRect();
      const anims = [
        surface.animate([cardShape(first, last, surface, cardR, cardB), { transform: 'none', borderRadius: `${radiusOf(surface)}px`, borderWidth: `${widthOf(surface)}px` }], { duration: 520, easing: EASE }),
        body.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 220, easing: 'ease-out', fill: 'backwards' }),
        ...[...card.children].map(child => child.animate({ opacity: [1, 0] }, { duration: 140, easing: 'ease-out', fill: 'forwards' })),
        ...others.map((c, i) => c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${i ? 18 : -18}px) scale(.98)` }], { duration: 240, easing: 'ease-out', fill: 'forwards' })),
        ...[$('.bill'), $('.su-foot')].map(el => el.animate({ opacity: [1, 0] }, { duration: 160, fill: 'forwards' })),
      ];
      window.scrollTo({ top: Math.max(0, stage.getBoundingClientRect().top + scrollY - 76), behavior: 'smooth' });
      await settled(anims);
      anims.forEach(a => a.cancel());
      stage.classList.remove('moving');
      stage.style.minHeight = '';
    } else {
      window.scrollTo(0, Math.max(0, stage.getBoundingClientRect().top + scrollY - 76));
    }
    view.hidden = true;
    moving = false;
    $('#sheetTitle').focus({ preventScroll: true });
  }

  async function closeSheet() {
    if (!isOpen || moving) return;
    moving = true;
    isOpen = false;
    const body = $('.sheet-body'), surface = $('.sheet-surface');
    if (!calm()) {
      const sheetHeight = sheet.offsetHeight;
      view.hidden = false;
      stage.classList.add('moving');
      stage.style.minHeight = Math.max(view.offsetHeight, sheetHeight) + 'px';
      const to = card.getBoundingClientRect();
      const now = surface.getBoundingClientRect();
      const others = $$('.card', view).filter(c => c !== card);
      const anims = [
        surface.animate([{ transform: 'none', borderRadius: `${radiusOf(surface)}px`, borderWidth: `${widthOf(surface)}px` }, cardShape(to, now, surface, 22, 1.5)], { duration: 420, easing: EASE, fill: 'forwards' }),
        body.animate({ opacity: [1, 0] }, { duration: 140, fill: 'forwards' }),
        ...[...card.children].map(child => child.animate({ opacity: [0, 1] }, { duration: 220, delay: 200, fill: 'backwards' })),
        ...others.map(c => c.animate({ opacity: [0, 1] }, { duration: 260, delay: 180, fill: 'backwards' })),
        ...[$('.bill'), $('.su-foot')].map(el => el.animate({ opacity: [0, 1] }, { duration: 260, delay: 180, fill: 'backwards' })),
      ];
      window.scrollTo({ top: Math.max(0, stage.getBoundingClientRect().top + scrollY - 76), behavior: 'smooth' });
      await settled(anims);
      sheet.hidden = true;
      anims.forEach(a => a.cancel());
      stage.classList.remove('moving');
      stage.style.minHeight = '';
    } else {
      view.hidden = false;
      sheet.hidden = true;
    }
    stage.classList.remove('is-open');
    moving = false;
    if (sent) { sent = false; step = 0; }
    $('#getStarted').focus({ preventScroll: true });
  }

  /* ---------- Get started ---------- */
  $('#getStarted').addEventListener('click', async () => {
    if (!Details.get()) {
      const who = await Details.ask();
      if (!who) return;
      drawWho();
    }
    step = 0;
    history.pushState({ step: 0 }, '', '#setup');
    openSheet();
  });

  // The phone's back button walks back through the steps, then out to the plans.
  addEventListener('popstate', e => {
    const to = e.state && e.state.step;
    if (to === undefined || to === null) { closeSheet(); return; }
    if (sent) { showStep('done'); return; }
    if (!isOpen) { step = to; openSheet(); return; }
    showStep(to);
  });
  // A refresh in the middle starts back at the plans, with nothing half-shown.
  if (location.hash === '#setup') history.replaceState(null, '', location.pathname + location.search);
  draw();

  // The payment step says what happens next when paying online.
  if (payOnline) {
    $('#payTest').hidden = !testPay;
    $('#payTitle').textContent = 'Pay securely with Stripe.';
    $('#payNote').textContent = "Next, Stripe's checkout opens so you can pay by card. Your plan starts today and renews monthly until you cancel. We'll text you within a day to set up your number.";
  }

  // Back from Stripe after paying (the Payment Link sends people to contact.html?paid=1).
  if (new URLSearchParams(location.search).has('paid')) {
    isOpen = true;
    sent = true;
    view.hidden = true;
    sheet.hidden = false;
    stage.classList.add('is-open');
    step = 'done';
    draw();
    $('#doneTitle').textContent = "You're paid up. Thank you!";
    $('#doneLine').textContent = "Stripe emailed your receipt. Adrian will text you within a day to set up your number, which takes about 20 minutes.";
    $('#doneSmall').innerHTML = 'Questions? Call or text <a href="tel:+14372322281">437-232-2281</a>.' +
      (Pay.portal ? ` Change your card or cancel anytime <a href="${Pay.portal}">here</a>.` : '');
  }
})();
