// node test/cardshots.js  -> desktop screenshots of the new cards (hand fan, hover, drag, rewards, deck, shop) + contact sheet
const puppeteer = require('/workspace/tools/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs');
const W = 1440, H = 860, url = (h) => 'file://' + path.resolve(__dirname, '../index.html') + '#' + h;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const out = []; const errs = [];
  const open = async (h) => { const pg = await browser.newPage(); pg.on('pageerror', e => errs.push(h + ': ' + e.message)); await pg.setViewport({ width: W, height: H }); await pg.goto(url(h)); await sleep(1600); return pg; };
  const shot = async (pg, name) => { const f = `shots/cards-${name}.png`; await pg.screenshot({ path: f }); out.push(f); };
  // 1 hand fan (with a couple of upgraded cards), wizard
  let pg = await open('demo-combat-wizard');
  await pg.evaluate(() => { const g = window.__game, p = g.state.players[0]; p.hand.slice(0, 2).forEach(c => c.up = true); p.energy = 3; g.render(); });
  await sleep(700); await shot(pg, 'hand');
  // 2 hover enlarge
  const box = await pg.evaluate(() => { const c = document.querySelectorAll('.hand .card'); const r = c[Math.floor(c.length / 2)].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
  await pg.mouse.move(box.x, box.y); await sleep(500); await shot(pg, 'hover');
  // 3 mid-drag
  await pg.mouse.down(); await pg.mouse.move(box.x + 20, box.y - 120, { steps: 6 }); await pg.mouse.move(W * 0.72, H * 0.42, { steps: 8 }); await sleep(300); await shot(pg, 'drag');
  await pg.mouse.up(); await sleep(900); await shot(pg, 'afterplay');
  // 4 deck view
  await pg.evaluate(() => { const g = window.__game; g.ui.pile = 'deck'; g.render(); }); await sleep(500); await shot(pg, 'deck');
  // 5 rewards: win the fight in-page
  await pg.evaluate(() => { const g = window.__game, s = g.state, E = window.Engine, p = s.players[0]; g.ui.pile = null;
    let n = 0; while (s.phase === 'combat' && n++ < 400) { const c = p.hand.find(x => E.canPlay(s, p, x)); if (c) E.dispatch(s, { type: 'PLAY_CARD', player: 0, card: c.uid, target: E.livingEnemies(s)[0] && E.livingEnemies(s)[0].uid }); else E.dispatch(s, { type: 'END_TURN', player: 0 }); }
    E.takeEvents(s); g.render(); });
  await sleep(700); await shot(pg, 'rewards'); await pg.close();
  // 6 barbarian + fighter hands, shop
  for (const h of ['barbarian', 'fighter']) { pg = await open('demo-combat-' + h); await shot(pg, 'hand-' + h); await pg.close(); }
  pg = await open('demo-shop-fighter'); await shot(pg, 'shop'); await pg.close();
  pg = await open('demo-boss-wizard'); await shot(pg, 'boss'); await pg.close();
  pg = await open('demo-map-barbarian'); await shot(pg, 'map'); await pg.close();
  // contact sheet: hand + rewards + shop (+hover, deck)
  const sheet = ['hand', 'hover', 'rewards', 'shop', 'deck', 'hand-barbarian'].map(n => 'cards-' + n + '.png');
  const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;font:16px Arial;color:#ddd">` +
    sheet.map(f => `<figure style="margin:0"><img style="width:100%;display:block" src="file://${path.resolve(__dirname, '../shots', f)}"><figcaption>${f.replace(/cards-|\.png/g, '')}</figcaption></figure>`).join('') + '</body>';
  fs.writeFileSync('/tmp/sheet.html', html);
  pg = await browser.newPage(); await pg.setViewport({ width: 1600, height: 1400 }); await pg.goto('file:///tmp/sheet.html'); await sleep(800);
  await pg.screenshot({ path: 'shots/contact-cards-desktop.png', fullPage: true }); out.push('shots/contact-cards-desktop.png');
  await browser.close();
  console.log(out.join('\n')); console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
})();
