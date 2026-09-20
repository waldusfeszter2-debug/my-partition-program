/* ==========================================================================
   NEXUS 1.0.8 – main.js  (poprawiony: sidebar/modal/toast over WebContentsView)
   ========================================================================== */
const {
  app, BrowserWindow, WebContentsView, ipcMain,
  session, shell, dialog, Menu, clipboard
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

/* --- STAŁE LAYOUTU --- */
const SIDEBAR_WIDTH = 56;   // ← NOWE: szerokość sidebara (zgodne z --sidebar-w w CSS)

/* --- ŚCIEŻKI --- */
const USER_DIR       = app.getPath('userData');
const SETTINGS_PATH  = path.join(USER_DIR, 'settings.json');
const HISTORY_PATH   = path.join(USER_DIR, 'history.json');
const BM_PATH        = path.join(USER_DIR, 'bookmarks.json');
const VAULT_PATH     = path.join(USER_DIR, 'vault.json');
const WINSTATE_PATH  = path.join(USER_DIR, 'window-state.json');
const VAULT_KEY_PATH = path.join(USER_DIR, 'vault.key');
const DL_PATH        = path.join(USER_DIR, 'downloads.json');

const DEFAULT_SETTINGS = {
  homepage: 'https://www.google.com',
  searchEngine: 'https://www.google.com/search?q=',
  theme: 'liquid-glass',
  ramLimit: 4096, processLimit: 0, fpsLimit: 0,
  vsync: true, adblock: true, httpsOnly: false, doNotTrack: true,
  hardwareAcceleration: true, smoothScrolling: true, backgroundThrottling: true,
  customCursor: 'default', showBookmarksBar: true,
  restoreSession: true, askDownloadPath: false,
};

/* --- ADBLOCK (bez zmian) --- */
const AD_HOSTS = [
  'doubleclick.net','googlesyndication.com','googleadservices.com','google-analytics.com',
  'googletagmanager.com','googletagservices.com','adservice.google.com','pagead2.googlesyndication.com',
  'amazon-adsystem.com','adnxs.com','criteo.com','criteo.net','taboola.com','outbrain.com',
  'pubmatic.com','rubiconproject.com','openx.net','casalemedia.com','teads.tv','adform.net',
  'smartadserver.com','scorecardresearch.com','quantserve.com','moatads.com','adroll.com',
  'popads.net','popcash.net','propellerads.com','onclickads.net','adf.ly','sh.st','linkbucks.com',
  'adfoc.us','bc.vc','ouo.io','adfly.tk','shorte.st','cutwin.com','exoclick.com','juicyads.com',
  'trafficjunky.com','plugrush.com','adnium.com','adsterra.com','hilltopads.net','mgid.com',
  'bidvertiser.com','infolinks.com','revcontent.com','zedo.com','adcash.com','clickadu.com',
  'trafficstars.com','exponential.com','tribalfusion.com','valueclick.com',
  '247realmedia.com','advertising.com','atwola.com','yieldmanager.com','adtech.de','adbrite.com',
  'fastclick.net','bluekai.com','demdex.net','everesttech.net','krxd.net','mathtag.com',
  'ml314.com','nexac.com','omtrdc.net','2o7.net','hitbox.com','webtrendslive.com','atdmt.com',
  'tacoda.net','facebook.com/tr','connect.facebook.net','platform.twitter.com',
  'sharethis.com','addthis.com','addthisedge.com','disqusads.com','buysellads.com','carbonads.net',
  'servedbyadbutler.com','adbutler.com','flashtalking.com','sizmek.com','adcolony.com','applovin.com',
  'chartboost.com','unityads.unity3d.com','vungle.com','ironsrc.com','smaato.net','mopub.com',
  'inmobi.com','startapp.com','tapjoy.com','supersonicads.com','appnext.com','fyber.com',
];

let blockedCount = 0;

function isAdHost(hostname) {
  if (!hostname) return false;
  for (const h of AD_HOSTS) {
    if (hostname === h || hostname.endsWith('.' + h) || hostname.includes(h)) return true;
  }
  return false;
}

const COSMETIC_CSS = `
  iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[src*="googleads"],
  iframe[src*="adservice"], iframe[src*="amazon-adsystem"], iframe[src*="taboola"],
  iframe[src*="outbrain"], iframe[src*="criteo"],
  div[id^="google_ads"], div[id*="google_ads_"], div[class*="google-ad"],
  div[id^="div-gpt-ad"], div[class*="gpt-ad"], div[data-ad-slot],
  div[id*="taboola"], div[class*="taboola"], div[id*="outbrain"], div[class*="outbrain"],
  .adsbygoogle, ins.adsbygoogle, .ad-banner, .ad-container, .ad-wrapper,
  .advertisement, .advert, [class*="sponsored"], [id*="sponsored"],
  .banner-ad, .ad-slot, .ad-unit, .ad-placeholder,
  [data-ad], [data-ads], [data-advertisement],
  iframe[title*="Advertisement"], iframe[title*="Reklama"]
  { display: none !important; visibility: hidden !important; height: 0 !important; }
`;

/* --- PERSYSTENCJA (bez zmian) --- */
function readJson(file, fallback) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch (e) { console.warn('[NEXUS] readJson:', file, e.message); }
  return fallback;
}
function writeJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch (e) { console.warn('[NEXUS] writeJson:', file, e.message); }
}

let settings    = { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_PATH, {}) };
let history     = readJson(HISTORY_PATH, []);
let bookmarks   = readJson(BM_PATH, []);
let vault       = readJson(VAULT_PATH, []);
let downloads   = readJson(DL_PATH, []);
let windowState = {
  width: 1400, height: 900, x: undefined, y: undefined, maximized: false,
  ...readJson(WINSTATE_PATH, {})
};

function saveSettings()  { writeJson(SETTINGS_PATH, settings); }
function saveHistory()   { writeJson(HISTORY_PATH, history); }
function saveBookmarks() { writeJson(BM_PATH, bookmarks); }
function saveVault()     { fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2), { mode: 0o600 }); }
function saveDownloads() { writeJson(DL_PATH, downloads.slice(-200)); }

/* --- AES (bez zmian) --- */
function getVaultKey() {
  if (fs.existsSync(VAULT_KEY_PATH)) return Buffer.from(fs.readFileSync(VAULT_KEY_PATH, 'hex'), 'hex');
  const key = crypto.randomBytes(32);
  fs.writeFileSync(VAULT_KEY_PATH, key.toString('hex'), { mode: 0o600 });
  return key;
}
function encryptAES(plaintext) {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: encrypted.toString('hex') };
}
function decryptAES(enc) {
  const key = getVaultKey();
  const iv = Buffer.from(enc.iv, 'hex');
  const tag = Buffer.from(enc.tag, 'hex');
  const data = Buffer.from(enc.data, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/* --- SWITCHES --- */
if (settings.ramLimit) app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${settings.ramLimit}`);
if (settings.processLimit > 0) app.commandLine.appendSwitch('renderer-process-limit', String(settings.processLimit));
if (!settings.vsync) {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}
if (!settings.hardwareAcceleration) app.disableHardwareAcceleration();
if (settings.smoothScrolling) app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('enable-features', 'PdfOopif');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');

/* --- SINGLE INSTANCE --- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, commandLine) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    const urlArg = commandLine.find(a => a.startsWith('http'));
    if (urlArg) createTab(urlArg);
  });
}

/* --- STAN GLOBALNY --- */
let win = null;
let settingsWindow = null;
const tabs = new Map();
let activeTabId = null;
let nextTabId = 1;
let chromeHeight = 92;
let hubWidth = 0;
let modalOpen = false;   // ← NOWE: blokuje wyświetlanie WebContentsView gdy modal otwarty

/* --- AUTO-UPDATER (bez zmian, pełna wersja) --- */
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
try {
  log.transports.file.level = 'info';
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.console.level = 'info';
} catch (e) {}
autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

const updateState = { status: 'idle', version: null, progress: 0, error: null, lastCheck: null, checkCount: 0 };

function sendUpdateEvent(data) {
  if (!win || win.isDestroyed()) return;
  try {
    if (!win.webContents.isDestroyed()) win.webContents.send('update:event', data);
  } catch (e) { console.warn('[UPDATE] send failed:', e.message); }
}

function initAutoUpdater() {
  log.info('[UPDATE] init. Version:', app.getVersion(), 'isPackaged:', app.isPackaged);

  autoUpdater.on('checking-for-update', () => {
    updateState.status = 'checking'; updateState.lastCheck = Date.now(); updateState.checkCount++;
    sendUpdateEvent({ type: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    updateState.status = 'available'; updateState.version = info.version;
    sendUpdateEvent({ type: 'available', version: info.version, releaseNotes: info.releaseNotes || '' });
  });
  autoUpdater.on('update-not-available', (info) => {
    updateState.status = 'idle';
    sendUpdateEvent({ type: 'not-available', version: info?.version || app.getVersion() });
  });
  autoUpdater.on('download-progress', (p) => {
    updateState.status = 'downloading'; updateState.progress = p.percent;
    sendUpdateEvent({ type: 'progress', percent: p.percent, bytesPerSecond: p.bytesPerSecond, transferred: p.transferred, total: p.total });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateState.status = 'downloaded'; updateState.version = info.version;
    sendUpdateEvent({ type: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (err) => {
    updateState.status = 'error'; updateState.error = err.message;
    sendUpdateEvent({ type: 'error', message: err.message });
  });

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) return { ok: false, error: 'Dev mode - auto-update disabled' };
    try { const r = await autoUpdater.checkForUpdates(); return { ok: true, version: r?.updateInfo?.version }; }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('update:download', async () => {
    try { await autoUpdater.downloadUpdate(); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('update:install', () => {
    setImmediate(() => { try { autoUpdater.quitAndInstall(false, true); } catch (e) { log.error(e); } });
    return { ok: true };
  });
  ipcMain.handle('update:current-version', () => ({ version: app.getVersion(), name: app.getName(), isPackaged: app.isPackaged }));
  ipcMain.handle('update:state', () => ({ ...updateState }));

  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(e => log.warn('[UPDATE] initial:', e.message)), 5000);
    setInterval(() => autoUpdater.checkForUpdates().catch(e => log.warn('[UPDATE] periodic:', e.message)), 4 * 60 * 60 * 1000);
  }
  log.info('[UPDATE] Ready.');
}

/* --- OKNO GŁÓWNE --- */
function createWindow() {
  win = new BrowserWindow({
    width: windowState.width, height: windowState.height,
    x: windowState.x, y: windowState.y,
    minWidth: 900, minHeight: 600,
    frame: false, show: false,
    backgroundColor: '#f4f6fb',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, spellcheck: true,
    },
  });

  if (windowState.maximized) win.maximize();

  const saveWinState = () => {
    if (!win) return;
    const b = win.getBounds();
    windowState = { ...windowState, ...b, maximized: win.isMaximized() };
    writeJson(WINSTATE_PATH, windowState);
  };
  win.on('resize', () => { layout(); saveWinState(); });
  win.on('move', saveWinState);
  win.on('maximize', () => { layout(); saveWinState(); });
  win.on('unmaximize', () => { layout(); saveWinState(); });
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', layout);
  win.on('closed', () => { win = null; });

  win.loadFile('index.html');
  win.once('ready-to-show', () => { win.show(); win.focus(); });

  win.webContents.on('did-finish-load', () => {
    setTimeout(() => sendUpdateEvent({ type: 'state-sync', state: updateState }), 1500);
  });
}

/* --- OKNO USTAWIEŃ --- */
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show(); settingsWindow.focus(); settingsWindow.moveTop(); return;
  }
  settingsWindow = new BrowserWindow({
    width: 900, height: 700, minWidth: 700, minHeight: 500,
    parent: win || undefined, modal: false,
    frame: false, backgroundColor: '#f4f6fb', titleBarStyle: 'hidden',
    show: false, alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show(); settingsWindow.focus(); settingsWindow.moveTop();
    settingsWindow.setAlwaysOnTop(true, 'floating');
    setTimeout(() => {
      if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.setAlwaysOnTop(false);
    }, 1200);
  });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

/* --- POBIERANIE --- */
function handleDownload(_event, item, webContents) {
  const filename = item.getFilename();
  const totalBytes = item.getTotalBytes();
  const url = item.getURL();
  const savePath = path.join(app.getPath('downloads'), filename);
  item.setSavePath(savePath);

  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const downloadRecord = { id, filename, url, total: totalBytes, received: 0, state: 'progressing', savePath, ts: Date.now(), done: false };
  downloads.push(downloadRecord);
  saveDownloads();

  if (win && !win.isDestroyed()) {
    win.webContents.send('download:event', { type: 'started', id, filename, url, total: totalBytes, savePath });
  }

  item.on('updated', (_e, state) => {
    const rec = downloads.find(d => d.id === id);
    if (rec) { rec.received = item.getReceivedBytes(); rec.state = state; rec.paused = item.isPaused(); }
    if (win && !win.isDestroyed()) {
      win.webContents.send('download:event', {
        type: 'progress', id, filename,
        received: item.getReceivedBytes(), total: item.getTotalBytes(),
        state, paused: item.isPaused(),
        speed: item.getCurrentBytesPerSecond ? item.getCurrentBytesPerSecond() : 0,
      });
    }
  });

  item.once('done', (_e, state) => {
    const rec = downloads.find(d => d.id === id);
    if (rec) { rec.done = true; rec.state = state; }
    saveDownloads();
    if (win && !win.isDestroyed()) {
      win.webContents.send('download:event', { type: 'done', id, filename, state, savePath });
    }
  });
}

function initDownloadHandler() {
  session.defaultSession.on('will-download', handleDownload);
  console.log('[NEXUS] Download handler OK');
}

/* --- KARTY --- */
function createTab(url = settings.homepage, focus = true) {
  if (!win) return null;
  const id = nextTabId++;

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'tab-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      plugins: true,
      spellcheck: true,
      backgroundThrottling: settings.backgroundThrottling !== false,
      partition: undefined,
    },
  });

  const wc = view.webContents;

  wc.on('page-title-updated', (_e, title) => updateTab(id, { title }));
  wc.on('page-favicon-updated', (_e, favs) => { if (favs && favs[0]) updateTab(id, { favicon: favs[0] }); });
  wc.on('did-start-loading', () => updateTab(id, { loading: true }));
  wc.on('did-stop-loading', () => updateTab(id, { loading: false }));
  wc.on('did-navigate', (_e, u) => {
    updateTab(id, { url: u });
    addHistory(u, tabs.get(id)?.title || '');
    if (id === activeTabId) pushNavState();
  });
  wc.on('did-navigate-in-page', (_e, u) => {
    updateTab(id, { url: u });
    if (id === activeTabId) pushNavState();
  });
  wc.on('did-finish-load', () => { if (settings.adblock) wc.insertCSS(COSMETIC_CSS).catch(() => {}); });
  wc.on('render-process-gone', () => updateTab(id, { title: '⚠ Karta uległa awarii', loading: false }));
  wc.on('unresponsive', () => updateTab(id, { title: '⏳ Karta nie odpowiada' }));
  wc.on('responsive', () => updateTab(id, { title: tabs.get(id)?.title || 'Nowa karta' }));

  wc.setWindowOpenHandler(({ url: u }) => { createTab(u); return { action: 'deny' }; });

  wc.on('context-menu', (_e, params) => {
    const items = [];
    if (params.linkURL) {
      items.push(
        { label: 'Otwórz link w nowej karcie', click: () => createTab(params.linkURL) },
        { label: 'Kopiuj adres linku', click: () => clipboard.writeText(params.linkURL) },
        { label: 'Zapisz link jako…', click: () => wc.downloadURL(params.linkURL) },
        { type: 'separator' },
      );
    }
    if (params.srcURL) {
      items.push(
        { label: 'Otwórz obraz w nowej karcie', click: () => createTab(params.srcURL) },
        { label: 'Zapisz obraz jako…', click: () => wc.downloadURL(params.srcURL) },
        { label: 'Kopiuj adres obrazu', click: () => clipboard.writeText(params.srcURL) },
        { type: 'separator' },
      );
    }
    if (params.isEditable) {
      items.push(
        { role: 'undo', label: 'Cofnij' }, { role: 'redo', label: 'Ponów' },
        { type: 'separator' },
        { role: 'cut', label: 'Wytnij' }, { role: 'copy', label: 'Kopiuj' },
        { role: 'paste', label: 'Wklej' }, { role: 'selectAll', label: 'Zaznacz wszystko' },
        { type: 'separator' },
      );
    } else if (params.selectionText) {
      items.push(
        { role: 'copy', label: 'Kopiuj' },
        { label: 'Wyszukaj w Google', click: () => createTab(settings.searchEngine + encodeURIComponent(params.selectionText)) },
        { type: 'separator' },
      );
    }
    items.push(
      { label: 'Wstecz', enabled: wc.canGoBack(), click: () => wc.goBack() },
      { label: 'Dalej', enabled: wc.canGoForward(), click: () => wc.goForward() },
      { label: 'Odśwież', click: () => wc.reload() },
      { type: 'separator' },
      { label: 'Zapisz stronę jako…', click: async () => {
        try {
          const html = await wc.executeJavaScript('document.documentElement.outerHTML', true);
          const r = await dialog.showSaveDialog(win, { defaultPath: 'strona.html' });
          if (!r.canceled) fs.writeFileSync(r.filePath, html);
        } catch (e) {}
      }},
      { label: 'Drukuj…', click: () => wc.print({ silent: false }) },
      { label: 'Pokaż źródło strony', click: () => createTab('view-source:' + wc.getURL()) },
      { type: 'separator' },
      { label: 'Zbadaj element (DevTools)', click: () => wc.openDevTools({ mode: 'detach' }) },
    );
    Menu.buildFromTemplate(items).popup({ window: win });
  });

  const tab = { id, view, url, title: 'Nowa karta', favicon: null, loading: true, muted: false, frozen: false, pinned: false };
  tabs.set(id, tab);

  wc.loadURL(url).catch(() => updateTab(id, { title: '⚠ Nie można załadować strony', loading: false }));

  if (focus) setActiveTab(id);
  else broadcastTabList();
  return id;
}

function closeTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  try { win.contentView.removeChildView(t.view); } catch (e) {}
  try { t.view.webContents.close(); } catch (e) {}
  tabs.delete(id);
  if (activeTabId === id) {
    const ids = [...tabs.keys()];
    if (ids.length) setActiveTab(ids[ids.length - 1]);
    else createTab(settings.homepage);
  }
  broadcastTabList();
}

function setActiveTab(id) {
  const t = tabs.get(id);
  if (!t || !win) return;
  activeTabId = id;
  for (const x of tabs.values()) {
    try { win.contentView.removeChildView(x.view); } catch (e) {}
  }
  win.contentView.addChildView(t.view);
  layout();
  if (!win.isDestroyed()) win.webContents.send('tab:activated', { id });
  broadcastTabList();
  pushNavState();
}

/* ═════════════════════════════════════════════════════════════════════════
   KLUCZOWA POPRAWKA: view NIE zasłania sidebara, a gdy modal otwarty —
   jest ukryty (bounds = 0×0), żeby dialog z renderera był widoczny.
   ═════════════════════════════════════════════════════════════════════════ */
function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const a = tabs.get(activeTabId);
  if (!a) return;

  if (modalOpen) {
    a.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }

  a.view.setBounds({
    x: SIDEBAR_WIDTH,                                          // ← było 0
    y: chromeHeight,
    width: Math.max(0, w - SIDEBAR_WIDTH - hubWidth),          // ← uwzględnia sidebar
    height: Math.max(0, h - chromeHeight),
  });
}

function updateTab(id, patch) {
  const t = tabs.get(id);
  if (!t) return;
  Object.assign(t, patch);
  if (win && !win.isDestroyed()) win.webContents.send('tab:update', { id, ...patch });
}

function broadcastTabList() {
  if (!win || win.isDestroyed()) return;
  const list = [...tabs.values()].map(t => ({
    id: t.id, url: t.url, title: t.title, favicon: t.favicon,
    loading: t.loading, muted: t.muted, frozen: t.frozen, pinned: t.pinned,
  }));
  win.webContents.send('tab:list', { tabs: list, activeId: activeTabId });
}

function pushNavState() {
  const t = tabs.get(activeTabId);
  if (!t || !win || win.isDestroyed()) return;
  const wc = t.view.webContents;
  win.webContents.send('tab:nav', {
    id: t.id, url: t.url,
    canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward(),
    muted: t.muted, zoom: wc.getZoomFactor(),
  });
}

function addHistory(url, title) {
  if (!url || url.startsWith('file://') || url.startsWith('view-source:') || url === 'about:blank') return;
  history.push({ url, title: title || url, ts: Date.now() });
  if (history.length > 5000) history = history.slice(-5000);
  saveHistory();
}

/* --- IPC: ZAKŁADKI --- */
ipcMain.handle('tab:create',    (_e, url) => createTab(url || settings.homepage));
ipcMain.handle('tab:close',     (_e, id)  => closeTab(id));
ipcMain.handle('tab:activate',  (_e, id)  => setActiveTab(id));
ipcMain.handle('tab:navigate',  (_e, url) => { const t = tabs.get(activeTabId); if (t) t.view.webContents.loadURL(url); });
ipcMain.handle('tab:back',      () => { const t = tabs.get(activeTabId); if (t && t.view.webContents.canGoBack()) t.view.webContents.goBack(); });
ipcMain.handle('tab:forward',   () => { const t = tabs.get(activeTabId); if (t && t.view.webContents.canGoForward()) t.view.webContents.goForward(); });
ipcMain.handle('tab:reload',    () => { const t = tabs.get(activeTabId); if (t) t.view.webContents.reload(); });
ipcMain.handle('tab:hard-reload', () => { const t = tabs.get(activeTabId); if (t) t.view.webContents.reloadIgnoringCache(); });
ipcMain.handle('tab:home',      () => { const t = tabs.get(activeTabId); if (t) t.view.webContents.loadURL(settings.homepage); });
ipcMain.handle('tab:mute', () => {
  const t = tabs.get(activeTabId); if (!t) return;
  t.muted = !t.muted; t.view.webContents.setAudioMuted(t.muted);
  broadcastTabList(); pushNavState();
});
ipcMain.handle('tab:duplicate', () => { const t = tabs.get(activeTabId); if (t) createTab(t.url); });
ipcMain.handle('tab:pin', () => { const t = tabs.get(activeTabId); if (!t) return; t.pinned = !t.pinned; broadcastTabList(); });
ipcMain.handle('tab:close-others', () => { for (const id of [...tabs.keys()]) if (id !== activeTabId) closeTab(id); });
ipcMain.handle('tab:close-right', () => {
  const ids = [...tabs.keys()]; const idx = ids.indexOf(activeTabId);
  if (idx < 0) return;
  for (let i = ids.length - 1; i > idx; i--) closeTab(ids[i]);
});

/* --- IPC: OKNO / UI --- */
ipcMain.on('ui:insets', (_e, { top, right }) => {
  if (typeof top === 'number')   chromeHeight = top;
  if (typeof right === 'number') hubWidth = right;
  layout();
});
ipcMain.on('ui:hub', (_e, open) => { hubWidth = open ? 380 : 0; layout(); });
ipcMain.on('ui:cursor', (_e, cursor) => { settings.customCursor = cursor; saveSettings(); });

/* ═══ NOWE: IPC do ukrywania view podczas otwartego modala ═══ */
ipcMain.on('ui:modal-state', (_e, open) => {
  modalOpen = !!open;
  layout();
});

ipcMain.on('win:min',        () => win && win.minimize());
ipcMain.on('win:max',        () => { if (win) win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close',      () => win && win.close());
ipcMain.on('win:fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.on('open:settings',  () => createSettingsWindow());
ipcMain.on('open:userdata',  () => { try { shell.openPath(USER_DIR); } catch (e) {} });
ipcMain.on('open:downloads', () => { try { shell.openPath(app.getPath('downloads')); } catch (e) {} });
ipcMain.on('app:restart',    () => { app.relaunch(); app.exit(0); });
ipcMain.on('ui:devtools',    () => { if (win && !win.isDestroyed()) win.webContents.openDevTools({ mode: 'detach' }); });

/* --- IPC: METRYKI --- */
ipcMain.handle('power:metrics', () => {
  const metrics = app.getAppMetrics();
  let cpu = 0, ramMB = 0, mainRam = 0, rendererRam = 0, gpuRam = 0, utilityRam = 0, procCount = 0;
  for (const m of metrics) {
    const procRam = ((m.memory && m.memory.workingSetSize) || 0) / 1024;
    ramMB += procRam;
    cpu += (m.cpu && m.cpu.percentCPUUsage) || 0;
    procCount++;
    const t = (m.type || '').toLowerCase();
    if (t === 'browser') mainRam += procRam;
    else if (t === 'tab' || t === 'renderer') rendererRam += procRam;
    else if (t === 'gpu') gpuRam += procRam;
    else utilityRam += procRam;
  }
  return {
    cpu: Math.min(100, cpu), ramMB,
    ramMBMain: mainRam, ramMBRenderer: rendererRam,
    ramMBGpu: gpuRam, ramMBUtility: utilityRam,
    processes: procCount,
    totalMem: os.totalmem() / 1024 / 1024, freeMem: os.freemem() / 1024 / 1024,
    cores: os.cpus().length, platform: process.platform, arch: process.arch,
    nodeVersion: process.versions.node, electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    uptime: process.uptime(), adblockCount: blockedCount,
  };
});

ipcMain.handle('power:clean', async () => {
  let freedMB = 0, frozen = 0;
  try {
    const before = await session.defaultSession.getCacheSize();
    await session.defaultSession.clearCache();
    const after = await session.defaultSession.getCacheSize();
    freedMB = Math.max(0, (before - after) / 1024 / 1024);
  } catch (e) {}
  for (const [id, t] of tabs) {
    if (id === activeTabId) continue;
    try { t.view.webContents.setBackgroundThrottling(true); t.frozen = true; frozen++; } catch (e) {}
  }
  broadcastTabList();
  return { freedMB: Math.round(freedMB), frozen };
});

ipcMain.handle('power:apply', (_e, patch) => {
  const keys = ['ramLimit','processLimit','fpsLimit','vsync','adblock','httpsOnly','doNotTrack','backgroundThrottling'];
  for (const k of keys) {
    if (typeof patch[k] === 'number' || typeof patch[k] === 'boolean') settings[k] = patch[k];
  }
  if (typeof patch.backgroundThrottling === 'boolean') {
    for (const t of tabs.values()) {
      try { t.view.webContents.setBackgroundThrottling(settings.backgroundThrottling); } catch (e) {}
    }
  }
  saveSettings();
  broadcastSettings();
  return { ok: true, settings };
});

/* --- IPC: NARZĘDZIA STRONY --- */
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

ipcMain.handle('page:zoom', (_e, dir) => {
  const t = tabs.get(activeTabId); if (!t) return { ok: false };
  const current = t.view.webContents.getZoomFactor();
  let next = current;
  if (dir === 0) next = 1;
  else if (dir > 0) {
    const idx = ZOOM_STEPS.findIndex(z => z > current + 0.001);
    next = idx >= 0 ? ZOOM_STEPS[idx] : ZOOM_STEPS[ZOOM_STEPS.length - 1];
  } else {
    const rev = ZOOM_STEPS.slice().reverse();
    const idx = rev.findIndex(z => z < current - 0.001);
    next = idx >= 0 ? rev[idx] : ZOOM_STEPS[0];
  }
  t.view.webContents.setZoomFactor(next);
  pushNavState();
  return { ok: true, zoom: next };
});

ipcMain.handle('page:find', (_e, q) => { const t = tabs.get(activeTabId); if (!t || !q) return { ok: false }; t.view.webContents.findInPage(q); return { ok: true }; });
ipcMain.handle('page:find-stop', () => { const t = tabs.get(activeTabId); if (t) t.view.webContents.stopFindInPage('clearSelection'); return { ok: true }; });
ipcMain.handle('page:print', async () => { const t = tabs.get(activeTabId); if (!t) return { ok: false }; try { await t.view.webContents.print({ silent: false }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('page:screenshot', async () => {
  const t = tabs.get(activeTabId); if (!t) return { ok: false };
  try {
    const img = await t.view.webContents.capturePage();
    const filePath = path.join(app.getPath('pictures'), `nexus-${Date.now()}.png`);
    fs.writeFileSync(filePath, img.toPNG());
    return { ok: true, path: filePath };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('page:save', async () => {
  const t = tabs.get(activeTabId); if (!t) return { ok: false };
  try {
    const html = await t.view.webContents.executeJavaScript('document.documentElement.outerHTML', true);
    const r = await dialog.showSaveDialog(win, { defaultPath: (t.title || 'strona') + '.html', filters: [{ name: 'HTML', extensions: ['html'] }] });
    if (r.canceled) return { ok: false };
    fs.writeFileSync(r.filePath, html);
    return { ok: true, path: r.filePath };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('page:view-source', () => { const t = tabs.get(activeTabId); if (!t) return { ok: false }; createTab('view-source:' + t.view.webContents.getURL()); return { ok: true }; });
ipcMain.handle('page:devtools', () => { const t = tabs.get(activeTabId); if (!t) return { ok: false }; t.view.webContents.openDevTools({ mode: 'detach' }); return { ok: true }; });
ipcMain.handle('page:clear-data', async () => { try { await session.defaultSession.clearStorageData(); await session.defaultSession.clearCache(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });

ipcMain.handle('page:reading-mode', async () => {
  const t = tabs.get(activeTabId); if (!t) return { ok: false };
  try {
    const result = await t.view.webContents.executeJavaScript(`
      (() => {
        const existing = document.getElementById('nexus-reading-mode');
        if (existing) { existing.remove(); return { active: false }; }
        const style = document.createElement('style');
        style.id = 'nexus-reading-mode';
        style.textContent = \`
          body * { visibility: hidden !important; }
          body, article, main, .article, .post, .content, p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, code, img, figure, figcaption { visibility: visible !important; }
          body { background: #1a1a2e !important; color: #e9e9f2 !important; font-size: 19px !important; line-height: 1.8 !important; max-width: 780px !important; margin: 0 auto !important; padding: 48px 24px !important; font-family: Georgia, serif !important; }
          img { max-width: 100% !important; height: auto !important; }
          a { color: #7c5cff !important; }
        \`;
        document.head.appendChild(style);
        return { active: true };
      })()
    `, true);
    return { ok: true, active: result.active };
  } catch (e) { return { ok: false, error: e.message }; }
});

/* --- IPC: PDF --- */
ipcMain.handle('file:open-pdf', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }, { name: 'Wszystkie pliki', extensions: ['*'] }],
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  const url = 'file://' + r.filePaths[0].replace(/\\/g, '/');
  createTab(url);
  return { ok: true, url };
});

/* --- IPC: USTAWIENIA --- */
function broadcastSettings() {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('settings:changed', settings);
  }
}
ipcMain.handle('settings:get', () => ({ ...settings }));
ipcMain.handle('settings:set', (_e, patch) => { Object.assign(settings, patch || {}); saveSettings(); broadcastSettings(); return { ok: true, settings }; });
ipcMain.handle('settings:reset', () => { settings = { ...DEFAULT_SETTINGS }; saveSettings(); broadcastSettings(); return { ok: true, settings }; });

/* --- IPC: HISTORIA / BOOKMARKS --- */
ipcMain.handle('history:get', (_e, q) => {
  if (!q) return history.slice(-200).reverse();
  const query = q.toLowerCase();
  return history.filter(h => h.url.toLowerCase().includes(query) || (h.title || '').toLowerCase().includes(query)).slice(-200).reverse();
});
ipcMain.handle('history:clear', () => { history = []; saveHistory(); return { ok: true }; });
ipcMain.handle('bm:list', () => bookmarks.slice());
ipcMain.handle('bm:add', (_e, { url, title }) => {
  if (!url) return { ok: false };
  if (bookmarks.some(b => b.url === url)) return { ok: false, error: 'już istnieje' };
  bookmarks.push({ url, title: title || url, ts: Date.now() });
  saveBookmarks();
  return { ok: true };
});
ipcMain.handle('bm:remove', (_e, url) => { bookmarks = bookmarks.filter(b => b.url !== url); saveBookmarks(); return { ok: true }; });
ipcMain.handle('bm:has', (_e, url) => bookmarks.some(b => b.url === url));

/* --- IPC: HASŁA --- */
ipcMain.handle('pw:list', () => vault.map(p => ({ id: p.id, site: p.site, username: p.username, category: p.category, created: p.created, updated: p.updated })));
ipcMain.handle('pw:reveal', (_e, id) => {
  const entry = vault.find(p => p.id === id);
  if (!entry || !entry.password) return { ok: false };
  try { return { ok: true, password: decryptAES(entry.password) }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('pw:add', (_e, { site, username, password, category }) => {
  if (!site || !password) return { ok: false, error: 'brak danych' };
  const id = crypto.randomUUID();
  const enc = encryptAES(password);
  vault.push({ id, site, username: username || '', password: enc, category: category || 'ogólne', created: Date.now(), updated: Date.now() });
  saveVault();
  return { ok: true, id };
});
ipcMain.handle('pw:remove', (_e, id) => { vault = vault.filter(p => p.id !== id); saveVault(); return { ok: true }; });
ipcMain.handle('pw:update', (_e, { id, data }) => {
  const entry = vault.find(p => p.id === id);
  if (!entry) return { ok: false };
  if (data.site) entry.site = data.site;
  if (data.username !== undefined) entry.username = data.username;
  if (data.password) entry.password = encryptAES(data.password);
  if (data.category) entry.category = data.category;
  entry.updated = Date.now();
  saveVault();
  return { ok: true };
});
ipcMain.handle('pw:search', (_e, q) => {
  const query = (q || '').toLowerCase();
  return vault.filter(p => p.site.toLowerCase().includes(query) || (p.username || '').toLowerCase().includes(query))
    .map(p => ({ id: p.id, site: p.site, username: p.username, category: p.category, updated: p.updated }));
});

/* --- IPC: COOKIES --- */
ipcMain.handle('ck:list', async (_e, filter) => {
  try {
    const cookies = await session.defaultSession.cookies.get(filter || {});
    return cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, session: c.session, expirationDate: c.expirationDate }));
  } catch (e) { return []; }
});
ipcMain.handle('ck:remove', async (_e, details) => { try { await session.defaultSession.cookies.remove(details.url, details.name); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('ck:clear-all', async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({});
    for (const c of cookies) {
      const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      const url = (c.secure ? 'https://' : 'http://') + host + c.path;
      await session.defaultSession.cookies.remove(url, c.name);
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

/* --- IPC: DOWNLOADS --- */
ipcMain.handle('dl:list', () => downloads.slice().reverse());
ipcMain.handle('dl:clear', () => { downloads = []; saveDownloads(); return { ok: true }; });
ipcMain.handle('dl:open-folder', () => { shell.openPath(app.getPath('downloads')); return { ok: true }; });
ipcMain.handle('dl:open-file', (_e, filePath) => { try { shell.openPath(filePath); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('dl:reveal-file', (_e, filePath) => { try { shell.showItemInFolder(filePath); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });

/* --- IPC: ROZSZERZENIA --- */
const EXT_DIR = path.join(USER_DIR, 'Extensions');
if (!fs.existsSync(EXT_DIR)) fs.mkdirSync(EXT_DIR, { recursive: true });

async function loadSavedExtensions() {
  try {
    const entries = fs.readdirSync(EXT_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        await session.defaultSession.extensions.loadExtension(path.join(EXT_DIR, e.name), { allowFileAccess: true });
      } catch (err) { console.warn('[NEXUS] Błąd ładowania:', e.name, err.message); }
    }
  } catch (e) { console.warn('[NEXUS] Błąd skanowania rozszerzeń:', e.message); }
}

ipcMain.handle('ext:list', () => {
  try {
    return session.defaultSession.extensions.getAllExtensions().map(e => ({
      id: e.id, name: e.name, version: e.version, path: e.path, enabled: e.enabled,
      description: e.manifest?.description || '', permissions: e.manifest?.permissions || [],
    }));
  } catch (e) { return []; }
});
ipcMain.handle('ext:load', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  try {
    const folder = r.filePaths[0];
    await session.defaultSession.extensions.loadExtension(folder, { allowFileAccess: true });
    const dest = path.join(EXT_DIR, path.basename(folder));
    if (!fs.existsSync(dest)) fs.cpSync(folder, dest, { recursive: true });
    return { ok: true, name: path.basename(folder) };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('ext:remove', async (_e, id) => { try { await session.defaultSession.extensions.removeExtension(id); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('ext:enable', (_e, id) => { try { const ext = session.defaultSession.extensions.getExtension(id); if (ext) ext.enable(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('ext:disable', (_e, id) => { try { const ext = session.defaultSession.extensions.getExtension(id); if (ext) ext.disable(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('ext:open-store', () => { shell.openExternal('https://chromewebstore.google.com/'); return { ok: true }; });
ipcMain.handle('ext:reload', async () => {
  try {
    const exts = session.defaultSession.extensions.getAllExtensions();
    for (const e of exts) await session.defaultSession.extensions.removeExtension(e.id);
    await loadSavedExtensions();
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

/* --- START --- */
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const u = details.url;
    if (settings.adblock) {
      try { const host = new URL(u).hostname; if (isAdHost(host)) { blockedCount++; return cb({ cancel: true }); } } catch (e) {}
    }
    if (settings.httpsOnly && u.startsWith('http://') && !u.startsWith('http://localhost')) {
      return cb({ redirectURL: u.replace('http://', 'https://') });
    }
    cb({});
  });

  if (settings.doNotTrack) {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, cb) => {
      details.requestHeaders['DNT'] = '1';
      cb({ requestHeaders: details.requestHeaders });
    });
  }

  initDownloadHandler();
  await loadSavedExtensions();
  createWindow();
  initAutoUpdater();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
process.on('uncaughtException', err => console.error('[NEXUS] Nieoczekiwany błąd:', err));