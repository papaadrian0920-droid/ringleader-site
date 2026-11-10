// Strict "cities you serve" and "shop address" questions for the setup form (setup.js).
// Cities come from a list (Ontario), or are looked up on a map. The address is searched on a map and pick-from-list,
// with strict boxes underneath (street number, city, province, postal code) for the ones the map doesn't know.
// The map search is Photon (by Komoot, OpenStreetMap data). It is free and needs no key. What you type is sent to it to find matches.
// If the search is down, the address boxes still work and are checked for shape, and the sheet marks the address "typed by hand".
(() => {
  const PHOTON = 'https://photon.komoot.io/api/';
  const ONTARIO_BOX = '-95.2,41.6,-74.3,56.9'; // west, south, east, north
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const PLACES = ['Greater Toronto Area (GTA)', 'Toronto', 'Etobicoke', 'North York', 'Scarborough', 'East York', 'York', 'Mississauga', 'Brampton', 'Vaughan', 'Woodbridge', 'Maple', 'Concord', 'Kleinburg', 'Markham', 'Thornhill', 'Unionville', 'Richmond Hill', 'Oakville', 'Burlington', 'Milton', 'Halton Hills', 'Georgetown', 'Acton', 'Caledon', 'Bolton', 'Orangeville', 'Pickering', 'Ajax', 'Whitby', 'Oshawa', 'Clarington', 'Bowmanville', 'Courtice', 'Uxbridge', 'Scugog', 'Port Perry', 'Aurora', 'Newmarket', 'King City', 'Georgina', 'Keswick', 'East Gwillimbury', 'Stouffville', 'Bradford', 'Innisfil', 'Barrie', 'Orillia', 'Midland', 'Collingwood', 'Wasaga Beach', 'Owen Sound', 'Huntsville', 'Bracebridge', 'Gravenhurst',
    'Durham Region', 'York Region', 'Peel Region', 'Halton Region', 'Niagara Region', 'Waterloo Region',
    'Hamilton', 'Ancaster', 'Dundas', 'Stoney Creek', 'Waterdown', 'Grimsby', 'Lincoln', 'St. Catharines', 'Niagara Falls', 'Niagara-on-the-Lake', 'Welland', 'Thorold', 'Fort Erie', 'Port Colborne', 'Pelham', 'Fonthill',
    'Kitchener', 'Waterloo', 'Cambridge', 'Guelph', 'Elora', 'Fergus', 'Brantford', 'Paris', 'Woodstock', 'Ingersoll', 'Tillsonburg', 'Simcoe', 'Caledonia', 'Stratford', 'London', 'St. Thomas', 'Sarnia', 'Windsor', 'Leamington', 'Tecumseh', 'LaSalle', 'Amherstburg', 'Chatham', 'Wallaceburg',
    'Peterborough', 'Lindsay', 'Kawartha Lakes', 'Cobourg', 'Port Hope', 'Belleville', 'Quinte West', 'Trenton', 'Kingston', 'Brockville', 'Cornwall', 'Ottawa', 'Kanata', 'Nepean', 'Orleans', 'Barrhaven', 'Stittsville', 'Pembroke',
    'Sudbury', 'North Bay', 'Sault Ste. Marie', 'Timmins', 'Thunder Bay', 'Kenora'];

  const PROVINCES = [['ON', 'Ontario'], ['QC', 'Quebec'], ['BC', 'British Columbia'], ['AB', 'Alberta'], ['MB', 'Manitoba'], ['SK', 'Saskatchewan'], ['NS', 'Nova Scotia'], ['NB', 'New Brunswick'], ['NL', 'Newfoundland and Labrador'], ['PE', 'Prince Edward Island'], ['YT', 'Yukon'], ['NT', 'Northwest Territories'], ['NU', 'Nunavut']];
  const POSTAL_FIRST = { ON: 'KLMNP', QC: 'GHJ', BC: 'V', AB: 'T', MB: 'R', SK: 'S', NS: 'B', NB: 'E', NL: 'A', PE: 'C', YT: 'Y', NT: 'X', NU: 'X' };
  const provinceCode = name => (PROVINCES.find(([c, n]) => n.toLowerCase() === String(name || '').toLowerCase() || c === name) || [''])[0];

  const POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
  const prettyPostal = v => { const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 6 ? s.slice(0, 3) + ' ' + s.slice(3) : String(v || '').trim().toUpperCase(); };
  const STREET = /^\d{1,6}[A-Za-z]?(-\d{1,6})?\s+(?=.*[A-Za-z]{3})[\w.'’\-#&\/ ]{3,}$/;
  const CITY = /^(?=.*[A-Za-zÀ-ÿ]{3})[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'’\- ]{2,}$/;

  /* ---------- a small search-and-pick list (keyboard friendly) ---------- */
  function combo(input, list, find, pick) {
    let items = [], at = -1, timer, run = 0;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); at = -1; };
    const draw = () => {
      list.innerHTML = items.map((it, i) => `<li role="option" id="${list.id}-${i}" data-i="${i}" aria-selected="${i === at}">${esc(it.label)}</li>`).join('');
      list.hidden = !items.length;
      input.setAttribute('aria-expanded', String(!!items.length));
      if (at >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${at}`); else input.removeAttribute('aria-activedescendant');
    };
    const choose = i => { const it = items[i]; if (!it) return; close(); pick(it); };
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim(), mine = ++run;
      if (q.length < 2) { items = []; draw(); return; }
      timer = setTimeout(async () => {
        const found = await find(q);
        if (mine !== run) return; // a newer search replaced this one
        items = found; at = -1; draw();
      }, 280);
    });
    input.addEventListener('keydown', e => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(items.length - 1, at + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, at - 1); draw(); }
      else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); e.stopPropagation(); choose(at); }
      else if (e.key === 'Escape') { close(); }
    });
    list.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); choose(Number(li.dataset.i)); } });
    input.addEventListener('blur', () => setTimeout(close, 120));
    return { close };
  }

  async function photon(params, ms = 6000) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), ms);
    try {
      const url = PHOTON + '?' + params + '&lang=en&bbox=' + ONTARIO_BOX;
      const res = await fetch(url, { signal: stop.signal });
      if (!res.ok) throw new Error('search down');
      return (await res.json()).features || [];
    } finally { clearTimeout(timer); }
  }

  /* ---------- the cities you serve ---------- */
  function cities(root, onChange) {
    const chips = [];
    root.innerHTML = `<label for="areaSearch">Cities or areas you serve <span class="hint">Start typing, then pick from the list. Add as many as you like (up to 12).</span></label>
      <div class="chipbox" id="areaChips"></div>
      <div class="ac"><input id="areaSearch" type="text" autocomplete="off" placeholder="e.g. Toronto" maxlength="60"><ul class="ac-list" id="areaList" role="listbox" hidden></ul></div>
      <p class="ac-status" id="areaStatus" aria-live="polite"></p>
      <p class="err" id="f-area-err" hidden></p>`;
    const input = $('#areaSearch', root), status = $('#areaStatus', root);
    const say = (t, bad) => { status.textContent = t; status.classList.toggle('bad', !!bad); };
    const draw = () => {
      $('#areaChips', root).innerHTML = chips.map((c, i) => `<span class="chip">${esc(c)}<button type="button" data-i="${i}" aria-label="Remove ${esc(c)}">×</button></span>`).join('');
      onChange();
    };
    const add = name => {
      if (chips.some(c => c.toLowerCase() === name.toLowerCase())) { say(`${name} is already added.`); return; }
      if (chips.length >= 12) { say('That\'s the most we can take here (12). Pick the main areas.', true); return; }
      chips.push(name); input.value = ''; say(''); draw();
    };
    $('#areaChips', root).addEventListener('click', e => { const b = e.target.closest('button'); if (b) { chips.splice(Number(b.dataset.i), 1); draw(); } });
    combo(input, $('#areaList', root), async q => {
      const low = q.toLowerCase();
      const own = PLACES.filter(p => p.toLowerCase().startsWith(low)).concat(PLACES.filter(p => !p.toLowerCase().startsWith(low) && p.toLowerCase().includes(low))).slice(0, 7).map(p => ({ label: p, name: p }));
      if (own.length || q.length < 3) return own; // only ask the map about places that aren't in our list
      try { // not in our list: ask the map for an Ontario place with that name
        const found = (await photon(`q=${encodeURIComponent(q)}&limit=6&layer=city`)).map(f => f.properties)
          .filter(p => p.countrycode === 'CA' && p.state === 'Ontario' && p.name && ['city', 'town', 'village', 'hamlet', 'suburb', 'municipality'].includes(p.osm_value)).map(p => ({ label: `${p.name}, Ontario (found on the map)`, name: p.name }));
        const seen = new Set(own.map(o => o.name.toLowerCase()));
        return own.concat(found.filter(f => !seen.has(f.name.toLowerCase()))).slice(0, 8);
      } catch { say('Map search isn\'t working right now. Pick from the list.'); return own; }
    }, it => add(it.name));
    return {
      value: () => chips.join(', '),
      list: () => chips.slice(),
      set: arr => { chips.length = 0; (arr || []).slice(0, 12).forEach(c => chips.push(c)); draw(); },
      problem: () => chips.length ? '' : input.value.trim() ? `Pick "${input.value.trim()}" from the list to add it, or check the spelling.` : 'Add at least one city you serve.'
    };
  }

  /* ---------- the shop address ---------- */
  function address(root, onChange) {
    const provOpts = PROVINCES.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
    root.innerHTML = `<label for="addrSearch">Shop address <span class="hint">Our texts have to say who they are from, so Canada's anti-spam law needs a mailing address. Start typing and pick yours.</span></label>
      <div class="ac"><input id="addrSearch" type="text" autocomplete="off" placeholder="e.g. 100 Queen St W, Toronto" maxlength="120"><ul class="ac-list" id="addrList" role="listbox" hidden></ul></div>
      <p class="ac-status" id="addrStatus" aria-live="polite"></p>
      <div class="addr-parts" id="addrParts" hidden>
        <div class="f"><label for="aStreet">Street number and name</label><input id="aStreet" autocomplete="address-line1" maxlength="80"></div>
        <div class="f"><label for="aCity">City</label><input id="aCity" autocomplete="address-level2" maxlength="60"></div>
        <div class="f"><label for="aProv">Province</label><select id="aProv" autocomplete="address-level1">${provOpts}</select></div>
        <div class="f"><label for="aPostal">Postal code</label><input id="aPostal" autocomplete="postal-code" placeholder="e.g. M5H 2N2" maxlength="7"></div>
      </div>
      <button type="button" class="linkish" id="addrManual">My address isn't listed. I'll type it in.</button>
      <p class="err" id="f-address-err" hidden></p>`;
    const input = $('#addrSearch', root), status = $('#addrStatus', root), parts = $('#addrParts', root);
    const S = $('#aStreet', root), C = $('#aCity', root), P = $('#aProv', root), Z = $('#aPostal', root);
    let source = '', lat = null, lon = null;
    const say = (t, kind) => { status.textContent = t; status.className = 'ac-status' + (kind ? ' ' + kind : ''); };
    const showParts = () => { parts.hidden = false; $('#addrManual', root).hidden = true; };
    const typed = () => { if (source === 'map') { source = 'typed'; lat = lon = null; say('You changed it, so we\'ll double-check this one by hand.'); } onChange(); };
    [S, C, P, Z].forEach(el => el.addEventListener('input', typed));
    P.addEventListener('change', typed);
    $('#addrManual', root).addEventListener('click', () => { source = 'typed'; showParts(); say('We\'ll double-check this one by hand.'); S.focus(); onChange(); });

    combo(input, $('#addrList', root), async q => {
      if (q.length < 4) return [];
      try {
        const features = await photon(`q=${encodeURIComponent(q)}&limit=10&lat=43.7&lon=-79.4`);
        const seen = new Set();
        return features.map(f => ({ p: f.properties, c: f.geometry && f.geometry.coordinates })).filter(({ p }) => p.countrycode === 'CA' && p.housenumber && p.street && (p.city || p.locality || p.district || p.county))
          .map(({ p, c }) => {
            const city = p.city || p.locality || p.district || p.county, prov = provinceCode(p.state);
            const street = `${p.housenumber} ${p.street}`;
            return { label: `${street}, ${city}, ${prov || p.state || ''} ${prettyPostal(p.postcode)}`.replace(/\s+$/, ''), street, city, prov, postal: prettyPostal(p.postcode), lon: c && c[0], lat: c && c[1] };
          }).filter(it => !seen.has(it.label) && seen.add(it.label)).slice(0, 6);
      } catch {
        source = 'typed'; showParts();
        say('Address search isn\'t working right now. Type your address in the boxes below. We\'ll double-check it by hand.');
        return [];
      }
    }, it => {
      S.value = it.street; C.value = it.city; if (it.prov) P.value = it.prov; Z.value = it.postal || '';
      source = 'map'; lat = it.lat; lon = it.lon; input.value = it.label; showParts();
      say(it.postal ? '✓ Found on the map. Check it looks right.' : '✓ Found on the map. Add the postal code below.', 'good');
      onChange();
    });

    const parts4 = () => ({ street: S.value.trim().replace(/\s+/g, ' '), city: C.value.trim().replace(/\s+/g, ' '), province: P.value, postal: prettyPostal(Z.value) });
    return {
      value: () => { const a = parts4(); return a.street && a.city && a.postal ? `${a.street}, ${a.city}, ${a.province} ${a.postal}` : ''; },
      parts: () => ({ ...parts4(), source: source || 'typed', lat, lon }),
      set: (value, p) => {
        if (!p || !p.street) return;
        S.value = p.street; C.value = p.city || ''; P.value = p.province || 'ON'; Z.value = p.postal || '';
        source = p.source || 'typed'; lat = p.lat || null; lon = p.lon || null; showParts();
        input.value = `${p.street}, ${p.city}`; say(source === 'map' ? '✓ Found on the map.' : 'We\'ll double-check this one by hand.', source === 'map' ? 'good' : '');
      },
      problem: () => {
        const a = parts4();
        if (!a.street && !a.city && !Z.value.trim()) return input.value.trim() ? 'Pick your address from the list, or tap "My address isn\'t listed" to type it in.' : 'Add your shop address.';
        if (!STREET.test(a.street)) return 'The street needs a number and a name, like 100 Queen St W.';
        if (!CITY.test(a.city)) return 'Add the city, using letters only.';
        if (!POSTAL.test(a.postal)) return 'The postal code should look like M5H 2N2.';
        if (POSTAL_FIRST[a.province] && !POSTAL_FIRST[a.province].includes(a.postal[0])) return `That postal code doesn't match the province (${a.province}). Check both.`;
        return '';
      }
    };
  }

  /* ---------- hooks for setup.js ---------- */
  const mounted = {};
  window.RingleaderPlaces = {
    mount(kind, root, onChange) { mounted[kind] = kind === 'area' ? cities(root, onChange) : address(root, onChange); return mounted[kind]; },
    get: kind => mounted[kind],
    shape: { STREET, CITY, POSTAL, prettyPostal } // for the tests
  };
})();
