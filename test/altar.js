// Guardians of the Altar: Floor 1 gets its own lighter copies (skeleton_altar / ghoul_altar); Floor 2 keeps the shared skeleton / ghoul.
const E = require('../src/engine.js');
const D = require('../src/data.js'); require('../src/content.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const atk = (id, mv) => D.MONSTERS[id].moves[mv].effects.find(f => f.t === 'attack');
// the F1 copies' numbers (base, before depth scaling)
const S = D.MONSTERS.skeleton_altar, G = D.MONSTERS.ghoul_altar;
ok(S.hp.join() === '16,19' && atk('skeleton_altar', 'sword').n === 6 && atk('skeleton_altar', 'rattle').n === 3 && atk('skeleton_altar', 'bow').n === 2 && atk('skeleton_altar', 'bow').times === 3, 'skeleton_altar HP 16-19, sword 6, rattle 3, bow 2x3');
ok(G.hp.join() === '12,13' && atk('ghoul_altar', 'claw').n === 6 && atk('ghoul_altar', 'bite').n === 11, 'ghoul_altar HP 12-13, claw 6, bite 11');
for (const [v, b] of [['skeleton_altar', 'skeleton'], ['ghoul_altar', 'ghoul']]) {
  const m = D.MONSTERS[v], o = D.MONSTERS[b];
  ok(m.variantOf === b && m.sprite === b && m.name === o.name, v + ' is a variant of ' + b + ' (same name and art)');
  ok(Object.keys(m.moves).join() === Object.keys(o.moves).join() && JSON.stringify(m.ai) === JSON.stringify(o.ai), v + ' has the same moves and AI');
}
const F1 = D.ENCOUNTERS.altar_dead_f1, F2 = D.ENCOUNTERS.altar_dead;
ok(F1.enemies.join() === 'skeleton_altar,skeleton_altar,ghoul_altar' && F1.sameAs === 'altar_dead' && F1.name === F2.name && F1.scene === F2.scene, 'altar_dead_f1 encounter');
ok(F2.enemies.join() === 'skeleton,skeleton,ghoul', 'altar_dead unchanged');
// the event picks the copy by floor (s.floor is 0-based: 0 = Floor 1, 1 = Floor 2)
const tip = D.EVENTS.cursed_altar.choices.findIndex(c => c.ops && c.ops.fight);
for (let seed = 1; seed <= 30; seed++) for (const floor of [0, 1]) {
  const s = E.newGame({ seed, heroes: ['barbarian'] }); E.takeEvents(s); const p = s.players[0];
  s.floor = floor; s.phase = 'event'; s.event = { id: 'cursed_altar', stage: 'choose', result: null, next: null, pick: null, log: [] };
  ok(E.dispatch(s, { type: 'EVENT_CHOICE', player: p.uid, choice: tip }).ok, 'tip the altar');
  const r = E.dispatch(s, { type: 'EVENT_CONTINUE', player: p.uid }); ok(r.ok, 'continue ' + r.error);
  const want = floor === 0 ? 'altar_dead_f1' : 'altar_dead';
  ok(s.phase === 'combat' && s.encounter === want, `floor ${floor + 1} fights ${want} (got ${s.encounter})`);
  ok(s.enemies.map(e => e.monsterId).join() === D.ENCOUNTERS[want].enemies.join(), 'enemies match ' + want);
}
console.log('altar ok (' + n + ' checks)');
