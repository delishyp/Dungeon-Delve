/* ============================================================
 * CONTENT v2 — events, curses, potions, shop, map rules, roleplay text,
 * sprite sizes. Extends GameData (loaded after data.js). Pure data.
 *
 * Event choices run "ops" (see engine applyOps):
 *  gold n | hp n (negative = lose, never below 1) | healPct f | maxHp n
 *  relic 'random'|id | potion 'random'|id | curse id | upgradeRandom n
 *  removeCurses | then: 'remove' | 'upgrade' | 'cards' | 'rareCards' (a follow-up pick)
 *  fight encId (+ fightType 'elite'|'fight') | shop {discount}
 *  text: what the DM says afterwards.  chance: [{w, ...ops}] picks one branch.
 *  req: {gold n} or {hp n} — choice is greyed out without it.
 * ============================================================ */
(function (root) {
  const D = root.GameData || (typeof require !== 'undefined' ? require('./data.js') : null);

  // ---------- curses (unplayable junk cards) ----------
  Object.assign(D.CARDS, {
    curse_regret:   { cls: 'curse', name: 'Regret', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true,
      desc: 'Unplayable. A memory you cannot shake.', effects: [] },
    curse_rot:      { cls: 'curse', name: 'Mummy Rot', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true, endTurnHpLoss: 2,
      desc: 'Unplayable. If this is in your hand at the end of your turn, lose 2 HP.', effects: [] },
    curse_hex:      { cls: 'curse', name: 'Hex of Misfortune', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true,
      desc: 'Unplayable. Clogs your hand.', effects: [] },
    curse_whispers: { cls: 'curse', name: 'Illithid Whispers', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true, endTurnHpLoss: 1,
      desc: 'Unplayable. If this is in your hand at the end of your turn, lose 1 HP.', effects: [] },
    curse_guilt:    { cls: 'curse', name: 'Guilty Conscience', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true,
      desc: 'Unplayable. You know what you did.', effects: [] },
  });
  D.KEYWORDS.Unplayable = 'Unplayable: this card cannot be played. Remove curses at a shop, the purifying fountain, or some events.';

  // ---------- potions (3 belt slots, used in combat; Healing also on the map) ----------
  D.POTIONS = {
    healing:   { name: 'Potion of Healing', color: '#d8323a', anywhere: true, effects: [{ t: 'heal', n: 15 }], desc: 'Heal 15 HP. Can be drunk anywhere.' },
    fire:      { name: "Alchemist's Fire", color: '#ff8a1e', effects: [{ t: 'damageAllRaw', n: 12 }], desc: 'Deal 12 damage to ALL enemies.' },
    giant:     { name: 'Potion of Giant Strength', color: '#b06a2a', effects: [{ t: 'status', status: 'might', n: 2, to: 'self' }], desc: 'Gain 2 Might for this fight.' },
    speed:     { name: 'Potion of Speed', color: '#e8d23a', effects: [{ t: 'energy', n: 2 }, { t: 'draw', n: 1 }], desc: 'Gain 2 Energy and draw 1 card.' },
    stoneskin: { name: 'Potion of Stone Skin', color: '#8f8f9a', effects: [{ t: 'block', n: 15 }], desc: 'Gain 15 Block.' },
    antitoxin: { name: 'Antitoxin', color: '#4bc06a', effects: [{ t: 'cleanse' }, { t: 'block', n: 6 }], desc: 'Remove all your debuffs and gain 6 Block.' },
  };
  D.POTION_SLOTS = 3;
  D.POTION_DROP = 0.35;            // chance of a potion after a normal fight (elites/bosses: always)

  // ---------- new relics (special ones never appear randomly) ----------
  Object.assign(D.RELICS, {
    smiling_mask:     { name: 'Mask of the Smiling Merchant', hook: 'passive', effects: [], desc: 'Shop prices are 20% lower.' },
    illithid_tadpole: { name: 'Illithid Tadpole', hook: 'combatStart', special: true, effects: [{ t: 'status', status: 'arcane', n: 2, to: 'self' }], desc: 'Start each fight with 2 Arcane (+2 damage per hit). It whispers to you…' },
    tymora_coin:      { name: "Tymora's Lucky Coin", hook: 'combatStart', special: true, effects: [{ t: 'draw', n: 1 }, { t: 'block', n: 4 }], desc: 'At the start of each fight, draw 1 card and gain 4 Block.' },
    wyrm_scale:       { name: 'Red Wyrmling Scale', hook: 'combatStart', special: true, effects: [{ t: 'status', status: 'armor', n: 2, to: 'self' }, { t: 'status', status: 'thorns', n: 1, to: 'self' }], desc: 'Start each fight with 2 Armor and 1 Retaliate.' },
  });

  // ---------- event-only monsters ----------
  Object.assign(D.MONSTERS, {
    wyrmling: { name: 'Red Dragon Wyrmling', hp: [50, 54], elite: true,
      moves: {
        bite:    { name: 'Bite', intent: 'attack', effects: [{ t: 'attack', n: 9 }] },
        buffet:  { name: 'Wing Buffet', intent: 'attack_defend', effects: [{ t: 'block', n: 8 }, { t: 'attack', n: 4 }] },
        breath:  { name: 'Fire Breath', intent: 'attack', effects: [{ t: 'attack', n: 16 }] },
        roar:    { name: 'Tantrum', intent: 'buff', effects: [{ t: 'status', status: 'might', n: 2, to: 'self' }] },
      }, ai: { opener: 'roar', pattern: ['bite', 'buffet', 'breath'] } },
    lesser_mimic: { name: 'Chest Mimic', sprite: 'mimic', hp: [40, 44], elite: true,
      moves: {
        adhesive: { name: 'Adhesive Grip', intent: 'attack_debuff', effects: [{ t: 'attack', n: 6 }, { t: 'status', status: 'prone', n: 1, to: 'target' }] },
        chomp:    { name: 'Chomp', intent: 'attack', effects: [{ t: 'attack', n: 12 }] },
        disguise: { name: 'Play Dead', intent: 'defend', effects: [{ t: 'block', n: 10 }] },
      }, ai: { pattern: ['chomp', 'adhesive', 'disguise'] } },
  });
  Object.assign(D.ENCOUNTERS, {
    wyrmling:     { name: 'An Angry Wyrmling', enemies: ['wyrmling'], scene: 'Dragon Hoard', elite: true },
    lesser_mimic: { name: 'It Was a Mimic!', enemies: ['lesser_mimic'], scene: 'Lonely Chest', elite: true },
    altar_dead:   { name: 'Guardians of the Altar', enemies: ['skeleton', 'skeleton', 'ghoul'], scene: 'Cursed Altar' },
  });

  // Displayed sprite height (px on desktop) — gives the monsters a sense of scale.
  D.SPRITE_H = { fighter: 210, barbarian: 220, wizard: 205,
    goblin: 130, goblin_cutter: 140, goblin_archer: 140, goblin_shaman: 140, kobold: 120, giant_rat: 90, skeleton: 175, gnoll: 195,
    bugbear: 215, ogre: 250, owlbear: 270, ghoul: 170, drow: 190, drow_mage: 195, troll: 265, gelatinous_cube: 220,
    mind_flayer: 230, mimic: 190, lesser_mimic: 150, beholder: 290, wyrmling: 200 };

  // ---------- map ----------
  D.MAP = { rows: 13, cols: 7, paths: 6, depthHp: 0.25, floorHp: 0.1,
    weights: { fight: 45, event: 22, elite: 8, rest: 12, shop: 5 },
    minRow: { elite: 4, rest: 5, shop: 3 },
    treasureRow: 6,
    // what a '?' room secretly turns out to be
    unknown: { event: 70, fight: 15, treasure: 8, shop: 7 } };
  D.NODE_TYPES = {
    fight:    { name: 'Monsters', tip: 'A fight. Win for gold and a card (sometimes a potion).' },
    elite:    { name: 'Elite', tip: 'A dangerous elite monster. Win for more gold, a card, a potion, and a relic.' },
    event:    { name: 'Unknown', tip: 'Something waits here… usually a strange encounter with choices, but it could be a fight, treasure, or a merchant.' },
    shop:     { name: 'Merchant', tip: 'Spend gold on cards, relics and potions, or pay to remove a card from your deck.' },
    rest:     { name: 'Rest Site', tip: 'Rest (heal 30% of max HP) or train (upgrade a card).' },
    treasure: { name: 'Treasure', tip: 'A chest with a relic and some gold.' },
    boss:     { name: 'Boss', tip: 'The floor boss.' },
  };
  D.FLOORS[0].gold = { fight: [13, 20], elite: [28, 38], boss: [70, 85] };
  D.FLOORS[1].gold = { fight: [18, 26], elite: [38, 48], boss: [100, 120] };
  D.FLOORS[0].bg = 'bg_warrens'; D.FLOORS[1].bg = 'bg_underdark';

  // ---------- shop ----------
  D.SHOP = { price: { common: 48, uncommon: 72, rare: 135, relic: 145, potion: 50 }, remove: 75, removeStep: 25 };

  // ---------- events ----------
  D.EVENTS = {
    shrine_tymora: { name: 'Shrine of Tymora', art: 'ev_tymora',
      text: 'A small shrine to Tymora, Lady Luck, glitters with offered coins. A carved face smiles at you, as if daring you to try your luck.',
      choices: [
        { label: 'Flip a coin', hint: 'Pay 15 gold. 50%: Tymora\'s Lucky Coin (relic). 50%: nothing.', req: { gold: 15 },
          ops: { gold: -15 }, chance: [
            { w: 50, relic: 'tymora_coin', text: 'The coin lands on its edge. A warm laugh echoes, and a lucky coin is pressed into your palm.' },
            { w: 50, text: 'The coin lands face down and vanishes. Lady Luck is busy today.' }] },
        { label: 'Pray', hint: 'Upgrade a random card.', ops: { upgradeRandom: 1, text: 'You kneel. When you rise, one of your techniques feels sharper, blessed.' } },
        { label: 'Leave', hint: 'Never tempt fate.', ops: { text: 'You leave the shrine be. Somewhere, a goddess shrugs.' } }] },
    talking_skull: { name: 'The Talking Skull', art: 'ev_skull',
      text: '"Psst! You! Yes, you with the face!" A grinning skull on a pedestal clacks its jaw. "I know secrets. Secrets cost blood. Just a little."',
      choices: [
        { label: 'Ask about treasure', hint: 'Lose 6 HP. Gain 55 gold.', req: { hp: 7 }, ops: { hp: -6, gold: 55, text: '"Third loose brick on the left!" it cackles. Your hand bleeds; your purse grows heavier.' } },
        { label: 'Ask about the boss', hint: 'Lose 8 HP. Upgrade a card of your choice.', req: { hp: 9 }, ops: { hp: -8, then: 'upgrade', text: '"Here\'s how you beat it…" The skull whispers for a long time. You learn something.' } },
        { label: 'Smash it', hint: 'Gain 20 gold. 50% chance of a curse.', ops: { gold: 20 }, chance: [
          { w: 50, text: 'It shatters with a satisfying crunch. Some coins were stuffed in its eye sockets.' },
          { w: 50, curse: 'curse_regret', text: '"You\'ll REGRET this!" it shrieks as it breaks. You do, a little.' }] },
        { label: 'Leave', hint: 'Skulls should not talk.', ops: { text: '"Fine! Rude!" it calls after you.' } }] },
    trapped_chest: { name: 'The Trapped Chest', art: 'ev_trapchest',
      text: 'A sturdy chest sits behind a web of tripwires. Tiny holes in the walls suggest darts. Lots of darts.',
      choices: [
        { label: 'Disarm the trap', hint: '60%: a relic. 40%: lose 10 HP, gain 25 gold.', chance: [
          { w: 60, relic: 'random', text: 'Click. The wires go slack. Inside, wrapped in silk, lies something magical.' },
          { w: 40, hp: -10, gold: 25, text: 'Twang! Darts pepper you. You grab a few coins and stagger back.' }] },
        { label: 'Smash it open', hint: 'Lose 6 HP. Gain 35 gold and a potion.', req: { hp: 7 }, ops: { hp: -6, gold: 35, potion: 'random', text: 'You take the darts on purpose and crack the lid. Gold and a sloshing flask!' } },
        { label: 'Leave', hint: 'Not worth it.', ops: { text: 'You step carefully around the wires and move on.' } }] },
    lost_adventurer: { name: 'A Lost Adventurer', art: 'ev_adventurer',
      text: 'A wounded halfling adventurer sits against the wall, map upside-down. "I\'ve been lost for three days. Please… do you have anything?"',
      choices: [
        { label: 'Share your supplies', hint: 'Lose 25 gold. Choose a rare card to learn from her.', req: { gold: 25 }, ops: { gold: -25, then: 'rareCards', text: '"Thank you, friend!" She shows you a trick from her old adventuring days.' } },
        { label: 'Bandage her wounds', hint: 'Lose 5 HP. Gain a potion.', req: { hp: 6 }, ops: { hp: -5, potion: 'random', text: 'You cut your hand helping her. She presses a flask into it. "For luck."' } },
        { label: 'Rob her', hint: 'Gain 60 gold. Gain a curse (Guilty Conscience).', ops: { gold: 60, curse: 'curse_guilt', text: 'She doesn\'t fight back. That is somehow worse.' } },
        { label: 'Point the way out', hint: 'Nothing happens.', ops: { text: 'You turn her map the right way up. She laughs and hurries off.' } }] },
    wishing_well: { name: 'The Wishing Well', art: 'ev_well',
      text: 'An ancient well glows faintly from below. Coins glitter at the bottom. A rope ladder leads down into the dark.',
      choices: [
        { label: 'Make a wish', hint: 'Pay 20 gold. 55%: heal 40% HP. 30%: a relic. 15%: nothing.', req: { gold: 20 }, ops: { gold: -20 }, chance: [
          { w: 55, healPct: 0.4, text: 'You wish for strength. Warm light rises from the well and closes your wounds.' },
          { w: 30, relic: 'random', text: 'The water bubbles and spits up a glittering trinket. Wish granted!' },
          { w: 15, text: 'Plink. Nothing. Wells are like that.' }] },
        { label: 'Climb down for the coins', hint: '50%: gain 70 gold. 50%: lose 12 HP.', chance: [
          { w: 50, gold: 70, text: 'You fill your pockets with old wishes. Nobody was using them anyway.' },
          { w: 50, hp: -12, text: 'The rope snaps. You land hard, in very cold water.' }] },
        { label: 'Drink the water', hint: '70%: heal 15 HP. 30%: a curse (Mummy Rot).', chance: [
          { w: 70, hp: 15, text: 'Cool and sweet. You feel refreshed.' },
          { w: 30, curse: 'curse_rot', text: 'It tastes of tomb dust. Your skin starts to itch…' }] },
        { label: 'Leave', hint: '', ops: { text: 'You keep your coins and your dignity.' } }] },
    sleeping_wyrmling: { name: 'The Sleeping Wyrmling', art: 'ev_wyrmling',
      text: 'A red dragon wyrmling snores on a pile of gold, puffs of smoke curling from its nostrils. It\'s small… for a dragon.',
      choices: [
        { label: 'Sneak a handful of gold', hint: '60%: gain 65 gold. 40%: it wakes up (elite fight).', chance: [
          { w: 60, gold: 65, text: 'You tiptoe away with your pockets full. The wyrmling mumbles "mine…" in its sleep.' },
          { w: 40, fight: 'wyrmling', fightType: 'elite', text: 'A coin slips. Clink. One golden eye opens. "THIEF!"' }] },
        { label: 'Attack it in its sleep', hint: 'Elite fight. Win: its scale (relic) + elite rewards.', ops: { fight: 'wyrmling', fightType: 'elite', relicAfter: 'wyrm_scale', text: 'You strike first. The wyrmling wakes up VERY angry.' } },
        { label: 'Tiptoe away', hint: 'Let sleeping dragons lie.', ops: { text: 'Wise. Very wise.' } }] },
    deck_many_things: { name: 'The Deck of Many Things', art: 'ev_deck',
      text: 'Four glowing cards hover over a velvet table. The legendary Deck of Many Things. Draw one, and fate decides. People have become kings… or vanished.',
      choices: [
        { label: 'Draw a card', hint: 'Anything can happen.', chance: [
          { w: 20, relic: 'random', gold: 30, text: 'THE SUN. Golden light! Treasure appears at your feet.' },
          { w: 20, upgradeRandom: 2, text: 'THE STAR. Your mind blazes with insight. Two of your cards grow stronger.' },
          { w: 15, healPct: 1, text: 'THE FATES. Reality bends. Your wounds were never there.' },
          { w: 15, then: 'remove', text: 'THE VOID… swallows a part of your past. Choose a card to lose forever.' },
          { w: 15, hp: -12, curse: 'curse_hex', text: 'THE SKULL. A shadowy Avatar of Death strikes you, then fades, laughing.' },
          { w: 15, gold: -9999, maxHp: 6, text: 'THE JESTER. Your gold turns into confetti. You laugh so hard you feel sturdier.' }] },
        { label: 'Walk away', hint: 'Wise adventurers do.', ops: { text: 'The cards sigh and dim as you leave.' } }] },
    mimic_or_not: { name: 'A Lonely Chest', art: 'ev_mimicchest',
      text: 'A single chest sits in an empty room. A gold coin rests on the lid. Is that… drool on the lock?',
      choices: [
        { label: 'Open it', hint: '50%: a relic + 30 gold. 50%: it\'s a mimic (elite fight).', chance: [
          { w: 50, relic: 'random', gold: 30, text: 'Just a chest! A very nice chest, full of nice things.' },
          { w: 50, fight: 'lesser_mimic', fightType: 'elite', text: 'The lid opens… and keeps opening. TEETH!' }] },
        { label: 'Poke it with a stick', hint: 'Gain 25 gold.', ops: { gold: 25, text: 'It flinches! The mimic spits out some coins and scuttles away, offended.' } },
        { label: 'Leave', hint: '', ops: { text: 'You back away slowly. The chest seems disappointed.' } }] },
    wandering_merchant: { name: 'The Wandering Merchant', art: 'ev_merchant',
      text: '"Ah, customers! In a dungeon! What luck!" A tiefling pedlar tips her enormous hat beside a mule cart piled with curiosities.',
      choices: [
        { label: 'Browse her wares', hint: 'Open a shop.', ops: { shop: { discount: 0 }, text: '"Take your time, take your time. No refunds."' } },
        { label: 'Haggle', hint: '50%: 30% discount. 50%: prices go up 25%.', chance: [
          { w: 50, shop: { discount: 0.3 }, text: '"You drive a hard bargain, friend!" She knocks a chunk off every price.' },
          { w: 50, shop: { discount: -0.25 }, text: '"Haggle with ME?" She scribbles new, higher price tags.' }] },
        { label: 'Leave', hint: '', ops: { text: '"Your loss!" she calls cheerfully.' } }] },
    cursed_altar: { name: 'The Cursed Altar', art: 'ev_altar',
      text: 'A black altar drips with old blood. On top sits a golden idol with a cruel smile. The air hums with dark magic.',
      choices: [
        { label: 'Take the idol', hint: 'Gain a relic and a curse (Hex of Misfortune).', ops: { relic: 'random', curse: 'curse_hex', text: 'You snatch the idol. The runes flare red, and something follows you out.' } },
        { label: 'Offer your blood', hint: 'Lose 10 HP. Upgrade 2 random cards.', req: { hp: 11 }, ops: { hp: -10, upgradeRandom: 2, text: 'The altar drinks deeply. Dark power seeps into your skills.' } },
        { label: 'Desecrate it', hint: 'Fight its undead guardians.', ops: { fight: 'altar_dead', fightType: 'fight', text: 'You kick the altar over. Bones rise from the floor to defend it!' } },
        { label: 'Leave', hint: '', ops: { text: 'Some things are best left alone.' } }] },
    yawning_portal: { name: 'The Yawning Portal', art: 'ev_tavern',
      text: 'Impossibly, there\'s a tavern down here, loud with song and spilled ale. A half-orc slams a fist on the table. "Who wants to arm-wrestle?"',
      choices: [
        { label: 'Buy a round', hint: 'Pay 15 gold. Heal 20 HP.', req: { gold: 15 }, ops: { gold: -15, hp: 20, text: 'The bard plays your favorite song. Everyone sings badly. You feel wonderful.' } },
        { label: 'Arm-wrestle the half-orc', hint: '50%: gain 45 gold. 50%: lose 8 HP.', chance: [
          { w: 50, gold: 45, text: 'Your arm shakes… and SLAM! The tavern roars. The half-orc pays up, grinning.' },
          { w: 50, hp: -8, text: 'SLAM! Your knuckles hit the table. Everyone winces. That\'s going to bruise.' }] },
        { label: 'Swap stories with a veteran', hint: 'Choose a card to add to your deck.', ops: { then: 'cards', text: '"Back in my day…" Some of her stories are even useful.' } },
        { label: 'Leave', hint: '', ops: { text: 'You tip your hat and go back to the dark.' } }] },
    forgotten_library: { name: 'The Forgotten Library', art: 'ev_library',
      text: 'Dusty shelves tower into darkness. On a lectern, a tome bound in chains glows and whispers your name.',
      choices: [
        { label: 'Read the chained tome', hint: 'Lose 7 HP. Choose a rare card.', req: { hp: 8 }, ops: { hp: -7, then: 'rareCards', text: 'The words burn into your mind. Painful, but powerful.' } },
        { label: 'Study quietly', hint: 'Upgrade a card of your choice.', ops: { then: 'upgrade', text: 'Hours pass in candlelight. You master a technique.' } },
        { label: 'Burn a forbidden page', hint: 'Remove a card from your deck.', ops: { then: 'remove', text: 'You burn a page… and forget something you never needed.' } },
        { label: 'Leave', hint: '', ops: { text: 'Shhh. You tiptoe out.' } }] },
    purifying_fountain: { name: 'The Purifying Fountain', art: 'ev_fountain', floors: [1],
      text: 'Deep in the Underdark, a fountain of pure silver water shines. Here, nothing evil can last.',
      choices: [
        { label: 'Bathe', hint: 'Remove ALL curses from your deck (or remove any 1 card if you have none).', ops: { removeCurses: true, text: 'The water washes away every taint on your soul.' } },
        { label: 'Drink deeply', hint: 'Heal 35% HP. Gain 4 max HP.', ops: { healPct: 0.35, maxHp: 4, text: 'It tastes like moonlight. You feel stronger.' } },
        { label: 'Fill a flask', hint: 'Gain a Potion of Healing.', ops: { potion: 'healing', text: 'You bottle a little of the light for later.' } }] },
    illithid_tadpole: { name: 'The Tadpole in the Jar', art: 'ev_tadpole', floors: [1],
      text: 'In an abandoned mind flayer lab, a tadpole wriggles in a glowing jar. You hear it in your head: "Let me in. I can make you powerful."',
      choices: [
        { label: 'Swallow it', hint: 'Gain Illithid Tadpole (relic: +2 Arcane each fight) and a curse (Illithid Whispers).', ops: { relic: 'illithid_tadpole', curse: 'curse_whispers', text: 'It slides behind your eye. Power floods in… and so do the whispers.' } },
        { label: 'Smash the jar', hint: 'Gain 30 gold from the lab.', ops: { gold: 30, text: 'The tadpole shrieks and dissolves. You loot the lab for coin.' } },
        { label: 'Leave', hint: '', ops: { text: 'NOPE.' } }] },
    myconid_circle: { name: 'The Myconid Circle', art: 'ev_myconids', floors: [1],
      text: 'Gentle mushroom-folk sway in a circle, glowing spores drifting between them. They invite you to join the Meld, a shared, peaceful dream.',
      choices: [
        { label: 'Join the Meld', hint: 'Heal 20 HP and upgrade a random card.', ops: { hp: 20, upgradeRandom: 1, text: 'You dream their slow, kind dreams. You wake up healed and wiser.' } },
        { label: 'Eat a mushroom', hint: '50%: +8 max HP. 50%: lose 7 HP.', chance: [
          { w: 50, maxHp: 8, text: 'Delicious! You feel… bigger, somehow.' },
          { w: 50, hp: -7, text: 'That was NOT an edible one. The myconids look embarrassed for you.' }] },
        { label: 'Trade a memory', hint: 'Remove a card from your deck.', ops: { then: 'remove', text: 'They take a memory from you, gently, like picking a mushroom.' } }] },
  };

  // ---------- roleplay text ----------
  D.STORY = {
    intro: {
      fighter: ['You are Ser Aldric, once a captain of the Waterdeep City Guard.', 'Children have gone missing near the old Goblin Warrens. The guard says it\'s not their problem. You disagree.', 'You tighten your shield strap and step into the dark.'],
      barbarian: ['You are Grukka of the Uthgardt, and you are VERY angry.', 'Goblins stole your tribe\'s sacred totem and dragged it into the Warrens. Then they laughed.', 'Nobody laughs at Grukka. You crack your knuckles and go in.'],
      wizard: ['You are Elaria Moonwhisper, a wizard of Candlekeep.', 'A rare spellbook was stolen and sold to something deep below: an Eye Tyrant, say the rumors.', 'You light a glowing orb above your hand and descend.'],
    },
    floor: [
      ['The Goblin Warrens. The air smells of smoke, wet fur and bad decisions.', 'Somewhere ahead, something big hoots. Owls don\'t usually growl.'],
      ['You descend into the Underdark. The light of the surface feels a thousand years away.', 'Mushrooms glow. Drow whisper. And far below, one great eye is watching you.'],
    ],
    rooms: {
      fight: ['You hear scuffling claws ahead. Steel out.', 'Something moves in the shadows. It\'s not friendly.', 'Torchlight flickers on bared teeth.', 'Ambush! Weapons up!', 'The smell hits you first. Then the monsters do.', 'Bones crunch underfoot. You are not alone.'],
      elite: ['The ground shakes with every step. This one is dangerous.', 'Heavy breathing echoes from the dark. You feel very small.', 'A champion of the dungeon blocks your way.'],
      rest: ['A quiet alcove, out of sight. You light a small fire.', 'Safe, for now. You let your guard down for the first time in hours.', 'Embers crackle. Somewhere far away, water drips.'],
      treasure: ['A forgotten vault. Something glitters inside.', 'Dust, cobwebs… and a chest that nobody has opened in a century.'],
      shop: ['"Customers! Come in, come in!" A merchant has set up shop, of all places, down here.', 'A lantern swings over a cart full of wares. "Everything has a price, friend."'],
      event: ['The path bends somewhere unexpected…', 'Something strange lies ahead.'],
    },
    taunts: {
      goblin: ['"Shiny things! Give them!"', '"Ha! Tall-folk is lost!"'],
      goblin_cutter: ['"Stab stab stab!"'], goblin_archer: ['"Hold still, target!"'], goblin_shaman: ['"The spirits say you DIE!"'],
      kobold: ['"Big one! Trap it! Trap it!"', '"For the dragon!"'], giant_rat: ['*squeak squeak SQUEAK*', '*hungry chittering*'],
      skeleton: ['*rattle rattle*', '*clack… clack… clack*'], gnoll: ['"Yeenoghu hungers!"', '*mad hyena laughter*'],
      bugbear: ['"Didn\'t see me, did ya?"'], ogre: ['"Ogre SMASH little snack!"', '"You look crunchy."'],
      ghoul: ['"Fresh meat…"', '*wet, hungry hissing*'], drow: ['"Surface scum. Lolth sends her regards."'],
      drow_mage: ['"You will make a fine sacrifice."'], troll: ['"Troll hungry. Troll eat you. Troll heal."'],
      gelatinous_cube: ['*blorp*', '*the cube quivers expectantly*'], mind_flayer: ['"Your mind… looks delicious."', '"Kneel before the Elder Brain."'],
      mimic: ['"Surprise!"', '*chomp chomp*'], lesser_mimic: ['"Surprise!"'], wyrmling: ['"MY gold! MINE!"', '"I\'m not small, I\'m FEROCIOUS!"'],
    },
    bossIntro: {
      owlbear: ['The den reeks of blood. Bones of goblins and worse litter the floor.', 'A towering shape unfolds: half owl, half bear, ALL rage.', 'OWLBEAR: "HOOOOO-RRRAAARGH!"'],
      beholder: ['A vast chamber of melted stone. Gold heaped everywhere. And floating above it all…', 'XANATHAR: "Well, well. A little adventurer, all the way down here. In MY lair."', 'XANATHAR: "Do you know how many eyes I have? You\'re about to find out."'],
    },
    bossDefeat: {
      owlbear: ['The owlbear lets out one last, sad "hoo…" and collapses.', 'Behind its nest, a crack in the floor leads down. Deeper. Darker.'],
      beholder: ['XANATHAR: "No… NO! Not my beautiful eyes! Not my… goldfish…"', 'The great eye flickers, and the Eye Tyrant crashes to the floor.'],
    },
    victory: {
      fighter: ['You climb back to the surface carrying the rescued children and a beholder\'s eye as proof.', 'Waterdeep throws a parade. The Guard Captain apologizes. Ser Aldric, Hero of the Warrens.'],
      barbarian: ['Grukka returns home with the sacred totem and a beholder eyestalk as a hat.', 'The tribe feasts for nine days. Nobody laughs at Grukka. Ever again.'],
      wizard: ['Elaria opens the recovered spellbook. Xanathar had been using it as a coaster.', 'Candlekeep names a reading room after you. It has a very strict "no beholders" rule.'],
    },
    defeat: ['Your vision fades. The dungeon claims another hero.', 'Somewhere, a bard will sing of your bravery. Probably with a few changes.', 'But legends always get a second chance…'],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------- card frame type (by MAIN effect, not by class) ----------
 * attack  (red)    deals damage
 * debuff  (purple) otherwise: mainly applies statuses to enemies (Prone, Frightened, Poisoned)
 * defense (blue)   otherwise: Block, Armor or cleansing
 * buff    (green)  otherwise: buffs yourself (Might, Rage, Arcane, Retaliate)
 * utility (gold)   otherwise: healing, energy, card draw
 * curse   (black)  curses
 * FRAME_OVERRIDE can pin a card to a frame by hand. */
(function (G) {
  G.FRAME_OVERRIDE = {};
  G.FRAME_COLORS = { attack: 'red', defense: 'blue', buff: 'green', debuff: 'purple', utility: 'gold', curse: 'black' };
  G.frameOf = function (def, id) {
    if (G.FRAME_OVERRIDE[id]) return G.FRAME_OVERRIDE[id];
    if (def.type === 'curse') return 'curse';
    const fx = def.effects || [];
    if (fx.some(f => /^damage/.test(f.t))) return 'attack';
    if (fx.some(f => f.t === 'status' && (f.to === 'target' || f.to === 'all'))) return 'debuff';
    if (fx.some(f => f.t === 'block' || f.t === 'cleanse' || (f.t === 'status' && f.status === 'armor'))) return 'defense';
    if (fx.some(f => f.t === 'status')) return 'buff';
    return 'utility';
  };
})(typeof GameData !== 'undefined' ? GameData : (typeof window !== 'undefined' ? window.GameData : module.exports));
