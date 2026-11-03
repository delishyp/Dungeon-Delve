// demo.2 bosses (Producer, Nov 3): boss pools per floor, the Crier's Echoes, the Toll and the Brood, and their code effects
// played on the matching fight events. Engine checks first, then one browser check of the effect hooks.
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' ' + JSON.stringify(a));

// ---- boss pools: Floor 1 the Crier or the Beast (50/50); Floor 2 Vessa or the trial (50/50), the trial the Toll or the Brood
eq(D.FLOORS.map(F => F.bossPool), [{ owlbear: 1, crier: 1 }, { beholder: 2, toll: 1, brood: 1 }], 'boss pools');
eq(D.FLOORS.map(F => F.boss), ['owlbear', 'beholder'], 'defaults for saves from before the pool');
for (const k of ['crier', 'toll', 'brood']) ok(D.ENCOUNTERS[k] && D.ENCOUNTERS[k].boss && D.MONSTERS[k].boss, k + ' is a boss encounter');
const cnt = {};
for (let seed = 1; seed <= 4000; seed++) { const s = E.newGame({ seed, heroes: ['fighter'] }); cnt[s.map.boss] = (cnt[s.map.boss] || 0) + 1; }
ok(Math.abs(cnt.crier / 4000 - 0.5) < 0.04 && Math.abs(cnt.owlbear / 4000 - 0.5) < 0.04, 'Floor 1: about 50/50 ' + JSON.stringify(cnt));
// the second floor's map is made on the floor change: walk a run to it and look
const f2 = {};
for (let seed = 1; seed <= 1200; seed++) {
  const s = E.newGame({ seed, heroes: ['fighter'] });
  const before = s.rng; const s0 = E.newGame({ seed, heroes: ['fighter'] }); ok(s0.map.boss === s.map.boss && before === s0.rng, 'same seed, same boss, same rng');
  // jump to the boss node and win it to reach floor 2
  s.pos = s.map.rows[s.map.rows.length - 2][0]; E.dispatch(s, { type: 'CHOOSE_NODE', player: s.players[0].uid, node: 'boss' });
  ok(s.encounter === s.map.boss, 'the boss fought is the floor pick');
  s.enemies.forEach(e => { e.hp = 0; }); s.enemies[0].hp = 1; const p = s.players[0]; p.energy = 9; p.hand.push({ uid: 'kill', id: 'strike' });
  E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'kill', target: s.enemies[0].uid });
  for (let g = 0; g < 4 && s.phase === 'reward'; g++) E.dispatch(s, { type: 'CHOOSE_REWARD', player: p.uid, card: null });
  if (s.floor === 1) f2[s.map.boss] = (f2[s.map.boss] || 0) + 1;
}
const t2 = Object.values(f2).reduce((a, b) => a + b, 0);
ok(t2 > 1000 && Math.abs(f2.beholder / t2 - 0.5) < 0.05 && Math.abs(f2.toll / t2 - 0.25) < 0.05 && Math.abs(f2.brood / t2 - 0.25) < 0.05, 'Floor 2: Vessa 50%, Toll 25%, Brood 25% ' + JSON.stringify(f2));
{ const s = E.newGame({ seed: 5, heroes: ['fighter'] }); delete s.map.boss; eq(E.floorBoss(s), 'owlbear', 'a save without map.boss keeps the old boss'); }

const fight = (enc, floor = 1, hero = 'fighter') => { const s = E.newGame({ seed: 77, heroes: [hero] }); s.floor = floor; E.startEncounter(s, enc); E.takeEvents(s); return s; };
const endTurn = s => { const p = s.players[0]; p.hp = p.maxHp; E.dispatch(s, { type: 'END_TURN', player: p.uid }); return E.takeEvents(s); };
const echoes = p => [p.hand, p.draw, p.discard].reduce((a, x) => a + x.filter(c => c.id === 'echo').length, 0);

// ---- the Crier: Echoes, at most 3 at once; each in hand at end of turn costs 3 HP; playing one (1 Energy) silences it (Exhaust)
{ const s = fight('crier', 0), p = s.players[0], c = D.CARDS.echo;
  eq([c.cost, c.exhaust, c.endTurnHpLoss, c.combatOnly, !!c.unplayable], [1, true, 3, true, false], 'Echo card');
  let max = 0; for (let t = 0; t < 16; t++) { endTurn(s); max = Math.max(max, echoes(p)); }
  ok(max === 3, 'Echoes never above 3 (' + max + ')');
  const s2 = fight('crier', 0), p2 = s2.players[0]; endTurn(s2); const e1 = p2.hand.find(x => x.id === 'echo'); ok(e1, 'her opening Call puts an Echo in your hand');
  p2.hp = 50; p2.energy = 3; const r = E.dispatch(s2, { type: 'PLAY_CARD', player: p2.uid, card: e1.uid }); ok(r.ok && p2.energy === 2 && p2.exhaust.some(x => x.uid === e1.uid), 'playing an Echo costs 1 and exhausts it');
  const s3 = fight('crier', 0), p3 = s3.players[0]; endTurn(s3); p3.hand = p3.hand.filter(x => x.id === 'echo'); p3.block = 0; p3.hp = 50; s3.enemies[0].intent = { move: 'listen', target: p3.uid };
  E.dispatch(s3, { type: 'END_TURN', player: p3.uid }); E.takeEvents(s3); ok(p3.hp === 47, 'an Echo left in hand costs 3 HP (' + p3.hp + ')');
  ok(!p.deck.some(x => x.id === 'echo'), 'Echoes never reach the deck'); }

// ---- the Toll: the Penitent kneels first (the gate can't be hit while she does); Breath brings the bones; Count the Tally-Scratcher
{ const s = fight('toll'), toll = s.enemies[0];
  eq(toll.intent.move, 'kneel', 'opener: the Penitent kneels'); endTurn(s);
  const pen = s.enemies.find(e => e.monsterId === 'toll_penitent'); ok(pen && !E.isTargetable(s, toll), 'the gate is held up (untargetable) while the Penitent kneels');
  const seen = [toll.lastMove]; for (let t = 0; t < 5; t++) { endTurn(s); seen.push(toll.lastMove); }
  eq(seen, ['kneel', 'narrow', 'breath', 'count', 'shut', 'narrow'], 'Toll pattern');
  ok(s.enemies.some(e => e.monsterId === 'toll_bones') && s.enemies.some(e => e.monsterId === 'toll_tally'), 'bones and the Tally-Scratcher came through');
  pen.hp = 0; s.enemies.forEach(e => { if (e.monsterId === 'toll_penitent') e.hp = 0; }); E.dispatch(s, { type: 'END_TURN', player: s.players[0].uid }); E.takeEvents(s);
  toll.hp = 1; toll.block = 0; const p = s.players[0]; p.energy = 9; p.hand.push({ uid: 'k1', id: 'strike' });
  if (s.phase === 'combat' && E.isTargetable(s, toll)) { E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'k1', target: toll.uid }); E.takeEvents(s);
    ok(!s.enemies.some(e => e.monsterId === 'toll_bones' && e.hp > 0), 'the bones fall when the gate opens'); } }

// ---- the Brood: Split grows a Husk still in its pod (it does nothing its first turn); Pulse breathes Poisoned; Husks die with the wall
{ const s = fight('brood'), b = s.enemies[0];
  eq(b.intent.move, 'seal', 'opener: Sealed (the Mossed Shell)'); endTurn(s); endTurn(s);
  const h = s.enemies.find(e => e.monsterId === 'brood_husk'); ok(h && h.intent.move === 'wait', 'a fresh Husk is still in its pod');
  const seen = [b.lastMove]; for (let t = 0; t < 4; t++) { endTurn(s); seen.push(b.lastMove); }
  eq(seen, ['split', 'rot', 'pulse', 'split', 'split'], 'Brood pattern');
  ok(s.enemies.filter(e => e.monsterId === 'brood_husk' && e.hp > 0).length <= 2, 'at most 2 Husks at once');
  b.hp = 1; b.block = 0; const p = s.players[0]; p.energy = 9; p.hand.push({ uid: 'k2', id: 'strike' });
  E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'k2', target: b.uid }); E.takeEvents(s);
  ok(!s.enemies.some(e => e.monsterId === 'brood_husk' && e.hp > 0), 'the Husks go still when the wall goes dormant'); }

// ---- code effects on the matching fight events, in the real page
const path = require('path'), puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const pg = await b.newPage(); const logs = []; pg.on('pageerror', e => logs.push(e.message)); await pg.setViewport({ width: 1920, height: 1080 });
  await pg.goto('file://' + path.resolve(__dirname, '../index.html') + '#demo-combat-barbarian');
  await pg.waitForFunction(() => window.__game && window.__game.state && window.__game.state.phase === 'combat' && !window.__game.ui.busy && !window.__game.ui.story, { timeout: 60000 });
  const r = await pg.evaluate(async () => {
    const g = window.__game, E = window.Engine, s = g.state, p = s.players[0], out = {};
    for (const [enc, mv, fx] of [['toll', 'breath', 'dust'], ['toll', 'count', 'count'], ['brood', 'pulse', 'pulse'], ['brood', 'split', 'split']]) {
      E.startEncounter(s, enc); E.takeEvents(s); g.ui.story = null; const e = s.enemies[0]; e.moveCount = 2; e.intent = { move: mv, target: p.uid }; p.hp = p.maxHp = 999; g.render();
      const rest = document.querySelectorAll('.unit.enemy .bossfx').length;
      g.act({ type: 'END_TURN', player: p.uid });
      for (let i = 0; i < 60 && !document.querySelector('.unit.enemy .bossfx.fx-' + fx); i++) await new Promise(r => setTimeout(r, 50));
      out[enc + '_' + mv] = { rest, on: !!document.querySelector('.unit.enemy .bossfx.fx-' + fx), state: g.ui.bossFx[e.uid] && g.ui.bossFx[e.uid].fx };
      for (let i = 0; i < 100 && g.ui.busy; i++) await new Promise(r => setTimeout(r, 50));
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) ok(v.rest === 0 && v.on && v.state === k.split('_')[1].replace('breath', 'dust'), `${k}: no layer at rest, effect plays on the move (${JSON.stringify(v)})`);
  ok(!logs.length, 'no page errors: ' + logs.join(' | '));
  await b.close();
  console.log(`demo2bosses ok (${n} checks)`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
