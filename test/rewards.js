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
  ok(num('defend') === 6 && num('shield_bash') === 6 && num('trip_attack') === 7 && num('menacing_attack') === 8, 'Fighter: Shield Block 6, Shield Bash 6, Trip 7, Menacing 8');
  ok(num('parry') === 5 && num('frenzied_strike') === 6 && num('reckless_flurry') === 5 && D.CARDS.reckless_flurry.effects[0].times === 3, 'Barbarian: Hide Armor 5, Frenzied Strike 6, Reckless Flurry 5x3');
  ok(num('misty_step') === 3 && D.CARDS.misty_step.cost === 0, 'Wizard: Misty Step 3 Block, cost 0');
}
console.log('rewards ok (' + n + ' checks)');
