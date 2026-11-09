// The circle in the top right of every page: who this browser is, and where they are.
//  - Not signed up yet: a "Sign in" link (for owners who already have a dashboard).
//  - Gave their name and email: their initials. The menu says what's next (see the plans, finish setup, or open the dashboard).
//  - Paid but not finished: a lime dot, a bar across the top, and the plans page sends them back to finish.
// It's saved in this browser only (localStorage). The real sign-in is the dashboard's email and password.
(() => {
  const KEY = 'ringleader-account';
  const Pay = window.RingleaderPay || {};
  const Details = window.RingleaderDetails;
  let memory = null;

  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)) || memory; } catch { return memory; } };
  const save = account => {
    memory = { ...(get() || {}), ...account };
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* memory still has it */ }
    return memory;
  };
  const clear = () => { memory = null; try { localStorage.removeItem(KEY); } catch { /* nothing saved */ } };

  // Testing on this computer: ?api=http://localhost:3000 points the pages at a local server.
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const api = () => {
    let given = '';
    try {
      given = local ? new URLSearchParams(location.search).get('api') || sessionStorage.getItem('ringleader-api') || '' : '';
      if (given) sessionStorage.setItem('ringleader-api', given);
    } catch { /* fine */ }
    return (given || Pay.api || 'https://api.getringleader.ca').replace(/\/+$/, '');
  };
  const dashboardUrl = () => api() + '/new/';
  const finishUrl = account => 'welcome.html?session_id=' + encodeURIComponent(account.session);
  // 'none' | 'details' (gave name and email) | 'setup' (paid, not finished) | 'done'
  const stage = () => {
    const account = get();
    if (account && account.session && account.step !== 'done') return 'setup';
    if (account && account.step === 'done') return 'done';
    return Details && Details.get() ? 'details' : 'none';
  };

  window.RingleaderAccount = { get, save, clear, api, dashboardUrl, finishUrl, stage };

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const initials = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  function draw() {
    const head = document.querySelector('header.top .wrap');
    if (!head || document.body.dataset.noAccount !== undefined) return;
    head.querySelector('.me')?.remove();
    const account = get() || {};
    const who = (Details && Details.get()) || {};
    const name = account.owner || who.name || '';
    const email = account.email || who.email || '';
    const business = account.business || who.business || '';
    const now = stage();
    const box = document.createElement('div');
    box.className = 'me';

    if (now === 'none') {
      box.innerHTML = `<a class="me-signin" href="${esc(dashboardUrl())}login.html">Sign in</a>`;
      head.append(box);
      return;
    }

    const action = {
      details: ['See plans and sign up', 'contact.html', 'Not signed up yet'],
      setup: ['Finish setting up', finishUrl(account), 'Paid · 2 steps left'],
      done: ['Open my dashboard', dashboardUrl(), 'Ringleader is on']
    }[now];
    box.innerHTML = `<button type="button" class="me-btn" aria-haspopup="true" aria-expanded="false" aria-label="Your account: ${esc(name || email)}">
        <span class="me-circle">${esc(initials(name || email))}</span>${now === 'setup' ? '<span class="me-dot" aria-hidden="true"></span>' : ''}
      </button>
      <div class="me-menu" hidden>
        <p class="me-name">${esc(name || 'You')}</p>
        ${business ? `<p class="me-line">${esc(business)}</p>` : ''}
        ${email ? `<p class="me-line">${esc(email)}</p>` : ''}
        <p class="me-state me-state-${now}">${action[2]}</p>
        <a class="me-go" href="${esc(action[1])}">${action[0]}</a>
        ${now === 'details' ? `<a class="me-link" href="${esc(dashboardUrl())}login.html">Already a customer? Sign in</a>` : ''}
        ${now === 'setup' ? '' : '<button type="button" class="me-link me-forget">Not you? Forget me on this device</button>'}
      </div>`;
    head.append(box);
    const btn = box.querySelector('.me-btn'), menu = box.querySelector('.me-menu');
    const open = yes => { menu.hidden = !yes; btn.setAttribute('aria-expanded', String(yes)); };
    btn.addEventListener('click', e => { e.stopPropagation(); open(menu.hidden); });
    document.addEventListener('click', e => { if (!box.contains(e.target)) open(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
    box.querySelector('.me-forget')?.addEventListener('click', () => {
      clear();
      Details && Details.clear();
      draw();
      location.reload();
    });
  }

  // Paid but not finished: a bar across the top of every page (except the setup page itself) brings them back.
  function nudge() {
    if (stage() !== 'setup' || document.body.dataset.noAccount !== undefined) return;
    const bar = document.createElement('a');
    bar.className = 'finish-bar';
    bar.href = finishUrl(get());
    bar.innerHTML = "<b>You've paid.</b> Finish setting up your shop (about 10 minutes) <span aria-hidden=\"true\">→</span>";
    document.body.prepend(bar);
  }

  const go = () => { draw(); nudge(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  window.addEventListener('ringleader-details', draw); // signin.js fires this when they type their name and email
})();
