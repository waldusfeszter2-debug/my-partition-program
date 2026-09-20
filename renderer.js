/* ==========================================================================
   NEXUS 1.0 – renderer.js  (POPRAWIONY – brak pętli motywu, sync settings)
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STATE = {
  tabs: [], activeId: null, settings: {},
  bookmarks: [], history: [], downloads: [],
  fpsLimit: 0, fpsLimitTimer: null,
  metrics: null,
  applyingThemeFromBroadcast: false,   // ← NOWE: flaga anty-pętla
};

/* ---------- UTIL ---------- */
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function debounce(fn, ms = 200) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

function resolveUrl(input) {
  const s = (input || '').trim();
  if (!s) return STATE.settings.homepage || 'https://www.google.com';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^file:\/\//i.test(s)) return s;
  if (/^view-source:/i.test(s)) return s;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(s)) return 'http://' + s;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s)) return 'https://' + s;
  if (/\.pdf$/i.test(s)) return 'file://' + s.replace(/\\/g, '/');
  const engine = STATE.settings.searchEngine || 'https://www.google.com/search?q=';
  return engine + encodeURIComponent(s);
}

function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function faviconLetter(url, title) { const h = hostOf(url); return h ? h[0].toUpperCase() : (title || '?')[0].toUpperCase(); }
function setCssVar(n, v) { document.documentElement.style.setProperty(n, v); }
function getCssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
function truncate(s, n) { return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''); }
function formatBytes(b) {
  if (!b || b === 0) return '0 B';
  const u = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

function setInsets() {
  const chrome = $('.chrome');
  const h = chrome ? chrome.getBoundingClientRect().height : 92;
  const hubOpen = $('#hub').dataset.open === 'true';
  window.nexus.setInsets({ top: Math.round(h), right: hubOpen ? 380 : 0 });
}

/* ---------- TOAST ---------- */
function toast(msg, type = 'info', duration = 2800) {
  const c = $('#toastContainer'); if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/* ---------- CUSTOM DIALOG ---------- */
const dialogEls = {
  overlay: $('#modalOverlay'),
  title: $('#modalTitle'),
  body: $('#modalBody'),
  footer: $('#modalFooter'),
  close: $('#modalClose'),
};
let dialogResolver = null;

function openDialog({ title, body, buttons, onMount }) {
  return new Promise((resolve) => {
    dialogResolver = resolve;
    dialogEls.title.textContent = title || '';
    dialogEls.body.innerHTML = '';
    dialogEls.footer.innerHTML = '';
    if (typeof body === 'string') {
      const p = document.createElement('div');
      p.textContent = body;
      dialogEls.body.appendChild(p);
    } else if (body instanceof Node) {
      dialogEls.body.appendChild(body);
    }
    (buttons || [{ label: 'OK', variant: 'primary', value: true }]).forEach(btn => {
      const b = document.createElement('button');
      b.className = 'modal-btn ' + (btn.variant || 'ghost');
      b.textContent = btn.label;
      b.addEventListener('click', () => closeDialog(btn.value));
      dialogEls.footer.appendChild(b);
    });
    dialogEls.overlay.hidden = false;
    if (onMount) onMount(dialogEls.body);
  });
}
function closeDialog(value) {
  if (!dialogEls.overlay.hidden) {
    dialogEls.overlay.hidden = true;
    if (dialogResolver) { const r = dialogResolver; dialogResolver = null; r(value); }
  }
}
dialogEls.close?.addEventListener('click', () => closeDialog(null));
dialogEls.overlay?.addEventListener('click', (e) => {
  if (e.target === dialogEls.overlay) closeDialog(null);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dialogEls.overlay.hidden) closeDialog(null);
});
function dialogAlert(title, message) {
  return openDialog({ title, body: message, buttons: [{ label: 'OK', variant: 'primary', value: true }] });
}
function dialogConfirm(title, message, confirmLabel = 'OK', danger = false) {
  return openDialog({
    title, body: message,
    buttons: [
      { label: 'Anuluj', variant: 'ghost', value: false },
      { label: confirmLabel, variant: danger ? 'danger' : 'primary', value: true },
    ],
  });
}

/* ---------- TABS ---------- */
const tabsEl = $('#tabs');

function renderTabs() {
  if (!tabsEl) return;
  tabsEl.innerHTML = '';
  for (const t of STATE.tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === STATE.activeId ? ' active' : '') + (t.frozen ? ' frozen' : '') + (t.pinned ? ' pinned' : '');
    el.draggable = true;
    el.dataset.id = t.id;
    el.title = (t.title || '') + '\n' + (t.url || '');

    const fav = document.createElement('div');
    fav.className = 'favicon';
    if (t.favicon) {
      const img = document.createElement('img');
      img.src = t.favicon;
      img.onerror = () => { img.remove(); fav.textContent = faviconLetter(t.url, t.title); };
      fav.appendChild(img);
    } else fav.textContent = faviconLetter(t.url, t.title);

    const title = document.createElement('div');
    title.className = 'title';
    const prefix = t.frozen ? '❄ ' : (t.muted ? '🔇 ' : '');
    title.textContent = prefix + (t.title || 'Nowa karta');

    const close = document.createElement('div');
    close.className = 'close';
    close.textContent = '✕';
    close.addEventListener('click', (e) => { e.stopPropagation(); window.nexus.closeTab(t.id); });

    el.append(fav, title, close);
    el.addEventListener('click', () => window.nexus.activateTab(t.id));
    el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); window.nexus.closeTab(t.id); } });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); showTabMenu(e, t); });
    el.addEventListener('dragstart', (e) => {
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(t.id));
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromId = Number(e.dataTransfer.getData('text/plain'));
      if (!fromId || fromId === t.id) return;
      const fi = STATE.tabs.findIndex(x => x.id === fromId);
      const ti = STATE.tabs.findIndex(x => x.id === t.id);
      if (fi < 0 || ti < 0) return;
      const [m] = STATE.tabs.splice(fi, 1);
      STATE.tabs.splice(ti, 0, m);
      renderTabs();
    });

    tabsEl.appendChild(el);
  }
}

let ctxEl = null;
function closeCtx() { if (ctxEl) { ctxEl.remove(); ctxEl = null; } }

function showTabMenu(e, tab) {
  closeCtx();
  ctxEl = document.createElement('div');
  ctxEl.style.cssText = `
    position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:1000;
    background:var(--glass-2);backdrop-filter:blur(var(--blur));
    -webkit-backdrop-filter:blur(var(--blur));
    border:1px solid var(--border);border-radius:14px;padding:6px;
    box-shadow:inset 0 1px 0 var(--specular),var(--shadow);min-width:210px;font-size:12.5px;
  `;
  const items = [
    { label: '⟳  Odśwież', action: () => window.nexus.reload() },
    { label: '⟳  Twarde odświeżenie', action: () => window.nexus.hardReload() },
    { label: '⧉  Duplikuj kartę', action: () => window.nexus.duplicate() },
    { label: (tab.muted ? '🔊  Wyłącz wyciszenie' : '🔇  Wycisz kartę'), action: () => window.nexus.muteTab() },
    { label: (tab.pinned ? '📌  Odepnij' : '📌  Przypnij'), action: () => window.nexus.pinTab() },
    { sep: true },
    { label: '✕  Zamknij inne karty', action: () => window.nexus.closeOthers() },
    { label: '✕  Zamknij karty po prawej', action: () => window.nexus.closeRight() },
    { label: '✕  Zamknij kartę', action: () => window.nexus.closeTab(tab.id) },
  ];
  for (const it of items) {
    if (it.sep) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border-outer);margin:4px 6px;';
      ctxEl.appendChild(sep);
      continue;
    }
    const b = document.createElement('div');
    b.textContent = it.label;
    b.style.cssText = 'padding:8px 12px;border-radius:9px;color:var(--text);cursor:pointer;';
    b.addEventListener('mouseenter', () => b.style.background = 'rgba(127,127,140,.14)');
    b.addEventListener('mouseleave', () => b.style.background = 'transparent');
    b.addEventListener('click', () => { closeCtx(); it.action(); });
    ctxEl.appendChild(b);
  }
  document.body.appendChild(ctxEl);
  const r = ctxEl.getBoundingClientRect();
  if (r.right > window.innerWidth) ctxEl.style.left = (window.innerWidth - r.width - 8) + 'px';
  if (r.bottom > window.innerHeight) ctxEl.style.top = (window.innerHeight - r.height - 8) + 'px';
  setTimeout(() => {
    document.addEventListener('click', closeCtx, { once: true });
    document.addEventListener('contextmenu', closeCtx, { once: true });
  }, 0);
}

/* ---------- OMNIBOX ---------- */
const omnibox = $('#omnibox');
const schemeIcon = $('#schemeIcon');

function commitOmnibox() {
  const url = resolveUrl(omnibox.value);
  window.nexus.navigate(url);
  omnibox.value = url;
  omnibox.blur();
}
$('#btnGo')?.addEventListener('click', commitOmnibox);
omnibox?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') commitOmnibox();
  if (e.key === 'Escape') omnibox.blur();
});

/* ---------- NAWIGACJA / OKNO ---------- */
$('#btnBack')?.addEventListener('click', () => window.nexus.back());
$('#btnForward')?.addEventListener('click', () => window.nexus.forward());
$('#btnReload')?.addEventListener('click', () => window.nexus.reload());
$('#btnHome')?.addEventListener('click', () => window.nexus.home());
$('#btnNewTab')?.addEventListener('click', () => window.nexus.createTab());
$('#wcMin')?.addEventListener('click', () => window.nexus.winMin());
$('#wcMax')?.addEventListener('click', () => window.nexus.winMax());
$('#wcClose')?.addEventListener('click', () => window.nexus.winClose());

/* ---------- USTAWIENIA ---------- */
function openSettings() { window.nexus.openSettings(); }
$('#btnSettingsTop')?.addEventListener('click', openSettings);
$('#btnSidebarSettings')?.addEventListener('click', openSettings);
$('#btnOpenSettingsHub')?.addEventListener('click', openSettings);

/* ---------- HUB ---------- */
const hub = $('#hub');
$('#btnHub')?.addEventListener('click', () => {
  const open = hub.dataset.open === 'true';
  hub.dataset.open = String(!open);
  window.nexus.setHubOpen(!open);
  setTimeout(setInsets, 350);
});
function openHub() {
  if (hub.dataset.open !== 'true') {
    hub.dataset.open = 'true';
    window.nexus.setHubOpen(true);
    setTimeout(setInsets, 350);
  }
}

/* ---------- SIDEBAR ---------- */
$$('.side-btn[data-url]').forEach(btn => {
  btn.addEventListener('click', () => window.nexus.createTab(btn.dataset.url));
});
$('#btnSidebarPdf')?.addEventListener('click', async () => {
  const r = await window.nexus.openPdf();
  if (r.ok) toast('Otwarto PDF', 'success');
});
$('#btnSidebarBookmark')?.addEventListener('click', addBookmark);
$('#btnSidebarHistory')?.addEventListener('click', () => {
  openHub(); setTimeout(() => $('#historySearch')?.focus(), 400);
});
$('#btnSidebarDownloads')?.addEventListener('click', () => {
  openHub(); setTimeout(() => $('#downloadsList')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
});

/* ---------- MOTYWY (POPRAWIONY – bez pętli) ---------- */
const THEMES = ['theme-liquid-glass', 'theme-ultra-dark', 'theme-cyberpunk', 'theme-apple-clean'];

function applyTheme(key, skipSave = false) {
  if (!key) key = 'liquid-glass';
  document.body.classList.remove(...THEMES);
  document.body.classList.add('theme-' + key);
  $$('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === key));
  // Zapisuj tylko jeśli NIE pochodzi z broadcastu settings:changed
  if (!skipSave) {
    window.nexus.setSettings({ theme: key });
  }
}

$$('.theme-card').forEach(card => card.addEventListener('click', () => applyTheme(card.dataset.theme, false)));

/* ---------- SUWAKI WYGLĄDU ---------- */
$('#rngOpacity')?.addEventListener('input', (e) => {
  setCssVar('--opacity', e.target.value / 100);
  $('#outOpacity').textContent = e.target.value + '%';
});
$('#rngBlur')?.addEventListener('input', (e) => {
  setCssVar('--blur', e.target.value + 'px');
  $('#outBlur').textContent = e.target.value + 'px';
});
$('#rngRadius')?.addEventListener('input', (e) => {
  setCssVar('--radius', e.target.value + 'px');
  $('#outRadius').textContent = e.target.value + 'px';
});
$('#chkAccent')?.addEventListener('change', (e) => document.body.classList.toggle('no-accent', !e.target.checked));
$('#chkHud')?.addEventListener('change', (e) => $('#hud')?.classList.toggle('hidden', !e.target.checked));
$('#chkAnim')?.addEventListener('change', (e) => document.body.classList.toggle('no-anim', !e.target.checked));

/* ---------- KONTROLA MOCY ---------- */
function pushPower() {
  window.nexus.applyPower({
    ramLimit: Number($('#rngRam')?.value || 4096),
    processLimit: Number($('#rngProc')?.value || 0),
    fpsLimit: Number($('#rngFps')?.value || 0),
    vsync: $('#chkVsync')?.checked ?? true,
    backgroundThrottling: $('#chkThrottle')?.checked ?? true,
    adblock: $('#chkAdblock')?.checked ?? true,
    httpsOnly: $('#chkHttps')?.checked ?? false,
    doNotTrack: $('#chkDnt')?.checked ?? true,
  });
}
$('#rngRam')?.addEventListener('input', (e) => $('#outRam').textContent = e.target.value + ' MB');
$('#rngProc')?.addEventListener('input', (e) => $('#outProc').textContent = e.target.value === '0' ? 'Auto' : e.target.value);
$('#rngFps')?.addEventListener('input', (e) => {
  $('#outFps').textContent = e.target.value === '0' ? 'Bez limitu' : e.target.value + ' FPS';
  STATE.fpsLimit = Number(e.target.value);
  applyFpsLimit();
});
['rngRam','rngProc','chkVsync','chkThrottle','chkAdblock','chkHttps','chkDnt'].forEach(id =>
  $('#' + id)?.addEventListener('change', pushPower));

function applyFpsLimit() {
  if (STATE.fpsLimitTimer) { clearInterval(STATE.fpsLimitTimer); STATE.fpsLimitTimer = null; }
  if (!STATE.fpsLimit) return;
  const interval = Math.round(1000 / STATE.fpsLimit);
  STATE.fpsLimitTimer = setInterval(() => window.dispatchEvent(new Event('nexus-fps-tick')), interval);
}

$('#btnClean')?.addEventListener('click', async () => {
  const btn = $('#btnClean'), report = $('#cleanReport');
  btn.disabled = true; report.textContent = 'Czyszczenie…';
  try {
    const r = await window.nexus.cleanMemory();
    report.textContent = `✓ Zwolniono ~${r.freedMB} MB · zamrożono ${r.frozen} kart`;
    toast('Pamięć wyczyszczona', 'success');
  } catch (e) { report.textContent = 'Błąd: ' + e.message; }
  finally { btn.disabled = false; setTimeout(() => report.textContent = '', 5000); }
});

/* ---------- NARZĘDZIA STRONY ---------- */
$('#btnZoomIn')?.addEventListener('click', async () => { const r = await window.nexus.zoomIn(); if (r.ok) toast('Powiększenie: ' + Math.round(r.zoom * 100) + '%', 'info', 1500); });
$('#btnZoomOut')?.addEventListener('click', async () => { const r = await window.nexus.zoomOut(); if (r.ok) toast('Powiększenie: ' + Math.round(r.zoom * 100) + '%', 'info', 1500); });
$('#btnZoomReset')?.addEventListener('click', async () => { await window.nexus.zoomReset(); toast('Powiększenie: 100%', 'info', 1500); });
$('#btnPrint')?.addEventListener('click', () => window.nexus.print());
$('#btnScreenshot')?.addEventListener('click', async () => { const r = await window.nexus.screenshot(); if (r.ok) toast('Zapisano: ' + r.path, 'success'); else toast('Błąd: ' + r.error, 'error'); });
$('#btnSavePage')?.addEventListener('click', async () => { const r = await window.nexus.savePage(); if (r.ok) toast('Zapisano: ' + r.path, 'success'); });
$('#btnViewSource')?.addEventListener('click', () => window.nexus.viewSource());
$('#btnDevTools')?.addEventListener('click', () => window.nexus.openDevTools());
$('#btnClearData')?.addEventListener('click', async () => {
  if (await dialogConfirm('Wyczyść dane', 'Wyczyścić cache, cookies i dane witryn?', 'Wyczyść', true)) {
    await window.nexus.clearData();
    toast('Dane wyczyszczone', 'success');
  }
});
$('#btnReadingMode')?.addEventListener('click', async () => {
  const r = await window.nexus.readingMode();
  if (r.ok) toast(r.active ? 'Tryb czytania włączony' : 'Tryb czytania wyłączony');
});

/* ---------- FIND BAR ---------- */
const findBar = $('#findBar');
const findInput = $('#findInput');
function openFind() { findBar.dataset.open = 'true'; findInput.focus(); findInput.select(); }
function closeFind() { findBar.dataset.open = 'false'; window.nexus.stopFind(); }
$('#btnFindClose')?.addEventListener('click', closeFind);
$('#btnFindNext')?.addEventListener('click', () => { if (findInput.value) window.nexus.findInPage(findInput.value); });
findInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.nexus.findInPage(findInput.value);
  if (e.key === 'Escape') closeFind();
});

/* ---------- BOOKMARKS ---------- */
async function refreshBookmarks() {
  STATE.bookmarks = await window.nexus.getBookmarks();
  const box = $('#bookmarksList'); if (!box) return;
  box.innerHTML = '';
  if (!STATE.bookmarks.length) { box.innerHTML = '<div class="muted">Brak zakładek</div>'; return; }
  for (const b of STATE.bookmarks) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-favicon">${faviconLetter(b.url, b.title)}</div>
      <div class="list-body">
        <div class="list-title">${escapeHtml(truncate(b.title || b.url, 50))}</div>
        <div class="list-url muted">${escapeHtml(truncate(b.url, 60))}</div>
      </div>
      <button class="list-remove">✕</button>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('list-remove')) return;
      window.nexus.createTab(b.url);
    });
    item.querySelector('.list-remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.nexus.removeBookmark(b.url);
      refreshBookmarks();
    });
    box.appendChild(item);
  }
}

async function addBookmark() {
  const url = omnibox.value;
  if (!url || url.startsWith('view-source:') || url.startsWith('file://')) {
    toast('Nie można dodać tej strony do zakładek', 'error'); return;
  }
  const t = STATE.tabs.find(t => t.id === STATE.activeId);
  const r = await window.nexus.addBookmark({ url, title: t?.title || url });
  if (r.ok) { toast('Dodano do zakładek', 'success'); refreshBookmarks(); }
  else toast(r.error || 'Nie udało się', 'error');
}

/* ---------- HISTORIA ---------- */
async function refreshHistory(q = '') {
  STATE.history = await window.nexus.getHistory(q);
  const box = $('#historyList'); if (!box) return;
  box.innerHTML = '';
  if (!STATE.history.length) { box.innerHTML = '<div class="muted">Brak wpisów</div>'; return; }
  for (const h of STATE.history.slice(0, 100)) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-favicon">${faviconLetter(h.url, h.title)}</div>
      <div class="list-body">
        <div class="list-title">${escapeHtml(truncate(h.title || h.url, 50))}</div>
        <div class="list-url muted">${escapeHtml(truncate(h.url, 60))}</div>
      </div>
    `;
    item.addEventListener('click', () => window.nexus.createTab(h.url));
    box.appendChild(item);
  }
}
$('#historySearch')?.addEventListener('input', debounce((e) => refreshHistory(e.target.value), 250));
$('#btnClearHistory')?.addEventListener('click', async () => {
  if (await dialogConfirm('Wyczyść historię', 'Wyczyścić całą historię przeglądania?', 'Wyczyść', true)) {
    await window.nexus.clearHistory(); refreshHistory(); toast('Historia wyczyszczona', 'success');
  }
});

/* ---------- DOWNLOADS ---------- */
async function refreshDownloads() {
  STATE.downloads = await window.nexus.getDownloads();
  renderDownloads();
}
function renderDownloads() {
  const box = $('#downloadsList'); if (!box) return;
  box.innerHTML = '';
  if (!STATE.downloads.length) { box.innerHTML = '<div class="muted">Brak pobrań</div>'; return; }
  for (const d of STATE.downloads.slice(0, 50)) {
    const pct = d.total ? Math.round((d.received / d.total) * 100) : (d.done ? 100 : 0);
    const item = document.createElement('div');
    item.className = 'download-item';
    item.title = d.savePath || '';
    item.innerHTML = `
      <div class="download-icon">${d.done ? '✓' : '⬇'}</div>
      <div class="download-info">
        <div class="download-name">${escapeHtml(truncate(d.filename, 35))}</div>
        <div class="download-meta">${d.done ? 'Zakończono' : `${pct}% · ${formatBytes(d.received || 0)}`}</div>
        ${!d.done ? `<div class="download-progress"><div class="download-bar" style="width:${pct}%"></div></div>` : ''}
      </div>
      <div class="download-actions">
        <button title="Pokaż w folderze" data-action="reveal">📁</button>
        <button title="Otwórz" data-action="open">↗</button>
      </div>
    `;
    item.querySelector('[data-action="reveal"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (d.savePath) window.nexus.revealDownloadFile(d.savePath);
    });
    item.querySelector('[data-action="open"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (d.savePath) window.nexus.openDownloadFile(d.savePath);
    });
    box.appendChild(item);
  }
}
$('#btnOpenDownloadFolder')?.addEventListener('click', () => window.nexus.openDownloadFolder());

/* ---------- HUD ---------- */
function initHud() {
  const hudFps = $('#hudFps');
  const hudFrame = $('#hudFrame');
  if (!hudFps || !hudFrame) return;

  let lastT = performance.now();
  let frames = 0;
  let lastFlush = performance.now();
  let frameTimeSum = 0;
  let frameTimeCount = 0;

  function loop(now) {
    const delta = now - lastT;
    lastT = now;
    frames++;
    frameTimeSum += delta;
    frameTimeCount++;

    if (now - lastFlush >= 500) {
      const realFps = Math.round((frames * 1000) / (now - lastFlush));
      const avgFrameMs = frameTimeCount > 0 ? (frameTimeSum / frameTimeCount) : 0;
      let shownFps;
      if (realFps >= 200) shownFps = 240;
      else if (realFps >= 110) shownFps = 120;
      else if (realFps >= 50) shownFps = 60;
      else shownFps = realFps;
      hudFps.textContent = shownFps;
      hudFrame.textContent = avgFrameMs.toFixed(1) + ' ms';
      frames = 0; frameTimeSum = 0; frameTimeCount = 0; lastFlush = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  async function updateMetrics() {
    try {
      const m = await window.nexus.getMetrics(); if (!m) return;
      STATE.metrics = m;
      const cpuEl = $('#hudCpu'), ramEl = $('#hudRam'), adEl = $('#hudAdblock');
      if (cpuEl) cpuEl.textContent = (m.cpu || 0).toFixed(0) + '%';
      if (ramEl) {
        ramEl.textContent = m.ramMB >= 1024
          ? (m.ramMB / 1024).toFixed(1) + ' GB'
          : Math.round(m.ramMB || 0) + ' MB';
      }
      if (adEl) adEl.textContent = m.adblockCount || 0;
      if (ramEl) {
        ramEl.parentElement.title =
          `Procesy: ${m.processes}\n` +
          `Główny: ${Math.round(m.ramMBMain || 0)} MB\n` +
          `Renderer: ${Math.round(m.ramMBRenderer || 0)} MB\n` +
          `GPU: ${Math.round(m.ramMBGpu || 0)} MB\n` +
          `Utility: ${Math.round(m.ramMBUtility || 0)} MB\n` +
          `RAZEM: ${Math.round(m.ramMB || 0)} MB`;
      }
    } catch (e) {}
  }
  updateMetrics();
  setInterval(updateMetrics, 1000);
}

/* ---------- EVENTY ---------- */
window.nexus.onTabList(({ tabs, activeId }) => {
  STATE.tabs = tabs; STATE.activeId = activeId; renderTabs();
  const a = tabs.find(t => t.id === activeId);
  if (a && document.activeElement !== omnibox) omnibox.value = a.url;
});
window.nexus.onTabUpdate((patch) => {
  const t = STATE.tabs.find(x => x.id === patch.id); if (!t) return;
  Object.assign(t, patch);
  if (patch.id === STATE.activeId && patch.url && document.activeElement !== omnibox) omnibox.value = patch.url;
  renderTabs();
});
window.nexus.onTabActivated(({ id }) => {
  STATE.activeId = id;
  const t = STATE.tabs.find(x => x.id === id);
  if (t) omnibox.value = t.url;
  renderTabs();
});
window.nexus.onNavState((s) => {
  const back = $('#btnBack'), fwd = $('#btnForward');
  if (back) back.disabled = !s.canGoBack;
  if (fwd) fwd.disabled = !s.canGoForward;
  if (document.activeElement !== omnibox) omnibox.value = s.url;
  if (schemeIcon) schemeIcon.style.color = /^https:/i.test(s.url) ? getCssVar('--accent-2') : '#ff9f0a';
});

window.nexus.onDownload((d) => {
  if (d.type === 'started') {
    toast('⬇ Pobieranie: ' + truncate(d.filename, 40), 'info', 2500);
    refreshDownloads();
  } else if (d.type === 'progress') {
    const rec = STATE.downloads.find(x => x.id === d.id);
    if (rec) { rec.received = d.received; rec.total = d.total; }
    renderDownloads();
  } else if (d.type === 'done') {
    if (d.state === 'completed') toast('✓ Pobrano: ' + truncate(d.filename, 40), 'success', 3500);
    else toast('⚠ Przerwano: ' + truncate(d.filename, 40), 'error', 3500);
    refreshDownloads();
  }
});

/* POPRAWKA: settings:changed z flagą anty-pętla */
window.nexus.onSettingsChanged((s) => {
  STATE.settings = s;

  // Motyw – zastosuj BEZ zapisu (skipSave=true)
  if (s.theme) {
    STATE.applyingThemeFromBroadcast = true;
    applyTheme(s.theme, true);
    STATE.applyingThemeFromBroadcast = false;
  }

  if (s.customCursor) document.body.setAttribute('data-cursor', s.customCursor);

  // Sync przełączników Hub
  const sync = (id, val) => { const el = $('#' + id); if (el) el.checked = !!val; };
  sync('chkAdblock', s.adblock);
  sync('chkHttps', s.httpsOnly);
  sync('chkDnt', s.doNotTrack);
  sync('chkVsync', s.vsync);
  sync('chkThrottle', s.backgroundThrottling);
});

/* ---------- SKRÓTY ---------- */
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (ctrl && key === 't' && !e.shiftKey) { e.preventDefault(); window.nexus.createTab(); return; }
  if (ctrl && e.shiftKey && key === 't') { e.preventDefault(); window.nexus.duplicate(); return; }
  if (ctrl && key === 'w') { e.preventDefault(); if (STATE.activeId) window.nexus.closeTab(STATE.activeId); return; }
  if (ctrl && key === 'l') { e.preventDefault(); omnibox.focus(); omnibox.select(); return; }
  if (ctrl && key === 'f') { e.preventDefault(); openFind(); return; }
  if (ctrl && key === 'r' && !e.shiftKey) { e.preventDefault(); window.nexus.reload(); return; }
  if (ctrl && e.shiftKey && key === 'r') { e.preventDefault(); window.nexus.hardReload(); return; }
  if (ctrl && key === 'm') { e.preventDefault(); window.nexus.muteTab(); return; }
  if (ctrl && key === 'd') { e.preventDefault(); addBookmark(); return; }
  if (ctrl && key === 'h') { e.preventDefault(); openHub(); setTimeout(() => $('#historySearch')?.focus(), 400); return; }
  if (ctrl && key === 'j') { e.preventDefault(); openHub(); return; }
  if (ctrl && key === ',') { e.preventDefault(); openSettings(); return; }
  if (ctrl && key === 'p' && !e.shiftKey) { e.preventDefault(); window.nexus.print(); return; }
  if (ctrl && (key === '=' || key === '+')) { e.preventDefault(); $('#btnZoomIn')?.click(); return; }
  if (ctrl && key === '-') { e.preventDefault(); $('#btnZoomOut')?.click(); return; }
  if (ctrl && key === '0') { e.preventDefault(); $('#btnZoomReset')?.click(); return; }
  if (ctrl && /^[1-9]$/.test(key)) {
    e.preventDefault();
    const idx = parseInt(key) - 1;
    if (STATE.tabs[idx]) window.nexus.activateTab(STATE.tabs[idx].id);
    return;
  }
  if (ctrl && e.key === 'Tab') {
    e.preventDefault();
    if (!STATE.tabs.length) return;
    const i = STATE.tabs.findIndex(t => t.id === STATE.activeId);
    window.nexus.activateTab(STATE.tabs[(i + 1) % STATE.tabs.length].id);
    return;
  }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); window.nexus.back(); return; }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); window.nexus.forward(); return; }
  if (e.key === 'F11') { e.preventDefault(); window.nexus.winFullscreen(); return; }
  if (e.key === 'F12') { e.preventDefault(); window.nexus.openDevTools(); return; }
  if (e.key === 'Escape') closeFind();
});

/* ---------- INICJALIZACJA ---------- */
async function init() {
  console.log('[NEXUS] renderer start');

  try {
    const s = await window.nexus.getSettings();
    STATE.settings = s;
    // WAŻNE: skipSave=true → brak pętli przy starcie
    if (s.theme) applyTheme(s.theme, true);
    if (typeof s.adblock === 'boolean') $('#chkAdblock').checked = s.adblock;
    if (typeof s.httpsOnly === 'boolean') $('#chkHttps').checked = s.httpsOnly;
    if (typeof s.doNotTrack === 'boolean') $('#chkDnt').checked = s.doNotTrack;
    if (typeof s.vsync === 'boolean') $('#chkVsync').checked = s.vsync;
    if (typeof s.backgroundThrottling === 'boolean') $('#chkThrottle').checked = s.backgroundThrottling;
    if (typeof s.ramLimit === 'number') { $('#rngRam').value = s.ramLimit; $('#outRam').textContent = s.ramLimit + ' MB'; }
    if (typeof s.processLimit === 'number') { $('#rngProc').value = s.processLimit; $('#outProc').textContent = s.processLimit === 0 ? 'Auto' : s.processLimit; }
    if (typeof s.fpsLimit === 'number') {
      $('#rngFps').value = s.fpsLimit;
      $('#outFps').textContent = s.fpsLimit === 0 ? 'Bez limitu' : s.fpsLimit + ' FPS';
      STATE.fpsLimit = s.fpsLimit;
      applyFpsLimit();
    }
    if (s.customCursor) document.body.setAttribute('data-cursor', s.customCursor);
  } catch (e) { console.warn('[NEXUS] settings:', e); }

  await refreshBookmarks();
  await refreshHistory();
  await refreshDownloads();
  initHud();

  requestAnimationFrame(() => setInsets());
  setTimeout(setInsets, 100);
  setTimeout(setInsets, 400);
  window.addEventListener('resize', setInsets);

  window.nexus.createTab();
  console.log('[NEXUS] renderer gotowy');
}

window.addEventListener('load', init);