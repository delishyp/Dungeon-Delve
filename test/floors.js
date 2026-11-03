// Floor plan (Nov 3): below-half phases (Surgeon, Mimic, Watcher), Floor 2 moves (Grave Chill, Poisoned Bolt,
// Rip Apart, Cube's Acid), and Floor 1 skeleton/ghoul stats left alone.
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0, chops = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const atk = (id, mv) => D.MONSTERS[id].moves[mv].effects.find(f => f.t === 'attack');
const fight = (enc, seed, floor) => { const s = E.newGame({ seed, heroes: ['barbarian'] }); s.floor = floor; E.startEncounter(s, enc); E.takeEvents(s); return s; };
// hit an enemy with one Greataxe Chop (6 damage) from a fresh hand
function chop(s, e) {
  const p = s.players[0]; e.block = 0; p.energy = 9; const c = { uid: 'tchop' + (++chops), id: 'greataxe' }; p.hand.push(c);
  const r = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: e.uid }); ok(r.ok, 'chop ' + r.error);
  return E.takeEvents(s);
}

// ---------- phases ----------
for (let seed = 1; seed <= 40; seed++) {
  for (const id of ['mind_flayer', 'mimic', 'beholder']) {
    let s = fight(id, seed, 1); const ph = D.MONSTERS[id].phase; let e = s.enemies.find(x => x.monsterId === id);
    ok(ph && ph.at === 0.5, id + ' has a 50% phase');
    // a hit that leaves it above half: nothing
    e.hp = e.maxHp; let ev = chop(s, e);
    ok(!e.phased && !ev.some(x => x.kind === 'phase'), id + ' no phase above half');
    const might0 = e.statuses.might || 0;
    // drop it to half or lower with one hit
    e.hp = Math.floor(e.maxHp * 0.5) + 3; ev = chop(s, e);
    ok(e.hp <= e.maxHp * 0.5 && e.phased, id + ' phases at <=50% (' + e.hp + '/' + e.maxHp + ')');
    ok(ev.filter(x => x.kind === 'phase' && x.source === e.uid).length === 1, id + ' phase event once');
    const wantMight = (ph.status && ph.status.might) || 0;
    ok((e.statuses.might || 0) === might0 + wantMight, id + ` gains ${wantMight} Might`);
    // survives save/load, and never fires again
    s = JSON.parse(JSON.stringify(s)); e = s.enemies.find(x => x.monsterId === id);
    ok(e.phased, id + ' phased survives save/reload');
    e.hp = Math.max(5, Math.floor(e.maxHp * 0.3)); ev = chop(s, e);
    ok(!ev.some(x => x.kind === 'phase'), id + ' phase fires only once');
    ok((e.statuses.might || 0) === might0 + wantMight, id + ' no second Might');
    // overridden moves show in the intent and play that way
    if (id === 'mind_flayer') {
      e.intent = { move: 'incision', target: s.players[0].uid }; const i = E.describeIntent(s, e);
      ok(i.times === 2 && E.moveOf(e, 'incision').effects.find(f => f.t === 'attack').times === 2, 'Surgeon Incision hits twice after phase');
      ok(atk('mind_flayer', 'incision').times == null, 'base Incision data untouched');
    }
    if (id === 'beholder') {
      e.intent = { move: 'rays', target: s.players[0].uid }; const i = E.describeIntent(s, e);
      ok(i.times === 6 && i.damage != null, 'Watcher Rays 4x6 after phase');
      ok(atk('beholder', 'rays').times === 4, 'base Rays data untouched');
      const p = s.players[0]; p.hp = 9999; p.maxHp = 9999; p.block = 0;
      E.dispatch(s, { type: 'END_TURN', player: p.uid }); const hits = E.takeEvents(s).filter(x => x.kind === 'hit' && x.source === e.uid);
      ok(hits.length === 6, 'Rays actually hit 6 times (' + hits.length + ')');
    }
    if (id === 'mimic') {
      ok(!(e.intent.move === 'disguise'), 'Mimic intent is not Play Dead after phase');
      const p = s.players[0]; const moves = [];
      for (let t = 0; t < 8 && s.phase === 'combat'; t++) { p.hp = p.maxHp; moves.push(e.intent.move); E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s); }
      ok(moves.length >= 6 && !moves.includes('disguise'), 'Mimic drops Play Dead: ' + moves.join(','));
    }
  }
}
// a Mimic showing Play Dead when the phase fires switches at once
{
  const s = fight('mimic', 7, 1), e = s.enemies[0]; ok(e.intent.move === 'disguise', 'Mimic opens with Play Dead');
  e.hp = Math.floor(e.maxHp * 0.5) + 2; chop(s, e);
  ok(e.phased && e.intent.move !== 'disguise' && D.MONSTERS.mimic.phase.pattern.includes(e.intent.move), 'Play Dead intent replaced (' + e.intent.move + ')');
}
// enemies without a phase never phase
{ const s = fight('troll', 3, 1), e = s.enemies[0]; e.hp = 6; chop(s, e); ok(!e.phased, 'no phase data, no phase'); }

// ---------- Floor 2 moves ----------
for (let seed = 1; seed <= 30; seed++) {
  // Rip Apart: removes all Block, then hits
  { const s = fight('troll', seed, 1), p = s.players[0], e = s.enemies[0];
    e.intent = { move: 'rip', target: p.uid }; p.block = 25; p.hp = p.maxHp;
    const i = E.describeIntent(s, e); ok(i.stripBlock && i.damage != null, 'Rip Apart intent shows block strip + attack');
    E.dispatch(s, { type: 'END_TURN', player: p.uid }); const ev = E.takeEvents(s);
    const k = ev.findIndex(x => x.kind === 'stripBlock' && x.target === p.uid), h = ev.findIndex(x => x.kind === 'hit' && x.source === e.uid && x.target === p.uid);
    ok(k >= 0 && ev[k].amount === 25, 'Rip Apart strips all 25 Block');
    ok(h > k && ev[h].blocked === 0 && ev[h].amount > 0, 'then hits with no Block left');
    ok(D.MONSTERS.troll.startStatus.regen === 5 && D.MONSTERS.troll.ai.pattern.includes('rip'), 'Troll keeps Regen 5 and uses Rip Apart'); }
  // Cube Engulf: one Acid into the discard pile, gone after the fight
  { const s = fight('cube', seed, 1), p = s.players[0], e = s.enemies[0];
    e.intent = { move: 'engulf', target: p.uid }; p.hp = p.maxHp;
    const i = E.describeIntent(s, e); ok(i.cards === 1 && i.cardName === 'Acid' && i.cardsTo === 'discard' && i.statusDebuff, 'Engulf intent: Acid to discard + poison');
    const hand0 = p.hand.length; E.dispatch(s, { type: 'END_TURN', player: p.uid }); const ev = E.takeEvents(s);
    ok(ev.some(x => x.kind === 'addCards' && x.card === 'acid' && x.to === 'discard'), 'Acid added event');
    const all = [p.hand, p.draw, p.discard, p.exhaust].flat().filter(c => c.id === 'acid');
    ok(all.length === 1 && p.discard.some(c => c.id === 'acid'), 'exactly one Acid, in the discard pile');
    ok(!E.canPlay(s, p, all[0]) && D.CARDS.acid.combatOnly && D.CARDS.acid.name === 'Acid', 'Acid is unplayable combat-only junk');
    e.hp = 1; e.block = 0; chop(s, e); ok(s.phase !== 'combat', 'cube dies');
    ok(!p.deck.some(c => c.id === 'acid'), 'Acid never enters the deck'); }
  // Grave Chill: damage + 1 Frightened
  { const s = fight('ghouls', seed, 1), p = s.players[0], e = s.enemies[0]; s.enemies[1].intent = { move: 'bite', target: p.uid };
    e.intent = { move: 'chill', target: p.uid }; p.hp = p.maxHp; p.block = 0; delete p.statuses.frightened;
    E.dispatch(s, { type: 'END_TURN', player: p.uid }); const ev = E.takeEvents(s);
    ok(ev.some(x => x.kind === 'enemyAct' && x.source === e.uid && x.name === 'Grave Chill'), 'Grave Chill used');
    ok(ev.some(x => x.kind === 'status' && x.target === p.uid && x.status === 'frightened'), 'Grave Chill Frightens'); }
  // Poisoned Bolt: later-row drow only
  { const s = fight('drow_patrol', seed, 1), p = s.players[0], e = s.enemies.find(x => x.monsterId === 'drow');
    s.enemies.forEach(x => { if (x !== e) x.intent = { move: 'ward', target: p.uid }; });
    e.intent = { move: 'crossbow', target: p.uid }; p.hp = p.maxHp; delete p.statuses.poisoned;
    E.dispatch(s, { type: 'END_TURN', player: p.uid }); const ev = E.takeEvents(s);
    ok(ev.some(x => x.kind === 'status' && x.target === p.uid && x.status === 'poisoned' && x.amount === 3), 'Poisoned Bolt: 3 Poisoned'); }
}
ok(atk('ghoul', 'chill').n === 7 && D.MONSTERS.ghoul.moves.chill.effects.some(f => f.status === 'frightened' && f.n === 1), 'Grave Chill 7 + Frightened 1');
ok(atk('troll', 'rip').n === 8 && D.MONSTERS.troll.moves.rip.effects[0].t === 'stripBlock', 'Rip Apart: strip Block, then 8');
const poisons = id => Object.values(D.MONSTERS[id].moves).some(mv => mv.name === 'Poisoned Bolt' || mv.effects.some(f => f.status === 'poisoned'));
ok(poisons('drow') && !poisons('drow_early'), 'Poisoned Bolt on the later Drow only');
ok(D.FLOORS[1].hard.includes('drow_patrol') && !D.FLOORS[1].easy.includes('drow_patrol') && !D.FLOORS[0].easy.concat(D.FLOORS[0].hard).some(x => D.ENCOUNTERS[x].enemies.includes('drow')), 'the poisoning Drow is Floor 2 later rows only');

// ---------- Floor 1 stats unchanged vs 65a53f2 ----------
const stat = id => { const m = D.MONSTERS[id]; return m.hp.join('-') + ' ' + Object.entries(m.moves).map(([k, mv]) => k + ':' + mv.effects.filter(f => f.t === 'attack').map(f => f.n + (f.times ? 'x' + f.times : '')).join('+')).join(' '); };
ok(stat('skeleton') === '26-30 sword:5 rattle:3 bow:2x3', 'skeleton unchanged: ' + stat('skeleton'));
ok(stat('skeleton_altar') === '16-19 sword:6 rattle:3 bow:2x3', 'skeleton_altar unchanged: ' + stat('skeleton_altar'));
ok(stat('ghoul_altar') === '12-13 claw:6 bite:11', 'ghoul_altar unchanged: ' + stat('ghoul_altar'));
ok(D.ENCOUNTERS.altar_dead_f1.enemies.join() === 'skeleton_altar,skeleton_altar,ghoul_altar', 'F1 altar uses its own copies');
for (const enc of D.FLOORS[0].easy.concat(D.FLOORS[0].hard, D.FLOORS[0].elites, [D.FLOORS[0].boss, 'altar_dead_f1'])) for (const id of D.ENCOUNTERS[enc].enemies)
  ok(!D.MONSTERS[id].phase && !Object.values(D.MONSTERS[id].moves).some(mv => mv.effects.some(f => f.t === 'stripBlock' || f.card === 'acid')), 'no Floor 2 mechanics on Floor 1: ' + id);
console.log('floors ok (' + n + ' checks)');
