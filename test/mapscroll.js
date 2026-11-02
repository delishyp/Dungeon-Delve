// node test/mapscroll.js [WxH]  -> checks map scrolling without scrollbars; shots/map-<W>x<H>*.png
const puppeteer = require('/workspace/tools/node_modules/puppeteer-core'); const path = require('path');
const [W, H] = (process.argv[2] || '3840x1600').split('x').map(Number);
const file = 'file://' + path.resolve(__dirname, '../index.html'); const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setViewport({ width: W, height: H }); await pg.goto(file + '#demo-map-barbarian'); await sleep(1800);
  const st = () => pg.evaluate(() => { const s = document.querySelector('.mapscroll'); return { top: Math.round(s.scrollTop), max: s.scrollHeight - s.clientHeight, sbw: s.offsetWidth - s.clientWidth, cls: s.className, phase: window.__game.state.phase, pos: window.__game.state.pos }; });
  const r = {}; r.open = await st(); await pg.screenshot({ path: `shots/map-${W}x${H}.png` });
  // scrollbars hidden on every scroll container we know of
  r.scrollbarCSS = await pg.evaluate(() => getComputedStyle(document.querySelector('.mapscroll')).scrollbarWidth);
  const box = await pg.evaluate(() => { const q = document.querySelector('.mapscroll').getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await pg.mouse.move(box.x, box.y); await pg.mouse.wheel({ deltaY: -600 }); await sleep(500); r.wheelUp = await st();
  await pg.evaluate(() => { const s = document.querySelector('.mapscroll'); s.scrollTop = (s.scrollHeight - s.clientHeight) / 2; }); await sleep(200); r.beforeDrag = await st();
  // drag starting ON a node (pan down = content up): must scroll and must NOT pick the node
  const node = await pg.evaluate(() => { const n = [...document.querySelectorAll('.mapnode')].find(n => { const q = n.getBoundingClientRect(); return q.top > innerHeight * 0.3 && q.bottom < innerHeight * 0.7; }); const q = n.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await pg.mouse.move(node.x, node.y); await pg.mouse.down(); await pg.mouse.move(node.x, node.y + 250, { steps: 8 }); await pg.mouse.up(); await sleep(400); r.dragOnNode = await st();
  await pg.keyboard.press('PageDown'); await sleep(700); r.pageDown = await st();
  await pg.keyboard.press('ArrowUp'); await sleep(500); r.arrowUp = await st();
  await pg.keyboard.press('Home'); await sleep(900); r.home = await st(); await pg.screenshot({ path: `shots/map-${W}x${H}-top.png` });
  await pg.keyboard.press('End'); await sleep(900); r.end = await st();
  // a plain click on a reachable node still works
  const rn = await pg.evaluate(() => { const n = document.querySelector('.mapnode.reachable'); n.scrollIntoView({ block: 'center' }); const q = n.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await sleep(300); await pg.mouse.click(rn.x, rn.y); await sleep(1500); r.afterClick = await pg.evaluate(() => window.__game.state.phase + ' pos=' + window.__game.state.pos);
  // other panels: any visible scrollbar width?
  r.otherPanels = await pg.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(e => e.className + ':' + (e.offsetWidth - e.clientWidth)));
  console.log(JSON.stringify(r, null, 1), errs); await b.close();
})();
