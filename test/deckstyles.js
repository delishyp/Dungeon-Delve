// Barbarian deck styles B1-B3 (lore/text/deck_styles_v1.md, approved by Anna Nov 3): the Rage rework (DECISIONS 04:07),
// Rage attacks (04:20), Blood Up original (04:21), Enraged (Exhausts, 04:14), The Last Tally (no Might cap), Iron Hide
// (Scar Tissue, The Bear Beneath: 1 Rage per enemy turn), Powers (04:22), the legendary rarity and placeholder art (05:31).
const fs = require('fs'), path = require('path');
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0, k = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const NEW = ['headbutt', 'wild_swing', 'goad', 'bloodied_knuckles', 'blood_up', 'enraged', 'last_tally', 'scar_tissue', 'bear_beneath'];
function fight(enc = 'lone_goblin', seed = 5) {
  const s = E.newGame({ seed, heroes: ['barbarian'] }); E.startEncounter(s, enc); E.takeEvents(s);
  const p = s.players[0]; p.maxHp = p.hp = 9999; p.hand = []; p.statuses = {}; p.fresh = {};
  for (const e of s.enemies) { e.maxHp = e.hp = 9999; e.block = 0; }
  return { s, p, e: s.enemies[0] };
}
function play(s, p, id, up, tgt) {
  const c = { uid: 'ds' + (++k), id, up: !!up }; p.hand.push(c); p.energy = 20;
  const r = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: tgt && tgt.uid }); ok(r.ok, 'play ' + id + ': ' + r.error);
  return { c, ev: E.takeEvents(s) };
}
const hits = (ev, uid) => ev.filter(x => x.kind === 'hit' && x.target === uid && !x.why);
// a pure attacking enemy move for one enemy turn (no statuses, no blocks)
function enemyHits(s, e, n, times) {
  const m = D.MONSTERS[e.monsterId]; m.moves.__t = { name: 'Test', intent: 'attack', effects: [{ t: 'attack', n, times }] };
  e.intent = { move: '__t', target: s.players[0].uid };
}
function endTurn(s, p) { const r = E.dispatch(s, { type: 'END_TURN', player: p.uid }); ok(r.ok, 'end turn'); return E.takeEvents(s); }

// ---------- Rage: flat 25% off attack damage taken, any stacks; adds no damage ----------
{ const { s, p, e } = fight();
  for (const r of [0, 1, 3, 8, 20]) { p.statuses.rage = r || undefined; if (!r) delete p.statuses.rage;
    ok(E.attackDamage(e, p, 12) === (r ? 9 : 12), `12 against Rage ${r} = ${E.attackDamage(e, p, 12)}`);
    ok(E.attackDamage(e, p, 10) === (r ? 7 : 10), `10 against Rage ${r} rounds down to 7`);
    ok(E.attackDamage(p, e, 6) === 6, `hero with Rage ${r} still deals 6 (no Rage damage)`); }
  p.statuses.rage = 5; const { ev } = play(s, p, 'greataxe', false, e);
  ok(hits(ev, e.uid)[0].amount === D.CARDS.greataxe.effects[0].n, 'Greataxe Chop with 5 Rage deals its printed damage (no Rage bonus)');
  p.statuses = { rage: 2 }; enemyHits(s, e, 8, 2); const ev2 = endTurn(s, p);
  ok(hits(ev2, p.uid).map(x => x.amount + x.blocked).join() === '6,6', 'enemy 8x2 into Rage = 6,6');
  ok(/25% less damage/.test(D.STATUSES.rage.tip) && !/extra damage/.test(D.STATUSES.rage.tip), 'Rage tooltip matches the rework');
  ok(/25%/.test(D.HEROES.barbarian.mechanic) && !/\+damage/.test(D.HEROES.barbarian.mechanic) && !/Rage boosts every hit/.test(D.HEROES.barbarian.blurb), 'Barbarian hero text matches the rework');
  ok(D.CARDS.brutal_critical.effects[0].rageBonus === 10, 'Brutal Critical deals +10 while you have Rage (payoff, not Rage damage; 8 -> 10 Designer round 3)');
}
// ---------- Rage attack tag ----------
{ const tagged = Object.keys(D.CARDS).filter(id => D.CARDS[id].rageAttack).sort();
  ok(tagged.join() === ['bloodied_knuckles', 'frenzied_strike', 'goad', 'headbutt', 'wild_swing'].join(), 'rageAttack tag: ' + tagged);
  const givesRage = d => d.effects.some(f => (f.t === 'status' && f.status === 'rage' && f.to === 'self') || f.ragePerUnblocked);
  for (const [id, d] of Object.entries(D.CARDS)) if (d.type === 'attack' && d.cls === 'barbarian') ok(!!d.rageAttack === givesRage(d), id + ': tagged a Rage attack exactly when it is an attack that gives Rage');
}
// ---------- Enraged: X hits = Rage, Rage not spent, Exhausts (upgraded too) ----------
for (const up of [false, true]) for (const r of [0, 1, 4, 9]) {
  const { s, p, e } = fight(); if (r) p.statuses.rage = r;
  const { c, ev } = play(s, p, 'enraged', up, e), h = hits(ev, e.uid);
  ok(h.length === r && h.every(x => x.amount === (up ? 8 : 6)), `Enraged${up ? '+' : ''} at Rage ${r}: ${h.length} hits of ${h.map(x => x.amount)}`);
  ok((p.statuses.rage || 0) === r, 'Enraged does not spend Rage');
  ok(p.exhaust.some(x => x.uid === c.uid) && !p.discard.some(x => x.uid === c.uid), `Enraged${up ? '+' : ''} Exhausts`);
}
{ const d = D.CARDS.enraged, u = E.cardDef({ id: 'enraged', up: true });
  ok(d.rarity === 'legendary' && d.cost === 2 && d.type === 'attack' && d.exhaust && u.exhaust && u.cost === 2, 'Enraged: legendary 2-cost attack, Exhaust both ways');
  // with Blood Up out, its own hits add Rage but not hits (X counted when played)
  const { s, p, e } = fight(); play(s, p, 'blood_up', false); p.statuses.rage = 2;
  const { ev } = play(s, p, 'enraged', false, e);
  ok(hits(ev, e.uid).length === 2 && p.statuses.rage === 4, 'Enraged at Rage 2 with Blood Up: 2 hits, Rage 2 -> 4');
  const m = fight(); m.p.statuses = { rage: 3, might: 2 }; ok(hits(play(m.s, m.p, 'enraged', false, m.e).ev, m.e.uid).every(x => x.amount === 8), 'Might adds to each Enraged hit');
}
// ---------- Blood Up: 1 Rage per attack hit, max 3 a turn, Rage stops fading ----------
for (const up of [false, true]) {
  const { s, p, e } = fight();
  ok(E.cardDef({ id: 'blood_up', up }).cost === (up ? 0 : 1), 'Blood Up cost ' + (up ? 0 : 1));
  const { c } = play(s, p, 'blood_up', up);
  ok(p.powers.some(x => x.uid === c.uid) && !p.exhaust.length && !p.discard.some(x => x.uid === c.uid), 'Blood Up is a Power in play');
  ok((p.statuses.might || 0) === (up ? 4 : 0), 'Blood Up' + (up ? '+ gives 4 Might' : ' gives no Might') + ' (' + (p.statuses.might || 0) + ')');
  play(s, p, 'greataxe', false, e); ok(p.statuses.rage === 1, 'one hit: 1 Rage');
  play(s, p, 'greataxe', false, e); play(s, p, 'greataxe', false, e); play(s, p, 'greataxe', false, e);
  ok(p.statuses.rage === 3, 'four hits: capped at 3 Rage a turn (' + p.statuses.rage + ')');
  enemyHits(s, e, 1, 1); endTurn(s, p);
  ok(p.statuses.rage === 3, 'Rage does not fade at end of turn with Blood Up');
  enemyHits(s, e, 1, 1); endTurn(s, p);
  ok(p.statuses.rage === 3, 'still 3 after a second turn');
  play(s, p, 'reckless_flurry', false, e); ok(p.statuses.rage === 6, 'new turn: Reckless Flurry 3 hits = +3 (' + p.statuses.rage + ')');
  play(s, p, 'greataxe', false, e); ok(p.statuses.rage === 6, 'cap reached again this turn');
}
{ const { s, p, e } = fight(); play(s, p, 'blood_up', false); play(s, p, 'headbutt', false, e);
  ok(p.statuses.rage === 3, 'Headbutt with Blood Up: its own 2 + 1 on hit');
  play(s, p, 'frenzied_strike', false, e); play(s, p, 'frenzied_strike', false, e);
  ok(p.statuses.rage === 7, 'two Frenzied Strikes: 2 own + 2 on-hit (cap 3 reached): ' + p.statuses.rage);
  play(s, p, 'frenzied_strike', false, e);
  ok(p.statuses.rage === 8, 'after the cap a Rage attack still gives its own Rage (+1, no on-hit): ' + p.statuses.rage);
  const w = fight('rat_swarm'); play(w.s, w.p, 'blood_up', false); play(w.s, w.p, 'wild_swing', false);
  ok(w.p.statuses.rage === 4, 'Wild Swing on 3 rats with Blood Up: 1 + 3 on-hit = 4 (' + w.p.statuses.rage + ')'); }
{ const { s, p, e } = fight(); p.statuses.rage = 3; enemyHits(s, e, 1, 1); endTurn(s, p); ok(p.statuses.rage === 2, 'without Blood Up Rage still fades by 1'); }
// ---------- The Last Tally: +1 Might every turn, no cap ----------
for (const up of [false, true]) {
  const { s, p, e } = fight(); ok(E.cardDef({ id: 'last_tally', up }).cost === (up ? 1 : 2), 'Last Tally cost ' + (up ? 1 : 2));
  play(s, p, 'last_tally', up); ok(!p.statuses.might, 'no Might on the turn it is played');
  for (let t = 1; t <= 12; t++) { enemyHits(s, e, 1, 1); endTurn(s, p); ok(p.statuses.might === t, `turn +${t}: ${p.statuses.might} Might`); }
  ok(p.statuses.might === 12, 'Might passes 5 (no cap)');
  ok(hits(play(s, p, 'greataxe', false, e).ev, e.uid)[0].amount === D.CARDS.greataxe.effects[0].n + 12, 'Greataxe Chop at 12 Might deals printed + 12');
}
// ---------- Scar Tissue: Block when you take HP damage, once per enemy turn ----------
for (const up of [false, true]) {
  const { s, p, e } = fight(); const b = up ? 6 : 4; play(s, p, 'scar_tissue', up);
  play(s, p, 'headbutt', false, e); ok(p.block === 0, 'losing HP on your own turn does not trigger Scar Tissue');
  p.statuses = {}; p.fresh = {};
  enemyHits(s, e, 10, 3); const ev = endTurn(s, p), h = hits(ev, p.uid);
  ok(h.map(x => x.amount + '/' + x.blocked).join() === `10/0,${10 - b}/${b},10/0`, `Scar Tissue${up ? '+' : ''}: ${b} Block after the first HP loss only: ` + h.map(x => x.amount + '/' + x.blocked));
  enemyHits(s, e, 10, 2); const h2 = hits(endTurn(s, p), p.uid);
  ok(h2[1].blocked === b, 'triggers again the next enemy turn');
  enemyHits(s, e, 0, 1); p.block = 0; const h3 = hits(endTurn(s, p), p.uid); ok(h3[0].amount === 0 && p.block === 0, 'no HP lost: no Block');
}
// ---------- The Bear Beneath: Armor, Retaliate, 1 Rage when hit (once per enemy turn) ----------
for (const up of [false, true]) {
  const { s, p, e } = fight(); const a = up ? 4 : 3; play(s, p, 'bear_beneath', up);
  ok(p.statuses.armor === a && p.statuses.thorns === a, `Bear Beneath${up ? '+' : ''}: ${a} Armor, ${a} Retaliate`);
  ok(E.cardDef({ id: 'bear_beneath', up }).cost === 2, 'Bear Beneath cost 2');
  p.block = 0; enemyHits(s, e, 8, 3); const hp0 = e.hp, ev = endTurn(s, p), h = hits(ev, p.uid);
  ok(h.map(x => x.amount).join() === '8,6,6', 'first hit lands full, then Rage cuts the next two by 25%: ' + h.map(x => x.amount));
  ok(hp0 - e.hp === 3 * a, 'Retaliate hits back for each attack hit');
  ok(p.statuses.rage === 1 && p.block === a, 'only 1 Rage that enemy turn; Armor Block next turn');
}
// ---------- Headbutt, Wild Swing, Bloodied Knuckles, Goad ----------
for (const up of [false, true]) {
  let f = fight(); const hp = f.p.hp, h = hits(play(f.s, f.p, 'headbutt', up, f.e).ev, f.e.uid);
  ok(h[0].amount === (up ? 8 : 6) && f.p.statuses.rage === 2 && f.p.hp === hp - 2, `Headbutt${up ? '+' : ''}: ${up ? 8 : 6} damage, 2 Rage, lose 2 HP`);
  f = fight('rat_swarm'); const ev = play(f.s, f.p, 'wild_swing', up).ev;
  ok(f.s.enemies.every(x => hits(ev, x.uid)[0].amount === (up ? 8 : 6)) && f.p.statuses.rage === 1, `Wild Swing${up ? '+' : ''}: ${up ? 8 : 6} to ALL, 1 Rage`);
  f = fight(); let hk = hits(play(f.s, f.p, 'bloodied_knuckles', up, f.e).ev, f.e.uid);
  ok(hk.length === 2 && hk.every(x => x.amount === (up ? 5 : 4)) && f.p.statuses.rage === 2, `Bloodied Knuckles${up ? '+' : ''}: 2 hits, 2 Rage`);
  f = fight(); f.e.block = up ? 5 : 4; hk = hits(play(f.s, f.p, 'bloodied_knuckles', up, f.e).ev, f.e.uid);
  ok(hk[0].amount === 0 && hk[1].amount > 0 && f.p.statuses.rage === 1, 'a fully Blocked hit gives no Rage');
  f = fight(); f.e.block = 20; play(f.s, f.p, 'bloodied_knuckles', up, f.e); ok(!f.p.statuses.rage, 'all Blocked: no Rage');
  ok(E.cardDef({ id: 'goad', up }).cost === (up ? 0 : 1), 'Goad cost ' + (up ? 0 : 1));
}
{ // Goad: switches a non-attack intent to an attack, leaves attacks alone
  let f = fight('ogre'); f.e.intent = { move: 'bellow', target: f.p.uid };
  const h = hits(play(f.s, f.p, 'goad', false, f.e).ev, f.e.uid);
  ok(h[0].amount === 6 && f.p.statuses.rage === 1, 'Goad: 6 damage, 1 Rage');
  ok(E.moveOf(f.e, f.e.intent.move).effects.some(x => x.t === 'attack') && f.e.intent.move !== 'bellow' && f.e.intent.target === f.p.uid, 'Goad: Ogre switches from Bellow to ' + f.e.intent.move);
  ok(E.describeIntent(f.s, f.e).damage > 0, 'goaded intent shows its damage');
  f = fight('ogre'); f.e.intent = { move: 'club', target: f.p.uid }; play(f.s, f.p, 'goad', false, f.e); ok(f.e.intent.move === 'club', 'an attack intent stays as it is');
  f = fight('cube'); f.e.intent = { move: 'quiver', target: f.p.uid }; play(f.s, f.p, 'goad', true, f.e);
  ok(f.e.intent.move !== 'quiver', 'Goad+ drags the Cube out of Quiver'); const hp = f.p.hp; endTurn(f.s, f.p); ok(f.p.hp < hp, 'and it really swings');
  f = fight('mind_flayer'); const sur = f.s.enemies.find(x => x.monsterId === 'mind_flayer');
  ok(sur.intent.move === 'stitch', 'Surgeon opens by sewing'); play(f.s, f.p, 'goad', false, sur); ok(sur.intent.move === 'incision', 'Goad turns Fresh Stitches into The Incision');
}
// ---------- Powers (Anna 04:22), legendary rarity, rewards ----------
for (const id of ['blood_up', 'last_tally', 'scar_tissue', 'bear_beneath']) {
  const d = D.CARDS[id]; ok(d.type === 'power' && !d.exhaust && !/exhaust/i.test(d.desc), id + ' is a Power with no Exhaust');
  const { s, p } = fight(); const { c } = play(s, p, id, false);
  ok(p.powers.some(x => x.uid === c.uid) && ![p.hand, p.draw, p.discard, p.exhaust].some(x => x.some(y => y.uid === c.uid)), id + ' stays in play, out of the piles');
}
ok(['enraged', 'last_tally', 'bear_beneath'].every(id => D.CARDS[id].rarity === 'legendary'), 'Enraged, The Last Tally, The Bear Beneath are legendary');
ok(Object.values(D.CARDS).filter(d => d.rarity === 'legendary').every(d => ['barbarian', 'fighter', 'wizard'].includes(d.cls)), 'legendaries are hero cards (the Wizard has hers since pool 34)');
{ const bar = { legendary: 0, other: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const s = E.newGame({ seed, heroes: ['barbarian'] }), p = s.players[0];
    for (const t of ['fight', 'elite', 'rareOnly']) ok(!E.rollCardRewards(s, p, 3, t).some(id => D.CARDS[id].rarity === 'legendary'), t + ' rewards never offer a legendary');
    const b = E.rollCardRewards(s, p, 3, 'boss'); for (const id of b) bar[D.CARDS[id].rarity === 'legendary' ? 'legendary' : 'other']++;
    ok(b.length === 3 && new Set(b).size === 3, 'Barbarian boss reward: 3 different cards');
    const f = E.newGame({ seed, heroes: ['fighter'] }); ok(E.rollCardRewards(f, f.players[0], 3, 'boss').length === 3, 'Fighter boss reward unchanged (3 cards)');
  }
  ok(bar.other === 0 && bar.legendary === 900, 'Barbarian boss rewards are all legendary');
}
// ---------- upgraded versions: one change each, as written ----------
{ const u = (id) => E.cardDef({ id, up: true }), b = (id) => D.CARDS[id];
  ok(u('headbutt').effects[0].n === 8 && u('wild_swing').effects[0].n === 8 && u('bloodied_knuckles').effects[0].n === 5 && u('bloodied_knuckles').effects[0].times === 2, 'upgraded numbers: Headbutt 7, Wild Swing 6, Knuckles 5x2');
  ok(u('goad').cost === 0 && u('blood_up').cost === 0 && u('last_tally').cost === 1 && u('enraged').effects[0].n === 8, 'upgraded costs: Goad 0, Blood Up 0, Last Tally 1; Enraged 8 a hit');
  ok(u('scar_tissue').power.onHpLossEnemyTurn.block === 6 && /6 Block/.test(u('scar_tissue').desc) && b('scar_tissue').power.onHpLossEnemyTurn.block === 4, 'Scar Tissue+ 6 Block');
  ok(u('bear_beneath').effects.map(f => f.n).join() === '4,4' && u('bear_beneath').power.onHpLossEnemyTurn.rage === 1, 'Bear Beneath+ 4 Armor 4 Retaliate, still 1 Rage per enemy turn');
  ok(u('blood_up').power.rageOnHitPerTurn === 3, 'caps never change on upgrade (Blood Up 3 a turn)');
  ok(u('blood_up').effects.length === 1 && u('blood_up').effects[0].status === 'might' && u('blood_up').effects[0].n === 4 && u('blood_up').effects[0].to === 'self' && /^Gain 4 Might\. /.test(u('blood_up').desc) && b('blood_up').effects.length === 0, 'Blood Up+ (Anna 10:39): cost 0 and Gain 4 Might; base Blood Up unchanged');
  for (const id of NEW) { ok(u(id).name === b(id).name + '+' && u(id).upgraded, id + '+ named'); ok(E.cardText(null, null, { id, up: true }) && !/\{\d\}/.test(E.cardText(null, null, { id, up: true })), id + '+ text fills in'); }
  ok(E.cardText(null, null, { id: 'headbutt', up: true }) === 'Deal «+8» damage. Gain 2 Rage. Lose 2 HP.', 'Headbutt+ text shows the better number: ' + E.cardText(null, null, { id: 'headbutt', up: true }));
  ok(b('headbutt').cost === 1 && b('wild_swing').cost === 1 && b('goad').cost === 1 && b('bloodied_knuckles').cost === 1 && b('blood_up').cost === 1 && b('scar_tissue').cost === 1 && b('bear_beneath').cost === 2 && b('last_tally').cost === 2, 'base costs as written');
  ok(['headbutt', 'wild_swing'].every(id => b(id).rarity === 'common') && ['goad', 'bloodied_knuckles'].every(id => b(id).rarity === 'uncommon') && ['blood_up', 'scar_tissue'].every(id => b(id).rarity === 'rare'), 'rarities as written');
}
// ---------- save / reload keeps the hooks ----------
{ let { s, p, e } = fight(); play(s, p, 'blood_up', false); play(s, p, 'greataxe', false, e); play(s, p, 'greataxe', false, e);
  s = JSON.parse(JSON.stringify(s)); p = s.players[0]; e = s.enemies[0];
  play(s, p, 'greataxe', false, e); play(s, p, 'greataxe', false, e); ok(p.statuses.rage === 3, 'Blood Up cap survives save/reload mid-turn'); }
// ---------- placeholder art (Anna 05:31) ----------
{ const dir = path.join(__dirname, '..', 'assets', 'placeholder'), md = fs.readFileSync(path.join(dir, 'PLACEHOLDERS.md'), 'utf8');
  for (const id of NEW) {
    const f = 'placeholder_' + id + '.webp', has = fs.existsSync(path.join(__dirname, '..', 'assets', 'card_' + (D.CARDS[id].art || id) + '.webp'));
    ok(has || fs.existsSync(path.join(dir, f)), id + ' has art or ' + f);
    if (!has) ok(md.includes('`' + f + '`') && md.includes('`' + id + '`'), f + ' listed in PLACEHOLDERS.md');
  }
  for (const f of fs.readdirSync(dir)) if (f !== 'PLACEHOLDERS.md') ok(/^placeholder_[a-z0-9_]+\.webp$/.test(f) && D.CARDS[f.slice(12, -5)], 'placeholder named placeholder_<card id>.webp: ' + f);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of NEW) ok(html.includes('"placeholder_' + id + '":"data:image/webp;base64,'), 'built index.html carries placeholder_' + id);
}
// =================== Fighter deck styles F1-F5 (Anna 10:41) and the shared Retain keyword (10:42) ===================
const FNEW = ['the_wall_holds', 'read_the_opening', 'form_and_repeat', 'ten_thousand_drills', 'hilt_to_the_teeth', 'give_ground', 'wait_for_it', 'no_wasted_motion', 'field_dressing', 'old_scars'];
function ffight(enc = 'lone_goblin', seed = 5, hero = 'fighter') {
  const s = E.newGame({ seed, heroes: [hero] }); E.startEncounter(s, enc); E.takeEvents(s);
  const p = s.players[0]; p.maxHp = p.hp = 9999; p.hand = []; p.statuses = {}; p.fresh = {}; p.block = 0;
  for (const e of s.enemies) { e.maxHp = e.hp = 9999; e.block = 0; e.statuses = {}; }
  return { s, p, e: s.enemies[0] };
}
const mine = (ev, p) => ev.filter(x => x.kind === 'hit' && x.source === p.uid && !x.why);
// ---------- card data as written ----------
{ const b = (id) => D.CARDS[id], u = (id) => E.cardDef({ id, up: true });
  ok(FNEW.every(id => b(id) && b(id).cls === 'fighter'), 'all ten new Fighter cards exist');
  ok(['the_wall_holds', 'read_the_opening', 'ten_thousand_drills', 'no_wasted_motion', 'old_scars'].every(id => b(id).type === 'power'), 'five Powers');
  // Pool 34 (Producer 23:02): Read the Opening and No Wasted Motion legendary -> rare; The Wall Holds, Drills, Old Scars stay legendary.
  ok(['the_wall_holds', 'ten_thousand_drills', 'old_scars'].every(id => b(id).rarity === 'legendary') && ['read_the_opening', 'no_wasted_motion'].every(id => b(id).rarity === 'rare'), 'three legendary Powers, Read the Opening and No Wasted Motion rare');
  ok(['the_wall_holds', 'no_wasted_motion', 'old_scars'].every(id => b(id).cost === 2 && u(id).cost === 1), 'The Wall Holds, No Wasted Motion, Old Scars: cost 2, upgraded 1');
  ok(['read_the_opening', 'ten_thousand_drills'].every(id => b(id).cost === 3 && u(id).cost === 2), 'Read the Opening, Ten Thousand Drills: cost 3, upgraded 2 (balance nudge)');
  ok(['hilt_to_the_teeth', 'give_ground', 'wait_for_it'].every(id => b(id).rarity === 'common' && b(id).cost === 0), 'three 0-cost Tempo commons');
  ok(['form_and_repeat', 'field_dressing'].every(id => b(id).rarity === 'rare'), 'Form and Repeat and Field Dressing are rare');
  ok(b('hilt_to_the_teeth').effects[0].n === 5 && u('hilt_to_the_teeth').effects[0].n === 7, 'Hilt to the Teeth 5 (upgraded 7)');
  ok(b('give_ground').effects[0].n === 6 && u('give_ground').effects[0].n === 8, 'Give Ground 6 Block (upgraded 8)');
  ok(b('wait_for_it').retain && b('wait_for_it').effects[0].n === 2 && u('wait_for_it').effects[0].n === 3 && u('wait_for_it').retain, 'Wait for It: Retain, draw 2 (upgraded 3, still Retain)');
  ok(E.cardText(null, null, { id: 'wait_for_it', up: true }) === 'Draw «+3» cards.', 'Wait for It+ text: ' + E.cardText(null, null, { id: 'wait_for_it', up: true }));
  ok(b('form_and_repeat').cost === 0 && b('form_and_repeat').effects.map(f => f.n).join() === '4,1' && u('form_and_repeat').effects.map(f => f.n).join() === '6,1', 'Form and Repeat 0: 4 Block draw 1 (upgraded 6)');
  ok(b('field_dressing').cost === 1 && b('field_dressing').retain && b('field_dressing').exhaust && b('field_dressing').effects[0].n === 8 && u('field_dressing').effects[0].n === 11, 'Field Dressing 1: heal 8, Retain, Exhaust (upgraded 11)');
  ok(b('ten_thousand_drills').power.thirdCardMightCap === 5 && u('ten_thousand_drills').power.thirdCardMightCap === 5 && u('no_wasted_motion').power.zeroCostDrawPerTurn === 3, 'caps never change on upgrade (Drills 5, No Wasted Motion 3 a turn)');
  for (const id of FNEW) { ok(!/\{\d\}/.test(E.cardText(null, null, { id })) && !/\{\d\}/.test(E.cardText(null, null, { id, up: true })), id + ' text fills in'); ok(u(id).name === b(id).name + '+', id + '+ named'); }
  for (let seed = 1; seed <= 300; seed++) { const f = E.newGame({ seed, heroes: ['fighter'] }); ok(E.rollCardRewards(f, f.players[0], 3, 'boss').every(id => D.CARDS[id].rarity === 'legendary'), 'Fighter boss rewards are legendary now'); }
  for (let seed = 1; seed <= 300; seed++) { const f = E.newGame({ seed, heroes: ['fighter'] }); ok(E.rollCardRewards(f, f.players[0], 3, 'fight').every(id => D.CARDS[id].rarity !== 'legendary'), 'no legendaries outside boss rewards'); }
}
// ---------- F1 The Wall Holds: half your Block (rounded down) to ALL enemies at the end of your turn, not an attack ----------
{ const { s, p } = ffight('kobolds'); play(s, p, 'the_wall_holds', false); p.statuses.might = 3; p.block = 21;
  s.enemies.forEach(e => enemyHits(s, e, 0, 1)); const ev = endTurn(s, p);
  const h = mine(ev, p); ok(h.length === s.enemies.length && h.every(x => x.amount + x.blocked === 10), 'The Wall Holds: 21 Block -> 10 to each enemy, Might not added: ' + h.map(x => x.amount + x.blocked));
  const i = ev.findIndex(x => x.kind === 'enemyTurn'); ok(ev.findIndex(x => x === h[0]) < i, 'it fires before the enemies act');
  const { s: s2, p: p2 } = ffight(); play(s2, p2, 'the_wall_holds', false); p2.block = 1; enemyHits(s2, s2.enemies[0], 0, 1); ok(mine(endTurn(s2, p2), p2).length === 0, 'Block 1 -> 0 damage, no hit'); }
{ const { s, p, e } = ffight(); e.hp = 5; play(s, p, 'the_wall_holds', false); p.block = 12; enemyHits(s, e, 50, 1);
  endTurn(s, p); ok(s.phase === 'reward' && p.hp === 9999, 'The Wall Holds can win the fight at end of turn (enemy never acts)'); }
// ---------- F2 Read the Opening: the first hit each turn on a Prone or Frightened enemy is doubled (that hit only) ----------
{ const { s, p, e } = ffight(); play(s, p, 'read_the_opening', false);
  let h = mine(play(s, p, 'strike', false, e).ev, p); ok(h[0].amount === 6, 'no Prone/Frightened: normal 6');
  e.statuses.prone = 2; h = mine(play(s, p, 'strike', false, e).ev, p); ok(h[0].amount === 18, 'first hit on Prone: 6 x1.5 x2 = 18 (x3 as Tester checked): ' + h[0].amount);
  h = mine(play(s, p, 'strike', false, e).ev, p); ok(h[0].amount === 9, 'second hit that turn: Prone only, 9');
  e.statuses.prone = 2; enemyHits(s, e, 0, 1); endTurn(s, p); e.statuses = { frightened: 2 };
  h = mine(play(s, p, 'strike', false, e).ev, p); ok(h[0].amount === 12, 'next turn, first hit on Frightened: 12');
  e.statuses = { prone: 2 }; h = mine(play(s, p, 'whirlwind', false).ev, p); ok(h.map(x => x.amount).join() === '12,12', 'multi-hit card: only the first hit of the turn is doubled, and it was used this turn already'); }
{ const { s, p, e } = ffight(); play(s, p, 'read_the_opening', false); e.statuses.prone = 2;
  const h = mine(play(s, p, 'whirlwind', false).ev, p); ok(h.map(x => x.amount).join() === '24,12', 'Whirlwind 8x2 on Prone: 12 -> 24 first hit only, then 12'); }
{ const { s, p, e } = ffight(); e.statuses.prone = 2; ok(mine(play(s, p, 'strike', false, e).ev, p)[0].amount === 9, 'without the Power, Prone is the usual x1.5'); }
// ---------- F3 Ten Thousand Drills: the third card each turn gives 1 Might, up to 5 a fight ----------
{ const { s, p, e } = ffight(); play(s, p, 'ten_thousand_drills', false); play(s, p, 'defend', false);
  ok(!p.statuses.might, 'two cards played: no Might yet'); play(s, p, 'defend', false); ok(p.statuses.might === 1, 'third card (the Power counts as the first): 1 Might');
  play(s, p, 'defend', false); play(s, p, 'defend', false); play(s, p, 'defend', false); ok(p.statuses.might === 1, 'only the third card each turn');
  for (let t = 0; t < 7; t++) { enemyHits(s, e, 0, 1); endTurn(s, p); p.hand = []; for (let i = 0; i < 3; i++) play(s, p, 'defend', false); }
  ok(p.statuses.might === 5, 'capped at 5 Might from Drills in a fight: ' + p.statuses.might);
  E.startEncounter(s, 'rat_swarm'); E.takeEvents(s); ok(!p.fightFx.drillMight, 'the cap resets next fight'); }
// ---------- F4 No Wasted Motion: draw 1 on each 0-cost card, up to 3 a turn ----------
{ const { s, p, e } = ffight(); play(s, p, 'no_wasted_motion', false); const d0 = p.draw.length;
  let h0 = p.hand.length; play(s, p, 'hilt_to_the_teeth', false, e); ok(p.hand.length === h0 + 1 && p.draw.length === d0 - 1, '0-cost card draws 1');
  play(s, p, 'strike', false, e); ok(p.draw.length === d0 - 1, '1-cost card draws nothing');
  play(s, p, 'give_ground', false); play(s, p, 'wait_for_it', false); ok(p.draw.length === d0 - 3 - 2, 'Wait for It draws its own 2 plus 1 from the Power');
  play(s, p, 'hilt_to_the_teeth', false, e); ok(p.draw.length === d0 - 5, 'fourth 0-cost card in a turn: no extra draw (max 3)');
  enemyHits(s, e, 0, 1); endTurn(s, p); p.hand = []; play(s, p, 'precision_attack', false, e);
  ok(p.hand.length === 2, 'the 3-a-turn limit resets next turn (Precision Attack draws 1 + 1)'); }
{ const { s, p, e } = ffight(); play(s, p, 'no_wasted_motion', true); const d0 = p.draw.length; p.hand = [];
  play(s, p, 'strike', true, e); ok(p.draw.length === d0, 'an upgraded 1-cost card still costs 1: no draw'); }
// ---------- F5 Old Scars: whenever you heal in a fight, gain that much Block ----------
{ const { s, p } = ffight(); play(s, p, 'old_scars', false); p.hp = p.maxHp - 20; p.block = 0;
  play(s, p, 'field_dressing', false); ok(p.block === 8 && p.hp === p.maxHp - 12, 'Field Dressing heal 8 -> 8 Block');
  p.hp = p.maxHp - 2; play(s, p, 'second_wind', false); ok(p.block === 10, 'only the HP actually healed counts (2 of 4)');
  p.hp = p.maxHp; play(s, p, 'healing_potion', false); ok(p.block === 10, 'full HP: no heal, no Block'); }
{ const { s, p } = ffight(); p.hp = p.maxHp - 20; play(s, p, 'field_dressing', false); ok(p.block === 0, 'without Old Scars, healing gives no Block'); }
// ---------- Retain (shared keyword) ----------
{ const { s, p, e } = ffight(); const keep = { uid: 'rt1', id: 'wait_for_it' }, fd = { uid: 'rt2', id: 'field_dressing', up: true }, sb = { uid: 'rt3', id: 'defend' };
  p.hand.push(keep, fd, sb); enemyHits(s, e, 0, 1); endTurn(s, p);
  ok(p.hand.some(c => c.uid === 'rt1') && p.hand.some(c => c.uid === 'rt2'), 'Retain cards stay in hand at the end of the turn');
  ok(!p.hand.some(c => c.uid === 'rt3') && p.discard.some(c => c.uid === 'rt3'), 'a normal card is discarded as usual');
  let t = JSON.parse(JSON.stringify(s)); ok(t.players[0].hand.some(c => c.uid === 'rt1'), 'retained card survives save/reload');
  p.energy = 3; const hp0 = (p.hp = p.maxHp - 15); E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: 'rt2' }); E.takeEvents(s);
  ok(p.exhaust.some(c => c.uid === 'rt2') && p.hp === hp0 + 11, 'a retained card still plays normally (Field Dressing+ heals 11, then Exhausts)');
  e.hp = 1; play(s, p, 'strike', false, e); ok(s.phase === 'reward', 'fight won');
  ok(p.hand.length === 0 && p.discard.some(c => c.uid === 'rt1'), 'fight end clears retained cards from the hand'); }
{ const { s, p, e } = ffight('lone_goblin', 7, 'barbarian'); p.hand.push({ uid: 'rb1', id: 'wait_for_it' }); enemyHits(s, e, 0, 1); endTurn(s, p);
  ok(p.hand.some(c => c.uid === 'rb1'), 'Retain is shared: it works for any hero (Anna 10:42)'); }
{ ok(/stays in your hand/.test(D.KEYWORDS.Retain), 'Retain keyword tooltip');
  // Retain is a keyword line (Anna 11:17): never in the desc itself, written once as its own 'Retain.' line after the effect.
  for (const id in D.CARDS) for (const up of [false, true]) {
    const d = E.cardDef({ id, up });
    ok(!/\bRetain\b/i.test(d.desc || ''), id + ': Retain is not part of the desc (the card face adds the keyword line)');
    ok(D.keywordLines(d).includes('Retain') === !!d.retain, id + (up ? '+' : '') + ': Retain keyword line iff the card has retain');
  }
  for (const id of ['wait_for_it', 'field_dressing']) ok(D.keywordLines(D.CARDS[id]).join() === 'Retain', id + ': one Retain. line');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
  ok(/D\.keywordLines\(def\)/.test(ui) && !/cardTags|ctag(?!bg)/.test(ui), 'Retain is drawn as a keyword line in the rules box, no tag pill'); }
// ---------- placeholders for the Fighter cards ----------
{ const dir = path.join(__dirname, '..', 'assets', 'placeholder'), md = fs.readFileSync(path.join(dir, 'PLACEHOLDERS.md'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of FNEW) { const f = 'placeholder_' + id + '.webp', has = fs.existsSync(path.join(__dirname, '..', 'assets', 'card_' + (D.CARDS[id].art || id) + '.webp'));
    ok(has || (fs.existsSync(path.join(dir, f)) && md.includes('`' + f + '`')), id + ' has art or a listed placeholder');
    if (!has) ok(html.includes('"placeholder_' + id + '":"data:image/webp;base64,'), 'built index.html carries placeholder_' + id); }
}
console.log('deckstyles ok (' + n + ' checks)');
