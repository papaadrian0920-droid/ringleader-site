// Light or dark. The sun / moon button in the top right switches it, and this browser remembers the choice.
// Loaded in <head> (not deferred) so the page never flashes the wrong colours.
// The same file is in site/ and dashboard/new/. Change both together.
(() => {
  const KEY = 'ringleader-theme';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const meta = document.querySelector('meta[name="theme-color"]');
  const darkBar = meta ? meta.content : '#0D0D0E';   // the page's own dark colour for the phone's top bar
  const set = theme => {
    root.dataset.theme = theme;
    if (meta) meta.content = theme === 'light' ? '#E8E6DE' : darkBar;
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  };
  set(read() === 'light' ? 'light' : 'dark');

  const icons = '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
    + '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  const label = btn => {
    const light = root.dataset.theme === 'light';
    btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    btn.title = light ? 'Dark mode' : 'Light mode';
  };

  const add = () => {
    const head = document.querySelector('header.top .wrap, header.bar, .signin-box');
    if (!head || head.querySelector('.theme-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    btn.innerHTML = icons;
    label(btn);
    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      set(next);
      try { localStorage.setItem(KEY, next); } catch { /* still switches for this visit */ }
      label(btn);
    });
    // Sits just left of the account circle when there is one.
    const me = head.querySelector('.me');
    if (me) head.insertBefore(btn, me); else head.append(btn);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
