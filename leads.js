// Saves each sign-up step to Adrian's Google Sheet (see plans/google-sheet-setup.md).
// It never blocks the page: if the sheet is off or down, everything else still works.
// The Web3Forms email in plans.js is still what tells Adrian right away.
(() => {
  // PASTE the Google web app link here (it ends in /exec). Empty = nothing is saved to a sheet.
  const LEADS_URL = '';
  // The same word as SECRET in the Google script. It only keeps casual spam out; it is visible in this file.
  const SECRET = '';

  window.RingleaderLeads = {
    send(kind, fields) {
      if (!LEADS_URL) return;
      try {
        fetch(LEADS_URL, {
          method: 'POST',
          mode: 'no-cors', // Google's script can't answer a browser check, so we send and move on
          headers: { 'Content-Type': 'text/plain' },
          keepalive: true,
          body: JSON.stringify({ secret: SECRET, kind, page: location.pathname, ...fields }),
        }).catch(() => {});
      } catch { /* the page keeps working */ }
    },
  };
})();
