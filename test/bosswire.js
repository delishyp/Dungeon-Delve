// Boss sprite wiring (Anna 15:04 boss designs approved; Palette handoff ~15:09):
// Vessa (beholder boss slot) draws enemy_beholder_idle, the Beast enemy_owlbear_idle (repaint, Tester 15:18), the Crier
// enemy_crier_idle. The legacy beholder.webp / owlbear.webp stay for rollback and are the fallback when a new file is missing. Boss-canvas files are drawn
// at the hero pose scale (1 canvas px = 1 hero px), not scaled to fit. Also pins Lorekeeper's no-cubs Beast text (15:10).
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const D = require('../src/data.js'); require('../src/content.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, '../assets', f))).digest('hex');
eq([md5('enemy_beholder_idle.webp'), md5('enemy_crier_idle.webp'), md5('enemy_owlbear_idle.webp')],
  ['9de88837a6b124f787f1475b107e2bfd', 'a66f0f0ab9c58f0fc45b4eb6e3b7f380', '9b1bf2602662ee06f0254e074a2122d8'], 'Palette handoff files, byte for byte (Beast: the repaint, not 56319da7)');
eq([md5('enemy_toll_idle.webp'), md5('enemy_brood_idle.webp')], ['8ad6c5a45e35e4c8ff88119cbb059747', 'de536106bae92432c581eecdb7ab9a98'], 'Toll (shut) and Brood (sealed) files, byte for byte (Brood: not a277d410)');
eq(D.BOSS_FX, { toll: 'dust', brood: 'pulse' }, 'Toll dust and Brood pulse are code effects');
ok(!D.MONSTERS.toll && !D.MONSTERS.brood, 'no Toll/Brood enemy data yet (Producer decide), so only the sprites and idle effects are wired');
ok(fs.existsSync(path.join(__dirname, '../assets/beholder.webp')) && fs.existsSync(path.join(__dirname, '../assets/owlbear.webp')), 'legacy beholder.webp and owlbear.webp kept for rollback');
eq([D.MONSTERS.beholder.sprite, D.MONSTERS.owlbear.sprite], ['enemy_beholder_idle', 'enemy_owlbear_idle'], 'boss slots point at the new files');
eq([D.MONSTERS.beholder.name, D.ENCOUNTERS.beholder.name], ['Vessa the Unsleeping', 'Vessa the Unsleeping'], 'Vessa\'s name is on (LORE: the Watcher was a placeholder until her art existed)');
ok(!JSON.stringify(D.STORY).includes('WATCHER'), 'no "THE WATCHER:" speaker lines left');
ok(D.SPRITE_H.crier > 0, 'the Crier has a SPRITE_H entry');
const src = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');
ok(src.includes('owlbear: ["The nest is woven from bones.", "A huge grey shape rises over it: a starving owlbear with milky eyes.", "The Beast of Saint Brennick stands, huge and heavy, and lowers her head."]'), 'Beast intro, word for word');
ok(src.includes('owlbear: ["The Beast sinks down over her nest and goes still.", "Behind the nest, a crack in the rock climbs upward, toward the town."]'), 'Beast victory, word for word');
ok(!/small skeletons|most of them are small|leads down\. Deeper/i.test(src), 'no cub lines left');
ok(!/owlbear: \[[^\]]*(wing|half-bald|rises, huge)/i.test(src), 'no wings, half-bald or "rises, huge" in the Beast intro/victory lines');

(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const logs = [];
  async function look(missing) {
    const pg = await b.newPage();
    pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
    if (missing) await pg.evaluateOnNewDocument(() => {   // as if the new files were not in assets/
      Object.defineProperty(window, 'ASSETS', { configurable: true, get() { return undefined; },
        set(v) { delete v.enemy_beholder_idle; delete v.enemy_owlbear_idle; delete v.enemy_crier_idle; Object.defineProperty(window, 'ASSETS', { value: v, writable: true, configurable: true }); } });
    });
    await pg.setViewport({ width: 1920, height: 1080 });
    await pg.goto('file://' + path.resolve(__dirname, '../index.html') + '#demo-combat-barbarian');
    await pg.waitForFunction(() => window.__game && window.__game.state && window.__game.state.phase === 'combat' && !window.__game.ui.busy && !window.__game.ui.story, { timeout: 60000 });
    const r = await pg.evaluate(async () => {
      const g = window.__game, D = window.GameData, A = window.ASSETS, e = g.state.enemies[0], out = { A: { b: A.beholder, o: A.owlbear, nb: A.enemy_beholder_idle, no: A.enemy_owlbear_idle, nc: A.enemy_crier_idle, nt: A.enemy_toll_idle, nr: A.enemy_brood_idle } };
      for (const [id, name] of [['crier', 'The Crier'], ['toll', 'The Toll of the Narrows'], ['brood', 'The Brood']]) D.MONSTERS[id] = D.MONSTERS[id] || Object.assign({}, D.MONSTERS.goblin, { name, boss: true });   // test-only stand-ins: no data yet
      const hero = document.querySelector('.unit.player .sprite'); await hero.decode?.(); out.heroScale = hero.offsetHeight / 900;
      for (const id of ['beholder', 'owlbear', 'crier', 'toll', 'brood']) { e.monsterId = id; e.intent = { move: Object.keys(D.MONSTERS[id].moves)[0], target: g.state.players[0].uid }; g.render();
        const sp = document.querySelector('.unit.enemy .sprite'), u = sp.closest('.unit'), it = u.querySelector('.intent'), r = sp.getBoundingClientRect(), ir = it && it.getBoundingClientRect();
        out[id] = { src: sp.getAttribute('src') || '', h: sp.offsetHeight, cutf: +(u.dataset.cutf || 0), introw: ir ? ir.bottom - (r.top + r.height * +(u.dataset.cutf || 0)) : null, fx: [...u.querySelectorAll('.bossfx')].map(x => x.className + '|' + getComputedStyle(x.firstElementChild).animationName) }; }
      return out;
    });
    await pg.close(); return r;
  }
  const on = await look(false), off = await look(true);
  { // Compendium (Producer 15:09): a card or relic switched out of the pools is hidden, and left out of the totals, unless dev mode is on
    const pg = await b.newPage(); pg.on('pageerror', e => logs.push('pageerror: ' + e.message)); await pg.setViewport({ width: 1920, height: 1080 });
    await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
    await pg.waitForFunction(() => window.__game && window.GameData, { timeout: 60000 });
    const c = await pg.evaluate(() => { const g = window.__game, D = window.GameData, ST = window.Settings, out = {};
      const look = () => { g.ui.screen = 'compendium'; g.ui.compTab = 'cards'; g.render(); const cards = document.querySelectorAll('.compcards .card').length, has = !!document.querySelector('.compcards .card[data-card="comp_worn_grip"], .compcards .card[data-id="worn_grip"]');
        g.ui.compTab = 'relics'; g.render(); return { cards, has, relics: document.querySelectorAll('.compgrid .comptile').length }; };
      const dev0 = ST.get('devMode'); out.all = look(); D.CARDS.worn_grip.inPool = false; D.RELICS.ash_bracer.inPool = false; out.hidden = look();
      ST.set('devMode', true); out.dev = look(); ST.set('devMode', dev0); delete D.CARDS.worn_grip.inPool; delete D.RELICS.ash_bracer.inPool; return out; });
    eq([c.all.has, c.hidden.has, c.dev.has], [true, false, true], 'compendium: a switched-out card is hidden outside dev mode');
    eq([c.all.cards - c.hidden.cards, c.all.relics - c.hidden.relics, c.dev.cards - c.all.cards, c.dev.relics - c.all.relics], [1, 1, 0, 0], 'compendium totals leave it out too');
    await pg.close(); }
  eq([on.beholder.src === on.A.nb, on.owlbear.src === on.A.no, on.crier.src === on.A.nc, on.toll.src === on.A.nt, on.brood.src === on.A.nr], [true, true, true, true, true], 'the new files are drawn');
  eq([on.toll.fx, on.brood.fx, on.beholder.fx], [['bossfx fx-dust|tollDust'], ['bossfx fx-pulse|broodPulse'], []], 'Toll dust / Brood pulse layers, nothing on the others');
  for (const id of ['beholder', 'owlbear', 'crier', 'toll', 'brood']) {
    ok(Math.abs(on[id].h / 1400 - on.heroScale) < 0.01, `${id}: boss canvas drawn at the hero scale (${(on[id].h / 1400).toFixed(3)} vs ${on.heroScale.toFixed(3)} px per canvas px)`);
    ok(on[id].cutf > 0 && on[id].introw != null && on[id].introw <= 15 && on[id].introw >= -40, `${id}: the intent sits on the body's top edge, no more than 15 px into it, at most 40 px above it (${on[id].introw && on[id].introw.toFixed(1)} px)`);
  }
  eq([off.beholder.src === off.A.b, off.owlbear.src === off.A.o, off.beholder.cutf, off.owlbear.cutf], [true, true, 0, 0], 'files missing: falls back to beholder.webp / owlbear.webp at the legacy size');
  eq(off.crier.src, '', 'Crier file missing: nothing to fall back to (she has no older art)');
  ok(!logs.length, 'no page errors: ' + logs.join(' | '));
  console.log(`bosswire ok (${n} checks)`);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
