// Right after paying, Stripe brings the shop here in the same tab: welcome.html?session_id=cs_...
// Everything happens on this one page, in order, with no way to skip:
//   2. the shop questions (setup.js draws them, this file saves them),
//   3. make a password,
//   4. their dashboard opens, signed in, with their answers already in it.
// Our server does the work (server/src/onboarding.js). The Stripe session id in the address is the key until they have a password.
// Loaded before setup.js, which looks for window.RingleaderWelcome.
(() => {
  const $ = s => document.querySelector(s);
  const Account = window.RingleaderAccount;
  const params = new URLSearchParams(location.search);
  const fromStripe = params.get('session_id') || '';
  const before = Account.get() || {};
  // A new payment code in the address starts fresh. Otherwise, pick up where this browser left off.
  const saved = fromStripe && fromStripe !== before.session ? {} : before;
  const session = fromStripe || saved.session || '';
  const API = Account.api();
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(done => setTimeout(done, ms));

  let who = null;        // what our server knows: email, business, owner, phone, step
  let step = 'questions';
  let finished = false;  // once the dashboard is opening, closing the tab is fine
  let stopped = false;   // stop asking our server (after the hand-off to Adrian)

  async function post(name, body = {}) {
    const res = await fetch(`${API}/api/onboarding/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ session, ...body })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  }

  /* ---------- what the page shows ---------- */
  function track(now) {
    const order = ['paid', 'questions', 'password', 'dashboard'];
    document.querySelectorAll('#track li').forEach(li => {
      const i = order.indexOf(li.dataset.track), at = order.indexOf(now);
      li.classList.toggle('is-done', i < at);
      li.classList.toggle('is-on', i === at);
      if (i === at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }
  function head(title, lead) {
    $('#wlTitle').innerHTML = title;
    $('#wlLead').textContent = lead;
  }
  function top() {
    window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
    $('#wlTitle').focus({ preventScroll: true });
  }
  function note(text) {
    const box = $('#wlWait');
    box.hidden = !text;
    box.textContent = text || '';
  }

  function showQuestions() {
    step = 'questions';
    track('questions');
    $('#setup').hidden = false;
    $('#passBox').hidden = true;
    $('#stopBox').hidden = true;
  }

  function showPassword() {
    step = 'password';
    track('password');
    $('#wlPaid').hidden = true;
    head('Last step: <span class="hi">make your password.</span>', "That's it. Your dashboard opens as soon as you tap the button.");
    $('#setup').hidden = true;
    $('#stopBox').hidden = true;
    $('#passBox').hidden = false;
    $('#wlEmail').value = (who && who.email) || '';
    // The address changes so a refresh lands on this step. Same page, same tab.
    history.replaceState(null, '', 'welcome.html?step=password');
    top();
    setTimeout(() => $('#wlPass').focus({ preventScroll: true }), calm() ? 0 : 350);
  }

  function showStop(text, button) {
    $('#setup').hidden = true;
    $('#passBox').hidden = true;
    $('#stopBox').hidden = false;
    $('#stopText').innerHTML = text;
    const go = $('#stopGo');
    go.hidden = !button;
    if (button) { go.textContent = button[0]; go.href = button[1]; }
  }

  function showDone() {
    finished = true;
    step = 'done';
    track('dashboard');
    Account.save({ step: 'done' });
    $('#wlPaid').hidden = true;
    head("You're <span class=\"hi\">all set.</span>", 'Your account is ready. Sign in with your email and the password you made.');
    showStop('Forgot the password? The sign-in page can email you a new one.', ['Open my dashboard', Account.dashboardUrl()]);
  }

  /* ---------- 1. Is the payment in? ---------- */
  // Fills the questions with what they typed before paying, without overwriting anything they changed.
  function prefill() {
    const fill = (id, value) => {
      const input = document.getElementById('f-' + id);
      if (input && !input.value && value) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
    };
    fill('business', who.business);
    fill('owner', who.owner);
    fill('replier', (who.owner || '').split(' ')[0]);
    fill('email', who.email);
    fill('ownerPhone', (who.phone || '').replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3'));
  }

  let ready = null; // resolves with the server's answer once the payment is in
  async function checkPayment() {
    const started = Date.now();
    for (let tries = 0; !stopped; tries++) {
      let answer;
      try { answer = await post('status'); } catch { answer = { state: 'offline' }; }
      if (stopped) break;
      if (answer.state === 'ready') {
        note('');
        who = answer;
        Account.save({ session, step: answer.step, email: answer.email, business: answer.business, owner: answer.owner });
        $('#wlPaidText').textContent = `Payment received. Thank you! Stripe is emailing your receipt to ${answer.email}.`;
        return answer;
      }
      if (answer.status === 400) return answer; // not a real payment code
      const secs = (Date.now() - started) / 1000;
      if (secs > 120) note("We haven't heard from Stripe yet. Keep going: your answers are saved on this device. If it doesn't show up soon, we'll text you to finish.");
      else if (secs > 15) note('Stripe is taking a moment to confirm. Keep going with the questions; we\'ll catch up.');
      else note(answer.state === 'offline' ? 'Connecting to Ringleader...' : 'Confirming your payment with Stripe...');
      await wait(secs > 120 ? 10000 : 2000);
    }
  }

  /* ---------- 2. Save the answers (setup.js calls this when they tap Save and continue) ---------- */
  // If our server can't confirm the payment (Stripe is slow, or our server is down), the answers go to Adrian
  // instead and the shop is told he'll text them their sign-in. They never get stuck on an error after paying.
  const handOff = message => Object.assign(new Error(message), { handOff: true });
  async function saveAnswers(body, say) {
    let trouble = 0;
    for (let tries = 0; tries < 15; tries++) {
      let answer;
      try { answer = await post('answers', body); } catch { answer = null; }
      if (answer && answer.ok) { if (who) who.step = 'password'; return; }
      if (answer && answer.done) { showDone(); throw new Error('Your account is already set up.'); }
      if (answer && answer.status === 400) throw new Error(answer.error || 'Check your answers.');
      if (answer && answer.waiting) { say('Waiting for Stripe...'); await wait(3000); continue; }
      // Can't reach our server, or it answered something unexpected: try a few times, then hand off to Adrian.
      if (++trouble >= 3) break;
      say('Saving...');
      await wait(2000);
    }
    throw handOff('Our server could not confirm your payment yet.');
  }

  // The hand-off: Adrian has the answers (setup.js emailed them). Shown instead of the password step.
  function handedOff(d) {
    finished = true;
    step = 'done';
    stopped = true;
    note('');
    // Nothing more to do on this device: the site stops asking them to finish.
    Account.save({ step: 'done' });
    track('password');
    $('#wlPaid').hidden = true;
    head(`Got it${d.owner ? ', ' + d.owner.split(' ')[0].replace(/[<>&]/g, '') : ''}. <span class="hi">You're all set on our side.</span>`, '');
    showStop("Your payment and your answers are in. We're finishing your account by hand: Adrian will text you at " +
      `${(d.ownerPhone || 'your phone').replace(/[<>&]/g, '')} within the hour with your dashboard sign-in. You can close this page.`);
    top();
  }

  function answered() {
    Account.save({ step: 'password' });
    showPassword();
  }

  window.RingleaderWelcome = { saveAnswers, answered, handedOff };

  /* ---------- 3. The password, then the dashboard ---------- */
  const passErr = text => {
    const err = $('#wlPass-err');
    err.textContent = text || '';
    err.hidden = !text;
    if (text) $('#wlPass').setAttribute('aria-invalid', 'true'); else $('#wlPass').removeAttribute('aria-invalid');
  };
  $('#wlShow').addEventListener('click', () => {
    const input = $('#wlPass'), show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#wlShow').textContent = show ? 'Hide' : 'Show';
    $('#wlShow').setAttribute('aria-pressed', String(show));
  });
  $('#wlPass').addEventListener('input', () => { if (!$('#wlPass-err').hidden) passErr(''); });
  let making = false;
  $('#passForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (making) return;
    const password = $('#wlPass').value;
    if (password.length < 8) { passErr('Use at least 8 characters.'); $('#wlPass').focus(); return; }
    making = true;
    const go = $('#wlGo');
    go.disabled = true;
    go.textContent = 'Making your password...';
    passErr('');
    try {
      const answer = await post('password', { password });
      if (answer.ok && answer.enter) {
        finished = true;
        Account.save({ step: 'done' });
        track('dashboard');
        go.textContent = 'Opening your dashboard...';
        location.assign(answer.enter); // same tab: our server signs them in and opens the dashboard
        return;
      }
      if (answer.done) { showDone(); return; }
      if (answer.questions) { showQuestions(); return; }
      passErr(answer.error || 'That didn\'t work. Try again.');
    } catch {
      passErr("We couldn't reach Ringleader. Check your connection and try again.");
    } finally {
      if (!finished) { making = false; go.disabled = false; go.textContent = 'Create password and open my dashboard'; }
    }
  });

  // Until the dashboard opens, closing the tab asks first. (Browsers show their own wording.)
  addEventListener('beforeunload', e => {
    if (finished || step === 'done') return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ---------- go ---------- */
  if (!session) {
    finished = true;
    track('paid');
    $('#wlPaid').hidden = true;
    head('Finish setting up', '');
    showStop('This page opens right after you pay. Your setup link is also in the welcome email from Ringleader. Lost it? Text <a href="tel:+14372322281">437-232-2281</a>.', ['See the plans', 'contact.html']);
    return;
  }
  // Keep the address tidy: the payment code stays in this browser (so a refresh still works), not in the address bar.
  if (fromStripe) {
    Account.save({ session, step: saved.step || 'questions' });
    history.replaceState(null, '', 'welcome.html' + (saved.step === 'password' ? '?step=password' : ''));
  }
  showQuestions();
  if (saved.step === 'password') { who = saved; showPassword(); }
  if (saved.step === 'done') showDone();

  ready = checkPayment().then(answer => {
    if (!answer) return;
    if (answer.status === 400) {
      finished = true;
      Account.clear();
      showStop("This setup link doesn't look right. Open the link in your welcome email, or text <a href=\"tel:+14372322281\">437-232-2281</a>.");
      return;
    }
    if (answer.step === 'done') showDone();
    else if (answer.step === 'password') { if (step !== 'password') showPassword(); }
    else { if (step !== 'questions') showQuestions(); prefill(); }
  });
})();
