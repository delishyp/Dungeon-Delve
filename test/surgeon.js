// The Surgeon (Floor 2 elite, key mind_flayer) and his Sewn: targeting, AI, unravel, save/load.
// Usage: node test/surgeon.js
const E = require('../src/engine.js');
const D = require('../src/data.js');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const alive = (e) => e && e.hp > 0;
const sewns = (s) => s.enemies.filter(e => e.monsterId === 'sewn' && alive(e));
const surgeon = (s) => s.enemies.find(e => e.monsterId === 'mind_flayer');
const P = (s) => s.players[0];

function fight(hero, seed) {
  const s = E.newGame({ seed, heroes: [hero] });
  s.floor = 1; s.node = 'elite';
  E.startEncounter(s, 'mind_flayer'); E.takeEvents(s);
  return s;
}
function addCard(s, id) { const c = { uid: 'test' + (s.uidCounter++), id }; P(s).hand.push(c); P(s).energy = 99; return c; }
function endTurn(s) { const p = P(s); p.hp = p.maxHp = 999; const r = E.dispatch(s, { type: 'END_TURN', player: p.uid }); ok(r.ok, 'end turn ' + r.error); return E.takeEvents(s); }

// --- setup and opener
{
  const s = fight('barbarian', 11);
  const sg = surgeon(s);
  ok(sg && sg.name === 'The Surgeon' && D.MONSTERS.mind_flayer.elite, 'the elite is The Surgeon under key mind_flayer');
  ok(D.FLOORS[1].elites.includes('mind_flayer') && D.ENCOUNTERS.mind_flayer.elite, 'still a Floor 2 elite encounter');
  ok(sg.intent.move === 'stitch', 'turn 1 is Fresh Stitches');
  const di = E.describeIntent(s, sg); ok(di.summon === 'The Sewn' && di.kind === 'summon', 'Fresh Stitches intent shows a summon');
  ok(E.isTargetable(s, sg), 'targetable before any Sewn');
  endTurn(s);
  ok(sewns(s).length === 1, 'one Sewn after Fresh Stitches');
  const sw = sewns(s)[0];
  ok(sw.hp >= 30 && sw.intent.move === 'wait' && E.describeIntent(s, sw).wait, 'a new Sewn waits (waiting intent)');
  ok(s.enemies.indexOf(sw) < s.enemies.indexOf(sg), 'the Sewn stands in front of him');
  ok(sg.statuses.held === 1, 'Held Together shown while the Sewn stands');
  ok(D.STATUSES.held.name === 'Held Together' && D.STATUSES.held.tip === "He can't be targeted while a Sewn stands.", 'Held Together name and tooltip');
  ok(sg.intent.move === 'incision', 'with a Sewn up he goes to The Incision');

  // --- can't be targeted while a Sewn lives
  ok(!E.isTargetable(s, sg) && E.targetableEnemies(s).length === 1 && E.targetableEnemies(s)[0] === sw, 'only the Sewn is targetable');
  const hp0 = sg.hp, strike = addCard(s, 'greataxe');
  const r = E.dispatch(s, { type: 'PLAY_CARD', player: P(s).uid, card: strike.uid, target: sg.uid });
  ok(!r.ok && /can't be targeted/.test(r.error) && sg.hp === hp0 && P(s).hand.includes(strike), 'single-target card on him is refused, card stays in hand');
  const r2 = E.dispatch(s, { type: 'PLAY_CARD', player: P(s).uid, card: strike.uid });
  ok(r2.ok && sg.hp === hp0 && sw.hp < sw.maxHp, 'no target given: auto-target picks the Sewn, never him');
  E.takeEvents(s);

  // --- attacks that hit ALL enemies hit him
  sg.block = 0; const h1 = sg.hp, s1 = sw.hp, aoe = addCard(s, 'whirling_axe');
  ok(E.dispatch(s, { type: 'PLAY_CARD', player: P(s).uid, card: aoe.uid }).ok, 'play Whirling Axe');
  ok(sg.hp < h1 && sw.hp < s1, 'an all-enemy attack hits him and the Sewn');
  E.takeEvents(s);

  // --- the Sewn dies: next move is The Incision (shown now), then Fresh Stitches the turn after
  sg.intent = { move: 'steady', target: P(s).uid };   // whatever he planned
  sw.hp = 1; sw.block = 0; const k = addCard(s, 'greataxe');
  ok(E.dispatch(s, { type: 'PLAY_CARD', player: P(s).uid, card: k.uid, target: sw.uid }).ok, 'kill the Sewn');
  const ev = E.takeEvents(s);
  ok(!alive(sw) && ev.some(e => e.kind === 'exposed'), 'Exposed event when the Sewn dies');
  ok(sg.intent.move === 'incision' && E.describeIntent(s, sg).damage != null, 'his next move is The Incision, shown as a normal attack intent');
  ok(E.isTargetable(s, sg) && !sg.statuses.held, 'he is targetable and Held Together is gone');
  endTurn(s);
  ok(sewns(s).length === 0, 'The Incision does not sew');
  ok(sg.intent.move === 'stitch' && E.describeIntent(s, sg).summon, 'the turn after, Fresh Stitches, with a summon intent');
  endTurn(s);
  ok(sewns(s).length === 1 && s.enemies.filter(e => e.monsterId === 'sewn').length === 1, 'a new Sewn reuses the fallen one\'s place');
}

// --- AI over many turns: never more than one Sewn, never sews while one is up, Incision always follows a Sewn's death
let sewnDeaths = 0, enemyTurnDeaths = 0;
for (const hero of Object.keys(D.HEROES)) for (let seed = 1; seed <= 40; seed++) {
  const s = fight(hero, seed * 31), sgUid = surgeon(s).uid;
  let mustIncise = false, sewnUp = false;
  const scan = (evs, onEnemyTurn) => { for (const e of evs) {
    if (e.kind === 'death' && e.why !== 'unravel' && E.find(s, e.target)?.monsterId === 'sewn' && alive(surgeon(s))) { mustIncise = true; sewnDeaths++; if (onEnemyTurn) enemyTurnDeaths++; }
    if (e.kind === 'enemyAct' && e.source === sgUid) {
      if (mustIncise) ok(e.move === 'incision', `after the Sewn dies his next move is The Incision (${hero} ${seed}, got ${e.move})`);
      if (sewnUp) ok(e.move !== 'stitch', `never sews while a Sewn is up (${hero} ${seed})`);
      if (mustIncise && e.move === 'incision') mustIncise = false;
    }
    if (e.kind === 'enemyAct') sewnUp = sewns(s).length > 0;
  } };
  for (let t = 0; t < 30 && s.phase === 'combat'; t++) {
    const sg = surgeon(s);
    ok(sewns(s).length <= 1, `never more than one Sewn (${hero} ${seed})`);
    if (sewns(s).length) ok(sg.intent.move !== 'stitch', 'his intent is never Fresh Stitches while a Sewn is up');
    if (mustIncise) ok(sg.intent.move === 'incision', 'the Incision intent is shown after the Sewn dies');
    // the hero kills the Sewn every other turn; on some seeds Retaliate kills it during the enemy turn instead
    const p = P(s); p.statuses.thorns = seed % 3 === 0 ? 60 : 0;
    const sw = sewns(s)[0];
    if (sw && seed % 3 !== 0 && (t + seed) % 2 === 0) { sw.hp = 1; sw.block = 0; const c = addCard(s, 'greataxe'); E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: sw.uid }); }
    scan(E.takeEvents(s));
    sewnUp = sewns(s).length > 0;
    scan(endTurn(s), true);
  }
}
ok(sewnDeaths > 100 && enemyTurnDeaths > 20, `the AI loop saw plenty of Sewn deaths (${sewnDeaths}, ${enemyTurnDeaths} on the enemy turn)`);
console.log(`  Sewn deaths checked: ${sewnDeaths} (${enemyTurnDeaths} on the enemy turn)`);

// --- killing him ends the fight; the Sewn falls apart; elite rewards unchanged
{
  const s = fight('fighter', 5); endTurn(s);
  const sg = surgeon(s), sw = sewns(s)[0]; ok(!!sw, 'Sewn up');
  sg.hp = 3; sg.block = 0; const aoe = addCard(s, 'cleave');
  ok(E.dispatch(s, { type: 'PLAY_CARD', player: P(s).uid, card: aoe.uid }).ok, 'cleave');
  const ev = E.takeEvents(s);
  ok(!alive(sg) && !alive(sw), 'he dies and the Sewn falls apart');
  ok(ev.some(e => e.kind === 'unravel' && e.target === sw.uid), 'unravel event for the narrator line');
  ok(s.phase === 'reward' && ev.some(e => e.kind === 'encounterWon'), 'the fight ends in a win');
  const rw = P(s).reward; ok(rw && rw.relic && rw.potion && rw.cards.length === 3, 'elite rewards: relic, potion, 3 cards');
  const g = D.FLOORS[1].gold.elite; ok(rw.gold >= g[0] && rw.gold <= g[1], 'elite gold range');
}
// killing him with the Sewn down also ends the fight
{
  const s = fight('wizard', 9); const sg = surgeon(s); sg.hp = 2; sg.block = 0;
  const c = addCard(s, 'fire_bolt'); ok(E.dispatch(s, { type: 'PLAY_CARD', player: P(s).uid, card: c.uid, target: sg.uid }).ok, 'fire bolt on him (no Sewn yet)');
  ok(s.phase === 'reward', 'killing him ends the fight');
}

// --- save and load mid-fight: the Sewn, its waiting state and his AI state survive
{
  const s = fight('barbarian', 77); endTurn(s);
  const snap = JSON.parse(JSON.stringify({ ...s, events: [] }));
  const sw = sewns(snap)[0], sg = surgeon(snap);
  ok(sw && sw.intent.move === 'wait' && sw.moveCount === 0, 'save keeps the waiting Sewn');
  ok(sg.statuses.held === 1 && !E.isTargetable(snap, sg), 'loaded: still Held Together and untargetable');
  // both copies must play out the same
  const a = s, b = snap; b.events = [];
  for (let i = 0; i < 6 && a.phase === 'combat'; i++) { endTurn(a); endTurn(b); }
  ok(JSON.stringify(a) === JSON.stringify(b), 'loaded fight plays out exactly like the original');
  // exposed state survives a save
  const s2 = fight('fighter', 3); endTurn(s2); const w = sewns(s2)[0]; w.hp = 1; w.block = 0;
  const c = addCard(s2, 'strike'); E.dispatch(s2, { type: 'PLAY_CARD', player: P(s2).uid, card: c.uid, target: w.uid }); E.takeEvents(s2);
  const l2 = JSON.parse(JSON.stringify(s2));
  ok(surgeon(l2).exposed && surgeon(l2).intent.move === 'incision', 'loaded: Exposed Incision kept');
  endTurn(l2); ok(surgeon(l2).intent.move === 'stitch', 'loaded: then Fresh Stitches');
}

// --- numbers (base, before depth scaling; easing Nov 3: HP x0.8, damage x0.85 vs 8b7c8cd)
{
  const M = D.MONSTERS.mind_flayer.moves, W = D.MONSTERS.sewn.moves, atk = (mv) => mv.effects.find(f => f.t === 'attack');
  ok(D.MONSTERS.mind_flayer.hp.join() === '66,66' && D.MONSTERS.sewn.hp.join() === '30,30', 'base HP 66 / 30');
  ok(atk(M.incision).n === 15 && atk(W.heavy).n === 15 && atk(W.lurch).n === 9 && atk(W.lurch).times === 2, 'Incision 15, Heavy Hands 15, Lurch 9x2');
  ok(M.steady.effects.find(f => f.t === 'block').n === 10 && M.steady.effects.find(f => f.t === 'healMinions').n === 6 && W.guard.effects[0].n === 6, 'Steady Hands 10 Block + heal 6, Stand Guard 6 (unchanged)');
}

// --- lines live in data
{
  global.window = global; require('../src/content.js');
  const L = D.STORY.enemyLines.mind_flayer;
  ok(L.intro.length === 2 && L.turnTaunts.length === 8 && L.moveLines.stitch.length === 3 && L.exposed.length === 1 && L.defeat.length === 1 && L.unravel[0].startsWith('With no one to hold the thread'), 'Surgeon lines v2 in data');
  ok(!JSON.stringify(L).includes('Both of you'), 'no two-Sewn line');
}
console.log(fails ? `SURGEON FAIL ${fails}/${checks}` : `surgeon ok (${checks} checks)`);
process.exit(fails ? 1 : 0);
