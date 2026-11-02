// node test/resshots.js [WxH ...]  -> shots/res-<W>x<H>-<view>.png for combat/map/menu/shop/rewards + drag check
const puppeteer = require('puppeteer-core');
const path = require('path');
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['3840x1600', '2560x1080', '1920x1080', '1440x900']).map(s => s.split('x').map(Number));
const file = 'file://' + path.resolve(__dirname, '../index.html');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const errs = [];
  for (const [W, H] of sizes) {
    const shot = async (pg, v) => { await pg.screenshot({ path: `shots/res-${W}x${H}-${v}.png` }); };
    const open = async (h) => { const pg = await b.newPage(); pg.on('pageerror', e => errs.push(`${W}x${H} ${h}: ${e.message}`)); await pg.setViewport({ width: W, height: H }); await pg.goto(file + '#' + h); await sleep(1700); return pg; };
    let pg = await open('');
    await pg.evaluate(() => { localStorage.removeItem('dungeon-delve-settings-v1'); }); await pg.reload(); await sleep(1500);
    const sc = await pg.evaluate(() => window.__game.scale);
    await shot(pg, 'menu'); await pg.close();
    pg = await open('demo-combat-wizard'); await shot(pg, 'combat');
    // hover-enlarge + drag-to-play (non-targeted) + targeted drag onto a monster
    const find = (targeted) => pg.evaluate((t) => { const g = window.__game, s = g.state, p = s.players[0], E = window.Engine;
      const c = p.hand.find(x => E.canPlay(s, p, x) && E.needsTarget(x) === t); if (!c) return null;
      const q = document.querySelector(`.hand .card[data-card="${c.uid}"]`).getBoundingClientRect();
      const m = document.querySelector('.unit.enemy:not(.dead) .sprite').getBoundingClientRect();
      return { uid: c.uid, x: q.left + q.width / 2, y: q.top + q.height * 0.55, mx: m.left + m.width / 2, my: m.top + m.height / 2 }; }, targeted);
    const drag = async (c, tx, ty, name) => {
      await pg.mouse.move(c.x, c.y); await sleep(250);
      await pg.mouse.down(); await pg.mouse.move(c.x, c.y - 60, { steps: 4 }); await pg.mouse.move(tx, ty, { steps: 10 }); await sleep(250);
      if (name) await shot(pg, name);
      await pg.mouse.up(); await sleep(1100);
      return pg.evaluate((u) => !window.__game.state.players[0].hand.some(c => c.uid === u), c.uid);
    };
    const out = { scale: sc };
    let c = await find(true); if (c) out.targetedDrag = await drag(c, c.mx, c.my, 'combat-aim');
    await pg.mouse.move(5, 5); await sleep(400);
    c = await find(false); if (c) out.skillDrag = await drag(c, c.x, H * 0.35);
    await pg.mouse.move(5, 5); await sleep(400);
    c = await find(false) || await find(true); if (c) out.releaseInHandCancels = !(await drag(c, c.x + 30, c.y - 10));
    // hover enlarge shot
    const hv = await pg.evaluate(() => { const c = document.querySelectorAll('.hand .card'); if (!c.length) return null; const q = c[Math.floor(c.length / 2)].getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height * 0.6 }; });
    if (hv) { await pg.mouse.move(hv.x, hv.y); await sleep(500); await shot(pg, 'combat-hover'); }
    await pg.close();
    pg = await open('demo-map-barbarian'); await shot(pg, 'map'); await pg.close();
    pg = await open('demo-shop-fighter'); await shot(pg, 'shop'); await pg.close();
    pg = await open('demo-combat-barbarian');
    await pg.evaluate(() => { const g = window.__game, s = g.state, E = window.Engine, p = s.players[0];
      let n = 0; while (s.phase === 'combat' && n++ < 400) { const c = p.hand.find(x => E.canPlay(s, p, x)); if (c) E.dispatch(s, { type: 'PLAY_CARD', player: 0, card: c.uid, target: E.livingEnemies(s)[0] && E.livingEnemies(s)[0].uid }); else E.dispatch(s, { type: 'END_TURN', player: 0 }); }
      E.takeEvents(s); g.render(); });
    await sleep(600); await shot(pg, 'rewards'); await pg.close();
    console.log(`${W}x${H}`, JSON.stringify(out));
  }
  await b.close(); console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
})();
