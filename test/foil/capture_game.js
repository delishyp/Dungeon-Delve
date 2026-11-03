// Stills of the legendary foil + inspect view in the BUILT game (electron/app/index.html, file://, art inlined), in Electron's renderer.
// Run: xvfb-run -a -s "-screen 0 2000x1200x24" electron/node_modules/electron/dist/electron --no-sandbox test/foil/capture_game.js
// Out: test/foil/game_hand.png, game_inspect_left.png, game_inspect_right.png, game_inspect_normal.png
// A test-only legendary (a copy of Frenzied Strike) is injected into the page; data.js has no legendary cards yet.
const { app, BrowserWindow } = require('electron');
const path = require('path'), fs = require('fs');
const W = 1920, H = 1080, dir = __dirname;
app.commandLine.appendSwitch('force-device-scale-factor', '1');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, frame: false, show: true, backgroundColor: '#070508',
    webPreferences: { backgroundThrottling: false, contextIsolation: true } });
  win.setContentSize(W, H);
  const logs = [];
  win.webContents.on('console-message', (e, level, msg) => { if (!/Content-Security-Policy/.test(msg)) logs.push(level + ': ' + msg); });
  await win.loadFile(path.resolve(dir, '../../electron/app/index.html'), { hash: 'demo-combat-barbarian' });
  const js = (s) => win.webContents.executeJavaScript(s);
  for (let i = 0; i < 100; i++) { if (await js(`!!(window.__game && __game.state && __game.state.phase === 'combat' && !__game.ui.busy && !__game.ui.story)`)) break; await sleep(150); }
  await sleep(800);
  await js(`(() => { const g = __game, D = GameData, p = g.state.players[0];
    D.CARDS.test_legendary = Object.assign({}, D.CARDS.frenzied_strike, { name: 'Test Legendary', rarity: 'legendary', art: D.CARDS.frenzied_strike.art || 'frenzied_strike' });
    p.hand.splice(Math.floor(p.hand.length / 2), 0, { id: 'test_legendary', uid: 'tl1' }); g.render(); })()`);
  await sleep(700);
  const rect = (sel) => js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const move = async (x, y, steps = 1, from) => { for (let i = 1; i <= steps; i++) { const f = i / steps;
    win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(from ? from[0] + (x - from[0]) * f : x), y: Math.round(from ? from[1] + (y - from[1]) * f : y) }); await sleep(16); } };
  const rclick = async (x, y) => { win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 }); await sleep(30);
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 }); };
  const esc = async () => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); };
  const shot = async (f) => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(dir, f), img.toPNG()); console.log('wrote', f, img.getSize()); };
  const state = (sel) => js(`(() => { const el = ${sel}; return el ? { ry: el.style.getPropertyValue('--ry'), rx: el.style.getPropertyValue('--rx'), moving: el.classList.contains('foil-moving'), scale: getComputedStyle(el).scale } : null; })()`);

  // 1) hand: hover the legendary and push the mouse toward its upper-left so it tilts
  let r = await rect('.hand .card[data-card="tl1"]');
  await move(r.x + r.w / 2, r.y + r.h / 2, 10, [960, 500]); await sleep(400);
  r = await rect('.hand .card[data-card="tl1"]');
  await move(r.x + r.w * .25, r.y + r.h * .35, 8, [r.x + r.w / 2, r.y + r.h / 2]); await sleep(900);
  console.log('hand', JSON.stringify(await state(`document.querySelector('.hand .card[data-card="tl1"]')`)));
  await shot('game_hand.png');
  // 2) inspect it (right-click), tilt left, then right
  r = await rect('.hand .card[data-card="tl1"]');
  await rclick(Math.round(r.x + r.w / 2), Math.round(r.y + r.h / 2)); await sleep(600);
  await move(140, 470, 20, [r.x + r.w / 2, r.y + r.h / 2]); await sleep(1300);
  console.log('left', JSON.stringify(await state('__game.inspect.clone')));
  await shot('game_inspect_left.png');
  await move(1780, 470, 30, [140, 470]); await sleep(1300);
  console.log('right', JSON.stringify(await state('__game.inspect.clone')));
  await shot('game_inspect_right.png');
  await esc(); await sleep(600);
  console.log('closed', await js(`!__game.inspect.src && document.querySelector('.hand .card[data-card="tl1"]').style.visibility === ''`));
  // 3) a normal card
  const nid = await js(`[...document.querySelectorAll('.hand .card')].find(c => c.dataset.rar !== 'legendary' && c.dataset.card !== 'tl1').dataset.card`);
  r = await rect(`.hand .card[data-card="${nid}"]`);
  await move(r.x + r.w / 2, r.y + r.h * .8, 6, [1780, 470]); await sleep(300);
  r = await rect(`.hand .card[data-card="${nid}"]`);
  await rclick(Math.round(r.x + r.w / 2), Math.round(r.y + r.h / 2)); await sleep(600);
  await move(1500, 380, 20, [r.x + r.w / 2, r.y + r.h / 2]); await sleep(1300);
  console.log('normal', JSON.stringify(await state('__game.inspect.clone')));
  await shot('game_inspect_normal.png');
  await esc(); await sleep(500);
  console.log('hand unchanged, still combat:', await js(`__game.state.phase + ' ' + __game.state.players[0].hand.length`));
  console.log('console:', logs.length ? logs : 'nothing');
  app.exit(0);
});
