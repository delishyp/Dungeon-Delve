// Narration v2 (Lorekeeper): batch 1 events (lore/text/narration_v2_batch1_events.md, md5 9d49340c) and batch 2 D.STORY
// (narration_v2_batch2_story.md, md5 e17d1333), both Tester PASS. Spot pins plus the relic gold fallback line.
global.window = global; const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const S = D.STORY, EV = D.EVENTS;
ok(EV.myconid_circle.choices[0].ops.text.includes('one thing you know how to do comes easier'), 'Dreamers: upgrade wording');
ok(EV.purifying_fountain.choices[1].ops.text === 'It tastes of nothing at all. Afterwards you feel stronger. Down here, that alone should make you suspicious.', 'Silver Spring drink');
ok(EV.deck_many_things.choices[0].chance.every(b => /^THE [A-Z]+\. /.test(b.text)), 'Teller cards keep their names first');
ok(!JSON.stringify(EV).includes('one of your skills comes easier'), 'old skills wording gone');
ok(D.RELIC_GOLD_TEXT === 'Whatever was meant to be here is gone. Someone left a purse in its place. Consolation, of a sort.', 'relic fallback line');
for (const h of ['fighter', 'barbarian', 'wizard']) {
  ok(S.intro[h].length === 4 && S.intro[h][0] === S.intro.fighter[0] && S.intro[h][3] === S.intro.fighter[3], h + ': 4 opening screens, shared 1/3/4');
  ok(S.intro[h].every(t => { const w = t.split(/\s+/).length; return w >= 37 && w <= 50; }), h + ': each screen 37-50 words');
  ok(S.victory[h][0] === 'Far above you, for the first time, you can hear the town.', h + ': CANON victory line 1');
}
ok(!S.floor[0].join(' ').includes('Brennick') && !S.intro.fighter.join(' ').includes('Brennick'), 'no names on Floor 1');
ok(S.bossIntro.toll.length === 5 && !/surviv|hold out/i.test(S.bossIntro.toll.join(' ')), 'Toll intro: 5 lines, never survive');
ok(S.bossIntro.beholder[2].startsWith('VESSA:') && S.bossIntro.crier[1].startsWith('THE CRIER:') && S.bossIntro.brood[3] === 'Burst them before they ripen. Whatever you break now can\'t walk out later.', 'spoken lines and hints kept');
ok(S.rooms.shop.length === 2 && S.defeat.length === 3, 'shop lines untouched, 3 defeat lines');
// fallback line rides on the outcome text when no relics are left
ok(/relicGold && D\.RELIC_GOLD_TEXT/.test(require('fs').readFileSync(__dirname + '/../src/engine.js', 'utf8')), 'engine appends the fallback line');
console.log(`narration ok (${n} checks)`);
