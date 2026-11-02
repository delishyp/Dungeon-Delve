// Dungeon Delve desktop shell (Electron). Loads the single-file game offline.
const { app, BrowserWindow, Menu, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV = !app.isPackaged;   // devtools only when run from source (npm start)
if (!app.requestSingleInstanceLock()) app.quit();
let win = null;

function createWindow() {
  win = new BrowserWindow({
    title: 'Dungeon Delve',
    icon: path.join(__dirname, 'build', 'icon.png'),
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    backgroundColor: '#07050a', show: false, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      devTools: DEV, spellcheck: false,
    },
  });
  win.removeMenu();
  win.on('page-title-updated', (e) => e.preventDefault());   // keep the window title "Dungeon Delve"
  win.once('ready-to-show', () => {
    if (process.argv.includes('--fullscreen')) win.setFullScreen(true); else win.maximize();
    win.show();
  });
  const send = () => win && !win.isDestroyed() && win.webContents.send('dd:fullscreen', win.isFullScreen());
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
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
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
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.logger = null;
  updater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  updater.on('update-not-available', (i) => sendUpdate({ state: 'none', version: i && i.version }));
  updater.on('update-available', (i) => sendUpdate({ state: 'available', version: i.version, notes: typeof i.releaseNotes === 'string' ? i.releaseNotes.replace(/<[^>]+>/g, '').slice(0, 600) : '' }));
  updater.on('download-progress', (p) => sendUpdate({ state: 'downloading', version: updateState.version, percent: Math.round(p.percent || 0), bps: p.bytesPerSecond, transferred: p.transferred, total: p.total }));
  updater.on('update-downloaded', (i) => sendUpdate({ state: 'downloaded', version: i.version, file: i.downloadedFile }));
  updater.on('error', (err) => sendUpdate({ state: 'error', version: updateState.version, message: String((err && err.message) || err).split('\n')[0].slice(0, 200) }));
  return updater;
}
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
  setImmediate(() => u.quitAndInstall(true, true));        // silent install, then relaunch the game
});
ipcMain.on('dd:fullscreen', (_e, on) => { if (win) win.setFullScreen(!!on); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // fully offline: refuse any network request
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'fullscreen'));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
