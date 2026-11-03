// Drag-to-target regression (Tester, demo.1 selftest: "drag did not play hilt_to_the_teeth", intermittent). A targeted card
// dropped on a monster's drawn body must play on that monster: at rest, mid-lunge, mid-hit-shake, with a boss effect layer
// up, on bosses (boss canvas) and their minions, at 4 window sizes. A monster already dead in the game state is never the target.
const path = require('path');
const puppeteer = require('puppeteer-core');
let n = 0; const fails = [];
const ok = (c, m) => { n++; if (!c) fails.push(m); };
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const [w, h] of [[1440, 860], [1920, 1080], [1366, 768], [3840, 1600]]) {
    const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.setViewport({ width: w, height: h });
    await pg.goto('file://' + path.resolve(__dirname, '../index.html') + '#demo-combat-fighter');
    await pg.waitForFunction(() => window.__game && window.__game.state && window.__game.state.phase === 'combat' && !window.__game.ui.busy && !window.__game.ui.story, { timeout: 60000 });
    const r = await pg.evaluate(async () => {
      const g = window.__game, ui = g.ui, D = window.GameData, E = window.Engine, G = () => g.state, res = [];
      const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
      const ptr = (type, el, x, y) => (el || document.elementFromPoint(x, y) || document.body).dispatchEvent(new PointerEvent(type,
        { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', button: 0, isPrimary: true }));
      const drag = (el, tx, ty) => { const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        ptr('pointerdown', el, x, y); for (let i = 1; i <= 6; i++) ptr('pointermove', null, x + (tx - x) * i / 6, y + (ty - y) * i / 6); ptr('pointerup', null, tx, ty);
        el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
      const body = (sp) => { const r = sp.getBoundingClientRect(), f = +(sp.closest('.unit').dataset.cutf || 0); return { x: r.left + r.width / 2, y: r.top + r.height * f + r.height * (1 - f) / 2 }; };
      let k = 0;
      async function tryOn(tag, foe, prep) {
        const p = G().players[0]; p.energy = 9; p.hp = p.maxHp = 9999; p.endedTurn = false;
        G().enemies.forEach(e => { if (e.hp > 0) { e.hp = Math.max(e.hp, 60); e.block = 0; } });
        const uid = 'dt' + (++k); p.hand.unshift({ id: 'hilt_to_the_teeth', uid }); g.render(); await tick();
        if (prep) prep();
        const sp = document.querySelector(`.unit[data-uid="${foe.uid}"] .sprite`), at = body(sp);
        const hp0 = Object.fromEntries(G().enemies.map(e => [e.uid, e.hp]));
        drag(document.querySelector(`.hand .card[data-card="${uid}"]`), at.x, at.y); await tick();
        const played = !p.hand.some(c => c.uid === uid), hitWho = G().enemies.filter(e => e.hp < hp0[e.uid]).map(e => e.uid);
        res.push([tag, played && hitWho.length === 1 && hitWho[0] === foe.uid, `${tag}: played=${played} hit=${hitWho} want ${foe.uid}(${foe.monsterId})`]);
        p.hand = p.hand.filter(c => c.uid !== uid); ui.busy = false;
      }
      const freeze = (uid, cls, delay) => { const w = document.querySelector(`.unit[data-uid="${uid}"] .sprite-wrap`); w.classList.add(cls); w.style.animationDelay = delay; w.style.animationPlayState = 'paused'; };
      for (const enc of Object.keys(D.ENCOUNTERS)) {
        E.startEncounter(G(), enc); G().phase = 'combat'; E.takeEvents(G()); ui.deadShown = {}; ui.bossFx = {};
        // let bosses bring their minions in (two enemy turns)
        if (D.ENCOUNTERS[enc].boss) for (let t = 0; t < 2; t++) { G().players[0].hp = 9999; E.dispatch(G(), { type: 'END_TURN', player: G().players[0].uid }); E.takeEvents(G()); }
        if (G().phase !== 'combat') continue;
        const bossId = D.ENCOUNTERS[enc].enemies[0], fx = D.BOSS_FX && D.BOSS_FX[bossId];
        for (const foe of E.targetableEnemies(G())) {
          await tryOn(`${enc} ${foe.monsterId} rest`, foe);
          await tryOn(`${enc} ${foe.monsterId} mid-lunge`, foe, () => freeze(foe.uid, 'lunge-left', '-0.171s'));
          await tryOn(`${enc} ${foe.monsterId} mid-hit`, foe, () => freeze(foe.uid, 'hit', '-0.06s'));
          if (fx) { const boss = G().enemies.find(e => e.monsterId === bossId); ui.bossFx[boss.uid] = { fx: Object.values(fx)[0], t0: Date.now() };
            await tryOn(`${enc} ${foe.monsterId} boss effect up`, foe); delete ui.bossFx[boss.uid]; }
          // a neighbour that is dead in the state but not yet drawn dead is never picked, and doesn't block the live one
          const other = E.livingEnemies(G()).find(e => e !== foe && !D.MONSTERS[e.monsterId].boss);
          if (other) { const hp = other.hp; await tryOn(`${enc} ${foe.monsterId} beside a fresh corpse`, foe, () => { other.hp = 0; }); other.hp = hp; }
        }
      }
      // dropping on a monster that just died (state dead, death not drawn yet) never sends a dead target
      { E.startEncounter(G(), 'rat_swarm'); G().phase = 'combat'; E.takeEvents(G()); ui.deadShown = {}; g.render(); await tick();
        const [a] = G().enemies, p = G().players[0]; p.energy = 9; p.hand.unshift({ id: 'hilt_to_the_teeth', uid: 'dz' }); g.render(); await tick();
        a.hp = 0; const sp = document.querySelector(`.unit[data-uid="${a.uid}"] .sprite`), at = body(sp), d0 = E.dispatch; let sent = null;
        E.dispatch = function (s, act) { if (act.type === 'PLAY_CARD') sent = act.target; return d0.apply(this, arguments); };
        drag(document.querySelector('.hand .card[data-card="dz"]'), at.x, at.y); await tick(); E.dispatch = d0;
        res.push(['corpse', sent !== a.uid, 'a drop on a fresh corpse sent it as the target']); }
      // the demo.1 selftest miss: a 0-cost card under No Wasted Motion with empty piles used to reshuffle itself and draw itself
      // straight back. Since Producer 19:27 the card reaches the discard pile only after the draw, so it stays out of the hand;
      // the selftest counts plays, not the hand, either way.
      { E.startEncounter(G(), 'rat_swarm'); G().phase = 'combat'; E.takeEvents(G()); ui.deadShown = {};
        const p = G().players[0]; p.energy = 9; p.hand = [{ id: 'no_wasted_motion', uid: 'nw' }]; E.dispatch(G(), { type: 'PLAY_CARD', player: p.uid, card: 'nw' }); E.takeEvents(G());
        p.hand = [{ id: 'hilt_to_the_teeth', uid: 'self' }]; p.draw = []; p.discard = []; g.render(); await tick();
        const foe = E.targetableEnemies(G())[0], at = body(document.querySelector(`.unit[data-uid="${foe.uid}"] .sprite`)), n0 = p.turnFx.played || 0, hp0 = foe.hp;
        drag(document.querySelector('.hand .card[data-card="self"]'), at.x, at.y); await tick();
        res.push(['self-draw', p.turnFx.played === n0 + 1 && foe.hp < hp0 && !p.hand.some(c => c.uid === 'self') && p.discard.some(c => c.uid === 'self'), `self-draw: played ${p.turnFx.played - n0}, hp ${hp0}->${foe.hp}, back in hand ${p.hand.some(c => c.uid === 'self')}`]); }
      return res;
    });
    for (const [, c, m] of r) ok(c, `${w}x${h} ${m}`);
    ok(!errs.length, `${w}x${h} page errors: ${errs.join(' | ')}`);
    await pg.close();
  }
  await b.close();
  if (fails.length) { console.error('FAIL ' + fails.length + ' of ' + n + '\n' + fails.slice(0, 20).join('\n')); process.exit(1); }
  console.log(`dragtarget ok (${n} checks)`);
})().catch(e => { console.error(e); process.exit(1); });
