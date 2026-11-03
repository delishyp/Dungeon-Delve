/* ============================================================
 * ENGINE — all game rules. No DOM access here.
 * The whole game is one plain, JSON-serializable `state` object.
 * Everything changes through Engine.dispatch(state, action), so the
 * same engine can later run on a server / peer for multiplayer.
 * `state.players` is an array (v1 has one hero) to leave room for co-op;
 * a race mode can simply run one state per player with the same seed.
 *
 * Phases: 'map' -> 'combat' -> 'reward' -> 'map' … 'rest' | 'treasure' | 'event' | 'shop' …
 *         boss -> next floor map … final boss -> 'victory'. Or 'defeat'.
 * ============================================================ */
(function (root) {
  let D = root.GameData;
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports) { D = require('./data.js'); require('./content.js'); }

  // ---------- seeded RNG (lives in state.rng so saves/replays are exact) ----------
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (s, lo, hi) => lo + Math.floor(rand(s) * (hi - lo + 1));
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  function shuffle(s, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  function weightedPick(s, weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    let r = rand(s) * entries.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
    return entries[entries.length - 1][0];
  }
  const uid = (s, p) => p + (s.uidCounter++);

  // ---------- card definitions (with upgrades) ----------
  const upCache = {};
  function upgradeDef(id) {
    if (upCache[id]) return upCache[id];
    const b = D.CARDS[id];
    // A hand-written upgrade (deck_styles_v1.md "Upgraded:" lines) replaces the generic one.
    if (b.upgrade) {
      const u = b.upgrade;
      return (upCache[id] = { ...b, ...u, name: b.name + '+', cost: u.cost != null ? u.cost : b.cost,
        effects: (u.effects || b.effects).map(f => ({ ...f })), power: u.power || b.power, upgraded: true });
    }
    let changed = false;
    const effects = b.effects.map(fx => {
      const f = { ...fx };
      if (f.t === 'damage' || f.t === 'damageAll') { f.n += (f.times || 1) > 1 ? 1 : (f.n >= 12 ? 5 : 3); changed = true; }
      else if (f.t === 'block') { f.n += 3; changed = true; }
      else if (f.t === 'heal') { f.n += 3; changed = true; }
      else if (f.t === 'status' && !(f.to === 'self' && D.STATUSES[f.status].debuff)) { f.n += 1; changed = true; }
      return f;
    });
    let cost = b.cost;
    if (!changed) {
      if (cost > 0) cost--; else { const d = effects.find(f => f.t === 'draw'); if (d) d.n++; }
    }
    return (upCache[id] = { ...b, name: b.name + '+', cost, effects, upgraded: true });
  }
  const cardDef = (c) => (c.up ? upgradeDef(c.id) : D.CARDS[c.id]);
  const canUpgrade = (c) => !c.up && D.CARDS[c.id].type !== 'curse' && D.CARDS[c.id].type !== 'status';
  // ---------- keywords (Anna 11:33, Producer 11:34/11:35/11:41; wording lore/text/how_to_play_v1.md section 3) ----------
  // Eternal: the card can never be removed from the deck in any way (shop removal, event removal, "remove all curses",
  // transforms, Vanish, any remove-a-card effect). It can still be upgraded (canUpgrade does not look at it).
  const isEternal = (c) => !!(D.CARDS[c.id] && D.CARDS[c.id].eternal);
  const canRemove = (c) => !isEternal(c);
  const canTransform = canRemove;
  // The one path every out-of-combat removal goes through. Returns false (and removes nothing) for an Eternal card.
  function removeFromDeck(s, p, c) {
    if (!c || !canRemove(c) || !p.deck.includes(c)) return false;
    p.deck = p.deck.filter(x => x !== c);
    return true;
  }
  // Transform hook (no card or event transforms yet): swaps a deck card for another id, never an Eternal one.
  function transformCard(s, p, c, newId) {
    if (!c || !canTransform(c) || !p.deck.includes(c) || !D.CARDS[newId]) return false;
    const i = p.deck.indexOf(c); p.deck[i] = { uid: uid(s, 'c'), id: newId };
    return true;
  }
  // Repeat X: the card's effect happens X times in total (Producer 11:35). Replay: the card is played once more (2 plays,
  // never stacks past one extra, Producer 11:41), so Replay + Repeat X = 2xX.
  const repeatOf = (def) => Math.max(1, Math.floor(def.repeat || 1));
  const playsOf = (def) => (def.replay ? 2 : 1);
  // Fading (how_to_play_v1, keyword_use_v2 part 3, Producer 11:56): each play this fight drops the card's one number by 1
  // (fightPlays: Replay counts 2, Repeat 1); at 0 it Exhausts; back to full next fight (each fight deals fresh copies).
  const fadeDrop = (def, c) => (def.fading ? (c.fightPlays || 0) : 0);
  const fadeFx = (def, c, effects) => { const d = fadeDrop(def, c); return d ? effects.map(f => (f.n != null ? { ...f, n: Math.max(0, f.n - d) } : f)) : effects; };
  const fadeLeft = (def, c) => { const f = def.effects.find(x => x.n != null); return f ? Math.max(0, f.n - fadeDrop(def, c)) : 0; };
  // Bloodied (how_to_play_v1): the Bloodied line only counts while you're at half your HP or less; checked when played.
  const isBloodied = (p) => !!p && p.hp > 0 && p.hp * 2 <= p.maxHp;

  // ---------- helpers ----------
  const alive = (e) => !!e && e.hp > 0;
  const livingEnemies = (s) => s.enemies.filter(alive);
  const livingPlayers = (s) => s.players.filter(alive);
  // A monster with `guardedBy: <id>` can't be picked by single-target cards while one of those minions lives
  // (the Surgeon while a Sewn stands). Attacks that hit ALL enemies still hit it.
  const guardedNow = (s, e) => { const g = D.MONSTERS[e.monsterId].guardedBy; return !!g && s.enemies.some(x => x !== e && alive(x) && x.monsterId === g); };
  const isTargetable = (s, e) => alive(e) && e.side === 'enemy' && !guardedNow(s, e);
  const targetableEnemies = (s) => s.enemies.filter(e => isTargetable(s, e));
  // Keeps the visible "Held Together" status in step with the rule above.
  function syncGuards(s) {
    for (const e of s.enemies) {
      if (!D.MONSTERS[e.monsterId].guardedBy) continue;
      if (alive(e) && guardedNow(s, e)) e.statuses.held = 1; else delete e.statuses.held;
    }
  }
  function find(s, id) { return s.players.find(p => p.uid === id) || s.enemies.find(e => e.uid === id) || null; }
  function getPlayer(s, id) { return id ? s.players.find(p => p.uid === id) : s.players[0]; }
  function emit(s, ev) { s.events.push(ev); }
  function log(s, msg) { s.log.push(msg); if (s.log.length > 60) s.log.shift(); }
  const hasRelic = (p, id) => p.relics.includes(id);

  // ---------- creation ----------
  function makePlayer(s, heroId, name) {
    const h = D.HEROES[heroId];
    return {
      uid: uid(s, 'p'), side: 'player', heroId, name: name || h.name,
      hp: h.maxHp, maxHp: h.maxHp, block: 0, statuses: {}, fresh: {},
      energy: 0, maxEnergy: h.energy, handSize: h.handSize, gold: 0, relics: [],
      deck: h.deck.map(id => ({ uid: uid(s, 'c'), id })),
      draw: [], hand: [], discard: [], exhaust: [], powers: [],
      endedTurn: false, reward: null, treasure: null, potions: [], removes: 0,
    };
  }
  function makeEnemy(s, monsterId) {
    const m = D.MONSTERS[monsterId];
    // monsters get tougher the deeper you go on a floor (and on later floors)
    const row = s.pos && s.map.nodes[s.pos] ? s.map.nodes[s.pos].row : 0;
    const scale = 1 + (D.MAP.depthHp || 0) * row / D.MAP.rows + (D.MAP.floorHp || 0) * s.floor;
    const hp = Math.round(randInt(s, m.hp[0], m.hp[1]) * (m.boss ? 1 : scale));
    return { uid: uid(s, 'e'), side: 'enemy', monsterId, name: m.name, hp, maxHp: hp, block: 0,
      statuses: { ...(m.startStatus || {}) }, fresh: {}, intent: null, lastMove: null, moveCount: 0 };
  }

  function newGame(opts = {}) {
    const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
    const s = {
      version: 3, seed, rng: seed, uidCounter: 1, seenEvents: [], event: null, shop: null, pendingRelic: null,
      mode: opts.mode || 'solo',              // future: 'coop' | 'race'
      phase: 'map', floor: 0, floors: opts.floors || D.FLOORS.length,
      map: null, pos: null, node: null, lastEnc: null, turn: 0, stats: { fights: 0, elites: 0, events: 0 },
      players: [], enemies: [], log: [], events: [],
    };
    (opts.heroes || ['fighter']).forEach((h, i) => s.players.push(makePlayer(s, h, opts.names && opts.names[i])));
    s.map = generateMap(s);
    log(s, D.FLOORS[0].name);
    return s;
  }

  // ---------- map (Slay-the-Spire style: random walks up a grid, no crossing paths) ----------
  function generateMap(s) {
    const M = D.MAP, R = M.rows, C = M.cols, nodes = {}, edges = {};
    const key = (r, c) => `n${r}_${c}`;
    const addNode = (r, c) => { const id = key(r, c); if (!nodes[id]) nodes[id] = { id, row: r, col: c, type: null, next: [], prev: [] }; return nodes[id]; };
    const starts = [];
    for (let p = 0; p < M.paths; p++) {
      let c = randInt(s, 0, C - 1);
      if (p === 1) { let g = 0; while (c === starts[0] && g++ < 20) c = randInt(s, 0, C - 1); }
      starts.push(c);
      addNode(0, c);
      for (let r = 0; r < R - 1; r++) {
        let d = randInt(s, -1, 1);
        if (c + d < 0 || c + d >= C) d = 0;
        // crossing check: a neighbour already goes diagonally the other way
        if (d !== 0 && (edges[key(r, c + d)] || []).includes(key(r + 1, c))) d = 0;
        const from = key(r, c), to = key(r + 1, c + d);
        addNode(r + 1, c + d);
        edges[from] = edges[from] || [];
        if (!edges[from].includes(to)) edges[from].push(to);
        c += d;
      }
    }
    for (const [from, tos] of Object.entries(edges)) for (const to of tos) { nodes[from].next.push(to); nodes[to].prev.push(from); }
    for (const n of Object.values(nodes)) n.next.sort((a, b) => nodes[a].col - nodes[b].col);
    // room types
    const byRow = [];
    for (const n of Object.values(nodes)) (byRow[n.row] = byRow[n.row] || []).push(n);
    const banned = { elite: true, rest: true, shop: true, treasure: true };
    for (let r = 0; r < R; r++) for (const n of byRow[r].sort((a, b) => a.col - b.col)) {
      if (r === 0) { n.type = 'fight'; continue; }
      if (r === M.treasureRow) { n.type = 'treasure'; continue; }
      if ((M.eventRows || []).includes(r)) { n.type = 'event'; continue; }   // full '?' rows (Producer 10:56, event plan option D)
      if (r === R - 1) { n.type = 'rest'; continue; }
      const w = { ...M.weights };
      for (const t in M.minRow) if (r < M.minRow[t]) w[t] = 0;
      if (r === 1) { w.elite = 0; w.rest = 0; w.shop = 0; }
      if (r === R - 2) w.rest = 0;
      let t, tries = 0;
      do {
        t = weightedPick(s, w);
        const parentSame = n.prev.some(id => nodes[id].type === t);
        const siblingSame = n.prev.some(id => nodes[id].next.some(x => x !== n.id && nodes[x].type === t));
        if (!((banned[t] || t === 'event') && parentSame) && !(t !== 'fight' && siblingSame)) break;
      } while (++tries < 12);
      n.type = t;
    }
    // guarantees: a couple of elites and events, at least one shop
    const need = { elite: 2, event: 4, shop: 1 };
    for (const [t, k] of Object.entries(need)) {
      let have = Object.values(nodes).filter(n => n.type === t).length, guard = 0;
      while (have < k && guard++ < 60) {
        const cands = Object.values(nodes).filter(n => n.type === 'fight' && n.row >= Math.max(2, M.minRow[t] || 2) && n.row < R - 1
          && !n.prev.some(id => nodes[id].type === t) && !n.next.some(id => nodes[id].type === t));
        if (!cands.length) break;
        pick(s, cands).type = t; have++;
      }
    }
    const rows = [];
    for (let r = 0; r < R; r++) rows.push(byRow[r].map(n => n.id));
    const bossId = 'boss';
    nodes[bossId] = { id: bossId, row: R, col: (C - 1) / 2, type: 'boss', next: [], prev: rows[R - 1].slice() };
    rows[R - 1].forEach(id => nodes[id].next.push(bossId));
    rows.push([bossId]);
    for (const n of Object.values(nodes)) delete n.prev;
    return { rows, nodes, cols: C };
  }
  function reachable(s) {
    if (s.phase !== 'map') return [];
    return s.pos ? s.map.nodes[s.pos].next.slice() : s.map.rows[0].slice();
  }

  function startFight(s, row, type) {
    const F = D.FLOORS[s.floor];
    let pool = type === 'boss' ? [F.boss] : type === 'elite' ? F.elites : (row <= 3 ? F.easy : F.hard);
    // Variant copies (sameAs) count as the same fight for the no-repeat rule.
    const encKey = e => (D.ENCOUNTERS[e] && D.ENCOUNTERS[e].sameAs) || e;
    if (pool.length > 1 && s.lastEnc) { const f = pool.filter(e => encKey(e) !== encKey(s.lastEnc)); if (f.length) pool = f; }
    const enc = pick(s, pool); s.lastEnc = enc;
    startEncounter(s, enc);
  }
  function chooseNode(s, nodeId) {
    if (!reachable(s).includes(nodeId)) return err('Cannot go there');
    const n = s.map.nodes[nodeId];
    s.pos = nodeId;
    let type = n.type;
    if (type === 'event') { type = weightedPick(s, D.MAP.unknown); n.revealed = type; }
    s.node = type;
    emit(s, { kind: 'node', type, mapType: n.type });
    if (type === 'fight' || type === 'elite' || type === 'boss') startFight(s, n.row, type);
    else if (type === 'rest') s.phase = 'rest';
    else if (type === 'treasure') {
      s.phase = 'treasure';
      for (const p of livingPlayers(s)) {
        const relic = randomRelic(s, p), gold = randInt(s, 20, 35);
        p.gold += gold; if (relic) gainRelic(s, p, relic);
        p.treasure = { relic, gold };
      }
    } else if (type === 'shop') openShop(s, 0);
    else if (type === 'event') startEvent(s, pickEvent(s));
    return { ok: true };
  }

  // ---------- events ('?' rooms) ----------
  function pickEvent(s) {
    const ok = (id) => !D.EVENTS[id].floors || D.EVENTS[id].floors.includes(s.floor);
    let pool = Object.keys(D.EVENTS).filter(id => ok(id) && !s.seenEvents.includes(id));
    if (!pool.length) pool = Object.keys(D.EVENTS).filter(ok);
    const id = pick(s, pool); s.seenEvents.push(id); return id;
  }
  function startEvent(s, id) {
    s.phase = 'event'; s.stats.events++;
    s.event = { id, stage: 'choose', result: null, next: null, pick: null, log: [] };
    emit(s, { kind: 'event', id });
  }
  function choiceAllowed(p, ch) {
    if (!ch.req) return true;
    if (ch.req.gold && p.gold < ch.req.gold) return false;
    if (ch.req.hp && p.hp < ch.req.hp) return false;
    return true;
  }
  function applyOps(s, p, o) {
    const ev = s.event, out = ev.log;
    if (o.gold) { const g = Math.max(-p.gold, o.gold); p.gold += g; if (g) out.push((g > 0 ? '+' : '') + g + ' gold'); }
    if (o.hp > 0) { const before = p.hp; heal(s, p, o.hp); if (p.hp > before) out.push('+' + (p.hp - before) + ' HP'); }
    if (o.hp < 0) { const n = Math.min(-o.hp, p.hp - 1); p.hp -= n; if (n) out.push('-' + n + ' HP'); }
    if (o.maxHp) { p.maxHp += o.maxHp; p.hp += o.maxHp; out.push('+' + o.maxHp + ' max HP'); }
    if (o.healPct) { const before = p.hp; heal(s, p, Math.round(p.maxHp * o.healPct)); out.push('+' + (p.hp - before) + ' HP'); }
    let ownedAlt = false;
    if (o.relic) { ownedAlt = o.relic !== 'random' && !!o.textOwned && hasRelic(p, o.relic); const r = o.relic === 'random' ? randomRelic(s, p) : (hasRelic(p, o.relic) ? randomRelic(s, p) : o.relic); if (r) { gainRelic(s, p, r); out.push('Relic: ' + D.RELICS[r].name); } else { p.gold += 40; out.push('+40 gold'); } }
    if (o.potion) { const id = o.potion === 'random' ? randomPotion(s) : o.potion; if (gainPotion(s, p, id)) out.push('Potion: ' + D.POTIONS[id].name); else out.push('(potion belt full)'); }
    if (o.curse) { p.deck.push({ uid: uid(s, 'c'), id: o.curse }); out.push('Curse: ' + D.CARDS[o.curse].name); }
    if (o.upgradeRandom) {
      for (let i = 0; i < o.upgradeRandom; i++) {
        const c = p.deck.filter(canUpgrade); if (!c.length) break;
        const x = pick(s, c); x.up = true; out.push('Upgraded: ' + D.CARDS[x.id].name);
      }
    }
    if (o.removeCurses) {   // Eternal curses stay (Producer 11:34)
      const curses = p.deck.filter(c => D.CARDS[c.id].type === 'curse' && canRemove(c));
      if (curses.length) { curses.forEach(c => removeFromDeck(s, p, c)); out.push('Removed ' + curses.length + ' curse' + (curses.length > 1 ? 's' : '')); }
      else ev.next = { then: 'remove' };
    }
    if (o.then) ev.next = { then: o.then };
    if (o.fight) ev.next = { fight: (o.fightByFloor && o.fightByFloor[s.floor]) || o.fight, fightType: o.fightType || 'fight', relicAfter: o.relicAfter || null };
    if (o.shop) ev.next = { shop: o.shop };
    if (o.text) ev.result = ownedAlt ? o.textOwned : o.text;
  }
  // ---------- odds + Dev / data mode describer ----------
  // weightOdds / choiceWeights / rewardRarityWeights are the same functions the resolvers roll with, so shown odds can't drift.
  function weightOdds(weights) {
    const e = Object.entries(weights).filter(([, w]) => w > 0), t = e.reduce((a, [, w]) => a + w, 0);
    return e.map(([key, w]) => ({ key, w, p: w / t }));
  }
  function choiceWeights(ch) { const w = {}; ch.chance.forEach((b, i) => { w[i] = b.w; }); return w; }
  const pctStr = (x) => { const v = Math.round(x * 1000) / 10; return v + '%'; };
  // Mirrors applyOps step by step on a shadow of the player (hp / maxHp / gold), without rolling anything.
  function previewOps(s, p, sh, o) {
    const fx = [], add = (text, bad) => fx.push({ text, bad: !!bad });
    if (o.gold) { const g = Math.max(-sh.gold, o.gold); sh.gold += g;
      if (o.gold > 0) add('+' + g + ' gold'); else add(-o.gold > -g ? 'Lose all your gold (-' + (-g) + ' now)' : '-' + (-g) + ' gold', true); }
    if (o.hp > 0) { const a = Math.max(0, Math.min(o.hp, sh.maxHp - sh.hp)); sh.hp += a; add('Heal ' + o.hp + ' HP (+' + a + ' now)'); }
    if (o.hp < 0) { const n = Math.max(0, Math.min(-o.hp, sh.hp - 1)); sh.hp -= n; add('-' + (-o.hp) + ' HP' + (n !== -o.hp ? ' (' + n + ' now, never below 1)' : ''), true); }
    if (o.maxHp) { sh.maxHp += o.maxHp; sh.hp += o.maxHp; add((o.maxHp > 0 ? '+' : '') + o.maxHp + ' max HP', o.maxHp < 0); }
    if (o.healPct) { const a = Math.max(0, Math.min(Math.round(sh.maxHp * o.healPct), sh.maxHp - sh.hp)); sh.hp += a; add('Heal ' + pctStr(o.healPct) + ' of max HP (+' + a + ' now)'); }
    if (o.relic) {
      const left = Object.keys(D.RELICS).filter(r => !hasRelic(p, r) && !D.RELICS[r].special).length;
      if (o.relic !== 'random' && !hasRelic(p, o.relic)) add('Relic: ' + D.RELICS[o.relic].name);
      else if (left) add('Random relic (1 of ' + left + (o.relic !== 'random' ? ', you already own ' + D.RELICS[o.relic].name : '') + ')');
      else add('+40 gold (no relics left)');
    }
    if (o.potion) { const full = p.potions.length >= D.POTION_SLOTS;
      add((o.potion === 'random' ? 'Random potion (1 of ' + Object.keys(D.POTIONS).length + ')' : 'Potion: ' + D.POTIONS[o.potion].name) + (full ? ' (belt full: lost)' : '')); }
    if (o.curse) add('Curse into your deck: ' + D.CARDS[o.curse].name, true);
    if (o.upgradeRandom) { const n = Math.min(o.upgradeRandom, p.deck.filter(canUpgrade).length); add('Upgrade ' + n + ' random card' + (n === 1 ? '' : 's')); }
    if (o.removeCurses) { const n = p.deck.filter(c => D.CARDS[c.id].type === 'curse' && canRemove(c)).length; add(n ? 'Remove all ' + n + ' curse' + (n > 1 ? 's' : '') : 'No curses: choose a card to remove'); }
    if (o.then) {
      const n = hasRelic(p, 'luckstone') ? 4 : 3;
      if (o.then === 'remove') add('Choose a card to remove');
      else if (o.then === 'upgrade') add('Choose a card to upgrade');
      else { const t = o.then === 'rareCards' ? 'rareOnly' : 'fight';
        const odds = weightOdds(rewardRarityWeights(t));
        add('Pick 1 of ' + n + (odds.length === 1 ? ' ' + odds[0].key + ' cards' : ' cards (each: ' + odds.map(r => r.key + ' ' + pctStr(r.p)).join(', ') + ')')); }
    }
    if (o.fight) { const enc = (o.fightByFloor && o.fightByFloor[s.floor]) || o.fight;
      add((o.fightType === 'elite' ? 'Elite fight: ' : 'Fight: ') + D.ENCOUNTERS[enc].name + (o.relicAfter ? ', then relic: ' + D.RELICS[o.relicAfter].name : ''), true); }
    if (o.shop) { const d = o.shop.discount || 0; add(d ? 'Merchant, prices ' + (d > 0 ? '-' : '+') + pctStr(Math.abs(d)) : 'Merchant, normal prices', d < 0); }
    return fx;
  }
  // Generic: works from the event data alone (req / ops / chance), so new events need no extra code.
  function describeChoice(s, p, evId, idx) {
    const ch = D.EVENTS[evId].choices[idx];
    const sh = { hp: p.hp, maxHp: p.maxHp, gold: p.gold };
    const req = [];
    if (ch.req && ch.req.gold) req.push('Needs ' + ch.req.gold + ' gold');
    if (ch.req && ch.req.hp) req.push('Needs ' + ch.req.hp + ' HP');
    const fixed = ch.ops ? previewOps(s, p, sh, ch.ops) : [];
    const outcomes = ch.chance ? weightOdds(choiceWeights(ch)).map(o => {
      const after = Object.assign({}, sh), effects = previewOps(s, p, after, ch.chance[+o.key]);
      return { branch: +o.key, p: o.p, effects, bad: effects.some(f => f.bad), after };
    }) : null;
    const risky = !!outcomes && outcomes.some(o => o.bad);
    return { req, fixed, cost: fixed.filter(f => f.bad), outcomes, after: sh, success: risky ? outcomes.filter(o => !o.bad).reduce((a, o) => a + o.p, 0) : null };
  }
  function eventChoice(s, p, idx) {
    if (s.phase !== 'event' || !s.event || s.event.stage !== 'choose') return err('No event choice');
    const ch = D.EVENTS[s.event.id].choices[idx];
    if (!ch) return err('Invalid choice');
    if (!choiceAllowed(p, ch)) return err('Requirement not met');
    s.event.choice = idx;
    if (ch.ops) applyOps(s, p, ch.ops);
    if (ch.chance) { const b = +weightedPick(s, choiceWeights(ch)); s.event.branch = b; applyOps(s, p, ch.chance[b]); }
    s.event.stage = 'result';
    log(s, D.EVENTS[s.event.id].name + ': ' + (s.event.log.join(', ') || 'nothing happens'));
    emit(s, { kind: 'eventResult' });
    return { ok: true };
  }
  function eventContinue(s, p) {
    if (s.phase !== 'event' || !s.event || s.event.stage !== 'result') return err('Nothing to continue');
    const nx = s.event.next;
    if (nx && (nx.then === 'upgrade' || nx.then === 'remove')) {
      const ok = p.deck.some(c => nx.then === 'remove' ? canRemove(c) : canUpgrade(c));
      if (ok) { s.event.stage = 'pick'; s.event.pick = nx.then; return { ok: true }; }
    } else if (nx && (nx.then === 'cards' || nx.then === 'rareCards')) {
      s.phase = 'reward'; s.node = 'event';
      p.reward = { gold: 0, relic: null, potion: null, cards: rollCardRewards(s, p, hasRelic(p, 'luckstone') ? 4 : 3, nx.then === 'rareCards' ? 'rareOnly' : 'fight'), done: false };
      return { ok: true };
    } else if (nx && nx.fight) {
      s.node = nx.fightType; s.pendingRelic = nx.relicAfter; s.event = null;
      startEncounter(s, nx.fight); return { ok: true };
    } else if (nx && nx.shop) { s.event = null; openShop(s, nx.shop.discount || 0); return { ok: true }; }
    afterNode(s); return { ok: true };
  }
  function eventPick(s, p, cardUid) {
    if (s.phase !== 'event' || !s.event || s.event.stage !== 'pick') return err('Nothing to pick');
    if (cardUid) {
      const c = p.deck.find(x => x.uid === cardUid);
      if (!c) return err('No such card');
      if (s.event.pick === 'upgrade') { if (!canUpgrade(c)) return err('Cannot upgrade'); c.up = true; log(s, `${p.name} upgrades ${D.CARDS[c.id].name}.`); }
      else { if (!removeFromDeck(s, p, c)) return err('Eternal cards can never be removed'); log(s, `${p.name} removes ${D.CARDS[c.id].name}.`); }
    }
    afterNode(s); return { ok: true };
  }

  // ---------- shop ----------
  function openShop(s, discount) {
    s.phase = 'shop';
    const p = livingPlayers(s)[0], P = D.SHOP.price;
    const mult = (1 - discount) * (p && hasRelic(p, 'smiling_mask') ? 0.8 : 1);
    const price = (base) => Math.max(1, Math.round(base * mult * (0.9 + rand(s) * 0.2)));
    const cards = [];
    const cls = p.heroId, pool = Object.keys(D.CARDS).filter(id => D.CARDS[id].cls === cls && D.CARDS[id].rarity !== 'starter');
    for (const rar of ['common', 'common', 'uncommon', 'uncommon', 'rare']) {
      const opts = pool.filter(id => D.CARDS[id].rarity === rar && !cards.some(c => c.id === id));
      if (opts.length) { const id = pick(s, opts); cards.push({ id, price: price(P[rar]), sold: false }); }
    }
    const relics = [];
    for (let i = 0; i < 3; i++) {
      const left = Object.keys(D.RELICS).filter(r => !D.RELICS[r].special && !hasRelic(p, r) && !relics.some(x => x.id === r));
      if (left.length) relics.push({ id: pick(s, left), price: price(P.relic), sold: false });
    }
    const potions = [];
    for (let i = 0; i < 3; i++) potions.push({ id: randomPotion(s), price: price(P.potion), sold: false });
    s.shop = { cards, relics, potions, removeCost: Math.round((D.SHOP.remove + D.SHOP.removeStep * p.removes) * mult), removed: false, discount };
    emit(s, { kind: 'shop' });
  }
  function buy(s, p, kind, index) {
    if (s.phase !== 'shop' || !s.shop) return err('No shop here');
    const list = s.shop[kind + 's'], item = list && list[index];
    if (!item || item.sold) return err('Not for sale');
    if (p.gold < item.price) return err('Not enough gold');
    if (kind === 'potion' && p.potions.length >= D.POTION_SLOTS) return err('Potion belt is full');
    p.gold -= item.price; item.sold = true;
    if (kind === 'card') p.deck.push({ uid: uid(s, 'c'), id: item.id });
    else if (kind === 'relic') gainRelic(s, p, item.id);
    else gainPotion(s, p, item.id);
    emit(s, { kind: 'buy', item: item.id });
    return { ok: true };
  }
  function shopRemove(s, p, cardUid) {
    if (s.phase !== 'shop' || !s.shop || s.shop.removed) return err('No removal service');
    if (p.gold < s.shop.removeCost) return err('Not enough gold');
    const c = p.deck.find(x => x.uid === cardUid); if (!c) return err('No such card');
    if (!canRemove(c)) return err('Eternal cards can never be removed');
    p.gold -= s.shop.removeCost; removeFromDeck(s, p, c); p.removes++; s.shop.removed = true;
    log(s, `${p.name} removes ${D.CARDS[c.id].name}.`);
    return { ok: true };
  }

  // ---------- potions ----------
  const randomPotion = (s) => pick(s, Object.keys(D.POTIONS));
  function gainPotion(s, p, id) {
    if (p.potions.length >= D.POTION_SLOTS) return false;
    p.potions.push(id); emit(s, { kind: 'potionGain', target: p.uid, potion: id }); return true;
  }
  function usePotion(s, p, slot) {
    const id = p.potions[slot]; if (!id) return err('No potion there');
    const def = D.POTIONS[id];
    if (s.phase !== 'combat' && !(def.anywhere && alive(p))) return err('Drink that during a fight');
    if (s.phase === 'combat' && p.endedTurn) return err('Wait for your turn');
    p.potions.splice(slot, 1);
    emit(s, { kind: 'potion', source: p.uid, potion: id });
    log(s, `${p.name} drinks ${def.name}.`);
    runEffects(s, p, def.effects, null, null);
    if (s.phase === 'combat') checkEnd(s);
    return { ok: true };
  }

  // ---------- relics ----------
  function randomRelic(s, p) {
    const left = Object.keys(D.RELICS).filter(r => !hasRelic(p, r) && !D.RELICS[r].special);
    return left.length ? pick(s, left) : null;
  }
  function gainRelic(s, p, id) {
    p.relics.push(id);
    log(s, `${p.name} gains ${D.RELICS[id].name}.`);
    if (D.RELICS[id].hook === 'pickup') runEffects(s, p, D.RELICS[id].effects, null, null);
  }
  function runRelics(s, p, hook) {
    for (const r of p.relics) {
      const def = D.RELICS[r];
      if (def.hook === hook && alive(p)) { emit(s, { kind: 'relic', target: p.uid, relic: r }); runEffects(s, p, def.effects, null, null); }
    }
  }

  // ---------- encounters ----------
  function startEncounter(s, encId) {
    const enc = D.ENCOUNTERS[encId];
    s.phase = 'combat'; s.turn = 0; s.encounter = encId;
    s.enemies = enc.enemies.map(id => makeEnemy(s, id));
    for (const p of livingPlayers(s)) {
      p.draw = shuffle(s, p.deck.map(c => ({ ...c })));
      p.hand = []; p.discard = []; p.exhaust = []; p.powers = []; p.block = 0; p.statuses = {}; p.fresh = {}; p.reward = null; p.turnFx = {}; p.enemyTurnFx = {};
    }
    log(s, `— ${enc.name} —`);
    emit(s, { kind: 'encounter', name: enc.name });
    s.enemies.forEach(e => chooseIntent(s, e));
    syncGuards(s);
    startPlayersTurn(s);
  }

  // ---------- damage / status math ----------
  function attackBase(src, fx, extraBase) {
    let base = (fx.n || 0) + (extraBase || 0);
    if (fx.scale) base += fx.scale.per * ((src.statuses[fx.scale.status]) || 0);
    if (fx.rageBonus && src.statuses.rage) base += fx.rageBonus;
    return base;
  }
  // Rage (Anna, Nov 3 04:07): adds no damage; any Rage at all cuts the attack damage you take by a flat 25%.
  const RAGE_TAKEN = 0.75;
  function attackDamage(src, tgt, base) {
    let d = base;
    if (src) d += (src.statuses.might || 0) + (src.statuses.arcane || 0);
    if (src && src.statuses.frightened) d = Math.floor(d * 0.75);
    if (tgt && tgt.statuses.prone) d = Math.floor(d * 1.5);
    if (tgt && tgt.statuses.rage) d = Math.floor(d * RAGE_TAKEN);
    return Math.max(0, d);
  }
  // ---------- Power hooks (Barbarian deck styles B1-B3): read from the Powers in play, see data.js `power` ----------
  const powerDefs = (p) => (p && p.side === 'player' && p.powers ? p.powers.map(cardDef).filter(d => d.power) : []);
  const rageNoFade = (t) => powerDefs(t).some(d => d.power.rageNoFade);
  // Blood Up: every attack hit on an enemy gives Rage, up to the cap a turn (one shared counter, reset each turn).
  function onAttackHit(s, src, tgt) {
    if (!src || src.side !== 'player' || !tgt || tgt.side !== 'enemy') return;
    src.turnFx = src.turnFx || {};
    for (const d of powerDefs(src)) {
      const P = d.power; if (!P.rageOnHit) continue;
      const left = (P.rageOnHitPerTurn || Infinity) - (src.turnFx.rageOnHit || 0);
      const n = Math.min(P.rageOnHit, left); if (n <= 0) continue;
      src.turnFx.rageOnHit = (src.turnFx.rageOnHit || 0) + n;
      addStatus(s, src, 'rage', n, true);
    }
  }
  // Scar Tissue / The Bear Beneath: the first HP loss to damage in each enemy turn, per Power in play.
  function onHpLoss(s, tgt) {
    if (!s.enemyActing || !tgt || tgt.side !== 'player' || !alive(tgt) || !tgt.powers) return;
    tgt.enemyTurnFx = tgt.enemyTurnFx || {};
    tgt.powers.forEach(c => {
      const d = cardDef(c), h = d.power && d.power.onHpLossEnemyTurn; if (!h) return;
      const k = 'hpLoss_' + c.uid; if (tgt.enemyTurnFx[k]) return; tgt.enemyTurnFx[k] = true;
      emit(s, { kind: 'powerTrigger', source: tgt.uid, card: c.id });
      if (h.block) gainBlock(s, tgt, h.block);
      if (h.rage) addStatus(s, tgt, 'rage', h.rage, false);
    });
  }
  // Goad: an enemy whose intent has no attack switches to one of its attacking moves (the first one in its own move order).
  function goad(s, p, e) {
    if (!alive(e) || e.side !== 'enemy' || !e.intent) return;
    if (moveOf(e, e.intent.move).effects.some(f => f.t === 'attack')) return;
    const m = D.MONSTERS[e.monsterId], order = (m.ai.pattern || m.ai.whileUp || []).concat(Object.keys(m.moves));
    const mv = order.find(k => m.moves[k] && moveOf(e, k).effects.some(f => f.t === 'attack'));
    if (!mv) return;
    e.intent = { move: mv, target: p.uid, goaded: true };
    emit(s, { kind: 'goaded', source: p.uid, target: e.uid, move: mv });
    log(s, `${e.name} takes the bait.`);
  }
  function dealDamage(s, tgt, amount, src, isAttack) {
    if (!alive(tgt)) return;
    const blocked = Math.min(tgt.block, amount);
    tgt.block -= blocked;
    const loss = amount - blocked;
    tgt.hp = Math.max(0, tgt.hp - loss);
    emit(s, { kind: 'hit', target: tgt.uid, source: src && src.uid, amount: loss, blocked, hp: tgt.hp, block: tgt.block });
    if (tgt.hp === 0) died(s, tgt); else if (loss > 0) { checkPhase(s, tgt); onHpLoss(s, tgt); }
    if (isAttack) onAttackHit(s, src, tgt);
    if (isAttack && src && alive(src) && tgt.statuses.thorns) dealDamage(s, src, tgt.statuses.thorns, null, false);
    return loss;
  }
  function loseHp(s, tgt, n, why) {
    if (!alive(tgt)) return;
    tgt.hp = Math.max(0, tgt.hp - n);
    emit(s, { kind: 'hit', target: tgt.uid, amount: n, blocked: 0, why, hp: tgt.hp, block: tgt.block });
    if (tgt.hp === 0) died(s, tgt); else if (n > 0) checkPhase(s, tgt);
  }
  // Below-half phase (monster `phase` data): fires once per fight, the first time the enemy drops to at*maxHp or lower.
  function checkPhase(s, e) {
    if (e.side !== 'enemy' || e.phased || !alive(e)) return;
    const m = D.MONSTERS[e.monsterId], ph = m.phase;
    if (!ph || e.hp > e.maxHp * (ph.at || 0.5)) return;
    e.phased = true;
    log(s, `${e.name} changes tactics!`);
    emit(s, { kind: 'phase', source: e.uid, monster: e.monsterId });
    for (const [k, n] of Object.entries(ph.status || {})) addStatus(s, e, k, n, !!s.enemyActing);
    // a dropped move shown during the hero's turn is replaced at once; during the enemy turn the next intent uses the new pattern
    if (ph.pattern && e.intent && !ph.pattern.includes(e.intent.move) && !s.enemyActing && !e.intent.exposed)
      e.intent = { move: patternMove(m, e), target: e.intent.target };
  }
  const patternOf = (m, e) => (e.phased && m.phase && m.phase.pattern) || m.ai.pattern;
  function patternMove(m, e) { const pat = patternOf(m, e); return pat[Math.max(0, e.moveCount - (m.ai.opener ? 1 : 0)) % pat.length]; }
  // The move as it plays now: phase overrides (e.g. attack times) merged over the base move.
  function moveOf(e, key) {
    const m = D.MONSTERS[e.monsterId], mv = m.moves[key], o = e.phased && m.phase && m.phase.moves && m.phase.moves[key];
    if (!o) return mv;
    return { ...mv, effects: mv.effects.map(f => f.t === 'attack' && o.attack ? { ...f, ...o.attack } : f) };
  }
  function died(s, tgt, why) {
    emit(s, { kind: 'death', target: tgt.uid, why: why || null }); log(s, `${tgt.name} falls!`);
    if (tgt.side !== 'enemy') return;
    const m = D.MONSTERS[tgt.monsterId];
    // a summoner dies: its minions fall apart with it
    if (m.minion) for (const x of s.enemies) if (alive(x) && x.monsterId === m.minion) {
      x.hp = 0; x.block = 0; died(s, x, 'unravel');
      emit(s, { kind: 'unravel', source: tgt.uid, target: x.uid });
    }
    // a minion dies: a summoner left with none is Exposed; its next move is forced (shown as a normal intent)
    if (why !== 'unravel') for (const x of s.enemies) {
      const xm = D.MONSTERS[x.monsterId];
      if (!alive(x) || xm.minion !== tgt.monsterId || !xm.ai.exposedMove) continue;
      if (s.enemies.some(y => alive(y) && y.monsterId === tgt.monsterId)) continue;
      x.exposed = true;
      // during the player's turn the intent changes at once; during the enemy turn it takes effect from the next intent
      if (!s.enemyActing) x.intent = { move: xm.ai.exposedMove, target: x.intent && x.intent.target, exposed: true };
      emit(s, { kind: 'exposed', source: x.uid, minion: tgt.uid });
    }
    syncGuards(s);
  }
  function gainBlock(s, t, n) { if (n <= 0) return; t.block += n; emit(s, { kind: 'block', target: t.uid, amount: n, hp: t.hp, block: t.block }); }
  function heal(s, t, n) {
    const amt = Math.max(0, Math.min(n, t.maxHp - t.hp)); t.hp += amt;
    if (amt) emit(s, { kind: 'heal', target: t.uid, amount: amt, hp: t.hp, block: t.block });
  }
  // `self` = applied by its owner during its own turn: skip the next decay so it lasts through the enemy turn.
  function addStatus(s, t, status, n, self) {
    if (!alive(t)) return;
    t.statuses[status] = (t.statuses[status] || 0) + n;
    if (self) t.fresh[status] = true;
    emit(s, { kind: 'status', target: t.uid, status, amount: n });
  }
  const decaysFor = (t, k) => D.STATUSES[k].decays && !(k === 'rage' && rageNoFade(t));   // Blood Up: Rage stops fading
  function decayStatuses(t) {
    for (const k of Object.keys(t.statuses)) {
      if (!decaysFor(t, k)) continue;
      if (t.fresh[k]) continue;
      t.statuses[k]--; if (t.statuses[k] <= 0) delete t.statuses[k];
    }
    t.fresh = {};
  }
  function tickPoison(s, t) {
    const p = t.statuses.poisoned;
    if (!p) return;
    loseHp(s, t, p, 'poison');
    t.statuses.poisoned--; if (t.statuses.poisoned <= 0) delete t.statuses.poisoned;
  }

  // ---------- deck handling ----------
  function drawCards(s, p, n) {
    for (let i = 0; i < n; i++) {
      if (p.hand.length >= 10) break;
      if (p.draw.length === 0) {
        if (p.discard.length === 0) break;
        p.draw = shuffle(s, p.discard); p.discard = [];
        emit(s, { kind: 'reshuffle', target: p.uid });
      }
      p.hand.push(p.draw.pop());
    }
  }

  // ---------- turn flow ----------
  function startPlayersTurn(s) {
    s.turn++;
    for (const p of livingPlayers(s)) {
      p.block = 0; p.energy = p.maxEnergy; p.endedTurn = false; p.turnFx = {};
      tickPoison(s, p);
      if (p.statuses.armor) gainBlock(s, p, p.statuses.armor);
      for (const d of powerDefs(p)) if (d.power.turnStart && alive(p)) runEffects(s, p, d.power.turnStart, null, null);   // The Last Tally
      runRelics(s, p, 'turnStart');
    }
    for (const p of livingPlayers(s)) drawCards(s, p, p.handSize);
    if (s.turn === 1) for (const p of livingPlayers(s)) runRelics(s, p, 'combatStart');
    emit(s, { kind: 'playerTurn', turn: s.turn });
    checkEnd(s);
  }

  function endPlayerTurn(s, p) {
    p.endedTurn = true;
    if (livingPlayers(s).some(x => !x.endedTurn)) return; // co-op: wait for everyone
    for (const pl of livingPlayers(s)) {
      for (const c of pl.hand) { const d = D.CARDS[c.id]; if (d.endTurnHpLoss) loseHp(s, pl, d.endTurnHpLoss, 'curse'); }
      vanishAtTurnEnd(s, pl);
      pl.discard.push(...pl.hand); pl.hand = [];
      if (pl.statuses.regen) heal(s, pl, pl.statuses.regen);
      decayStatuses(pl);
    }
    enemyTurn(s);
    if (s.phase === 'combat') startPlayersTurn(s);
  }

  // Vanish (Anna 11:33, how_to_play_v1): a card still in hand that would be discarded at the end of the turn is removed for
  // the rest of the fight instead (it goes to the exhaust pile, as a fresh copy is dealt next fight). A played Vanish card
  // is discarded as normal. Eternal blocks it (the card is discarded as normal).
  function vanishAtTurnEnd(s, p) {
    const gone = p.hand.filter(c => cardDef(c).vanish && canRemove(c));
    if (!gone.length) return;
    p.hand = p.hand.filter(c => !gone.includes(c)); p.exhaust.push(...gone);
    for (const c of gone) { emit(s, { kind: 'vanish', source: p.uid, card: c.id }); log(s, `${D.CARDS[c.id].name} vanishes.`); lastWord(s, p, c); }
  }

  function enemyTurn(s) {
    emit(s, { kind: 'enemyTurn' });
    s.enemyActing = true;
    for (const p of s.players) p.enemyTurnFx = {};
    try { enemyActs(s); } finally { delete s.enemyActing; }
    if (s.phase === 'combat') s.enemies.filter(alive).forEach(e => chooseIntent(s, e));
  }
  function enemyActs(s) {
    // summoned minions stand in front but act after the others (so a guard they give lasts through the hero's turn);
    // the list is a snapshot, so one sewn this turn doesn't act until the next
    const order = s.enemies.filter(e => !e.summoned).concat(s.enemies.filter(e => e.summoned));
    for (const e of order) {
      if (!alive(e)) continue;
      e.block = 0;
      if (e.statuses.armor) gainBlock(s, e, e.statuses.armor);
      tickPoison(s, e);
      if (!alive(e)) { if (checkEnd(s)) return; continue; }
      runMove(s, e);
      if (checkEnd(s)) return;
      if (e.statuses.regen && alive(e)) heal(s, e, e.statuses.regen);
      decayStatuses(e);
    }
  }

  function chooseIntent(s, e) {
    const m = D.MONSTERS[e.monsterId];
    let move;
    if (m.ai.summoner) {
      // Summoner (the Surgeon): opener sews; while a minion stands, alternate the `whileUp` moves (never sews);
      // the move after the last minion dies is `exposedMove`; after that, with none standing, sew again.
      const A = m.ai, up = s.enemies.some(x => alive(x) && x.monsterId === m.minion);
      if (e.moveCount === 0) move = A.opener;
      else if (e.exposed) { e.intent = { move: A.exposedMove, target: (livingPlayers(s)[0] || {}).uid || null, exposed: true }; return; }
      else if (up) { const i = A.whileUp.indexOf(e.lastMove); move = A.whileUp[(i + 1) % A.whileUp.length]; }
      else move = A.summonMove;
    } else if (e.moveCount === 0 && m.ai.opener) move = m.ai.opener;
    else if (m.ai.pattern) move = patternMove(m, e); else {
      const w = { ...m.ai.weights };
      if (m.ai.noRepeat && e.lastMove && w[e.lastMove] != null && Object.keys(w).length > 1) delete w[e.lastMove];
      move = weightedPick(s, w);
    }
    const targets = livingPlayers(s);
    e.intent = { move, target: targets.length ? targets[randInt(s, 0, targets.length - 1)].uid : null };
  }

  function runMove(s, e) {
    const mv = moveOf(e, e.intent.move);
    let tgt = find(s, e.intent.target);
    if (!alive(tgt)) tgt = livingPlayers(s)[0];
    emit(s, { kind: 'enemyAct', source: e.uid, name: mv.name, move: e.intent.move });
    log(s, `${e.name} uses ${mv.name}.`);
    for (const fx of mv.effects) {
      if (fx.t === 'attack') {
        for (let i = 0; i < (fx.times || 1); i++) if (alive(tgt) && alive(e)) { const lost = dealDamage(s, tgt, attackDamage(e, tgt, fx.n), e, true); if (fx.drain && lost > 0 && alive(e)) heal(s, e, lost); }
      } else if (fx.t === 'block') gainBlock(s, e, fx.n);
      else if (fx.t === 'healAllies') livingEnemies(s).forEach(a => heal(s, a, fx.n));
      else if (fx.t === 'healSelf') heal(s, e, fx.n);
      else if (fx.t === 'summon') summon(s, e, fx);
      else if (fx.t === 'healMinions') livingEnemies(s).filter(a => a.monsterId === fx.monster).forEach(a => heal(s, a, fx.n));
      else if (fx.t === 'blockLeader') livingEnemies(s).filter(a => a.monsterId === fx.leader).forEach(a => gainBlock(s, a, fx.n));
      else if (fx.t === 'wait') { /* still being sewn together: does nothing this turn */ }
      else if (fx.t === 'stripBlock') {
        if (alive(tgt) && tgt.block > 0) { const n = tgt.block; tgt.block = 0; emit(s, { kind: 'stripBlock', source: e.uid, target: tgt.uid, amount: n, hp: tgt.hp, block: 0 }); log(s, `${e.name} tears away ${n} Block.`); }
      }
      else if (fx.t === 'addCards') {   // status cards (combat-only): hand up to the cap (or the discard pile with to:'discard'); never the deck
        if (!alive(tgt)) continue;
        for (let i = 0; i < fx.n; i++) {
          const c = { uid: uid(s, 'c'), id: fx.card };
          if (fx.to !== 'discard' && tgt.hand.length < 10) tgt.hand.push(c); else tgt.discard.push(c);
        }
        emit(s, { kind: 'addCards', source: e.uid, target: tgt.uid, card: fx.card, n: fx.n, to: fx.to === 'discard' ? 'discard' : 'hand' });
      }
      else if (fx.t === 'status') {
        const ts = fx.to === 'self' ? [e] : fx.to === 'allies' ? livingEnemies(s) : [tgt];
        ts.forEach(t => addStatus(s, t, fx.status, fx.n, t === e));
      }
    }
    if (e.intent.exposed) e.exposed = false;
    e.lastMove = e.intent.move; e.moveCount++;
  }
  // Brings in a minion (at most `max` alive at once). It goes in front of its summoner, reusing a fallen
  // minion's slot so the row doesn't fill with empty places, and starts on its opener (the waiting turn).
  function summon(s, e, fx) {
    const max = fx.max || 1;
    if (s.enemies.filter(a => alive(a) && a.monsterId === fx.monster).length >= max) return;
    const n = makeEnemy(s, fx.monster);
    const dead = s.enemies.findIndex(a => !alive(a) && a.monsterId === fx.monster);
    if (dead >= 0) s.enemies[dead] = n; else s.enemies.splice(s.enemies.indexOf(e), 0, n);
    n.summoned = true;
    emit(s, { kind: 'summon', source: e.uid, target: n.uid, monster: fx.monster });
    log(s, `${e.name} sews up ${n.name}.`);
    chooseIntent(s, n);
    syncGuards(s);
  }

  // What the UI shows over an enemy's head.
  function describeIntent(s, e) {
    if (!e.intent) return null;
    const mv = moveOf(e, e.intent.move);
    let tgt = find(s, e.intent.target);
    // The hero's statuses tick down at the end of their turn, before enemies act: show the hit as it will land.
    if (tgt && tgt.side !== 'enemy' && !tgt.endedTurn) {
      const st = { ...tgt.statuses };
      for (const k of Object.keys(st)) if (decaysFor(tgt, k) && !(tgt.fresh || {})[k]) { st[k]--; if (st[k] <= 0) delete st[k]; }
      tgt = { ...tgt, statuses: st };
    }
    const out = { kind: mv.intent, name: mv.name, damage: null, times: 1, block: 0, debuff: false, buff: false };
    for (const fx of mv.effects) {
      if (fx.t === 'attack') { out.damage = attackDamage(e, tgt, fx.n); out.times = fx.times || 1; if (fx.drain) out.drain = true; }
      if (fx.t === 'block') out.block += fx.n;
      if (fx.t === 'status') { if (D.STATUSES[fx.status].debuff) out.debuff = out.statusDebuff = true; else out.buff = true; }
      if (fx.t === 'stripBlock') { out.debuff = true; out.stripBlock = true; }
      if (fx.t === 'healAllies' || fx.t === 'healSelf' || fx.t === 'healMinions' || fx.t === 'blockLeader') out.buff = true;
      if (fx.t === 'healMinions') out.healMinions = (s.enemies.some(a => alive(a) && a.monsterId === fx.monster)) ? fx.n : 0;
      if (fx.t === 'blockLeader') out.blockLeader = fx.n;
      if (fx.t === 'summon') out.summon = D.MONSTERS[fx.monster].name;
      if (fx.t === 'wait') out.wait = true;
      if (fx.t === 'addCards') { out.debuff = true; out.cards = (out.cards || 0) + fx.n; out.cardName = D.CARDS[fx.card].name; out.cardsTo = fx.to === 'discard' ? 'discard' : 'hand'; }
    }
    return out;
  }

  // ---------- effects (cards and relics) ----------
  function runEffects(s, p, effects, tgt, c) {
    let blockSoFar = 0;
    for (const fx of effects) {
      // Enraged: X = your Rage when played (counted once, so its own hits add nothing; Rage is not spent)
      const times = fx.timesFrom ? (p.statuses[fx.timesFrom] || 0) : (fx.times || 1);
      switch (fx.t) {
        case 'damage': for (let i = 0; i < times; i++) if (alive(tgt)) {
          const lost = dealDamage(s, tgt, attackDamage(p, tgt, attackBase(p, fx)), p, true);
          if (fx.ragePerUnblocked && lost > 0) addStatus(s, p, 'rage', fx.ragePerUnblocked, true);   // Bloodied Knuckles
        } break;
        case 'loseHp': loseHp(s, p, fx.n, 'self'); break;
        case 'goad': if (tgt) goad(s, p, tgt); break;
        case 'damageAll': for (let i = 0; i < times; i++) livingEnemies(s).forEach(e => dealDamage(s, e, attackDamage(p, e, attackBase(p, fx)), p, true)); break;
        case 'damageAllRaw': livingEnemies(s).forEach(e => dealDamage(s, e, fx.n, null, false)); break;
        case 'damageFromBlock': if (alive(tgt)) dealDamage(s, tgt, attackDamage(p, tgt, p.block), p, true); break;
        case 'block': gainBlock(s, p, fx.n); blockSoFar += fx.n; break;
        case 'heal': heal(s, p, fx.n); break;
        case 'maxHp': p.maxHp += fx.n; heal(s, p, fx.n); break;
        case 'draw': drawCards(s, p, fx.n); break;
        case 'energy': p.energy += fx.n; break;
        case 'cleanse': for (const k of Object.keys(p.statuses)) if (D.STATUSES[k].debuff) delete p.statuses[k]; break;
        case 'status': {
          const ts = fx.to === 'self' ? [p] : fx.to === 'all' ? livingEnemies(s) : [tgt];
          ts.forEach(t => t && addStatus(s, t, fx.status, fx.n, t === p)); break;
        }
        default: throw new Error('Unknown effect ' + fx.t);
      }
    }
  }

  // ---------- playing cards ----------
  function canPlay(s, p, c) {
    if (s.phase !== 'combat' || !alive(p) || p.endedTurn) return false;
    const d = cardDef(c);
    return !d.unplayable && d.cost <= p.energy;
  }
  function needsTarget(c) { return cardDef(c).target === 'enemy'; }

  function playCard(s, p, cardUid, targetUid) {
    const idx = p.hand.findIndex(c => c.uid === cardUid);
    if (idx < 0) return err('Card not in hand');
    const c = p.hand[idx], def = cardDef(c);
    if (!canPlay(s, p, c)) return err(def.unplayable ? 'Unplayable' : 'Not enough energy');
    let tgt = null;
    if (def.target === 'enemy') {
      tgt = find(s, targetUid);
      if (tgt && tgt.side === 'enemy' && alive(tgt) && !isTargetable(s, tgt)) return err(D.STATUSES.held.tip);
      if (!tgt || tgt.side !== 'enemy' || !alive(tgt)) {
        const l = targetableEnemies(s);
        if (l.length === 1) tgt = l[0]; else return err('Choose a target');
      }
    }
    p.hand.splice(idx, 1);
    p.energy -= def.cost;
    emit(s, { kind: 'cardPlayed', source: p.uid, card: c.id, target: tgt && tgt.uid });
    log(s, `${p.name} plays ${def.name}.`);
    const shovers = s.enemies.filter(e => alive(e) && D.MONSTERS[e.monsterId].shove).map(e => ({ e, before: e.hp + e.block }));
    // Replay = a second play (Fading hook: notePlay runs once per play); Repeat X = the effect X times inside ONE play.
    // Replay on an Exhaust/Vanish card plays both times, then the card leaves once (Producer 11:34).
    const plays = playsOf(def), reps = repeatOf(def);
    const bloodied = !!def.bloodied && isBloodied(p);   // checked when the card is played (before its effects)
    for (let k = 0; k < plays; k++) {
      if (k > 0) {
        if (!alive(p) || !livingEnemies(s).length) break;
        if (def.target === 'enemy' && !isTargetable(s, tgt)) { tgt = targetableEnemies(s)[0] || null; if (!tgt) break; }   // a dead target: the Replay goes to the first enemy left
        emit(s, { kind: 'cardReplayed', source: p.uid, card: c.id, target: tgt && tgt.uid });
        log(s, `${def.name} plays again (Replay).`);
      }
      for (let r = 0; r < reps; r++) runEffects(s, p, fadeFx(def, c, def.effects), tgt, c);   // Fading: this play uses the number left
      if (bloodied) { emit(s, { kind: 'bloodied', source: p.uid, card: c.id }); runEffects(s, p, def.bloodied.effects, tgt, c); }
      notePlay(s, p, c);
    }
    const fadedOut = !!def.fading && fadeLeft(def, c) <= 0;
    if (fadedOut) { emit(s, { kind: 'fadedOut', source: p.uid, card: c.id }); log(s, `${def.name} fades out.`); }
    // Powers (Anna): once played they stay in play for the rest of the fight, in their own list, not in any pile.
    if (def.type === 'power') { (p.powers = p.powers || []).push(c); emit(s, { kind: 'powerPlayed', source: p.uid, card: c.id, up: !!c.up }); }
    else if (def.exhaust || fadedOut) exhaustCard(s, p, c);
    else p.discard.push(c);
    for (const { e, before } of shovers) {   // one big hit shoves one status card off (Beast's Grand Slam)
      const sh = D.MONSTERS[e.monsterId].shove, k = p.hand.findIndex(x => x.id === sh.card);
      if (k >= 0 && before - (Math.max(0, e.hp) + e.block) >= sh.at) {
        const j = p.hand.splice(k, 1)[0]; exhaustCard(s, p, j);
        emit(s, { kind: 'shove', source: p.uid, target: e.uid, card: j.id });
        log(s, `${p.name} shoves the ${D.CARDS[j.id].name} off.`);
      }
    }
    checkEnd(s);
    return { ok: true };
  }

  // Every Exhaust goes through here, so a Last Word always fires (Exhaust keyword, a Fading card at 0, a shoved status card).
  function exhaustCard(s, p, c) { p.exhaust.push(c); lastWord(s, p, c); }
  // Last Word (how_to_play_v1): when this card Exhausts or Vanishes, its Last Word line happens (once, with no target).
  function lastWord(s, p, c) {
    const def = cardDef(c);
    if (!def.lastWord || !alive(p) || s.phase !== 'combat') return;
    emit(s, { kind: 'lastWord', source: p.uid, card: c.id }); log(s, `${def.name}: Last Word.`);
    runEffects(s, p, def.lastWord.effects, null, c);
  }

  // Counts a play of a card copy this fight: a Replay counts twice, Repeat once (Producer 11:56). The Fading hook reads this.
  function notePlay(s, p, c) { c.fightPlays = (c.fightPlays || 0) + 1; }

  /* Live card text: returns the description with {i} replaced by the current value.
   * Changed values are wrapped as «+N» (better than printed) or «-N» (worse). */
  function cardText(s, p, c, targetUid) {
    const def = cardDef(c), base = D.CARDS[c.id];
    return liveText(s, p, c, targetUid, def.desc, fadeFx(def, c, def.effects), base.effects);
  }
  // The Bloodied and Last Word lines, live values like cardText, without their keyword prefix (the UI adds it). null if absent.
  function cardLines(s, p, c, targetUid) {
    const def = cardDef(c), base = D.CARDS[c.id], out = {};
    for (const k of ['bloodied', 'lastWord']) out[k] = def[k] ? liveText(s, p, c, targetUid, def[k].desc, def[k].effects, (base[k] || def[k]).effects) : null;
    return out;
  }
  function liveText(s, p, c, targetUid, desc, effects, printedFx) {
    const inCombat = s && s.phase === 'combat' && p;
    const tgt = inCombat && targetUid ? find(s, targetUid) : null;
    let blockSoFar = 0;
    const vals = effects.map((fx, i) => {
      let v = fx.n || 0, printed = (printedFx[i] && printedFx[i].n) || 0;
      if (fx.t === 'block') blockSoFar += fx.n;
      if (fx.t === 'damage' || fx.t === 'damageAll') {
        v = inCombat ? attackDamage(p, tgt, attackBase(p, fx)) : attackBase({ statuses: {} }, fx);
      } else if (fx.t === 'damageFromBlock') {
        v = inCombat ? attackDamage(p, tgt, p.block + blockSoFar) : blockSoFar; printed = v;
        if (!inCombat) return String(v);
      }
      if (v > printed) return `«+${v}»`;
      if (v < printed) return `«-${v}»`;
      return String(v);
    });
    return desc.replace(/\{(\d+)\}/g, (_, i) => vals[+i]);
  }

  // ---------- win / lose / rewards ----------
  function checkEnd(s) {
    if (s.phase !== 'combat') return true;
    if (livingPlayers(s).length === 0) { s.phase = 'defeat'; emit(s, { kind: 'defeat' }); return true; }
    if (livingEnemies(s).length === 0) { winEncounter(s); return true; }
    return false;
  }

  function winEncounter(s) {
    const F = D.FLOORS[s.floor], type = s.node || 'fight';
    const finalBoss = type === 'boss' && s.floor === s.floors - 1;
    s.stats.fights++; if (type === 'elite') s.stats.elites++;
    for (const p of livingPlayers(s)) {
      const g = F.gold[type] || F.gold.fight;
      const gold = randInt(s, g[0], g[1]);
      p.gold += gold;
      p.discard.push(...p.hand, ...p.draw); p.hand = []; p.draw = []; p.block = 0; p.statuses = {}; p.fresh = {};
      runRelics(s, p, 'combatEnd');
      let relic = null;
      if ((type === 'elite' || type === 'boss') && !finalBoss) { relic = randomRelic(s, p); if (relic) gainRelic(s, p, relic); }
      let bonusRelic = null;
      if (s.pendingRelic && !hasRelic(p, s.pendingRelic)) { bonusRelic = s.pendingRelic; gainRelic(s, p, bonusRelic); }
      let potion = null;
      if (!finalBoss && (type === 'elite' || type === 'boss' || rand(s) < D.POTION_DROP)) { const id = randomPotion(s); potion = { id, taken: gainPotion(s, p, id) }; }
      const n = hasRelic(p, 'luckstone') ? 4 : 3;
      p.reward = finalBoss ? { gold, cards: [], relic: null, done: true } : { gold, relic, bonusRelic, potion, cards: rollCardRewards(s, p, n, type), done: false };
    }
    s.pendingRelic = null;
    s.phase = finalBoss ? 'victory' : 'reward';
    emit(s, { kind: finalBoss ? 'victory' : 'encounterWon' });
  }

  // Anna (Nov 3 03:48): bosses always offer legendary cards. A hero with legendaries gets a legendary-only boss pick;
  // legendaries never show up anywhere else (not in normal or elite rewards, events or the shop).
  const hasLegendaries = (cls) => Object.values(D.CARDS).some(d => d.cls === cls && d.rarity === 'legendary');
  function rewardRarityWeights(type, cls) {
    if (type === 'boss' && cls && hasLegendaries(cls)) return { legendary: 1 };
    const weights = { ...D.RARITY_WEIGHTS };
    if (type === 'elite' || type === 'boss') { weights.uncommon *= 1.5; weights.rare *= 3; }
    if (type === 'elite') weights.common = 0; // Anna: elite card rewards are uncommon or rare only
    if (type === 'rareOnly') { weights.common = 0; weights.uncommon = 0; weights.rare = 1; }
    return weights;
  }
  function rollCardRewards(s, p, n, type) {
    const cls = D.HEROES[p.heroId] ? p.heroId : 'fighter';
    const pool = Object.keys(D.CARDS).filter(id => D.CARDS[id].rarity !== 'starter' && D.CARDS[id].cls === cls);
    const weights = rewardRarityWeights(type, cls);
    const picks = [];
    let guard = 0;
    while (picks.length < n && picks.length < pool.length && guard++ < 200) {
      const rarity = weightedPick(s, weights);
      const options = pool.filter(id => D.CARDS[id].rarity === rarity && !picks.includes(id));
      if (options.length) picks.push(pick(s, options));
    }
    return picks;
  }

  function afterNode(s) {
    if (s.node === 'boss') {
      // descend to the next floor
      s.floor++; s.pos = null; s.node = null; s.lastEnc = null;
      s.map = generateMap(s);
      for (const p of livingPlayers(s)) heal(s, p, Math.ceil((p.maxHp - p.hp) * D.FLOOR_HEAL));
      log(s, D.FLOORS[s.floor].name);
      emit(s, { kind: 'newFloor', floor: s.floor });
    }
    s.phase = 'map'; s.enemies = []; s.event = null; s.shop = null;
  }

  function chooseReward(s, p, cardId) {
    if (s.phase !== 'reward' || !p.reward || p.reward.done) return err('No reward to choose');
    if (cardId) {
      if (!p.reward.cards.includes(cardId)) return err('Invalid reward');
      p.deck.push({ uid: uid(s, 'c'), id: cardId });
      log(s, `${p.name} adds ${D.CARDS[cardId].name} to the deck.`);
    }
    p.reward.done = true;
    if (livingPlayers(s).every(x => x.reward && x.reward.done)) afterNode(s);
    return { ok: true };
  }

  function rest(s, p, choice, cardUid) {
    if (s.phase !== 'rest') return err('Not at a rest site');
    if (choice === 'heal') { heal(s, p, Math.round(p.maxHp * D.REST_HEAL)); log(s, `${p.name} rests by the fire.`); }
    else if (choice === 'upgrade') {
      const c = p.deck.find(x => x.uid === cardUid);
      if (!c || !canUpgrade(c)) return err('Pick a card to upgrade');
      c.up = true; log(s, `${p.name} upgrades ${D.CARDS[c.id].name}.`);
      emit(s, { kind: 'upgrade', card: c.uid });
    } else return err('Unknown rest choice');
    p.rested = true;
    if (livingPlayers(s).every(x => x.rested)) { s.players.forEach(x => delete x.rested); afterNode(s); }
    return { ok: true };
  }

  function err(msg) { return { ok: false, error: msg }; }

  // ---------- the single entry point ----------
  function dispatch(s, action) {
    const p = getPlayer(s, action.player);
    if (!p) return err('No such player');
    switch (action.type) {
      case 'CHOOSE_NODE': return chooseNode(s, action.node);
      case 'PLAY_CARD': return playCard(s, p, action.card, action.target);
      case 'END_TURN':
        if (s.phase !== 'combat' || p.endedTurn) return err('Cannot end turn');
        endPlayerTurn(s, p); return { ok: true };
      case 'CHOOSE_REWARD': return chooseReward(s, p, action.card || null);
      case 'REST': return rest(s, p, action.choice, action.card);
      case 'LEAVE':
        if (s.phase !== 'treasure' && s.phase !== 'shop') return err('Nothing to leave');
        afterNode(s); return { ok: true };
      case 'EVENT_CHOICE': return eventChoice(s, p, action.choice);
      case 'EVENT_CONTINUE': return eventContinue(s, p);
      case 'EVENT_PICK': return eventPick(s, p, action.card || null);
      case 'BUY': return buy(s, p, action.kind, action.index);
      case 'SHOP_REMOVE': return shopRemove(s, p, action.card);
      case 'USE_POTION': return usePotion(s, p, action.slot);
      case 'DISCARD_POTION':
        if (!p.potions[action.slot]) return err('No potion there');
        p.potions.splice(action.slot, 1); return { ok: true };
      default: return err('Unknown action ' + action.type);
    }
  }

  function takeEvents(s) { const ev = s.events; s.events = []; return ev; }

  const Engine = { startEncounter, startFight, moveOf, rollCardRewards, newGame, dispatch, takeEvents, describeIntent, canPlay, needsTarget, cardDef, cardText,
    attackDamage, livingEnemies, livingPlayers, targetableEnemies, isTargetable, find, getPlayer, reachable, choiceAllowed, canUpgrade,
    weightOdds, choiceWeights, rewardRarityWeights, describeChoice, isEternal, canRemove, canTransform, removeFromDeck, transformCard, repeatOf, playsOf, fadeLeft, isBloodied, cardLines };
  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
