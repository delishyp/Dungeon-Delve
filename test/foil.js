// Legendary foil + card inspect (ROADMAP row 8): a legendary gets the foil layers and its mask (default Enraged, or its own
// foil_mask_<id>), a normal card doesn't, the foil never shows on the rules box, the inspect view opens / tilts / closes
// (right-click in combat, left-click in the deck view and compendium) without playing the card, and nothing is logged.
// The test injects a legendary (a copy of Frenzied Strike) into the page only.
const path = require('path');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exit(1); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const pg = await b.newPage(); const logs = [];
  pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
  pg.on('console', m => logs.push('console.' + m.type() + ': ' + m.text()));
  await pg.setViewport({ width: 1920, height: 1080 });
  await pg.goto('file://' + path.resolve(__dirname, '../index.html') + '#demo-combat-barbarian');
  await pg.waitForFunction(() => window.__game && window.__game.state && window.__game.state.phase === 'combat' && !window.__game.ui.busy && !window.__game.ui.story, { timeout: 15000 });
  await sleep(600);
  const inject = () => pg.evaluate(() => {
    const g = window.__game, D = window.GameData, p = g.state.players[0];
    D.CARDS.test_legendary = Object.assign({}, D.CARDS.frenzied_strike, { name: 'Test Legend', rarity: 'legendary', art: D.CARDS.frenzied_strike.art || 'frenzied_strike' });
    if (!p.hand.some(c => c.uid === 'tl1')) p.hand.splice(2, 0, { id: 'test_legendary', uid: 'tl1' });
    g.ui.selected = null; g.render();
  });
  await inject(); await sleep(500);
  const q = (sel) => pg.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top }; }, sel);

  // ---- 1) layers + mask ----
  const L = await pg.evaluate(() => {
    const el = document.querySelector('.hand .card[data-card="tl1"]'), nrm = [...document.querySelectorAll('.hand .card')].find(c => c.dataset.rar !== 'legendary');
    const face = el.querySelector('.cface'), kids = [...face.children].map(c => c.className);
    const mask = getComputedStyle(el.querySelector('.foil-sheen')).webkitMaskImage || getComputedStyle(el.querySelector('.foil-sheen')).maskImage;
    return { foil: el.classList.contains('foil'), layers: el.querySelectorAll('.foil-l').length, kids, mask: mask.slice(0, 60), maskLen: mask.length,
      def: (window.ASSETS.foil_mask_frame_attack_legendary || '').slice(0, 40), defLen: (window.ASSETS.foil_mask_frame_attack_legendary || '').length, tpl: el.dataset.tpl,
      nrmFoil: nrm.classList.contains('foil') || !!nrm.querySelector('.foil-l,.insp-sheen'), anyNormalBlend: [...document.querySelectorAll('.card:not([data-rar="legendary"]) .foil-l')].length };
  });
  ok(L.foil && L.layers === 3, 'legendary in hand has the foil class and 3 foil layers');
  ok(/^data:image\/webp;base64,/.test(L.def) && L.defLen > 1000, 'legendary attack frame mask (foil_mask_frame_attack_legendary) is built in as a data URI');
  ok(L.tpl === 'attack_legendary' && L.mask.includes('data:image/webp;base64,') && L.maskLen >= L.defLen, 'legendary attack uses its frame\'s own mask: ' + L.tpl + ' ' + L.mask);
  ok(!L.nrmFoil && L.anyNormalBlend === 0, 'normal cards carry no foil or blend layers');
  const iS = L.kids.findIndex(k => /foil-sweep/.test(k)), iD = L.kids.findIndex(k => /cdesc/.test(k)), iN = L.kids.findIndex(k => /cname/.test(k));
  ok(iS > 0 && iS < iD && iS < iN && L.kids.indexOf('cframe') < L.kids.findIndex(k => /foil-sheen/.test(k)), 'foil layers sit above the frame and under all text: ' + L.kids.join(','));
  // Card templates (Palette rev 4 + cut gems): frame_/banner_/tag_<type>_<rarity> + gem_<rarity>; powers use the Moonsilver power_*;
  // curse and status have single frames and no gem; each legendary frame has its own foil mask.
  const PF = await pg.evaluate(() => {
    const g = window.__game, D = window.GameData, p = g.state.players[0], A = window.ASSETS;
    D.CARDS.test_legendary_pw = Object.assign({}, D.CARDS.bear_totem, { name: 'Test Legend Power', rarity: 'legendary' });
    p.hand.push({ id: 'bear_totem', uid: 'pw1' }, { id: 'test_legendary_pw', uid: 'pw2' }, { id: 'curse_regret', uid: 'cu1' }, { id: 'acid', uid: 'st1' }); g.render();
    const el = (uid) => document.querySelector(`.hand .card[data-card="${uid}"]`);
    const srcs = (uid) => [...el(uid).querySelectorAll('.cframe,.clayer')].map(x => x.getAttribute('src'));
    const rar = D.CARDS.bear_totem.rarity;
    const r = { pw: srcs('pw1').join() === [A['frame_power_' + rar], A['banner_power_' + rar], A['tag_power_' + rar], A['gem_' + rar]].join(),
      cu: srcs('cu1').join() === [A.frame_curse, A.banner_curse, A.tag_curse].join(), st: srcs('st1').join() === [A.frame_status, A.banner_status, A.tag_status].join(),
      all: [...document.querySelectorAll('.hand .card .cframe,.hand .card .clayer')].every(x => /^data:image\/svg\+xml/.test(x.getAttribute('src') || '')),
      pwMask: getComputedStyle(el('pw2').querySelector('.foil-sheen')).webkitMaskImage.length, pwMaskWant: A.foil_mask_frame_power_legendary.length,
      rule: document.getElementById('foil-masks').textContent.includes('.card.foil[data-tpl="power_legendary"]{--foil-mask:url("' + A.foil_mask_frame_power_legendary + '")}'), tpl: el('pw2').dataset.tpl };
    p.hand = p.hand.filter(x => !['pw1', 'pw2', 'cu1', 'st1'].includes(x.uid)); g.render(); delete D.CARDS.test_legendary_pw; return r;
  });
  ok(PF.pw, 'Power card (Bearskin) uses frame_/banner_/tag_power_<rarity> and its gem');
  ok(PF.cu && PF.st, 'curse and status cards use their single frames, no gem');
  ok(PF.all, 'every template layer is a built-in SVG');
  ok(PF.pwMask >= PF.pwMaskWant && PF.rule && PF.tpl === 'power_legendary', 'a legendary power uses foil_mask_frame_power_legendary (its own frame\'s mask)');

  // ---- 2) the rules box never gets foil: mask alpha there is 0, and the box looks the same with and without the layers ----
  const alpha = await pg.evaluate(async () => {
    const el = document.querySelector('.hand .card[data-card="tl1"]'), img = new Image(); img.src = window.ASSETS.foil_mask_frame_attack_legendary; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data, cs = getComputedStyle(el.querySelector('.cdesc'));
    // the rules box in card fractions (style.css .cdesc: left 8.5%, right 8.5%, top 60%, bottom 6.4%), shrunk 1 % for the box edge
    // The notch at the bottom centre (MANIFEST: 15 units up from the panel's bottom edge, y ~.912) is the socket's frame-metal rim,
    // which keeps frame foil; below it sits the gem socket, which must have none (Palette fix 12:05, mask md5 15425104).
    let max = 0; for (let yy = Math.ceil(img.height * .61); yy < img.height * .925; yy++) for (let xx = Math.ceil(img.width * .095); xx < img.width * .905; xx++) {
      if (yy >= img.height * .905 && Math.abs(xx / img.width - .5) <= .06) continue;   // the notch: the socket rim is frame metal and keeps frame foil; the socket itself is checked just below
      max = Math.max(max, d[(yy * img.width + xx) * 4 + 3]); }
    // the gem socket: every pixel the legendary gem covers (its opaque core, drawn at mask size) has mask alpha 0
    const gi = new Image(); gi.src = window.ASSETS.gem_legendary; await gi.decode();
    const gc = document.createElement('canvas'); gc.width = img.width; gc.height = img.height; const gx = gc.getContext('2d'); gx.drawImage(gi, 0, 0, img.width, img.height);
    const gd = gx.getImageData(0, 0, img.width, img.height).data; let gem = 0, gemMax = 0;
    for (let i = 3; i < gd.length; i += 4) if (gd[i] >= 128) { gem++; gemMax = Math.max(gemMax, d[i]); }
    return { max, top: cs.top, gem, gemMax };
  });
  ok(alpha.max === 0, 'foil mask is fully transparent over the rules box (max alpha ' + alpha.max + ')');
  ok(alpha.gem > 300 && alpha.gemMax === 0, 'the gem socket gets no foil (' + alpha.gem + ' gem pixels, max mask alpha ' + alpha.gemMax + ')');

  // ---- 3) hand tilt: mouse over the legendary tilts it up to 6 deg; the hover lift stays ----
  let c = await q('.hand .card[data-card="tl1"]');
  await pg.mouse.move(c.x, c.y); await sleep(350);
  c = await q('.hand .card[data-card="tl1"]');
  await pg.mouse.move(c.l + c.w * .2, c.t + c.h * .45, { steps: 6 }); await sleep(700);
  const ht = await pg.evaluate(() => { const el = document.querySelector('.hand .card[data-card="tl1"]'), cs = getComputedStyle(el);
    return { ry: parseFloat(el.style.getPropertyValue('--ry')), scale: cs.scale, hover: el.matches(':hover'), moving: el.classList.contains('foil-moving') }; });
  ok(ht.hover && ht.scale === '1.42', 'hand legendary keeps the hover lift while tilting (scale ' + ht.scale + ')');
  ok(ht.ry < -2 && ht.ry >= -6.01, 'hand legendary tilts toward the mouse, at most 6 deg (ry ' + ht.ry + ')');
  ok(!ht.moving, 'glitter resumes once the hand card settles');

  // ---- 4) left-click in combat still selects / plays, it never opens the inspect view ----
  const e0 = await pg.evaluate(() => window.__game.state.players[0].energy);
  await pg.mouse.click(c.l + c.w * .5, c.t + c.h * .5); await sleep(400);
  const lc = await pg.evaluate(() => ({ insp: !!window.__game.inspect.src, sel: window.__game.ui.selected, inHand: window.__game.state.players[0].hand.some(x => x.uid === 'tl1'), open: document.getElementById('insp').classList.contains('open') }));
  ok(!lc.insp && !lc.open, 'left-click on a hand card does not open the inspect view');
  ok(lc.sel === 'tl1' || !lc.inHand, 'left-click on a hand card still selects / plays it');
  await pg.keyboard.press('Escape'); await sleep(200);
  await pg.evaluate(() => { const g = window.__game; if (g.ui.paused) { g.ui.paused = false; } g.ui.selected = null; g.render(); }); await inject(); await sleep(400);
  const handBefore = await pg.evaluate(() => window.__game.state.players[0].hand.map(x => x.uid).join());

  // ---- 5) right-click inspects in combat; tilt; freeze while moving; Esc puts it back ----
  c = await q('.hand .card[data-card="tl1"]');
  await pg.mouse.move(c.x, c.y); await sleep(300); c = await q('.hand .card[data-card="tl1"]');
  await pg.mouse.click(c.x, c.y, { button: 'right' }); await sleep(80);
  const op = await pg.evaluate(() => { const g = window.__game, cl = g.inspect.clone, src = g.inspect.src;
    return { open: document.getElementById('insp').classList.contains('open'), cl: !!cl, cw: cl && cl.style.getPropertyValue('--cw'), w: cl && cl.offsetWidth,
      foil: cl && cl.querySelectorAll('.foil-l').length, sheen: cl && !!cl.querySelector('.insp-sheen'), hidden: src && src.style.visibility, srcId: src && src.dataset.card,
      act: cl && (cl.hasAttribute('data-act') || cl.hasAttribute('data-card')), sel: g.ui.selected }; });
  ok(op.open && op.cl && op.srcId === 'tl1', 'right-click on a hand card opens the inspect view');
  ok(op.cw === '470px' && op.w === 470, 'inspect card is re-laid out at 470 px (got ' + op.cw + ', ' + op.w + ')');
  ok(op.foil === 3 && !op.sheen && !op.act, 'inspected legendary keeps its foil, gets no extra sheen and no play hooks');
  ok(op.hidden === 'hidden', 'the slot in the hand hides while inspected');
  await pg.mouse.move(60, 540, { steps: 8 }); await sleep(30);
  const mv = await pg.evaluate(() => { const cl = window.__game.inspect.clone; return { moving: cl.classList.contains('foil-moving'), play: getComputedStyle(cl.querySelector('.foil-sweep')).animationPlayState }; });
  ok(mv.moving && mv.play === 'paused', 'while the card tilts, the foil animation layer is frozen (' + mv.play + ')');
  await sleep(1200);
  const left = await pg.evaluate(() => { const cl = window.__game.inspect.clone; return { ry: parseFloat(cl.style.getPropertyValue('--ry')), rx: parseFloat(cl.style.getPropertyValue('--rx')), moving: cl.classList.contains('foil-moving'), gx: cl.style.getPropertyValue('--gx') }; });
  ok(left.ry < -10.5 && left.ry >= -12.01 && Math.abs(left.rx) <= 4.01, 'mouse at the left tilts it to about -12 deg Y (ry ' + left.ry + ', rx ' + left.rx + ')');
  ok(!left.moving && left.gx !== '', 'foil animation resumes once it settles');
  await pg.mouse.move(1860, 540, { steps: 8 }); await sleep(1200);
  const right = await pg.evaluate(() => parseFloat(window.__game.inspect.clone.style.getPropertyValue('--ry')));
  ok(right > 10.5 && right <= 12.01, 'mouse at the right tilts it to about +12 deg Y (' + right + ')');
  await pg.keyboard.press('1'); await sleep(150);   // a hotkey under the overlay must not play a card
  ok(await pg.evaluate(() => window.__game.state.players[0].hand.map(x => x.uid).join()) === handBefore, 'game hotkeys are ignored while inspecting');
  await pg.keyboard.press('Escape'); await sleep(500);
  const cl1 = await pg.evaluate(() => { const g = window.__game, el = document.querySelector('.hand .card[data-card="tl1"]');
    return { open: document.getElementById('insp').classList.contains('open'), src: g.inspect.src, vis: el && el.style.visibility, paused: g.ui.paused, hand: g.state.players[0].hand.map(x => x.uid).join(), lift: document.querySelector('.insp-lift').children.length }; });
  ok(!cl1.open && !cl1.src && cl1.lift === 0, 'Esc closes the inspect view');
  ok(cl1.vis === '', 'the card is back in its slot');
  ok(!cl1.paused, 'Esc closed the inspect view only (the pause menu did not open)');
  ok(cl1.hand === handBefore, 'inspecting did not play or move any card');

  // ---- 6) a normal card: right-click, subtle sheen, backdrop click closes ----
  const nid = await pg.evaluate(() => [...document.querySelectorAll('.hand .card')].find(c => c.dataset.rar !== 'legendary').dataset.card);
  c = await q(`.hand .card[data-card="${nid}"]`);
  await pg.mouse.click(c.x, c.y + c.h * .3, { button: 'right' }); await sleep(500);
  const nm = await pg.evaluate(() => { const cl = window.__game.inspect.clone; return cl && { foil: cl.querySelectorAll('.foil-l').length, sheen: !!cl.querySelector('.insp-sheen') }; });
  ok(nm && nm.foil === 0 && nm.sheen, 'inspected normal card gets only the subtle sheen, no foil');
  await pg.mouse.click(120, 120); await sleep(500);
  ok(await pg.evaluate((id) => !document.getElementById('insp').classList.contains('open') && document.querySelector(`.hand .card[data-card="${id}"]`).style.visibility === '' && !window.__game.ui.selected, nid), 'a click on the backdrop closes it, nothing selected');

  // ---- 7) deck view: a left-click inspects (it used to close the view); closing returns to the deck view ----
  await pg.evaluate(() => { const g = window.__game, p = g.state.players[0]; if (!p.deck.some(x => x.uid === 'tl_deck')) p.deck.push({ id: 'test_legendary', uid: 'tl_deck' }); g.ui.pile = 'deck'; g.render(); });
  await sleep(300);
  c = await q('.pileview .card[data-rar="legendary"]');
  ok(!!c, 'deck view shows the legendary');
  ok(await pg.evaluate(() => !!document.querySelector('.pileview .card[data-rar="legendary"].foil .foil-sheen')), 'deck view legendary has the foil');
  await pg.mouse.click(c.x, c.y); await sleep(500);
  ok(await pg.evaluate(() => !!window.__game.inspect.src && window.__game.ui.pile === 'deck'), 'left-click on a deck-view card opens the inspect view');
  await pg.keyboard.press('Escape'); await sleep(450);
  ok(await pg.evaluate(() => !window.__game.inspect.src && window.__game.ui.pile === 'deck' && document.querySelector('.pileview .card[data-rar="legendary"]').style.visibility === ''), 'Esc puts it back, the deck view stays open');
  await pg.evaluate(() => { const g = window.__game; g.ui.pile = null; g.state.players[0].deck = g.state.players[0].deck.filter(x => x.uid !== 'tl_deck'); g.render(); });

  // ---- 8) reward screen: right-click inspects, it does not pick ----
  await pg.evaluate(() => { const g = window.__game, s = g.state, p = s.players[0]; s.phase = 'reward'; p.reward = { cards: ['test_legendary', 'frenzied_strike'], gold: 0 }; g.render(); });
  await sleep(300);
  c = await q('.rewards .card[data-rar="legendary"]');
  ok(!!c && await pg.evaluate(() => !!document.querySelector('.rewards .card.foil .foil-sweep')), 'reward screen legendary has the foil');
  await pg.mouse.click(c.x, c.y, { button: 'right' }); await sleep(500);
  ok(await pg.evaluate(() => !!window.__game.inspect.src && window.__game.state.phase === 'reward'), 'right-click on a reward card inspects without picking it');
  await pg.keyboard.press('Escape'); await sleep(450);
  ok(await pg.evaluate(() => !window.__game.inspect.src && window.__game.state.phase === 'reward'), 'closed, still on the reward screen');

  // ---- 8b) pick grids (rest upgrade): right-click inspects, a left-click still picks ----
  await pg.evaluate(() => { const g = window.__game, s = g.state; s.phase = 'rest'; g.ui.upgrading = true; g.render(); });
  await sleep(300);
  c = await q('.upgrid .card[data-act="upgrade"]');
  ok(!!c, 'upgrade grid shows cards');
  await pg.mouse.click(c.x, c.y, { button: 'right' }); await sleep(500);
  ok(await pg.evaluate(() => !!window.__game.inspect.src && window.__game.state.phase === 'rest'), 'right-click in the upgrade grid inspects without upgrading');
  await pg.keyboard.press('Escape'); await sleep(450);
  await pg.mouse.click(c.x, c.y); await sleep(500);
  ok(await pg.evaluate(() => !window.__game.inspect.src && window.__game.state.phase !== 'rest'), 'left-click in the upgrade grid still upgrades (no inspect)');
  await pg.evaluate(() => { window.__game.ui.upgrading = false; });

  // ---- 8c) the screen changes while inspecting and the card is gone: the inspect view closes ----
  await pg.evaluate(() => { const g = window.__game, s = g.state; s.phase = 'rest'; g.ui.upgrading = true; g.render(); });
  await sleep(300);
  c = await q('.upgrid .card[data-act="upgrade"]');
  await pg.mouse.click(c.x, c.y, { button: 'right' }); await sleep(500);
  ok(await pg.evaluate(() => !!window.__game.inspect.src), 'inspecting before the screen change');
  await pg.evaluate(() => { const g = window.__game; g.ui.upgrading = false; g.render(); }); await sleep(450);
  ok(await pg.evaluate(() => !window.__game.inspect.src && !document.getElementById('insp').classList.contains('open') && document.querySelector('.insp-lift').children.length === 0), 'screen change without the card closes the inspect view');

  // ---- 9) compendium: left-click inspects ----
  await pg.evaluate(() => { const g = window.__game; g.ui.screen = 'compendium'; g.ui.compTab = 'cards'; g.ui.compFilter = 'barbarian'; g.render(); });
  await sleep(300);
  c = await q('.compcards .card[data-id="test_legendary"]');
  ok(!!c && await pg.evaluate(() => !!document.querySelector('.compcards .card[data-id="test_legendary"].foil .foil-glitter')), 'compendium legendary has the foil');
  await pg.evaluate(() => document.querySelector('.compcards .card[data-id="test_legendary"]').scrollIntoView({ block: 'center' })); await sleep(200);
  c = await q('.compcards .card[data-id="test_legendary"]');
  await pg.mouse.click(c.x, c.y); await sleep(500);
  ok(await pg.evaluate(() => window.__game.inspect.src && window.__game.inspect.src.dataset.id === 'test_legendary' && window.__game.ui.screen === 'compendium'), 'left-click in the compendium inspects the card');
  await pg.mouse.click(1880, 60); await sleep(450);
  ok(await pg.evaluate(() => !window.__game.inspect.src && window.__game.ui.screen === 'compendium'), 'backdrop click closes it, the compendium stays');

  await b.close();
  ok(!logs.length, 'nothing printed to the console: ' + logs.join(' | '));
  console.log('foil ok (' + n + ' checks)');
})().catch(e => { console.error(e); process.exit(1); });
