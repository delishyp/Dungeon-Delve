// node test/menushots.js -> desktop screenshots of main menu, settings tabs, pause, compendium, dialogs + contact sheet
const puppeteer = require('puppeteer-core');
const path = require('path'), fs = require('fs');
const W = 1440, H = 860, file = 'file://' + path.resolve(__dirname, '../index.html');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setViewport({ width: W, height: H });
  const out = [];
  const shot = async (n) => { await sleep(450); const f = `shots/menu-${n}.png`; await pg.screenshot({ path: f }); out.push(f); };
  const click = async (sel) => { await pg.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error('missing ' + s); el.click(); }, sel); await sleep(250); };
  await pg.goto(file); await pg.evaluate(() => localStorage.clear()); await pg.goto(file + '#'); await pg.reload(); await sleep(1500);
  await shot('main-nosave');
  // make a save + seen data by starting a run in-page, then back to the title
  await pg.evaluate(async () => { const g = window.__game; window.Settings.set('skipNarration', true); await g.startGame('wizard', 4242); });
  await sleep(800); await shot('map-topbar');
  await click('.mapnode.reachable'); await sleep(1200); await shot('combat-topbar');
  await pg.keyboard.press('Escape'); await shot('pause');
  await click('[data-act="settings"]'); await shot('settings-audio');
  for (const t of ['gameplay', 'visuals', 'controls', 'data']) { await click(`[data-act="stab"][data-tab="${t}"]`); await shot('settings-' + t); }
  await click('[data-act="sclose"]'); await click('[data-act="abandon"]'); await shot('confirm-abandon');
  await click('[data-act="confirmno"]'); await click('[data-act="savequit"]'); await sleep(600);
  await pg.evaluate(() => window.Settings.set('skipNarration', false));
  await pg.mouse.move(W * 0.8, H * 0.4); await sleep(1200); await shot('main');
  await pg.hover('.menubtn[data-act="compendium"]'); await shot('main-hover');
  await click('[data-act="newrun"]'); await shot('confirm-newrun'); await click('[data-act="confirmno"]');
  await click('[data-act="compendium"]'); await shot('compendium-cards');
  await click('[data-act="compfilter"][data-f="barbarian"]'); await click('[data-act="compup"]'); await shot('compendium-barbarian-upgraded');
  for (const t of ['relics', 'potions', 'monsters']) { await click(`[data-act="comptab"][data-tab="${t}"]`); await shot('compendium-' + t); }
  await pg.keyboard.press('Escape'); await click('[data-act="credits"]'); await shot('credits');
  await click('.credits [data-act="closemodal"]'); await click('[data-act="quit"]'); await shot('farewell');
  // UI scale check
  await click('[data-act="closemodal"]'); await pg.evaluate(() => window.Settings.set('uiScale', 125)); await click('[data-act="continue"]'); await sleep(900); await shot('combat-scale125');
  await pg.evaluate(() => window.Settings.set('uiScale', 100));
  const sheet = ['main', 'settings-audio', 'settings-gameplay', 'settings-visuals', 'settings-controls', 'settings-data', 'pause', 'compendium-cards', 'compendium-monsters', 'compendium-relics', 'confirm-newrun', 'credits'];
  fs.writeFileSync('/tmp/msheet.html', `<body style="margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px;font:15px Arial;color:#ddd">` +
    sheet.map(n => `<figure style="margin:0"><img style="width:100%;display:block" src="file://${path.resolve(__dirname, '../shots/menu-' + n + '.png')}"><figcaption>${n}</figcaption></figure>`).join('') + '</body>');
  const p2 = await browser.newPage(); await p2.setViewport({ width: 1800, height: 1200 }); await p2.goto('file:///tmp/msheet.html'); await sleep(800);
  await p2.screenshot({ path: 'shots/contact-menu-desktop.png', fullPage: true }); out.push('shots/contact-menu-desktop.png');
  await browser.close();
  console.log(out.join('\n')); console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
