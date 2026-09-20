const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexus', {
  /* ZAKŁADKI */
  createTab:   (url) => ipcRenderer.invoke('tab:create', url),
  closeTab:    (id)  => ipcRenderer.invoke('tab:close', id),
  activateTab: (id)  => ipcRenderer.invoke('tab:activate', id),
  navigate:    (url) => ipcRenderer.invoke('tab:navigate', url),
  back:        ()    => ipcRenderer.invoke('tab:back'),
  forward:     ()    => ipcRenderer.invoke('tab:forward'),
  reload:      ()    => ipcRenderer.invoke('tab:reload'),
  hardReload:  ()    => ipcRenderer.invoke('tab:hard-reload'),
  home:        ()    => ipcRenderer.invoke('tab:home'),
  muteTab:     ()    => ipcRenderer.invoke('tab:mute'),
  duplicate:   ()    => ipcRenderer.invoke('tab:duplicate'),
  pinTab:      ()    => ipcRenderer.invoke('tab:pin'),
  closeOthers: ()    => ipcRenderer.invoke('tab:close-others'),
  closeRight:  ()    => ipcRenderer.invoke('tab:close-right'),

  /* OKNO */
  winMin:        () => ipcRenderer.send('win:min'),
  winMax:        () => ipcRenderer.send('win:max'),
  winClose:      () => ipcRenderer.send('win:close'),
  winFullscreen: () => ipcRenderer.send('win:fullscreen'),
  openSettings:  () => ipcRenderer.send('open:settings'),
  openUserData:  () => ipcRenderer.send('open:userdata'),
  openDownloads: () => ipcRenderer.send('open:downloads'),
  restart:       () => ipcRenderer.send('app:restart'),
  setInsets:     (i) => ipcRenderer.send('ui:insets', i),
  setHubOpen:    (o) => ipcRenderer.send('ui:hub', o),
  setCursor:     (c) => ipcRenderer.send('ui:cursor', c),
  checkForUpdates:   () => ipcRenderer.invoke('update:check'),
  downloadUpdate:    () => ipcRenderer.invoke('update:download'),
  installUpdate:     () => ipcRenderer.invoke('update:install'),
  getCurrentVersion: () => ipcRenderer.invoke('update:current-version'),
  onUpdateEvent:     (cb) => ipcRenderer.on('update:event', (_e, d) => cb(d)),

  /* MOC */
  getMetrics:  ()  => ipcRenderer.invoke('power:metrics'),
  cleanMemory: ()  => ipcRenderer.invoke('power:clean'),
  applyPower:  (s) => ipcRenderer.invoke('power:apply', s),

  /* NARZĘDZIA STRONY */
  zoomIn:       ()   => ipcRenderer.invoke('page:zoom', 1),
  zoomOut:      ()   => ipcRenderer.invoke('page:zoom', -1),
  zoomReset:    ()   => ipcRenderer.invoke('page:zoom', 0),
  findInPage:   (q)  => ipcRenderer.invoke('page:find', q),
  stopFind:     ()   => ipcRenderer.invoke('page:find-stop'),
  print:        ()   => ipcRenderer.invoke('page:print'),
  screenshot:   ()   => ipcRenderer.invoke('page:screenshot'),
  savePage:     ()   => ipcRenderer.invoke('page:save'),
  viewSource:   ()   => ipcRenderer.invoke('page:view-source'),
  openDevTools: ()   => ipcRenderer.invoke('page:devtools'),
  clearData:    ()   => ipcRenderer.invoke('page:clear-data'),
  readingMode:  ()   => ipcRenderer.invoke('page:reading-mode'),

  /* PLIKI */
  openPdf: () => ipcRenderer.invoke('file:open-pdf'),

  /* USTAWIENIA */
  getSettings:   ()      => ipcRenderer.invoke('settings:get'),
  setSettings:   (patch) => ipcRenderer.invoke('settings:set', patch),
  resetSettings: ()      => ipcRenderer.invoke('settings:reset'),

  /* HISTORIA */
  getHistory:   (q) => ipcRenderer.invoke('history:get', q),
  clearHistory: ()  => ipcRenderer.invoke('history:clear'),

  /* BOOKMARKS */
  getBookmarks:   ()     => ipcRenderer.invoke('bm:list'),
  addBookmark:    (item) => ipcRenderer.invoke('bm:add', item),
  removeBookmark: (url)  => ipcRenderer.invoke('bm:remove', url),
  isBookmarked:   (url)  => ipcRenderer.invoke('bm:has', url),

  /* HASŁA */
  getPasswords:   ()        => ipcRenderer.invoke('pw:list'),
  addPassword:    (data)    => ipcRenderer.invoke('pw:add', data),
  removePassword: (id)      => ipcRenderer.invoke('pw:remove', id),
  updatePassword: (id,data) => ipcRenderer.invoke('pw:update', { id, data }),
  searchPasswords:(q)       => ipcRenderer.invoke('pw:search', q),
  revealPassword: (id)      => ipcRenderer.invoke('pw:reveal', id),

  /* COOKIES */
  getCookies:      (filter)  => ipcRenderer.invoke('ck:list', filter),
  removeCookie:    (details) => ipcRenderer.invoke('ck:remove', details),
  clearAllCookies: ()        => ipcRenderer.invoke('ck:clear-all'),

  /* DOWNLOADS */
  getDownloads:    ()       => ipcRenderer.invoke('dl:list'),
  clearDownloads:  ()       => ipcRenderer.invoke('dl:clear'),
  openDownloadFolder: ()    => ipcRenderer.invoke('dl:open-folder'),
  openDownloadFile: (path)  => ipcRenderer.invoke('dl:open-file', path),
  revealDownloadFile: (path)=> ipcRenderer.invoke('dl:reveal-file', path),

  /* ROZSZERZENIA */
  extList:      ()   => ipcRenderer.invoke('ext:list'),
  extLoad:      ()   => ipcRenderer.invoke('ext:load'),
  extRemove:    (id) => ipcRenderer.invoke('ext:remove', id),
  extEnable:    (id) => ipcRenderer.invoke('ext:enable', id),
  extDisable:   (id) => ipcRenderer.invoke('ext:disable', id),
  extOpenStore: ()   => ipcRenderer.invoke('ext:open-store'),
  extReload:    ()   => ipcRenderer.invoke('ext:reload'),

  /* EVENTY */
  onTabList:      (cb) => ipcRenderer.on('tab:list', (_e, d) => cb(d)),
  onTabUpdate:    (cb) => ipcRenderer.on('tab:update', (_e, d) => cb(d)),
  onTabActivated: (cb) => ipcRenderer.on('tab:activated', (_e, d) => cb(d)),
  onNavState:     (cb) => ipcRenderer.on('tab:nav', (_e, d) => cb(d)),
  onDownload:     (cb) => ipcRenderer.on('download:event', (_e, d) => cb(d)),
  onSettingsChanged: (cb) => ipcRenderer.on('settings:changed', (_e, d) => cb(d)),
});