// Old saves (Tester, wz9): a save holding a removed card id (arcane_focus) or an unknown relic id loads without throwing,
// and those entries are dropped (ui.js loadSave -> Engine.sanitizeState). The save version stays 3.
const fs = require('fs'), path = require('path');
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL ' + m); process.exit(1); } };
const s = E.newGame({ seed: 11, heroes: ['wizard'] }); E.takeEvents(s); const p = s.players[0];
E.startEncounter(s, 'lone_goblin'); E.takeEvents(s);
p.deck.push({ uid: 'old1', id: 'arcane_focus' }); p.hand.push({ uid: 'old2', id: 'arcane_focus' }); p.draw.push({ uid: 'old3', id: 'arcane_focus' });
p.discard.push({ uid: 'old4', id: 'arcane_focus' }); p.powers.push({ uid: 'old5', id: 'arcane_focus' });
p.relics.push('no_such_relic'); p.reward = { gold: 0, relic: 'no_such_relic', cards: ['arcane_focus', 'fire_bolt'], done: false };
s.shop = { cards: [{ id: 'arcane_focus', price: 50, sold: false }, { id: 'burning_hands', price: 50, sold: false }], relics: [{ id: 'no_such_relic', price: 150, sold: false }], potions: [] };
const save = JSON.parse(JSON.stringify({ G: { ...s, events: [] }, me: p.uid, savedAt: 1 }));
ok(save.G.version === 3, 'save version 3');
let gone; try { gone = E.sanitizeState(save.G); } catch (e) { ok(false, 'sanitizeState threw: ' + e.message); }
const q = save.G.players[0], all = ['deck', 'hand', 'draw', 'discard', 'exhaust', 'powers'].flatMap(k => q[k]);
ok(!all.some(c => c.id === 'arcane_focus') && all.every(c => D.CARDS[c.id]), 'no arcane_focus left in deck or piles');
ok(q.deck.length === p.deck.length - 1 && q.hand.length === p.hand.length - 1, 'only the old entries were dropped');
ok(!q.relics.includes('no_such_relic') && q.relics.every(r => D.RELICS[r]), 'unknown relic dropped');
ok(q.reward.cards.join() === 'fire_bolt' && q.reward.relic === null, 'reward cleaned');
ok(save.G.shop.cards.map(c => c.id).join() === 'burning_hands' && save.G.shop.relics.length === 0, 'shop cleaned');
ok(gone.filter(x => x === 'arcane_focus').length === 7 && gone.filter(x => x === 'no_such_relic').length === 3, 'dropped ids reported: ' + gone.join());
ok(save.G.version === 3, 'save version unchanged');
// the cleaned run keeps going: render text for every card, play the turn out
for (const c of all) E.cardText(save.G, q, c, null);
const r = E.dispatch(save.G, { type: 'END_TURN', player: q.uid }); ok(r.ok, 'END_TURN after load: ' + r.error);
// loadSave runs it and warns once
const ui = fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8');
ok(/function loadSave\(\)[\s\S]{0,400}E\.sanitizeState\(d\.G\)[\s\S]{0,200}console\.warn\(/.test(ui), 'ui.js loadSave sanitizes and warns');
// a clean save drops nothing
ok(E.sanitizeState(JSON.parse(JSON.stringify(E.newGame({ seed: 2, heroes: ['wizard'] })))).length === 0, 'clean save: nothing dropped');
console.log('oldsave ok (' + n + ' checks)');
