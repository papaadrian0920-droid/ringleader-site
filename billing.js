// No card inputs or customer details are sent to the marketing form service.
(() => {
  const $ = id => document.getElementById(id);
  const money = cents => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100).replace('$', 'C$');
  const date = value => value ? new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Toronto' }) : '';
  const hasCurrentPayment = data => Date.parse(data?.paidThrough) > Date.now();
  // GitHub Pages serves /pay/. On localhost the Node server serves both the page and API.
  const apiOrigin = location.origin === 'https://getringleader.ca' ? 'https://billing.getringleader.ca' : '';
  const returning = new URLSearchParams(location.search).has('return');
  let token = '', details = null, embedded = null, stripeActions = null, stripeCanConfirm = false;
  let busy = false, paypalSession = null, paypalKey = '', pollTimer = null;
  function message(id, text) { $(id).textContent = text; $(id).hidden = !text; }
  if (window.top !== window.self) {
    message('notice', 'Open your private Ringleader payment link in its own tab.');
    return;
  }
  const fragment = location.hash.slice(1);
  try {
    if (/^[A-Za-z0-9_-]{43}$/.test(fragment)) { sessionStorage.setItem('ringleader-billing-token', fragment); token = fragment; }
    else token = sessionStorage.getItem('ringleader-billing-token') || '';
  } catch { token = /^[A-Za-z0-9_-]{43}$/.test(fragment) ? fragment : ''; }
  // Fragments do not reach the server; remove it from browser history before loading any provider script.
  history.replaceState(null, '', location.pathname);
  function setBusy(value) {
    busy = value;
    for (const id of ['cardButton','abandonButton','refreshButton','manageButton','cancelButton','confirmCancel']) $(id).disabled = value;
    $('paypalButton').toggleAttribute('disabled', value);
    updateStripePayButton();
  }
  function updateStripePayButton() { $('stripePayButton').disabled = busy || !stripeCanConfirm; }
  async function api(route, body) {
    const response = await fetch(apiOrigin + '/api/billing/' + route, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'That request could not be completed. Please try again.');
    return data;
  }
  const scripts = new Map();
  function script(src) {
    if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => {
      const tag = document.createElement('script'); tag.src = src; tag.async = true;
      tag.onload = resolve; tag.onerror = () => { scripts.delete(src); tag.remove(); reject(new Error('The payment provider could not load. Try again or ask Ringleader for an invoice.')); };
      document.head.append(tag);
    }));
    return scripts.get(src);
  }
  async function setupPayPal(data) {
    const key = `${data.mode}:${data.methods.paypalClientId}`;
    if (paypalKey === key) return;
    paypalKey = key;
    try {
      await script(data.mode === 'live' ? 'https://www.paypal.com/web-sdk/v6/core' : 'https://www.sandbox.paypal.com/web-sdk/v6/core');
      const sdk = await window.paypal.createInstance({ clientId: data.methods.paypalClientId, components: ['paypal-subscriptions'], pageType: 'checkout' });
      const eligible = await sdk.findEligibleMethods({ paymentFlow: 'RECURRING_PAYMENT', currencyCode: 'CAD' });
      if (!eligible.isEligible('paypal')) { $('paypalHint').textContent = 'PayPal subscriptions are unavailable for this session. Ask us for a PayPal invoice.'; return; }
      paypalSession = sdk.createPayPalSubscriptionPaymentSession({
        async onApprove() { setBusy(false); await refresh(); startPolling(); },
        async onCancel() { setBusy(false); message('notice', 'PayPal approval was cancelled. No payment is confirmed. You can retry or cancel the pending checkout.'); await loadStatus(); },
        async onError() { setBusy(false); message('error', 'PayPal could not complete approval. Retry PayPal or contact Ringleader before choosing another method.'); await loadStatus(); },
      });
      $('paypalButton').hidden = false; $('paypalHint').hidden = true;
    } catch (error) { paypalKey = ''; $('paypalHint').textContent = error.message; }
  }
  function render(data) {
    details = data;
    const paid = hasCurrentPayment(data);
    if (embedded && (data.subscribed || data.pending?.provider !== 'stripe')) closeStripeCheckout();
    $('billingBody').hidden = false; $('testBanner').hidden = data.mode !== 'test';
    $('paymentTitle').textContent = data.subscribed ? 'Manage your subscription' : embedded ? 'Payment details' : data.canCheckout ? 'Payment method' : 'Billing overview';
    $('shopName').textContent = data.business;
    $('intro').textContent = `Monthly billing for ${data.business}. Your setup is approved before your first payment.`;
    $('subtotal').textContent = money(data.subtotal) + ' / month';
    $('taxLabel').textContent = data.taxStatus === 'registered' ? 'Ontario HST (13%)' : 'Tax';
    $('tax').textContent = data.tax === null ? 'To be confirmed' : money(data.tax);
    $('total').textContent = data.total === null ? 'To confirm' : money(data.canCheckout ? data.total : 0);
    if (data.total !== null) $('stripePayButton').textContent = `Subscribe and pay ${money(data.total)}`;
    $('renewal').textContent = data.remainingIntro ? `${money(6900)} a month for ${data.remainingIntro} remaining introductory month${data.remainingIntro === 1 ? '' : 's'}, then ${money(9900)} a month, plus applicable tax.` : `${money(9900)} a month, plus applicable tax.`;
    $('dates').textContent = [data.paidThrough ? `Paid through ${date(data.paidThrough)}.` : '', data.nextDue && !data.cancelAtPeriodEnd ? `Next renewal: ${date(data.nextDue)}.` : '', data.cancelAtPeriodEnd || data.state === 'cancelled' ? 'Automatic renewal is cancelled.' : ''].filter(Boolean).join(' ');
    $('taxNumber').hidden = !data.gstNumber; $('taxNumber').textContent = data.gstNumber ? `GST/HST registration: ${data.gstNumber}` : '';
    $('support').href = `mailto:${data.supportEmail}`;
    $('billingTerms').textContent = data.state === 'manual' && !data.subscribed ? 'Your invoice was paid manually. No automatic subscription is active. You can start automatic monthly billing on the next unpaid service date.' : 'Canadian dollars. Automatic monthly renewal until you cancel. Cancel before your next renewal to stop future charges.';
    $('methods').hidden = !data.canCheckout || Boolean(embedded);
    $('cardButton').hidden = !data.methods.stripe || (data.pending && data.pending.provider !== 'stripe');
    $('cardButton').querySelector('b').textContent = data.pending?.provider === 'stripe' ? 'Resume card checkout' : 'Card or Apple Pay';
    $('paypalWrap').hidden = !data.canCheckout || !data.methods.paypal || Boolean(embedded) || (data.pending && data.pending.provider !== 'paypal');
    $('abandonButton').hidden = !data.pending;
    $('manage').hidden = !data.subscribed && !['cancelled','expired'].includes(data.state);
    $('cancelButton').hidden = !data.subscribed || data.cancelAtPeriodEnd;
    $('paymentState').textContent = data.cancelAtPeriodEnd || data.state === 'cancelled' ? 'Your automatic renewal is cancelled. Your already paid service period is unchanged.' : paid ? 'Your subscription is set up. You can manage payment details or stop your next renewal here.' : 'Subscription approval is received. We are waiting for payment confirmation.';
    if (data.attention) message('notice', 'Your billing needs a quick review. Contact Ringleader if you need help.');
    else if (data.subscribed && !paid) message('notice', 'Waiting for your payment to be confirmed.');
    else if (data.subscribed) message('notice', 'Payment confirmed. Your subscription is active.');
    else if (data.block) message('notice', data.block);
    else if (!data.methods.stripe && !data.methods.paypal) message('notice', 'Online payments are being prepared. Contact Ringleader for an invoice.');
    else message('notice', '');
    $('receiptsSection').hidden = data.receipts.length === 0;
    $('receipts').replaceChildren(...data.receipts.map(receipt => {
      const li = document.createElement('li'), label = document.createElement('span'), amount = document.createElement('strong');
      label.textContent = `${date(receipt.paidAt)} · ${receipt.status}`; amount.textContent = money(receipt.amount); li.append(label, amount);
      if (receipt.url) { const link = document.createElement('a'); link.href = receipt.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View receipt'; li.append(link); }
      return li;
    }));
    if (data.canCheckout && data.methods.paypal && !embedded) setupPayPal(data);
  }
  async function loadStatus() { render(await api('status')); }
  async function run(work) {
    if (busy) return;
    setBusy(true); message('error', '');
    try { await work(); } catch (error) {
      if (error.name === 'TimeoutError') message('error', 'That took longer than expected. Check payment status before trying another payment.');
      else if (error.name === 'TypeError') message('error', 'The billing connection could not load. Try again or contact Ringleader for an invoice.');
      else message('error', error.message);
    }
    finally { setBusy(false); }
  }
  async function refresh() { try { render(await api('refresh', {})); } catch (error) { message('error', error.message); } }
  function startPolling() {
    clearTimeout(pollTimer);
    let count = 0;
    const poll = async () => {
      await loadStatus().catch(() => {});
      if (!hasCurrentPayment(details) && count++ < 12) pollTimer = setTimeout(poll, 5000);
    };
    pollTimer = setTimeout(poll, 2000);
  }
  async function completeStripeCheckout() {
    await refresh();
    if (!hasCurrentPayment(details)) startPolling();
  }
  function closeStripeCheckout() {
    stripeActions = null;
    stripeCanConfirm = false;
    embedded?.destroy();
    embedded = null;
    $('checkout').hidden = true;
    $('legacyCheckout').hidden = true;
    $('stripeElements').hidden = true;
    message('stripeError', '');
  }
  async function confirmStripe(options = {}) {
    message('stripeError', '');
    const result = await stripeActions.confirm({ redirect: 'if_required', ...options });
    if (result.type === 'error') {
      message('stripeError', result.error.message || 'Check your payment details and try again.');
      return;
    }
    await completeStripeCheckout();
  }
  async function prepareStripeCheckout(result) {
    await script('https://js.stripe.com/endive/stripe.js');
    const stripe = window.Stripe(result.publishableKey);
    if (result.style === 'embedded') {
      const page = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret: async () => result.clientSecret, onComplete: completeStripeCheckout });
      return {
        mount() { $('legacyCheckout').hidden = false; page.mount('#legacyCheckout'); },
        destroy() { page.destroy(); },
      };
    }
    const theme = getComputedStyle(document.documentElement);
    const color = name => theme.getPropertyValue(name).trim();
    const checkout = stripe.initCheckoutElementsSdk({
      clientSecret: result.clientSecret,
      elementsOptions: {
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: color('--hivis'), colorPrimaryText: color('--on-hivis'),
            colorBackground: color('--bg-2'), colorText: color('--ink'),
            colorTextSecondary: color('--soft'), borderRadius: '10px',
          },
        },
      },
    });
    const loaded = await checkout.loadActions();
    if (loaded.type !== 'success') throw new Error('Stripe could not open this checkout. Cancel it and try again.');
    const { actions } = loaded;
    const card = checkout.createPaymentElement({ layout: 'accordion', wallets: { applePay: 'never', googlePay: 'never' } });
    const wallet = checkout.createExpressCheckoutElement({ buttonTheme: { applePay: 'white-outline' } });
    checkout.on('change', session => {
      if (stripeActions !== actions) return;
      stripeCanConfirm = session.canConfirm;
      updateStripePayButton();
    });
    wallet.on('ready', ({ availablePaymentMethods }) => {
      if (stripeActions !== actions) return;
      const showWallet = Object.values(availablePaymentMethods || {}).some(Boolean);
      $('stripeWallet').hidden = !showWallet;
      $('walletDivider').hidden = !showWallet;
    });
    wallet.on('confirm', event => {
      if (busy || stripeActions !== actions) { event.paymentFailed(); return; }
      run(() => confirmStripe({ expressCheckoutConfirmEvent: event }));
    });
    return {
      mount() {
        stripeActions = actions;
        stripeCanConfirm = actions.getSession().canConfirm;
        updateStripePayButton();
        $('stripeElements').hidden = false;
        $('stripeWallet').hidden = false;
        $('walletDivider').hidden = true;
        card.mount('#paymentElement');
        wallet.mount('#expressCheckout');
      },
      destroy() { wallet.destroy(); card.destroy(); },
    };
  }
  $('cardButton').addEventListener('click', () => run(async () => {
    const result = await api('checkout', { provider: 'stripe' });
    if (result.style === 'hosted') { location.assign(result.url); return; }
    $('abandonButton').hidden = false;
    embedded = await prepareStripeCheckout(result);
    $('checkout').hidden = false;
    try { embedded.mount(); } catch (error) { closeStripeCheckout(); throw error; }
    $('methods').hidden = true;
    $('paymentTitle').textContent = 'Payment details';
    $('checkout').focus({ preventScroll: true });
  }));
  $('stripeElements').addEventListener('submit', event => {
    event.preventDefault();
    if (stripeActions && stripeCanConfirm) run(() => confirmStripe());
  });
  $('paypalButton').addEventListener('click', () => {
    if (busy || !paypalSession) return;
    setBusy(true); message('error', '');
    // Keep the buyer's click activation: pass a promise directly to the v6 session.
    const subscription = api('checkout', { provider: 'paypal' }).then(result => ({ subscriptionId: result.id }));
    paypalSession.start({ presentationMode: 'auto' }, subscription).catch(() => {
      setBusy(false); message('error', 'PayPal could not start. Retry the same method or check payment status.'); loadStatus().catch(() => {});
    });
  });
  $('refreshButton').addEventListener('click', () => run(refresh));
  $('abandonButton').addEventListener('click', () => run(async () => {
    const data = await api('abandon', {});
    closeStripeCheckout();
    render(data);
  }));
  $('manageButton').addEventListener('click', () => run(async () => { location.assign((await api('manage', {})).url); }));
  $('cancelButton').addEventListener('click', () => $('cancelDialog').showModal());
  $('cancelDialog').addEventListener('close', () => { if ($('cancelDialog').returnValue === 'cancel') run(async () => render(await api('cancel', {}))); });
  if (!token) { message('notice', 'Open the private payment link in your setup email. If it has expired, ask Ringleader for a new one.'); return; }
  run(async () => { await loadStatus(); if (returning || details.pending || details.subscribed) { await refresh(); if (!hasCurrentPayment(details)) startPolling(); } });
})();
