// Dungeon Delve desktop shell (Electron). Loads the single-file game offline.
const { app, BrowserWindow, Menu, ipcMain, session, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV = !app.isPackaged;   // devtools only when run from source (npm start)
// Update log: userData/update.log (%APPDATA%\Dungeon Delve\update.log), local only. The installer appends to the same file,
// so one file shows the whole update: download, quit, installer, relaunch. Kept small (rotated at 256 KB).
const UPDATE_LOG = path.join(app.getPath('userData'), 'update.log');
function ulog(level, msg) {
  try {
    fs.mkdirSync(path.dirname(UPDATE_LOG), { recursive: true });
    try { if (fs.statSync(UPDATE_LOG).size > 262144) fs.renameSync(UPDATE_LOG, UPDATE_LOG + '.old'); } catch (_) {}
    fs.appendFileSync(UPDATE_LOG, `${new Date().toISOString()} [game ${app.getVersion()} pid ${process.pid}] ${level}: ${String(msg).split('\n')[0].slice(0, 300)}\r\n`);
  } catch (_) {}
}
if (!app.requestSingleInstanceLock()) { ulog('info', 'another copy holds the single-instance lock: this copy exits'); app.quit(); }
let quittingForUpdate = false;   // set when the player chose "Restart to update": nothing may keep this process alive
let win = null;

// ---------- display settings (window mode, size, monitor, vsync), stored in userData/display.json ----------
// mode: 'windowed' | 'borderless' (frameless window covering the monitor) | 'fullscreen' (Electron fullscreen)
// size: null = maximized, or [w, h] in physical pixels (converted with the monitor's scale factor)
const DISPLAY_FILE = path.join(app.getPath('userData'), 'display.json');
const DISP_DEFAULT = { mode: 'windowed', size: null, displayId: null, vsync: true };
function loadDisp() {
  let d = {}; try { d = JSON.parse(fs.readFileSync(DISPLAY_FILE, 'utf8')); } catch (_) {}
  d = Object.assign({}, DISP_DEFAULT, d);
  if (!['windowed', 'borderless', 'fullscreen'].includes(d.mode)) d.mode = 'windowed';
  if (!(Array.isArray(d.size) && d.size.length === 2 && d.size.every(n => Number.isFinite(n) && n >= 640 && n <= 16384))) d.size = null;
  if (d.mode === 'windowed' && process.argv.includes('--fullscreen')) d.mode = 'fullscreen';
  d.vsync = d.vsync !== false;
  return d;
}
let disp = loadDisp();
const bootVsync = disp.vsync;
if (!disp.vsync) { app.commandLine.appendSwitch('disable-gpu-vsync'); app.commandLine.appendSwitch('disable-frame-rate-limit'); }
function saveDisp() { try { fs.writeFileSync(DISPLAY_FILE, JSON.stringify(disp)); } catch (_) {} }
function targetDisplay() {   // the chosen monitor, or the primary one if it is gone
  return screen.getAllDisplays().find(x => x.id === disp.displayId) || screen.getPrimaryDisplay();
}
function windowedBounds(d) {
  const wa = d.workArea, sf = d.scaleFactor || 1;
  let w = 1440, h = 900;
  if (disp.size) { w = Math.round(disp.size[0] / sf); h = Math.round(disp.size[1] / sf); }
  w = Math.min(w, wa.width); h = Math.min(h, wa.height);
  return { x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2), width: w, height: h };
}
function displayState() {
  const all = screen.getAllDisplays(), prim = screen.getPrimaryDisplay().id;
  const onId = win && !win.isDestroyed() ? screen.getDisplayMatching(win.getBounds()).id : null;
  return {
    cfg: Object.assign({}, disp), bootVsync, onDisplay: onId, pending: pending ? Math.max(0, pending.until - Date.now()) : 0,
    displays: all.map((x, i) => ({ id: x.id, n: i + 1, w: Math.round(x.size.width * x.scaleFactor), h: Math.round(x.size.height * x.scaleFactor), primary: x.id === prim, scale: x.scaleFactor,
      label: `Display ${i + 1} - ${Math.round(x.size.width * x.scaleFactor)}x${Math.round(x.size.height * x.scaleFactor)}${x.id === prim ? ' (primary)' : ''}` })),
  };
}
function sendDisplay() { if (win && !win.isDestroyed()) win.webContents.send('dd:display', displayState()); }
function applyWindowed() {
  if (!win || win.isDestroyed()) return;
  const d = targetDisplay();
  if (win.isMaximized()) win.unmaximize();
  win.setBounds(windowedBounds(d));
  if (!disp.size) win.maximize();
  sendDisplay();
}
function applyInPlace() {   // same frame type: change mode / size / monitor on the live window
  const d = targetDisplay();
  if (disp.mode === 'borderless') { win.setBounds(d.bounds); sendDisplay(); return; }
  if (disp.mode === 'fullscreen') {
    if (win.isFullScreen() && screen.getDisplayMatching(win.getBounds()).id === d.id) return sendDisplay();
    const go = () => { win.setBounds(windowedBounds(d)); win.setFullScreen(true); setTimeout(sendDisplay, 400); };
    if (win.isFullScreen()) { win.once('leave-full-screen', () => setTimeout(go, 80)); win.setFullScreen(false); } else go();
    return;
  }
  if (win.isFullScreen()) { win.once('leave-full-screen', () => setTimeout(applyWindowed, 80)); win.setFullScreen(false); } else applyWindowed();
}
function applyDisplay(next) {
  const wasFrameless = disp.mode === 'borderless';
  disp = Object.assign({}, disp, next);
  if (!win || win.isDestroyed()) return;
  if ((disp.mode === 'borderless') !== wasFrameless) {   // Electron cannot add/remove a window frame live: swap in a new window
    const old = win; old.removeAllListeners('closed');
    createWindow({ resume: true });
    win.once('ready-to-show', () => { if (!old.isDestroyed()) old.destroy(); });
  } else applyInPlace();
}
let pending = null;   // { prev, until, timer }: a mode/size change waiting for "Keep"
function clearPending() { if (pending) { clearTimeout(pending.timer); pending = null; } }

function createWindow(opts = {}) {
  const frameless = disp.mode === 'borderless', d = targetDisplay();
  const b = frameless ? d.bounds : windowedBounds(d);
  win = new BrowserWindow({
    title: 'Dungeon Delve',
    icon: path.join(__dirname, 'build', 'icon.png'),
    x: b.x, y: b.y, width: b.width, height: b.height, minWidth: 1024, minHeight: 640,
    frame: !frameless, thickFrame: !frameless, resizable: true,
    backgroundColor: '#07050a', show: false, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      devTools: DEV, spellcheck: false,
    },
  });
  win.removeMenu();
  win.on('page-title-updated', (e) => e.preventDefault());   // keep the window title "Dungeon Delve"
  const me = win;
  win.once('ready-to-show', () => {
    if (disp.mode === 'fullscreen') me.setFullScreen(true);
    else if (disp.mode === 'borderless') me.setBounds(targetDisplay().bounds);
    else if (!disp.size) me.maximize();
    me.show(); me.focus();
  });
  const send = () => { if (win && !win.isDestroyed()) { win.webContents.send('dd:fullscreen', win.isFullScreen() || disp.mode === 'borderless'); sendDisplay(); } };
  win.on('enter-full-screen', send); win.on('leave-full-screen', send);
  win.webContents.on('did-finish-load', send);
  // stay inside the game: no navigation, no popups (external links open in the real browser)
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (!DEV) win.webContents.on('before-input-event', (e, input) => {   // no devtools / reload shortcuts in release
    const k = input.key.toLowerCase();
    if ((input.control || input.meta) && input.shift && (k === 'i' || k === 'j' || k === 'c')) e.preventDefault();
    if (k === 'f12' || ((input.control || input.meta) && k === 'r') || k === 'f5') e.preventDefault();
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'), opts.resume ? { query: { resume: '1' } } : undefined);
}

ipcMain.on('dd:quit', () => app.quit());
ipcMain.on('dd:version', (e) => { e.returnValue = app.getVersion(); });

// ---------- auto-update (electron-updater, GitHub Releases of delishyp/Dungeon-Delve; public, no token) ----------
// Feed comes from resources/app-update.yml (written by electron-builder from the "publish" config).
// DD_UPDATE_TEST=<url> (only when running unpackaged) points the updater at a local mock server for tests.
let updater = null, updateState = { state: 'idle' };
function sendUpdate(u) { updateState = u; if (win && !win.isDestroyed()) win.webContents.send('dd:update', u); }
function getUpdater() {
  if (updater) return updater;
  const testUrl = !app.isPackaged && process.env.DD_UPDATE_TEST;
  if (!app.isPackaged && !testUrl) return null;            // running from source: no updates
  if (!testUrl && (process.platform !== 'win32' || process.env.PORTABLE_EXECUTABLE_DIR)) return null;   // installed Windows copy only (not the portable exe)
  const { NsisUpdater, autoUpdater } = require('electron-updater');
  if (testUrl) {
    const cfg = path.join(app.getPath('temp'), 'dd-dev-app-update.yml');
    fs.writeFileSync(cfg, `provider: generic\nurl: ${testUrl}\nupdaterCacheDirName: dungeon-delve-updater-test\n`);
    updater = new NsisUpdater();                            // Windows flow, exercised on any OS in tests
    updater.updateConfigPath = cfg; updater.forceDevUpdateConfig = true;
  } else updater = autoUpdater;
  updater.autoDownload = false;            // the player decides in the in-game prompt
  // Our installer is solid-LZMA and we don't keep the old installer in the updater cache, so a differential download can never
  // reuse anything: it only costs two blockmap round-trips (seconds on GitHub) before falling back to the full download.
  updater.disableDifferentialDownload = !(testUrl && process.env.DD_UPDATE_DIFF === '1');
  updater.disableWebInstaller = true;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.autoRunAppAfterInstall = true;   // quitAndInstall(false, ...) passes --force-run from this: the installer restarts the game
  updater.logger = { info: (m) => ulog('info', m), warn: (m) => ulog('warn', m), error: (m) => ulog('error', m), debug: () => {} };
  updater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  updater.on('update-not-available', (i) => sendUpdate({ state: 'none', version: i && i.version }));
  updater.on('update-available', (i) => sendUpdate({ state: 'available', version: i.version, notes: typeof i.releaseNotes === 'string' ? i.releaseNotes.replace(/<[^>]+>/g, '').slice(0, 600) : '' }));
  updater.on('download-progress', (p) => sendUpdate({ state: 'downloading', version: updateState.version, percent: Math.round(p.percent || 0), bps: p.bytesPerSecond, transferred: p.transferred, total: p.total }));
  updater.on('update-downloaded', (i) => { if (!testUrl) updater.autoInstallOnAppQuit = true; sendUpdate({ state: 'downloaded', version: i.version, file: i.downloadedFile }); });
  updater.on('error', (err) => sendUpdate({ state: 'error', version: updateState.version, message: String((err && err.message) || err).split('\n')[0].slice(0, 200) }));
  return updater;
}
ipcMain.on('dd:update-status', (e) => { e.returnValue = updateState; });   // the page asks for the cached result as soon as it loads
ipcMain.on('dd:can-update', (e) => { try { e.returnValue = !!getUpdater(); } catch (_) { e.returnValue = false; } });
ipcMain.handle('dd:update-check', async () => {
  const u = getUpdater(); if (!u) return { state: 'disabled' };
  try { await u.checkForUpdates(); } catch (e) { sendUpdate({ state: 'error', message: String(e.message || e).split('\n')[0].slice(0, 200) }); }
  return updateState;
});
ipcMain.handle('dd:update-download', async () => {
  const u = getUpdater(); if (!u) return { state: 'disabled' };
  try { await u.downloadUpdate(); } catch (e) { sendUpdate({ state: 'error', version: updateState.version, message: String(e.message || e).split('\n')[0].slice(0, 200) }); }
  return updateState;
});
ipcMain.on('dd:update-install', () => {
  const u = getUpdater(); if (!u || updateState.state !== 'downloaded') return;
  if (process.env.DD_UPDATE_TEST) { sendUpdate({ state: 'install-requested', version: updateState.version }); return; }   // tests stop here
  // Not silent: the installer shows only its progress page (it skips its other pages for --updated), so the player can see the
  // update happening instead of a game that vanished; it closes by itself and restarts the game (--force-run, see installer.nsi).
  // Hide the window at once so closing feels instant, then hand over to the installer.
  quittingForUpdate = true;
  ulog('info', `restart to update to ${updateState.version}: quitAndInstall(isSilent=false, isForceRunAfter=true)`);
  if (win && !win.isDestroyed()) win.hide();
  setImmediate(() => u.quitAndInstall(false, true));
  // the installer waits for this process to be gone; if a normal quit ever stalls, leave anyway rather than be force-killed
  setTimeout(() => { ulog('warn', 'quit for update still pending after 3 s: app.exit(0)'); app.exit(0); }, 3000);
});
// F11 / the old fullscreen toggle: flips between windowed and the last full-screen style, and is remembered
let lastFull = 'fullscreen';
ipcMain.on('dd:fullscreen', (_e, on) => {
  if (!win) return; clearPending();
  if (disp.mode !== 'windowed') lastFull = disp.mode;
  applyDisplay({ mode: on ? lastFull : 'windowed' }); saveDisp();
});
ipcMain.on('dd:display-get', (e) => { e.returnValue = displayState(); });
ipcMain.handle('dd:display-set', (_e, next, needConfirm) => {
  const ok = {};
  if (next.mode && ['windowed', 'borderless', 'fullscreen'].includes(next.mode)) ok.mode = next.mode;
  if ('size' in next) ok.size = Array.isArray(next.size) && next.size.length === 2 ? next.size.map(n => Math.max(640, Math.min(16384, Math.round(+n) || 640))) : null;
  if ('displayId' in next) ok.displayId = screen.getAllDisplays().some(x => x.id === next.displayId) ? next.displayId : null;
  if ('vsync' in next) ok.vsync = !!next.vsync;
  if (needConfirm) {
    const prev = pending ? pending.prev : Object.assign({}, disp);
    clearPending();
    pending = { prev, until: Date.now() + 10000, timer: setTimeout(() => { const p = pending; pending = null; if (p) { applyDisplay(p.prev); saveDisp(); sendDisplay(); } }, 10500) };
  }
  if (ok.mode && ok.mode !== 'windowed') lastFull = ok.mode;
  applyDisplay(ok);
  if (!needConfirm) saveDisp();
  setTimeout(sendDisplay, 50);
  return displayState();
});
ipcMain.on('dd:display-keep', () => { clearPending(); saveDisp(); sendDisplay(); });
ipcMain.on('dd:display-revert', () => { const p = pending; clearPending(); if (p) { applyDisplay(p.prev); saveDisp(); } sendDisplay(); });
ipcMain.on('dd:display-center', () => { if (win && disp.mode === 'windowed' && !win.isMaximized() && !win.isFullScreen()) win.center(); });
ipcMain.on('dd:relaunch', () => { app.relaunch(); app.exit(0); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // fully offline: refuse any network request
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'fullscreen'));
  createWindow();
  // check for updates right away, in parallel with the window loading; the result is cached in updateState for the page
  try { const u = getUpdater(); if (u) u.checkForUpdates().catch((e) => sendUpdate({ state: 'error', message: String(e.message || e).split('\n')[0].slice(0, 200) })); } catch (_) {}
  // a monitor was unplugged / added: keep the window on a screen that exists
  const fix = () => { if (!screen.getAllDisplays().some(x => x.id === disp.displayId)) { if (win && !win.isDestroyed() && disp.mode !== 'windowed') applyInPlace(); } sendDisplay(); };
  screen.on('display-removed', fix); screen.on('display-added', () => sendDisplay());
});
app.on('window-all-closed', () => app.quit());
// never preventDefault here or in a window 'close' handler: the update installer waits for this process to exit
app.on('before-quit', () => { if (pending) { disp = Object.assign({}, pending.prev); clearPending(); saveDisp(); } });
app.on('will-quit', () => { if (quittingForUpdate) ulog('info', 'old game exiting for the update'); });
