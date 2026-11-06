// Saves each sign-up step to Adrian's Google Sheet (see plans/google-sheet-setup.md).
// It never blocks the page: if the sheet is off or down, everything else still works.
// The Web3Forms email in plans.js is still what tells Adrian right away.
(() => {
  // PASTE the Google web app link here (it ends in /exec). Empty = nothing is saved to a sheet.
  const LEADS_URL = 'https://script.google.com/macros/s/AKfycbw_vSWGNUm6tzuX6Pt9K_RWFoHMCwYLKafBwamqR-SOvagiBtaONP3w1O5kr0ggw-HxJw/exec';
  // The same word as SECRET in the Google script. It only keeps casual spam out; it is visible in this file.
  const SECRET = 'bluefalcon7';

  // The Web3Forms key that emails Adrian. It's meant to be public: it can only send mail to him. plans.js and setup.js both use it.
  const FORM_KEY = 'ef8b60ea-1cdf-4179-a649-e66fd541b137';

  window.RingleaderLeads = {
    formKey: FORM_KEY,
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
