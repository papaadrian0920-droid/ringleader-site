// The two moving parts of the site. Both are extras: without JavaScript the page still shows everything.

// 1. "One missed call": on wide screens, one phone sticks on the right and changes screens as the steps scroll past.
(() => {
  const story = document.querySelector('.story');
  if (!story || !('IntersectionObserver' in window)) return;
  const steps = [...story.querySelectorAll('.step')];
  const phone = story.querySelector('.story-phone .phone');
  const screens = steps.map(step => phone.appendChild(step.querySelector('.screen').cloneNode(true)));

  const show = i => {
    steps.forEach((step, j) => step.classList.toggle('is-active', i === j));
    screens.forEach((screen, j) => screen.classList.toggle('is-active', i === j));
  };
  show(0);

  // A step counts as "current" when it crosses the middle of the screen.
  const watcher = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) show(steps.indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(step => watcher.observe(step));

  const wide = matchMedia('(min-width: 901px)');
  const apply = () => story.classList.toggle('is-sticky', wide.matches);
  wide.addEventListener('change', apply);
  apply();
})();

// 2. The missed-call cost calculator.
(() => {
  const form = document.getElementById('calc');
  if (!form) return;
  const money = n => '$' + Math.round(n).toLocaleString('en-CA');
  const out = name => form.querySelector(`[data-out="${name}"]`);

  function update() {
    const calls = Number(form.calls.value);
    const job = Number(form.job.value);
    const book = Number(form.book.value);
    // Missed calls a month, times how many would book, times the average job.
    const jobs = calls * 52 / 12 * book / 10;
    out('calls').textContent = calls;
    out('job').textContent = money(job);
    out('book').textContent = book;
    out('total').textContent = money(jobs * job);
    out('jobs').textContent = `About ${Math.round(jobs)} job${Math.round(jobs) === 1 ? '' : 's'} a month.`;
  }
  form.addEventListener('input', update);
  update();
})();
