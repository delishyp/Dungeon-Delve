// Elite card rewards are uncommon or rare only (no commons), for every hero.
const E = require('../src/engine.js');
const D = require('../src/data.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
for (const hero of ['barbarian', 'fighter', 'wizard']) {
  const rar = { common: 0, uncommon: 0, rare: 0 };
  for (let seed = 1; seed <= 400; seed++) {
    const s = E.newGame({ seed, heroes: [hero] }); E.takeEvents(s);
    const p = s.players[0];
    for (const id of E.rollCardRewards(s, p, 3, 'elite')) { ok(D.CARDS[id].rarity !== 'common', `${hero} seed ${seed}: elite offered common ${id}`); rar[D.CARDS[id].rarity]++; }
    ok(E.rollCardRewards(s, p, 3, 'elite').length === 3, `${hero}: 3 elite picks`);
  }
  ok(rar.uncommon > 0 && rar.rare > 0, `${hero}: both uncommon and rare appear`);
  const s = E.newGame({ seed: 7, heroes: [hero] }); const p = s.players[0];
  let commons = 0; for (let i = 0; i < 200; i++) commons += E.rollCardRewards(s, p, 3, 'fight').filter(id => D.CARDS[id].rarity === 'common').length;
  ok(commons > 0, `${hero}: normal fights still offer commons`);
}
// Hero card numbers (Nov 3 hero pass: each hero ~78% with the smart bot on the raised Floor 2).
{ const num = (id, i = 0) => D.CARDS[id].effects[i].n;
  // Fighter number pass (Nov 3, Producer 06:38): random-pick runs were 73.5%; generic commons, starter Block and the two Powers trimmed.
  ok(num('defend') === 5 && num('shield_bash') === 6 && num('trip_attack') === 7 && num('menacing_attack') === 8, 'Fighter: Shield Block 5, Shield Bash 6, Trip 7, Menacing 8');
  ok(num('trip_attack', 1) === 1 && num('riposte') === 5 && num('riposte', 1) === 4 && num('rally') === 5 && num('battle_cry') === 1 && num('defense_style') === 2 && num('indomitable') === 15 && num('sundering_blow') === 11,
    'Fighter: Trip Prone 1, Riposte 5/4, Rally 5, Battle Cry 1, Defense 2, Indomitable 15, Sundering Blow 11 (Designer round 2)');
  ok(num('ray_of_frost') === 2 && num('ray_of_frost', 1) === 1 && D.CARDS.ray_of_frost.cost === 0, 'Wizard (wz9 spell set): Ray of Frost cantrip 0 / 2 damage, 1 Frightened');
  // Barbarian floor pass (Anna 11:14): Greataxe 7, Hide Armor 4, Reckless Attack 8, Frenzied Strike 6, Reckless Flurry 10x3, Thick Hide 12, Brutal Critical 15, Whirling Axe 13, Relentless Rage heal 10.
  ok(num('parry') === 4 && num('frenzied_strike') === 6 && num('reckless_flurry') === 10 && D.CARDS.reckless_flurry.effects[0].times === 3, 'Barbarian: Hide Armor 4, Frenzied Strike 6, Reckless Flurry 10x3');
  ok(num('greataxe') === 7 && num('reckless_attack') === 8 && num('thick_hide') === 7 && num('brutal_critical') === 17 && num('whirling_axe') === 15 && num('relentless_rage') === 10, 'Barbarian floor pass: Greataxe 7, Reckless Attack 8, Thick Hide 7 (12 before Designer round 2), Brutal Critical 17, Whirling Axe 15 (Designer round 2), Relentless Rage heal 10');
  ok(num('greataxe') === 7 && num('shove') === 7 && num('mindless_rage') === 3 && num('reckless_attack') === 8 && num('rage') === 3, 'Barbarian: Greataxe Chop 7, Shove 7, Mindless Rage 3, Reckless Attack 8, Rage 3');
  ok(num('frenzied_strike') < num('greataxe') && num('headbutt') < num('greataxe'), 'Rage attacks hit for less than a normal attack (Anna 04:20)');
  // Wizard spell set (wz9, Arcane Focus rework Anna 10:36): cantrips unboosted, spells +2 per Arcane Focus stack.
  // Numbers: design draft 6.3 plus the wz9 W2 fix on QA_SPELL=1 (Fire Bolt 3, upgraded 5; Ray of Frost 2), Producer 13:10. wz9c (Anna 15:09, no Arcane Focus card, fifth Fire Bolt): Shield 5, Magic Missile 4x3, Poison Spray 7.
  const k = id => D.CARDS[id].kind, c = id => D.CARDS[id].cost;
  ok(num('poison_spray') === 7 && k('poison_spray') === 'cantrip', 'Wizard: Poison Spray cantrip 7 Poisoned');
  ok(num('misty_step') === 3 && c('misty_step') === 0 && k('misty_step') === 'cantrip', 'Wizard: Misty Step cantrip 0 / 3 Block');
  ok(num('burning_hands') === 15 && c('burning_hands') === 2 && num('chromatic_orb') === 18 && c('chromatic_orb') === 2 && num('thunderwave') === 8 && c('thunderwave') === 2,
    'Wizard commons: Burning Hands 2/15, Chromatic Orb 2/18, Thunderwave 2/8');
  ok(num('fire_bolt') === 3 && E.cardDef({ id: 'fire_bolt', up: true }).effects[0].n === 5 && c('fire_bolt') === 0 && k('fire_bolt') === 'cantrip' && num('magic_missile') === 4 && D.CARDS.magic_missile.effects[0].times === 3 && c('magic_missile') === 2
    && num('shield_spell') === 5 && k('shield_spell') === 'spell' && k('magic_missile') === 'spell', 'Wizard starter: Fire Bolt 0/3 cantrip, Magic Missile 2/4x3 spell, Shield 1/5 spell');
  ok(num('fireball') === 17 && c('fireball') === 3 && num('scorching_ray') === 4 && num('mirror_image') === 10 && num('disintegrate') === 24 && num('chain_lightning') === 12 && c('chain_lightning') === 3
    && num('arcane_torrent') === 6 && c('arcane_torrent') === 2 && num('mage_armor') === 1 && c('arcane_study') === 2, 'Wizard uncommons/rares: wz9 spell set numbers');
  // Arcane Focus: +2 per stack on a spell's damage (every hit) and Block, nothing on a cantrip.
  { const s = E.newGame({ seed: 5, heroes: ['wizard'] }), p = s.players[0];
    p.statuses.arcane = 1;
    const txt = id => E.cardText({ phase: 'combat' }, p, { id }, null);
    ok(/Gain «\+7» Block/.test(txt('shield_spell')), 'Shield shows 5 + 2 = 7 Block with 1 stack: ' + txt('shield_spell'));
    ok(txt('fire_bolt') === 'Deal 3 damage.', 'Fire Bolt (cantrip) is not boosted: ' + txt('fire_bolt'));
    ok(/«\+6» damage 3 times/.test(txt('magic_missile')), 'Magic Missile gets +2 on every hit: ' + txt('magic_missile'));
    ok(/«\+3» Armor/.test(txt('mage_armor')), 'Mage Armor 1 + 2 = 3 Armor with 1 stack: ' + txt('mage_armor')); }
  // Starter Fireball and Wildfire (Anna 15:18/15:21): new id fireball_starter, spell, cost 2, 6 to ALL; Fireball+ 10 to ALL at cost 2.
  // The old uncommon Fireball keeps its id `fireball`, numbers and text, and is now named Wildfire.
  { const fb = D.CARDS.fireball_starter, up = E.cardDef({ id: 'fireball_starter', up: true });
    ok(fb && fb.name === 'Fireball' && fb.cls === 'wizard' && fb.kind === 'spell' && fb.rarity === 'starter' && fb.cost === 2 && fb.target === 'none'
      && fb.effects.length === 1 && fb.effects[0].t === 'damageAll' && fb.effects[0].n === 6 && fb.desc === 'Deal {0} damage to ALL enemies.', 'Fireball: starter spell, cost 2, 6 to ALL');
    ok(up.cost === 2 && up.effects[0].t === 'damageAll' && up.effects[0].n === 10 && up.name === 'Fireball+', 'Fireball+: 10 to ALL, cost 2');
    ok(D.CARDS.fireball.name === 'Wildfire' && D.CARDS.fireball.cost === 3 && D.CARDS.fireball.rarity === 'uncommon' && D.CARDS.fireball.effects[0].n === 17, 'old Fireball renamed Wildfire (20 -> 17 to ALL, Designer round 2)');
    ok(!Object.values(D.CARDS).some(c => c !== D.CARDS.fireball_starter && c.name === 'Fireball'), 'only one card is named Fireball');
    ok(/«\+8» damage to ALL/.test(E.cardText({ phase: 'combat' }, Object.assign(E.newGame({ seed: 5, heroes: ['wizard'] }).players[0], { statuses: { arcane: 1 } }), { id: 'fireball_starter' }, null)), 'Fireball gets Arcane Focus (6 + 2)');
    // starter only: never offered in rewards or the shop
    for (let seed = 1; seed <= 300; seed++) { const s = E.newGame({ seed, heroes: ['wizard'] }), p = s.players[0];
      for (const k of ['fight', 'elite', 'boss']) ok(!E.rollCardRewards(s, p, 3, k).includes('fireball_starter'), 'Fireball not in ' + k + ' rewards'); }
    // hits every enemy
    { const s = E.newGame({ seed: 7, heroes: ['wizard'] }), p = s.players[0]; E.startEncounter(s, 'goblin_pack'); E.takeEvents(s);
      const c = { uid: 'fbx', id: 'fireball_starter' }; p.hand.push(c); p.energy = 3; p.statuses.arcane = 0;
      const hp0 = s.enemies.map(e => e.hp); const r = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid });
      ok(r.ok && s.enemies.length >= 2 && s.enemies.every((e, i) => hp0[i] - e.hp + 0 >= 1), 'Fireball hits every enemy'); } }
  // Starting decks (Anna 15:19): 10 cards = 8 starter basics (4 attack, 4 block) + 2 unique cards. Fighter left out (main is changing his deck).
  const DECKS = { wizard: ['fire_bolt', 'shield_spell', ['magic_missile', 'fireball_starter']], barbarian: ['greataxe', 'parry', ['rage', 'reckless_attack']] };
  for (const [h, [atk, blk, uniq]] of Object.entries(DECKS)) { const d = D.HEROES[h].deck;
    ok(d.length === 10 && d.filter(x => x === atk).length === 4 && d.filter(x => x === blk).length === 4, h + ': 10 cards, 4 ' + atk + ' + 4 ' + blk);
    ok(D.CARDS[atk].type === 'attack' && D.CARDS[blk].effects.some(f => f.t === 'block'), h + ': basics are an attack and a block card');
    ok(d.filter(x => x !== atk && x !== blk).sort().join() === uniq.slice().sort().join() && new Set(uniq).size === 2, h + ': 2 unique cards ' + uniq.join(', '));
    ok(d.every(x => D.CARDS[x].rarity === 'starter' || uniq.includes(x)), h + ': basics are starter cards'); }
}
console.log('rewards ok (' + n + ' checks)');
