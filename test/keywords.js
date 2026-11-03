// Base keyword engine (Anna 11:33, Producer 11:34/11:35/11:41/11:56, DECISIONS 12:19): Repeat X, Replay, Vanish, Eternal,
// the Retain + Vanish data check, and the keyword lines + tooltips on the card face. Everything runs through the real engine
// (dispatch) and, for the card face and removal grids, the real page in headless Chrome. No shipped card has these keywords
// yet, so the cards here are test-only defs added to GameData.CARDS in this process.
const path = require('path'), fs = require('fs');
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

// ---- test cards ----
const atk = (extra) => Object.assign({ cls: 'barbarian', name: 'KW Test', cost: 0, type: 'attack', rarity: 'common', target: 'enemy', desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 4 }] }, extra);
const blk = (extra) => Object.assign({ cls: 'barbarian', name: 'KW Guard', cost: 0, type: 'skill', rarity: 'common', target: 'none', desc: 'Gain {0} Block.', effects: [{ t: 'block', n: 5 }] }, extra);
Object.assign(D.CARDS, {
  kw_plain: atk({}), kw_rep2: atk({ repeat: 2 }), kw_rep3: atk({ repeat: 3 }), kw_replay: atk({ replay: true }),
  kw_replay_rep3: atk({ replay: true, repeat: 3 }), kw_replay_exh: atk({ replay: true, exhaust: true, desc: 'Deal {0} damage. Exhaust.' }),
  kw_replay_van: atk({ replay: true, vanish: true }), kw_van: blk({ vanish: true }), kw_van_eternal: blk({ vanish: true, eternal: true }),
  kw_eternal: blk({ eternal: true }), kw_eternal_curse: { cls: 'curse', name: 'KW Eternal Curse', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true, eternal: true, desc: 'Unplayable.', effects: [] },
  kw_block_rep2_replay: blk({ repeat: 2, replay: true }),
});
D.checkKeywordData(D.CARDS);   // the test cards themselves are legal

const fight = (enc = 'lone_goblin', seed = 11) => {
  const s = E.newGame({ seed, heroes: ['barbarian'] }), p = s.players[0]; E.startEncounter(s, enc); E.takeEvents(s);
  p.energy = 99; p.hand = []; p.statuses = {}; s.enemies.forEach(e => { e.hp = e.maxHp = 500; e.block = 0; e.statuses = {}; });
  return { s, p };
};
let u = 0;
const give = (p, id, up) => { const c = { uid: 'kw' + (u++), id, up: !!up }; p.hand.push(c); return c; };
const play = (s, p, c, t) => { const r = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: t && t.uid }); const ev = E.takeEvents(s); return { r, ev }; };
const hpOf = (s) => s.enemies.reduce((a, e) => a + e.hp, 0);
const where = (p, c) => ['hand', 'draw', 'discard', 'exhaust', 'powers'].filter(k => (p[k] || []).includes(c));

// ---- Repeat X: X plays of the effect in total, inside ONE play ----
{ const { s, p } = fight(), e = s.enemies[0], h = hpOf(s); const c = give(p, 'kw_plain'); play(s, p, c, e); eq(h - hpOf(s), 4, 'plain card deals 4 (baseline)'); }
for (const [id, x] of [['kw_rep2', 2], ['kw_rep3', 3]]) {
  const { s, p } = fight(), e = s.enemies[0], h = hpOf(s), c = give(p, id); const { r, ev } = play(s, p, c, e);
  ok(r.ok, id + ' plays'); eq(h - hpOf(s), 4 * x, `Repeat ${x}: 4 damage ${x} times`);
  eq(ev.filter(x => x.kind === 'cardPlayed').length, 1, `Repeat ${x} is one play (one cardPlayed)`);
  eq(ev.filter(x => x.kind === 'cardReplayed').length, 0, `Repeat ${x} is not a Replay`);
  eq(c.fightPlays, 1, `Repeat ${x} counts as ONE play for Fading`); eq(where(p, c), ['discard'], `Repeat ${x} card goes to discard`);
  eq(E.repeatOf(D.CARDS[id]), x, `repeatOf(${id})`); eq(E.playsOf(D.CARDS[id]), 1, `playsOf(${id})`);
}
{ const { s, p } = fight(), e = s.enemies[0], h = hpOf(s), c = give(p, 'kw_rep3', true); play(s, p, c, e);
  eq(h - hpOf(s), 7 * 3, 'upgraded Repeat 3 keeps Repeat (7 x 3)'); }

// ---- Replay: a second play ----
{ const { s, p } = fight(), e = s.enemies[0], h = hpOf(s), c = give(p, 'kw_replay'); const { r, ev } = play(s, p, c, e);
  ok(r.ok, 'Replay card plays'); eq(h - hpOf(s), 8, 'Replay: 4 damage played twice');
  eq(ev.filter(x => x.kind === 'cardReplayed').length, 1, 'Replay emits one cardReplayed');
  eq(c.fightPlays, 2, 'Replay counts as a second play for Fading'); eq(where(p, c), ['discard'], 'Replay card is discarded once');
  eq(p.discard.filter(x => x === c).length, 1, 'only one copy in discard'); eq(E.playsOf(D.CARDS.kw_replay), 2, 'playsOf Replay = 2'); }
{ const { s, p } = fight(), e = s.enemies[0], h = hpOf(s), c = give(p, 'kw_replay_rep3'); play(s, p, c, e);
  eq(h - hpOf(s), 4 * 6, 'Replay + Repeat 3 = 6 effects (2 x X, Producer 11:34)'); eq(c.fightPlays, 2, 'Replay + Repeat 3 is two plays'); }
{ const { s, p } = fight(), c = give(p, 'kw_block_rep2_replay'); play(s, p, c, null); eq(p.block, 5 * 4, 'non-attack: Block Repeat 2 + Replay = 4 x 5 Block'); }
{ const { s, p } = fight(), e = s.enemies[0]; p.energy = 1; const c = give(p, 'kw_replay'); D.CARDS.kw_replay.cost = 1; play(s, p, c, e); D.CARDS.kw_replay.cost = 0;
  eq(p.energy, 0, 'Replay does not pay the cost twice'); }
// Replay + Exhaust: plays twice, then exhausts once
{ const { s, p } = fight(), e = s.enemies[0], h = hpOf(s), c = give(p, 'kw_replay_exh'); play(s, p, c, e);
  eq(h - hpOf(s), 8, 'Replay + Exhaust plays twice'); eq(where(p, c), ['exhaust'], 'Replay + Exhaust: exhausted, not discarded');
  eq(p.exhaust.filter(x => x === c).length, 1, 'Replay + Exhaust exhausts ONCE'); eq(c.fightPlays, 2, 'Replay + Exhaust counts two plays'); }
// Replay + Vanish (played): plays twice; Vanish only fires on an unplayed card at turn end, so it is discarded once
{ const { s, p } = fight(), e = s.enemies[0], h = hpOf(s), c = give(p, 'kw_replay_van'); play(s, p, c, e);
  eq(h - hpOf(s), 8, 'Replay + Vanish plays twice'); eq(where(p, c), ['discard'], 'played Replay + Vanish card: discarded once (Vanish is for unplayed cards)');
  eq(c.fightPlays, 2, 'Replay + Vanish counts two plays'); }
// Replay + Vanish (not played): vanishes once at turn end
{ const { s, p } = fight(), c = give(p, 'kw_replay_van'); E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s);
  eq(where(p, c), ['exhaust'], 'unplayed Replay + Vanish card vanishes once'); }
// Replay on a target that died: goes to the next enemy left; no enemies left: the second play is skipped
{ const { s, p } = fight('goblin_pack'), [a, b] = s.enemies; a.hp = 3; const bh = b.hp, c = give(p, 'kw_replay'); const { ev } = play(s, p, c, a);
  ok(a.hp <= 0, 'first play kills its target'); eq(bh - b.hp, 4, 'the Replay hits the first enemy left'); eq(ev.find(x => x.kind === 'cardReplayed').target, b.uid, 'cardReplayed names the new target'); }
{ const { s, p } = fight(); s.enemies[0].hp = 3; const c = give(p, 'kw_replay'); const { ev } = play(s, p, c, s.enemies[0]);
  eq(ev.filter(x => x.kind === 'cardReplayed').length, 0, 'no Replay once the fight is won'); eq(c.fightPlays, 1, 'only one play counted'); ok(s.phase === 'reward', 'fight ends normally'); }

// ---- Vanish: unplayed at turn end = removed for the rest of the fight (Anna 11:33) ----
{ const { s, p } = fight(), deckCard = { uid: 'kwdeck', id: 'kw_van' }; p.deck.push(deckCard);
  const c = give(p, 'kw_van'), keep = give(p, 'kw_plain'); E.dispatch(s, { type: 'END_TURN', player: p.uid }); const ev = E.takeEvents(s);
  eq(where(p, c), ['exhaust'], 'unplayed Vanish card is removed (exhaust pile) at turn end'); ok(!where(p, keep).includes('exhaust'), 'a plain card in hand is discarded, not removed');
  eq(ev.filter(x => x.kind === 'vanish').length, 1, 'one vanish event'); ok(p.deck.includes(deckCard), 'Vanish is for the fight only: the deck still has the card');
  // it stays gone for the rest of the fight (no reshuffle brings it back)
  for (let i = 0; i < 4 && s.phase === 'combat'; i++) { p.hp = p.maxHp; E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s); ok(!p.hand.includes(c) && !p.draw.includes(c) && !p.discard.includes(c), 'vanished card never comes back this fight (turn ' + i + ')'); }
  // next fight it is dealt again
  E.startEncounter(s, 'lone_goblin'); E.takeEvents(s); ok(p.draw.concat(p.hand).some(x => x.uid === 'kwdeck'), 'next fight the Vanish card is back'); }
{ const { s, p } = fight(), c = give(p, 'kw_van'); play(s, p, c, null); eq(where(p, c), ['discard'], 'a played Vanish card is discarded as normal'); eq(p.block, 5, 'and its effect happened'); }
{ const { s, p } = fight(), c = give(p, 'kw_van', true); E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s); eq(where(p, c), ['exhaust'], 'upgraded Vanish card keeps Vanish'); }
// Eternal blocks Vanish
{ const { s, p } = fight(), c = give(p, 'kw_van_eternal'); E.dispatch(s, { type: 'END_TURN', player: p.uid }); const ev = E.takeEvents(s);
  ok(!where(p, c).includes('exhaust'), 'Eternal + Vanish: the card is not removed'); eq(ev.filter(x => x.kind === 'vanish').length, 0, 'no vanish event for an Eternal card'); }

// ---- Eternal vs every removal path ----
const game = () => { const s = E.newGame({ seed: 7, heroes: ['barbarian'] }); E.takeEvents(s); return s; };
const findChoice = (pred) => { for (const [id, ev] of Object.entries(D.EVENTS)) for (let i = 0; i < ev.choices.length; i++) { const ch = ev.choices[i]; if (ch.ops && pred(ch.ops) && !ch.req) return { id, i }; } return null; };
const runEvent = (s, f) => { s.phase = 'event'; s.event = { id: f.id, stage: 'choose', result: null, next: null, pick: null, log: [] };
  ok(E.dispatch(s, { type: 'EVENT_CHOICE', player: s.players[0].uid, choice: f.i }).ok, 'event choice ' + f.id); E.takeEvents(s); };
// shop removal service
{ const s = game(), p = s.players[0]; p.gold = 999; const f = findChoice(o => o.shop); ok(f, 'an event that opens a shop');
  runEvent(s, f); if (s.phase === 'event') E.dispatch(s, { type: 'EVENT_CONTINUE', player: p.uid }); ok(s.phase === 'shop', 'shop open');
  const c = { uid: 'et1', id: 'kw_eternal' }; p.deck.push(c); const gold = p.gold, size = p.deck.length;
  const r = E.dispatch(s, { type: 'SHOP_REMOVE', player: p.uid, card: c.uid });
  ok(!r.ok && /Eternal/.test(r.error), 'shop removal refuses an Eternal card: ' + r.error); eq([p.gold, p.deck.length, s.shop.removed, p.removes], [gold, size, false, 0], 'no gold spent, deck unchanged, service still unused');
  const other = p.deck.find(x => !E.isEternal(x)); ok(E.dispatch(s, { type: 'SHOP_REMOVE', player: p.uid, card: other.uid }).ok, 'the service still removes a normal card'); ok(p.deck.includes(c), 'Eternal card still in deck'); }
// event "remove a card" pick
{ const s = game(), p = s.players[0]; const f = findChoice(o => o.then === 'remove'); ok(f, 'an event with a remove-a-card pick');
  const c = { uid: 'et2', id: 'kw_eternal' }; p.deck.push(c); runEvent(s, f); E.dispatch(s, { type: 'EVENT_CONTINUE', player: p.uid });
  ok(s.event && s.event.stage === 'pick' && s.event.pick === 'remove', 'remove pick open');
  const r = E.dispatch(s, { type: 'EVENT_PICK', player: p.uid, card: c.uid }); ok(!r.ok && p.deck.includes(c), 'event removal refuses an Eternal card');
  ok(s.phase === 'event' && s.event.stage === 'pick', 'the pick stays open for another card'); }
// a deck of only Eternal cards: the remove pick is skipped (nothing to offer)
{ const s = game(), p = s.players[0]; p.deck = [{ uid: 'et3', id: 'kw_eternal' }, { uid: 'et4', id: 'kw_eternal' }]; const f = findChoice(o => o.then === 'remove');
  runEvent(s, f); E.dispatch(s, { type: 'EVENT_CONTINUE', player: p.uid }); ok(!(s.event && s.event.stage === 'pick'), 'no remove pick when every card is Eternal'); eq(p.deck.length, 2, 'deck unchanged'); }
// "remove all curses" (the Silver Spring)
{ const s = game(), p = s.players[0]; const f = findChoice(o => o.removeCurses); ok(f, 'an event that removes all curses');
  p.deck.push({ uid: 'et5', id: 'kw_eternal_curse' }, { uid: 'cr1', id: 'curse_regret' }, { uid: 'cr2', id: 'curse_hex' });
  ok(/Remove all 2 curses/.test(JSON.stringify(E.describeChoice(s, p, f.id, f.i).fixed)), 'Dev mode preview counts only the 2 removable curses');
  runEvent(s, f); ok(p.deck.some(x => x.uid === 'et5'), 'Eternal curse survives "remove all curses"'); ok(!p.deck.some(x => x.uid === 'cr1' || x.uid === 'cr2'), 'the normal curses are removed'); }
{ const s = game(), p = s.players[0]; const f = findChoice(o => o.removeCurses); p.deck.push({ uid: 'et6', id: 'kw_eternal_curse' });
  runEvent(s, f); ok(s.event.next && s.event.next.then === 'remove', 'only Eternal curses: counts as no curses, falls back to the remove pick'); ok(p.deck.some(x => x.uid === 'et6'), 'Eternal curse kept'); }
// transforms and any other remove-a-card effect go through the same guard
{ const s = game(), p = s.players[0], c = { uid: 'et7', id: 'kw_eternal' }, n0 = { uid: 'pl1', id: 'kw_plain' }; p.deck.push(c, n0);
  ok(!E.transformCard(s, p, c, 'kw_plain') && p.deck.includes(c), 'transform refuses an Eternal card'); ok(E.transformCard(s, p, n0, 'kw_rep2') && !p.deck.includes(n0) && p.deck.some(x => x.id === 'kw_rep2'), 'transform works on a normal card');
  ok(!E.removeFromDeck(s, p, c) && p.deck.includes(c), 'removeFromDeck refuses an Eternal card'); ok(!E.canRemove(c) && !E.canTransform(c) && E.isEternal(c), 'canRemove / canTransform false for Eternal');
  ok(E.canRemove({ id: 'strike' }) && !E.isEternal({ id: 'strike' }), 'normal cards are removable'); }
// Eternal cards can still be upgraded
{ const s = game(), p = s.players[0], c = { uid: 'et8', id: 'kw_eternal' }; p.deck.push(c); s.phase = 'rest'; ok(E.canUpgrade(c), 'Eternal card can be upgraded');
  ok(E.dispatch(s, { type: 'REST', player: p.uid, choice: 'upgrade', card: c.uid }).ok && c.up, 'rest-site upgrade works on an Eternal card'); ok(E.isEternal(c) && E.cardDef(c).eternal, 'upgraded card is still Eternal'); }

// ---- data check: Retain and Vanish never on the same card ----
const throws = (f) => { try { f(); return null; } catch (e) { return e.message; } };
ok(D.checkKeywordData(D.CARDS) === true, 'every shipped card passes the keyword data check');
ok(/kw_bad: has both retain and vanish/.test(throws(() => D.checkKeywordData({ kw_bad: { retain: true, vanish: true, effects: [] } })) || ''), 'retain + vanish fails loudly');
ok(/kw_bad2: has both retain and vanish/.test(throws(() => D.checkKeywordData({ kw_bad2: { retain: true, effects: [], upgrade: { vanish: true } } })) || ''), 'retain + vanish via the upgrade fails too');
ok(/repeat must be/.test(throws(() => D.checkKeywordData({ kw_bad3: { repeat: 1, effects: [] } })) || ''), 'Repeat 1 is rejected');
ok(/repeat must be/.test(throws(() => D.checkKeywordData({ kw_bad4: { repeat: 2.5, effects: [] } })) || ''), 'Repeat 2.5 is rejected');
ok(/must be true or false/.test(throws(() => D.checkKeywordData({ kw_bad5: { eternal: 'yes', effects: [] } })) || ''), 'non-boolean flag is rejected');
// and the check runs when content.js loads (a bad card stops the game and every test)
{ const src = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8'); ok(/\n  G\.checkKeywordData\(G\.CARDS\);\n/.test(src), 'content.js runs the check on load'); }
{ const cp = require('child_process'); const r = cp.spawnSync(process.execPath, ['-e', `const D=require(${JSON.stringify(path.join(__dirname, '../src/data.js'))}); D.CARDS.strike.vanish=true; D.CARDS.strike.retain=true; require(${JSON.stringify(path.join(__dirname, '../src/content.js'))});`], { encoding: 'utf8' });
  ok(r.status !== 0 && /strike: has both retain and vanish/.test(r.stderr), 'loading the game data with a retain + vanish card exits non-zero'); }

// ---- keyword lines + tooltips (data) ----
eq(D.keywordLines({ kind: 'spell', vanish: true, repeat: 3, replay: true, eternal: true }), ['Spell', 'Vanish', 'Repeat 3', 'Replay', 'Eternal'], 'keyword line order (How to Play order)');
eq(D.keywordLines({ kind: 'spell', retain: true, eternal: true }), ['Spell', 'Retain', 'Eternal'], 'Retain then Eternal');
eq(D.keywordLines({ repeat: 2 }), ['Repeat 2'], 'Repeat line carries X'); eq(D.keywordLines({ exhaust: true }), [], 'Exhaust stays in the effect text, no extra line');
const TIPS = {   // lore/text/how_to_play_v1.md section 3 (Lorekeeper), word for word
  Vanish: "Vanish: if you don't play the card this turn and it would be discarded at the end of your turn, it's removed for the rest of the fight instead.",
  Repeat: 'Repeat X: the card\'s effect happens X times. "Deal 4 damage. Repeat 3." deals 12 in total.',
  Replay: "Replay: the card is played one more time. A card with Replay and Repeat 3 does its effect 6 times. If it also has Exhaust or Vanish, it's played both times before it's removed.",
  Eternal: "Eternal: the card can never be removed from your deck, in any way. Shops, events, the Silver Spring and card effects can't take it, though you can still upgrade it.",
};
for (const k in TIPS) eq(D.KEYWORDS[k], TIPS[k], k + ' tooltip wording');
{ const htp = path.join(__dirname, '../lore/text/how_to_play_v1.md');
  if (fs.existsSync(htp)) { const t = fs.readFileSync(htp, 'utf8');
    for (const k in TIPS) { const m = t.match(new RegExp('^- \\*\\*' + (k === 'Repeat' ? 'Repeat X' : k) + ':\\*\\* (.*)$', 'm')); ok(m && TIPS[k] === (k === 'Repeat' ? 'Repeat X' : k) + ': ' + m[1], k + ' tooltip matches how_to_play_v1.md'); } } }

// ---- page: keyword lines with tooltips on the card face, removal grids skip Eternal ----
(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const pg = await b.newPage(); const logs = [];
  pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
  await pg.setViewport({ width: 1920, height: 1080 });
  await pg.goto('file://' + path.resolve(__dirname, '../index.html') + '#demo-combat-barbarian');
  await pg.waitForFunction(() => window.__game && window.__game.state && window.__game.state.phase === 'combat' && !window.__game.ui.busy && !window.__game.ui.story, { timeout: 60000 });
  const R = await pg.evaluate(() => {
    const g = window.__game, D = window.GameData, E = window.Engine, p = g.state.players[0];
    const base = Object.assign({}, D.CARDS.strike);
    const defs = { kwp_all: { kind: 'spell', vanish: true, repeat: 3, replay: true, eternal: true }, kwp_ret: { retain: true, eternal: true }, kwp_rep2: { repeat: 2 }, kwp_exh: { replay: true, exhaust: true, desc: 'Deal {0} damage. Exhaust.' } };
    for (const id in defs) D.CARDS[id] = Object.assign({}, base, defs[id]);
    p.hand = Object.keys(defs).flatMap((id, j) => [{ id, uid: 'pk' + j }, { id, uid: 'pku' + j, up: true }]); g.ui.selected = null; g.render();
    const cards = {};
    for (const el of document.querySelectorAll('.hand .card')) { const box = el.querySelector('.cdesc'), sp = box.firstElementChild;
      cards[el.dataset.id + (el.classList.contains('upg') ? '+' : '')] = { html: sp.innerHTML, fits: sp.offsetHeight <= box.clientHeight + 0.5 && sp.scrollWidth <= box.clientWidth + 0.5,
        kw: [...sp.querySelectorAll('.kw')].map(x => [x.textContent, x.dataset.tip || '']) }; }
    p.hand = []; g.render();
    // shop removal grid and event remove grid
    p.deck.push({ uid: 'etp1', id: 'kwp_ret' }); p.gold = 999;
    const grid = () => [...document.querySelectorAll('.pileview .card')].map(el => el.dataset.card);
    const saved = { phase: g.state.phase, shop: g.state.shop, event: g.state.event };
    g.state.phase = 'shop'; g.state.shop = { cards: [], relics: [], potions: [], removeCost: 75, removed: false, discount: 0 }; g.ui.shopRemoving = true; g.render();
    const shopGrid = grid();
    g.ui.shopRemoving = false; g.state.phase = 'event'; g.state.event = { id: 'purifying_fountain', stage: 'pick', pick: 'remove', log: [], next: null }; g.render();
    const evGrid = grid();
    Object.assign(g.state, saved); g.render();
    return { cards, shopGrid, evGrid, deck: p.deck.map(c => c.uid) };
  });
  const tip = (k) => D.KEYWORDS[k];
  const lineRe = (word, shown) => `<br><span class="kw" data-tip="${tip(word).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}">${word}</span>${shown || ''}.`;
  for (const up of ['', '+']) {
    const a = R.cards['kwp_all' + up]; ok(a, 'all-keyword card rendered ' + up);
    ok(a.html.endsWith(lineRe('Spell') + lineRe('Vanish') + lineRe('Repeat', ' 3') + lineRe('Replay') + lineRe('Eternal')), `kwp_all${up}: Spell. / Vanish. / Repeat 3. / Replay. / Eternal. each on its own line with its tooltip: ${a.html.slice(-400)}`);
    eq(a.kw.map(x => x[0]), ['Spell', 'Vanish', 'Repeat', 'Replay', 'Eternal'], 'kwp_all' + up + ' keyword spans'); ok(a.kw.every(([w, t]) => t === D.KEYWORDS[w]), 'each span carries the How to Play tooltip');
    ok(a.fits, 'kwp_all' + up + ': five keyword lines still fit the rules box');
    const r = R.cards['kwp_ret' + up]; ok(r.html.endsWith(lineRe('Retain') + lineRe('Eternal')), 'kwp_ret' + up + ': Retain. then Eternal.');
    const r2 = R.cards['kwp_rep2' + up]; ok(r2.html.endsWith(lineRe('Repeat', ' 2')), 'kwp_rep2' + up + ': Repeat 2. line');
    const x = R.cards['kwp_exh' + up]; ok(x.html.endsWith(lineRe('Replay')) && /Exhaust<\/span>\.<br>/.test(x.html), 'kwp_exh' + up + ': Exhaust stays in the effect line, Replay after it');
  }
  ok(R.deck.includes('etp1'), 'Eternal card is in the deck');
  ok(R.shopGrid.length > 0 && !R.shopGrid.includes('etp1'), 'shop removal grid does not offer the Eternal card (' + R.shopGrid.length + ' offered)');
  ok(R.evGrid.length > 0 && !R.evGrid.includes('etp1'), 'event remove grid does not offer the Eternal card (' + R.evGrid.length + ' offered)');
  eq(R.shopGrid.length, R.deck.length - 1, 'shop grid offers every other card');
  ok(!logs.length, 'no page errors: ' + logs.join(' | '));
  console.log(`keywords ok (${n} checks)`);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
