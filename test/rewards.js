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
  ok(num('trip_attack', 1) === 1 && num('riposte') === 4 && num('riposte', 1) === 4 && num('rally') === 5 && num('battle_cry') === 1 && num('defense_style') === 2 && num('indomitable') === 11 && num('sundering_blow') === 8,
    'Fighter: Trip Prone 1, Riposte 4/4, Rally 5, Battle Cry 1, Defense 2, Indomitable 11, Sundering Blow 8');
  ok(num('ray_of_frost') === 3 && num('ray_of_frost', 1) === 1 && D.CARDS.ray_of_frost.cost === 0, 'Wizard (wz9 spell set): Ray of Frost cantrip 0 / 3 damage, 1 Frightened');
  // Barbarian floor pass (Anna 11:14): Greataxe 7, Hide Armor 4, Reckless Attack 8, Frenzied Strike 6, Reckless Flurry 10x3, Thick Hide 12, Brutal Critical 15, Whirling Axe 13, Relentless Rage heal 10.
  ok(num('parry') === 4 && num('frenzied_strike') === 6 && num('reckless_flurry') === 10 && D.CARDS.reckless_flurry.effects[0].times === 3, 'Barbarian: Hide Armor 4, Frenzied Strike 6, Reckless Flurry 10x3');
  ok(num('greataxe') === 7 && num('reckless_attack') === 8 && num('thick_hide') === 12 && num('brutal_critical') === 15 && num('whirling_axe') === 13 && num('relentless_rage') === 10, 'Barbarian floor pass: Greataxe 7, Reckless Attack 8, Thick Hide 12, Brutal Critical 15, Whirling Axe 13, Relentless Rage heal 10');
  ok(num('greataxe') === 7 && num('shove') === 7 && num('mindless_rage') === 3 && num('reckless_attack') === 8 && num('rage') === 3, 'Barbarian: Greataxe Chop 7, Shove 7, Mindless Rage 3, Reckless Attack 8, Rage 3');
  ok(num('frenzied_strike') < num('greataxe') && num('headbutt') < num('greataxe'), 'Rage attacks hit for less than a normal attack (Anna 04:20)');
  // Wizard spell set (wz9, Arcane Focus rework Anna 10:36): cantrips unboosted, spells +2 per Arcane Focus stack.
  // Numbers: design draft 6.3 plus the wz9 fix (Shield 4, Magic Missile cost 1) on main eb43dd2.
  const k = id => D.CARDS[id].kind, c = id => D.CARDS[id].cost;
  ok(num('misty_step') === 3 && c('misty_step') === 0 && k('misty_step') === 'cantrip', 'Wizard: Misty Step cantrip 0 / 3 Block');
  ok(num('burning_hands') === 12 && c('burning_hands') === 2 && num('chromatic_orb') === 15 && c('chromatic_orb') === 2 && num('thunderwave') === 8 && c('thunderwave') === 2,
    'Wizard commons: Burning Hands 2/12, Chromatic Orb 2/15, Thunderwave 2/8');
  ok(num('fire_bolt') === 2 && c('fire_bolt') === 0 && k('fire_bolt') === 'cantrip' && num('magic_missile') === 2 && D.CARDS.magic_missile.effects[0].times === 3 && c('magic_missile') === 1
    && num('shield_spell') === 4 && k('shield_spell') === 'spell' && k('magic_missile') === 'spell', 'Wizard starter: Fire Bolt 0/2 cantrip, Magic Missile 1/2x3 spell, Shield 1/4 spell');
  ok(num('fireball') === 20 && c('fireball') === 3 && num('scorching_ray') === 4 && num('mirror_image') === 10 && num('disintegrate') === 28 && num('chain_lightning') === 12 && c('chain_lightning') === 3
    && num('arcane_torrent') === 6 && c('arcane_torrent') === 2 && num('mage_armor') === 1 && c('arcane_study') === 2, 'Wizard uncommons/rares: wz9 spell set numbers');
  // Arcane Focus: +2 per stack on a spell's damage (every hit) and Block, nothing on a cantrip.
  { const s = E.newGame({ seed: 5, heroes: ['wizard'] }), p = s.players[0];
    p.statuses.arcane = 1;
    const txt = id => E.cardText({ phase: 'combat' }, p, { id }, null);
    ok(/Gain «\+6» Block/.test(txt('shield_spell')), 'Shield shows 4 + 2 = 6 Block with 1 stack: ' + txt('shield_spell'));
    ok(txt('fire_bolt') === 'Deal 2 damage.', 'Fire Bolt (cantrip) is not boosted: ' + txt('fire_bolt'));
    ok(/«\+4» damage 3 times/.test(txt('magic_missile')), 'Magic Missile gets +2 on every hit: ' + txt('magic_missile'));
    ok(/«\+3» Armor/.test(txt('mage_armor')), 'Mage Armor 1 + 2 = 3 Armor with 1 stack: ' + txt('mage_armor')); }
}
console.log('rewards ok (' + n + ' checks)');
