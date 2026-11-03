// Headless simulation: plays many full runs per class with a simple bot.
// Usage: node test/sim.js [runsPerClass] [floors]
const E = require('../src/engine.js');
const D = require('../src/data.js');

function incoming(s) {
  let t = 0;
  for (const e of E.livingEnemies(s)) { const i = E.describeIntent(s, e); if (i && i.damage != null) t += i.damage * i.times; }
  return t;
}
function botTurn(s, p) {
  let guard = 0;
  // potions: drink when hurt, or on turn 1 of elite/boss fights
  while (p.potions.length && (p.hp < p.maxHp * 0.4 || (s.turn === 1 && (s.node === 'boss' || s.node === 'elite') && p.potions.length && guard++ < 1))) {
    const r = E.dispatch(s, { type: 'USE_POTION', player: p.uid, slot: 0 }); if (!r.ok) throw new Error('potion ' + r.error);
    if (s.phase !== 'combat') return;
  }
  guard = 0;
  while (s.phase === 'combat' && guard++ < 50) {
    const playable = p.hand.filter(c => E.canPlay(s, p, c));
    if (!playable.length) break;
    const need = incoming(s) - p.block;
    const foes = E.livingEnemies(s).length;
    const score = c => {
      const d = E.cardDef(c);
      let v = 0;
      for (const fx of d.effects) {
        const t = fx.times || 1;
        if (fx.t === 'damage') v += (fx.n + (fx.scale ? fx.scale.per * (p.statuses[fx.scale.status] || 0) : 0)) * t;
        if (fx.t === 'damageAll') v += fx.n * t * foes;
        if (fx.t === 'block') v += need > 0 ? Math.min(fx.n, need) * 1.3 : 0.5;
        if (fx.t === 'damageFromBlock') v += p.block + 4;
        if (fx.t === 'draw' || fx.t === 'energy') v += 5;
        if (fx.t === 'heal') v += (p.maxHp - p.hp > 8) ? fx.n : 0;
        if (fx.t === 'status') v += 4;
        if (fx.t === 'cleanse') v += 1;
      }
      return v / Math.max(1, d.cost);
    };
    playable.sort((a, b) => score(b) - score(a));
    const c = playable[0];
    if (score(c) <= 0.5 && E.cardDef(c).cost > 0) break;
    const target = E.targetableEnemies(s).sort((a, b) => a.hp - b.hp)[0];
    const r = E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: target && target.uid });
    if (!r.ok) throw new Error('bot play failed: ' + r.error);
  }
  if (s.phase === 'combat') { const r = E.dispatch(s, { type: 'END_TURN', player: p.uid }); if (!r.ok) throw new Error(r.error); }
}
const stats = { events: {}, shops: 0 };
function worst(p) {
  return p.deck.find(c => D.CARDS[c.id].type === 'curse') || p.deck.find(c => D.CARDS[c.id].rarity === 'starter' && D.CARDS[c.id].effects.some(f => f.t === 'block'))
    || p.deck.find(c => D.CARDS[c.id].rarity === 'starter') || p.deck[0];
}
function must(r, what) { if (!r.ok) throw new Error(what + ': ' + r.error); }
function runGame(seed, hero, floors) {
  const s = E.newGame({ seed, heroes: [hero], floors });
  let steps = 0;
  const p = s.players[0];
  while (s.phase !== 'victory' && s.phase !== 'defeat') {
    if (++steps > 5000) throw new Error('stuck seed ' + seed + ' phase ' + s.phase);
    if (s.phase === 'map') {
      const opts = E.reachable(s); if (!opts.length) throw new Error('no reachable nodes');
      // mild preference: avoid elites when hurt, take rests when hurt
      const nodes = opts.map(id => s.map.nodes[id]);
      let choice = nodes[Math.floor((seed + steps) % nodes.length)];
      if (p.hp < p.maxHp * 0.5) choice = nodes.find(n => n.type === 'rest') || nodes.find(n => n.type !== 'elite') || choice;
      else if (p.gold >= 120) choice = nodes.find(n => n.type === 'shop') || choice;
      must(E.dispatch(s, { type: 'CHOOSE_NODE', player: p.uid, node: choice.id }), 'node');
    } else if (s.phase === 'combat') botTurn(s, p);
    else if (s.phase === 'reward') must(E.dispatch(s, { type: 'CHOOSE_REWARD', player: p.uid, card: p.reward.cards[0] }), 'reward');
    else if (s.phase === 'treasure') must(E.dispatch(s, { type: 'LEAVE', player: p.uid }), 'leave');
    else if (s.phase === 'event') {
      const ev = s.event, def = D.EVENTS[ev.id];
      if (ev.stage === 'choose') {
        const ok = def.choices.map((c, i) => i).filter(i => E.choiceAllowed(p, def.choices[i]));
        must(E.dispatch(s, { type: 'EVENT_CHOICE', player: p.uid, choice: ok[(seed + steps) % ok.length] }), 'event');
        stats.events[ev.id] = (stats.events[ev.id] || 0) + 1;
      } else if (ev.stage === 'result') must(E.dispatch(s, { type: 'EVENT_CONTINUE', player: p.uid }), 'event continue');
      else {
        const c = ev.pick === 'remove' ? worst(p) : p.deck.find(E.canUpgrade);
        must(E.dispatch(s, { type: 'EVENT_PICK', player: p.uid, card: c && c.uid }), 'event pick');
      }
    } else if (s.phase === 'shop') {
      const sh = s.shop;
      if (!sh.removed && p.gold >= sh.removeCost) must(E.dispatch(s, { type: 'SHOP_REMOVE', player: p.uid, card: worst(p).uid }), 'remove');
      const ci = sh.cards.findIndex(c => !c.sold && c.price <= p.gold);
      if (ci >= 0) must(E.dispatch(s, { type: 'BUY', player: p.uid, kind: 'card', index: ci }), 'buy card');
      const ri = sh.relics.findIndex(c => !c.sold && c.price <= p.gold);
      if (ri >= 0) must(E.dispatch(s, { type: 'BUY', player: p.uid, kind: 'relic', index: ri }), 'buy relic');
      const pi = sh.potions.findIndex(c => !c.sold && c.price <= p.gold);
      if (pi >= 0 && p.potions.length < D.POTION_SLOTS) must(E.dispatch(s, { type: 'BUY', player: p.uid, kind: 'potion', index: pi }), 'buy potion');
      stats.shops++;
      must(E.dispatch(s, { type: 'LEAVE', player: p.uid }), 'leave shop');
    }
    else if (s.phase === 'rest') {
      const up = p.deck.find(c => !c.up);
      if (p.hp < p.maxHp * 0.7 || !up) must(E.dispatch(s, { type: 'REST', player: p.uid, choice: 'heal' }), 'rest');
      else must(E.dispatch(s, { type: 'REST', player: p.uid, choice: 'upgrade', card: up.uid }), 'upgrade');
    }
    // card text must render for every card in every state
    for (const c of p.deck) { const t = E.cardText(s, p, c); if (/\{|undefined|NaN/.test(t)) throw new Error('bad text ' + c.id + ': ' + t); }
    E.takeEvents(s);
    if (s.phase === 'combat') {
      const real = x => !D.CARDS[x.id].combatOnly;   // Grand Slam junk lives only in the fight
      const n = [p.draw, p.hand, p.discard, p.exhaust].reduce((t, pile) => t + pile.filter(real).length, 0);
      if (p.deck.some(c => D.CARDS[c.id].combatOnly)) throw new Error('combat-only card leaked into deck seed ' + seed);
      if (n !== p.deck.length) throw new Error(`card count ${n} != deck ${p.deck.length} seed ${seed}`);
    }
    if (p.hp > p.maxHp || p.hp < 0 || Number.isNaN(p.hp)) throw new Error('bad hp');
    if (p.gold < 0 || p.potions.length > D.POTION_SLOTS) throw new Error('bad gold/potions');
  }
  JSON.parse(JSON.stringify(s)); // must be serializable
  return { events: s.stats.events, phase: s.phase, floor: s.floor, hp: p.hp, gold: p.gold, relics: p.relics.length, deck: p.deck.length, enc: s.encounter };
}
const N = +process.argv[2] || 300, FL = +process.argv[3] || D.FLOORS.length;
for (const hero of Object.keys(D.HEROES)) {
  let wins = 0, f1 = 0, hp = 0; const killers = {};
  for (let i = 1; i <= N; i++) {
    const r = runGame(i * 7919 + hero.length, hero, FL);
    if (r.phase === 'victory') { wins++; hp += r.hp; } else killers[r.enc] = (killers[r.enc] || 0) + 1;
    if (r.phase === 'victory' || r.floor > 0) f1++;
  }
  const top = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + ':' + v).join(' ');
  console.log(`${hero.padEnd(10)} win ${(100 * wins / N).toFixed(0)}%  cleared floor1 ${(100 * f1 / N).toFixed(0)}%  avgWinHP ${(hp / Math.max(1, wins)).toFixed(0)}  deaths: ${top}`);
}
console.log('events seen:', Object.keys(stats.events).length, '/', Object.keys(D.EVENTS).length, ' shops visited:', stats.shops);
const a = JSON.stringify(runGame(42, 'wizard', FL)), b = JSON.stringify(runGame(42, 'wizard', FL));
if (a !== b) throw new Error('not deterministic');
console.log('deterministic ok', a);
