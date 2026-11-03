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
  ok(num('ray_of_frost') === 5 && num('ray_of_frost', 1) === 2, 'Wizard: Ray of Frost 5 damage, 2 Frightened');
  // Barbarian floor pass (Anna 11:14): Greataxe 7, Hide Armor 4, Reckless Attack 8, Frenzied Strike 6, Reckless Flurry 10x3, Thick Hide 12, Brutal Critical 15, Whirling Axe 13, Relentless Rage heal 10.
  ok(num('parry') === 4 && num('frenzied_strike') === 6 && num('reckless_flurry') === 10 && D.CARDS.reckless_flurry.effects[0].times === 3, 'Barbarian: Hide Armor 4, Frenzied Strike 6, Reckless Flurry 10x3');
  ok(num('greataxe') === 7 && num('reckless_attack') === 8 && num('thick_hide') === 12 && num('brutal_critical') === 15 && num('whirling_axe') === 13 && num('relentless_rage') === 10, 'Barbarian floor pass: Greataxe 7, Reckless Attack 8, Thick Hide 12, Brutal Critical 15, Whirling Axe 13, Relentless Rage heal 10');
  ok(num('greataxe') === 7 && num('shove') === 7 && num('mindless_rage') === 3 && num('reckless_attack') === 8 && num('rage') === 3, 'Barbarian: Greataxe Chop 7, Shove 7, Mindless Rage 3, Reckless Attack 8, Rage 3');
  ok(num('frenzied_strike') < num('greataxe') && num('headbutt') < num('greataxe'), 'Rage attacks hit for less than a normal attack (Anna 04:20)');
  // Wizard random-pick pass (Anna via Producer, Nov 3 05:07): commons more forgiving, starter trimmed so a starter-only deck
  // can't beat the later Floor 2 fights. Misty Step back to 4 Block.
  ok(num('misty_step') === 4 && D.CARDS.misty_step.cost === 0, 'Wizard: Misty Step 4 Block, cost 0');
  ok(num('burning_hands') === 10 && num('chromatic_orb') === 12 && num('thunderwave') === 6, 'Wizard commons: Burning Hands 10, Chromatic Orb 12, Thunderwave 6');
  ok(num('fire_bolt') === 4 && num('magic_missile') === 2 && D.CARDS.magic_missile.effects[0].times === 3 && num('shield_spell') === 6, 'Wizard starter: Fire Bolt 4, Magic Missile 2x3, Shield 6');
}
console.log('rewards ok (' + n + ' checks)');
