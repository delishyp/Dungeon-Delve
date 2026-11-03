// General game sounds (Anna Nov 3 05:39/11:12/11:44/11:58/12:07-12:10, Producer 05:51/11:59, Soundsmith 12:11):
// 1) the cue rules (src/sfxcues.js) on real engine actions, 2) the audio engine (src/audio.js) under a fake WebAudio:
// ambience crossfades, boss fade-out, rest-site harp, Vessa boss music, synth fallbacks, 3) the UI hooks in src/ui.js,
// 4) every wired file is in assets/audio/game with the md5 Soundsmith listed in audio/AUDIO.md (when present).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const D = require('../src/data.js'); require('../src/content.js'); const E = require('../src/engine.js'); const C = require('../src/sfxcues.js');
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const root = path.join(__dirname, '..');

// ---------- 1) cue rules on real engine actions ----------
const game = (hero = 'barbarian') => { const s = E.newGame({ seed: 77, heroes: [hero] }); E.takeEvents(s); return s; };
const run = (s, action) => { const p = s.players[0], a = C.snap(D, s, p); const r = E.dispatch(s, Object.assign({ player: p.uid }, action)); ok(r.ok, JSON.stringify(action) + ' ' + r.error); E.takeEvents(s); return C.cues(a, C.snap(D, s, p), action); };
const findChoice = (pred) => { for (const [id, ev] of Object.entries(D.EVENTS)) ev.choices.forEach((ch, i) => { if (!found && ch.ops && !ch.chance && pred(ch.ops)) found = { id, i }; }); return found; };
let found;
const evCues = (pred, what) => { found = null; const f = findChoice(pred); ok(f, 'an event choice that ' + what);
  const s = game(), p = s.players[0]; p.hp = p.maxHp - 20; p.gold = 200; s.phase = 'event'; s.event = { id: f.id, stage: 'choose', result: null, next: null, pick: null, log: [] };
  return run(s, { type: 'EVENT_CHOICE', choice: f.i }); };
{ const k = evCues(o => o.hp < 0 && o.gold > 0 && !o.curse, 'costs HP for gold'); eq(k, ['gold_pickup', 'hp_cost_wound'], 'event HP cost for gold'); }
{ const k = evCues(o => o.curse && o.gold > 0, 'gives gold and a curse'); eq(k, ['gold_pickup', 'curse_added'], 'event gold + curse'); }
{ const k = evCues(o => o.healPct && o.maxHp && !o.gold, 'heals and raises max HP'); eq(k, [], 'event heal + max HP gain stay silent (Producer 11:59)'); }
{ const k = evCues(o => o.upgradeRandom, 'upgrades a random card'); eq(k, ['card_upgrade'], 'event random upgrade'); }
{ const k = evCues(o => o.relic && !o.curse && !(o.hp < 0) && !o.upgradeRandom, 'gives a relic'); ok(k.every(x => x === 'gold_pickup' || x === 'gold_spend'), 'relics stay silent (Anna 11:12): ' + k); }
// rest site: heal is silent (rest_heal retired), Train plays the upgrade
{ const s = game(), p = s.players[0]; p.hp = 20; s.phase = 'rest'; eq(run(s, { type: 'REST', choice: 'heal' }), [], 'rest-site heal is silent'); }
{ const s = game(), p = s.players[0]; s.phase = 'rest'; const c = p.deck.find(E.canUpgrade); eq(run(s, { type: 'REST', choice: 'upgrade', card: c.uid }), ['card_upgrade'], 'rest-site Train'); }
// shop: a card buy plays gold_spend alone; the removal service plays gold_spend then card_remove
{ const s = game(), p = s.players[0]; p.gold = 999;
  // a shop from an event (ops.shop) uses the same openShop as a map node
  found = null; const f = findChoice(o => o.shop); ok(f, 'an event that opens a shop');
  s.phase = 'event'; s.event = { id: f.id, stage: 'choose', result: null, next: null, pick: null, log: [] }; run(s, { type: 'EVENT_CHOICE', choice: f.i });
  if (s.phase === 'event') run(s, { type: 'EVENT_CONTINUE' });
  ok(s.phase === 'shop' && s.shop, 'shop opened (' + s.phase + ')');
  const ci = s.shop.cards.findIndex(c => !c.sold); eq(run(s, { type: 'BUY', kind: 'card', index: ci }), ['gold_spend'], 'shop card buy');
  const ri = s.shop.relics.findIndex(c => !c.sold); if (ri >= 0) eq(run(s, { type: 'BUY', kind: 'relic', index: ri }), ['gold_spend'], 'shop relic buy (relic itself silent)');
  eq(run(s, { type: 'SHOP_REMOVE', card: p.deck[0].uid }), ['gold_spend', 'card_remove'], 'shop removal service'); }
// card reward pick after a fight
{ const s = game(), p = s.players[0]; E.startEncounter(s, 'lone_goblin'); E.takeEvents(s); s.enemies.forEach(e => { e.hp = 1; });
  let g = 0; while (s.phase === 'combat' && g++ < 30) { const c = p.hand.find(x => E.canPlay(s, p, x) && E.cardDef(x).effects.some(f => f.t === 'damage'));
    if (c) E.dispatch(s, { type: 'PLAY_CARD', player: p.uid, card: c.uid, target: E.livingEnemies(s)[0] && E.livingEnemies(s)[0].uid }); else E.dispatch(s, { type: 'END_TURN', player: p.uid }); E.takeEvents(s); }
  ok(s.phase === 'reward' && p.reward && p.reward.cards.length, 'reached the card reward (' + s.phase + ')');
  eq(run(s, { type: 'CHOOSE_REWARD', card: p.reward.cards[0] }), ['card_gain'], 'reward card pick'); }
// combat damage never plays the event wound
{ const a = { phase: 'combat', gold: 10, hp: 50, deck: 10, curses: 0, upgraded: 0 }; eq(C.cues(a, Object.assign({}, a, { hp: 30 }), { type: 'END_TURN' }), [], 'combat HP loss is not hp_cost_wound'); }
// ambience choice per screen
{ const s = game(); eq([C.ambience(s, 'title', false), C.ambience(s, 'game', false), C.ambience(Object.assign({}, s, { floor: 1 }), 'game', false), C.ambience(Object.assign({}, s, { phase: 'rest' }), 'game', false),
    C.ambience(s, 'game', true), C.ambience(Object.assign({}, s, { phase: 'defeat' }), 'game', false), C.ambience(null, 'game', false)], [null, 'floor0', 'floor1', 'rest', null, null, null], 'ambience keys'); }

// ---------- 2) audio.js under a fake WebAudio ----------
{
  const nodes = [];
  class Param { constructor(v) { this.value = v; this.ev = []; } setValueAtTime(v, t) { this.ev.push(['set', v, t]); this.value = v; } linearRampToValueAtTime(v, t) { this.ev.push(['ramp', v, t]); this.target = v; }
    exponentialRampToValueAtTime(v, t) { this.ev.push(['exp', v, t]); } setTargetAtTime(v, t) { this.ev.push(['tgt', v, t]); this.value = v; } cancelScheduledValues() { this.ev.push(['cancel']); } }
  class Node { constructor(kind) { this.kind = kind; this.out = []; nodes.push(this); } connect(x) { this.out.push(x); return x; } }
  class Ctx { constructor() { this.currentTime = 10; this.state = 'running'; this.destination = new Node('dest'); this.sampleRate = 8000; }
    createGain() { const g = new Node('gain'); g.gain = new Param(1); return g; } createDynamicsCompressor() { return new Node('comp'); } createBiquadFilter() { const f = new Node('filter'); f.frequency = new Param(0); f.Q = new Param(0); return f; }
    createOscillator() { const o = new Node('osc'); o.frequency = new Param(0); o.start = () => {}; o.stop = () => {}; return o; }
    createBuffer() { return { getChannelData: () => new Float32Array(8000) }; }
    createBufferSource() { const s = new Node('src'); s.started = []; s.start = (t) => s.started.push(t); s.stop = (t) => { s.stoppedAt = t; }; return s; }
    decodeAudioData(b) { return Promise.resolve({ name: b.name, duration: 2 }); } resume() {} }
  const files = {}; for (const f of fs.readdirSync(path.join(root, 'assets/audio/game'))) if (f.endsWith('.ogg')) files[f.replace(/\.ogg$/, '')] = 'u/' + f;
  const listeners = {};
  global.window = { AudioContext: Ctx, AUDIO_FILES: files, addEventListener: (ev, fn) => { listeners[ev] = fn; } };
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.fetch = (url) => Promise.resolve({ arrayBuffer: () => Promise.resolve({ name: url.replace(/^u\/|\.ogg$/g, '') }) });
  eval(fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8'));
  const S = window.Sfx;
  // before the first click: no context, the wanted ambience waits
  S.ambience('floor0'); ok(S.ambienceKey === 'floor0' && S.ambiencePlaying === null, 'ambience waits for the first user gesture');
  S.play('gold_pickup'); ok(S.played.includes('gold_pickup'), 'played log records cues even with audio off');
  listeners.pointerdown({ isTrusted: true });
  setTimeout(() => {
    const ctx = nodes.find(x => x.kind === 'dest') && null;
    const srcOf = (name) => nodes.filter(x => x.kind === 'src' && x.buffer && x.buffer.name === name);
    const gainOf = (src) => src.out[0];
    // floor 0 cave loop: started, loops, fades in over 1.5 s on the ambience bus (not the SFX compressor)
    let cave = srcOf('amb_floor1_cave_loop'); ok(cave.length === 1 && cave[0].loop === true, 'cave loop playing, loop=true');
    let g = gainOf(cave[0]); ok(g.gain.ev.some(e => e[0] === 'ramp' && e[1] === 1 && Math.abs(e[2] - 11.5) < 1e-9), 'cave fades in over 1.5 s: ' + JSON.stringify(g.gain.ev));
    const ambBus = g.out[0]; ok(ambBus.out[0].kind === 'gain' && ambBus.out[0].out[0].kind === 'dest', 'ambience bus goes straight to master (no compressor)');
    ok(S.ambiencePlaying === 'floor0', 'ambiencePlaying floor0');
    // boss fight: the ambience fades out over 1.5 s, the boss music plays alone
    S.ambience(null); ok(g.gain.ev.some(e => e[0] === 'ramp' && e[1] === 0 && Math.abs(e[2] - 11.5) < 1e-9) && Math.abs(cave[0].stoppedAt - 11.55) < 1e-9, 'boss fight: cave fades out over 1.5 s');
    ok(S.ambiencePlaying === null, 'no ambience during the boss fight');
    S.music('boss:beholder'); const vi = srcOf('music_boss_vessa_intro'), vl = srcOf('music_boss_vessa_loop');
    ok(vi.length === 1 && !vi[0].loop && vl.length === 1 && vl[0].loop && Math.abs(vl[0].started[0] - (vi[0].started[0] + 2)) < 1e-9, 'Vessa boss music: intro once, then the loop (like the Crier)');
    ok(S.nowPlaying === 'boss:beholder', 'nowPlaying boss:beholder');
    // after the fight: back to the floor loop
    S.ambience('floor0'); cave = srcOf('amb_floor1_cave_loop'); ok(cave.length === 2 && S.ambiencePlaying === 'floor0', 'ambience comes back after the boss fight');
    // rest site: crossfade 1.5 s from the floor loop to the campfire; the harp plays on the music bus
    S.ambience('rest'); const fire = srcOf('amb_rest_campfire_loop'); ok(fire.length === 1 && fire[0].loop, 'campfire loop at the rest site');
    ok(gainOf(cave[1]).gain.ev.some(e => e[0] === 'ramp' && e[1] === 0 && Math.abs(e[2] - 11.5) < 1e-9) && gainOf(fire[0]).gain.ev.some(e => e[0] === 'ramp' && e[1] === 1 && Math.abs(e[2] - 11.5) < 1e-9), 'floor -> campfire crossfade, 1.5 s each way');
    S.music('rest'); const harp = srcOf('music_rest_site_loop'); ok(harp.length === 1 && harp[0].loop && S.nowPlaying === 'rest', 'rest-site harp loops on the music bus');
    ok(gainOf(harp[0]).out[0] !== gainOf(fire[0]).out[0], 'harp and campfire are on different buses');
    S.ambience('floor0'); ok(gainOf(fire[0]).gain.ev.some(e => e[0] === 'ramp' && e[1] === 0) && S.ambiencePlaying === 'floor0', 'leaving the rest site crossfades back to the floor loop');
    S.ambience('floor1'); ok(srcOf('amb_floor2_hanging_town_loop').length === 1 && S.ambiencePlaying === 'floor1', 'Floor 2 loops the Hanging Town');
    // one-shot sounds play their file on the SFX bus
    for (const name of ['gold_pickup', 'gold_spend', 'hp_cost_wound', 'curse_added', 'card_gain', 'card_remove', 'card_upgrade', 'floor_arrive', 'defeat_stinger']) {
      const before = srcOf(name).length; S.play(name); ok(srcOf(name).length === before + 1, name + ' plays its file'); }
    ok(!files.rest_heal && srcOf('rest_heal').length === 0, 'rest_heal is not in the game (retired 11:59)');
    console.log('sounds ok (' + n + ' checks)');
  }, 50);
}

// ---------- 3) UI hooks ----------
const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8'), au = fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8');
ok(/CUES\.cues\(snap0, CUES\.snap\(D, G, P\(\)\), action\)\.forEach\(\(n, i\) => setTimeout\(\(\) => sfx\(n\), 150 \* \(i \+ 1\)\)\)/.test(ui), 'actInner plays the action cues 150 ms apart');
ok(/banner\(D\.FLOORS\[G\.floor\]\.name, 'floor_arrive'\)/.test(ui), 'new floor banner plays floor_arrive, not the turn horn');
ok(/await tell\(D\.STORY\.defeat\); sfx\('defeat_stinger'\);/.test(ui), "defeat_stinger plays when 'You Have Fallen' shows");
ok(/G\.phase === 'rest' \? 'rest'/.test(ui) && /S\.ambience\(CUES\.ambience\(G, ui\.screen, bossFight\)\)/.test(ui), 'render() picks the rest harp and the ambience loop');
ok(!/sfx\('gold'\)/.test(ui), 'no direct synth gold blips left (shop buy no longer plays twice)');
{ const all = ui + au + fs.readFileSync(path.join(root, 'src/sfxcues.js'), 'utf8');
  ok(!/(sfx|play)\('rest_heal'\)|['"]rest_heal['"]\s*[,}]|: 'rest_heal'/.test(all) && (all.match(/rest_heal/g) || []).length === 2, 'rest_heal is not wired anywhere (only the selftest guard names it)'); }
ok(/'boss:beholder': \{ intro: 'music_boss_vessa_intro', loop: 'music_boss_vessa_loop' \}/.test(au), 'Vessa track entry');
ok(/const AMB_FADE = 1\.5;/.test(au), 'ambience fade is 1.5 s');

// ---------- 4) files and checksums ----------
const WIRED = { gold_spend: '896b1b11', curse_added: 'a6aa595a', floor_arrive: '51587226', music_rest_site_loop: 'bf4ec790', gold_pickup: '3d3741c2', hp_cost_wound: '53b62b92',
  card_upgrade: '1ef90e6d', card_gain: '9dfffd79', card_remove: 'a352ca52', amb_floor1_cave_loop: 'cbd0214c', amb_floor2_hanging_town_loop: '81a34c4d',
  defeat_stinger: '67aebeb1', amb_rest_campfire_loop: '80a11792', music_boss_vessa_intro: 'f1700664', music_boss_vessa_loop: '62ec8a8a' };
const audioMd = path.join(root, 'audio/AUDIO.md'), md = fs.existsSync(audioMd) ? fs.readFileSync(audioMd, 'utf8') : null;
for (const [name, pre] of Object.entries(WIRED)) {
  const f = path.join(root, 'assets/audio/game', name + '.ogg'); ok(fs.existsSync(f), name + '.ogg is in assets/audio/game');
  const h = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'); ok(h.startsWith(pre), name + ' md5 ' + h + ' starts with ' + pre);
  if (md) ok(md.includes(h) || md.includes(pre), name + ' md5 is listed in audio/AUDIO.md');
}
