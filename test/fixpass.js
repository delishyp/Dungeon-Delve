// Bug and UI fix pass (Nov 4): map trail per floor, elite once per run, event undertext, status renames, Worm, Surgeon AoE half.
global.window = global;
const D = require('../src/data.js'); require('../src/content.js');
const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL ' + m); process.exit(1); } };
// map trail: a new floor starts with nothing visited; old saves keep only the chain back from pos
{ const s = E.newGame({ seed: 11, heroes: ['fighter'] }); s.visited = ['0_1', '1_2']; s.visitedFloor = 0;
  ok(E.trimVisited(s).length === 2, 'same floor keeps trail');
  s.floor = 1; ok(E.trimVisited(s).length === 0 && s.visitedFloor === 1, 'new floor clears trail');
  const t = E.newGame({ seed: 12, heroes: ['fighter'] }); t.visited = ['9_9', 'x']; delete t.visitedFloor; t.pos = null;
  ok(E.trimVisited(t).length === 0, 'old save with no pos keeps nothing'); }
// elites: seen list exists, and a fought elite is not offered again on the same floor
{ const s = E.newGame({ seed: 13, heroes: ['fighter'] }); ok(Array.isArray(s.seenElites), 'seenElites on new game');
  const el = D.FLOORS[0].elites; for (const e of el) { s.seenElites.push((D.ENCOUNTERS[e] && D.ENCOUNTERS[e].sameAs) || e); }
  E.startFight(s, 5, 'elite'); ok(!el.includes(s.lastEnc) || D.FLOORS[0].hard.includes(s.lastEnc), 'no unseen elite falls back to a hard fight'); }
// status names
ok(D.STATUSES.prone.name === 'Vulnerable', 'Prone shows as Vulnerable');
ok(D.STATUSES.chilled && D.CARDS.ray_of_frost && D.CARDS.ray_of_frost.effects.some(f => f.status === 'chilled'), 'Ray of Frost applies Chilled');
for (const id in D.CARDS) { const c = D.CARDS[id]; ok(!/\bProne\b/.test((c.desc || '') + ((c.upgrade && c.upgrade.desc) || '')), 'no Prone in card text: ' + id); }
ok(D.MONSTERS.toll.guardStatus === 'held_up' && D.MONSTERS.mind_flayer.guardedAoeMult === 0.5, 'guard chips and Surgeon half');
ok(D.RELICS.illithid_tadpole.heroEffects.fighter[0].status === 'might', 'Worm gives the Fighter Might');
// event undertext
const s = E.newGame({ seed: 14, heroes: ['fighter'] }), p = s.players[0];
const line = (id, i) => { const u = E.choiceUnder(s, p, id, i); const f = (ps, j0) => ps.map((x, j) => x.lead + x.phrase + x.tail).join(', ');
  return u.req || [u.parts.map(x => x.lead + x.phrase + x.tail + '.').join(' '), ...u.chance.map(b => b.pct + '%: ' + f(b.parts) + '.')].filter(Boolean).join(' '); };
ok(line('forgotten_library', 0) === 'Take 7 damage. Choose 1 of 3 rare cards.', 'library read: ' + line('forgotten_library', 0));
ok(line('forgotten_library', 1) === 'Upgrade a card.' && line('forgotten_library', 2) === 'Remove a card.' && line('forgotten_library', 3) === '', 'library others');
ok(line('trapped_chest', 0) === '60%: Gain a random relic. 40%: Take 10 damage, Gain 25 gold.', 'chest gamble: ' + line('trapped_chest', 0));
ok(line('myconid_circle', 1) === '50%: Take 7 damage. 50%: Gain 8 Max HP.', 'tie puts the costly branch first');
ok(line('wishing_well', 2) === '70%: Heal 15. 30%: Add a curse: Mummy Rot.', 'well drink');
p.gold = 0; ok(line('lost_adventurer', 0) === 'Needs 25 gold.', 'requirement shows when unmet');
let total = 0; for (const id in D.EVENTS) D.EVENTS[id].choices.forEach((c, i) => { total++; E.choiceUnder(s, p, id, i); });
ok(total >= 50, 'every event choice has an undertext entry (' + total + ')');
console.log('fixpass ok (' + n + ' checks)');
