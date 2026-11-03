// Pool 34 (card_pool_draft.md, Producer approved Nov 3 21:54): every hero's non-starter pool is a rarity pyramid,
// 12 common / 9 uncommon / 6 rare / 3 legendary, plus 4 starter cards = 34. Starters untouched. Re-tiers and the 21 new
// cards (6 Fighter, 15 Wizard) are pinned here with their numbers, a few mechanic checks, and their art / placeholders.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const ROOT = path.join(__dirname, '..');
// ---- counts ----
for (const hero of ['fighter', 'barbarian', 'wizard']) {
  const c = { starter: 0, common: 0, uncommon: 0, rare: 0, legendary: 0 }, all = Object.values(D.CARDS).filter(d => d.cls === hero);
  for (const d of all) { ok(d.rarity in c, `${hero}: ${d.name} has a pool rarity (${d.rarity})`); c[d.rarity]++; }
  eq(c, { starter: 4, common: 12, uncommon: 9, rare: 6, legendary: 3 }, hero + ' pool is 4 starters + 12/9/6/3');
  eq(all.length, 34, hero + ' has 34 cards');
}
// ---- starters untouched (md5 of every starter definition at 4e6fcb1) and starting decks unchanged ----
const st = Object.entries(D.CARDS).filter(([, c]) => c.rarity === 'starter');
eq(crypto.createHash('md5').update(JSON.stringify(st)).digest('hex'), 'd8108b41fc2d1b772f79247b3e59592e', 'starter card definitions are byte-for-byte the 4e6fcb1 ones');
// ---- re-tiers ----
const R = (id) => D.CARDS[id].rarity;
// Producer 23:02: the Burn It Down cards stay uncommon with their 4e6fcb1 numbers; four plain uncommons drop to common, numbers unchanged
eq(['burn_through', 'worn_grip', 'ember_hide', 'blood_in_mouth'].map(R), ['uncommon', 'uncommon', 'uncommon', 'uncommon'], 'Barbarian: Burn It Down cards stay uncommon');
eq(['burn_through', 'worn_grip', 'ember_hide', 'blood_in_mouth'].map(id => [D.CARDS[id].effects[0].n, E.cardDef({ id, up: true }).effects[0].n]), [[13, 16], [12, 15], [8, 11], [10, 10]], 'Burn It Down cards: original numbers, Burn Through 13 / 16 (Designer 23:31)');
eq(['whirling_axe', 'brutal_critical', 'bear_totem', 'relentless_rage'].map(R), ['common', 'common', 'common', 'common'], 'Whirling Axe, Brutal Critical, Bearskin, Relentless Rage uncommon -> common');
eq(['whirling_axe', 'brutal_critical', 'bear_totem', 'relentless_rage'].map(id => [D.CARDS[id].cost, D.CARDS[id].effects[0].n]), [[2, 13], [2, 15], [1, 4], [1, 10]], 'their numbers unchanged');
eq(R('whats_left'), 'rare', "What's Left uncommon -> rare");
eq([R('old_scars'), R('ten_thousand_drills'), R('the_wall_holds')], ['legendary', 'legendary', 'legendary'], 'Fighter legendaries: The Wall Holds, Old Scars, Ten Thousand Drills');
eq([R('read_the_opening'), R('no_wasted_motion')], ['rare', 'rare'], 'Read the Opening and No Wasted Motion legendary -> rare');
eq([D.CARDS.read_the_opening.cost, E.cardDef({ id: 'read_the_opening', up: true }).cost, D.CARDS.no_wasted_motion.cost, E.cardDef({ id: 'no_wasted_motion', up: true }).cost], [3, 2, 2, 1], 'their costs unchanged');
eq([D.CARDS.ten_thousand_drills.power.thirdCardMightCap, D.CARDS.ten_thousand_drills.cost, E.cardDef({ id: 'ten_thousand_drills', up: true }).cost], [5, 3, 2], 'Drills: cap 5 again, cost 3 / upgraded 2');
ok(/up to 5 a fight/.test(D.CARDS.ten_thousand_drills.desc), 'Drills text says up to 5');
// Designer 23:31 numbers pass (numbers only). Headbutt is NOT changed: 8 would break Anna 04:20 (a Rage attack hits for less than Greataxe Chop 7).
const n0 = (id, up) => E.cardDef({ id, up: !!up }).effects[0].n;
eq([n0('wild_swing'), n0('wild_swing', 1), n0('burn_through'), n0('burn_through', 1), n0('whirlwind'), n0('whirlwind', 1), D.CARDS.whirlwind.effects[0].times, n0('headbutt'), n0('headbutt', 1), n0('reckless_flurry'), D.CARDS.old_scars.cost === 2 && D.CARDS.old_scars.power.healToBlock === true, n0('scorching_ray')],
  [6, 8, 13, 16, 8, 10, 2, 5, 7, 10, true, 4], 'Wild Swing 6/8, Burn Through 13/16, Whirlwind 8x2 (10x2), Headbutt 5/7 kept, Reckless Flurry and Scorching Ray unchanged');
// ---- new cards: id, cost/upgraded cost, rarity, kind, base text, upgraded text ----
const NEW = {
  sweeping_attack: [1, 1, 'common', '', 'Deal 7 damage. Deal 5 damage to a random enemy.', 'Deal 10 damage. Deal 5 damage to a random enemy.'],
  evasive_footwork: [1, 1, 'common', '', 'Gain 7 Block.', 'Gain 10 Block.'],
  extra_attack: [1, 1, 'uncommon', '', 'Deal 5 damage.', 'Deal 7 damage.'],
  eldritch_strike: [2, 2, 'uncommon', '', 'Deal 8 damage to ALL enemies. Apply 1 Frightened to ALL.', 'Deal 11 damage to ALL enemies. Apply 1 Frightened to ALL.'],
  shield_wall: [2, 2, 'uncommon', '', 'Gain 12 Block. Gain 1 Armor.', 'Gain 15 Block. Gain 1 Armor.'],
  feinting_attack: [0, 0, 'uncommon', '', 'Deal 4 damage. Apply 1 Prone.', 'Deal 6 damage. Apply 1 Prone.'],
  shocking_grasp: [0, 0, 'common', 'cantrip', 'Deal 2 damage. Apply 1 Prone.', 'Deal 5 damage. Apply 2 Prone.'],
  acid_splash: [0, 0, 'common', 'cantrip', 'Deal 2 damage. Apply 2 Poisoned.', 'Deal 5 damage. Apply 3 Poisoned.'],
  grease: [1, 1, 'common', 'spell', 'Apply 1 Prone to ALL enemies.', 'Apply 2 Prone to ALL enemies.'],
  ice_knife: [1, 1, 'common', 'spell', 'Deal 5 damage. Deal 2 damage to ALL enemies.', 'Deal 7 damage. Deal 3 damage to ALL enemies.'],
  absorb_elements: [1, 1, 'common', 'spell', 'Gain 4 Block.', 'Gain 6 Block.'],
  lightning_bolt: [2, 2, 'uncommon', 'spell', 'Deal 9 damage to a random enemy twice.', 'Deal 11 damage to a random enemy twice.'],
  counterspell: [1, 1, 'uncommon', 'spell', 'Apply 2 Frightened. Gain 5 Block.', 'Apply 3 Frightened. Gain 8 Block.'],
  vampiric_touch: [2, 2, 'uncommon', 'spell', 'Deal 10 damage. Heal 4 HP.', 'Deal 13 damage. Heal 5 HP.'],
  cloudkill: [2, 2, 'uncommon', 'spell', 'Apply 5 Poisoned to ALL enemies.', 'Apply 6 Poisoned to ALL enemies.'],
  cone_of_cold: [2, 2, 'rare', 'spell', 'Deal 12 damage to ALL enemies. Apply 2 Frightened to ALL.', 'Deal 15 damage to ALL enemies. Apply 2 Frightened to ALL.'],
  wall_of_force: [2, 2, 'rare', 'spell', 'Gain 20 Block. Exhaust.', 'Gain 23 Block. Exhaust.'],
  blight: [2, 2, 'rare', 'spell', 'Deal 8 damage. Apply 8 Poisoned.', 'Deal 11 damage. Apply 9 Poisoned.'],
  meteor_swarm: [3, 3, 'legendary', 'spell', 'Deal 10 damage to ALL enemies 3 times. Exhaust.', 'Deal 11 damage to ALL enemies 3 times. Exhaust.'],
  time_stop: [1, 1, 'legendary', 'spell', 'Gain 2 Energy. Draw 2 cards. Exhaust.', 'Gain 2 Energy. Draw 3 cards. Exhaust.'],   // upgrade draws 3, no cost drop (Designer 23:31)   // 3 -> 2 Energy + Retain (Designer 23:18)
  wish: [3, 3, 'legendary', 'spell', 'At the start of each of your turns, gain 1 Energy.', 'At the start of each of your turns, gain 1 Energy.'],
};
const plain = (t) => t.replace(/«[+-]?(\d+)»/g, '$1');
for (const [id, [cost, upCost, rar, kind, base, up]] of Object.entries(NEW)) {
  const d = D.CARDS[id]; ok(d, id + ' exists');
  eq([d.cost, E.cardDef({ id, up: true }).cost, d.rarity, d.kind || ''], [cost, upCost, rar, kind], id + ' cost / upgraded cost / rarity / kind');
  eq([plain(E.cardText(null, null, { id })), plain(E.cardText(null, null, { id, up: true }))], [base, up], id + ' text');
  eq(E.cardDef({ id, up: true }).name, d.name + '+', id + '+ name');
}
eq(Object.keys(NEW).filter(id => D.CARDS[id].cls === 'fighter').length, 6, 'six new Fighter cards');
eq(Object.keys(NEW).filter(id => D.CARDS[id].cls === 'wizard').length, 15, 'fifteen new Wizard cards');
eq([D.keywordLines(D.CARDS.evasive_footwork), D.keywordLines(D.CARDS.extra_attack), D.keywordLines(D.CARDS.absorb_elements)].map(l => l.filter(k => k !== 'Spell')), [['Retain'], ['Replay'], ['Repeat 2']], 'Retain / Replay / Repeat 2 keyword lines');
const names = Object.values(D.CARDS).map(c => c.name); eq(names.length, new Set(names).size, 'no two cards share a name');
// ---- mechanics ----
const fight = (hero, enc = 'lone_goblin', seed = 11) => { const s = E.newGame({ seed, heroes: [hero] }), p = s.players[0]; E.startEncounter(s, enc); E.takeEvents(s);
  p.energy = 99; p.hand = []; p.statuses = {}; s.enemies.forEach(e => { e.hp = e.maxHp = 500; e.block = 0; e.statuses = {}; }); return { s, p }; };
let u = 0; const give = (p, id, up) => { const c = { uid: 'p34_' + (u++), id, up: !!up }; p.hand.push(c); return c; };
const play = (s, p, c, t) => { const r = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: t && t.uid }); ok(r.ok, 'played ' + c.id + ': ' + (r.error || '')); return E.takeEvents(s); };
{ const { s, p } = fight('fighter'), e = s.enemies[0]; const ev = play(s, p, give(p, 'extra_attack'), e);
  eq(ev.filter(x => x.kind === 'hit' && x.target === e.uid).map(x => x.amount), [5, 5], 'Extra Attack: Replay hits twice for 5'); }
{ const { s, p } = fight('fighter', 'goblin_pack'); const L = E.livingEnemies(s), hp = L.map(e => e.hp); play(s, p, give(p, 'sweeping_attack'), L[0]);
  eq(L.reduce((a, e, i) => a + hp[i] - e.hp, 0), 12, 'Sweeping Attack: 7 to the target + 5 to a random enemy'); }
{ const { s, p } = fight('fighter'); play(s, p, give(p, 'shield_wall'), null); eq([p.block, p.statuses.armor], [12, 1], 'Shield Wall: 12 Block, 1 Armor'); }
{ const { s, p } = fight('wizard'); p.statuses.arcane = 2; play(s, p, give(p, 'absorb_elements'), null); eq(p.block, 2 * (4 + 4), 'Absorb Elements: Repeat 2, Arcane Focus on each (2 x (4+4))'); }
{ const { s, p } = fight('wizard', 'goblin_pack'); const L = E.livingEnemies(s), hp = L.map(e => e.hp); const ev = play(s, p, give(p, 'lightning_bolt'), null);
  eq(ev.filter(x => x.kind === 'hit').length, 2, 'Lightning Bolt: two hits'); eq(L.reduce((a, e, i) => a + hp[i] - e.hp, 0), 18, 'Lightning Bolt: 9 + 9'); }
{ const { s, p } = fight('wizard'); const h0 = p.hand.length; p.draw.push({ uid: 'd1', id: 'fire_bolt' }, { uid: 'd2', id: 'fire_bolt' }); p.energy = 1;
  const c = give(p, 'time_stop'); play(s, p, c, null); eq([p.energy, p.hand.length, (p.exhaust || []).includes(c)], [2, h0 + 2, true], 'Time Stop: 1 - 1 + 2 Energy, draw 2, Exhaust'); }
eq([D.CARDS.time_stop.retain, E.cardDef({ id: 'time_stop', up: true }).retain, D.keywordLines(D.CARDS.time_stop).join()], [true, true, 'Spell,Retain'], 'Time Stop: Retain (base and upgraded)');
{ const { s, p } = fight('wizard'); play(s, p, give(p, 'wish'), null); ok((p.powers || []).some(c => c.id === 'wish'), 'Wish stays in play');
  E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s); ok(s.phase === 'combat', 'still in combat'); eq(p.energy, p.maxEnergy + 1, 'Wish: +1 Energy at the start of the next turn'); }
// ---- boss rewards: the Wizard now has legendaries, so her boss pick is legendary-only like the other two ----
for (let seed = 1; seed <= 100; seed++) { const s = E.newGame({ seed, heroes: ['wizard'] }); ok(E.rollCardRewards(s, s.players[0], 3, 'boss').every(id => D.CARDS[id].rarity === 'legendary'), 'Wizard boss rewards are legendary'); }
// ---- art: every new card has art or a placeholder, listed in PLACEHOLDERS.md; Acid Splash -> placeholder_acid, Wish -> card_arcane_focus ----
const PH = fs.readFileSync(path.join(ROOT, 'assets/placeholder/PLACEHOLDERS.md'), 'utf8');
eq([D.CARDS.acid_splash.art, D.CARDS.wish.art], ['acid', 'arcane_focus'], 'Acid Splash and Wish reuse art');
ok(fs.existsSync(path.join(ROOT, 'assets/placeholder/placeholder_acid.webp')) && fs.existsSync(path.join(ROOT, 'assets/card_arcane_focus.webp')), 'reused art files exist');
ok(PH.includes('`acid_splash`') && PH.includes('`wish`'), 'PLACEHOLDERS.md notes the Acid Splash and Wish reuse');
for (const id of Object.keys(NEW).filter(id => !['acid_splash', 'wish'].includes(id))) {
  ok(!fs.existsSync(path.join(ROOT, 'assets/card_' + id + '.webp')) && fs.existsSync(path.join(ROOT, 'assets/placeholder/placeholder_' + id + '.webp')), id + ' has its placeholder');
  ok(PH.includes('| `placeholder_' + id + '.webp` | `' + id + '` |'), id + ' is listed in PLACEHOLDERS.md'); }
ok(/img\('placeholder_' \+ c\.id\) \|\| \(base\.art \? img\('placeholder_' \+ base\.art\) : ''\)/.test(fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8')), 'card face falls back to placeholder_<art> (Acid Splash)');
const html = path.join(ROOT, 'index.html');
if (fs.existsSync(html)) { const h = fs.readFileSync(html, 'utf8'); for (const k of ['placeholder_acid', 'card_arcane_focus', 'placeholder_meteor_swarm', 'placeholder_extra_attack']) ok(h.includes('"' + k + '":"data:image/webp;base64,'), 'built index.html carries ' + k); }
console.log(`pool34: ${n} checks passed`);
