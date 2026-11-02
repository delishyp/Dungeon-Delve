/* ============================================================
 * UI — draws the state and turns input into Engine actions.
 * Never changes game state directly; always goes through dispatch.
 * Roleplay narration, speech bubbles and animations are UI-only.
 * ============================================================ */
(function () {
  const D = window.GameData, E = window.Engine, A = window.ASSETS || {};
  const $app = document.getElementById('app'), $fx = document.getElementById('fx'), $tip = document.getElementById('tooltip');
  const $arrow = document.getElementById('arrow'), $arrowPath = document.getElementById('arrowpath');
  const params = location.hash.slice(1);

  let G = null;                 // the game state (plain object)
  let me = null;                // uid of the local player (multiplayer: one per client)
  const ui = { screen: 'title', selected: null, pile: null, busy: false, holdCombat: false, upgrading: false, hoverTarget: null,
    story: null, potionMenu: null, shopRemoving: false, drag: null, deadShown: {}, flavor: {},
    fast: params.includes('selftest') || params.includes('fast') };
  const wait = (ms) => new Promise(r => setTimeout(r, ui.fast ? 0 : ms * window.Settings.speedMul()));
  const S = window.Sfx || { play() {}, music() {}, disable() {} };
  if (ui.fast || /demo-/.test(location.hash)) S.disable();
  const sfx = (n) => { try { S.play(n); } catch (e) {} };
  const P = () => E.getPlayer(G, me);
  const TOUCH = params.includes('touch') || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('touch', TOUCH);
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const img = (k) => A[k] || '';
  const fill = (t) => D.fillNames ? D.fillNames(t) : t;   // {fighter_name} etc. in any shown story/event text

  // ---------- autosave (phones kill background tabs) ----------
  const SAVE_KEY = 'dungeon-delve-save-v3';
  function saveGame() {
    try {
      if (!G || G.phase === 'victory' || G.phase === 'defeat') localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify({ G: { ...G, events: [] }, me, savedAt: Date.now() }));
    } catch (e) { /* storage unavailable (private mode / file://): play on without saving */ }
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !d.G || d.G.version !== 3 || !d.G.players || !D.HEROES[d.G.players[0].heroId]) return null;
      return d;
    } catch (e) { return null; }
  }

  // ---------- text helpers ----------
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kwRe = new RegExp('\\b(' + Object.keys(D.KEYWORDS).join('|') + ')\\b', 'g');
  const withKeywords = (t) => esc(t)
    .replace(kwRe, (m) => `<span class="kw" data-tip="${esc(D.KEYWORDS[m])}">${m}</span>`)
    .replace(/«([+-])(\d+)»/g, (_, s, n) => `<span class="${s === '+' ? 'v-up' : 'v-down'}">${n}</span>`);

  // ---------- small SVG icon set (map rooms, potions, UI) ----------
  const ICON = {
    fight: '<path d="M5 5l14 14M19 19l3-1-1 3M8 22l-3-3M27 5L13 19M13 19l-3-1 1 3M24 22l3-3" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
    elite: '<path d="M6 4c1 5 3 7 6 8M26 4c-1 5-3 7-6 8" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M8 15c0-5 4-7 8-7s8 2 8 7c0 4-2 6-4 7v3h-8v-3c-2-1-4-3-4-7z"/><circle cx="12.5" cy="16" r="2.2" fill="#1a0f0a" stroke="none"/><circle cx="19.5" cy="16" r="2.2" fill="#1a0f0a" stroke="none"/>',
    event: '<path d="M11 11c0-3 2.4-5 5.2-5S21 8 21 11c0 4-5 4-5 8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="16" cy="25" r="2" stroke="none"/>',
    shop: '<path d="M12 7h8l-2 4c5 2 8 6 8 10 0 4-4 6-10 6S6 25 6 21c0-4 3-8 8-10z"/><path d="M16 15v8M13.5 17c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.6-1 1.4-2.5 1.6-2.5.6-2.5 1.6 1 1.6 2.5 1.6 2.5-.6 2.5-1.6" stroke="#1a0f0a" stroke-width="1.4" fill="none"/>',
    rest: '<path d="M16 4c3 5 7 7 7 13a7 7 0 01-14 0c0-3 2-5 3-6 0 3 1 4 2 4 0-4 0-7 2-11z"/><path d="M6 27l20-4M6 23l20 4" stroke-width="2.4" stroke-linecap="round" fill="none"/>',
    treasure: '<path d="M5 13c0-4 5-6 11-6s11 2 11 6v12H5z"/><path d="M5 15h22" stroke="#1a0f0a" stroke-width="1.6"/><rect x="14" y="13" width="4" height="6" rx="1" fill="#1a0f0a" stroke="none"/>',
    boss: '<path d="M6 14c0-6 4.5-10 10-10s10 4 10 10c0 4-2 6-4 7v4h-12v-4c-2-1-4-3-4-7z"/><circle cx="12" cy="15" r="2.6" fill="#1a0f0a" stroke="none"/><circle cx="20" cy="15" r="2.6" fill="#1a0f0a" stroke="none"/>',
  };
  const icon = (k, cls = '') => `<svg class="ico-svg ${cls}" viewBox="0 0 32 32" fill="currentColor" stroke="currentColor">${ICON[k]}</svg>`;
  const flask = (color, empty) => `<svg class="flask" viewBox="0 0 24 32"><path d="M9 2h6v3h-1v6c4 1.5 7 5 7 9.5A9 9 0 013 20.5C3 16 6 12.5 10 11V5H9z" fill="${empty ? 'none' : '#e8e0d0'}" fill-opacity=".18" stroke="#c9a46a" stroke-width="1.4"/>${empty ? '' : `<path d="M5 19c3-1.5 11-1.5 14 0a7.5 7.5 0 01-14 0z" fill="${color}"/><circle cx="9" cy="16.5" r="1.3" fill="#fff" opacity=".6"/>`}</svg>`;
  const I = (n, cls = '', color) => window.Icons.svg(n, 'ico-' + n + ' ' + cls, color);
  const arrow = () => '<svg class="vi arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l12 8-12 8z"/></svg>';
  const medal = (inner, cls = '') => `<span class="medal ${cls}">${inner}</span>`;
  const relicMedal = (id, cls = '') => medal(I(id, 'relic'), cls);
  const statusIcon = (k) => I(k, 'st', window.Icons.STATUS_COLOR[k]);

  // ---------- cards ----------
  function liveTarget() {
    if (ui.hoverTarget) return ui.hoverTarget;
    const l = G && G.phase === 'combat' ? E.livingEnemies(G) : [];
    return l.length === 1 ? l[0].uid : null;
  }
  function cardHTML(c, opts = {}) {
    const def = E.cardDef(c), base = D.CARDS[c.id], fr = D.frameOf(base, c.id);
    const text = E.cardText(opts.live ? G : null, opts.live ? P() : null, c, opts.live ? liveTarget() : null);
    const cls = ['card', def.type, 'fr-' + fr, c.up ? 'upg' : '', opts.cls || ''].join(' ');
    const rar = def.rarity !== 'starter' && def.rarity !== 'curse' ? ' · ' + def.rarity : '';
    const emblem = base.cls === 'curse' ? 'curse' : base.cls;
    return `<div class="${cls}" data-cls="${base.cls}" data-rar="${def.rarity}" data-frame="${fr}" ${opts.attrs || ''}>
      <div class="cface"><img class="cart" src="${img('card_' + c.id)}" alt="" draggable="false"><img class="cframe" src="${img('frame_' + fr)}" alt="" draggable="false">
      ${c.up ? '<div class="uptrim"></div>' : ''}<div class="cname${def.name.length > 15 ? ' long' : ''}"><span>${esc(def.name)}</span></div>
      <div class="cclass" title="${esc(base.cls)}">${I(emblem)}</div>
      <div class="ctype">${def.type}${rar}</div>
      <div class="cdesc"><span>${withKeywords(text)}</span></div></div>
      ${def.unplayable ? '' : `<div class="cost ${def.cost < base.cost ? 'cheaper' : ''}"><span>${def.cost}</span></div>`}</div>`;
  }
  function refreshHandText() {
    if (!G || G.phase !== 'combat') return;
    $app.querySelectorAll('.hand .card').forEach(el => {
      const c = P().hand.find(x => x.uid === el.dataset.card); if (!c) return;
      el.querySelector('.cdesc span').innerHTML = withKeywords(E.cardText(G, P(), c, liveTarget()));
    });
  }

  function statusesHTML(u) {
    return Object.entries(u.statuses).map(([k, n]) => {
      const st = D.STATUSES[k];
      return `<span class="status ${st.debuff ? 'debuff' : 'buff'}" data-tip="<b>${esc(st.name)}</b>: ${esc(st.tip)}">${statusIcon(k)}<b>${n}</b></span>`;
    }).join('');
  }
  const relicTip = (id) => { const r = D.RELICS[id]; return `<b>${esc(r.name)}</b><br>${esc(r.desc)}`; };
  const potionTip = (id) => { const r = D.POTIONS[id]; return `<b>${esc(r.name)}</b><br>${esc(r.desc)}`; };

  function intentHTML(e) {
    const i = E.describeIntent(G, e);
    if (!i) return '';
    let ic = '', text = '';
    const parts = [];
    if (i.damage != null) { ic += I('sword', 'in-atk'); text += i.times > 1 ? `${i.damage}×${i.times}` : `${i.damage}`; parts.push(`attack for ${i.damage} damage${i.times > 1 ? ' ' + i.times + ' times' : ''}`); }
    if (i.block) { ic += I('shield', 'in-blk'); parts.push(`gain ${i.block} Block`); }
    if (i.debuff) { ic += I('skull', 'in-deb'); parts.push('weaken you'); }
    if (i.buff) { ic += I('up', 'in-buf'); parts.push('empower itself or its allies'); }
    return `<div class="intent ${i.kind}" data-tip="${esc(e.name)} intends to use <b>${esc(i.name)}</b>: ${parts.join(', ')}.">${ic} ${text}</div>`;
  }

  // idle "breathing" keeps its phase across re-renders: the delay is derived from the clock
  function idleStyle(u, boss) {
    let h = 0; for (const ch of u.uid + (u.monsterId || u.heroId)) h = (h * 31 + ch.charCodeAt(0)) % 1000;
    const dur = (boss ? 3.6 : 2.6) + (h % 9) / 10;
    const delay = -(((performance.now() / 1000) + h / 37) % dur);
    return `--idur:${dur.toFixed(2)}s;animation-delay:${delay.toFixed(2)}s`;
  }
  function unitHTML(u, isEnemy) {
    const def = isEnemy ? D.MONSTERS[u.monsterId] : D.HEROES[u.heroId];
    const key = isEnemy ? (def.sprite || u.monsterId) : u.heroId;
    const sel = ui.selected && P().hand.find(c => c.uid === ui.selected);
    const dead = u.hp <= 0;
    const targetable = isEnemy && !dead && sel && E.needsTarget(sel);
    const pct = Math.max(0, 100 * u.hp / u.maxHp);
    const h = Math.round((D.SPRITE_H[isEnemy ? u.monsterId : u.heroId] || 170) * (innerWidth >= 1000 && !TOUCH ? 1.25 : 1));   // desktop: bigger, StS-like figures
    const goneCls = dead ? (ui.deadShown[u.uid] ? 'dead gone' : '') : '';
    return `<div class="unit ${isEnemy ? 'enemy' : 'player'} ${def.boss ? 'boss' : ''} ${def.elite ? 'elite' : ''} ${goneCls} ${targetable ? 'targetable' : ''}" data-uid="${u.uid}" style="--sh:${h}px">
      ${isEnemy && !dead ? intentHTML(u) : ''}
      <div class="sprite-wrap"><div class="idle" style="${idleStyle(u, def.boss)}"><img class="sprite" src="${img(key)}" alt="${esc(u.name)}" draggable="false"></div><div class="shadow"></div></div>
      <div class="plate"><div class="uname">${esc(u.name)}${def.elite ? ' <span class="tag">Elite</span>' : ''}${def.boss ? ' <span class="tag">Boss</span>' : ''}</div>
      <div class="hpbar ${u.block ? 'blocked' : ''}">${u.block ? `<div class="blockbadge" data-tip="${esc(D.KEYWORDS.Block)}">${u.block}</div>` : ''}
        <div class="fill" style="width:${pct}%"></div><div class="txt">${u.hp} / ${u.maxHp}</div></div>
      <div class="statuses">${statusesHTML(u)}</div></div></div>`;
  }

  function potionsHTML(p) {
    let h = '';
    for (let i = 0; i < D.POTION_SLOTS; i++) {
      const id = p.potions[i];
      h += id ? `<span class="potslot full ${ui.potionMenu === i ? 'open' : ''}" data-act="potion" data-slot="${i}" data-tip="${esc(potionTip(id))}">${flask(D.POTIONS[id].color)}</span>`
        : `<span class="potslot" data-tip="Empty potion slot. Potions drop from fights and are sold by merchants.">${flask('', true)}</span>`;
    }
    let menu = '';
    if (ui.potionMenu != null && p.potions[ui.potionMenu]) {
      const id = p.potions[ui.potionMenu], def = D.POTIONS[id];
      const can = G.phase === 'combat' ? !ui.busy && !p.endedTurn : def.anywhere;
      menu = `<div class="potmenu"><b>${esc(def.name)}</b><div>${esc(def.desc)}</div>
        <button class="btn small" data-act="drink" data-slot="${ui.potionMenu}" ${can ? '' : 'disabled'}>${can ? 'Drink' : (G.phase === 'combat' ? 'Wait' : 'Only in fights')}</button>
        <button class="btn small ghost" data-act="tosspotion" data-slot="${ui.potionMenu}">Discard</button></div>`;
    }
    return `<span class="potions">${h}${menu}</span>`;
  }
  function topbarHTML() {
    const p = P();
    return `<div class="topbar"><span class="title">Dungeon Delve</span>
      <span class="stat hero" data-tip="${esc(D.HEROES[p.heroId].blurb)}"><img src="${img(p.heroId)}" alt="">${esc(p.name)}</span>
      <span class="stat hp" data-tip="Your hit points. They carry over between fights. If they reach 0, the run is over.">${I('heart')} ${p.hp}/${p.maxHp}</span>
      <span class="stat gold" data-tip="Gold: spend it at merchants (shops and some events).">${I('coin')} ${p.gold}</span>
      <span class="stat deckbtn" data-act="pile" data-pile="deck" data-tip="View your whole deck">${I('deck')} ${p.deck.length}</span>
      ${potionsHTML(p)}
      <span class="relics">${p.relics.map(r => `<span data-tip="${esc(relicTip(r))}">${relicMedal(r)}</span>`).join('')}</span>
      <span class="stat floorname">${esc(D.FLOORS[G.floor].name)}</span>
      <span class="tbbtns"><button class="tbbtn" data-act="qmute" data-tip="${S.muted ? 'Sound is off: click to unmute' : 'Mute sound'}">${I(S.muted ? 'mute' : 'speaker')}</button><button class="tbbtn" data-act="pause" data-tip="Menu &amp; settings (Esc)">${I('gear')}</button></span></div>`;
  }

  function combatHTML() {
    const p = P();
    const enc = D.ENCOUNTERS[G.encounter];
    const hand = p.hand.map((c) => {
      const playable = E.canPlay(G, p, c) && !ui.busy;
      return cardHTML(c, { live: true, cls: (playable ? '' : 'unplayable') + (ui.selected === c.uid ? ' selected' : ''), attrs: `data-act="card" data-card="${c.uid}"` });
    }).join('');
    const sel = ui.selected && p.hand.find(c => c.uid === ui.selected);
    const guard = !!(ui.selected || ui.drag);
    return `${topbarHTML()}
      <div class="field" style="background-image:linear-gradient(#0000 55%,#0a0608ee),url(${img(D.FLOORS[G.floor].bg)})"><div class="scene-name">${esc(enc.scene)} — ${esc(enc.name)}</div>
        <div class="playzone"><span>Release to play</span></div>
        <div class="side heroes">${G.players.map(u => unitHTML(u, false)).join('')}</div>
        <div class="side enemies" style="--ne:${G.enemies.length}">${G.enemies.map(u => unitHTML(u, true)).join('')}</div>
        ${sel && (!E.needsTarget(sel) || E.livingEnemies(G).length === 1) ? `<button class="playbtn" data-act="play">${arrow()} Play ${esc(E.cardDef(sel).name)}</button>` : ''}
        ${sel && E.needsTarget(sel) ? `<div class="hint">${TOUCH ? 'Tap a monster' : 'Click a monster'} to target ${esc(E.cardDef(sel).name)} · ${TOUCH ? 'tap the card again' : 'right-click / Esc'} to cancel</div>` : ''}
        <div class="log">${G.log.slice(-4).map(esc).join('<br>')}</div>
      </div>
      <div class="bottom">
        <div class="pile" data-act="pile" data-pile="draw" data-tip="Draw pile: cards you will draw next. When empty, your discard pile is shuffled back in."><div class="ico">${I('deck')}<b>${p.draw.length}</b></div>Draw</div>
        <div class="energy ${p.energy ? '' : 'empty'}" data-tip="${esc(D.KEYWORDS.Energy)}">${p.energy}/${p.maxEnergy}</div>
        <div class="hand ${p.hand.length > 7 ? 'many' : ''}" style="--n:${Math.max(p.hand.length, 4)}">${hand}</div>
        <div class="rightcol">
          <button class="endturn ${guard ? 'guarded' : ''}" data-act="end" ${ui.busy || G.phase !== 'combat' ? 'disabled' : ''}>${guard ? 'Cancel card' : 'End Turn'}</button>
          <div class="piles2">
            <div class="pile" data-act="pile" data-pile="discard" data-tip="Discard pile: played and discarded cards."><div class="ico">${I('discard')}<b>${p.discard.length}</b></div>Discard</div>
            <div class="pile" data-act="pile" data-pile="exhaust" data-tip="${esc(D.KEYWORDS.Exhaust)}"><div class="ico">${I('exhaust')}<b>${p.exhaust.length}</b></div>Exhaust</div>
          </div>
        </div>
      </div>`;
  }

  // ---------- map ----------
  const mapRowH = () => (innerWidth <= 720 || innerHeight <= 500 ? 60 : 70);
  function nodeXY(n) {
    const C = G.map.cols || 7, RH = mapRowH(), R = G.map.rows.length;
    let h = 0; for (const ch of n.id + G.floor) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const jx = n.type === 'boss' ? 0 : ((h % 21) - 10) / 10, jy = n.type === 'boss' ? 0 : (((h >> 4) % 17) - 8);
    return { x: 7 + (n.col + 0.5 + jx * 0.28) * (86 / C), y: 60 + (R - 1 - n.row) * RH + jy };
  }
  function mapHTML() {
    const reach = E.reachable(G), nodes = Object.values(G.map.nodes);
    const visited = G.visited || [];
    const RH = mapRowH(), H = 60 + G.map.rows.length * RH + 20;
    let lines = '';
    for (const n of nodes) for (const t of n.next) {
      const a = nodeXY(n), b = nodeXY(G.map.nodes[t]);
      const walked = (visited.includes(n.id) || G.pos === n.id) && (visited.includes(t) || G.pos === t);
      const open = G.pos === n.id && reach.includes(t);
      lines += `<line x1="${a.x}%" y1="${a.y}" x2="${b.x}%" y2="${b.y}" class="${walked ? 'walked' : open ? 'open' : ''}"/>`;
    }
    const bossKey = D.ENCOUNTERS[D.FLOORS[G.floor].boss].enemies[0];
    const nh = nodes.map(n => {
      const t = D.NODE_TYPES[n.type], pos = nodeXY(n);
      const shown = n.revealed && n.revealed !== 'event' ? n.revealed : n.type;
      const isBoss = n.type === 'boss';
      const cls = ['mapnode', n.type, reach.includes(n.id) ? 'reachable' : '', visited.includes(n.id) ? 'visited' : '', G.pos === n.id ? 'current' : '',
        !reach.includes(n.id) && !visited.includes(n.id) && n.row <= (G.pos ? G.map.nodes[G.pos].row : -1) ? 'locked' : ''].join(' ');
      const tip = `<b>${t.name}</b><br>${esc(t.tip)}${isBoss ? '<br>' + esc(D.ENCOUNTERS[D.FLOORS[G.floor].boss].name) + ' awaits.' : ''}${n.revealed ? '<br><i>It was: ' + esc(D.NODE_TYPES[n.revealed].name) + '</i>' : ''}`;
      return `<div class="${cls}" data-type="${n.type}" style="left:${pos.x}%;top:${pos.y}px" ${reach.includes(n.id) ? `data-act="node" data-node="${n.id}"` : ''} data-tip="${esc(tip)}">
        ${isBoss ? `<img src="${img(bossKey)}" alt="">` : icon(shown)}${n.revealed && n.revealed !== 'event' ? '<i class="q">?</i>' : ''}</div>`;
    }).join('');
    const legend = ['fight', 'elite', 'event', 'shop', 'rest', 'treasure'].map(k => `<div class="lg ${k}">${icon(k)} ${D.NODE_TYPES[k].name}</div>`).join('');
    return `${topbarHTML()}<div class="mapwrap" style="background-image:linear-gradient(#0e0b10cc,#0e0b10ee),url(${img(D.FLOORS[G.floor].bg)})">
      <div class="maptitle">${esc(D.FLOORS[G.floor].name)}<small>Choose your path. Glowing rooms are reachable. Climb from the bottom to the boss at the top.</small></div>
      <div class="mapscroll"><div class="mapbox" style="height:${H}px"><svg class="maplines">${lines}</svg>${nh}</div></div>
      <div class="legend">${legend}</div></div>`;
  }
  function scrollMap() {
    const sc = $app.querySelector('.mapscroll'); if (!sc) return;
    const targets = [...sc.querySelectorAll('.mapnode.reachable')];
    if (!targets.length) return;
    const y = Math.min(...targets.map(t => t.offsetTop));
    sc.scrollTop = Math.max(0, y - sc.clientHeight * 0.62);
    mapFade(sc);
  }
  function mapFade(sc) {   // fade only the edges that have more map beyond them
    sc.classList.toggle('more-up', sc.scrollTop > 2);
    sc.classList.toggle('more-down', sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2);
  }
  function mapScrollBy(dy, smooth) {
    const sc = $app.querySelector('.mapscroll'); if (!sc) return false;
    sc.scrollBy({ top: dy, behavior: smooth && !ui.fast ? 'smooth' : 'auto' }); return true;
  }
  // mouse click-and-drag panning on the map (touch already scrolls natively); a real drag never counts as a click
  let mapPan = null;
  document.addEventListener('scroll', (e) => { if (e.target && e.target.classList && e.target.classList.contains('mapscroll')) mapFade(e.target); }, true);
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const sc = e.target.closest && e.target.closest('.mapscroll'); if (!sc) return;
    mapPan = { sc, y: e.clientY, top: sc.scrollTop, moved: false, id: e.pointerId };
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!mapPan || e.pointerId !== mapPan.id) return;
    const dy = e.clientY - mapPan.y;
    if (!mapPan.moved && Math.abs(dy) < 6) return;
    if (!mapPan.moved) { mapPan.moved = true; mapPan.sc.classList.add('panning'); hideTip(); }
    mapPan.sc.scrollTop = mapPan.top - dy / Z();
    e.preventDefault();
  }, { passive: false });
  const endPan = () => {
    if (!mapPan) return;
    if (mapPan.moved) { mapPan.sc.classList.remove('panning'); ui.suppressClick = true; setTimeout(() => { ui.suppressClick = false; }, 60); }
    mapPan = null;
  };
  window.addEventListener('pointerup', endPan, true);
  window.addEventListener('pointercancel', endPan, true);

  // ---------- overlays ----------
  function rewardHTML() {
    const p = P(), r = p.reward, fromEvent = G.node === 'event';
    return `<div class="overlay"><div class="panel">${fromEvent ? '<h1>A New Technique</h1>' : '<h1>Victory!</h1>'}
      <div class="relicrow">${r.gold ? `<span class="goldline">${I('coin')} +${r.gold} gold</span>` : ''}
      ${[r.relic, r.bonusRelic].filter(Boolean).map(id => `<span class="lootline" data-tip="${esc(relicTip(id))}">${relicMedal(id, 'big')} <b>${esc(D.RELICS[id].name)}</b> <small>${esc(D.RELICS[id].desc)}</small></span>`).join('')}
      ${r.potion ? `<span class="lootline" data-tip="${esc(potionTip(r.potion.id))}">${flask(D.POTIONS[r.potion.id].color)} <b>${esc(D.POTIONS[r.potion.id].name)}</b> <small>${r.potion.taken ? 'added to your belt' : 'belt full: left behind'}</small></span>` : ''}</div>
      <h2>Choose a card to add to your deck</h2>
      <div class="rewards">${r.cards.map(id => cardHTML({ id }, { attrs: `data-act="reward" data-reward="${id}"` })).join('')}</div>
      <button class="btn ghost" data-act="reward" data-reward="">Skip</button>
      <p class="muted">Your HP carries over (${I('heart')} ${p.hp}/${p.maxHp}).${G.node === 'boss' ? ' After this you descend deeper and recover 75% of your missing HP.' : ''}</p></div></div>`;
  }
  function pickGridHTML(title, sub, cards, back) {
    return `<div class="overlay"><div class="panel wide"><h2>${title}</h2><p class="muted">${sub}</p>
      <div class="pileview upgrid">${cards.join('') || '<p>No cards available.</p>'}</div>
      <button class="btn ghost" data-act="${back}">${back === 'evskip' ? 'Skip' : 'Back'}</button></div></div>`;
  }
  const upgradeCards = (p, act) => p.deck.filter(E.canUpgrade).map(c => cardHTML({ id: c.id, up: true }, { attrs: `data-act="${act}" data-card="${c.uid}"` }));
  const removeCards = (p, act) => p.deck.slice().sort((a, b) => a.id.localeCompare(b.id)).map(c => cardHTML(c, { attrs: `data-act="${act}" data-card="${c.uid}"` }));
  function flavor(kind) { const k = kind + G.floor + G.pos; if (!ui.flavor[k]) ui.flavor[k] = pickOne(D.STORY.rooms[kind]); return ui.flavor[k]; }

  function restHTML() {
    const p = P(), heal = Math.round(p.maxHp * D.REST_HEAL);
    if (ui.upgrading) return pickGridHTML('Train: choose a card to upgrade', 'Shown with their upgraded numbers in green.', upgradeCards(p, 'upgrade'), 'upback');
    return `<div class="overlay"><div class="panel scene"><img class="scene-art" src="${img('ev_campfire')}" alt=""><h1>Rest Site</h1><p class="dm">${esc(flavor('rest'))}</p>
      <div class="choices">
        <div class="choice" data-act="rest" data-choice="heal"><b>Rest</b>Heal ${heal} HP (30% of max).<br><span class="muted">${I('heart')} ${p.hp}/${p.maxHp}</span></div>
        <div class="choice" data-act="rest" data-choice="upgrade"><b>Train</b>Upgrade a card in your deck permanently.</div>
      </div></div></div>`;
  }
  function treasureHTML() {
    const t = P().treasure;
    return `<div class="overlay"><div class="panel scene"><img class="scene-art" src="${img('ev_treasure')}" alt=""><h1>Treasure!</h1><p class="dm">${esc(flavor('treasure'))}</p>
      <div class="goldline">${I('coin')} +${t.gold} gold</div>
      ${t.relic ? `<div class="lootline big">${relicMedal(t.relic, 'big')}<div><b>${esc(D.RELICS[t.relic].name)}</b><br><small>${esc(D.RELICS[t.relic].desc)}</small></div></div>` : '<p>The chest held only gold.</p>'}
      <button class="btn" data-act="leave">Continue</button></div></div>`;
  }
  function eventHTML() {
    const p = P(), ev = G.event, def = D.EVENTS[ev.id];
    if (ev.stage === 'pick') {
      return ev.pick === 'upgrade' ? pickGridHTML('Choose a card to upgrade', 'Upgraded numbers shown in green.', upgradeCards(p, 'evpick'), 'evskip')
        : pickGridHTML('Choose a card to remove', 'It is gone from your deck forever. Curses are good choices.', removeCards(p, 'evpick'), 'evskip');
    }
    const body = ev.stage === 'choose'
      ? `<p class="dm">${esc(fill(def.text))}</p><div class="evchoices">${def.choices.map((c, i) => {
          const ok = E.choiceAllowed(p, c);
          return `<button class="evchoice ${ok ? '' : 'disabled'}" ${ok ? `data-act="evchoice" data-choice="${i}"` : 'disabled'}><b>[${esc(fill(c.label))}]</b> <span>${esc(fill(c.hint || ''))}${ok ? '' : ' (you can\'t afford this)'}</span></button>`;
        }).join('')}</div>`
      : `<p class="dm chosen">» ${esc(fill(def.choices[ev.choice].label))}</p><p class="dm">${esc(fill(ev.result || ''))}</p>
         <div class="evlog">${ev.log.map(l => `<span class="chip ${/^-|Curse/.test(l) ? 'bad' : 'good'}">${esc(l)}</span>`).join('')}</div>
         <button class="btn" data-act="evcontinue">${ev.next && ev.next.fight ? I('swords') + ' Fight!' : ev.next && ev.next.shop ? 'Browse the wares' : 'Continue'}</button>`;
    return `<div class="overlay"><div class="panel event"><img class="scene-art" src="${img(def.art)}" alt=""><div class="evtext"><h1>${esc(def.name)}</h1>${body}</div></div></div>`;
  }
  // ----- the merchant's rug: wares laid out on a blanket, merchant sitting beside it -----
  const MERCHANT_LINES = {
    hello: ['"Customers! Come in, come in! Mind the rug."', '"Everything you see is for sale. Everything has a price, friend."', '"Fresh from the surface! Well… fresh-ish."', '"Browse, browse! Touching is free. Mostly."'],
    buy: ['"A fine choice! You have the eye of a collector."', '"Sold! Pleasure doing business."', '"Ha! That one has been waiting for you."', '"Use it well, and come back alive. Repeat customers are my favourite."'],
    poor: ['"Ah… a little short, friend. Come back with more gold."', '"Credit? Down here? Ha!"', '"Your purse is lighter than your ambition."'],
    removed: ['"Snip! Gone, as if it was never there."'],
  };
  const merchantSay = (k) => { const L = MERCHANT_LINES[k]; ui.shopLine = L[Math.floor(Math.random() * L.length)]; const el = $app.querySelector('.mbubble'); if (el) { el.textContent = ui.shopLine; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } };
  function shopHTML() {
    const p = P(), sh = G.shop;
    if (ui.shopRemoving) return pickGridHTML(`Remove a card (${sh.removeCost} gold)`, 'The merchant\'s "special service". Curses are good choices.', removeCards(p, 'shopremove'), 'shopback');
    if (!ui.shopLine || ui.shopFor !== sh) { ui.shopFor = sh; ui.shopLine = MERCHANT_LINES.hello[Math.floor(Math.random() * MERCHANT_LINES.hello.length)]; }
    const tag = (price, sold, label) => sold ? `<span class="ptag sold">${label || 'Sold'}</span>` : `<span class="ptag ${p.gold < price ? 'poor' : ''}">${I('coin')} ${price}</span>`;
    const ware = (kind, it, i, inner, tip, cls = '') => {
      const poor = !it.sold && p.gold < it.price;
      const act = it.sold ? '' : poor ? `data-act="buypoor"` : `data-act="buy" data-kind="${kind}" data-index="${i}"`;
      return `<div class="ware w-${kind} ${cls} ${it.sold ? 'sold' : ''} ${poor ? 'poor' : ''}" ${act} ${tip ? `data-tip="${esc(tip)}"` : ''}>${inner}${tag(it.price, it.sold)}</div>`;
    };
    const cards = sh.cards.map((it, i) => ware('card', it, i, `<div class="wcard">${cardHTML({ id: it.id })}</div>`, ''));
    const trink = (inner, name) => `<span class="wicon">${inner}</span><b class="wname">${esc(name)}</b>`;
    const relics = sh.relics.map((it, i) => ware('relic', it, i, trink(relicMedal(it.id, 'big'), D.RELICS[it.id].name), relicTip(it.id)));
    const potions = sh.potions.map((it, i) => ware('potion', it, i, trink(flask(D.POTIONS[it.id].color), D.POTIONS[it.id].name), potionTip(it.id), p.potions.length >= D.POTION_SLOTS ? 'beltfull' : ''));
    const svc = { price: sh.removeCost, sold: sh.removed };
    const svcPoor = !svc.sold && p.gold < svc.price;
    const service = `<div class="ware w-service ${svc.sold ? 'sold' : ''} ${svcPoor ? 'poor' : ''}" ${svc.sold ? '' : svcPoor ? 'data-act="buypoor"' : 'data-act="removesvc"'} data-tip="${esc('<b>Card Removal</b><br>The merchant cuts one card out of your deck for good. Great for Curses and weak starting cards.')}">
        ${trink(medal(I('scissors', 'relic'), 'big'), 'Card Removal')}${tag(svc.price, svc.sold, 'Used')}</div>`;
    return `<div class="overlay shopscene" style="--floor:url(${img(D.FLOORS[G.floor].bg)})">
      <div class="merchant"><div class="mbubble">${esc(ui.shopLine)}</div><img class="msprite" src="${img('merchant')}" alt="The merchant"></div>
      <div class="rug" style="--rugimg:url(${img('shop_rug')})">
        <div class="rugwares"><div class="rugrow cards">${cards.join('')}</div><div class="rugrow trinkets">${relics.join('')}${service}${potions.join('')}</div></div>
      </div>
      <div class="shopside">
        <h1>The Merchant</h1>
        <div class="purse" data-tip="Your gold">${I('coin')} <b>${p.gold}</b></div>
        ${sh.discount > 0 ? '<span class="chip good">Haggled: prices lowered</span>' : sh.discount < 0 ? '<span class="chip bad">Offended: prices raised</span>' : ''}
        <p class="muted shophelp">Hover a ware to see what it does. Click to buy.</p>
        ${p.potions.length >= D.POTION_SLOTS ? '<p class="muted shophelp">Your potion belt is full (3 slots).</p>' : ''}
        <button class="btn leavebtn" data-act="leave">Leave the shop</button>
      </div></div>`;
  }
  // a bought ware flies to where it ends up (deck counter, potion belt, relic row)
  function flyWare(el, toSel) {
    if (!el || ui.fast || reduced()) return;
    const r = el.getBoundingClientRect(), t = $app.querySelector(toSel), tr = t ? t.getBoundingClientRect() : { left: r.left, top: 0, width: 0, height: 0 };
    const c = el.cloneNode(true); c.removeAttribute('data-act'); c.removeAttribute('data-tip'); c.classList.add('wareflight');
    const z = Z();
    c.style.cssText = `position:fixed;left:${r.left / z}px;top:${r.top / z}px;width:${r.width / z}px;height:${r.height / z}px;margin:0;z-index:90;pointer-events:none`;
    $fx.appendChild(c);
    const dx = (tr.left + tr.width / 2 - (r.left + r.width / 2)) / z, dy = (tr.top + tr.height / 2 - (r.top + r.height / 2)) / z;
    const a = c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * .3}px,${dy * .3 - 60}px) scale(1.08)`, opacity: 1, offset: .3 },
      { transform: `translate(${dx}px,${dy}px) scale(.15)`, opacity: .3 }], { duration: 650, easing: 'ease-in' });
    a.onfinish = () => c.remove(); setTimeout(() => c.remove(), 1600);
  }
  // ---------- main menu, compendium, settings, pause, dialogs ----------
  const ST = window.Settings;
  const IS_APP = !!(window.ddApp && window.ddApp.isApp);
  const APP_VER = (window.ddApp && window.ddApp.version) || window.GAME_VERSION || '';
  const CAN_UPDATE = IS_APP && !!(window.ddApp.update);
  const D20 = `<svg class="d20svg" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="d20g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0503a"/><stop offset="1" stop-color="#4a0806"/></linearGradient></defs>
    <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="url(#d20g)" stroke="#f3d27a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M50 3L50 22M93 27L78 68M7 27L22 68M50 22L93 27M50 22L7 27M78 68L93 73M22 68L7 73M78 68L50 97M22 68L50 97" stroke="#f3d27a" stroke-width="2" opacity=".7" fill="none"/>
    <polygon points="50,22 78,68 22,68" fill="#0003" stroke="#f3d27a" stroke-width="2.6" stroke-linejoin="round"/>
    <text x="50" y="58" text-anchor="middle" font-size="19" font-weight="bold" fill="#fff5d6" font-family="Georgia,serif">20</text></svg>`;
  function particles(n, seed) {
    let h = '';
    for (let i = 0; i < n; i++) {
      const r = (k) => ((Math.sin((i + 1) * 12.9898 * k + seed) * 43758.5453) % 1 + 1) % 1;
      h += `<i style="left:${(r(1) * 100).toFixed(1)}%;--d:${(7 + r(2) * 9).toFixed(1)}s;--dl:${(-r(3) * 16).toFixed(1)}s;--s:${(1.5 + r(4) * 3).toFixed(1)}px;--dx:${((r(5) - .5) * 120).toFixed(0)}px"></i>`;
    }
    return h;
  }
  function saveSummary(sv) {
    const p = sv.G.players[0];
    return `${esc(D.HEROES[p.heroId].name)} · ${esc(D.FLOORS[sv.G.floor].name.split(':')[0])} · ${I('heart')} ${p.hp}/${p.maxHp}`;
  }
  function titleHTML() {
    const sv = loadSave();
    const cont = sv ? `<button class="menubtn primary" data-act="continue"><span>Continue</span><small>${saveSummary(sv)}</small></button>` : '';
    return `<div class="mainmenu">
      <div class="mm-bg" style="background-image:url(${img('bg_menu')})"></div>
      <div class="mm-glow g1"></div><div class="mm-glow g2"></div><div class="mm-glow g3"></div><div class="mm-eye"></div>
      <div class="mm-fog"></div><div class="mm-embers">${particles(40, 1)}</div><div class="mm-dust">${particles(18, 7)}</div><div class="mm-vignette"></div>
      <div class="mm-panel">
        <div class="mm-logo">${D20}<div><h1>Dungeon <span>Delve</span></h1><small>a Dungeons &amp; Dragons deck-builder</small></div></div>
        <nav class="mm-nav">${cont}
          <button class="menubtn ${sv ? '' : 'primary'}" data-act="${sv ? 'newrun' : 'classes'}"><span>New Run</span><small>${sv ? 'replaces your current run' : 'choose a hero and descend'}</small></button>
          <button class="menubtn" data-act="compendium"><span>Compendium</span><small>cards, relics, potions &amp; monsters</small></button>
          <button class="menubtn" data-act="settings"><span>Settings</span></button>
          <button class="menubtn" data-act="credits"><span>Credits</span></button>
          <button class="menubtn" data-act="quit"><span>Quit</span></button>
        </nav>
        <div class="mm-help"><b>How to play:</b> pick a path on the map. In fights you get 3 Energy and draw 5 cards each turn: <b>drag a card up</b> to play it (drag attacks onto a monster) or click it. Icons above monsters show their next move. Press <b>Esc</b> in a run for the menu. Your run saves automatically.</div>
      </div>
      <div class="mm-ver">v${esc(APP_VER)}<span class="mm-upd">${updCornerHTML()}</span></div></div>`;
  }
  function creditsHTML() {
    return `<div class="overlay modal-over" data-act="closemodal"><div class="panel credits" data-stop="1">${D20}<h1>Credits</h1>
      <p><b>Made by Anna</b> and <b>Gamedev</b>, her game-making assistant.</p>
      <p>Game design inspired by Slay the Spire and Dungeons &amp; Dragons 5e.</p>
      <p>All art was generated for this game. Music and most sound effects are synthesized live in code. The button click and hover come from Kenney's Interface Sounds (kenney.nl, CC0), softened for this game, and Fireball adds a CC0 firework recording (opengameart.org).</p>
      <p class="muted">Version ${esc(APP_VER)}${IS_APP ? ' · desktop app' : ''}</p>
      <p class="muted">Shared with friends, not for sale. Dungeons &amp; Dragons is a trademark of Wizards of the Coast; this is an unofficial fan project.</p>
      <button class="btn" data-act="closemodal">Back</button></div></div>`;
  }
  function farewellHTML() {
    return `<div class="overlay modal-over"><div class="panel credits">${D20}<h1>Farewell, adventurer</h1>
      <p>Your progress is saved. You can close this browser tab now.</p><button class="btn" data-act="closemodal">Back to the menu</button></div></div>`;
  }
  function confirmHTML() {
    const c = ui.confirm;
    return `<div class="overlay modal-over confirm-over"><div class="panel confirm"><h2>${esc(c.title)}</h2><p>${c.text}</p>
      <div class="row"><button class="btn ${c.danger ? 'danger' : ''}" data-act="confirmyes">${esc(c.yes || 'Yes')}</button><button class="btn ghost" data-act="confirmno">Cancel</button>
      ${c.extra ? `<button class="btn small ghost" data-act="confirmextra">${esc(c.extra)}</button>` : ''}</div></div></div>`;
  }
  function askConfirm(opts) { ui.confirm = opts; render(); }

  // ----- compendium -----
  function compendiumHTML() {
    const tab = ui.compTab || 'cards';
    const tabs = [['cards', 'Cards', Object.keys(D.CARDS).length], ['relics', 'Relics', `${ST.seen.count('relics')}/${Object.keys(D.RELICS).length}`],
      ['potions', 'Potions', Object.keys(D.POTIONS).length], ['monsters', 'Monsters', `${ST.seen.count('monsters')}/${Object.keys(D.MONSTERS).length}`]];
    let body = '';
    if (tab === 'cards') {
      const f = ui.compFilter || 'all';
      const ids = Object.keys(D.CARDS).filter(id => f === 'all' || D.CARDS[id].cls === f);
      body = `<div class="cfilters">${['all', 'fighter', 'barbarian', 'wizard', 'curse'].map(k => `<button class="${f === k ? 'on' : ''}" data-act="compfilter" data-f="${k}">${k === 'all' ? 'All' : (k !== 'curse' ? I(k) + ' ' : '') + k[0].toUpperCase() + k.slice(1) + (k === 'curse' ? 's' : '')}</button>`).join('')}
        <button class="${ui.compUp ? 'on' : ''}" data-act="compup">Show upgraded</button></div>
        <div class="compcards">${ids.map(id => cardHTML({ id, uid: 'comp_' + id, up: !!ui.compUp && id.indexOf('curse') !== 0 })).join('')}</div>`;
    } else if (tab === 'relics') {
      body = `<div class="compgrid">${Object.entries(D.RELICS).map(([id, r]) => ST.seen.has('relics', id)
        ? `<div class="comptile">${relicMedal(id, 'big')}<b>${esc(r.name)}</b><small>${esc(r.desc)}</small></div>`
        : `<div class="comptile locked">${medal(I(id, 'relic'), 'big')}<b>???</b><small>${I('lock')} Not found yet</small></div>`).join('')}</div>`;
    } else if (tab === 'potions') {
      body = `<div class="compgrid">${Object.entries(D.POTIONS).map(([id, p]) => `<div class="comptile">${flask(p.color)}<b>${esc(p.name)}</b><small>${esc(p.desc)}</small></div>`).join('')}</div>`;
    } else {
      body = `<div class="compgrid monsters">${Object.entries(D.MONSTERS).map(([id, m]) => {
        const pic = img(m.sprite || id) || img('mimic');
        if (!ST.seen.has('monsters', id)) return `<div class="comptile mon locked"><div class="mpic"><img src="${pic}" alt=""></div><b>???</b><small>${I('lock')} Not met yet</small></div>`;
        const hp = Array.isArray(m.hp) ? m.hp.join('–') : m.hp;
        const moves = Object.values(m.moves || {}).map(mv => esc(mv.name)).join(' · ');
        return `<div class="comptile mon"><div class="mpic"><img src="${pic}" alt=""></div><b>${esc(m.name)}</b><small>${I('heart')} ${hp} HP</small><small class="moves">${moves}</small></div>`;
      }).join('')}</div>`;
    }
    return `<div class="overlay compendium" style="background-image:linear-gradient(#0e0b10e6,#0e0b10f6),url(${img('bg_menu')})">
      <div class="comphead"><h1>${I('book')} Compendium</h1><button class="btn ghost" data-act="title">Back (Esc)</button></div>
      <div class="stabs">${tabs.map(([k, l, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="comptab" data-tab="${k}">${l} <small>${n}</small></button>`).join('')}</div>
      <div class="compbody">${body}</div></div>`;
  }

  // ----- settings -----
  const KEYS = [['1 – 9, 0', 'Select / play the 1st – 9th, 10th card in your hand'], ['E', 'End your turn'], ['Esc', 'Cancel the selected card, close a window, or open the pause menu'],
    ['Tab or D', 'Show / hide your deck'], ['F11', 'Toggle fullscreen'], ['Drag a card up', 'Play it (drag attacks onto a monster)'], ['Click a card', 'Play it; for attacks with several monsters, then click a monster'],
    ['Right-click', 'Cancel the selected card'], ['Enter', 'Confirm a dialog']];
  function isFullscreen() { return IS_APP ? !!ui.appFull : !!document.fullscreenElement; }
  function toggleFullscreen() {
    if (IS_APP) { markResume(); window.ddApp.setFullscreen(!ui.appFull); return; }
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { flashHint('Fullscreen is not available here.'); }
  }
  function settingsHTML() {
    const tab = ui.settingsTab;
    const tabs = [['audio', 'Audio'], ['gameplay', 'Gameplay'], ['display', 'Display'], ['visuals', 'Visuals'], ['controls', 'Controls'], ['data', 'Data']];
    const row = (label, hint, ctl) => `<div class="srow"><span class="slabel">${label}${hint ? `<small>${hint}</small>` : ''}</span><span class="sctl">${ctl}</span></div>`;
    const sw = (on, act, key) => `<button class="toggle ${on ? 'on' : ''}" data-act="${act}" ${key ? `data-key="${key}"` : ''} aria-pressed="${on}"><i></i><span>${on ? 'On' : 'Off'}</span></button>`;
    const tg = (key, label, hint) => row(label, hint, sw(!!ST.get(key), 'stoggle', key));
    const sl = (key, label, v) => row(label, '', `<input type="range" min="0" max="100" value="${Math.round(v * 100)}" data-vol="${key}"><output>${Math.round(v * 100)}%</output>`);
    const seg = (key, label, opts, hint) => row(label, hint, `<span class="seg">${opts.map(([v, l]) => `<button class="${String(ST.get(key)) === String(v) ? 'on' : ''}" data-act="sopt" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</span>`);
    let body = '';
    if (tab === 'audio') body = row('Mute all sound', '', sw(!!S.muted, 'smute')) + sl('master', 'Master volume', S.volume ?? 0.6) + sl('music', 'Music', S.musicVolume ?? 0.7) + sl('sfx', 'Sound effects', S.sfxVolume ?? 0.9)
      + `<p class="muted">All music and sound effects are synthesized live by the game. Sound starts after your first click.</p>`;
    else if (tab === 'gameplay') body = seg('speed', 'Game speed', [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']], 'How long animations, enemy turns and banners take')
      + tg('confirmEnd', 'Confirm End Turn with Energy left', 'Asks before ending your turn while you still have playable cards')
      + tg('tooltips', 'Tooltips &amp; keyword help', 'Hover cards, icons and highlighted words for details')
      + tg('skipNarration', 'Skip DM narration', 'Skips the story text boxes (intros, boss speeches)')
      + tg('damageNumbers', 'Show damage numbers', 'Floating damage, Block and healing numbers');
    else if (tab === 'visuals') body = tg('shake', 'Screen shake', 'A small shake on big hits')
      + tg('reducedMotion', 'Reduced motion', 'Turns off card flights, shakes and menu ambience' + (REDUCED ? ' (your system already asks for this)' : ''))
      + seg('uiScale', 'UI scale', [[90, '90%'], [100, '100%'], [110, '110%'], [125, '125%'], [150, '150%'], [175, '175%']], 'On top of the automatic scaling to your screen size');
    else if (tab === 'display') body = displayTabHTML(row, sw);
    else if (tab === 'controls') body = `<table class="keys">${KEYS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>`;
    else {
      const sv = loadSave();
      body = row('Reset settings', 'Back to the defaults (audio included)', '<button class="btn small" data-act="dreset">Reset</button>')
        + row('Delete saved run', sv ? 'Current run: ' + saveSummary(sv) : 'No run in progress', `<button class="btn small danger" data-act="dwipe" ${sv ? '' : 'disabled'}>Delete</button>`)
        + row('Reset compendium', `Forget the ${ST.seen.count('monsters')} monsters and ${ST.seen.count('relics')} relics you have seen`, '<button class="btn small danger" data-act="dseen">Reset</button>')
        + (CAN_UPDATE ? row('Updates', `You have version ${esc(APP_VER)}${ui.update && ui.update.state === 'none' ? ' · up to date' : ''}`, `<button class="btn small" data-act="updcheck" ${ui.update && /checking|preparing|downloading|downloaded/.test(ui.update.state) ? 'disabled' : ''}>${ui.update && ui.update.state === 'checking' ? 'Checking…' : 'Check for updates'}</button>`) : '')
        + `<p class="muted">Everything is stored only on this computer${IS_APP ? ' (in the game\'s app data folder)' : ' (in this browser)'}.</p>`;
    }
    return `<div class="overlay settings-over"><div class="panel settings"><div class="sthead"><h1>${I('gear')} Settings</h1><button class="btn small ghost" data-act="sclose">Close (Esc)</button></div>
      <div class="stabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="stab" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="stbody">${body}</div></div></div>`;
  }
  // ----- display settings (window mode / size / monitor / vsync live in the desktop app's main process) -----
  const DISP_API = IS_APP && window.ddApp.display ? window.ddApp.display : null;
  const SIZE_PRESETS = [[1280, 720], [1600, 900], [1920, 1080], [2560, 1080], [2560, 1440], [3440, 1440], [3840, 1600], [3840, 2160]];
  function displayTabHTML(row, sw) {
    const st = ui.disp;
    if (!DISP_API || !st) return row('Fullscreen', 'Also F11', sw(isFullscreen(), 'sfull'))
      + `<p class="muted">Window mode, window size, monitor and VSync can be set in the Windows app. In a browser, the browser decides those.</p>`;
    const c = st.cfg, opt = (v, l, on) => `<option value="${v}" ${on ? 'selected' : ''}>${esc(l)}</option>`;
    const mon = st.displays.find(d => d.id === c.displayId) || st.displays.find(d => d.id === st.onDisplay) || st.displays.find(d => d.primary) || st.displays[0];
    const fits = SIZE_PRESETS.filter(([w, h]) => w <= mon.w && h <= mon.h && !(w === mon.w && h === mon.h));
    const cur = c.size ? c.size.join('x') : 'max';
    const sizes = [['max', 'Maximized']].concat(fits.map(([w, h]) => [w + 'x' + h, w + ' x ' + h]), [[mon.w + 'x' + mon.h, `${mon.w} x ${mon.h} (native)`]]);
    if (c.size && !sizes.some(([v]) => v === cur)) sizes.push([cur, c.size.join(' x ')]);
    const modeSeg = `<span class="seg">${[['windowed', 'Windowed'], ['borderless', 'Borderless'], ['fullscreen', 'Fullscreen']].map(([v, l]) => `<button class="${c.mode === v ? 'on' : ''}" data-act="dmode" data-val="${v}">${l}</button>`).join('')}</span>`;
    const win = c.mode === 'windowed';
    return row('Window mode', 'Borderless covers the whole monitor without a frame (quick Alt-Tab). Also F11', modeSeg)
      + row('Window size', win ? 'For windowed mode, centered on the monitor' : 'Used in windowed mode', `<select class="dsel" data-dsel="size" ${win ? '' : 'disabled'}>${sizes.map(([v, l]) => opt(v, l, v === cur)).join('')}</select> <button class="btn small ghost" data-act="dcenter" ${win && c.size ? '' : 'disabled'}>Center</button>`)
      + row('Monitor', st.displays.length > 1 ? 'Where the game opens (remembered)' : 'Only one monitor found', `<select class="dsel" data-dsel="monitor" ${st.displays.length > 1 ? '' : 'disabled'}>${st.displays.map(d => opt(d.id, d.label, d.id === mon.id)).join('')}</select>`)
      + row('VSync', c.vsync !== st.bootVsync ? '<b>Applies after a restart</b>' : 'Off lets the game draw as many frames as it can (may tear). Applies after a restart',
        sw(!!c.vsync, 'dvsync') + (c.vsync !== st.bootVsync ? ' <button class="btn small" data-act="drelaunch">Restart now</button>' : ''))
      + `<p class="muted">The game's animations are drawn by the browser engine in step with your monitor's refresh rate, so there is no separate frame-rate cap. VSync off removes the limit.</p>`;
  }
  function dispPendingHTML() {
    const left = Math.max(0, Math.ceil((ui.dispUntil - Date.now()) / 1000));
    return `<div class="overlay modal-over confirm-over dpend-over"><div class="panel confirm">${D20}<h2>Keep these display settings?</h2>
      <p>Reverting in <b class="dpend-n">${left}</b> s</p><div class="row"><button class="btn" data-act="dkeep">Keep</button><button class="btn ghost" data-act="drevert">Revert</button></div></div></div>`;
  }
  function onDisplayState(st) {
    const wasPending = ui.disp && ui.disp.pending > 0;
    ui.disp = st;
    if (st.pending > 0 && !wasPending) ui.dispUntil = Date.now() + st.pending;
    if (!ui.drag && (ui.settingsTab === 'display' || wasPending !== st.pending > 0)) render();
  }
  if (DISP_API) {
    ui.disp = DISP_API.get(); if (ui.disp.pending > 0) ui.dispUntil = Date.now() + ui.disp.pending;
    DISP_API.onChange(onDisplayState);
    setInterval(() => { const n = $app.querySelector('.dpend-n'); if (n) n.textContent = Math.max(0, Math.ceil((ui.dispUntil - Date.now()) / 1000)); }, 250);
  }
  function markResume() {   // the app may swap in a new window (borderless <-> framed): save so the new one can continue the run
    if (G && ui.screen === 'game') saveGame();
    try { localStorage.setItem('dd-resume', G && ui.screen === 'game' ? '1' : '0'); } catch (err) {}
  }
  function setDisplay(next, confirm) {
    if (!DISP_API) return;
    DISP_API.set(next, confirm).then(onDisplayState);
  }
  // ----- auto-update prompt (desktop app only) -----
  const mb = (b) => (b / 1048576).toFixed(1);
  const updPct = (u) => `${u.percent || 0}%${u.total ? ` · ${mb(u.transferred || 0)} / ${mb(u.total)} MB` : ''}${u.bps ? ` · ${mb(u.bps)} MB/s` : ''}`;
  function updCornerHTML() {   // small status next to the version in the main-menu corner
    const u = CAN_UPDATE && ui.update; if (!u) return '';
    if (u.state === 'checking') return ' · <i class="mini-spin"></i> Checking for updates…';
    if (u.state === 'none' && Date.now() - (ui.updNoneAt || 0) < 4000) return ' · Up to date';
    if (ui.updateBg && (u.state === 'preparing' || u.state === 'downloading')) return ` · Downloading v${esc(u.version || '')} <b class="mm-updpct">${u.percent || 0}%</b>`;
    if (ui.updateBg && u.state === 'downloaded') return ` · <button class="btn small" data-act="updrestart">Restart to update to v${esc(u.version || '')}</button>`;
    return '';
  }
  function updateHTML() {
    const u = ui.update;
    let body;
    if (u.state === 'available') body = `<h2>A new version is available</h2><p>Version <b>${esc(u.version)}</b> is ready (you have ${esc(APP_VER)}).<br>Download it and restart the game? Your saved run and settings are kept.</p>
        ${u.notes ? `<p class="muted updnotes">${esc(u.notes)}</p>` : ''}
        <div class="row"><button class="btn" data-act="upddownload">Download &amp; restart</button><button class="btn ghost" data-act="updbg">Download now, restart later</button><button class="btn ghost" data-act="updlater">Later</button></div>`;
    else if (u.state === 'preparing') body = `<h2>Updating to v${esc(u.version || '')}</h2><div class="updbar indet"><i></i></div><p class="muted updpct">Preparing download…</p>`;
    else if (u.state === 'downloading') body = `<h2>Downloading v${esc(u.version || '')}…</h2>
        <div class="updbar"><i style="width:${u.percent || 0}%"></i></div><p class="muted updpct">${updPct(u)}</p>`;
    else if (u.state === 'downloaded' || u.state === 'install-requested') body = `<h2>Installing v${esc(u.version || '')}…</h2><div class="spinner"></div><p>The game will restart in a moment.</p>`;
    else body = `<h2>Update failed</h2><p>The update could not be downloaded. You can keep playing; it will try again next time.</p><p class="muted">${/sha512|checksum/i.test(u.message || '') ? 'The download was damaged and was thrown away.' : /net::|ENOTFOUND|ECONN|timeout|offline/i.test(u.message || '') ? 'Lost the internet connection.' : esc((u.message || '').slice(0, 90))}</p><div class="row"><button class="btn" data-act="updlater">OK</button></div>`;
    return `<div class="overlay modal-over confirm-over upd-over"><div class="panel confirm updpanel">${D20}${body}</div></div>`;
  }
  const showUpdatePrompt = () => CAN_UPDATE && ui.update && !ui.updateDismissed && (ui.updateConsent || (ui.update.state === 'available' && (ui.screen === 'title' || ui.updateManual)));
  function refreshCorner() { const c = $app.querySelector('.mm-upd'); if (c) c.innerHTML = updCornerHTML(); }
  function startInstall() { if (G && ui.screen === 'game') saveGame();   // never call saveGame() without a run: it would delete the saved one
    ui.update = Object.assign({}, ui.update, { state: 'downloaded' }); ui.updateConsent = true; ui.updateDismissed = false; render(); setTimeout(() => window.ddApp.update.install(), ui.fast ? 0 : 150); }
  function onUpdateStatus(st) {
    if (!st || st.state === 'idle' || st.state === 'disabled') return;
    const prev = ui.update; ui.update = st;
    if (ui.updT0 && !ui.updFirstEventAt) ui.updFirstEventAt = performance.now();
    if (st.state === 'none') { ui.updNoneAt = Date.now(); setTimeout(refreshCorner, 4100); if (ui.updateManual) flashHint('You have the latest version (' + APP_VER + ').'); ui.updateManual = false; }
    if (st.state === 'error' && !ui.updateConsent) { if (ui.updateManual) flashHint('Could not check for updates (offline?).'); else if (ui.updateBg) flashHint('The update could not be downloaded. It will try again next time.'); ui.updateManual = false; ui.updateBg = false; ui.update = null; }
    if (st.state === 'available' && ui.screen !== 'title' && !ui.updateManual && !(prev && prev.state === 'available')) flashHint('Update ' + st.version + ' is available: see the main menu.');
    if (st.state === 'downloaded') {
      if (ui.updateBg && !ui.updateConsent) { flashHint('Update ' + (st.version || '') + ' is ready. Restart from the main menu (or it installs when you quit).'); refreshCorner(); if (ui.screen === 'title') render(); return; }
      if (!ui.updateBg || ui.updateConsent) { startInstall(); return; }
    }
    if (st.state === 'install-requested') { if (!ui.drag) render(); return; }
    if (st.state === 'downloading' && prev && prev.state === 'downloading') {   // cheap progress update, no full re-render
      const bar = $app.querySelector('.upd-over .updbar i');
      if (bar) { bar.style.width = (st.percent || 0) + '%'; const t = $app.querySelector('.upd-over .updpct'); if (t) t.textContent = updPct(st); return; }
      if (ui.updateBg) { const c = $app.querySelector('.mm-updpct'); if (c) c.textContent = (st.percent || 0) + '%'; return; }
    }
    if (ui.updateBg && !ui.updateConsent && ui.screen !== 'title') return;   // background download during a run: stay out of the way
    if (ui.screen === 'title' && !showUpdatePrompt() && !$app.querySelector('.upd-over') && !ui.settingsTab) { refreshCorner(); return; }   // corner-only change: don't rebuild the animated menu
    if (!ui.drag) render();
  }
  function pauseHTML() {
    const p = P();
    return `<div class="overlay pause-over"><div class="panel pausemenu"><h1>Paused</h1>
      <p class="muted">${esc(D.HEROES[p.heroId].name)} · ${esc(D.FLOORS[G.floor].name)} · ${I('heart')} ${p.hp}/${p.maxHp}</p>
      <nav class="mm-nav"><button class="menubtn primary" data-act="resume"><span>Resume</span></button>
        <button class="menubtn" data-act="settings"><span>Settings</span></button>
        <button class="menubtn" data-act="pausedeck"><span>Deck</span><small>${p.deck.length} cards</small></button>
        <button class="menubtn" data-act="savequit"><span>Save &amp; Quit to Main Menu</span></button>
        <button class="menubtn danger" data-act="abandon"><span>Abandon Run</span></button></nav></div></div>`;
  }
  // Resolution-independent scaling: the game is laid out for a 1080-px-tall reference screen and the whole UI
  // (#app, #fx overlays, tooltip) is zoomed to the window height (width-limited for portrait / narrow windows),
  // times the player's UI-scale setting. Pointer + getBoundingClientRect values are in screen px; positions written
  // into the zoomed layers are divided by Z().
  const REF_H = 1080, REF_MIN_W = 1500;
  const baseScale = () => (innerWidth < 1000 || innerHeight < 600 || (TOUCH && Math.min(innerWidth, innerHeight) < 820)) ? 1   // phones / tiny windows keep their own layout
    : Math.max(0.75, Math.min(3, Math.min(innerHeight / REF_H, innerWidth / REF_MIN_W)));
  let zCache = 1;
  const Z = () => zCache;
  function applyScale() {
    const z = baseScale() * (ST.get('uiScale') || 100) / 100;
    zCache = Math.round(z * 1000) / 1000;
    const r = document.documentElement.style;
    r.setProperty('--z', String(zCache));
    r.setProperty('--VH', (innerHeight / zCache / 100).toFixed(3) + 'px');
    r.setProperty('--VW', (innerWidth / zCache / 100).toFixed(3) + 'px');
  }
  const reduced = () => REDUCED || ST.get('reducedMotion') || ST.get('speed') === 'instant';
  function applySettings() {
    const b = document.body;
    b.classList.toggle('reduced', !!reduced());
    b.classList.toggle('speed-fast', ST.get('speed') === 'fast');
    b.classList.toggle('speed-instant', ST.get('speed') === 'instant');
    b.classList.toggle('no-tips', !ST.get('tooltips'));
    applyScale();
    if (ui.screen === 'game' && G) setTimeout(() => layoutHand(false), 0);
  }
  function markSeen() {
    if (!G) return;
    for (const e of G.enemies || []) ST.seen.mark('monsters', e.monsterId);
    const js = JSON.stringify({ ...G, log: null, map: null, events: null });
    for (const id in D.RELICS) if (js.includes('"' + id + '"')) ST.seen.mark('relics', id);
  }
  function toTitle() { G = null; ui.screen = 'title'; ui.paused = false; ui.pile = null; ui.selected = null; ui.story = null; ui.busy = false; ui.holdCombat = false; render(); }
  function classesHTML() {
    const cards = Object.entries(D.HEROES).map(([id, h]) => {
      const counts = {};
      h.deck.forEach(c => counts[D.CARDS[c].name] = (counts[D.CARDS[c].name] || 0) + 1);
      return `<div class="classcard" data-act="pick" data-cls="${id}"><div class="cp"><img src="${img(id)}" alt=""></div><h3>${h.name}</h3>
        <div class="hp">${I('heart')} ${h.maxHp} HP</div><div class="bl">${esc(h.blurb)}</div>
        <div class="mech">${withKeywords(h.mechanic)}</div>
        <div class="dk">Starting deck: ${Object.entries(counts).map(([n, k]) => `${k}× ${esc(n)}`).join(', ')}</div></div>`;
    }).join('');
    return `<div class="overlay" style="background-image:linear-gradient(#0e0b10dd,#0e0b10f4),url(${img('bg_menu')})"><h1>Choose Your Hero</h1><div class="classes">${cards}</div>
      <button class="btn ghost" data-act="title">Back</button></div>`;
  }
  function endHTML(win) {
    const p = P();
    return `<div class="overlay"><div class="panel scene">${win ? `<img class="scene-art" src="${img('ev_treasure')}" alt="">` : `<img class="hero-dead" src="${img(p.heroId)}" alt="">`}
      <h1>${esc(fill(win ? 'You Climbed Out' : 'You Have Fallen'))}</h1>
      <p>${win ? `Your ${esc(p.name)} conquered the dungeon with ${p.hp}/${p.maxHp} HP, ${p.gold} gold, ${p.relics.length} relics and a ${p.deck.length}-card deck.`
               : `Slain on ${esc(D.FLOORS[G.floor].name)} by ${esc(D.ENCOUNTERS[G.encounter].name)}, after ${G.stats.fights} victories and ${G.stats.events} strange encounters.`}</p>
      <div class="row"><button class="btn" data-act="classes">${win ? 'Play Again' : 'Try Again'}</button><button class="btn ghost" data-act="title">Main Menu</button></div></div></div>`;
  }
  function pileHTML() {
    const p = P();
    const cards = (ui.pile === 'deck' ? p.deck : p[ui.pile]).slice().sort((a, b) => a.id.localeCompare(b.id));
    const names = { deck: 'Your Deck', draw: 'Draw Pile (random order)', discard: 'Discard Pile', exhaust: 'Exhausted' };
    return `<div class="overlay" data-act="closepile"><h2>${names[ui.pile]} — ${cards.length} cards</h2>
      <div class="pileview">${cards.map(c => cardHTML(c)).join('') || '<p>Empty.</p>'}</div>
      <button class="btn ghost" data-act="closepile">Close</button></div>`;
  }
  // narration box: tap anywhere to advance
  function storyHTML() {
    const st = ui.story, line = st.lines[st.i];
    return `<div class="storyover" data-act="story">
      <div class="storybox">${line.who ? `<img class="who" src="${img(line.who)}" alt="">` : ''}<div class="storytext"><p>${esc(line.text)}</p>
      <div class="storynav"><span>${st.i + 1} / ${st.lines.length}</span><span class="tapnext">${TOUCH ? 'tap' : 'click'} to continue ${arrow()}</span></div></div></div>
      ${st.lines.length > 1 ? '<button class="btn small ghost skipstory" data-act="skipstory">Skip</button>' : ''}</div>`;
  }

  function render() {
    let html;
    if (ui.screen === 'title') html = titleHTML();
    else if (ui.screen === 'classes') html = classesHTML();
    else if (ui.screen === 'compendium') html = compendiumHTML();
    else if (G.phase === 'combat' || ui.holdCombat) html = combatHTML();
    else if (G.phase === 'map') html = mapHTML();
    else if (G.phase === 'rest') html = mapHTML() + restHTML();
    else if (G.phase === 'treasure') html = mapHTML() + treasureHTML();
    else if (G.phase === 'event') html = mapHTML() + eventHTML();
    else if (G.phase === 'shop') html = mapHTML() + shopHTML();
    else if (G.phase === 'reward') html = (G.node === 'event' ? mapHTML() : combatHTML()) + rewardHTML();
    else html = combatHTML() + endHTML(G.phase === 'victory');
    if (ui.pile && G && ui.screen === 'game') html += pileHTML();
    if (ui.story) html += storyHTML();
    if (ui.paused && G && ui.screen === 'game' && !ui.pile) html += pauseHTML();
    if (ui.settingsTab) html += settingsHTML();
    if (ui.modal === 'credits') html += creditsHTML();
    if (ui.modal === 'farewell') html += farewellHTML();
    if (ui.confirm) html += confirmHTML();
    if (showUpdatePrompt()) { html += updateHTML(); if (!ui.updShownAt) ui.updShownAt = performance.now(); }
    if (ui.screen === 'title' && !ui.firstMenuAt) ui.firstMenuAt = performance.now();   // timings for the update tests
    if (ui.disp && ui.disp.pending > 0) html += dispPendingHTML();
    $app.innerHTML = html;
    markSeen();
    document.body.classList.toggle('is-modal', !!(ui.paused || ui.settingsTab || ui.confirm || ui.modal));
    $tip.style.display = 'none';
    if (G && ui.screen === 'game' && G.phase === 'map') scrollMap();
    layoutHand(true);
    try { S.music(!G || ui.screen !== 'game' ? 'menu' : (G.node === 'boss' && (G.phase === 'combat' || ui.holdCombat)) ? 'boss' : G.floor); } catch (e) {}
  }

  // ---------- StS-style fanned hand ----------
  function layoutHand(animateDraw) {
    const hand = $app.querySelector('.hand');
    if (!hand) { ui.lastHand = null; return; }
    const cards = [...hand.querySelectorAll('.card')], n = cards.length;
    const uids = cards.map(c => c.dataset.card);
    if (!n) { ui.lastHand = uids; return; }
    const W = hand.clientWidth, cw = cards[0].offsetWidth;
    const step = n > 1 ? Math.min(cw * 0.94, (W - cw - 10) / (n - 1)) : 0;   // 0.94: neighbours no longer cover the rules text when there is room
    const x0 = (W - (step * (n - 1) + cw)) / 2, mid = (n - 1) / 2, deg = Math.min(5, 30 / n);
    cards.forEach((el, i) => {
      const k = i - mid;
      el.style.left = (x0 + i * step) + 'px';
      el.style.setProperty('--rot', (k * deg).toFixed(2) + 'deg');
      el.style.setProperty('--fy', (Math.abs(k) * Math.abs(k) * deg * 0.9).toFixed(1) + 'px');
      el.style.zIndex = 10 + i;
      el.onpointerenter = () => { if (ui.drag) return; cards.forEach((o, j) => o.style.setProperty('--px', j < i ? -cw * 0.22 + 'px' : j > i ? cw * 0.22 + 'px' : '0px')); };
      el.onpointerleave = () => cards.forEach(o => o.style.removeProperty('--px'));
    });
    // smooth draw: new cards fly in from the draw pile
    const prev = ui.lastHand; ui.lastHand = uids;
    if (!animateDraw || ui.fast || reduced() || !prev && G.phase !== 'combat') return;
    const pile = $app.querySelector('.pile[data-pile="draw"]'); if (!pile) return;
    const pr = pile.getBoundingClientRect(); let d = 0;
    cards.forEach(el => {
      if (prev && prev.includes(el.dataset.card)) return;
      const r = el.getBoundingClientRect();
      const dx = pr.left + pr.width / 2 - (r.left + r.width / 2), dy = pr.top + pr.height / 2 - (r.top + r.height / 2);
      el.animate([{ transform: `translate(${dx / Z()}px,${dy / Z()}px) scale(.25) rotate(-25deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 380, delay: d, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
      setTimeout(() => sfx('draw'), d); d += 70;
    });
  }
  // a played / discarded card flies to its pile
  function flyCard(el, toSel, delay = 0) {
    if (!el || ui.fast || reduced()) return;
    const r = el.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, z = Z();
    const c = el.cloneNode(true); c.className = el.className.replace(/\b(dragging|aiming|selected|hovered)\b/g, '') + ' flycard';
    c.removeAttribute('data-act'); c.removeAttribute('data-card');
    c.style.cssText = `--cw:${w}px;left:${(r.left + r.width / 2) / z - w / 2}px;top:${(r.top + r.height / 2) / z - h / 2}px;rotate:0deg;translate:none;scale:1`;
    $fx.appendChild(c);
    const go = () => {
      const t = $app.querySelector(toSel); const tr = t ? t.getBoundingClientRect() : { left: innerWidth - 60, top: innerHeight - 60, width: 0, height: 0 };
      const dx = (tr.left + tr.width / 2 - (r.left + r.width / 2)) / z, dy = (tr.top + tr.height / 2 - (r.top + r.height / 2)) / z;
      const a = c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * .35}px,${dy * .35 - 40}px) scale(.7) rotate(12deg)`, opacity: 1, offset: .35 },
        { transform: `translate(${dx}px,${dy}px) scale(.12) rotate(40deg)`, opacity: .2 }], { duration: 480, delay, easing: 'ease-in' });
      a.onfinish = () => c.remove(); setTimeout(() => c.remove(), 1500 + delay);
    };
    requestAnimationFrame(go);
  }

  // ---------- narration ----------
  // lines: [{text, who?}] ; resolves when the player taps through
  function tell(lines) {
    if (!lines || !lines.length || (ST.get('skipNarration') && !ui.fast)) return Promise.resolve();
    return new Promise(res => { ui.story = { lines: lines.map(l => typeof l === 'string' ? { text: fill(l) } : { ...l, text: fill(l.text) }), i: 0, done: res }; render(); });
  }
  function advanceStory(all) {
    const st = ui.story; if (!st) return;
    if (!all && st.i < st.lines.length - 1) { st.i++; render(); return; }
    ui.story = null; render(); st.done();
  }
  const bossLines = (id, which) => D.STORY[which][id].map(t => ({ text: t, who: /^[A-Z][A-Z ]*:/.test(t) ? id : null }));
  function dmCaption(text) {
    const c = document.createElement('div'); c.className = 'dmcaption'; c.textContent = fill(text);
    $fx.appendChild(c); setTimeout(() => c.remove(), ui.fast ? 50 : 3800);
  }
  function speech(uid, text) {
    const el = unitEl(uid); if (!el) return;
    const r = el.querySelector('.sprite').getBoundingClientRect();
    const b = document.createElement('div'); b.className = 'speech'; b.textContent = fill(text);
    b.style.left = (r.left + r.width / 2) / Z() + 'px'; b.style.top = Math.max(70, (r.top - 6) / Z()) + 'px';
    $fx.appendChild(b); setTimeout(() => b.remove(), ui.fast ? 50 : 3200);
  }
  function combatIntro() {
    if (G.phase !== 'combat') return;
    if (G.node === 'fight' || G.node === 'elite') dmCaption(pickOne(D.STORY.rooms[G.node]));
    const foes = E.livingEnemies(G).filter(e => D.STORY.taunts[e.monsterId]);
    if (foes.length) { const f = pickOne(foes); setTimeout(() => speech(f.uid, pickOne(D.STORY.taunts[f.monsterId])), ui.fast ? 0 : 500); }
  }

  // ---------- feedback effects & animations ----------
  function unitEl(uid) { return $app.querySelector(`.unit[data-uid="${uid}"]`); }
  function floatAt(uid, text, cls) {
    const el = unitEl(uid); if (!el) return;
    if (!ST.get('damageNumbers') && /dmg|blk|heal|zero/.test(cls)) return;
    const r = el.querySelector('.sprite').getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float ' + cls; f.innerHTML = text;
    f.style.left = ((r.left + r.width / 2) / Z() + (Math.random() * 40 - 20)) + 'px'; f.style.top = (r.top + r.height * 0.3) / Z() + 'px';
    $fx.appendChild(f); setTimeout(() => f.remove(), 1000);
  }
  function anim(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  const wrapOf = (uid) => unitEl(uid)?.querySelector('.sprite-wrap');
  const spriteOf = (uid) => unitEl(uid)?.querySelector('.sprite');
  function updateBar(uid, hp, block) {
    const el = unitEl(uid); if (!el) return;
    const u = E.find(G, uid); if (!u) return;
    el.querySelector('.fill').style.width = Math.max(0, 100 * hp / u.maxHp) + '%';
    el.querySelector('.txt').textContent = `${hp} / ${u.maxHp}`;
    const b = el.querySelector('.blockbadge');
    if (b) { if (block > 0) b.textContent = block; else b.remove(); }
  }
  function banner(text) {
    const b = document.createElement('div'); b.className = 'banner'; b.textContent = text;
    sfx(text === 'Enemy Turn' ? 'enemyTurn' : text === 'Your Turn' ? 'turn' : 'turn');
    $app.appendChild(b); setTimeout(() => b.remove(), 1000);
  }
  function lunge(uid) { const u = E.find(G, uid); if (u) anim(wrapOf(uid), u.side === 'enemy' ? 'lunge-left' : 'lunge-right'); }
  function showEvent(ev, live, quiet) {
    if (ev.kind === 'hit') {
      const big = ev.amount >= 12;
      if (ev.amount > 0) { floatAt(ev.target, '-' + ev.amount, big ? 'dmg big' : 'dmg'); anim(wrapOf(ev.target), 'hit'); anim(spriteOf(ev.target), 'flash'); if (!quiet) sfx(big ? 'bigHit' : 'hit'); if (big && !reduced() && ST.get('shake')) anim($app, 'shake-screen'); }
      else if (ev.blocked > 0) { floatAt(ev.target, 'Blocked', 'zero'); anim(spriteOf(ev.target), 'glow-block'); sfx('blocked'); }
      if (live) updateBar(ev.target, ev.hp, ev.block);
    } else if (ev.kind === 'cardPlayed') { const cs = CARD_SOUNDS[ev.card]; sfx(cs && S.has && S.has(cs.sound) ? cs.sound : 'card'); if (D.CARDS[ev.card].type === 'attack') lunge(ev.source); }
    else if (ev.kind === 'block') { sfx('block'); floatAt(ev.target, '+' + ev.amount + ' Block', 'blk'); anim(spriteOf(ev.target), 'glow-block'); if (live) updateBar(ev.target, ev.hp, ev.block); }
    else if (ev.kind === 'heal' && ev.amount > 0) { sfx('heal'); floatAt(ev.target, '+' + ev.amount, 'heal'); anim(spriteOf(ev.target), 'glow-heal'); if (live) updateBar(ev.target, ev.hp, ev.block); }
    else if (ev.kind === 'status') {
      const st = D.STATUSES[ev.status]; floatAt(ev.target, `${statusIcon(ev.status)} ${esc(st.name)}`, 'st');
      anim(spriteOf(ev.target), st.debuff ? 'glow-debuff' : 'glow-buff'); sfx(st.debuff ? 'debuff' : 'buff');
    }
    else if (ev.kind === 'relic') floatAt(ev.target, relicMedal(ev.relic), 'st');
    else if (ev.kind === 'potion') { sfx('potion'); floatAt(ev.source, esc(D.POTIONS[ev.potion].name), 'st'); anim(spriteOf(ev.source), 'glow-buff'); }
    else if (ev.kind === 'death') {
      const el = unitEl(ev.target); ui.deadShown[ev.target] = true; sfx('death');
      if (el) { el.classList.add('dead'); el.querySelector('.intent')?.remove(); }
    }
    else if (ev.kind === 'enemyAct') {
      const el = unitEl(ev.source); if (!el) return;
      const mv = D.MONSTERS[E.find(G, ev.source).monsterId].moves;
      if (Object.values(mv).some(m => m.name === ev.name && m.effects.some(f => f.t === 'attack'))) lunge(ev.source);
      const m = document.createElement('div'); m.className = 'movename'; m.textContent = ev.name; el.appendChild(m);
    }
  }
  // A card with its own recorded sound (e.g. Fireball) replaces the generic card + hit sounds, and its hits land on the sound's impact.
  const CARD_SOUNDS = { fireball: { sound: 'spell_fireball', impact: 380 } };
  const playEvents = (events) => {
    let t = 60, own = null;
    for (const ev of events) {
      const at = t, quiet = !!own;
      setTimeout(() => showEvent(ev, false, quiet), ui.fast ? 0 : at);
      if (ev.kind === 'cardPlayed') { const cs = CARD_SOUNDS[ev.card]; own = cs && S.has && S.has(cs.sound) ? cs : null; t += own ? own.impact : 90; }
      else if (!(own && ev.kind === 'hit')) t += 90;   // an explosion's hits land together
    }
  };

  // ---------- actions ----------
  async function act(action) {
    const r = await actInner(action);
    if (r && r.ok) saveGame();
    return r;
  }
  async function afterCombatStory() {
    // boss defeat speech, then victory / defeat epilogue
    if (G.node === 'boss' && (G.phase === 'reward' || G.phase === 'victory')) await tell(bossLines(D.ENCOUNTERS[G.encounter].enemies[0], 'bossDefeat'));
    if (G.phase === 'victory') await tell(D.STORY.victory[P().heroId]);
    if (G.phase === 'defeat') await tell(D.STORY.defeat);
  }
  async function actInner(action) {
    if (ui.busy) return { ok: false };
    const prevFloor = G.floor, g0 = P() ? P().gold : 0, ph0 = G.phase;
    const playedEl = action.type === 'PLAY_CARD' ? cardEl(action.card) : null;
    const res = E.dispatch(G, action);
    if (!res.ok) return res;
    const events = E.takeEvents(G);
    const endedFight = events.some(e => e.kind === 'encounterWon' || e.kind === 'victory' || e.kind === 'defeat');
    ui.hoverTarget = null; ui.potionMenu = null;
    if (P() && P().gold !== g0) setTimeout(() => sfx('gold'), 150);
    if (G.phase === 'victory' && ph0 !== 'victory') setTimeout(() => sfx('victory'), 400);
    if (action.type === 'END_TURN') {
      ui.busy = true;
      $app.querySelectorAll('.hand .card').forEach((c, i) => {
        const gone = P().exhaust.some(x => x.uid === c.dataset.card);
        flyCard(c, gone ? '.pile[data-pile="exhaust"]' : '.pile[data-pile="discard"]', i * 55);
        c.style.transition = 'opacity .15s'; c.style.opacity = 0; });
      const btn = $app.querySelector('.endturn'); if (btn) btn.disabled = true;
      banner('Enemy Turn'); await wait(700);
      for (const ev of events) {
        if (ev.kind === 'enemyAct') await wait(550);
        if (ev.kind === 'playerTurn') { await wait(400); break; }
        showEvent(ev, true);
      }
      if (endedFight) { ui.holdCombat = true; render(); await wait(900); ui.holdCombat = false; }
      ui.busy = false;
      render();
      if (G.phase === 'combat') { banner('Your Turn'); playEvents(events.filter(e => e.kind === 'relic' || e.kind === 'block')); }
      else await afterCombatStory();
      return res;
    }
    if (action.type === 'CHOOSE_NODE' || action.type === 'EVENT_CONTINUE') {
      ui.upgrading = false; ui.shopRemoving = false; ui.deadShown = {};
      if (G.phase === 'combat' && G.node === 'boss') { render(); await tell(bossLines(D.ENCOUNTERS[G.encounter].enemies[0], 'bossIntro')); }
      render();
      if (G.phase === 'combat') { banner(D.ENCOUNTERS[G.encounter].name); playEvents(events); combatIntro(); }
      return res;
    }
    if (action.type === 'USE_POTION' || action.type === 'PLAY_CARD') {
      ui.selected = null;
      if (endedFight) ui.holdCombat = true;
      const p = P(), cu = action.card;
      render();
      if (playedEl) flyCard(playedEl, p.exhaust.some(x => x.uid === cu) ? '.pile[data-pile="exhaust"]' : p.discard.some(x => x.uid === cu) ? '.pile[data-pile="discard"]' : '.energy');
      playEvents(events);
      if (endedFight) { ui.busy = true; await wait(1000); ui.busy = false; ui.holdCombat = false; render(); await afterCombatStory(); }
      return res;
    }
    ui.upgrading = false; ui.shopRemoving = false;
    render();
    if (G.floor !== prevFloor) { await tell(D.STORY.floor[G.floor]); banner(D.FLOORS[G.floor].name); }
    return res;
  }

  function clickCard(cuid) {
    const p = P(), c = p.hand.find(x => x.uid === cuid);
    if (!c || ui.busy) return;
    if (!E.canPlay(G, p, c)) { anim($app.querySelector('.energy'), 'shake'); sfx('error'); return; }
    if (ui.selected === cuid) { ui.selected = null; render(); return; }
    const foes = E.livingEnemies(G);
    if (TOUCH) { ui.selected = cuid; render(); return; }
    if (E.needsTarget(c) && foes.length > 1) { ui.selected = cuid; render(); return; }
    act({ type: 'PLAY_CARD', player: me, card: cuid, target: foes[0] && foes[0].uid });
  }
  function flashHint(t) {
    const h = document.createElement('div'); h.className = 'toast'; h.textContent = t; $fx.appendChild(h); setTimeout(() => h.remove(), ui.fast ? 50 : 2200);
  }
  function endTurnPressed() {
    // guard: a selected (or dragged) card means the player probably forgot to play it
    if (ui.selected || ui.drag) { ui.selected = null; cancelDrag(); render(); flashHint('Card cancelled. Tap End Turn again to end your turn.'); return; }
    if (ui.busy || !G || G.phase !== 'combat') return;
    const p = P();
    if (ST.get('confirmEnd') && !ui.fast && p.energy > 0 && p.hand.some(c => E.canPlay(G, p, c))) {
      askConfirm({ title: 'End your turn?', text: `You still have <b>${p.energy} Energy</b> and cards you can play.`, yes: 'End Turn', extra: "Don't ask again",
        onYes: () => act({ type: 'END_TURN', player: me }), onExtra: () => { ST.set('confirmEnd', false); act({ type: 'END_TURN', player: me }); } });
      return;
    }
    act({ type: 'END_TURN', player: me });
  }

  async function startGame(heroId, seed) {
    G = E.newGame({ seed: seed != null ? seed : Math.floor(Math.random() * 1e9), heroes: [heroId] });
    G.visited = [];
    E.takeEvents(G);
    me = G.players[0].uid;
    ui.screen = 'game'; ui.selected = null; ui.pile = null; ui.busy = false; ui.upgrading = false; ui.flavor = {}; ui.deadShown = {};
    saveGame();
    if (!params.startsWith('demo')) {
      await tell(D.STORY.intro[heroId].map(t => ({ text: t, who: heroId })));
      await tell(D.STORY.floor[0]);
    }
    render(); banner(D.FLOORS[0].name);
  }
  function continueGame() {
    const sv = loadSave(); if (!sv) return;
    G = sv.G; me = sv.me; G.events = []; G.visited = G.visited || [];
    ui.screen = 'game'; ui.selected = null; ui.pile = null; ui.busy = false; ui.upgrading = false; ui.holdCombat = false; ui.deadShown = {};
    for (const e of G.enemies || []) if (e.hp <= 0) ui.deadShown[e.uid] = true;
    render(); banner('Welcome back');
  }
  function goNode(id) {
    G.visited = G.visited || [];
    if (G.pos && !G.visited.includes(G.pos)) G.visited.push(G.pos);
    act({ type: 'CHOOSE_NODE', player: me, node: id });
  }

  // ---------- drag to play ----------
  const cardEl = (cuid) => $app.querySelector(`.hand .card[data-card="${cuid}"]`);
  function playLine() {   // above this y a released card counts as played
    const hand = $app.querySelector('.hand'); if (!hand) return innerHeight * 0.6;
    return hand.getBoundingClientRect().top - 20;
  }
  function enemyAt(x, y) {
    for (const el of $app.querySelectorAll('.unit.enemy:not(.dead)')) {
      const r = el.getBoundingClientRect();
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 40 && y <= r.bottom + 10) return el;
    }
    return null;
  }
  function onDragStart(e) {
    if (ui.busy || ui.story || !G || ui.screen !== 'game' || G.phase !== 'combat') return;
    if (e.button != null && e.button > 0) return;
    const el = e.target.closest && e.target.closest('.hand .card'); if (!el) return;
    const c = P().hand.find(x => x.uid === el.dataset.card);
    if (!c || !E.canPlay(G, P(), c)) return;
    ui.drag = { cuid: c.uid, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, targeted: E.needsTarget(c) };
  }
  function onDragMove(e) {
    const d = ui.drag; if (!d) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.moved && Math.hypot(d.x - d.x0, d.y - d.y0) < 12) return;
    const el = cardEl(d.cuid); if (!el) { cancelDrag(); return; }
    if (!d.moved) {
      d.moved = true; cancelLp(); hideTip();
      if (ui.selected && ui.selected !== d.cuid) { ui.selected = null; $app.querySelectorAll('.hand .card.selected').forEach(x => x.classList.remove('selected')); }
      el.classList.add('dragging'); document.body.classList.add('is-dragging');
      const et = $app.querySelector('.endturn'); if (et) { et.classList.add('guarded'); et.textContent = 'Cancel card'; }
      if (d.targeted) { el.classList.add('aiming'); E.livingEnemies(G).forEach(u => unitEl(u.uid)?.classList.add('targetable')); }
    }
    if (e.cancelable) e.preventDefault();
    const above = d.y < playLine();
    if (!d.targeted) {
      el.style.transform = `translate(${(d.x - d.x0) / Z()}px, ${(d.y - d.y0) / Z()}px) scale(1.08)`;
      $app.querySelector('.field')?.classList.toggle('pz-active', above);
    } else {
      // the card lifts in place; a curved arrow follows the finger and snaps to a hovered monster
      const r = el.getBoundingClientRect();
      const sx = r.left + r.width / 2, sy = r.top + 6;
      const tgt = enemyAt(d.x, d.y);
      $app.querySelectorAll('.unit.enemy.drop-target').forEach(u => { if (u !== tgt) u.classList.remove('drop-target'); });
      let ex = d.x, ey = d.y;
      if (tgt) {
        tgt.classList.add('drop-target');
        const tr = tgt.querySelector('.sprite').getBoundingClientRect(); ex = tr.left + tr.width / 2; ey = tr.top + tr.height * 0.45;
      }
      const nt = tgt ? tgt.dataset.uid : null;
      if (nt !== ui.hoverTarget) { ui.hoverTarget = nt; refreshHandText(); }
      const cx = sx + (ex - sx) * 0.1, cy = Math.min(sy, ey) - Math.abs(ex - sx) * 0.35 - 40;
      $arrowPath.setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`);
      $arrow.classList.add('on'); $arrow.classList.toggle('locked', !!tgt);
    }
  }
  function cancelDrag() {
    const d = ui.drag; ui.drag = null;
    $arrow.classList.remove('on', 'locked'); document.body.classList.remove('is-dragging');
    if (!d) return null;
    const el = cardEl(d.cuid);
    if (el) { el.classList.remove('dragging', 'aiming'); el.style.transform = ''; }
    $app.querySelector('.field')?.classList.remove('pz-active');
    $app.querySelectorAll('.unit.enemy.drop-target').forEach(u => u.classList.remove('drop-target'));
    if (!ui.selected) $app.querySelectorAll('.unit.enemy.targetable').forEach(u => u.classList.remove('targetable'));
    const et = $app.querySelector('.endturn'); if (et && !ui.selected) { et.classList.remove('guarded'); et.textContent = 'End Turn'; }
    return d;
  }
  function onDragEnd() {
    const d0 = ui.drag; if (!d0) return;
    if (!d0.moved) { ui.drag = null; return; }       // a tap: the click handler deals with it
    ui.suppressClick = true; setTimeout(() => { ui.suppressClick = false; }, 80);
    const tgtEl = d0.targeted ? enemyAt(d0.x, d0.y) : null;
    const above = d0.y < playLine();
    const d = cancelDrag();
    const foes = E.livingEnemies(G);
    if (d.targeted) {
      const t = tgtEl ? tgtEl.dataset.uid : (above && foes.length === 1 ? foes[0].uid : null);
      if (t) { ui.selected = null; act({ type: 'PLAY_CARD', player: me, card: d.cuid, target: t }); return; }
    } else if (above) { ui.selected = null; act({ type: 'PLAY_CARD', player: me, card: d.cuid }); return; }
    ui.hoverTarget = null; refreshHandText();   // released back in the hand: cancelled
  }
  $app.addEventListener('pointerdown', onDragStart);
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', () => { if (ui.drag) cancelDrag(); });
  document.addEventListener('touchmove', (e) => { if (ui.drag && ui.drag.moved) e.preventDefault(); }, { passive: false });

  // ---------- clicks ----------
  document.addEventListener('click', (e) => {
    if (ui.suppressClick) { ui.suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    const t = e.target.closest('[data-act]');
    if (TOUCH) hideTip();
    if (ui.potionMenu != null && !(t && ['drink', 'tosspotion', 'potion'].includes(t.dataset.act))) { ui.potionMenu = null; render(); if (!t) return; }
    if (!t) {
      const info = e.target.closest('[data-tip]');
      const unitTarget = e.target.closest('.unit.enemy.targetable');
      if (ui.selected && !unitTarget) { ui.selected = null; render(); e.stopPropagation(); return; }
      if (TOUCH && info && !unitTarget) showTipFor(info);
      return;
    }
    const a = t.dataset.act, d = t.dataset;
    if (a !== 'card' && a !== 'buy') sfx('click');
    const go = (action) => act({ player: me, ...action });
    if (a === 'story') advanceStory(false);
    else if (a === 'skipstory') { e.stopPropagation(); advanceStory(true); }
    else if (a === 'continue') continueGame();
    else if (a === 'play') { const foes = E.livingEnemies(G); go({ type: 'PLAY_CARD', card: ui.selected, target: foes[0] && foes[0].uid }); }
    else if (a === 'classes') { ui.screen = 'classes'; ui.modal = null; render(); }
    else if (a === 'title') { if (ui.screen === 'game') toTitle(); else { ui.screen = 'title'; render(); } }
    else if (a === 'newrun') askConfirm({ title: 'Start a new run?', text: 'Your current run (' + saveSummary(loadSave()) + ') will be lost.', yes: 'Start over', danger: true, onYes: () => { ui.screen = 'classes'; render(); } });
    else if (a === 'confirmyes' || a === 'confirmno' || a === 'confirmextra') { const c = ui.confirm; ui.confirm = null; render(); if (a === 'confirmyes' && c.onYes) c.onYes(); if (a === 'confirmextra' && c.onExtra) c.onExtra(); }
    else if (a === 'compendium') { ui.screen = 'compendium'; ui.compTab = ui.compTab || 'cards'; render(); }
    else if (a === 'comptab') { ui.compTab = d.tab; render(); $app.querySelector('.compbody')?.scrollTo(0, 0); }
    else if (a === 'compfilter') { ui.compFilter = d.f; render(); }
    else if (a === 'compup') { ui.compUp = !ui.compUp; render(); }
    else if (a === 'credits') { ui.modal = 'credits'; render(); }
    else if (a === 'closemodal') { if (e.target.closest('[data-stop]') && e.target.closest('[data-act]') === e.target.closest('.overlay')) return; ui.modal = null; render(); }
    else if (a === 'quit') { if (IS_APP) window.ddApp.quit(); else { ui.modal = 'farewell'; render(); try { window.close(); } catch (err) {} } }
    else if (a === 'settings') { ui.settingsTab = 'audio'; render(); }
    else if (a === 'updcheck') { ui.updateManual = true; ui.updateDismissed = false; window.ddApp.update.check(); }
    else if (a === 'upddownload' || a === 'updbg') {   // instant feedback: show "Preparing download…" before electron-updater says anything
      ui.updT0 = performance.now(); ui.updFirstEventAt = 0;
      ui.updateBg = a === 'updbg'; ui.updateConsent = a === 'upddownload'; ui.settingsTab = null;
      ui.update = Object.assign({}, ui.update, { state: 'preparing', percent: 0 });
      render(); ui.updFeedbackAt = performance.now();
      window.ddApp.update.download();
    }
    else if (a === 'updrestart') startInstall();
    else if (a === 'updlater') { ui.updateDismissed = true; ui.updateConsent = false; ui.updateManual = false; if (ui.update && ui.update.state === 'error') ui.update = null; render(); }
    else if (a === 'stab') { ui.settingsTab = d.tab; if (DISP_API && d.tab === 'display') ui.disp = DISP_API.get(); render(); }
    else if (a === 'dmode') { if (ui.disp && ui.disp.cfg.mode !== d.val) { markResume(); setDisplay({ mode: d.val }, true); } }
    else if (a === 'dvsync') setDisplay({ vsync: !ui.disp.cfg.vsync });
    else if (a === 'drelaunch') { if (G && ui.screen === 'game') saveGame(); DISP_API.relaunch(); }
    else if (a === 'dcenter') DISP_API.center();
    else if (a === 'dkeep') { DISP_API.keep(); ui.disp.pending = 0; render(); }
    else if (a === 'drevert') { DISP_API.revert(); ui.disp.pending = 0; render(); }
    else if (a === 'sclose') { ui.settingsTab = null; render(); }
    else if (a === 'stoggle') { ST.set(d.key, !ST.get(d.key)); render(); }
    else if (a === 'sopt') { ST.set(d.key, /^\d+$/.test(d.val) ? +d.val : d.val); render(); }
    else if (a === 'smute' || a === 'qmute') { S.setMuted(!S.muted); render(); }
    else if (a === 'sfull') { toggleFullscreen(); setTimeout(render, 300); }
    else if (a === 'dreset') askConfirm({ title: 'Reset all settings?', text: 'Audio, gameplay and visual settings go back to their defaults.', yes: 'Reset', onYes: () => { ST.reset(); S.reset && S.reset(); render(); flashHint('Settings reset.'); } });
    else if (a === 'dwipe') askConfirm({ title: 'Delete your saved run?', text: 'This cannot be undone.', yes: 'Delete', danger: true, onYes: () => { try { localStorage.removeItem(SAVE_KEY); } catch (err) {} if (ui.screen === 'game') { ui.settingsTab = null; toTitle(); } else render(); flashHint('Saved run deleted.'); } });
    else if (a === 'dseen') askConfirm({ title: 'Reset the compendium?', text: 'Seen monsters and relics will be locked again.', yes: 'Reset', danger: true, onYes: () => { ST.seen.reset(); render(); flashHint('Compendium reset.'); } });
    else if (a === 'pause') { if (!ui.busy && !ui.story) { ui.paused = true; ui.selected = null; ui.potionMenu = null; render(); } }
    else if (a === 'resume') { ui.paused = false; render(); }
    else if (a === 'pausedeck') { ui.pile = 'deck'; render(); }
    else if (a === 'savequit') { saveGame(); toTitle(); }
    else if (a === 'abandon') askConfirm({ title: 'Abandon this run?', text: 'Your hero and progress on this run will be lost.', yes: 'Abandon run', danger: true, onYes: () => { try { localStorage.removeItem(SAVE_KEY); } catch (err) {} toTitle(); } });
    else if (a === 'pick') startGame(d.cls);
    else if (a === 'card') clickCard(d.card);
    else if (a === 'end') endTurnPressed();
    else if (a === 'reward') go({ type: 'CHOOSE_REWARD', card: d.reward || null });
    else if (a === 'node') goNode(d.node);
    else if (a === 'rest') { if (d.choice === 'heal') go({ type: 'REST', choice: 'heal' }); else { ui.upgrading = true; render(); } }
    else if (a === 'upgrade') go({ type: 'REST', choice: 'upgrade', card: d.card });
    else if (a === 'upback') { ui.upgrading = false; render(); }
    else if (a === 'leave') go({ type: 'LEAVE' });
    else if (a === 'evchoice') go({ type: 'EVENT_CHOICE', choice: +d.choice });
    else if (a === 'evcontinue') go({ type: 'EVENT_CONTINUE' });
    else if (a === 'evpick') go({ type: 'EVENT_PICK', card: d.card });
    else if (a === 'evskip') go({ type: 'EVENT_PICK', card: null });
    else if (a === 'buy') {
      const el = t, kind = d.kind;
      el.classList.add('buying');
      go({ type: 'BUY', kind, index: +d.index }).then(r => {
        if (!r.ok) { el.classList.remove('buying'); flashHint(r.error); return; }
        sfx('gold'); merchantSay('buy');
      });
      flyWare(el.querySelector('.wcard') || el.querySelector('.wicon') || el, kind === 'card' ? '.topbar .deckbtn' : kind === 'potion' ? '.topbar .potions' : '.topbar .relics');
    }
    else if (a === 'buypoor') { sfx('error'); t.classList.remove('nope'); void t.offsetWidth; t.classList.add('nope'); merchantSay('poor'); }
    else if (a === 'removesvc') { ui.shopRemoving = true; render(); }
    else if (a === 'shopback') { ui.shopRemoving = false; render(); }
    else if (a === 'shopremove') { ui.shopRemoving = false; ui.shopLine = MERCHANT_LINES.removed[0]; go({ type: 'SHOP_REMOVE', card: d.card }).then(() => render()); }
    else if (a === 'potion') { ui.potionMenu = ui.potionMenu === +d.slot ? null : +d.slot; render(); }
    else if (a === 'drink') { ui.potionMenu = null; go({ type: 'USE_POTION', slot: +d.slot }).then(r => { if (!r.ok) { flashHint(r.error); render(); } }); }
    else if (a === 'tosspotion') { ui.potionMenu = null; go({ type: 'DISCARD_POTION', slot: +d.slot }); }
    else if (a === 'pile') { ui.pile = d.pile; render(); }
    else if (a === 'closepile') { ui.pile = null; render(); }
  });
  $app.addEventListener('click', (e) => {
    if (ui.suppressClick) return;
    const u = e.target.closest('.unit.enemy.targetable'); if (!u || !ui.selected) return;
    act({ type: 'PLAY_CARD', player: me, card: ui.selected, target: u.dataset.uid });
  });
  document.addEventListener('contextmenu', (e) => { if (ui.selected) { e.preventDefault(); ui.selected = null; render(); } });
  document.addEventListener('keydown', (e) => {
    if (ui.disp && ui.disp.pending > 0) { if (e.key === 'Enter') { e.preventDefault(); DISP_API.keep(); ui.disp.pending = 0; render(); } else if (e.key === 'Escape') { DISP_API.revert(); ui.disp.pending = 0; render(); } return; }
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
    if (ui.confirm) { if (e.key === 'Escape') { ui.confirm = null; render(); } else if (e.key === 'Enter') { e.preventDefault(); const c = ui.confirm; ui.confirm = null; render(); c.onYes && c.onYes(); } return; }
    if (ui.settingsTab) { if (e.key === 'Escape') { ui.settingsTab = null; render(); } return; }
    if (ui.modal) { if (e.key === 'Escape' || e.key === 'Enter') { ui.modal = null; render(); } return; }
    if (ui.story) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') advanceStory(e.key === 'Escape'); return; }
    if (ui.screen === 'compendium' || ui.screen === 'classes') { if (e.key === 'Escape') { ui.screen = 'title'; render(); } return; }
    if (!G || ui.screen !== 'game') return;
    const tag = e.target && e.target.tagName; if (tag === 'INPUT') return;
    if (e.key === 'Escape') {
      if (ui.selected || ui.drag || ui.potionMenu != null || ui.pile) { ui.selected = null; ui.pile = null; ui.potionMenu = null; cancelDrag(); render(); }
      else if (ui.paused) { ui.paused = false; render(); }
      else if (!ui.busy) { ui.paused = true; render(); }
      return;
    }
    if (ui.paused) return;
    if (G.phase === 'map' && !ui.pile && !ui.modal) {
      const sc = $app.querySelector('.mapscroll'), pg = sc ? sc.clientHeight * 0.8 : 400;
      const dy = { ArrowUp: -90, ArrowDown: 90, PageUp: -pg, PageDown: pg, Home: -1e6, End: 1e6 }[e.key];
      if (dy != null && mapScrollBy(dy, true)) { e.preventDefault(); return; }
    }
    if (e.key === 'Tab' || e.key === 'd' || e.key === 'D') { e.preventDefault(); ui.pile = ui.pile === 'deck' ? null : 'deck'; render(); }
    else if ((e.key === 'e' || e.key === 'E') && G.phase === 'combat' && !ui.pile) endTurnPressed();
    else if (/^[0-9]$/.test(e.key) && G.phase === 'combat' && !ui.pile) { const c = P().hand[e.key === '0' ? 9 : +e.key - 1]; if (c) clickCard(c.uid); }
  });
  window.addEventListener('resize', () => { const z0 = zCache; applyScale(); if ((zCache !== z0 || (G && ui.screen === 'game' && G.phase === 'map')) && !ui.busy && !ui.drag) render(); else layoutHand(false); });

  // ---------- tooltips + live damage preview when hovering an enemy ----------
  function hideTip() { $tip.style.display = 'none'; }
  function showTipFor(el, html) {
    $tip.innerHTML = html || el.dataset.tip; $tip.style.display = 'block';
    const r = el.getBoundingClientRect(), w = $tip.offsetWidth, h = $tip.offsetHeight;
    { const z = Z(), W = innerWidth / z, H = innerHeight / z, L = r.left / z, T = r.top / z, B = r.bottom / z, RW = r.width / z;
      $tip.style.left = Math.max(8, Math.min(L + RW / 2 - w / 2, W - w - 8)) + 'px';
      $tip.style.top = (T - h - 10 > 8 ? T - h - 10 : Math.min(B + 10, H - h - 8)) + 'px'; }
  }
  let lp = null;
  function cancelLp() { if (lp) { clearTimeout(lp.timer); lp = null; } }
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const t = e.target.closest && (e.target.closest('[data-tip]') || e.target.closest('.card'));
    if (!t) return;
    const x = e.clientX, y = e.clientY;
    lp = { x, y, timer: setTimeout(() => {
      if (ui.drag && ui.drag.moved) return;
      ui.drag = null;
      if (t.classList.contains('card')) showTipFor(t, `<b>${t.querySelector('.cname').textContent}</b>${t.querySelector('.cost') ? ' (cost ' + t.querySelector('.cost').textContent + ')' : ''}<br>${t.querySelector('.cdesc').innerHTML}`);
      else showTipFor(t);
      ui.suppressClick = true; setTimeout(() => { ui.suppressClick = false; }, 700);
    }, 450) };
  }, { passive: true });
  document.addEventListener('pointerup', cancelLp, { passive: true });
  document.addEventListener('pointercancel', cancelLp, { passive: true });
  document.addEventListener('pointermove', (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 12) cancelLp(); }, { passive: true });
  document.addEventListener('contextmenu', (e) => { if (TOUCH) e.preventDefault(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('mouseover', (e) => {
    if (TOUCH || ui.drag) return;
    const u = e.target.closest && e.target.closest('.unit.enemy');
    const nt = u && u.dataset.uid && !u.classList.contains('dead') ? u.dataset.uid : null;
    if (G && G.phase === 'combat' && nt !== ui.hoverTarget) { ui.hoverTarget = nt; refreshHandText(); }
    const hb = e.target.closest && e.target.closest('.menubtn,.btn,.stabs button,.seg button,.toggle,.cfilters button,.tbbtn,.classcard');
    if (hb && hb !== ui.lastHover && !hb.disabled) sfx('hover');
    ui.lastHover = hb;
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t || !ST.get('tooltips')) { $tip.style.display = 'none'; return; }
    $tip.innerHTML = t.dataset.tip; $tip.style.display = 'block';
  });
  document.addEventListener('mousemove', (e) => {
    if ($tip.style.display === 'none') return;
    const w = $tip.offsetWidth, h = $tip.offsetHeight;
    { const z = Z(); $tip.style.left = Math.min(e.clientX / z + 14, innerWidth / z - w - 8) + 'px';
      $tip.style.top = Math.max(8, e.clientY / z - h - 12) + 'px'; }
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  if (REDUCED) document.body.classList.add('reduced');
  applySettings();
  ST.onChange(() => applySettings());
  $app.addEventListener('change', (e) => {   // display dropdowns
    const el = e.target.closest && e.target.closest('select[data-dsel]'); if (!el || !DISP_API) return;
    if (el.dataset.dsel === 'size') setDisplay({ size: el.value === 'max' ? null : el.value.split('x').map(Number) }, true);
    else setDisplay({ displayId: Number(el.value) });
  });
  // the app's main process starts the update check the moment it launches: pick up its cached result now, then follow its events
  if (CAN_UPDATE && !ui.fast) { window.ddApp.update.onStatus(onUpdateStatus); onUpdateStatus(window.ddApp.update.status()); }
  document.addEventListener('mousemove', (e) => {
    if (ui.screen !== 'title' || reduced()) return;
    const m = $app.querySelector('.mainmenu'); if (!m) return;
    m.style.setProperty('--mx', (e.clientX / innerWidth - .5).toFixed(3)); m.style.setProperty('--my', (e.clientY / innerHeight - .5).toFixed(3));
  }, { passive: true });
  if (IS_APP && window.ddApp.onFullscreen) window.ddApp.onFullscreen((f) => { ui.appFull = f; if (ui.settingsTab === 'display') render(); });
  document.addEventListener('fullscreenchange', () => { if (ui.settingsTab === 'display') render(); });
  // live volume sliders (no re-render while dragging)
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.matches || !t.matches('[data-vol]')) return;
    const v = t.value / 100, k = t.dataset.vol;
    if (k === 'master') S.setVolume(v); else if (k === 'music') S.setMusicVolume(v); else S.setSfxVolume(v);
    const o = t.parentNode.querySelector('output'); if (o) o.textContent = t.value + '%';
  });
  document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('[data-vol]')) sfx('click'); });
  applyScale();
  window.__game = { get scale() { return zCache; }, get state() { return G; }, act, clickCard, startGame, ui, render, tell, playLine };
  render();
  // the desktop app swapped in a new window (switching to / from borderless): pick up right where the player was
  if (IS_APP && /(^|[?&])resume=1/.test(location.search)) {
    let wasInGame = false; try { wasInGame = localStorage.getItem('dd-resume') === '1'; localStorage.removeItem('dd-resume'); } catch (err) {}
    if (wasInGame && loadSave()) continueGame();
    ui.settingsTab = 'display'; render();
  }

  // ---------- dev hooks: #demo-<view>[-hero[-eventId]] for screenshots ----------
  // views: classes | map | combat | event | shop | boss
  if (params.startsWith('demo')) {
    const [, view = 'combat', hero = 'barbarian', extra] = params.split('-');
    if (view === 'classes') { ui.screen = 'classes'; render(); }
    else {
      startGame(hero, 777);
      const s = G, p = s.players[0];
      const autoFight = () => {
        let n = 0;
        while (s.phase === 'combat' && n++ < 300) {
          const c = p.hand.find(x => E.canPlay(s, p, x));
          if (c) E.dispatch(s, { type: 'PLAY_CARD', player: me, card: c.uid, target: E.livingEnemies(s)[0].uid });
          else E.dispatch(s, { type: 'END_TURN', player: me });
        }
      };
      const clear = () => {
        let g = 0;
        while (s.phase !== 'map' && s.phase !== 'defeat' && g++ < 30) {
          if (s.phase === 'combat') autoFight();
          else if (s.phase === 'treasure' || s.phase === 'shop') E.dispatch(s, { type: 'LEAVE', player: me });
          else if (s.phase === 'rest') E.dispatch(s, { type: 'REST', player: me, choice: 'heal' });
          else if (s.phase === 'reward') E.dispatch(s, { type: 'CHOOSE_REWARD', player: me, card: p.reward.cards[0] });
          else if (s.phase === 'event') {
            if (s.event.stage === 'choose') E.dispatch(s, { type: 'EVENT_CHOICE', player: me, choice: D.EVENTS[s.event.id].choices.length - 1 });
            else if (s.event.stage === 'result') E.dispatch(s, { type: 'EVENT_CONTINUE', player: me });
            else E.dispatch(s, { type: 'EVENT_PICK', player: me });
          }
        }
      };
      const step = (pref) => {
        const r = E.reachable(s).map(id => s.map.nodes[id]);
        const n = r.find(x => pref.includes(x.type)) || r[0];
        if (s.pos) G.visited.push(s.pos);
        E.dispatch(s, { type: 'CHOOSE_NODE', player: me, node: n.id });
      };
      p.maxHp = p.hp = 400;   // the demo walk must not die
      step(['fight']); clear(); step(['event', 'fight']); clear(); step(['fight']); clear();
      p.maxHp = D.HEROES[hero].maxHp; p.hp = Math.round(p.maxHp * 0.8);
      p.gold += 180; p.potions = ['healing', 'fire'];
      if (!p.relics.length) p.relics.push('bag_of_holding');
      const fakeEvent = (id) => { s.phase = 'event'; s.node = 'event'; s.event = { id, stage: 'choose', result: null, next: null, pick: null, log: [] }; };
      if (view === 'combat') {
        let guard = 0;
        p.maxHp = p.hp = 400;
        while (guard++ < 10) { step(['fight']); if (s.phase === 'combat' && s.enemies.length > 1) break; clear(); }
        p.maxHp = D.HEROES[hero].maxHp; p.hp = Math.round(p.maxHp * 0.8);
        const r = p.hand.find(c => c.id === 'rage'); if (r) E.dispatch(s, { type: 'PLAY_CARD', player: me, card: r.uid });
      } else if (view === 'boss') {
        s.pos = s.map.rows[s.map.rows.length - 2][0];
        E.dispatch(s, { type: 'CHOOSE_NODE', player: me, node: 'boss' });
      } else if (view === 'event') fakeEvent(extra || 'sleeping_wyrmling');
      else if (view === 'shop') { fakeEvent('wandering_merchant'); E.dispatch(s, { type: 'EVENT_CHOICE', player: me, choice: 0 }); E.dispatch(s, { type: 'EVENT_CONTINUE', player: me }); }
      E.takeEvents(s); render();
      if (view === 'boss') tell(bossLines(D.ENCOUNTERS[s.encounter].enemies[0], 'bossIntro'));
      if (view === 'combat') setTimeout(combatIntro, 300);
    }
  }

  // ---------- #selftest: plays full runs through the real UI (clicks, drags, events, shops, potions, story) ----------
  if (params.includes('selftest')) {
    const errors = [];
    window.addEventListener('error', (e) => errors.push(e.message));
    const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
    const q = (sel) => $app.querySelector(sel);
    const seen = { story: 0, event: 0, shop: 0, buy: 0, drag: 0, dragCancel: 0, tap: 0, potion: 0, guard: 0, removal: 0 };
    const ptr = (type, el, x, y) => (el || document.elementFromPoint(x, y) || document.body).dispatchEvent(new PointerEvent(type,
      { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', button: 0, isPrimary: true }));
    async function dragCard(el, toX, toY) {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      ptr('pointerdown', el, x, y);
      for (let i = 1; i <= 6; i++) ptr('pointermove', null, x + (toX - x) * i / 6, y + (toY - y) * i / 6);
      ptr('pointerup', null, toX, toY);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));  // browsers fire a click after pointerup; it must be ignored
      await tick();
    }
    async function settle() {
      let g = 0;
      while ((ui.busy || ui.story) && g++ < 600) { if (ui.story) { q('[data-act="story"]').click(); seen.story++; } await tick(2); }
    }
    async function combatTurn(turnNo) {
      const pot = q('[data-act="potion"]');
      if (pot && turnNo % 3 === 0) {
        pot.click(); await tick();
        const dr = q('[data-act="drink"]:not([disabled])');
        if (dr) { dr.click(); seen.potion++; } else q('.field').click();
        await tick(); await settle();
      }
      let guard = 0;
      while (G.phase === 'combat' && guard++ < 15) {
        const el = [...$app.querySelectorAll('.hand .card:not(.unplayable)')][0];
        if (!el) break;
        const c = P().hand.find(x => x.uid === el.dataset.card), e0 = P().energy, h0 = P().hand.length;
        const mode = (guard + turnNo) % 3;     // 0: drag to play, 1: click/tap flow, 2: drag back into the hand (cancel), then drag to play
        if (mode !== 1) {
          if (mode === 2) {
            const r = el.getBoundingClientRect(); await dragCard(el, r.left + r.width / 2 + 20, r.top + r.height / 2 - 4);
            if (!P().hand.some(x => x.uid === c.uid) || P().energy !== e0) throw new Error('drag released in the hand still played the card');
            seen.dragCancel++;
          }
          const foe = q('.unit.enemy:not(.dead) .sprite'), fr = foe && foe.getBoundingClientRect();
          const to = E.needsTarget(c) && fr ? [fr.left + fr.width / 2, fr.top + fr.height / 2] : [innerWidth / 2, playLine() - 120];
          await dragCard(cardEl(c.uid) || el, to[0], to[1]);
          seen.drag++;
          await settle();
          if (G.phase === 'combat' && P().hand.some(x => x.uid === c.uid)) throw new Error('drag did not play ' + c.id);
          continue;
        }
        seen.tap++;
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.click(); await tick();
        if (ui.selected && !seen.guardThisTurn) {
          // End Turn guard: with a card selected, End Turn only cancels the selection
          seen.guardThisTurn = true;
          const t0 = G.turn; q('.endturn').click(); await tick();
          if (G.turn !== t0 || ui.selected) throw new Error('End Turn guard failed');
          seen.guard++;
          cardEl(c.uid).click(); await tick();
        }
        const pb = q('.playbtn'); if (pb) { pb.click(); await settle(); continue; }
        const tgt = q('.unit.enemy.targetable');
        if (tgt) { tgt.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); tgt.click(); await tick(); }
        await settle();
      }
      seen.guardThisTurn = false;
      if (G.phase === 'combat') { const b = q('.endturn'); if (b) b.click(); }
      await tick(2); await settle();
    }
    (async () => {
      const results = [];
      try {
        for (const cls of Object.keys(D.HEROES)) {
          for (let run = 0; run < 3; run++) {
            q('[data-act="classes"]') ? q('[data-act="classes"]').click() : (ui.screen = 'classes', render());
            await tick(); q(`[data-act="pick"][data-cls="${cls}"]`).click(); await tick(); await settle();
            if (run > 0) { G.players[0].maxHp = G.players[0].hp = 999; }   // runs 1-2 reach the final boss
            let steps = 0, turnNo = 0;
            while (G.phase !== 'victory' && G.phase !== 'defeat' && steps++ < 3000) {
              await settle();
              if (G.phase === 'map') {
                const pref = run === 0 ? ['event', 'shop'] : run === 1 ? ['shop', 'event'] : ['fight', 'elite'];
                const nodes = [...$app.querySelectorAll('.mapnode.reachable')];
                (nodes.find(n => pref.includes(n.dataset.type)) || nodes[0]).click(); await tick();
              } else if (G.phase === 'reward') { q('[data-act="reward"]').click(); await tick(); }
              else if (G.phase === 'treasure') { q('[data-act="leave"]').click(); await tick(); }
              else if (G.phase === 'event') {
                seen.event++;
                if (G.event.stage === 'choose') { const ch = [...$app.querySelectorAll('[data-act="evchoice"]')]; ch[(steps + run) % ch.length].click(); }
                else if (G.event.stage === 'result') q('[data-act="evcontinue"]').click();
                else (q('[data-act="evpick"]') || q('[data-act="evskip"]')).click();
                await tick();
              } else if (G.phase === 'shop') {
                seen.shop++;
                const b = q('[data-act="buy"]:not(.poor)');
                if (b) { const g0 = P().gold; b.click(); await tick(); if (P().gold < g0) seen.buy++; }
                const svc = q('[data-act="removesvc"]');
                if (svc) { svc.click(); await tick(); const c = q('[data-act="shopremove"]'); if (c) { c.click(); seen.removal++; } await tick(); }
                q('[data-act="leave"]').click(); await tick();
              } else if (G.phase === 'rest') {
                if (run === 1) { q('[data-act="rest"][data-choice="upgrade"]').click(); await tick(); q('[data-act="upgrade"]').click(); }
                else q('[data-act="rest"][data-choice="heal"]').click();
                await tick();
              } else if (G.phase === 'combat') await combatTurn(++turnNo);
            }
            await settle();
            const deckBtn = q('[data-pile="deck"]'); if (deckBtn) { deckBtn.click(); await tick(); q('[data-act="closepile"]').click(); }
            results.push(`${cls}:${G.phase}@F${G.floor + 1}`);
            if (run === 0) {
              // save / continue round-trip
              ui.screen = 'classes'; render(); q(`[data-act="pick"][data-cls="${cls}"]`).click(); await tick(); await settle();
              q('.mapnode.reachable').click(); await tick(); await settle();
              const before = JSON.stringify(G);
              ui.screen = 'title'; G = null; render();
              const cbtn = q('[data-act="continue"]');
              if (!cbtn) throw new Error('no Continue button after save');
              cbtn.click(); await tick();
              if (JSON.stringify(G) !== before) throw new Error('continue restored a different state');
              results.push(cls + ':save-ok');
            }
            ui.screen = 'classes'; render();
          }
        }
        for (const k of ['story', 'event', 'shop', 'buy', 'drag', 'dragCancel', 'tap', 'guard']) if (!seen[k]) throw new Error('selftest never exercised ' + k);
      } catch (ex) { errors.push(String(ex && ex.stack || ex)); }
      delete seen.guardThisTurn;
      results.push('seen=' + JSON.stringify(seen));
      document.title = (errors.length ? 'SELFTEST FAIL ' + errors.join(' | ') : 'SELFTEST PASS') + ' ' + results.join(',');
      document.body.setAttribute('data-selftest', document.title);
    })();
  }
})();
