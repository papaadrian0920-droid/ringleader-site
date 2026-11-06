// The short "who are we setting up?" step before Get started.
// This isn't a real account: no passwords, no server. It only remembers email, name and business name
// in this browser, so later forms can fill themselves in.
(() => {
  const KEY = 'ringleader-details';
  let memory = null; // used if this browser blocks saving

  const get = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || memory; } catch { return memory; }
  };
  const save = details => {
    memory = details;
    try { localStorage.setItem(KEY, JSON.stringify(details)); } catch { /* memory still has it */ }
  };
  const clear = () => {
    memory = null;
    try { localStorage.removeItem(KEY); } catch { /* nothing saved */ }
  };
  const okEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  const field = (id, label, type, auto) => `<div class="hello-f"><label for="${id}">${label}</label>
    <input id="${id}" type="${type}" autocomplete="${auto}"><span class="hello-err" id="${id}-err" hidden></span></div>`;

  // Shows the box. Gives back the saved details, or null if they closed it.
  function ask({ title = 'First, who are we setting up?', button = 'Continue', skipHref = '' } = {}) {
    return new Promise(done => {
      const box = document.createElement('dialog');
      box.className = 'hello';
      box.setAttribute('aria-labelledby', 'helloTitle');
      box.innerHTML = `<form novalidate>
        <button type="button" class="hello-x" aria-label="Close">×</button>
        <h2 id="helloTitle"></h2>
        <p>So you won't type it twice. No password. It's only saved on this device.</p>
        ${field('helloEmail', 'Email', 'email', 'email')}
        ${field('helloName', 'Your name', 'text', 'name')}
        ${field('helloBusiness', 'Business name', 'text', 'organization')}
        <button type="submit" class="hello-go"></button>
        ${skipHref ? '<a class="hello-skip">See the plans first</a>' : ''}
      </form>`;
      box.querySelector('h2').textContent = title;
      box.querySelector('.hello-go').textContent = button;
      if (skipHref) box.querySelector('.hello-skip').href = skipHref;
      document.body.append(box);

      const $ = id => box.querySelector('#' + id);
      const saved = get() || {};
      $('helloEmail').value = saved.email || '';
      $('helloName').value = saved.name || '';
      $('helloBusiness').value = saved.business || '';

      let result = null;
      const check = (id, message) => {
        const input = $(id), err = $(id + '-err');
        input.toggleAttribute('aria-invalid', !!message);
        if (message) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', id + '-err'); }
        err.textContent = message;
        err.hidden = !message;
        return !message;
      };
      const validate = () => {
        const email = $('helloEmail').value.trim();
        const a = check('helloEmail', !email ? 'Add your email.' : okEmail(email) ? '' : "That doesn't look like an email. Check for the @.");
        const b = check('helloName', $('helloName').value.trim() ? '' : 'Add your name.');
        const c = check('helloBusiness', $('helloBusiness').value.trim() ? '' : 'Add your business name.');
        return a && b && c;
      };
      let tried = false;
      box.addEventListener('input', () => { if (tried) validate(); });
      box.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        tried = true;
        if (!validate()) { box.querySelector('[aria-invalid="true"]').focus(); return; }
        result = { email: $('helloEmail').value.trim(), name: $('helloName').value.trim(), business: $('helloBusiness').value.trim() };
        save(result);
        box.close();
      });
      box.querySelector('.hello-x').addEventListener('click', () => box.close());
      box.addEventListener('click', e => { if (e.target === box) box.close(); }); // a click outside the box
      box.addEventListener('close', () => { box.remove(); done(result); });
      box.showModal();
      $('helloEmail').focus(); // otherwise the browser starts on the close button
    });
  }

  window.RingleaderDetails = { get, save, clear, ask, okEmail };

  // Every Get set up link on the site: ask first, then go on to the plans.
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-get-started]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || get()) return;
    e.preventDefault();
    ask({ skipHref: link.href }).then(details => { if (details) location.href = link.href; });
  });
})();
