// Beast of Saint Brennick: Grand Slam timing, combat-only junk cards, shove-off, mid-fight save/reload.
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const junk = p => p.hand.filter(c => c.id === 'junk_broken_bone').length;
const total = p => [p.hand, p.draw, p.discard, p.exhaust].reduce((t, x) => t + x.filter(c => c.id === 'junk_broken_bone').length, 0);
for (const hero of Object.keys(D.HEROES)) {
  let s = E.newGame({ seed: 4242, heroes: [hero], floors: 1 });
  E.startEncounter(s, D.FLOORS[0].boss); E.takeEvents(s);
  let p = s.players[0]; const b = s.enemies[0];
  ok(b.monsterId === 'owlbear' && b.hp === 245, 'boss is the Beast at 245 HP (boss round Nov 3)');
  const seen = [];
  for (let t = 1; t <= 7; t++) {
    const i = E.describeIntent(s, s.enemies[0]); seen.push(s.enemies[0].intent.move);
    if (seen[t - 1] === 'slam') ok(i.damage === 20 && i.cards === 2 && i.cardName === 'Broken Bone', 'slam intent shows 20 dmg and 2 cards ' + JSON.stringify(i) + JSON.stringify(p.statuses));
    p.hp = p.maxHp; // keep the hero alive while we only end turns
    const r = E.dispatch(s, { type: 'END_TURN', player: p.uid }); ok(r.ok, 'end turn ' + r.error); E.takeEvents(s);
    if (t === 3) {
      ok(junk(p) === 2, `2 Broken Bone cards in hand after the slam (${junk(p)})`);
      // mid-fight save and reload (the UI saves the whole state as JSON)
      s = JSON.parse(JSON.stringify(s)); p = s.players[0];
      ok(junk(p) === 2, 'junk survives save/reload');
      ok(!E.canPlay(s, p, p.hand.find(c => c.id === 'junk_broken_bone')), 'junk is unplayable');
      // shove: one card that takes 6+ off her exhausts one junk
      const atk = p.hand.find(c => E.canPlay(s, p, c) && D.CARDS[c.id].effects.some(f => f.t === 'damage'));
      if (atk) {
        const before = s.enemies[0].hp + s.enemies[0].block; s.enemies[0].block = 0;
        const r2 = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: atk.uid, target: s.enemies[0].uid }); ok(r2.ok, 'play ' + r2.error);
        const ev = E.takeEvents(s); const lost = before - (s.enemies[0].hp + s.enemies[0].block);
        if (lost >= 6) ok(junk(p) === 1 && ev.some(e => e.kind === 'shove'), 'big hit shoves one off');
        else ok(junk(p) === 2, 'small hit does not shove');
      }
    }
  }
  ok(seen.join(',') === 'screech,rearup,slam,rend,beak,rearup,slam', 'cycle ' + seen.join(','));
  ok(total(p) >= 3, 'junk stays all fight');
  // win the fight: junk never reaches the deck
  s.enemies[0].hp = 1; s.enemies[0].block = 0; p.energy = 9;
  const atk = p.hand.find(c => E.canPlay(s, p, c) && D.CARDS[c.id].effects.some(f => /^damage/.test(f.t)));
  if (atk) { E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: atk.uid, target: s.enemies[0].uid }); E.takeEvents(s); }
  ok(!p.deck.some(c => D.CARDS[c.id].combatOnly), 'junk never enters the deck');
  console.log(`grandslam ok: ${hero} (${s.phase})`);
}
