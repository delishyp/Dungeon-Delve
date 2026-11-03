// The Chalk Circle: paying always gives Brennick's Penny; if already owned, a random relic with the alternate text.
const E = require('../src/engine.js');
const D = require('../src/data.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const ALT = D.EVENTS.shrine_tymora.choices[0].ops.textOwned;
const MAIN = D.EVENTS.shrine_tymora.choices[0].ops.text;
for (let seed = 1; seed <= 200; seed++) {
  for (const owned of [false, true]) {
    const s = E.newGame({ seed, heroes: ['barbarian'] }); E.takeEvents(s);
    const p = s.players[0]; p.gold = 100;
    if (owned) p.relics.push('tymora_coin');
    const before = p.relics.length;
    s.phase = 'event'; s.event = { id: 'shrine_tymora', stage: 'choose', result: null, next: null, pick: null, log: [] };
    const r = E.dispatch(s, { type: 'EVENT_CHOICE', player: p.uid, choice: 0 });
    ok(r.ok, 'choice ok ' + r.error);
    ok(p.gold === 85, 'paid 15');
    if (!owned) { ok(p.relics.includes('tymora_coin') && s.event.result === MAIN, 'penny + main text'); }
    else { ok(s.event.result === ALT, 'alt text when owned'); ok(p.relics.length === before + 1 || p.gold === 125, 'random relic (or 40 gold if none left)'); }
  }
}
ok(typeof ALT === 'string' && ALT.startsWith('The coins settle'), 'alt line present');
console.log('chalk ok (' + n + ' checks)');
