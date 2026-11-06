// The shop-setup questionnaire. Six short screens. The answers do two jobs:
//  1. they go to Adrian (an email through Web3Forms, and a row in the Shops tab of his sheet through leads.js),
//  2. the "profile" part is what tailors the texting assistant to this shop (server/src/trades.js reads the same field names).
// Nothing here takes payment or a card. Drafts are saved on this device only, and cleared when the form is sent.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Leads = window.RingleaderLeads || { send() {}, formKey: '' };
  const DRAFT = 'ringleader-setup-draft';

  const TRADE_LIST = [['plumbing', 'Plumbing'], ['hvac', 'Heating and cooling (HVAC)'], ['electrical', 'Electrical'], ['roofing', 'Roofing'], ['waterproofing', 'Waterproofing'], ['general', 'General contracting or renos']];
  // One tap to add a job. These are only suggestions: the owner can type anything.
  const SUGGEST = {
    plumbing: ['Leaks and burst pipes', 'Drain cleaning', 'Water heaters', 'Toilets and faucets', 'Sewer lines', 'Sump pumps'],
    hvac: ['Furnace repair', 'AC repair', 'New installs', 'Maintenance plans', 'Duct cleaning', 'Heat pumps'],
    electrical: ['Panel upgrades', 'Outlets and switches', 'Lighting', 'EV chargers', 'Rewiring', 'Troubleshooting'],
    roofing: ['Leak repair', 'Shingle replacement', 'Flat roofs', 'Eavestroughs', 'Storm damage', 'Inspections'],
    waterproofing: ['Foundation crack repair', 'Interior drains', 'Exterior waterproofing', 'Sump pumps', 'Window wells', 'Underpinning'],
    general: ['Kitchens', 'Bathrooms', 'Basements', 'Additions', 'Decks', 'Repairs']
  };
  const URGENT = {
    plumbing: 'burst pipe, flooding, sewage backup, no water',
    hvac: 'no heat in the cold, no cooling in a heat wave, gas or burning smell',
    electrical: 'burning smell, sparks, hot panel or outlet',
    roofing: 'active leak, storm damage leaving the home open',
    waterproofing: 'water on the floor now, failed sump pump during rain',
    general: 'storm, water or fire damage that leaves the home unsafe'
  };
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DEFAULT_HOURS = DAYS.map((day, i) => i < 5 ? { day, open: '7:00 AM', close: '6:00 PM' } : i === 5 ? { day, open: '8:00 AM', close: '12:00 PM' } : { day, open: null, close: null });
  const TIMES = (() => {
    const out = [];
    for (let m = 5 * 60; m <= 23 * 60; m += 30) {
      const h = Math.floor(m / 60), mm = m % 60;
      out.push(`${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`);
    }
    return out;
  })();

  // type: text | tel | email | area (textarea) | select | radio | checks | hours | services | note
  const STEPS = [
    { name: 'The shop', title: 'About your shop', fields: [
      { id: 'business', label: 'Business name', hint: 'The name customers know.', type: 'text', req: 'your business name', auto: 'organization' },
      { id: 'trades', label: 'Your trade', hint: 'Pick all that fit (up to 3).', type: 'checks', req: 'your trade', options: TRADE_LIST, max: 3 },
      { id: 'area', label: 'Cities or areas you serve', type: 'text', req: 'where you work', placeholder: 'e.g. Toronto, North York, Vaughan', wide: true },
      { id: 'address', label: 'Shop address', hint: 'Our texts have to say who they are from, so Canada\'s anti-spam law needs a mailing address.', type: 'text', req: 'your shop address', auto: 'street-address', wide: true },
      { id: 'website', label: 'Website', hint: 'Optional.', type: 'text', placeholder: 'e.g. wizardswaterproofing.ca', auto: 'url' }
    ] },
    { name: 'People', title: 'Who is who', fields: [
      { id: 'owner', label: 'Owner\'s name', type: 'text', req: 'the owner\'s name', auto: 'name' },
      { id: 'replier', label: 'Who answers customers\' texts?', hint: 'First name is fine.', type: 'text', req: 'who answers texts' },
      { id: 'ownerPhone', label: 'Phone we text job alerts to', type: 'tel', req: 'a phone number', auto: 'tel' },
      { id: 'backupPhone', label: 'Backup phone', hint: 'Optional. Someone else to text if you can\'t answer.', type: 'tel' },
      { id: 'email', label: 'Best email', type: 'email', req: 'your email', auto: 'email' },
      { id: 'languages', label: 'Languages you speak', type: 'checks', options: [['English', 'English'], ['French', 'French'], ['Other', 'Other']] }
    ] },
    { name: 'Your work', title: 'What you do', fields: [
      { id: 'services', label: 'Jobs you do', hint: 'Tap to add, or type your own. One per line.', type: 'services', req: 'at least one job you do', wide: true },
      { id: 'notServices', label: 'Jobs you do NOT do', hint: 'Optional. We\'ll politely say no to these.', type: 'area', wide: true },
      { id: 'customers', label: 'Who are your customers?', type: 'radio', req: 'who your customers are', options: [['residential', 'Homes'], ['commercial', 'Businesses'], ['both', 'Both']] },
      { id: 'emergencyWork', label: 'Do you take emergency calls?', type: 'radio', req: 'if you take emergency calls', options: [['yes', 'Yes'], ['no', 'No']] },
      { id: 'freeEstimates', label: 'Do you give free estimates?', type: 'radio', req: 'if you give free estimates', options: [['yes', 'Yes'], ['no', 'No']] }
    ] },
    { name: 'Hours', title: 'Hours and emergencies', fields: [
      { id: 'hours', label: 'Your hours', hint: 'After these hours, callers get your closed text.', type: 'hours', wide: true },
      { id: 'emergencyDefinition', label: 'What counts as an emergency for you?', hint: 'Optional. We\'ll suggest some based on your trade.', type: 'area', wide: true },
      { id: 'callbackPromise', label: 'How fast do you usually call back?', type: 'select', req: 'how fast you call back', options: [['', 'Pick one'], ['within 15 minutes', 'Within 15 minutes'], ['within the hour', 'Within the hour'], ['the same day', 'The same day'], ['the next business day', 'The next business day']] },
      { id: 'holidays', label: 'Days you\'re closed', hint: 'Optional. Holidays, vacation.', type: 'text' }
    ] },
    { name: 'Your voice', title: 'How your texts should sound', fields: [
      { id: 'tone', label: 'Tone', type: 'radio', req: 'a tone', options: [['friendly', 'Friendly'], ['professional', 'Professional'], ['direct', 'Short and direct']], wide: true },
      { id: 'signOff', label: 'Sign texts as', hint: 'Optional. e.g. Mike at Wizards', type: 'text' },
      { id: 'wordsUse', label: 'Words you like', hint: 'Optional.', type: 'text' },
      { id: 'wordsAvoid', label: 'Words to avoid', hint: 'Optional.', type: 'text' },
      { id: 'exampleText', label: 'A text that sounds like you', hint: 'Optional. Paste one you\'ve sent a customer.', type: 'area', wide: true },
      { id: 'handOff', label: 'Hand these straight to you', hint: 'The assistant stops asking questions and tells them you\'ll call.', type: 'checks', options: [['insurance claims', 'Insurance claims'], ['commercial bids', 'Commercial bids'], ['upset customers', 'Upset customers'], ['warranty issues', 'Warranty issues'], ['big projects', 'Big projects']], wide: true },
      { id: 'neverSay', label: 'Things it must never say or promise', hint: 'Optional. It already never gives prices or promises a time.', type: 'area', wide: true }
    ] },
    { name: 'Phones', title: 'Phones and a few last things', fields: [
      { id: 'line', label: 'The number your customers call is...', type: 'radio', req: 'which number customers call', wide: true, options: [['A work cell', 'A work cell'], ['My personal cell', 'My personal cell'], ['An office landline', 'An office landline'], ['A phone app (VoIP)', 'A phone app (VoIP)']] },
      { id: 'carrier', label: 'Phone company', hint: 'Optional. e.g. Rogers, Bell, Telus.', type: 'text' },
      { id: 'forwarding', label: 'Call forwarding', type: 'select', options: [['Help me set it up on the call', 'Help me set it up on our call'], ['I\'ll set it up myself', 'I\'ll set it up myself'], ['Not sure', 'Not sure']] },
      { id: 'legalName', label: 'Legal business name', hint: 'Optional. Only if it\'s different. Phone carriers check it. We\'ll ask for your Business Number on the call.', type: 'text', wide: true },
      { id: 'agreeCalled', label: 'I understand Ringleader only texts people who called my business first, and honours every STOP.', type: 'agree', req: 'that you agree' },
      { id: 'agreeTerms', label: 'I\'ve read the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a>, and I agree Ringleader staff can view my account to help me.', type: 'agree', req: 'that you agree' }
    ] }
  ];

  let step = 0, sending = false, finished = false;

  /* ---------- drawing ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const errP = id => `<p class="err" id="${id}-err" hidden></p>`;
  const hint = f => f.hint ? ` <span class="hint">${f.hint}</span>` : '';

  function fieldHtml(f) {
    const wide = f.wide ? ' wide' : '';
    const label = `<label for="f-${f.id}">${f.label}${hint(f)}</label>`;
    if (f.type === 'text' || f.type === 'tel' || f.type === 'email') {
      const mode = f.type === 'tel' ? ' inputmode="tel"' : f.type === 'email' ? ' inputmode="email"' : '';
      return `<div class="f${wide}">${label}<input id="f-${f.id}" type="${f.type}"${mode} autocomplete="${f.auto || 'off'}" placeholder="${esc(f.placeholder || '')}">${errP('f-' + f.id)}</div>`;
    }
    if (f.type === 'area') return `<div class="f${wide}">${label}<textarea id="f-${f.id}" rows="3"></textarea>${errP('f-' + f.id)}</div>`;
    if (f.type === 'select') return `<div class="f${wide}">${label}<select id="f-${f.id}">${f.options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>${errP('f-' + f.id)}</div>`;
    if (f.type === 'radio' || f.type === 'checks') {
      const kind = f.type === 'radio' ? 'radio' : 'checkbox';
      return `<fieldset class="f pick${wide}" id="f-${f.id}"><legend>${f.label}${hint(f)}</legend><div class="pick-row chips">${f.options.map(([v, t]) => `<label><input type="${kind}" name="${f.id}" value="${esc(v)}"><span>${esc(t)}</span></label>`).join('')}</div>${errP('f-' + f.id)}</fieldset>`;
    }
    if (f.type === 'services') return `<div class="f${wide}">${label}<div class="pick-row chips small" id="sugg"></div><textarea id="f-${f.id}" rows="4"></textarea>${errP('f-' + f.id)}</div>`;
    if (f.type === 'hours') {
      const opts = TIMES.map(t => `<option>${t}</option>`).join('');
      return `<div class="f${wide}"><label>${f.label}${hint(f)}</label><div class="hours" id="f-hours">${DAYS.map(d => `<div class="hours-row" data-day="${d}"><b>${d}</b><select aria-label="${d} opens">${opts}</select><select aria-label="${d} closes">${opts}</select><label class="tickbox"><input type="checkbox" aria-label="${d} closed"> Closed</label></div>`).join('')}</div>${errP('f-hours')}</div>`;
    }
    if (f.type === 'agree') return `<div class="f wide"><label class="tickbox agree"><input type="checkbox" id="f-${f.id}"><span>${f.label}</span></label>${errP('f-' + f.id)}</div>`;
    return '';
  }

  function build() {
    $('#setupSteps').innerHTML = STEPS.map((s, i) => `<li data-i="${i}"><button type="button" disabled><span class="bar"><i></i></span><span class="lbl">${s.name}<span class="done-tick"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg></span></span></button></li>`).join('');
    $('#panes').innerHTML = STEPS.map((s, i) => `<div class="pane" data-pane="${i}" hidden><div class="grid2">${s.fields.map(fieldHtml).join('')}</div></div>`).join('');
  }

  /* ---------- reading and saving the answers ---------- */
  const allFields = STEPS.flatMap(s => s.fields);
  const val = id => ($('#f-' + id)?.value || '').trim();
  const checked = id => $$(`#f-${id} input:checked`).map(i => i.value);
  const radio = id => checked(id)[0] || '';
  const list = text => text.split(/[,\n]/).map(t => t.trim()).filter(Boolean);

  function collect() {
    const data = {};
    for (const f of allFields) {
      if (f.type === 'checks') data[f.id] = checked(f.id);
      else if (f.type === 'radio') data[f.id] = radio(f.id);
      else if (f.type === 'agree') data[f.id] = $('#f-' + f.id).checked;
      else if (f.type === 'hours') data.hours = $$('.hours-row').map(r => {
        const [open, close] = $$('select', r);
        return { day: r.dataset.day, open: $('input', r).checked ? null : open.value, close: $('input', r).checked ? null : close.value };
      });
      else data[f.id] = val(f.id);
    }
    return data;
  }

  function restore(data) {
    data = data || {};
    for (const f of allFields) {
      const v = data[f.id];
      if (v === undefined) continue;
      if (f.type === 'checks') $$(`#f-${f.id} input`).forEach(i => { i.checked = v.includes(i.value); });
      else if (f.type === 'radio') $$(`#f-${f.id} input`).forEach(i => { i.checked = i.value === v; });
      else if (f.type === 'agree') $('#f-' + f.id).checked = !!v;
      else if (f.type !== 'hours') $('#f-' + f.id).value = v;
    }
    (data.hours || DEFAULT_HOURS).forEach(h => {
      const row = $(`.hours-row[data-day="${h.day}"]`);
      if (!row) return;
      const [open, close] = $$('select', row);
      open.value = h.open || '7:00 AM'; close.value = h.close || '6:00 PM';
      $('input', row).checked = h.open === null;
      $$('select', row).forEach(s => { s.disabled = h.open === null; });
    });
  }

  const saveDraft = () => { try { localStorage.setItem(DRAFT, JSON.stringify({ step, data: collect() })); } catch { /* fine */ } };
  const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT)); } catch { return null; } };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT); } catch { /* fine */ } };

  /* ---------- checking ---------- */
  const digits = v => v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const okPhone = v => /^[2-9]\d{2}[2-9]\d{6}$/.test(digits(v));
  const pretty = v => digits(v).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  const okEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function mark(f, message) {
    const err = $(`#f-${f.id}-err`), box = $('#f-' + f.id);
    const input = box && (box.matches('input, textarea, select') ? box : null);
    if (input) { message ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid'); }
    if (box && box.matches('fieldset')) box.classList.toggle('bad', !!message);
    if (err) { err.textContent = message; err.hidden = !message; }
    return !message;
  }

  function problem(f) {
    if (f.type === 'checks') return f.req && !checked(f.id).length ? `Pick ${f.req}.` : '';
    if (f.type === 'radio') return f.req && !radio(f.id) ? `Pick ${f.req}.` : '';
    if (f.type === 'agree') return f.req && !$('#f-' + f.id).checked ? `Please tick the box to confirm ${f.req}.` : '';
    if (f.type === 'hours' || f.type === 'select') return f.req && !val(f.id) ? `Pick ${f.req}.` : '';
    const v = val(f.id);
    if (!v) return f.req ? `Add ${f.req}.` : '';
    if (f.type === 'tel') return okPhone(v) ? '' : "That doesn't look like a phone number. Try 10 digits, like 416-555-0182.";
    if (f.type === 'email') return okEmail(v) ? '' : "That doesn't look like an email. Check for the @.";
    return '';
  }

  function check(i) {
    const results = STEPS[i].fields.map(f => mark(f, problem(f)));
    if (i === 3) { // each open time has to come before its close time
      const bad = $$('.hours-row').find(r => { const [o, c] = $$('select', r); return !$('input', r).checked && TIMES.indexOf(o.value) >= TIMES.indexOf(c.value); });
      const err = $('#f-hours-err');
      err.textContent = bad ? `Check ${bad.dataset.day}: opening time has to be before closing time.` : '';
      err.hidden = !bad;
      results.push(!bad);
    }
    return results.every(Boolean);
  }

  /* ---------- suggestions that depend on earlier answers ---------- */
  function drawSuggestions() {
    const trades = checked('trades');
    const current = list($('#f-services').value).map(s => s.toLowerCase());
    const box = $('#sugg');
    box.innerHTML = '';
    [...new Set(trades.flatMap(t => SUGGEST[t] || []))].forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.setAttribute('aria-pressed', String(current.includes(text.toLowerCase())));
      b.addEventListener('click', () => {
        const items = list($('#f-services').value);
        const at = items.findIndex(s => s.toLowerCase() === text.toLowerCase());
        if (at >= 0) items.splice(at, 1); else items.push(text);
        $('#f-services').value = items.join('\n');
        drawSuggestions();
        saveDraft();
      });
      box.append(b);
    });
    const hintText = trades.map(t => URGENT[t]).filter(Boolean).join('; ');
    $('#f-emergencyDefinition').placeholder = hintText ? `e.g. ${hintText}` : '';
  }

  /* ---------- moving between screens ---------- */
  function show(n, focus = true) {
    step = n;
    $$('.stepper li').forEach((li, i) => {
      li.classList.toggle('is-done', i < n || finished);
      li.classList.toggle('is-on', i === n && !finished);
      const b = $('button', li);
      b.disabled = finished || i >= n;
      i === n ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current');
    });
    $$('[data-pane]').forEach(p => { p.hidden = Number(p.dataset.pane) !== n || finished; });
    $('#doneBox').hidden = !finished;
    $('#nav').hidden = finished;
    $('#back').style.visibility = n === 0 ? 'hidden' : 'visible';
    $('#next').textContent = n === STEPS.length - 1 ? 'Send' : 'Next';
    $('#setupTitle').textContent = finished ? 'All done.' : STEPS[n].title;
    if (n === 2) drawSuggestions();
    if (focus) {
      window.scrollTo({ top: Math.max(0, $('#setup').getBoundingClientRect().top + scrollY - 76), behavior: calm() ? 'auto' : 'smooth' });
      $('#setupTitle').focus({ preventScroll: true });
    }
    if (!finished) saveDraft();
  }

  async function sendAll() {
    if (sending) return;
    const fail = $('#sendFail'), btn = $('#next');
    fail.hidden = true;
    if ($('#fWebsiteTrap').value) { fail.hidden = false; return; } // only a bot fills in the hidden box
    const d = collect();
    const yes = v => v === 'yes';
    // This part is the same shape the server reads (server/src/trades.js cleanProfile).
    const profile = {
      trades: d.trades, shopName: d.business, area: d.area, customers: d.customers,
      services: list(d.services), notServices: list(d.notServices),
      emergencyWork: yes(d.emergencyWork), emergencyDefinition: d.emergencyDefinition, freeEstimates: yes(d.freeEstimates),
      callbackPromise: d.callbackPromise, tone: d.tone, signOff: d.signOff, wordsUse: d.wordsUse, wordsAvoid: d.wordsAvoid,
      exampleText: d.exampleText, handOff: d.handOff, neverSay: d.neverSay, languages: d.languages
    };
    const hoursText = d.hours.map(h => `${h.day} ${h.open ? h.open + ' to ' + h.close : 'closed'}`).join(', ');
    const trade = d.trades.map(t => (TRADE_LIST.find(x => x[0] === t) || [, t])[1]).join(', ');
    const fields = {
      'Shop setup': d.business,
      Trade: trade, 'Areas served': d.area, Address: d.address, Website: d.website || '-', 'Legal name': d.legalName || '-',
      Owner: d.owner, 'Answers texts': d.replier, 'Job alerts go to': pretty(d.ownerPhone), 'Backup phone': d.backupPhone ? pretty(d.backupPhone) : '-', email: d.email,
      Languages: d.languages.join(', ') || '-',
      Services: list(d.services).join(', '), 'Does NOT do': list(d.notServices).join(', ') || '-', Customers: d.customers,
      'Emergency calls': d.emergencyWork, 'Free estimates': d.freeEstimates, 'Emergency means': d.emergencyDefinition || '-',
      Hours: hoursText, 'Closed on': d.holidays || '-', 'Calls back': d.callbackPromise,
      Tone: d.tone, 'Sign-off': d.signOff || '-', 'Words to use': d.wordsUse || '-', 'Words to avoid': d.wordsAvoid || '-',
      'Example text': d.exampleText || '-', 'Hand straight to owner': d.handOff.join(', ') || '-', 'Never say': d.neverSay || '-',
      'Customers call': d.line, Carrier: d.carrier || '-', Forwarding: d.forwarding,
      Agreed: 'Only texts people who called first; Terms and Privacy; staff may view account'
    };
    sending = true;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      if (!Leads.formKey) throw new Error('No form key');
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), 15000);
      let answer;
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: stop.signal,
          body: JSON.stringify({ access_key: Leads.formKey, subject: `Ringleader shop setup: ${d.business}`, from_name: 'Ringleader website', ...fields })
        });
        answer = await res.json().catch(() => ({}));
        if (!res.ok || !answer.success) throw new Error(answer.message || 'Send failed');
      } finally { clearTimeout(timer); }
      Leads.send('setup', {
        email: d.email, name: d.owner, business: d.business, trade, ownerPhone: pretty(d.ownerPhone), line: d.line,
        hours: hoursText, profileJson: JSON.stringify(profile)
      });
      finished = true;
      $('#doneLine').textContent = `Thanks, ${d.owner}. We have everything we need to tailor the assistant for ${d.business}.`;
      clearDraft();
      show(step);
    } catch {
      fail.hidden = false;
      fail.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
    } finally {
      sending = false;
      btn.disabled = false;
      btn.textContent = 'Send';
    }
  }

  function next() {
    if (!check(step)) { $('[aria-invalid="true"], .pick.bad input, .hours-row select', $(`[data-pane="${step}"]`))?.focus(); return; }
    if (step === STEPS.length - 1) { sendAll(); return; }
    show(step + 1);
  }

  /* ---------- go ---------- */
  build();
  restore(null);
  const draft = loadDraft();
  if (draft) restore(draft.data);
  else {
    const who = window.RingleaderDetails?.get();
    if (who) { $('#f-business').value = who.business; $('#f-owner').value = who.name; $('#f-replier').value = (who.name || '').split(' ')[0]; $('#f-email').value = who.email; }
  }
  $('#setup').addEventListener('input', saveDraft);
  $('#setup').addEventListener('change', e => {
    if (e.target.closest('.hours-row') && e.target.type === 'checkbox') $$('select', e.target.closest('.hours-row')).forEach(s => { s.disabled = e.target.checked; });
    if (e.target.name === 'trades') {
      if (checked('trades').length > 3) { e.target.checked = false; }
      if (step === 2) drawSuggestions();
    }
    saveDraft();
  });
  $('#f-services').addEventListener('input', () => { if (step === 2) drawSuggestions(); });
  $('#setup').addEventListener('submit', e => e.preventDefault());
  $('#setup').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input:not([type="checkbox"]):not([type="radio"])')) { e.preventDefault(); next(); } });
  $('#next').addEventListener('click', next);
  $('#back').addEventListener('click', () => show(step - 1));
  $$('.stepper li').forEach((li, i) => $('button', li).addEventListener('click', () => show(i)));
  $('#fWebsiteTrap').value = '';
  show(draft && draft.step ? Math.min(draft.step, STEPS.length - 1) : 0, false);
})();
