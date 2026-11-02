// node test/shopshots.js [WxH ...] -> shots/shop-<W>x<H>.png (+ -hover, -relictip) and buy / not-enough-gold checks
const puppeteer = require('puppeteer-core'); const path = require('path');
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['3840x1600', '1920x1080', '1440x900']).map(s => s.split('x').map(Number));
const file = 'file://' + path.resolve(__dirname, '../index.html'); const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  for (const [W, H] of sizes) {
    const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.setViewport({ width: W, height: H }); await pg.goto(file + '#demo-shop-wizard'); await sleep(1800);
    const base = `shots/shop-${W}x${H}`; await pg.screenshot({ path: base + '.png' });
    const info = await pg.evaluate(() => { const r = document.querySelector('.rug').getBoundingClientRect(); const wares = [...document.querySelectorAll('.ware')].map(w => w.getBoundingClientRect());
      const out = wares.filter(q => q.left < r.left || q.right > r.right || q.top < r.top || q.bottom > r.bottom).length;
      const sc = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)).length;
      return { rug: Math.round(r.width) + 'x' + Math.round(r.height), wares: wares.length, outsideRug: out, scrollers: sc, gold: window.__game.state.players[0].gold }; });
    const c = await pg.evaluate(() => { const q = document.querySelector('.w-card:not(.poor):not(.sold) .wcard').getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await pg.mouse.move(c.x, c.y); await sleep(400); await pg.screenshot({ path: base + '-hover.png' });
    const rl = await pg.evaluate(() => { const q = document.querySelector('.w-relic .wicon').getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await pg.mouse.move(rl.x, rl.y); await sleep(500); info.relicTip = await pg.evaluate(() => { const t = document.getElementById('tooltip'); return t && t.style.display !== 'none' ? t.innerText.slice(0, 80) : null; });
    await pg.screenshot({ path: base + '-relictip.png' });
    if (W === 3840) {   // buy a card, then make everything unaffordable and click a ware
      const g0 = await pg.evaluate(() => window.__game.state.players[0].gold);
      await pg.mouse.click(c.x, c.y); await sleep(1200);
      info.buy = await pg.evaluate((g0) => ({ goldBefore: g0, goldAfter: window.__game.state.players[0].gold, sold: document.querySelectorAll('.ware.sold').length, bubble: document.querySelector('.mbubble').textContent }), g0);
      await pg.evaluate(() => { window.__game.state.players[0].gold = 3; window.__game.render(); }); await sleep(300);
      await pg.click('.w-relic.poor'); await sleep(150); info.poor = await pg.evaluate(() => ({ nope: !!document.querySelector('.ware.nope'), red: getComputedStyle(document.querySelector('.ptag.poor')).color, bubble: document.querySelector('.mbubble').textContent, phase: window.__game.state.phase }));
      await sleep(400); await pg.screenshot({ path: base + '-poor.png' });
    }
    console.log(W + 'x' + H, JSON.stringify(info), errs); await pg.close();
  }
  await b.close();
})();
