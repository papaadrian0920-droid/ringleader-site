// "Try it": the visitor plays the customer after a missed call, and sees what the owner gets.
// It runs a fixed script in the browser. Nothing typed here is sent anywhere, and there is no AI key on this site.
// The words are copied from the real server so the demo stays true:
//   - the first text and the "Reply STOP to opt out" ending: server/src/db.js and textback.js
//   - the questions, the safety text and the owner's texts: server/src/assistant.js and textback.js
// If those change on the server, change them here too.
(() => {
  const root = document.getElementById('try');
  if (!root) return;
  const $ = sel => root.querySelector(sel);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Made-up shops. Each one is closed when the call comes in, so the caller gets the after-hours text.
  const SHOPS = {
    plumbing: {
      business: 'Delgado Plumbing & Heat', owner: 'Marco', time: [20, 47], contact: '40 Example St, Hamilton ON',
      chips: {
        problem: ['My water heater is leaking all over the garage', 'Water is pooling under the kitchen sink', 'I smell gas near the water heater'],
        who: ['Maria Gomez, 1428 Juniper St'],
        what: ['In the garage, started an hour ago, still leaking', 'Under the sink, since this morning, it can wait a day'],
        home: ['House, I own it', 'Condo, I rent'],
        free: ['Tomorrow morning', 'Weekdays after 4', 'Tonight if you can'],
      },
    },
    hvac: {
      business: 'Northline Heating & Air', owner: 'Dana', time: [21, 12], contact: '7 Example Ave, Mississauga ON',
      chips: {
        problem: ["My AC stopped blowing cold and it's 34 degrees in here", 'The outside unit is making a loud buzzing noise', 'Our carbon monoxide alarm is going off'],
        who: ['Jordan Lee, 52 Birchmount Cres'],
        what: ['The whole house, since this afternoon, nothing unsafe', 'Upstairs only, started yesterday, it can wait'],
        home: ['House, I own it', 'Townhouse, I rent'],
        free: ['Tomorrow before noon', 'Any evening this week', 'Tonight or tomorrow morning'],
      },
    },
    roofing: {
      business: 'Ridgeback Roofing', owner: 'Sam', time: [19, 58], contact: '15 Example Rd, Oshawa ON',
      chips: {
        problem: ['Storm last night and now water is dripping through my ceiling', 'I think I lost some shingles in the wind'],
        who: ['Priya Nair, 9 Lakeview Dr'],
        what: ['Bedroom ceiling, since last night, still dripping', 'Back of the roof, noticed today, nothing leaking'],
        home: ['House, I own it', 'A business, I own the building'],
        free: ['Saturday morning', 'Any day after 3', 'ASAP, before it rains again'],
      },
    },
  };

  // The same order and the same words as the server's script (assistant.js, SCRIPT).
  const STEPS = [
    { id: 'problem', label: "What's wrong", keys: ["What's wrong"] },
    { id: 'who', label: 'Name and address', keys: ['Name', 'Address'], ask: "Thanks! What's your name and the address for the job?" },
    { id: 'what', label: 'Where, since when, how urgent', keys: ['Where in the home', 'When it started', 'How urgent'], ask: 'Got it. Where in the home is it, when did it start, and is anything leaking, flooding or unsafe right now?' },
    { id: 'home', label: 'Home type', keys: ['Home type'], ask: 'Is it a house, condo or business, and do you own or rent?' },
    { id: 'free', label: "When they're free", keys: ["When they're free"], ask: 'Last one: what days or times usually work for a visit?' },
  ];
  // The order the owner's summary text lists things in (assistant.js, CHECKLIST).
  const REPORT_ORDER = ['who', 'problem', 'what', 'home', 'free'];

  const UNSURE = /^(um+,? |hmm+,? )?(i'?m |i am |i )?(not (really |too )?sure|unsure|don'?t know|do not know|(have )?no idea|no clue|idk|dunno|unknown|n\/a)\b/i;
  const DANGER = [
    /\b(smell\w*|stink\w*|odou?r)\b.{0,30}\b(gas|propane|rotten eggs?)\b/i,
    /\b(gas|propane)\s+((is|line is|pipe is)\s+)?(leak\w*|smell\w*|odou?r)/i,
    /\bleak\w*\s+(of\s+)?(natural\s+)?(gas|propane)\b/i,
    /\brotten eggs?\b/i,
    /\bmonoxide\b/i,
    /\bco\s+(alarm|detector|monitor|sensor|poison\w*|leak\w*)/i,
    /\b(alarm|detector)s?\b.{0,30}\b(going off|gone off|went off|sounding|beeping|screaming|won'?t stop)\b/i,
    /\b(on fire|caught fire|house fire|flames (are|coming|everywhere|from))\b/i,
    /\b(there'?s|there is|a) fire\b/i,
    /\bsmoke\s+(is\s+)?(coming|pouring|everywhere|from|in the)\b|\b(is|it'?s) smoking\b/i,
    /\b(dizzy|light.?headed|passed out|unconscious|can'?t breathe)\b/i,
  ];
  const dangerous = text => DANGER.some(rule => rule.test(text)) || (/\bspark(s|ing)\b/i.test(text) && !/ignit|pilot/i.test(text));
  const URGENT = /flood|burst|gas|smoke|spark|monoxide|no heat|emergency/i;
  const TIMING = /\b(when can|how soon|today|tonight|tomorrow|asap|come by)\b/i;
  const CALLER = '(905) 555-0142';
  const JOB = 12;

  const chat = $('#tryChat'), chipsBox = $('#tryChips'), form = $('#tryForm'), input = $('#tryMsg');
  const notifs = $('#tryNotifs'), job = $('#tryJob'), state = $('#tryState');
  let key = 'plumbing', answers, step, minutes, timingAsked, over, run = 0, busy = false;
  const shop = () => SHOPS[key];

  const clock = () => {
    const [h, m] = shop().time, total = h * 60 + m + minutes;
    const hh = Math.floor(total / 60) % 24;
    return `${((hh + 11) % 12) + 1}:${String(total % 60).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
  };
  const wait = ms => new Promise(done => setTimeout(done, calm ? 80 : ms));
  const el = (tag, cls, text) => { const node = document.createElement(tag); node.className = cls; if (text) node.textContent = text; return node; };
  const toBottom = () => { chat.scrollTop = chat.scrollHeight; };

  const bubble = (side, text) => { chat.append(el('p', 'bubble ' + side, text)); toBottom(); };
  const stamp = (text, cls = '') => { chat.append(el('p', 'stamp ' + cls, text)); toBottom(); };
  async function shopSays(text, mine) {
    const dots = el('p', 'bubble in try-typing');
    dots.setAttribute('aria-label', 'Typing');
    dots.innerHTML = '<i></i><i></i><i></i>';
    chat.append(dots); toBottom();
    await wait(Math.min(1400, 500 + text.length * 7));
    dots.remove();
    if (mine === run) bubble('in', text);
  }

  // A text arriving on the owner's phone. The newest sits on top.
  function ownerGets(text, loud) {
    notifs.querySelector('.try-quiet')?.remove();
    const card = el('div', 'notif' + (loud ? ' try-loud' : ''));
    const app = el('span', 'notif-app'); app.append(el('i', ''), `Ringleader · ${clock()}`);
    card.append(app, el('p', '', text));
    notifs.prepend(card);
    stamp(`↳ ${shop().owner}'s phone just got a text`, 'try-ping');
    $('#tryClock').textContent = clock();
  }

  function drawJob() {
    job.innerHTML = '';
    STEPS.forEach(s => {
      const value = answers[s.id];
      job.append(el('dt', '', s.label), el('dd', value ? '' : 'try-empty', value || 'Not asked yet'));
    });
    state.textContent = over === 'safety' ? 'Emergency' : over === 'stop' ? 'Opted out' : over ? (timingAsked ? 'Waiting on you' : 'Ready to book') : answers.problem ? `Getting details ${STEPS.filter(s => answers[s.id]).length}/${STEPS.length}` : 'Texted back';
    state.dataset.state = over === 'safety' ? 'red' : over === 'done' ? 'go' : '';
  }

  function drawChips() {
    chipsBox.innerHTML = '';
    const list = over === 'done' ? ['Thanks!'] : over ? [] : shop().chips[STEPS[step].id];
    list.forEach(text => {
      const b = el('button', '', text);
      b.type = 'button';
      b.addEventListener('click', () => say(text));
      chipsBox.append(b);
    });
    chipsBox.hidden = !list.length;
  }

  // The text the owner gets when every answer is in (assistant.js, ownerReport).
  function report() {
    const lines = [`Ringleader #${JOB} ready to book. ${answers.problem.replace(/[.\s]+$/, '')}.`];
    REPORT_ORDER.forEach(id => {
      const s = STEPS.find(x => x.id === id);
      if (answers[id] !== 'not sure') lines.push(`${s.keys.join(' and ')}: ${answers[id]}`);
    });
    const unsure = STEPS.filter(s => answers[s.id] === 'not sure').flatMap(s => s.keys).map(k => k.toLowerCase());
    if (unsure.length) lines.push(`Not sure about: ${unsure.join(', ')}.`);
    if (timingAsked) lines.push('They asked about timing, so text them when you can come.');
    lines.push('Reply to this text to answer them.');
    return lines.join('\n');
  }

  async function say(raw) {
    const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text || busy) return;
    const mine = run;
    busy = true;
    form.classList.add('is-busy');
    bubble('out', text);
    input.value = '';
    minutes += 1;
    const { owner } = shop();
    const short = text.length > 100 ? text.slice(0, 97) + '...' : text;

    if (/^stop\b/i.test(text)) {
      over = 'stop';
      stamp('Opted out. Ringleader will not text this number again unless you reply START.', 'try-end');
    } else if (over === 'stop') {
      if (/^start\b/i.test(text)) { over = answers.free ? 'done' : false; stamp('Texts are back on.', 'try-end'); }
    } else if (dangerous(text)) {
      // Someone may be in danger: the safety text goes out, the owner is told to call, and the questions stop.
      over = 'safety';
      if (!answers.problem) answers.problem = text.slice(0, 140);
      await shopSays(`Safety first: if you smell gas, a carbon monoxide alarm is going off, anyone feels sick or dizzy, or there's fire or sparks, get everyone outside now and call 911 from outside. We're texting ${owner} now.`, mine);
      if (mine !== run) return;
      ownerGets(`Ringleader #${JOB} EMERGENCY: ${CALLER} texted: "${short}" We told them to get out and call 911 if it's gas, CO or fire. Call them: ${CALLER}`, true);
      stamp(`The questions stop here. ${owner} calls you.`, 'try-end');
    } else if (over === 'done') {
      // After the details are in, the customer's texts go straight to the owner.
      ownerGets(`Ringleader #${JOB}: ${CALLER} texted: "${short}" Reply to this text to answer them.`);
    } else if (!over) {
      answers[STEPS[step].id] = UNSURE.test(text) ? 'not sure' : text.slice(0, 140);
      if (TIMING.test(text)) timingAsked = true;
      const urgent = URGENT.test(text) && !answers.urgentSent;
      step += 1;
      const next = STEPS[step];
      drawJob();
      await shopSays(next ? next.ask : `Perfect, that's everything. ${owner} will text you shortly ${timingAsked ? 'about timing' : 'to set up a time'}.`, mine);
      if (mine !== run) return;
      if (urgent) {
        answers.urgentSent = true;
        ownerGets(`Ringleader #${JOB} URGENT: ${answers.problem.replace(/[.\s]+$/, '')}. The assistant is still getting the details. Reply to this text to answer them.`, true);
      }
      if (!next) {
        over = 'done';
        ownerGets(report());
        stamp(`That's the whole job, on ${owner}'s phone before the first callback.`, 'try-end');
      }
    }
    busy = false;
    form.classList.remove('is-busy');
    drawJob();
    drawChips();
  }

  async function start(which) {
    key = which;
    const mine = ++run;
    answers = {}; step = 0; minutes = 0; timingAsked = false; over = false; busy = false;
    form.classList.remove('is-busy');
    const { business, owner, contact } = shop();
    root.querySelectorAll('[data-try]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.try === key)));
    $('#tryBiz').textContent = business;
    $('#tryAva').textContent = business[0];
    root.querySelectorAll('[data-try-owner]').forEach(n => { n.textContent = owner; });
    $('#tryClock').textContent = clock();
    chat.innerHTML = '';
    notifs.innerHTML = '';
    notifs.append(el('p', 'try-quiet', `Nothing yet. ${owner} is off for the night.`));
    drawJob();
    chipsBox.innerHTML = '';
    chipsBox.hidden = true;
    stamp(`You called. No answer · ${clock()}`, 'missed');
    await shopSays(`Hi! This is ${business}. We're closed right now, but we got your call. Tell us what's going on and we'll text you first thing in the morning. ${contact} Reply STOP to opt out.`, mine);
    if (mine !== run) return;
    drawChips();
  }

  root.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', () => start(b.dataset.try)));
  $('#tryAgain').addEventListener('click', () => start(key));
  form.addEventListener('submit', e => { e.preventDefault(); say(input.value); });

  // Start when the section is nearly on screen, so the first text "arrives" as the visitor gets there.
  if ('IntersectionObserver' in window && !calm) {
    const watcher = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { watcher.disconnect(); start(key); }
    }, { rootMargin: '0px 0px -20% 0px' });
    watcher.observe(root);
  } else start(key);
})();
