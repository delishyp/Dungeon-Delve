// Small, safe bridge for the game page (contextIsolation on, no Node in the page).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ddApp', {
  isApp: true,
  quit: () => ipcRenderer.send('dd:quit'),
  setFullscreen: (on) => ipcRenderer.send('dd:fullscreen', !!on),
  onFullscreen: (cb) => ipcRenderer.on('dd:fullscreen', (_e, f) => cb(!!f)),
  version: ipcRenderer.sendSync('dd:version'),
  display: {
    get: () => ipcRenderer.sendSync('dd:display-get'),
    set: (next, confirm) => ipcRenderer.invoke('dd:display-set', next, !!confirm),
    keep: () => ipcRenderer.send('dd:display-keep'),
    revert: () => ipcRenderer.send('dd:display-revert'),
    center: () => ipcRenderer.send('dd:display-center'),
    relaunch: () => ipcRenderer.send('dd:relaunch'),
    onChange: (cb) => ipcRenderer.on('dd:display', (_e, s) => cb(s)),
  },
  update: !ipcRenderer.sendSync('dd:can-update') ? null : {
    check: () => ipcRenderer.invoke('dd:update-check'),
    download: () => ipcRenderer.invoke('dd:update-download'),
    install: () => ipcRenderer.send('dd:update-install'),
    onStatus: (cb) => ipcRenderer.on('dd:update', (_e, s) => cb(s)),
  },
});
