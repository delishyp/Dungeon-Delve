// Dev / data mode: setting (default off, persists, sanitized), event-choice odds/costs equal the engine's, nothing rendered when off.
const vm = require('vm'), fs = require('fs'), path = require('path');
const E = require('../src/engine.js');
const D = require('../src/data.js'); require('../src/content.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };

// ---- 1) setting: default off, survives a reload, sanitized ----
const store = {};
const loadSettings = () => { const ctx = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, setInterval() {}, JSON };
  ctx.window = ctx; ctx.addEventListener = () => {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/settings.js'), 'utf8'), ctx); return ctx.Settings; };
let ST = loadSettings();
ok(ST.DEFAULTS.devMode === false && ST.get('devMode') === false, 'devMode is off by default');
ST.set('devMode', true); ST = loadSettings();
ok(ST.get('devMode') === true, 'devMode persists after a reload');
ST.reset(); ok(loadSettings().get('devMode') === false, 'reset turns it off');
for (const bad of ['"yes"', '1', 'null', '{}']) { store['dungeon-delve-settings-v1'] = '{"devMode":' + bad + '}'; ok(loadSettings().get('devMode') === false, 'sanitized: devMode ' + bad + ' -> false'); }

// ---- 2) every event choice: describer == engine ----
const fresh = (seed, id) => { const s = E.newGame({ seed, heroes: ['barbarian'] }); E.takeEvents(s); const p = s.players[0];
  p.gold = 200; p.hp = 30; s.phase = 'event'; s.event = { id, stage: 'choose', result: null, next: null, pick: null, log: [] }; return { s, p }; };
const N = 4000, TOL = 0.03;
let randomChoices = 0;
for (const [id, ev] of Object.entries(D.EVENTS)) ev.choices.forEach((ch, i) => {
  const { s, p } = fresh(1, id), d = E.describeChoice(s, p, id, i);
  if (!ch.chance) {
    ok(d.outcomes === null && d.success === null, `${id}[${i}] has no odds`);
    // deterministic: predicted hp / maxHp / gold equal what the engine does (skip relic ops: pickup hooks can change max HP)
    if (!(ch.ops && ch.ops.relic)) { ok(E.dispatch(s, { type: 'EVENT_CHOICE', player: p.uid, choice: i }).ok, `${id}[${i}] resolves`);
      ok(p.hp === d.after.hp && p.maxHp === d.after.maxHp && p.gold === d.after.gold, `${id}[${i}] exact cost: got ${p.hp}/${p.maxHp}/${p.gold}g, shown ${d.after.hp}/${d.after.maxHp}/${d.after.gold}g`); }
    return;
  }
  randomChoices++;
  // a) against the raw data table, computed independently
  const live = ch.chance.map((b, k) => [k, b.w]).filter(([, w]) => w > 0), tot = live.reduce((a, [, w]) => a + w, 0);
  ok(d.outcomes.length === live.length && d.outcomes.every((o, k) => o.branch === live[k][0] && Math.abs(o.p - live[k][1] / tot) < 1e-12), `${id}[${i}] odds equal the data table`);
  ok(Math.abs(d.outcomes.reduce((a, o) => a + o.p, 0) - 1) < 1e-9, `${id}[${i}] odds sum to 100%`);
  // b) against the resolver itself, seeded, N runs
  const hits = {};
  for (let seed = 1; seed <= N; seed++) { const r = fresh(seed * 7919, id); const pr = E.describeChoice(r.s, r.p, id, i);
    ok(E.dispatch(r.s, { type: 'EVENT_CHOICE', player: r.p.uid, choice: i }).ok, `${id}[${i}] resolves`);
    const b = r.s.event.branch; hits[b] = (hits[b] || 0) + 1;
    const o = pr.outcomes.find(x => x.branch === b); ok(!!o, `${id}[${i}] rolled branch ${b} is listed`);
    if (!ch.chance[b].relic && !(ch.ops && ch.ops.relic)) ok(r.p.hp === o.after.hp && r.p.maxHp === o.after.maxHp && r.p.gold === o.after.gold, `${id}[${i}] branch ${b} exact numbers`); }
  for (const o of d.outcomes) ok(Math.abs((hits[o.branch] || 0) / N - o.p) < TOL, `${id}[${i}] branch ${o.branch}: rolled ${((hits[o.branch] || 0) / N).toFixed(3)} vs shown ${o.p}`);
  if (d.success != null) ok(Math.abs(d.success - d.outcomes.filter(o => !o.bad).reduce((a, o) => a + o.p, 0)) < 1e-12, `${id}[${i}] success = sum of good branches`);
});
ok(randomChoices >= 10, 'found the random event choices (' + randomChoices + ')');
// scaling: % heals resolve against the current run's max HP
{ const { s, p } = fresh(1, 'purifying_fountain'); p.maxHp = 90; p.hp = 10; const d = E.describeChoice(s, p, 'purifying_fountain', 1);
  ok(d.fixed.some(f => f.text === 'Heal 35% of max HP (+33 now)') && d.after.maxHp === 94, 'healPct uses the run\'s max HP (after +4): ' + d.fixed.map(f => f.text)); }
// other rolls read the same tables the engine rolls with
ok(JSON.stringify(E.rewardRarityWeights('fight')) === JSON.stringify(D.RARITY_WEIGHTS), 'card reward odds = RARITY_WEIGHTS');
ok(E.weightOdds(D.MAP.unknown).reduce((a, o) => a + o.p, 0) > 0.999, '? room odds sum to 100%');

// ---- 3) rendered: nothing when off, matching odds when on, persists across a page reload ----
(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 860 });
  await pg.goto('file://' + path.resolve(__dirname, '../index.html') + '#demo-map-barbarian'); await new Promise(r => setTimeout(r, 1200));
  const scan = () => pg.evaluate(() => { const g = window.__game, s = g.state, p = s.players[0], D = window.GameData, out = [];
    p.gold = 200;
    for (const id of Object.keys(D.EVENTS)) { s.phase = 'event'; s.event = { id, stage: 'choose', result: null, next: null, pick: null, log: [] }; g.render();
      [...document.querySelectorAll('.evchoice')].forEach((el, i) => out.push({ id, i, tip: el.getAttribute('data-tip'), dev: el.hasAttribute('data-devtip'), html: el.outerHTML })); }
    return { out, any: document.body.innerHTML.includes('devtip'), mode: window.Settings.get('devMode') }; });
  let r = await scan();
  ok(r.mode === false, 'browser: off by default');
  ok(r.out.length > 30 && r.out.every(c => c.tip === null && !c.dev && !/%/.test(c.html)), 'off: no tooltip data on any event choice');
  await pg.evaluate(() => window.Settings.set('devMode', true)); await pg.reload(); await new Promise(r => setTimeout(r, 1200));
  r = await scan();
  ok(r.mode === true, 'browser: on survives a page reload');
  for (const c of r.out) {
    ok(c.dev && /Dev \/ data mode/.test(c.tip || ''), `${c.id}[${c.i}] on: has a data tooltip`);
    const ch = D.EVENTS[c.id].choices[c.i];
    if (ch.chance) { const tot = ch.chance.reduce((a, x) => a + (x.w > 0 ? x.w : 0), 0);
      for (const x of ch.chance) if (x.w > 0) ok(c.tip.includes('<th>' + (Math.round(x.w / tot * 1000) / 10) + '%</th>'), `${c.id}[${c.i}] tooltip shows ${x.w}/${tot}`); }
    ok(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(c.tip), `${c.id}[${c.i}] no emoji`);
  }
  // hover shows it in the game's tooltip box
  const box = await pg.evaluate(() => { const g = window.__game; g.state.event = { id: 'trapped_chest', stage: 'choose', result: null, next: null, pick: null, log: [] }; g.render();
    const q = document.querySelector('.evchoice').getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await pg.mouse.move(box.x, box.y); await new Promise(r => setTimeout(r, 200));
  const shown = await pg.evaluate(() => { const t = document.getElementById('tooltip'); return t.style.display !== 'none' && !!t.querySelector('.devtip') ? t.innerText : null; });
  ok(shown && /60%/.test(shown) && /40%/.test(shown), 'hover shows the data tooltip: ' + shown);
  await pg.evaluate(() => window.Settings.set('devMode', false)); await b.close();
  ok(!errs.length, 'no page errors: ' + errs.join(' | '));
  console.log('devmode ok (' + n + ' checks)');
})().catch(e => { console.error(e); process.exit(1); });
