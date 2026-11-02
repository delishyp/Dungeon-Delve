/* ============================================================
 * AUDIO: sounds are synthesized live with WebAudio, except approved recorded
 * ones in window.AUDIO_FILES (assets/audio/game/<name>.ogg, ui_ prefix optional), which replace the synth
 * version once decoded and play at their own file volume (no extra gain). Sfx.play(name) for effects, Sfx.music(floor|'boss'|null)
 * for the looping background track. Mute + volume are kept in localStorage.
 * ============================================================ */
(function () {
  const KEY = 'dungeon-delve-audio';
  let cfg = { muted: false, vol: 0.6, music: 0.7, sfx: 0.9 };   // v2.1 saves only had {muted, vol}: the new fields default in
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* no storage */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } };
  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, disabled = false;

  function init() {
    if (ctx || disabled) return !!ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { disabled = true; return false; }
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.gain.value = 0.32; musBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
    loadFiles();
    return true;
  }
  const buffers = {};
  function loadFiles() {
    const files = window.AUDIO_FILES || {};
    for (const [key, url] of Object.entries(files)) {
      const name = key.replace(/^ui_/, '');
      fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { buffers[name] = buf; })
        .catch(() => { /* keep the synthesized fallback */ });
    }
  }
  function playFile(buf, t0) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(sfxBus); s.start(t0);
  }
  function applyVol() {
    if (!master) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(cfg.muted ? 0 : cfg.vol, t, 0.03);
    sfxBus.gain.setTargetAtTime(cfg.sfx, t, 0.03); musBus.gain.setTargetAtTime(0.42 * cfg.music, t, 0.05);
  }
  const unlock = () => { if (init() && ctx.state === 'suspended') ctx.resume(); if (pendingMusic !== undefined) { const m = pendingMusic; pendingMusic = undefined; music(m); } };
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, (e) => { if (e.isTrusted) unlock(); }, { capture: true }));

  // ---- building blocks ----
  function tone(freq, t0, dur, { type = 'sine', gain = 0.3, attack = 0.005, slide = 0, bus = sfxBus, filter = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); out = f; }
    out.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, { gain = 0.3, type = 'bandpass', freq = 1200, q = 1, sweep = 0, bus = sfxBus } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  const SFX = {
    click: (t) => tone(1400, t, 0.04, { type: 'triangle', gain: 0.12 }),
    hover: (t) => tone(2200, t, 0.025, { type: 'sine', gain: 0.03 }),
    draw: (t) => noise(t, 0.09, { gain: 0.10, freq: 3000, q: 0.7, sweep: 0.5 }),
    card: (t) => { noise(t, 0.18, { gain: 0.22, freq: 800, q: 0.8, sweep: 4 }); tone(320, t, 0.12, { type: 'triangle', gain: 0.08, slide: 2 }); },
    hit: (t) => { noise(t, 0.14, { gain: 0.45, freq: 900, q: 0.9, sweep: 0.3 }); tone(140, t, 0.16, { type: 'sine', gain: 0.5, slide: 0.45 }); },
    bigHit: (t) => { noise(t, 0.3, { gain: 0.6, type: 'lowpass', freq: 2500, sweep: 0.15 }); tone(90, t, 0.35, { type: 'sine', gain: 0.7, slide: 0.4 }); tone(180, t, 0.12, { type: 'square', gain: 0.12, slide: 0.5, filter: 900 }); },
    block: (t) => { tone(620, t, 0.22, { type: 'square', gain: 0.10, filter: 2400 }); tone(933, t, 0.18, { type: 'triangle', gain: 0.10 }); noise(t, 0.06, { gain: 0.2, freq: 4000, q: 2 }); },
    blocked: (t) => { tone(880, t, 0.25, { type: 'triangle', gain: 0.14 }); tone(1320, t + 0.01, 0.2, { type: 'sine', gain: 0.08 }); },
    buff: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.055, 0.22, { type: 'triangle', gain: 0.10 })),
    debuff: (t) => { tone(330, t, 0.4, { type: 'sawtooth', gain: 0.08, slide: 0.5, filter: 1200 }); tone(311, t, 0.4, { type: 'sawtooth', gain: 0.08, slide: 0.5, filter: 1200 }); },
    heal: (t) => [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.35, { type: 'sine', gain: 0.07 })),
    death: (t) => { tone(220, t, 0.9, { type: 'sawtooth', gain: 0.16, slide: 0.25, filter: 700 }); noise(t, 0.7, { gain: 0.25, type: 'lowpass', freq: 900, sweep: 0.2 }); },
    gold: (t) => { tone(1568, t, 0.16, { type: 'triangle', gain: 0.10 }); tone(2093, t + 0.07, 0.25, { type: 'triangle', gain: 0.10 }); },
    potion: (t) => [0, 0.06, 0.12].forEach((d, i) => tone(500 + i * 180, t + d, 0.08, { type: 'sine', gain: 0.12, slide: 1.8 })),
    turn: (t) => { tone(392, t, 0.3, { type: 'triangle', gain: 0.1 }); tone(587, t + 0.08, 0.35, { type: 'triangle', gain: 0.08 }); },
    enemyTurn: (t) => { tone(196, t, 0.4, { type: 'sawtooth', gain: 0.07, filter: 600 }); tone(185, t + 0.12, 0.45, { type: 'sawtooth', gain: 0.07, filter: 600 }); },
    victory: (t) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.4, { type: 'triangle', gain: 0.12 })),
    error: (t) => tone(160, t, 0.12, { type: 'square', gain: 0.07, filter: 800 }),
  };
  let last = {};
  function play(name) {
    if (!ctx || cfg.muted || !(SFX[name] || buffers[name])) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.03) return;      // avoid stacking the same sound
    last[name] = now;
    if (buffers[name]) playFile(buffers[name], now + 0.005); else SFX[name](now + 0.005);
  }

  // ---- music: small procedural loops per floor ----
  const SONGS = {
    0: { bpm: 84, root: 146.83, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], arp: [0, 2, 4, 2, 0, 4, 2, 4], drum: [1, 0, 0, 0, 1, 0, 1, 0], wave: 'triangle' },  // D minor, goblin warrens
    1: { bpm: 70, root: 138.59, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 5, 0], arp: [0, 4, 2, 4, 1, 4, 2, 4], drum: [1, 0, 0, 0, 0, 0, 1, 0], wave: 'sine' },     // C# phrygian, Underdark
    menu: { bpm: 60, root: 110, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], arp: [0, 4, 7, 4, 2, 4, 7, 9], drum: [1, 0, 0, 0, 0, 0, 0, 0], wave: 'sine' },     // A aeolian, slow and misty
    boss: { bpm: 112, root: 110, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 5, 4], arp: [0, 2, 4, 6, 4, 2, 4, 2], drum: [1, 0, 1, 0, 1, 1, 1, 0], wave: 'sawtooth' }, // A harmonic minor
  };
  let song = null, step = 0, nextT = 0, timer = null, pendingMusic;
  const noteF = (s, deg, oct = 0) => s.root * Math.pow(2, (s.scale[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct)) / 12);
  function sched() {
    if (!song) return;
    const s = song, eighth = 60 / s.bpm / 2;
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % s.prog.length, i = step % 8, chord = s.prog[bar];
      if (i === 0) { tone(noteF(s, chord, -1), nextT, eighth * 8, { type: 'sine', gain: 0.22, attack: 0.3, bus: musBus }); tone(noteF(s, chord + 4, -1), nextT, eighth * 8, { type: 'sine', gain: 0.1, attack: 0.4, bus: musBus }); }
      tone(noteF(s, chord + s.arp[i], 1), nextT, eighth * 1.6, { type: s.wave, gain: s.wave === 'sawtooth' ? 0.035 : 0.07, attack: 0.01, bus: musBus, filter: 1800 });
      if (s.drum[i]) { tone(70, nextT, 0.25, { type: 'sine', gain: 0.35, slide: 0.5, bus: musBus }); noise(nextT, 0.05, { gain: 0.06, freq: 300, bus: musBus }); }
      if (i === 4 && step % 32 === 28) noise(nextT, 0.6, { gain: 0.05, freq: 6000, q: 0.5, bus: musBus });
      nextT += eighth; step++;
    }
  }
  function music(which) {
    if (!ctx) { pendingMusic = which; return; }
    const s = which == null ? null : (SONGS[which] || SONGS[0]);
    if (s === song) return;
    song = s; step = 0; nextT = ctx.currentTime + 0.1;
    if (timer) { clearInterval(timer); timer = null; }
    if (song) timer = setInterval(sched, 90);
  }
  window.Sfx = {
    play, music, has: (name) => !!buffers[name],
    get muted() { return cfg.muted; }, get volume() { return cfg.vol; },
    setMuted(m) { cfg.muted = !!m; save(); applyVol(); },
    setVolume(v) { cfg.vol = Math.max(0, Math.min(1, v)); if (cfg.vol > 0) cfg.muted = false; save(); applyVol(); },
    get musicVolume() { return cfg.music; }, get sfxVolume() { return cfg.sfx; },
    setMusicVolume(v) { cfg.music = Math.max(0, Math.min(1, v)); save(); applyVol(); },
    setSfxVolume(v) { cfg.sfx = Math.max(0, Math.min(1, v)); save(); applyVol(); },
    reset() { cfg = { muted: false, vol: 0.6, music: 0.7, sfx: 0.9 }; save(); applyVol(); },
    disable() { disabled = true; },
  };
})();
