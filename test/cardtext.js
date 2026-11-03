// Card face text (Nov 3): type word = frame type (Producer/Anna 11:23), Spell / Retain keyword lines in the rules text
// (Anna 11:17, no tag pills), rules-box auto-shrink by a runtime overflow check (Producer 11:35/11:40 option a), and the
// Curse / Status split (Anna 11:28). Node checks on the data first, then the real page in headless Chrome.
const path = require('path');
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
// ---- data ----
const WORDS = ['Attack', 'Defense', 'Buff', 'Debuff', 'Utility', 'Power', 'Curse', 'Status'];
for (const [id, c] of Object.entries(D.CARDS)) {
  const w = D.typeWord(c, id);
  ok(WORDS.includes(w), `${id}: type word "${w}" is one of ${WORDS}`);
  ok(c.type === 'power' ? w === 'Power' : w.toLowerCase() === D.frameOf(c, id), `${id}: type word ${w} matches frame ${D.frameOf(c, id)}`);
  ok(c.type !== 'junk' && c.rarity !== 'junk', `${id}: no "junk" type or rarity left`);
  if (c.combatOnly) ok(c.type === 'status' && c.rarity === 'status' && D.frameOf(c, id) === 'status', `${id}: combat-only card is a Status`);
}
ok(D.typeWord(D.CARDS.defend, 'defend') === 'Defense' && D.typeWord(D.CARDS.strike, 'strike') === 'Attack', 'Shield Block says Defense, Longsword Strike says Attack');
ok(D.typeWord(D.CARDS.bear_totem, 'bear_totem') === 'Power', 'a Power card says Power');
ok(D.typeWord(D.CARDS.curse_regret, 'curse_regret') === 'Curse' && D.typeWord(D.CARDS.acid, 'acid') === 'Status' && D.typeWord(D.CARDS.junk_broken_bone, 'junk_broken_bone') === 'Status', 'Curse and Status type words');
for (const id of ['curse_regret', 'curse_guilt', 'curse_rot', 'curse_hex', 'curse_whispers']) ok(D.CARDS[id].type === 'curse' && !D.CARDS[id].combatOnly, id + ' stays a persistent Curse');
ok(!D.CARDS.acid.art, 'Acid no longer reuses Mummy Rot art (own placeholder)');
ok(require('fs').existsSync(path.join(__dirname, '../assets/placeholder/placeholder_acid.webp')) && /placeholder_acid\.webp/.test(require('fs').readFileSync(path.join(__dirname, '../assets/placeholder/PLACEHOLDERS.md'), 'utf8')), 'placeholder_acid exists and is listed in PLACEHOLDERS.md');
ok(D.keywordLines({ kind: 'spell', retain: true }).join() === 'Spell,Retain' && D.keywordLines({ kind: 'cantrip' }).length === 0 && D.keywordLines({}).length === 0, 'keyword lines: Spell then Retain, Cantrip gets none');
ok(/Arcane Focus makes this card stronger/.test(D.KEYWORDS.Spell) && /stays in your hand until you play it/.test(D.KEYWORDS.Retain), 'Spell and Retain tooltips use the How to Play wording');
// status cards are cleared at fight end and never upgraded
{ const s = E.newGame({ seed: 5, heroes: ['barbarian'] }), p = s.players[0]; E.startEncounter(s, 'lone_goblin'); E.takeEvents(s);
  p.hand.push({ uid: 'x1', id: 'acid' }, { uid: 'x2', id: 'junk_broken_bone' }); p.deck.push({ uid: 'x3', id: 'curse_regret' });
  s.enemies.forEach(e => { e.hp = 0; }); E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s);
  ok(s.phase === 'reward' && !p.deck.some(c => D.CARDS[c.id].type === 'status') && p.deck.some(c => c.id === 'curse_regret'), 'status cards gone after the fight, curse stays'); }

// ---- page ----
(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const pg = await b.newPage(); const logs = [];
  pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
  await pg.setViewport({ width: 1920, height: 1080 });
  await pg.goto('file://' + path.resolve(__dirname, '../index.html') + '#demo-combat-barbarian');
  await pg.waitForFunction(() => window.__game && window.__game.state && window.__game.state.phase === 'combat' && !window.__game.ui.busy && !window.__game.ui.story, { timeout: 60000 });
  // every card in the hand (the narrowest rules box), in batches; then the three known long texts with both keyword lines
  const R = await pg.evaluate(() => {
    const g = window.__game, D = window.GameData, p = g.state.players[0], ids = Object.keys(D.CARDS), out = {};
    const measure = () => [...document.querySelectorAll('.hand .card')].forEach(el => {
      const box = el.querySelector('.cdesc'), sp = box.firstElementChild, k = el.dataset.id + (el.classList.contains('upg') ? '+' : '');
      out[k] = { small: box.classList.contains('small'), fits: sp.offsetHeight <= box.clientHeight + 0.5 && sp.scrollWidth <= box.clientWidth + 0.5,
        font: parseFloat(getComputedStyle(box).fontSize), cw: el.offsetWidth, type: el.querySelector('.ctype').textContent,
        typeColor: getComputedStyle(el.querySelector('.ctype')).color, html: sp.innerHTML,
        kw: [...sp.querySelectorAll('.kw')].map(x => x.textContent + '|' + (x.dataset.tip || '')) };
    });
    for (const up of [false, true]) for (let i = 0; i < ids.length; i += 8) {
      p.hand = ids.slice(i, i + 8).filter(id => !up || !['curse', 'status'].includes(D.CARDS[id].type)).map((id, j) => ({ id, uid: 'ct' + up + i + '_' + j, up }));
      g.ui.selected = null; g.render(); measure(); }
    // copies (fresh ids, so the engine's upgrade cache is not stale) of the three long texts with both keyword lines
    const plain = { ...out }; for (const k in out) delete out[k];
    for (const id of ['goad', 'blood_up', 'bear_beneath']) D.CARDS[id + '_kw'] = Object.assign({}, D.CARDS[id], { kind: 'spell', retain: true });
    p.hand = ['goad', 'blood_up', 'bear_beneath'].flatMap((id, j) => [{ id: id + '_kw', uid: 'kw' + j }, { id: id + '_kw', uid: 'kwu' + j, up: true }]); g.render(); measure();
    const kwRes = {}; for (const k in out) kwRes[k.replace('_kw', '')] = out[k];
    p.hand = []; g.render(); for (const id of ['goad', 'blood_up', 'bear_beneath']) delete D.CARDS[id + '_kw'];
    // compendium (wider box, every card)
    g.ui.screen = 'compendium'; g.ui.compTab = 'cards'; g.render();
    const comp = [...document.querySelectorAll('.compcards .card')].map(el => { const box = el.querySelector('.cdesc'), sp = box.firstElementChild;
      return { id: el.dataset.id, small: box.classList.contains('small'), fits: sp.offsetHeight <= box.clientHeight + 0.5 }; });
    const filt = [...document.querySelectorAll('.cfilters button')].map(x => x.textContent.trim());
    g.ui.screen = 'game'; g.render();
    return { plain, kwRes, comp, filt, pills: document.querySelectorAll('.ctag,.ctags').length, ids };
  });
  for (const id of R.ids.concat(R.ids.filter(id => !['curse', 'status'].includes(D.CARDS[id].type)).map(id => id + '+'))) {
    const r = R.plain[id]; ok(r, id + ' rendered in hand');
    ok(r.fits, `${id}: rules text fits its box in hand (small=${r.small})`);
    ok(r.type === D.typeWord(D.CARDS[id.replace('+', '')], id.replace('+', '')), `${id}: shown type word ${r.type}`);
    ok(!/skill|common|rare|legendary|starter|junk/i.test(r.type), `${id}: no engine type or rarity word on the type line (${r.type})`);
    ok(r.typeColor === 'rgb(239, 220, 174)', `${id}: type word is plain cream (${r.typeColor})`);
    if (r.small) ok(Math.abs(r.font / r.cw - 10.2 / 160) < 0.002, `${id}: small font is 10.2 px at 160 px (${r.font} at ${r.cw})`);
    else ok(Math.abs(r.font / r.cw - 12.64 / 160) < 0.002, `${id}: normal font is 12.6 px at 160 px (${r.font} at ${r.cw})`);
  }
  ok(R.plain.strike.cw === 160 && !R.plain.strike.small, 'hand card is 160 px and a short text keeps the normal font');
  for (const id of ['goad', 'blood_up', 'bear_beneath', 'goad+', 'blood_up+', 'bear_beneath+']) {
    const r = R.kwRes[id]; ok(r && r.fits, `${id}: fits with both keyword lines (small=${r && r.small})`);
    ok(/<br><span class="kw" data-tip="Spell: [^"]+">Spell<\/span>\.<br><span class="kw" data-tip="Retain: [^"]+">Retain<\/span>\.$/.test(r.html), `${id}: Spell. and Retain. each on their own line with a tooltip: ${r.html.slice(-200)}`);
  }
  for (const c of R.comp) ok(c.fits, `compendium ${c.id} fits (small=${c.small})`);
  ok(R.pills === 0, 'no tag pills on any card');
  ok(R.filt.includes('Curses & Status'), 'compendium filter names Curses & Status: ' + R.filt);
  ok(!logs.length, 'no page errors: ' + logs.join(' | '));
  const smallHand = Object.keys(R.plain).filter(id => R.plain[id].small), smallKw = Object.keys(R.kwRes).filter(id => R.kwRes[id].small), smallComp = R.comp.filter(c => c.small).map(c => c.id);
  console.log(`cardtext ok (${n} checks). Small font in hand: ${smallHand.join(', ') || 'none'}; with both keyword lines: ${smallKw.join(', ') || 'none'}; compendium: ${smallComp.join(', ') || 'none'}`);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
