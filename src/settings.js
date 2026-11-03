/* ============================================================
 * SETTINGS + COMPENDIUM "SEEN" TRACKING (localStorage, apply live)
 * Keys: dungeon-delve-settings-v1, dungeon-delve-seen-v1.
 * Audio levels live in audio.js (key dungeon-delve-audio; the old
 * {muted, vol} format from v2.1 is read as-is and extended).
 * ============================================================ */
(function () {
  const KEY = 'dungeon-delve-settings-v1', SEEN = 'dungeon-delve-seen-v1';
  const DEFAULTS = { speed: 'normal', confirmEnd: true, tooltips: true, skipNarration: false, damageNumbers: true,
    shake: true, reducedMotion: false, uiScale: 100, devMode: false };
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  let cfg = Object.assign({}, DEFAULTS, read(KEY) || {});
  // sanitize values from older / hand-edited storage
  if (!['normal', 'fast', 'instant'].includes(cfg.speed)) cfg.speed = 'normal';
  if (![90, 100, 110, 125, 150, 175].includes(+cfg.uiScale)) cfg.uiScale = 100; else cfg.uiScale = +cfg.uiScale;
  cfg.devMode = cfg.devMode === true;   // Dev / data mode: local only, off unless explicitly switched on
  const listeners = [];
  let seen = Object.assign({ monsters: {}, relics: {}, cards: {}, potions: {} }, read(SEEN) || {});
  let seenDirty = false;
  const flushSeen = () => { if (seenDirty) { seenDirty = false; write(SEEN, seen); } };
  setInterval(flushSeen, 1500);
  window.addEventListener('beforeunload', flushSeen);
  window.Settings = {
    DEFAULTS,
    get(k) { return cfg[k]; },
    all() { return Object.assign({}, cfg); },
    set(k, v) { cfg[k] = v; write(KEY, cfg); listeners.forEach(f => f(k, v)); },
    reset() { cfg = Object.assign({}, DEFAULTS); write(KEY, cfg); listeners.forEach(f => f(null)); },
    onChange(f) { listeners.push(f); },
    speedMul() { return cfg.speed === 'instant' ? 0 : cfg.speed === 'fast' ? 0.5 : 1; },
    seen: {
      mark(kind, id) { if (id && !seen[kind][id]) { seen[kind][id] = 1; seenDirty = true; } },
      has(kind, id) { return !!seen[kind][id]; },
      count(kind) { return Object.keys(seen[kind]).length; },
      reset() { seen = { monsters: {}, relics: {}, cards: {}, potions: {} }; write(SEEN, seen); },
    },
  };
})();
