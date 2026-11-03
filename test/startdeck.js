// Starting decks (Anna 15:19): every hero starts with 10 cards, 8 starter basics (4 attack, 4 block) plus 2 unique cards.
// Action Surge (Anna 15:18): Fighter starter, 0 cost Skill, "Gain 1 Energy. Exhaust."; Action Surge+ drops Exhaust.
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
eq(D.HEROES.fighter.deck, ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'second_wind', 'action_surge'], 'Fighter deck');
eq(D.HEROES.barbarian.deck, ['greataxe', 'greataxe', 'greataxe', 'greataxe', 'parry', 'parry', 'parry', 'parry', 'rage', 'reckless_attack'], 'Barbarian deck');
eq(D.HEROES.wizard.deck, ['fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'shield_spell', 'shield_spell', 'shield_spell', 'shield_spell', 'magic_missile', 'fireball_starter'], 'Wizard deck');
for (const [h, H] of Object.entries(D.HEROES)) {
  const cnt = {}; H.deck.forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
  const basics = Object.keys(cnt).filter(id => cnt[id] === 4), uniq = Object.keys(cnt).filter(id => cnt[id] === 1);
  const isBlock = (id) => D.CARDS[id].effects.some(f => f.t === 'block');
  eq([H.deck.length, basics.length, uniq.length], [10, 2, 2], h + ': 10 cards, 2 basics x4, 2 unique x1');
  ok(basics.some(id => D.CARDS[id].type === 'attack') && basics.some(id => D.CARDS[id].type !== 'attack' && isBlock(id)), h + ': one attack basic and one block basic');
  ok(H.deck.every(id => D.CARDS[id] && D.CARDS[id].rarity === 'starter' && D.CARDS[id].cls === h), h + ': all starter cards of that hero');
  const s = E.newGame({ seed: 3, heroes: [h] }); eq(s.players[0].deck.length, 10, h + ': a new run starts with 10 cards');
}
const A = D.CARDS.action_surge, U = E.cardDef({ id: 'action_surge', up: true });
eq([A.cost, A.type, A.rarity, A.cls, !!A.exhaust, E.cardText(null, null, { id: 'action_surge' })], [0, 'skill', 'starter', 'fighter', true, 'Gain 1 Energy. Exhaust.'], 'Action Surge');
eq([U.name, U.cost, !!U.exhaust, E.cardText(null, null, { id: 'action_surge', up: true }), U.effects], ['Action Surge+', 0, false, 'Gain 1 Energy.', [{ t: 'energy', n: 1 }]], 'Action Surge+: same effect and cost, no Exhaust');
ok(Object.keys(D.CARDS).filter(id => D.CARDS[id].name === 'Action Surge').length === 1, 'one Action Surge entry');
for (const up of [false, true]) {
  const s = E.newGame({ seed: 5, heroes: ['fighter'] }); E.takeEvents(s); E.startEncounter(s, 'lone_goblin'); E.takeEvents(s); const p = s.players[0];
  const c = { uid: 'as' + up, id: 'action_surge', up }; p.hand.push(c); const e0 = p.energy;
  E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid }); E.takeEvents(s);
  eq([p.energy - e0, p.exhaust.includes(c), p.discard.includes(c)], [1, !up, up], (up ? 'Action Surge+' : 'Action Surge') + ': +1 Energy, ' + (up ? 'discarded' : 'Exhausts'));
}
{ const seen = new Set(); for (let seed = 1; seed <= 300; seed++) { const s = E.newGame({ seed, heroes: ['fighter'] }), p = s.players[0];
    for (const t of ['fight', 'elite', 'boss']) E.rollCardRewards(s, p, 4, t).forEach(id => seen.add(id)); }
  ok(!seen.has('action_surge') && seen.size > 10, 'Action Surge is never a card reward'); }
eq([D.ENCOUNTERS.owlbear.name, D.ENCOUNTERS.owlbear.scene], ['The Beast of Saint Brennick', 'The Bone Nest'], 'Beast encounter name and scene (Lorekeeper, events_merchant_v1 A)');
console.log(`startdeck ok (${n} checks)`);
