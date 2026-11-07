// No card inputs or customer details are sent to the marketing form service.
(() => {
  const $ = id => document.getElementById(id);
  const money = cents => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100).replace('$', 'C$');
  const date = value => value ? new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Toronto' }) : '';
  let token = '', details = null, embedded = null, busy = false, paypalSession = null, paypalKey = '', pollTimer = null;
  const fragment = location.hash.slice(1);
  try {
    if (/^[A-Za-z0-9_-]{43}$/.test(fragment)) { sessionStorage.setItem('ringleader-billing-token', fragment); token = fragment; }
    else token = sessionStorage.getItem('ringleader-billing-token') || '';
  } catch { token = /^[A-Za-z0-9_-]{43}$/.test(fragment) ? fragment : ''; }
  // Fragments do not reach the server; remove it from browser history before loading any provider script.
  history.replaceState(null, '', location.pathname);
  function message(id, text) { $(id).textContent = text; $(id).hidden = !text; }
  function setBusy(value) {
    busy = value;
    for (const id of ['cardButton','abandonButton','refreshButton','manageButton','cancelButton','confirmCancel']) $(id).disabled = value;
    $('paypalButton').toggleAttribute('disabled', value);
  }
  async function api(route, body) {
    const response = await fetch('/api/billing/' + route, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store',
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
    $('billingBody').hidden = false; $('testBanner').hidden = data.mode !== 'test';
    $('paymentTitle').textContent = data.canCheckout ? 'Choose how to pay' : data.subscribed ? 'Manage your subscription' : 'Billing overview';
    $('shopName').textContent = data.business;
    $('intro').textContent = `Monthly billing for ${data.business}. Your setup is approved before your first payment.`;
    $('subtotal').textContent = money(data.subtotal) + ' / month';
    $('taxLabel').textContent = data.taxStatus === 'registered' ? 'Ontario HST (13%)' : 'Tax';
    $('tax').textContent = data.tax === null ? 'To be confirmed' : money(data.tax);
    $('total').textContent = data.total === null ? 'To confirm' : money(data.canCheckout ? data.total : 0);
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
    $('paymentState').textContent = data.cancelAtPeriodEnd || data.state === 'cancelled' ? 'Your automatic renewal is cancelled. Your already paid service period is unchanged.' : data.paidThrough ? 'Your subscription is set up. You can manage payment details or stop your next renewal here.' : 'Subscription approval is received. We are waiting for payment confirmation.';
    if (data.subscribed && embedded) { embedded.destroy(); embedded = null; $('checkout').hidden = true; }
    if (data.block) message('notice', data.block);
    else if (data.attention) message('notice', 'Your billing needs a quick review. Contact Ringleader; your phone service has not been automatically stopped.');
    else if (data.subscribed && !data.paidThrough) message('notice', 'Waiting for payment confirmation. Please do not start another payment.');
    else if (data.subscribed) message('notice', 'Your subscription is set up. Payment details are below.');
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
    try { await work(); } catch (error) { message('error', error.name === 'TimeoutError' ? 'That took longer than expected. Check payment status before trying another payment.' : error.message); }
    finally { setBusy(false); }
  }
  async function refresh() { try { render(await api('refresh', {})); } catch (error) { message('error', error.message); } }
  function startPolling() {
    clearTimeout(pollTimer);
    let count = 0;
    const poll = async () => {
      await loadStatus().catch(() => {});
      if (!details?.paidThrough && count++ < 12) pollTimer = setTimeout(poll, 5000);
    };
    pollTimer = setTimeout(poll, 2000);
  }
  $('cardButton').addEventListener('click', () => run(async () => {
    const result = await api('checkout', { provider: 'stripe' });
    if (result.style === 'hosted') { location.assign(result.url); return; }
    await script('https://js.stripe.com/endive/stripe.js');
    if (embedded) embedded.destroy();
    embedded = await window.Stripe(result.publishableKey).createEmbeddedCheckoutPage({ fetchClientSecret: async () => result.clientSecret, onComplete: async () => { await refresh(); startPolling(); } });
    $('checkout').hidden = false; $('methods').hidden = true; $('abandonButton').hidden = false;
    embedded.mount('#checkout');
  }));
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
    if (embedded) { embedded.destroy(); embedded = null; $('checkout').hidden = true; }
    render(data);
  }));
  $('manageButton').addEventListener('click', () => run(async () => { location.assign((await api('manage', {})).url); }));
  $('cancelButton').addEventListener('click', () => $('cancelDialog').showModal());
  $('cancelDialog').addEventListener('close', () => { if ($('cancelDialog').returnValue === 'cancel') run(async () => render(await api('cancel', {}))); });
  if (!token) { message('notice', 'Open the private payment link in your setup email. If it has expired, ask Ringleader for a new one.'); return; }
  run(async () => { await loadStatus(); if (details.pending || details.subscribed) { await refresh(); startPolling(); } });
})();
