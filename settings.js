/* ==========================================================================
   NEXUS 1.0 – settings.js
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let SETTINGS = {};
let PASSWORDS = [];
let COOKIES = [];

/* ---------- CUSTOM DIALOGI ---------- */
function nexusAlert(title, message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;`;
    overlay.innerHTML = `<div style="min-width:360px;max-width:480px;background:var(--glass-2);border:1px solid var(--border);border-radius:20px;box-shadow:inset 0 1px 0 var(--specular),0 20px 60px rgba(0,0,0,.35);overflow:hidden;"><div style="padding:16px 20px;border-bottom:1px solid var(--border-outer);font-size:15px;font-weight:700;color:var(--text);">${title}</div><div style="padding:20px;font-size:13.5px;color:var(--text);line-height:1.55;white-space:pre-wrap;">${message}</div><div style="padding:14px 20px;display:flex;justify-content:flex-end;border-top:1px solid var(--border-outer);background:rgba(127,127,140,.03);"><button class="nd-ok" style="min-width:88px;height:36px;padding:0 16px;border-radius:12px;border:0;background:linear-gradient(135deg,var(--accent-1),var(--accent-3));color:#fff;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;">OK</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.nd-ok').addEventListener('click', () => { overlay.remove(); resolve(true); });
  });
}
function nexusConfirm(title, message, confirmLabel = 'OK', danger = false) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;`;
    const btnBg = danger ? 'rgba(255,69,58,.16)' : 'linear-gradient(135deg,var(--accent-1),var(--accent-3))';
    const btnColor = danger ? '#ff453a' : '#fff';
    const btnBorder = danger ? '1px solid rgba(255,69,58,.30)' : '0';
    overlay.innerHTML = `<div style="min-width:360px;max-width:480px;background:var(--glass-2);border:1px solid var(--border);border-radius:20px;box-shadow:inset 0 1px 0 var(--specular),0 20px 60px rgba(0,0,0,.35);overflow:hidden;"><div style="padding:16px 20px;border-bottom:1px solid var(--border-outer);font-size:15px;font-weight:700;color:var(--text);">${title}</div><div style="padding:20px;font-size:13.5px;color:var(--text);line-height:1.55;white-space:pre-wrap;">${message}</div><div style="padding:14px 20px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border-outer);background:rgba(127,127,140,.03);"><button class="nd-no" style="min-width:88px;height:36px;padding:0 16px;border-radius:12px;border:1px solid var(--border-outer);background:transparent;color:var(--text-dim);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;">Anuluj</button><button class="nd-yes" style="min-width:88px;height:36px;padding:0 16px;border-radius:12px;border:${btnBorder};background:${btnBg};color:${btnColor};font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;">${confirmLabel}</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.nd-no').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.querySelector('.nd-yes').addEventListener('click', () => { overlay.remove(); resolve(true); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

/* ---------- ZAKŁADKI W PANELU ---------- */
$$('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.settings-tab').forEach(t => t.classList.remove('active'));
    $$('.settings-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = $(`.settings-panel[data-panel="${tab.dataset.tab}"]`);
    if (panel) panel.classList.add('active');
    if (tab.dataset.tab === 'extensions') refreshExtensions();
    if (tab.dataset.tab === 'passwords') refreshPasswords();
    if (tab.dataset.tab === 'about') loadAboutInfo();
  });
});

$('#setMin')?.addEventListener('click', () => window.nexus.winMin());
$('#setClose')?.addEventListener('click', () => window.close());
$('#btnCloseSettings')?.addEventListener('click', () => window.close());

/* ---------- ŁADOWANIE ---------- */
async function loadSettings() {
  SETTINGS = await window.nexus.getSettings();
  syncUI(SETTINGS);
}

/* ==========================================================================
   SYNC UI – aktualizuje wszystkie pola w oknie ustawień
   W tym: kursor customowy (body[data-cursor])
   ========================================================================== */
function syncUI(s) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && el.value !== String(val ?? '')) el.value = val ?? '';
  };
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setVal('setHomepage', s.homepage || 'https://www.google.com');
  setVal('setSearch', s.searchEngine || 'https://www.google.com/search?q=');
  setChk('setRestore', s.restoreSession !== false);
  setChk('setBookmarksBar', s.showBookmarksBar !== false);

  setVal('setTheme', s.theme || 'liquid-glass');
  setVal('setCursor', s.customCursor || 'default');
  setVal('setOpacity', Math.round((s.opacity ?? 0.72) * 100));
  setTxt('outSetOpacity', Math.round((s.opacity ?? 0.72) * 100) + '%');
  setVal('setBlur', s.blur ?? 28);
  setTxt('outSetBlur', (s.blur ?? 28) + 'px');
  setVal('setRadius', s.radius ?? 22);
  setTxt('outSetRadius', (s.radius ?? 22) + 'px');
  setChk('setAccent', s.accent !== false);
  setChk('setHud', s.hud !== false);
  setChk('setAnim', s.animations !== false);

  setChk('setAdblock', s.adblock !== false);
  setChk('setHttps', s.httpsOnly === true);
  setChk('setDnt', s.doNotTrack !== false);
  setChk('setHwAccel', s.hardwareAcceleration !== false);
  setChk('setSmooth', s.smoothScrolling !== false);
  setChk('setThrottle', s.backgroundThrottling !== false);

  setVal('setRam', s.ramLimit ?? 4096);
  setTxt('outSetRam', (s.ramLimit ?? 4096) + ' MB');
  setVal('setProc', s.processLimit ?? 0);
  setTxt('outSetProc', (s.processLimit ?? 0) === 0 ? 'Auto' : String(s.processLimit));
  setVal('setFps', s.fpsLimit ?? 0);
  setTxt('outSetFps', (s.fpsLimit ?? 0) === 0 ? 'Bez limitu' : s.fpsLimit + ' FPS');
  setChk('setVsync', s.vsync !== false);

  setVal('advRamLimit', s.ramLimit ?? 4096);
  setVal('advProcLimit', s.processLimit ?? 0);

  /* ---------- KURSOR CUSTOMOWY ----------
     Ustawiamy atrybut data-cursor na <body> okna ustawień.
     CSS w styles.css interpretuje: body[data-cursor="..."] { cursor: url(...) }
     Dzięki temu custom kursor działa też tutaj — a nie tylko w oknie głównym. */
  if (s.customCursor) {
    document.body.setAttribute('data-cursor', s.customCursor);
  }
}

/* ---------- ZAPISYWANIE ---------- */
function pushSettings() {
  const patch = {
    homepage: $('#setHomepage').value,
    searchEngine: $('#setSearch').value,
    restoreSession: $('#setRestore').checked,
    showBookmarksBar: $('#setBookmarksBar').checked,
    theme: $('#setTheme').value,
    customCursor: $('#setCursor').value,
    opacity: Number($('#setOpacity').value) / 100,
    blur: Number($('#setBlur').value),
    radius: Number($('#setRadius').value),
    accent: $('#setAccent').checked,
    hud: $('#setHud').checked,
    animations: $('#setAnim').checked,
    adblock: $('#setAdblock').checked,
    httpsOnly: $('#setHttps').checked,
    doNotTrack: $('#setDnt').checked,
    hardwareAcceleration: $('#setHwAccel').checked,
    smoothScrolling: $('#setSmooth').checked,
    backgroundThrottling: $('#setThrottle').checked,
    ramLimit: Number($('#setRam').value),
    processLimit: Number($('#setProc').value),
    fpsLimit: Number($('#setFps').value),
    vsync: $('#setVsync').checked,
  };
  window.nexus.setSettings(patch);
  window.nexus.setCursor(patch.customCursor);
}

['setHomepage','setSearch','setRestore','setBookmarksBar','setTheme','setCursor',
 'setAccent','setHud','setAnim','setAdblock','setHttps','setDnt','setHwAccel',
 'setSmooth','setThrottle','setVsync'
].forEach(id => $('#' + id)?.addEventListener('change', pushSettings));

$('#setOpacity')?.addEventListener('input', (e) => {
  $('#outSetOpacity').textContent = e.target.value + '%';
  document.documentElement.style.setProperty('--opacity', e.target.value / 100);
});
$('#setOpacity')?.addEventListener('change', pushSettings);
$('#setBlur')?.addEventListener('input', (e) => {
  $('#outSetBlur').textContent = e.target.value + 'px';
  document.documentElement.style.setProperty('--blur', e.target.value + 'px');
});
$('#setBlur')?.addEventListener('change', pushSettings);
$('#setRadius')?.addEventListener('input', (e) => {
  $('#outSetRadius').textContent = e.target.value + 'px';
});
$('#setRadius')?.addEventListener('change', pushSettings);
$('#setRam')?.addEventListener('input', (e) => { $('#outSetRam').textContent = e.target.value + ' MB'; });
$('#setRam')?.addEventListener('change', pushSettings);
$('#setProc')?.addEventListener('input', (e) => {
  $('#outSetProc').textContent = e.target.value === '0' ? 'Auto' : e.target.value;
});
$('#setProc')?.addEventListener('change', pushSettings);
$('#setFps')?.addEventListener('input', (e) => {
  $('#outSetFps').textContent = e.target.value === '0' ? 'Bez limitu' : e.target.value + ' FPS';
});
$('#setFps')?.addEventListener('change', pushSettings);

/* ---------- WYDAJNOŚĆ ---------- */
$('#btnCleanMem')?.addEventListener('click', async () => {
  const btn = $('#btnCleanMem');
  const report = $('#settingsCleanReport');
  btn.disabled = true;
  report.textContent = 'Czyszczenie…';
  try {
    const r = await window.nexus.cleanMemory();
    report.textContent = `✓ Zwolniono ~${r.freedMB} MB · zamrożono ${r.frozen} kart`;
  } catch (e) { report.textContent = 'Błąd: ' + e.message; }
  finally { btn.disabled = false; setTimeout(() => report.textContent = '', 6000); }
});
$('#btnRestart')?.addEventListener('click', async () => {
  const yes = await nexusConfirm('Restart NEXUS', 'Zrestartować przeglądarkę, aby zastosować limity?', 'Restartuj');
  if (yes) window.nexus.restart();
});

/* ---------- PRYWATNOŚĆ ---------- */
$('#btnClearData')?.addEventListener('click', async () => {
  const yes = await nexusConfirm('Wyczyść dane', 'Wyczyścić WSZYSTKIE dane przeglądania?', 'Wyczyść wszystko', true);
  if (!yes) return;
  await window.nexus.clearData();
  await window.nexus.clearHistory();
  await nexusAlert('Gotowe', 'Wszystkie dane zostały wyczyszczone.');
});

/* ---------- ROZSZERZENIA ---------- */
async function refreshExtensions() {
  const list = await window.nexus.extList();
  const box = $('#extListFull');
  if (!box) return;
  if (!list.length) { box.innerHTML = '<div class="muted">Brak wczytanych rozszerzeń</div>'; return; }
  box.innerHTML = '';
  for (const e of list) {
    const el = document.createElement('div');
    el.className = 'ext-item';
    el.innerHTML = `
      <div class="ext-info">
        <div class="ext-name">${escapeHtml(e.name)}</div>
        <div class="ext-version muted">v${escapeHtml(e.version)} · ${escapeHtml((e.id || '').slice(0, 12))}…</div>
      </div>
      <div class="ext-actions">
        <button class="ext-btn" data-action="toggle" data-id="${e.id}">${e.enabled ? '⏸' : '▶'}</button>
        <button class="ext-btn ext-remove" data-action="remove" data-id="${e.id}">✕</button>
      </div>
    `;
    box.appendChild(el);
  }
  $$('.ext-btn[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await nexusConfirm('Usuń rozszerzenie', 'Usunąć to rozszerzenie?', 'Usuń', true)) {
        await window.nexus.extRemove(btn.dataset.id);
        refreshExtensions();
      }
    });
  });
  $$('.ext-btn[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const enabled = btn.textContent.trim() === '⏸';
      if (enabled) await window.nexus.extDisable(btn.dataset.id);
      else await window.nexus.extEnable(btn.dataset.id);
      refreshExtensions();
    });
  });
}
$('#btnExtLoad')?.addEventListener('click', async () => {
  const r = await window.nexus.extLoad();
  if (r.ok) { await nexusAlert('Sukces', 'Rozszerzenie załadowane: ' + r.name); refreshExtensions(); }
  else if (r.error) await nexusAlert('Błąd', r.error);
});
$('#btnExtStore')?.addEventListener('click', () => window.nexus.extOpenStore());
$('#btnExtReload')?.addEventListener('click', async () => {
  const r = await window.nexus.extReload();
  if (r.ok) { refreshExtensions(); await nexusAlert('Gotowe', 'Przeładowano wszystkie rozszerzenia.'); }
});

/* ---------- HASŁA ---------- */
async function refreshPasswords(q = '') {
  PASSWORDS = q ? await window.nexus.searchPasswords(q) : await window.nexus.getPasswords();
  renderPasswords();
}
function renderPasswords() {
  const box = $('#pwList');
  if (!box) return;
  if (!PASSWORDS.length) { box.innerHTML = '<div class="muted">Brak zapisanych haseł</div>'; return; }
  box.innerHTML = '';
  for (const p of PASSWORDS) {
    const el = document.createElement('div');
    el.className = 'pw-item';
    el.innerHTML = `
      <div class="pw-item-info">
        <div class="pw-item-site">${escapeHtml(p.site)}</div>
        <div class="pw-item-meta">${escapeHtml(p.username || '—')} · ${escapeHtml(p.category || 'ogólne')}</div>
      </div>
      <div class="pw-item-actions">
        <button class="ext-btn" data-action="copy-user" data-id="${p.id}" title="Kopiuj login">👤</button>
        <button class="ext-btn" data-action="reveal" data-id="${p.id}" title="Pokaż hasło">👁</button>
        <button class="ext-btn" data-action="copy-pass" data-id="${p.id}" title="Kopiuj hasło">🔑</button>
        <button class="ext-btn ext-remove" data-action="remove" data-id="${p.id}" title="Usuń">✕</button>
      </div>
    `;
    box.appendChild(el);
  }
  $$('#pwList .ext-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const pw = PASSWORDS.find(p => p.id === id);
      if (!pw) return;
      const action = btn.dataset.action;
      if (action === 'copy-user') {
        navigator.clipboard.writeText(pw.username || '');
        btn.textContent = '✓'; setTimeout(() => btn.textContent = '👤', 900);
      } else if (action === 'reveal') {
        const r = await window.nexus.revealPassword(id);
        if (r.ok) await nexusAlert('Hasło dla ' + pw.site, r.password);
        else await nexusAlert('Błąd', r.error || 'Nie udało się odszyfrować');
      } else if (action === 'copy-pass') {
        const r = await window.nexus.revealPassword(id);
        if (r.ok) {
          navigator.clipboard.writeText(r.password);
          btn.textContent = '✓'; setTimeout(() => btn.textContent = '🔑', 900);
        } else await nexusAlert('Błąd', 'Nie udało się odszyfrować.');
      } else if (action === 'remove') {
        if (await nexusConfirm('Usuń hasło', `Usunąć hasło dla ${pw.site}?`, 'Usuń', true)) {
          await window.nexus.removePassword(id);
          refreshPasswords();
        }
      }
    });
  });
}
$('#pwSearch')?.addEventListener('input', (e) => refreshPasswords(e.target.value));
$('#btnAddPassword')?.addEventListener('click', async () => {
  const site = $('#pwSite').value.trim();
  const username = $('#pwUsername').value.trim();
  const password = $('#pwPassword').value;
  const category = $('#pwCategory').value.trim() || 'ogólne';
  if (!site || !password) { await nexusAlert('Brak danych', 'Witryna i hasło są wymagane.'); return; }
  const r = await window.nexus.addPassword({ site, username, password, category });
  if (r.ok) {
    $('#pwSite').value = ''; $('#pwUsername').value = ''; $('#pwPassword').value = ''; $('#pwCategory').value = '';
    refreshPasswords();
    await nexusAlert('Zapisano', 'Hasło zaszyfrowane AES-256-GCM.');
  } else await nexusAlert('Błąd', r.error || 'Nieznany błąd');
});

/* ---------- COOKIES ---------- */
async function refreshCookies(filter = '') {
  const q = filter.trim().toLowerCase();
  COOKIES = await window.nexus.getCookies(q ? { domain: q } : {});
  renderCookies();
}
function renderCookies() {
  const box = $('#cookieList');
  if (!box) return;
  if (!COOKIES.length) { box.innerHTML = '<div class="muted">Brak cookies dla tego filtra</div>'; return; }
  box.innerHTML = '';
  for (const c of COOKIES.slice(0, 500)) {
    const el = document.createElement('div');
    el.className = 'cookie-item';
    el.innerHTML = `
      <div class="cookie-domain">${escapeHtml(c.domain)}</div>
      <div class="cookie-name">${escapeHtml(c.name)}</div>
      <div class="cookie-value">${escapeHtml(truncate(c.value || '', 40))}</div>
      <div class="cookie-actions">
        <button class="ext-btn ext-remove" data-name="${escapeAttr(c.name)}" data-domain="${escapeAttr(c.domain)}" data-path="${escapeAttr(c.path)}" data-secure="${c.secure}">✕</button>
      </div>
    `;
    box.appendChild(el);
  }
  $$('#cookieList .ext-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = (btn.dataset.secure === 'true' ? 'https://' : 'http://') + btn.dataset.domain.replace(/^\./, '') + (btn.dataset.path || '/');
      await window.nexus.removeCookie({ url, name: btn.dataset.name });
      refreshCookies($('#cookieSearch').value);
    });
  });
}
$('#btnCookiesRefresh')?.addEventListener('click', () => refreshCookies($('#cookieSearch').value));
$('#btnCookiesClearAll')?.addEventListener('click', async () => {
  if (await nexusConfirm('Usuń wszystkie cookies', 'Usunąć WSZYSTKIE cookies?', 'Usuń wszystkie', true)) {
    await window.nexus.clearAllCookies();
    refreshCookies();
    await nexusAlert('Gotowe', 'Wszystkie cookies usunięte.');
  }
});
$('#cookieSearch')?.addEventListener('input', debounce((e) => refreshCookies(e.target.value), 250));

/* ---------- ZAAWANSOWANE ---------- */
$('#advRamLimit')?.addEventListener('change', () => {
  $('#setRam').value = $('#advRamLimit').value;
  $('#outSetRam').textContent = $('#advRamLimit').value + ' MB';
  pushSettings();
});
$('#advProcLimit')?.addEventListener('change', () => {
  $('#setProc').value = $('#advProcLimit').value;
  $('#outSetProc').textContent = $('#advProcLimit').value === '0' ? 'Auto' : $('#advProcLimit').value;
  pushSettings();
});
$('#btnResetSettings')?.addEventListener('click', async () => {
  if (await nexusConfirm('Reset ustawień', 'Przywrócić ustawienia domyślne?', 'Resetuj', true)) {
    await window.nexus.resetSettings();
    await loadSettings();
    await nexusAlert('Gotowe', 'Ustawienia przywrócone.');
  }
});
$('#btnOpenUserData')?.addEventListener('click', () => window.nexus.openUserData());
$('#btnOpenDownloadFolder')?.addEventListener('click', () => window.nexus.openDownloads());
$('#btnExportSettings')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(SETTINGS, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'nexus-settings.json'; a.click();
  URL.revokeObjectURL(url);
});
$('#btnImportSettings')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await window.nexus.setSettings(data);
      await loadSettings();
      await nexusAlert('Sukces', 'Ustawienia zaimportowane.');
    } catch (err) { await nexusAlert('Błąd importu', err.message); }
  };
  input.click();
});

/* ---------- O NEXUS ---------- */
async function loadAboutInfo() {
  try {
    const m = await window.nexus.getMetrics();
    $('#appCores').textContent = m.cores || '—';
    $('#appTotalRam').textContent = m.totalMem ? Math.round(m.totalMem) + ' MB' : '—';
    $('#appPlatform').textContent = m.platform || navigator.platform || '—';
    $('#appArch').textContent = m.arch || '—';

    // ← DODAJ TO (3 linijki):
    const v = await window.nexus.getCurrentVersion();
    if (v?.version) $('#appVersion').textContent = v.version;
  } catch (e) {}
}

/* ---------- UTIL ---------- */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}
function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function truncate(s, n) { return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''); }
function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ==========================================================================
   Sync ze zmianami z innych okien (np. z okna głównego NEXUS)
   ========================================================================== */
window.nexus.onSettingsChanged?.((s) => {
  SETTINGS = s;
  syncUI(s);
});

/* ---------- INIT ---------- */
(async function init() {
  await loadSettings();
  console.log('[NEXUS] Settings ready');
})();