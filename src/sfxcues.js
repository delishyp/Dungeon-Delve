/* ============================================================
 * SFX CUES: which general game sound an action should play (Anna, Nov 3 05:39/11:12/11:44/11:58; Producer 11:59).
 * Pure logic, no DOM or audio: the UI snapshots the player before and after each action and plays what cues() returns,
 * about 150 ms apart. Also picks the ambience loop for the screen. Node tests require this file directly.
 * Silent on purpose: relics (Anna 11:12), event heals and max HP gains, and the rest-site heal (the heal sound was retired, Producer 11:59).
 * ============================================================ */
(function (root) {
  const isCurse = (D, c) => { const d = D.CARDS[c.id]; return !!d && d.type === 'curse'; };
  function snap(D, s, p) {
    if (!s || !p) return null;
    return { phase: s.phase, floor: s.floor, gold: p.gold, hp: p.hp, deck: p.deck.length,
      curses: p.deck.filter(c => isCurse(D, c)).length, upgraded: p.deck.filter(c => c.up).length };
  }
  // a, b: snapshots before/after one action; action: the dispatched action
  function cues(a, b, action) {
    if (!a || !b) return [];
    const out = [], type = action && action.type;
    if (b.gold > a.gold) out.push('gold_pickup'); else if (b.gold < a.gold) out.push('gold_spend');
    if (a.phase === 'event' && b.hp < a.hp) out.push('hp_cost_wound');                 // an event choice cost HP (combat damage never counts)
    if (b.curses > a.curses) out.push('curse_added');
    const gained = (b.deck - b.curses) - (a.deck - a.curses);
    if (gained > 0 && type !== 'BUY') out.push('card_gain');                           // a shop card buy plays gold_spend alone (AUDIO.md)
    if (b.deck < a.deck) out.push('card_remove');
    if (b.upgraded > a.upgraded) out.push('card_upgrade');
    return out;
  }
  // ambience loop key for the screen: floor loops, the campfire at the rest site, none in menus or during a boss fight
  function ambience(s, screen, bossFight) {
    if (!s || screen !== 'game' || bossFight || s.phase === 'victory' || s.phase === 'defeat') return null;
    if (s.phase === 'rest') return 'rest';
    return s.floor === 0 || s.floor === 1 ? 'floor' + s.floor : null;
  }
  const SfxCues = { snap, cues, ambience };
  root.SfxCues = SfxCues;
  if (typeof module !== 'undefined' && module.exports) module.exports = SfxCues;
})(typeof window !== 'undefined' ? window : globalThis);
