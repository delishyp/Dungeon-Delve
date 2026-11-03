// Mobile / PWA test with headless Chrome. Needs: python3 -m http.server 8123 in dist/, puppeteer-core (npm install at the repo root).
// Usage: node test/mobile.js
const puppeteer = require('puppeteer-core');
const BASE = 'http://localhost:8123/index.html';
const SHOTS = __dirname + '/../shots/';
const iPhone = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function newPage(browser, vp, ua) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|sw\.js/.test(m.text())) errors.push(m.text()); });
  if (ua) await page.setUserAgent(ua);
  await page.setViewport(vp);
  page.errors = errors;
  return page;
}
async function inViewport(page, sel) {
  return page.$$eval(sel, (els) => els.map(e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height, w: r.width }; }));
}
async function layoutChecks(page, label) {
  const vp = page.viewport();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(over <= 1, `${label}: no horizontal overflow (${over}px)`);
  for (const sel of ['.endturn', '.energy', '.pile', '.unit:not(.dead)', '.hand .card']) {
    const rs = await inViewport(page, sel);
    const bad = rs.filter(r => r.l < -2 || r.t < -2 || r.r > vp.width + 2 || r.b > vp.height + 2);
    check(rs.length > 0 && bad.length === 0, `${label}: ${sel} visible inside screen (${rs.length} found, ${bad.length} outside)`);
  }
  const et = (await inViewport(page, '.endturn'))[0];
  check(et && et.h >= 44 && et.w >= 70, `${label}: End Turn big enough to tap (${et && Math.round(et.w)}x${et && Math.round(et.h)})`);
  const card = (await inViewport(page, '.hand .card'))[0];
  check(card && card.w >= 60, `${label}: hand cards tappable size (${card && Math.round(card.w)}x${card && Math.round(card.h)})`);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });

  // 1. In-page selftest (3 runs per class + save/continue) on iPhone with touch
  console.log('iPhone #selftest (touch mode):');
  {
    const page = await newPage(browser, iPhone, UA);
    await page.goto(BASE + '#selftest');
    const touch = await page.evaluate(() => document.body.classList.contains('touch'));
    check(touch, 'touch mode detected on emulated iPhone');
    await page.waitForFunction(() => document.body.dataset.selftest, { timeout: 300000 });
    const res = await page.evaluate(() => document.body.dataset.selftest);
    console.log('   ', res);
    check(res.startsWith('SELFTEST PASS'), 'selftest passes for every class on iPhone');
    check(page.errors.length === 0, 'no JS errors (' + page.errors.join('; ') + ')');
    await page.close();
  }

  // 2. Real taps + real touch drags: class select, story, map scroll, drag-to-play, cancel, tap-select, End Turn guard, save + continue
  console.log('iPhone real-touch flow:');
  {
    const page = await newPage(browser, iPhone, UA);
    await page.goto(BASE + '#fast');
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.tap('[data-act="classes"]'); await sleep(100);
    await page.tap('[data-act="herosel"][data-cls="wizard"]'); await sleep(150); await page.tap('[data-act="pick"][data-cls="wizard"]'); await sleep(150);
    check(!!(await page.$('.storyover')), 'class intro narration appears after picking a class');
    let taps = 0;
    while (await page.$('.storyover') && taps++ < 20) { await page.touchscreen.tap(195, 420); await sleep(80); }
    check(!(await page.$('.storyover')) && taps > 1, `narration tap-through works (${taps} taps)`);
    check(await page.evaluate(() => __game.state.phase === 'map'), 'after the intro → map');
    const ms = await page.$eval('.mapscroll', el => ({ sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop }));
    check(ms.sh > ms.ch + 100, `map is taller than the phone screen and scrolls (${ms.sh} vs ${ms.ch})`);
    await page.$eval('.mapscroll', el => el.scrollTop = 0); await sleep(50);
    // swipe the map with a real touch drag
    await page.touchscreen.touchStart(195, 650); for (let i = 1; i <= 10; i++) { await page.touchscreen.touchMove(195, 650 - i * 40); await sleep(16); } await page.touchscreen.touchEnd(); await sleep(500);
    const st = await page.$eval('.mapscroll', el => el.scrollTop);
    check(st > 20, `map scrolls with a finger swipe (scrollTop ${Math.round(st)})`);
    await page.$eval('.mapnode.reachable', el => el.scrollIntoView({ block: 'center' })); await sleep(100);
    await page.tap('.mapnode.reachable'); await sleep(250);
    while (await page.$('.storyover')) { await page.touchscreen.tap(195, 420); await sleep(60); }
    check(await page.evaluate(() => __game.state.phase === 'combat'), 'tapped a room → combat');
    await sleep(300);
    await layoutChecks(page, '390x844 combat');

    const center = async (el) => { const b = await el.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const drag = async (from, to) => {
      await page.touchscreen.touchStart(from.x, from.y);
      for (let i = 1; i <= 10; i++) { await page.touchscreen.touchMove(from.x + (to.x - from.x) * i / 10, from.y + (to.y - from.y) * i / 10); await sleep(16); }
      await sleep(60);
      const mid = await page.evaluate(() => ({ arrow: document.getElementById('arrow').classList.contains('on'), locked: document.getElementById('arrow').classList.contains('locked'), hot: !!document.querySelector('.unit.drop-target'), zone: !!document.querySelector('.field.pz-active') }));
      await page.touchscreen.touchEnd(); await sleep(350);
      await page.waitForFunction(() => !__game.ui.busy, { timeout: 10000 }).catch(() => {});
      return mid;
    };
    const handInfo = () => page.evaluate(() => { const p = __game.state.players[0]; return { uids: p.hand.map(c => c.uid), energy: p.energy, phase: __game.state.phase }; });
    const cardEl = async (targeted) => {
      const ok = await page.evaluate((t) => { const s = __game.state, p = s.players[0]; const D = window.GameData, E = window.Engine;
        const c = p.hand.find(c => E.canPlay(s, p, c) && !!E.needsTarget(c) === t); return c ? c.uid : null; }, targeted);
      return ok ? { uid: ok, el: await page.$(`.hand .card[data-card="${ok}"]`) } : null;
    };
    // a) cancel: drag a card up a little and back down into the hand
    {
      const c = (await cardEl(true)) || (await cardEl(false));
      const h0 = await handInfo(); const from = await center(c.el);
      await page.touchscreen.touchStart(from.x, from.y);
      for (let i = 1; i <= 6; i++) { await page.touchscreen.touchMove(from.x + i * 4, from.y - i * 30); await sleep(16); }
      for (let i = 1; i <= 6; i++) { await page.touchscreen.touchMove(from.x + 24, from.y - 180 + i * 30); await sleep(16); }
      await page.touchscreen.touchEnd(); await sleep(300);
      const h1 = await handInfo();
      check(h1.uids.includes(c.uid) && h1.energy === h0.energy, 'touch drag released back in the hand cancels (card kept, no energy spent)');
      check(await page.evaluate(() => !__game.ui.selected && !__game.ui.drag), 'nothing left selected after a cancelled drag');
    }
    // b) targeted: drag onto a monster
    {
      const c = await cardEl(true);
      if (c) {
        const foe = await page.$('.unit.enemy:not(.dead) .sprite-wrap');
        const mid = await drag(await center(c.el), await center(foe));
        const h1 = await handInfo();
        check(mid.hot && mid.arrow && mid.locked, 'dragging an attack shows the arrow, which snaps to and highlights the monster');
        check(!h1.uids.includes(c.uid) || h1.phase !== 'combat', 'touch drag of an attack onto a monster plays it');
      } else check(true, '(no targeted card in hand — skipped)');
    }
    // c) non-targeted: drag above the play line
    if ((await handInfo()).phase === 'combat') {
      const c = await cardEl(false);
      if (c) {
        const lineY = await page.evaluate(() => __game.playLine());
        const from = await center(c.el);
        const mid = await drag(from, { x: 195, y: Math.max(120, lineY - 140) });
        const h1 = await handInfo();
        check(mid.zone, 'dragging a skill above the line lights the play zone');
        check(!h1.uids.includes(c.uid) || h1.phase !== 'combat', 'touch drag of a skill above the play line plays it');
      } else check(true, '(no non-targeted playable card — skipped)');
    }
    // d) tap-select still works, and End Turn only cancels while a card is selected
    if ((await handInfo()).phase === 'combat') {
      const c = (await cardEl(false)) || (await cardEl(true));
      if (c) {
        const t0 = await page.evaluate(() => __game.state.turn);
        await page.tap(`.hand .card[data-card="${c.uid}"]`); await sleep(120);
        check(await page.evaluate(() => !!__game.ui.selected), 'tap card selects it (does not play)');
        check(await page.$eval('.endturn', b => /cancel/i.test(b.textContent)), 'End Turn button turns into "Cancel card" while a card is selected');
        await page.tap('.endturn'); await sleep(300);
        check(await page.evaluate((t0) => __game.state.turn === t0 && !__game.ui.selected, t0), 'End Turn tap with a card selected only cancels the selection (turn not ended)');
        await page.tap(`.hand .card[data-card="${c.uid}"]`); await sleep(120);
        if (await page.$('.unit.enemy.targetable')) await page.tap('.unit.enemy.targetable .sprite-wrap'); else await page.tap('.playbtn');
        await sleep(350);
        const h1 = await handInfo();
        check(!h1.uids.includes(c.uid) || h1.phase !== 'combat', 'tap-select + tap monster / Play still plays the card');
      }
    }
    if (await page.evaluate(() => __game.state.phase === 'combat')) {
      const it = await page.$('.intent');
      if (it) {
        const b = await it.boundingBox();
        await page.touchscreen.touchStart(b.x + b.width / 2, b.y + b.height / 2); await sleep(650); await page.touchscreen.touchEnd();
        await sleep(100);
        check(await page.evaluate(() => getComputedStyle(document.getElementById('tooltip')).display === 'block'), 'long-press shows tooltip');
        await page.touchscreen.tap(20, 200); await sleep(100);
      }
      const t0 = await page.evaluate(() => __game.state.turn);
      await page.tap('.endturn'); await sleep(400);
      await page.waitForFunction(() => !__game.ui.busy, { timeout: 10000 });
      check(await page.evaluate((t0) => __game.state.turn > t0 || __game.state.phase !== 'combat', t0), 'End Turn tap (nothing selected) ends the turn');
    }
    const snap = () => page.evaluate(() => JSON.stringify({ hp: __game.state.players[0].hp, turn: __game.state.turn, floor: __game.state.floor, pos: __game.state.pos, pot: __game.state.players[0].potions }));
    const before = await snap();
    await page.reload(); await sleep(200);
    check(!!(await page.$('[data-act="continue"]')), 'after reload, title shows Continue');
    await page.tap('[data-act="continue"]'); await sleep(200);
    check(before === await snap(), 'Continue restores the same run ' + before);
    check(page.errors.length === 0, 'no JS errors (' + page.errors.join('; ') + ')');
    await page.close();
  }

  // 3. PWA: manifest, service worker, offline reload
  console.log('PWA:');
  {
    const page = await newPage(browser, iPhone, UA);
    await page.goto('http://localhost:8123/');
    const man = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); return l && (await fetch(l.href)).json(); });
    check(man && man.display === 'standalone' && man.name === 'Dungeon Delve' && man.icons.length >= 2, 'manifest linked and valid');
    check(await page.evaluate(() => !!document.querySelector('meta[name=apple-mobile-web-app-capable]') && !!document.querySelector('link[rel=apple-touch-icon]')), 'iOS meta tags + apple-touch-icon');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 15000 }).catch(() => {});
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload(); await sleep(1500); }
    check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
    await page.setOfflineMode(true);
    await page.reload(); await sleep(500);
    check(await page.evaluate(() => !!document.querySelector('[data-act="classes"]')), 'game loads while offline (cached)');
    const art = await page.evaluate(async () => { const r = await Promise.all(['assets/beholder.webp', 'assets/ev_tymora.webp', 'assets/bg_underdark.webp'].map(u => fetch(u).then(x => x.ok && x.headers.get('content-type') !== null).catch(() => false))); return r.every(Boolean); });
    check(art, 'monster / event / background art loads while offline (cached by service worker)');
    await page.setOfflineMode(false);
    await page.close();
  }

  // 4. Screenshots + layout on several sizes
  console.log('Screenshots / layout:');
  const SE = { ...iPhone, width: 375, height: 667, deviceScaleFactor: 2 }, LAND = { ...iPhone, width: 844, height: 390 }, DESK = { width: 1440, height: 860, deviceScaleFactor: 1 };
  const shots = [
    ['iphone-classes', iPhone, '#demo-classes'], ['iphone-map', iPhone, '#demo-map-fighter'], ['iphone-combat', iPhone, '#demo-combat-barbarian'],
    ['iphone-combat-wizard', iPhone, '#demo-combat-wizard'], ['iphone-event', iPhone, '#demo-event-fighter-shrine_tymora'],
    ['iphone-shop', iPhone, '#demo-shop-wizard'], ['iphone-boss', iPhone, '#demo-boss-barbarian'],
    ['iphoneSE-combat', SE, '#demo-combat-fighter'], ['iphoneSE-event', SE, '#demo-event-wizard-talking_skull'],
    ['iphone-landscape-combat', LAND, '#demo-combat-barbarian'], ['iphone-landscape-map', LAND, '#demo-map-wizard'],
    ['desktop-combat', DESK, '#demo-combat-barbarian'], ['desktop-map', DESK, '#demo-map-fighter'], ['desktop-event', DESK, '#demo-event-wizard-deck_many_things'],
    ['desktop-shop', DESK, '#demo-shop-fighter'], ['desktop-boss', DESK, '#demo-boss-wizard'],
  ];
  for (const [name, vp, hash] of shots) {
    const page = await newPage(browser, vp, vp.isMobile ? UA : null);
    await page.goto(BASE + hash); await sleep(1300);
    if (hash.startsWith('#demo-combat')) await layoutChecks(page, name);
    await page.screenshot({ path: SHOTS + `screenshot-${name}.png` });
    check(page.errors.length === 0, `${name}: no JS errors`);
    await page.close();
  }
  // desktop file:// selftest still works (single-file version)
  console.log('Desktop single file (file://) selftest:');
  {
    const page = await newPage(browser, { width: 1440, height: 860 });
    await page.goto('file://' + require('path').resolve(__dirname, '../index.html') + '#selftest');
    await page.waitForFunction(() => document.body.dataset.selftest, { timeout: 300000 });
    const res = await page.evaluate(() => document.body.dataset.selftest);
    console.log('   ', res);
    check(res.startsWith('SELFTEST PASS') && !(await page.evaluate(() => document.body.classList.contains('touch'))), 'desktop mouse-mode selftest passes');
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? `\nFAILED: ${fails.length}\n - ` + fails.join('\n - ') : '\nALL MOBILE CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
