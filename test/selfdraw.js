// A played card goes to its pile only after its effects and the on-play triggers resolve (Producer 19:27), so a card that draws
// (Wait for It) or a 0-cost card under No Wasted Motion can never reshuffle itself and draw itself straight back.
global.window = global; const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
function setup(nwm) {
  const s = E.newGame({ seed: 3, heroes: ['fighter'] }); E.startEncounter(s, 'rat_swarm'); E.takeEvents(s); const p = s.players[0]; p.energy = 9;
  if (nwm) { p.hand = [{ id: 'no_wasted_motion', uid: 'nw' }]; ok(E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'nw' }).ok, 'No Wasted Motion played'); }
  return { s, p };
}
for (const nwm of [false, true]) for (const id of ['wait_for_it', 'hilt_to_the_teeth', 'precision_attack', 'rally']) {
  const { s, p } = setup(nwm), tag = `${id}${nwm ? ' under No Wasted Motion' : ''}`;
  p.hand = [{ id, uid: 'X' }]; p.draw = []; p.discard = []; p.energy = 9;
  const n0 = (p.turnFx && p.turnFx.played) || 0;
  ok(E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'X', target: s.enemies[0].uid }).ok, tag + ': plays');
  ok(!p.hand.some(c => c.uid === 'X'), tag + ': with empty draw and discard piles it does not draw itself back');
  ok(p.discard.length === 1 && p.discard[0].uid === 'X', tag + ': it ends in the discard pile');
  ok(p.turnFx.played === n0 + 1, tag + ': one play counted');
  ok(!E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'X', target: s.enemies[0].uid }).ok, tag + ': cannot be replayed');
}
{ // with cards to draw, the draws still happen: Wait for It draws its 2, No Wasted Motion adds 1
  const { s, p } = setup(true); p.hand = [{ id: 'wait_for_it', uid: 'W' }]; p.discard = []; p.draw = [1, 2, 3, 4].map(i => ({ id: 'strike', uid: 'd' + i }));
  E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'W' });
  ok(p.hand.length === 3 && p.draw.length === 1 && p.discard.map(c => c.uid).join() === 'W', 'Wait for It + No Wasted Motion: 3 drawn, Wait for It in the discard pile');
}
{ // a reshuffle mid-play shuffles in only what was already in the discard pile
  const { s, p } = setup(true); p.hand = [{ id: 'hilt_to_the_teeth', uid: 'H' }]; p.draw = []; p.discard = [{ id: 'strike', uid: 'old' }];
  E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'H', target: s.enemies[0].uid });
  ok(p.hand.map(c => c.uid).join() === 'old' && p.discard.map(c => c.uid).join() === 'H', 'No Wasted Motion reshuffle draws the old discard, not the card just played');
}
{ // Exhaust cards still exhaust after their play
  const { s, p } = setup(false); p.hand = [{ id: 'echo', uid: 'EC' }]; p.energy = 3;
  ok(E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'EC' }).ok && p.exhaust.some(c => c.uid === 'EC') && !p.discard.some(c => c.uid === 'EC'), 'an Exhaust card (Echo) goes to the exhaust pile');
}
console.log(`selfdraw ok (${n} checks)`);
