// No-repeat rule: a fight is never followed by itself or by a copy marked sameAs (Drow Patrol early/later).
const E = require('../src/engine.js');
const D = require('../src/data.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const key = e => (D.ENCOUNTERS[e] && D.ENCOUNTERS[e].sameAs) || e;
ok(D.ENCOUNTERS.drow_patrol_early.sameAs === 'drow_patrol', 'early copy marked sameAs drow_patrol');
let drowAfterDrow = 0, hardAfterEarlyDrow = 0;
for (let seed = 1; seed <= 3000; seed++) {
  const s = E.newGame({ seed, heroes: ['barbarian'] }); E.takeEvents(s);
  s.floor = 1;
  for (let row = 2; row <= 6; row++) {
    const prev = s.lastEnc;
    E.startFight(s, row, 'fight'); E.takeEvents(s);
    const cur = s.lastEnc;
    if (prev) ok(key(prev) !== key(cur), `seed ${seed} row ${row}: ${prev} then ${cur}`);
    if (prev === 'drow_patrol_early' && row === 4) hardAfterEarlyDrow++;
    s.phase = 'map'; s.combat = null;
  }
}
ok(hardAfterEarlyDrow > 0, 'covered early Drow -> later-row pick');
console.log('norepeat ok (' + n + ' checks, ' + hardAfterEarlyDrow + ' early-Drow->row4 cases)');
