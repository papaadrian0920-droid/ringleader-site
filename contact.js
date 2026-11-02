// The "Get set up" form. There's no server behind this site, so Send writes an email
// with everything filled in and opens the visitor's email app. Copy is the backup.
(() => {
  const TO = 'papaadrian.0920@gmail.com';
  const form = document.getElementById('getSetUp');
  if (!form) return;
  const $ = id => document.getElementById(id);

  // Came from "Claim the founding deal"? Tick the box for them.
  if (new URLSearchParams(location.search).get('deal') === 'founding') $('founding').checked = true;

  // Personal cell picked: explain why that's a problem, and offer the Work Line.
  const lineChanged = () => { $('personalHint').hidden = form.line.value !== 'My personal cell'; };
  form.addEventListener('change', lineChanged);
  lineChanged();

  function details() {
    const f = form.elements;
    const lines = [
      `Name: ${f.name.value.trim()}`,
      `Business: ${f.business.value.trim()}`,
      `Trade: ${f.trade.value}`,
      `City or area: ${f.city.value.trim() || '-'}`,
      `Phone: ${f.phone.value.trim()}`,
      `Email: ${f.email.value.trim() || '-'}`,
      `Missed calls a week: ${f.missed.value}`,
      `Best time to call: ${f.best.value}`,
      `Customers call: ${f.line.value}`,
    ];
    if (f.founding.checked && !f.founding.closest('[hidden]')) lines.push('Wants the founding deal ($69 a month for 3 months)');
    if (f.workline.checked) lines.push('Interested in the Work Line (+$15 a month)');
    if (f.message.value.trim()) lines.push('', f.message.value.trim());
    return lines.join('\n');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const missing = [...form.querySelectorAll('[required]')].filter(el => !el.value.trim());
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    if (missing.length) {
      missing.forEach(el => el.setAttribute('aria-invalid', 'true'));
      $('formError').textContent = `Please fill in: ${missing.map(el => form.querySelector(`label[for="${el.id}"]`).textContent.trim()).join(', ')}.`;
      $('formError').hidden = false;
      missing[0].focus();
      return;
    }
    $('formError').hidden = true;
    const body = details();
    const subject = `Ringleader setup: ${form.elements.business.value.trim()}`;
    $('sentText').value = `To: ${TO}\nSubject: ${subject}\n\n${body}`;
    $('sent').hidden = false;
    location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  $('copy').addEventListener('click', async () => {
    const text = $('sentText').value;
    try { await navigator.clipboard.writeText(text); } catch { $('sentText').select(); document.execCommand('copy'); }
    $('copy').textContent = 'Copied';
    setTimeout(() => { $('copy').textContent = 'Copy details'; }, 2000);
  });
})();
