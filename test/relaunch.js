// "Restart to update" must reopen the game (Anna, 2.4.4 -> 2.4.5 on Windows: the update installed, the game did not come back).
// Pins the relaunch chain: main.js -> quitAndInstall(isSilent=false, isForceRunAfter=true) -> electron-updater passes --force-run
// -> installer.nsi restarts the game through explorer.exe; nothing in main.js blocks the quit; the installer cannot kill itself.
const fs = require('fs'), path = require('path'), os = require('os'), Module = require('module');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const ROOT = path.join(__dirname, '..');
const mainSrc = fs.readFileSync(path.join(ROOT, 'electron/main.js'), 'utf8');
const nsi = fs.readFileSync(path.join(ROOT, 'electron/installer.nsi'), 'utf8').split('\n').map(l => l.replace(/;.*$/, '')).join('\n');   // code only

// ---- main.js, run against a fake Electron + fake electron-updater, as the installed Windows app ----
const calls = { quitAndInstall: [], exit: [], quit: 0 }, ipc = {}, appEv = {};
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-relaunch-'));
let ev = {}; const fakeUpdater = { on: (k, f) => { ev[k] = f; }, quitAndInstall: (...a) => calls.quitAndInstall.push(a), checkForUpdates: () => Promise.resolve(), downloadUpdate: () => Promise.resolve() };
const win = { hidden: false, isDestroyed: () => false, hide() { this.hidden = true; }, webContents: { send() {} } };
const electron = {
  app: { isPackaged: true, getPath: () => userData, getVersion: () => '2.4.5', requestSingleInstanceLock: () => true, quit: () => { calls.quit++; },
    exit: (c) => calls.exit.push(c), relaunch() {}, on: (k, f) => { (appEv[k] = appEv[k] || []).push(f); }, whenReady: () => new Promise(() => {}), commandLine: { appendSwitch() {} } },
  ipcMain: { on: (k, f) => { ipc[k] = f; }, handle: (k, f) => { ipc[k] = f; } },
  BrowserWindow: function () { return win; }, Menu: { setApplicationMenu() {} }, session: {}, shell: {}, screen: { getAllDisplays: () => [], getPrimaryDisplay: () => ({ id: 1 }) },
};
const realLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'electron') return electron;
  if (req === 'electron-updater') return { autoUpdater: fakeUpdater, NsisUpdater: function () { return fakeUpdater; } };
  return realLoad.apply(this, arguments);
};
const plat = Object.getOwnPropertyDescriptor(process, 'platform');
Object.defineProperty(process, 'platform', { value: 'win32' });
const envSave = { t: process.env.DD_UPDATE_TEST, p: process.env.PORTABLE_EXECUTABLE_DIR }; delete process.env.DD_UPDATE_TEST; delete process.env.PORTABLE_EXECUTABLE_DIR;
const realTimeout = global.setTimeout, timers = []; global.setTimeout = (f, ms) => { timers.push({ f, ms }); return { unref() {} }; };
const realImmediate = global.setImmediate, immediates = []; global.setImmediate = (f) => immediates.push(f);
try {
  require(path.join(ROOT, 'electron/main.js'));
  const r = {}; ipc['dd:can-update']({ set returnValue(v) { r.v = v; } }); ok(r.v === true, 'installed Windows copy gets an updater');
  ok(fakeUpdater.autoRunAppAfterInstall === true, 'autoRunAppAfterInstall stays true (it is what electron-updater turns into --force-run when not silent)');
  ok(fakeUpdater.logger && typeof fakeUpdater.logger.info === 'function', 'updater logs to update.log (no more logger = null)');
  ipc['dd:update-install'](); ok(calls.quitAndInstall.length === 0, 'install ignored until the update is downloaded');
  ev['update-downloaded']({ version: '2.4.6', downloadedFile: 'x' });
  ipc['dd:update-install']();
  immediates.splice(0).forEach(f => f());
  ok(calls.quitAndInstall.length === 1, 'quitAndInstall called once');
  const [isSilent, isForceRunAfter] = calls.quitAndInstall[0];
  ok(isForceRunAfter === true, 'quitAndInstall(..., isForceRunAfter=true): the installer is asked to restart the game');
  ok(isSilent === false, 'quitAndInstall(isSilent=false): the update shows its progress window instead of the game just vanishing');
  // electron-updater (BaseUpdater.quitAndInstall): isForceRunAfter = isSilent ? isForceRunAfter : autoRunAppAfterInstall; NsisUpdater adds --force-run
  const BU = fs.readFileSync(path.join(ROOT, 'electron/node_modules/electron-updater/out/BaseUpdater.js'), 'utf8');
  const NU = fs.readFileSync(path.join(ROOT, 'electron/node_modules/electron-updater/out/NsisUpdater.js'), 'utf8');
  ok(/this\.install\(isSilent, isSilent \? isForceRunAfter : this\.autoRunAppAfterInstall\)/.test(BU), 'electron-updater still derives force-run from autoRunAppAfterInstall when not silent');
  ok(/args\.push\("--force-run"\)/.test(NU) && /const args = \["--updated"\]/.test(NU), 'electron-updater still passes --updated / --force-run to the installer');
  const fallback = timers.find(t => t.ms > 0 && t.ms <= 4000 && /app\.exit/.test(String(t.f)));
  ok(fallback, 'a hard exit fallback is armed so the old copy is gone before the installer gives up waiting (5 s)');
  fallback.f(); ok(calls.exit.includes(0), 'fallback exits with code 0');
  // no quit-blocking handlers in the main process
  const bq = (appEv['before-quit'] || []).concat(appEv['will-quit'] || []);
  bq.forEach(f => { let prevented = false; f({ preventDefault: () => { prevented = true; } }); ok(!prevented, 'before-quit / will-quit never cancel the quit'); });
  ok(!/\.on\(\s*'close'/.test(mainSrc) && !/'before-quit'[^\n]*preventDefault/.test(mainSrc), "no window 'close' or before-quit handler that could hold the quit");
  ok(fs.existsSync(path.join(userData, 'update.log')) && /quitAndInstall\(isSilent=false, isForceRunAfter=true\)/.test(fs.readFileSync(path.join(userData, 'update.log'), 'utf8')), 'update.log records the restart request');
} finally {
  Module._load = realLoad; Object.defineProperty(process, 'platform', plat); global.setTimeout = realTimeout; global.setImmediate = realImmediate;
  if (envSave.t !== undefined) process.env.DD_UPDATE_TEST = envSave.t; if (envSave.p !== undefined) process.env.PORTABLE_EXECUTABLE_DIR = envSave.p;
  fs.rmSync(userData, { recursive: true, force: true });
}

// ---- installer.nsi (our own makensis installer; electron-builder's nsis.runAfterFinish does not apply to it) ----
ok(/\$\{GetOptions\} \$R0 "--force-run" \$R1/.test(nsi) && /\$\{GetOptions\} \$R0 "--updated" \$R1/.test(nsi), 'installer reads --updated and --force-run');
const succ = (nsi.match(/Function \.onInstSuccess([\s\S]*?)FunctionEnd/) || [])[1] || '';
ok(/StrCmp \$Updated 1 0 done/.test(succ) && /StrCmp \$ForceRun 1 0 nolaunch/.test(succ) && /Call LaunchGame/.test(succ), '.onInstSuccess restarts the game after an update with --force-run');
ok(!/IfSilent/.test(succ), 'the restart does not depend on silent mode (the in-game update is no longer silent)');
const launch = (nsi.match(/Function LaunchGame([\s\S]*?)FunctionEnd/) || [])[1] || '';
ok(/explorer\.exe/.test(launch) && !/Exec '"\$INSTDIR/.test(succ), 'restart goes through explorer.exe, like Play now and a shortcut (no blocking direct Exec)');
ok(!/taskkill[^\n]*\/T/.test(nsi), 'no taskkill /T: the installer is a child of the old game and must not kill its own process tree');
ok(/wait_exit:[\s\S]*tasklist[\s\S]*IntCmp \$2 20 kill/.test(nsi), 'installer waits (bounded) for the old game to exit before force-closing it');
const pageBlock = nsi.slice(nsi.indexOf('MUI_PAGE_WELCOME') - 80, nsi.indexOf('MUI_PAGE_FINISH') + 20);
ok((pageBlock.match(/MUI_PAGE_CUSTOMFUNCTION_PRE SkipOnUpdate/g) || []).length === 3 && /Function SkipOnUpdate[\s\S]*?Abort[\s\S]*?FunctionEnd/.test(nsi), 'update skips Welcome, Directory and Finish: only the progress page shows');
ok(/SetAutoClose true/.test(nsi), 'the progress page closes by itself on update');
ok(/MUI_FINISHPAGE_RUN_FUNCTION LaunchGame/.test(nsi), 'fresh install keeps "Play now"');
// electron-builder config: we do not use its NSIS target, but if anyone switches, runAfterFinish must not be false
const pkg = require(path.join(ROOT, 'electron/package.json'));
ok(!pkg.build.nsis || pkg.build.nsis.runAfterFinish !== false, 'electron-builder nsis.runAfterFinish is not false');
// tools/release.sh works inside a git worktree (.git is a file there)
const rel = fs.readFileSync(path.join(ROOT, 'tools/release.sh'), 'utf8');
ok(/\[ -e \.git \]/.test(rel) && !/\[ -d \.git \]/.test(rel), 'release.sh git check works in a worktree');
console.log(`relaunch: ${n} checks OK`);
