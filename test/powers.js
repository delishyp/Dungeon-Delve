// Powers (Anna): a played power leaves the piles for the rest of the fight (player.powers), with no Exhaust.
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ALL_POWERS = Object.keys(D.CARDS).filter(id => D.CARDS[id].type === 'power');
// Barbarian deck styles B1-B3 (Nov 3) added blood_up, last_tally, scar_tissue, bear_beneath. The hook-only ones (no status
// effect of their own) are covered in test/deckstyles.js; this file keeps checking every Power that applies a status.
ok(ALL_POWERS.sort().join() === ['arcane_study', 'battle_cry', 'bear_beneath', 'bear_totem', 'blood_up', 'defense_style', 'kindling', 'last_tally', 'mage_armor', 'mindless_rage', 'retaliation', 'scar_tissue',
  'the_wall_holds', 'read_the_opening', 'ten_thousand_drills', 'no_wasted_motion', 'old_scars'].sort().join(), 'power list: ' + ALL_POWERS.join());
for (const id of ALL_POWERS) ok(!D.CARDS[id].exhaust && !/exhaust/i.test(D.CARDS[id].desc.replace(/Whenever a card Exhausts/g, '')), id + ' has no Exhaust flag or wording (a Kindling-style "Whenever a card Exhausts" trigger is allowed)');
const POWERS = ALL_POWERS.filter(id => D.CARDS[id].effects.some(f => f.t === 'status'));
// wz9 (Anna 15:09): the starter Power arcane_focus is removed; Arcane Study is the only card that gives Arcane Focus.
ok(!D.CARDS.arcane_focus, 'arcane_focus card removed');
for (const id of POWERS) ok(!D.CARDS[id].exhaust && !/exhaust/i.test(D.CARDS[id].desc.replace(/Whenever a card Exhausts/g, '')), id + ' has no Exhaust flag or wording (a Kindling-style "Whenever a card Exhausts" trigger is allowed)');
const piles = p => [p.hand, p.draw, p.discard, p.exhaust];
for (const id of POWERS) for (const up of [false, true]) for (let seed = 1; seed <= 5; seed++) {
  const cls = D.CARDS[id].cls, s = E.newGame({ seed, heroes: [cls] }); const p = s.players[0];
  E.startEncounter(s, 'lone_goblin'); E.takeEvents(s);
  ok(Array.isArray(p.powers) && p.powers.length === 0, 'powers list empty at fight start');
  const c = { uid: 'tp' + seed + up, id, up }; p.hand.push(c); p.energy = 5;
  const def = E.cardDef(c), st = def.effects.find(f => f.t === 'status'), before = (p.statuses[st.status] || 0), hand0 = p.hand.length;
  const r = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid }); ok(r.ok, 'play ' + id + ' ' + r.error);
  const ev = E.takeEvents(s);
  ok(!piles(p).some(x => x.some(y => y.uid === c.uid)), id + ' not in hand/draw/discard/exhaust');
  ok(p.powers.length === 1 && p.powers[0].uid === c.uid, id + ' in player.powers');
  ok((p.statuses[st.status] || 0) === before + st.n, id + ` effect applied (${st.status} +${st.n})`);
  ok(ev.some(x => x.kind === 'powerPlayed' && x.card === id && x.source === p.uid), id + ' powerPlayed event');
  // survives turns and save/reload, never shuffled back
  let t = JSON.parse(JSON.stringify(s)); const q = t.players[0];
  for (let k = 0; k < 4 && t.phase === 'combat'; k++) { q.hp = q.maxHp; E.dispatch(t, { type: 'END_TURN', player: q.uid }); E.takeEvents(t); }
  if (t.phase === 'combat') { ok(q.powers.length === 1 && !piles(q).some(x => x.some(y => y.uid === c.uid)), id + ' stays out of the piles across turns and save/reload'); }
  ok(p.deck.filter(x => x.id === id).length === s.players[0].deck.filter(x => x.id === id).length, 'deck unchanged');
  // next fight: list cleared
  E.startEncounter(s, 'rat_swarm'); E.takeEvents(s);
  ok(p.powers.length === 0, id + ' powers cleared next fight');
}
// Wizard starter (wz9, Anna 15:09/15:19): no Arcane Focus card; its slot is the starter Fireball. The status shows as 'Arcane Focus'.
{ const s = E.newGame({ seed: 3, heroes: ['wizard'] }); const p = s.players[0];
  ok(!p.deck.some(c => c.id === 'arcane_focus'), 'Wizard starter: no Arcane Focus card');
  ok(D.STATUSES.arcane.name === 'Arcane Focus' && D.KEYWORDS['Arcane Focus'] === D.STATUSES.arcane.tip, 'status arcane is named Arcane Focus');
  const srcs = Object.keys(D.CARDS).filter(id => D.CARDS[id].effects.some(f => f.t === 'status' && f.status === 'arcane'));
  ok(srcs.join() === 'arcane_study', 'only Arcane Study gives Arcane Focus: ' + srcs.join()); }
console.log('powers ok (' + n + ' checks)');
