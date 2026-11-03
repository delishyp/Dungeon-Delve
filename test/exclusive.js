// Hero-only mechanics (Anna, Nov 3 2026): Rage is Barbarian-only, Arcane is Wizard-only.
// Checks that no other hero can gain them through cards, relics, potions, events or the shop.
// Run: node test/exclusive.js (part of npm test; exit 1 on any failure; lists every failure). From Tester's qa_exclusive.js.
// EXPECTED FAILURE (xfail): the Worm Behind the Eye (relic illithid_tadpole) gives non-Wizards Arcane, pending Anna's call
// (DECISIONS). Only those exact checks are xfail: they print XFAIL (or XPASS if they start passing) and never fail the run.
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
const OWN = { rage: 'barbarian', arcane: 'wizard' };
const HEROES = Object.keys(D.HEROES); const fails = []; let n = 0, xfail = 0, xpass = 0;
const ok = (c, m) => { n++; if (!c) fails.push(m); };
// the Worm: relic illithid_tadpole granting arcane to a non-Wizard
const WORM = 'illithid_tadpole', isWorm = (kind, id, st) => kind === 'relic' && id === WORM && st === 'arcane';
const okX = (xf, c, m) => { if (!xf) return ok(c, m); n++; if (c) { xpass++; console.log('XPASS worm: ' + m + ' (pending Anna\'s call, DECISIONS)'); } else { xfail++; console.log('XFAIL worm: ' + m + ' (pending Anna\'s call, DECISIONS)'); } };
// Does a data object grant one of the hero-only statuses to its user?
function grants(o, out = new Set()) {
  if (!o || typeof o !== 'object') return out;
  if (Array.isArray(o)) { o.forEach(x => grants(x, out)); return out; }
  if (o.t === 'status' && OWN[o.status] && !['target', 'all', 'enemy', 'enemies'].includes(o.to)) out.add(o.status);
  for (const [k, v] of Object.entries(o)) {
    if (k === 'desc' || k === 'name') continue;
    if (k === 'ragePerUnblocked') out.add('rage');
    if ((k === 'rage' || k === 'arcane') && typeof v === 'number') out.add(k);   // power hooks like { onHpLossEnemyTurn: { rage: 1 } }
    grants(v, out);
  }
  return out;
}
// 1. Cards: any card that grants X must belong to X's owner (reward and shop card pools are filtered by cls).
for (const [id, c] of Object.entries(D.CARDS)) for (const st of grants(c))
  ok(c.cls === OWN[st], `card ${id} (cls ${c.cls}) grants ${st}, which is ${OWN[st]}-only`);
// 2. Relics and potions are shared by every hero, so none may grant X unless it is restricted to the owner.
for (const [kind, tbl] of [['relic', D.RELICS], ['potion', D.POTIONS]]) for (const [id, r] of Object.entries(tbl)) for (const st of grants(r))
  okX(isWorm(kind, id, st), r.cls === OWN[st], `${kind} ${id} ("${r.name}") grants ${st} to any hero, but ${st} is ${OWN[st]}-only`);
// 3. Events: any card, relic or potion an event hands out is covered above; also catch a direct status op.
for (const [id, ev] of Object.entries(D.EVENTS)) for (const st of grants(ev))
  ok(false, `event ${id} grants ${st} directly to any hero`);
// 4. In play: every relic and potion on every non-owner hero, then check the hero's statuses at fight start and after a turn.
for (const hero of HEROES) for (const [kind, tbl] of [['relic', D.RELICS], ['potion', D.POTIONS]]) for (const id of Object.keys(tbl)) {
  const s = E.newGame({ seed: 7, heroes: [hero] }), p = s.players[0];
  if (kind === 'relic') (p.relics = p.relics || []).push(id); else p.potions = [id];
  E.startEncounter(s, 'lone_goblin'); E.takeEvents(s);
  if (kind === 'potion') { const r = E.dispatch(s, { type: 'USE_POTION', player: p.uid, index: 0, slot: 0 }); E.takeEvents(s); }
  E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s);
  for (const st of Object.keys(OWN)) if (OWN[st] !== hero) okX(isWorm(kind, id, st), !(p.statuses && p.statuses[st]), `${hero} with ${kind} ${id} has ${st} ${p.statuses[st]} in a fight`);
}
// 5. Starter decks.
for (const hero of HEROES) for (const cid of D.HEROES[hero].deck) for (const st of grants(D.CARDS[cid]))
  ok(OWN[st] === hero, `${hero} starter card ${cid} grants ${st}`);
if (fails.length) { console.error('HERO-ONLY FAIL (' + fails.length + '/' + n + ')\n  ' + [...new Set(fails)].join('\n  ')); process.exit(1); }
console.log('hero-only ok (' + n + ' checks: ' + (n - xfail - xpass) + ' pass, ' + xfail + ' xfail, ' + xpass + ' xpass)');
