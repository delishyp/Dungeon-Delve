// Anna (Nov 4, via Designer): every elite gives exactly one relic. The Sleeping Wyrmling's "Strike it before it wakes"
// gives the Red Wyrmling Scale as that relic (labelled as a trophy) instead of a random one; if she already owns the
// Scale she gets one random elite relic. The woken grab-gold fight gives one random relic, no Scale.
// Every path still gives elite gold, an elite card choice and a potion.
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const ev = D.EVENTS ? D.EVENTS.sleeping_wyrmling : null;
if (ev) {
  ok(ev.choices[1].ops.relicAfter === 'wyrm_scale', 'Strike it before it wakes carries the Scale');
  ok(ev.choices[0].chance.every(c => !c.relicAfter) && ev.choices[0].chance.some(c => c.fight === 'wyrmling') && ev.choices[0].chance.find(c => c.fight).gold === undefined, 'woken grab path: fight with no Scale and no 65 gold');
}
function win(seed, pending, ownScale) {
  const s = E.newGame({ seed, heroes: ['barbarian'] }); E.takeEvents(s); const p = s.players[0];
  if (ownScale) p.relics.push(typeof p.relics[0] === 'object' ? { id: 'wyrm_scale' } : 'wyrm_scale');
  const before = p.relics.length, gold0 = p.gold;
  s.node = 'elite'; s.pendingRelic = pending; E.startEncounter(s, 'wyrmling'); s.node = 'elite'; s.pendingRelic = pending; E.takeEvents(s);
  for (let i = 0; i < 40 && s.phase === 'combat'; i++) {
    for (const e of s.enemies) if (e.hp > 1) e.hp = 1; p.energy = 9;
    const c = p.hand.find(c => E.cardDef(c).effects && E.cardDef(c).effects.some(f => f.t === 'damage'));
    if (!c) { E.dispatch(s, { type: 'END_TURN', player: p.uid }); continue; }
    E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: s.enemies.find(e => e.hp > 0).uid }); E.takeEvents(s);
  }
  ok(s.phase === 'reward', `seed ${seed}: fight won (phase ${s.phase})`);
  const r = p.reward;
  ok(p.relics.length === before + 1, `seed ${seed}: exactly one relic gained (${before} -> ${p.relics.length})`);
  ok([r.relic, r.bonusRelic].filter(Boolean).length === 1, `seed ${seed}: reward lists exactly one relic`);
  ok(p.gold - gold0 === r.gold && r.gold >= D.FLOORS[s.floor].gold.elite[0], `seed ${seed}: elite gold (${r.gold})`);
  ok(r.cards.length === 3 && r.potion, `seed ${seed}: elite card choice and a potion`);
  return r;
}
for (let seed = 1; seed <= 20; seed++) {
  let r = win(seed, 'wyrm_scale', false);
  ok(r.bonusRelic === 'wyrm_scale' && r.relic === null, 'strike before it wakes: the Scale, as the trophy, and no random relic');
  r = win(seed, 'wyrm_scale', true);
  ok(r.bonusRelic === null && r.relic && r.relic !== 'wyrm_scale', 'Scale already owned: one random elite relic as a normal reward');
  r = win(seed, null, false);
  ok(r.bonusRelic === null && r.relic && r.relic !== 'wyrm_scale', 'woken grab path: one random elite relic, no Scale');
}
console.log('WYRMLING PASS', n, 'checks');
