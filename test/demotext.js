// demo.2 text (Lorekeeper, lore/text/demo_text_v1.md sections 1-4, Tester passed 1-3; section 4 v1.1 wired Nov 3): pinned word
// for word (re-checked against Lorekeeper's 18:4x update), ids unchanged, and no placeholder / retired text left in the built page.
const fs = require('fs'), path = require('path');
global.window = global; const D = require('../src/data.js'); require('../src/content.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const S = D.STORY, M = D.MONSTERS, X = D.ENCOUNTERS;
// 1. Vessa
eq(S.bossIntro.beholder, ["A street hangs on its side here, its doorways open in the ceiling. Feral drow crouch along the walls, all facing the same way.",
  "Among them stands a drow woman, hunched and crooked under a torn veil. Eyes are open all along her arms and throat, red and unblinking.",
  "VESSA: \"There you are. I watched you all the way up. Shall I tell you who you were?\""], 'Vessa intro');
eq(S.bossDefeat.beholder, ["VESSA: \"Dark. Finally, dark.\"", "Every eye on her closes at once, and she folds down onto the stones. Along the walls, the drow begin to wander off, like animals after a light goes out."], 'Vessa victory');
eq(X.beholder.scene, "Vessa's Hall", 'Vessa scene');
// 2. character select
eq([D.HEROES.fighter.blurb, D.HEROES.fighter.mechanic], ["A sellsword who has held worse lines than this one. Steady attacks and Block, with maneuvers that knock foes Prone or Frighten them.",
  "Maneuvers: Prone and Frightened weaken your foes, while Might and Armor make you stronger. Action Surge gives you 1 extra Energy when you need it most."], 'Fighter select text');
eq([D.HEROES.barbarian.blurb, D.HEROES.barbarian.mechanic], ["A furious brute with little Block. Anger keeps the Barbarian standing, and reckless attacks hit huge but can leave you Prone.",
  "Rage: while you have any Rage, you take 25% less damage. Rage adds no damage, but some cards hit harder the more you've built. It goes down by 1 each turn."], 'Barbarian select text');
// 4. demo.2 bosses
eq([X.crier.scene, X.toll.scene, X.brood.scene], ['The Keepsake Burrow', 'The Counted Gate', 'The Breathing Wall'], 'boss scenes');
eq([M.toll_bones.name, M.toll_tally.name, M.toll_penitent.name, M.brood_husk.name, M.brood_shell.name], ['Those Who Stopped', 'The Tallyman', 'Kneeling Penitent', 'Husk', 'Mossed Shell'], 'minion names');
const names = (id) => Object.fromEntries(Object.entries(M[id].moves).map(([k, m]) => [k, m.name]));
eq(names('crier'), { call: 'Over Here', reach: 'Long Fingers', voice: 'Someone You Knew', listen: 'Hush' }, 'Crier moves');
eq(names('toll'), { kneel: 'Kneel at the Gate', breath: 'The Gate Breathes', narrow: 'The Narrows Close', count: 'The Count Goes On', shut: 'Shut Fast' }, 'Toll moves');
eq(names('toll_penitent'), { hold: 'Shoulder the Stone', penance: 'Scourge' }, 'Penitent moves');
eq(names('toll_bones'), { wait: 'Getting Up Again', hack: 'Old Blade', rattle: 'Rattling Swing' }, 'Those Who Stopped moves');
eq(names('toll_tally'), { scratch: 'Scratch Another' }, 'Tallyman moves');
eq(names('brood'), { seal: 'Sealed Tight', split: 'A Pod Tears', pulse: 'Spore Breath', rot: 'Rotfall' }, 'Brood moves');
eq(names('brood_husk'), { wait: 'Not Yet Ripe', claw: 'Grey Hands', grasp: 'Clutch' }, 'Husk moves');
eq(names('brood_shell'), { shelter: 'Moss Over', bump: 'Topple' }, 'Mossed Shell moves');
eq(D.CARDS.echo.desc, 'Play to silence it. Exhaust. If this is still in your hand at the end of your turn, lose 3 HP.', 'Echo text');
ok(!D.CARDS.echo.art && fs.existsSync(path.join(__dirname, '../assets/placeholder/placeholder_echo.webp')), 'Echo uses its placeholder art');
ok(fs.readFileSync(path.join(__dirname, '../assets/placeholder/PLACEHOLDERS.md'), 'utf8').includes('`placeholder_echo.webp` | `echo`'), 'Echo placeholder listed');
eq(S.bossIntro.crier[3], "The voices stay with you. Don't hold on to them.", 'Crier hint');
eq(S.bossIntro.toll.slice(2), ["Bones lie heaped at the threshold. Beside each body, someone scratched a few marks into the rock.",
  "While she kneels, nothing touches the gate. Every mark it counts makes the dead stronger, so don't let it count for long."], 'Toll lines 3-4 (no survive win)');
eq([S.bossIntro.brood[0], S.bossIntro.brood[2]], ["The walls here are grey and spongy, and lumpy pods grow out of them in loose rows.",
  "A note sits under a dead delver's hand, half grown over: \"They wait a breath before they climb out. Don't give them one.\""], 'Brood lines 1 and 3');
eq(S.bossDefeat.crier, ["The Crier opens her too-wide jaw, and for once nothing comes out.", "In the quiet you can hear water dripping, and behind her burrow a tunnel slopes upward."], 'Crier defeat');
eq(S.bossDefeat.toll, ["The newest mark on the arch cracks straight across.", "The gate grinds open. Beyond it, the passage keeps climbing."], 'Toll defeat');
eq(S.bossDefeat.brood, ["The pods sag and go soft, one row after another.", "The wall breathes out once more, and then it doesn't breathe in."], 'Brood defeat');
// no leftovers in the sources or the built page
const RETIRED = ['Watcher', 'follow you down', 'Hold for the count', 'Risen Bones', 'Tally-Scratcher', 'The Quiet Dark', 'The Spore Wall', 'Watching Cavern',
  'Borrowed Voice', 'The Penitent Kneels', 'Holds Them Up', 'Standing Back Up', 'Another Mark', 'Still in the Pod', 'Slow Rot', 'Lean In', '(ph)'];
for (const f of ['src/data.js', 'src/content.js', 'index.html']) {
  const p = path.join(__dirname, '..', f); if (!fs.existsSync(p)) continue;
  const t = fs.readFileSync(p, 'utf8');
  for (const r of RETIRED) ok(!t.includes(r), `"${r}" left in ${f}`);
  ok(!/none reach the end/i.test(t), `"none reach the end" left in ${f}`);
}
console.log(`demotext ok (${n} checks)`);
