// Pose code: debuff and art-week poses in the pose list and preload, big moves hold longer, card names fit their band.
const path = require('path'); const ROOT = path.resolve(__dirname, '..'); let n = 0;
const ok = (c, m) => { n++; if (!c) { console.error('FAIL ' + m); process.exit(1); } };
(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const errs = [];
  for (const [w, h] of [[1366, 768], [1920, 1080], [3840, 1600]]) {
    const pg = await b.newPage(); pg.on('pageerror', e => errs.push(e.message)); await pg.setViewport({ width: w, height: h });
    await pg.goto('file://' + path.join(ROOT, 'index.html') + '#demo-combat-barbarian'); await new Promise(r => setTimeout(r, 1500));
    const r = await pg.evaluate(async () => { const g = window.__game, s = g.state, D = window.GameData, out = {};
      out.poses = g.POSES; out.pre = g.preloadedPoses.filter(x => x).length;
      out.preDebuff = Object.keys(window.ASSETS || {}).length ? null : null;
      const p = s.players[0];
      out.big = g.isBigCard(Object.keys(D.CARDS).find(id => D.CARDS[id].cost >= 2)); out.small = g.isBigCard('greataxe');
      out.bigMove = g.isBigMove({ effects: [{ t: 'attack', n: 16 }] }); out.smallMove = g.isBigMove({ effects: [{ t: 'attack', n: 9 }] });
      out.multi = g.isBigMove({ effects: [{ t: 'attack', n: 4, times: 3 }] });
      g.setPose(p.uid, 'attack'); const t1 = g.ui.poses[p.uid].until - performance.now();
      g.bigPose(p.uid, 'attack'); const t2 = g.ui.poses[p.uid].until - performance.now();
      out.ratio = t2 / t1; out.bigPoseName = g.ui.poses[p.uid].pose;
      g.setPose(p.uid, 'power'); out.powerSrc = document.querySelector('.unit.hero .sprite, .hero .sprite')?.getAttribute('src')?.slice(0, 40);
      await new Promise(r => setTimeout(r, 1300)); out.back = !g.ui.poses[p.uid];
      // every card name on screen fits its band
      const bad = []; document.querySelectorAll('.card .cname').forEach(bx => { const sp = bx.firstElementChild; if (sp && bx.clientWidth && sp.offsetWidth > bx.clientWidth) bad.push(sp.textContent); });
      out.bad = bad; return out; });
    ok(['debuff', 'power', 'windup', 'down', 'victory'].every(x => r.poses.includes(x)), w + ': pose list has the new poses');
    ok(r.pre > 0, w + ': poses preloaded');
    ok(r.big && !r.small && r.bigMove && !r.smallMove && r.multi, w + ': big card / big move rules');
    ok(Math.abs(r.ratio - 1.6) < 0.05 && r.bigPoseName === 'attack', w + ': big move holds 1.6x (' + r.ratio.toFixed(2) + ')');
    ok(r.back, w + ': pose returns to idle');
    ok(!r.bad.length, w + ': card names fit: ' + r.bad.join(', '));
    await pg.close();
  }
  // card-name fit on the long names Tester flagged, rendered in the deck view
  const pg = await b.newPage(); await pg.setViewport({ width: 1366, height: 768 });
  await pg.goto('file://' + path.join(ROOT, 'index.html') + '#demo-combat-barbarian'); await new Promise(r => setTimeout(r, 1500));
  const bad = await pg.evaluate(async () => { const g = window.__game, D = window.GameData, p = g.state.players[0];
    const ids = Object.keys(D.CARDS).filter(id => /Hex of Misfortune|Intimidating Presence/.test(D.CARDS[id].name)).concat(Object.keys(D.CARDS).sort((a, b) => D.CARDS[b].name.length - D.CARDS[a].name.length).slice(0, 12));
    p.hand = ids.slice(0, 10).map((id, i) => ({ id, uid: 'pc' + i })); g.render(); await document.fonts.ready; await new Promise(r => setTimeout(r, 300));
    const out = []; document.querySelectorAll('.card .cname').forEach(bx => { const sp = bx.firstElementChild; if (sp && bx.clientWidth && sp.offsetWidth > bx.clientWidth) out.push(sp.textContent + ' ' + sp.offsetWidth + '>' + bx.clientWidth); });
    return { out, n: document.querySelectorAll('.card .cname').length }; });
  ok(bad.n >= 10 && !bad.out.length, 'long names fit (' + bad.n + ' cards): ' + bad.out.join(', '));
  const src = require('fs').readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  ok(/new RegExp\('\^\(hero\|enemy\)_\.\+_\(' \+ POSES\.join/.test(src), 'preload follows the pose list (debuff included)');
  await b.close(); ok(!errs.length, 'no page errors: ' + errs.join(' | '));
  console.log('posecode ok (' + n + ' checks)');
})().catch(e => { console.error(e); process.exit(1); });
