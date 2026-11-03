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
    curse_whispers: { cls: 'curse', name: 'Whispers Behind the Eye', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true, endTurnHpLoss: 1,
      desc: 'Unplayable. If this is in your hand at the end of your turn, lose 1 HP.', effects: [] },
    curse_guilt:    { cls: 'curse', name: 'Guilty Conscience', cost: 0, type: 'curse', rarity: 'curse', target: 'none', unplayable: true,
      desc: 'Unplayable. You know what you did.', effects: [] },
    // Combat-only junk from the Beast's Grand Slam: never enters the deck, gone when the fight ends.
    junk_broken_bone: { cls: 'curse', name: 'Broken Bone', cost: 0, type: 'junk', rarity: 'junk', target: 'none', unplayable: true, combatOnly: true,
      kwTips: { Unplayable: 'Unplayable: this card cannot be played. It is gone when the fight ends.' },
      desc: 'Unplayable. Deal 6 or more damage to her with one card to remove this.', effects: [] },
  });
  D.KEYWORDS.Unplayable = 'Unplayable: this card cannot be played. Remove curses at a shop, the Silver Spring, or some events.';

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
    illithid_tadpole: { name: 'The Worm Behind the Eye', hook: 'combatStart', special: true, effects: [{ t: 'status', status: 'arcane', n: 2, to: 'self' }], desc: 'Start each fight with 2 Arcane (+2 damage per hit). It whispers to you…' },
    tymora_coin:      { name: "Brennick's Penny", hook: 'combatStart', special: true, effects: [{ t: 'draw', n: 1 }, { t: 'block', n: 4 }], desc: 'At the start of each fight, draw 1 card and gain 4 Block.' },
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
    mind_flayer: 230, sewn: 255, mimic: 190, lesser_mimic: 150, beholder: 290, wyrmling: 200 };

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
  // Wording: lore/text/events_merchant_v1.md section B (Lorekeeper pass, approved Nov 3). No hint text: each choice is one
  // in-world sentence, and a gamble says so in-world. Rule: a paid choice (gold, HP, a relic or a card) always gives its
  // reward and may roll only for an extra bonus; only free choices can go wrong.
  D.EVENTS = {
    shrine_tymora: { name: 'The Chalk Circle', art: 'ev_tymora',
      text: "Someone has chalked Saint Brennick's circle on the wall and set a tin cup beneath it. The cup is full of coins. Delvers leave one for luck on the way down. None of them came back for theirs.",
      choices: [
        { label: 'Drop fifteen gold in the cup and ask for luck.', hint: '', req: { gold: 15 },
          ops: { gold: -15, relic: 'tymora_coin', text: "The coins settle, and one that isn't yours rolls out against your boot. It's warm. You get the sense there's a reason this tradition has lasted." } },
        { label: 'Kneel under the circle.', hint: '', ops: { upgradeRandom: 1, text: "You don't remember the prayer, but your hands do. When you stand, one of your skills comes easier." } },
        { label: 'Leave the cup alone.', hint: '', ops: { text: 'You walk on. Behind you, a coin drops into the cup, and no one is there.' } }] },
    talking_skull: { name: 'The Skull in the Niche', art: 'ev_skull',
      text: "A skull sits in a wall niche, its jaw wired shut with copper. As you pass, the wire creaks. \"I was a delver too,\" it says. \"I remember things. You don't. That's worth a little blood, isn't it?\"",
      choices: [
        { label: 'Give it a little blood and ask where the gold is.', hint: '', req: { hp: 7 }, ops: { hp: -6, gold: 55, text: '"Third stone on the left. Under the bones." Your hand bleeds. The gold is exactly where it said.' } },
        { label: 'Give it more blood and ask what waits below.', hint: '', req: { hp: 9 }, ops: { hp: -8, then: 'upgrade', text: "It talks for a long time about what's further down. By the end, you know one thing about how to fight it." } },
        { label: "Break it, and hope it doesn't get the last word.", hint: '', ops: { gold: 20 }, chance: [
          { w: 50, text: 'It comes apart like chalk. Someone packed coins into the eye sockets.' },
          { w: 50, curse: 'curse_regret', text: "As it breaks, it says your name, the one you can't remember. You'll be thinking about that for a while. You pocket the coins from its eyes anyway." }] },
        { label: 'Walk on.', hint: '', ops: { text: '"You\'ll be back," it says. "They all come back. Some of them come back like me."' } }] },
    trapped_chest: { name: 'The Wired Chest', art: 'ev_trapchest',
      text: 'A chest sits behind a web of tripwires. The last delver who tried it is still here, slumped against the wall with darts in his neck.',
      choices: [
        { label: 'Work the wires loose and trust your hands.', hint: '', chance: [
          { w: 60, relic: 'random', text: 'Click. The wires go slack. Inside, wrapped in oilcloth, is something someone wanted kept safe.' },
          { w: 40, hp: -10, gold: 25, text: 'Darts bite into your arm. You grab what coins you can reach and stagger back.' }] },
        { label: 'Take the darts and break the lid.', hint: '', req: { hp: 7 }, ops: { hp: -6, gold: 35, potion: 'random', text: 'You let the darts hit you and crack the lid. Gold, and a stoppered flask.' } },
        { label: 'Step around the wires.', hint: '', ops: { text: 'You step around the wires, and around him.' } }] },
    lost_adventurer: { name: 'A Lost Delver', art: 'ev_adventurer',
      text: "A halfling sits against the wall with a map she has drawn over so many times it's nearly black. \"Three days,\" she says. \"Or three weeks. The tunnels keep moving. Do you have anything?\"",
      choices: [
        { label: 'Give her twenty-five gold for the climb.', hint: '', req: { gold: 25 }, ops: { gold: -25, then: 'rareCards', text: 'She folds the coins into her map, then shows you the trick that has kept her alive this long.' } },
        { label: 'Bind her wounds with your own bandages.', hint: '', req: { hp: 6 }, ops: { hp: -5, potion: 'random', text: 'You open your own cut doing it. She gives you her last flask. "I won\'t need it," she says, and doesn\'t explain.' } },
        { label: 'Take her purse.', hint: '', ops: { gold: 60, curse: 'curse_guilt', text: "She doesn't fight back. She just goes back to drawing on the map. That's worse." } },
        { label: 'Turn her map the right way up.', hint: '', ops: { text: 'She stares at it for a long moment, then nods and walks off the wrong way.' } }] },
    wishing_well: { name: "The Saint's Well", art: 'ev_well',
      text: "A stone well stands where no well should be, its rim carved with Saint Brennick's circle. It's the one that fell with the chapel. Coins glint at the bottom, and something down there is singing very softly. The water in the bucket is clear one moment and cloudy the next. The rope on the winch is old, and half its strands have already parted.",
      choices: [
        { label: 'Drop twenty gold in and make a wish.', hint: '', req: { gold: 20 },
          ops: { gold: -20, healPct: 0.4, text: 'Warmth rises out of the well and your wounds close. The singing stops while it happens.' }, chance: [
            { w: 30, relic: 'random', text: 'Warmth rises out of the well and your wounds close. The singing stops while it happens. A moment later, something is pushed up the shaft and lands at your feet, wet and cold.' },
            { w: 70 }] },
        { label: 'Climb down after the coins.', hint: '', chance: [
          { w: 50, gold: 70, text: 'You fill your pockets with old wishes. The singing follows you back up.' },
          { w: 50, hp: -12, text: 'The rope gives. You land hard in water so cold it burns.' }] },
        { label: 'Drink from the bucket while the water looks clear.', hint: '', chance: [
          { w: 70, hp: 15, text: 'It tastes of stone and iron. You feel steadier.' },
          { w: 30, curse: 'curse_rot', text: 'It tastes of something buried. By the time you walk on, your skin has started to itch.' }] },
        { label: 'Leave the well to its singing.', hint: '', ops: { text: 'You go. For a long while you can still hear it.' } }] },
    sleeping_wyrmling: { name: 'The Sleeping Wyrmling', art: 'ev_wyrmling',
      text: 'A young red dragon lies curled on a heap of coins, thin and far too still, smoke leaking from its nose. Something hurt it badly, and it crawled here to sleep it off.',
      choices: [
        { label: 'Take a handful of gold while it sleeps.', hint: '', chance: [
          { w: 60, gold: 65, text: 'You back away with full hands. It murmurs a word in its sleep that might be "mine".' },
          { w: 40, fight: 'wyrmling', fightType: 'elite', text: 'A coin slips. One gold eye opens.' }] },
        { label: 'Strike it before it wakes.', hint: '', ops: { fight: 'wyrmling', fightType: 'elite', relicAfter: 'wyrm_scale', text: 'Your first blow lands. It wakes screaming.' } },
        { label: 'Leave it sleeping.', hint: '', ops: { text: "You go slowly, and you don't breathe until the tunnel bends." } }] },
    deck_many_things: { name: "The Teller's Table", art: 'ev_deck',
      text: "A fortune-teller's table stands in the dark, its cloth rotted, four cards laid face down. The teller is still in her chair. Her hand rests on the deck, waiting for you to draw.",
      choices: [
        { label: 'Turn over a card and take whatever it gives.', hint: '', chance: [
          { w: 20, relic: 'random', gold: 30, text: 'THE LANTERN. Light spills out of the card, and in it lies something somebody lost, and a scatter of their coins.' },
          { w: 20, upgradeRandom: 2, text: 'THE DOOR. Something in you opens. Two of your skills come easier.' },
          { w: 15, healPct: 1, text: 'THE NEEDLE. Every wound you carry closes, neatly, as if stitched.' },
          { w: 15, then: 'remove', text: 'THE HOLLOW. A piece of who you were falls away. Choose what you lose.' },
          { w: 15, hp: -12, curse: 'curse_hex', text: 'THE GRAVE. Cold comes up through the floor and into your chest. Some of it stays.' },
          { w: 15, gold: -9999, maxHp: 6, text: "THE BEGGAR. Your purse is empty. You've never felt so light, or so hard to kill." }] },
        { label: 'Leave the cards where they lie.', hint: '', ops: { text: 'As you go, you hear a card turn over behind you.' } }] },
    mimic_or_not: { name: 'A Lonely Chest', art: 'ev_mimicchest',
      text: 'A single chest sits in an empty room with a gold coin on its lid. The floor around it is very clean. The lock is wet.',
      choices: [
        { label: 'Lift the lid.', hint: '', chance: [
          { w: 50, relic: 'random', gold: 30, text: "Just a chest. Someone's last savings, by the look of it." },
          { w: 50, fight: 'lesser_mimic', fightType: 'elite', text: 'The lid opens, and keeps opening.' }] },
        { label: 'Prod it from as far back as you can reach.', hint: '', ops: { gold: 25, text: 'It flinches, spits out a mouthful of coins and drags itself off into the dark.' } },
        { label: 'Back away from it.', hint: '', ops: { text: 'You back away slowly. Behind you, the lid closes very quietly.' } }] },
    wandering_merchant: { name: 'The Last Cart', art: 'ev_merchant',
      text: 'A pedlar sits on an overturned cart. The mule is still in the harness, or its bones are. "Buying, selling," the pedlar says. "I need enough gold to pay my way out. Nobody gets out for free."',
      choices: [
        { label: "See what's on the cart.", hint: '', ops: { shop: { discount: 0 }, text: '"Take your time. I\'ve got plenty of that."' } },
        { label: 'Push the pedlar on price and risk the temper.', hint: '', chance: [
          { w: 50, shop: { discount: 0.3 }, text: '"Fine. Fine. I\'m in no state to argue." Every price drops.' },
          { w: 50, shop: { discount: -0.25 }, text: '"You think I\'m desperate?" The pedlar crosses out every price and writes higher ones.' }] },
        { label: 'Walk on.', hint: '', ops: { text: '"I\'ll still be here," the pedlar calls after you. "I\'m always still here."' } }] },
    cursed_altar: { name: 'The Black Altar', art: 'ev_altar',
      text: 'A black altar crusted with old offerings. On it sits a gold idol with its eyes scratched out. The scratches are fresh.',
      choices: [
        { label: 'Take the idol.', hint: '', ops: { relic: 'random', curse: 'curse_hex', text: 'You take it. On the way out, you hear bare feet behind you, keeping your pace.' } },
        { label: 'Cut your palm over the altar.', hint: '', req: { hp: 11 }, ops: { hp: -10, upgradeRandom: 2, text: 'The stone drinks. Something answers by sharpening two of your skills.' } },
        { label: 'Tip the altar over.', hint: '', ops: { fight: 'altar_dead', fightType: 'fight', text: 'It cracks on the floor. The bones around it start to stand.' } },
        { label: 'Leave it be.', hint: '', ops: { text: 'Some things are best left where they are.' } }] },
    yawning_portal: { name: 'The Drowned Taproom', art: 'ev_tavern',
      text: 'A taproom from old Saint Brennick, sunk whole on the night the ground split. Water stands ankle-deep. Three delvers have barricaded themselves in with the last of the ale, and a big half-orc woman watches the door. "Pay or wrestle," she says. "Those are the only games left."',
      choices: [
        { label: 'Pay fifteen gold for a seat and a drink.', hint: '', req: { gold: 15 }, ops: { gold: -15, hp: 20, text: 'Nobody sings. You drink in silence by the barricade, and for an hour your wounds stop hurting.' } },
        { label: 'Arm-wrestle the half-orc, though nobody here has beaten her.', hint: '', chance: [
          { w: 50, gold: 45, text: 'Your arm shakes, then hers gives. She pays up without a word.' },
          { w: 50, hp: -8, text: 'Your knuckles crack against the bar. She nods, as if that settled something.' }] },
        { label: "Ask the oldest one how she's lasted this long.", hint: '', ops: { then: 'cards', text: 'She tells you, slowly, and some of it is even true. One part is worth remembering.' } },
        { label: 'Go back out into the dark.', hint: '', ops: { text: 'Behind you, they drag the barricade back into place.' } }] },
    forgotten_library: { name: 'The Damp Library', art: 'ev_library',
      text: 'Shelves rise into the dark, swollen with damp. On a lectern a chained book lies open, and the page is in your handwriting.',
      choices: [
        { label: 'Read the page in your handwriting.', hint: '', req: { hp: 8 }, ops: { hp: -7, then: 'rareCards', text: 'The words burn going in. You learn something you once knew, and it costs you.' } },
        { label: 'Sit and study by candlelight.', hint: '', ops: { then: 'upgrade', text: 'Hours pass. You master one thing, and lose count of the hours.' } },
        { label: 'Burn one of the pages.', hint: '', ops: { then: 'remove', text: 'The page curls up. Something you never needed goes with it.' } },
        { label: 'Close the book and go.', hint: '', ops: { text: 'As you leave, you hear the pages turn back to where they were.' } }] },
    purifying_fountain: { name: 'The Silver Spring', art: 'ev_fountain', floors: [1],
      text: 'Water wells up out of a crack in the floor, clear and silver and far too clean for this place. The rock around it is bare. Nothing grows near it, and nothing lives.',
      choices: [
        { label: 'Wash in it.', hint: '', ops: { removeCurses: true, text: 'The water takes the dirt off you, then everything else that clung on.' } },
        { label: 'Drink deeply.', hint: '', ops: { healPct: 0.35, maxHp: 4, text: 'It tastes of nothing at all. Afterwards you feel stronger, and a little less like yourself.' } },
        { label: 'Fill a flask.', hint: '', ops: { potion: 'healing', text: "You stopper a little for later. It doesn't warm in your hand." } }] },
    illithid_tadpole: { name: 'The Worm in the Jar', art: 'ev_tadpole', floors: [1],
      text: "On a workbench in a dead delver's camp, a pale worm turns slowly in a jar of cloudy water. You hear it without hearing it: \"Let me in. I'll give you back what you've lost.\"",
      choices: [
        { label: 'Drink it down.', hint: '', ops: { relic: 'illithid_tadpole', curse: 'curse_whispers', text: "It slides in behind your eye. Power floods in, and so does a voice that isn't yours." } },
        { label: 'Smash the jar and search the camp.', hint: '', ops: { gold: 30, text: "The worm shrivels on the bench. You go through the dead delver's things for coin." } },
        { label: 'Leave it in the jar.', hint: '', ops: { text: "It keeps talking until you're out of earshot, and a little after." } }] },
    myconid_circle: { name: 'The Dreamers', art: 'ev_myconids', floors: [1],
      text: "A ring of stuck delvers sits around a cold lamp, eyes shut, holding hands. They take turns dreaming the same dream out loud: a kitchen, bread, the sun. It's how they stay themselves. One of them makes room for you.",
      choices: [
        { label: 'Sit down in the circle and close your eyes.', hint: '', ops: { hp: 20, upgradeRandom: 1, text: 'You dream their kitchen with them. When you open your eyes, your wounds have eased and your hands remember something new.' } },
        { label: 'Drink from the bowl they pass round, though not all of them look well for it.', hint: '', chance: [
          { w: 50, maxHp: 8, text: "It's bitter and thick. You feel bigger, somehow, and harder to break." },
          { w: 50, hp: -7, text: "Your stomach turns over. They don't open their eyes while you're sick." }] },
        { label: 'Give them one of your memories for the dream.', hint: '', ops: { then: 'remove', text: "You tell them something you remember. When you've finished, you can't remember what it was." } }] },
  };

  // ---------- roleplay text ----------
  D.STORY = {
    intro: {
      fighter: ["You wake on cold stone in the dark. Your name is {fighter_name}. You know that much, and almost nothing else.", "There's a sword at your hip and a ring on your finger. You don't remember either of them.", "Somewhere above you is Saint Brennick. The only way left is down."],
      barbarian: ["You wake in the dark with blood in your mouth. Your name is {barbarian_name}.", "Tally marks are cut into your forearm. You don't know what you were counting.", "Something in the tunnels is breathing. You get up."],
      wizard: ["You wake beside a guttering candle. Your name is {wizard_name}, and the rest is gone.", "Your spellbook is in your lap. Pages have been torn out, and you don't remember tearing them.", "You cup a small flame in your hand and stand."],
    },
    floor: [
      ["Tunnels, just under Saint Brennick. On quiet nights the town hears knocking from down here.", "Somewhere ahead, something big is dragging bones toward its nest."],
      ["Deeper, the light gives out. These caverns have never seen the sun.", "Drow whisper in the dark, half-blind and half-wild. Something down here never closes its eyes."],
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
      skeleton: ['*rattle rattle*', '*clack… clack… clack*'], gnoll: ['"Hungry. Hungry. Hungry."', '*mad hyena laughter*'],
      bugbear: ['"Didn\'t see me, did ya?"'], ogre: ['"Ogre SMASH little snack!"', '"You look crunchy."'],
      ghoul: ['"Fresh meat…"', '*wet, hungry hissing*'], drow: ['"Light... it hurts... put it OUT."'],
      drow_mage: ['"You will make a fine sacrifice."'], troll: ['"Troll hungry. Troll eat you. Troll heal."'],
      gelatinous_cube: ['*blorp*', '*the cube quivers expectantly*'],
      mimic: ['"Surprise!"', '*chomp chomp*'], lesser_mimic: ['"Surprise!"'], wyrmling: ['"MY gold! MINE!"', '"I\'m not small, I\'m FEROCIOUS!"'],
    },
    // Lines for enemies that talk during the fight (elites and bosses). Story lines: "NAME: ..." is spoken by the
    // enemy, anything else is the narrator. Lorekeeper owns the wording (lore/text/surgeon_v1.md, Lines v2).
    enemyLines: {
      mind_flayer: {
        intro: ["He doesn't look up from his table until he's tied off the thread.", 'THE SURGEON: "Stand in the light. I need to see the joints."'],
        turnTaunts: ['"Long bones. Those will carry weight."', '"The left shoulder is better than the right."', '"Leave the hands whole. I\'ll want them as they are."',
          '"Thick skin. It will take a stitch."', '"Don\'t struggle. It bruises the stock."', '"Strong heart. That goes in the next one."',
          '"An old break in the forearm. Still usable."', '"Turn a little. There."'],
        moveLines: { stitch: ['"Up."', '"Stand. We\'re not finished."', '"Hold it still for me."'] },
        exposed: ['"Then I\'ll do it myself."'],
        defeat: ['THE SURGEON: "Leave the needles. Someone will finish the work."'],
        unravel: ['With no one to hold the thread, it comes apart at every seam.'],
      },
    },
    bossIntro: {
      owlbear: ["The nest is woven from bones, and most of them are small.", "A huge grey shape rises over it: an owlbear, half-bald, with milky eyes.", "The Beast of Saint Brennick spreads her wings. Small skeletons slip out from under them."],
      beholder: ["A cavern lit by nothing. Feral drow kneel around its edges, all facing the middle.", "Above them hangs something round and swollen, made almost entirely of eyes. Every one of them opens at once.", "THE WATCHER: \"I see who you were. Oh, I see it. Shall I tell you?\""],
    },
    bossDefeat: {
      owlbear: ["The Beast sinks down over her nest and goes still, her wings spread over the bones.", "Behind the nest, a crack in the floor leads down. Deeper. Darker."],
      beholder: ["THE WATCHER: \"Dark. Finally, dark.\"", "Every eye closes. At the edges of the cavern, the drow begin to wander off, like animals after a light goes out."],
    },
    victory: {
      fighter: ["You climb out into grey daylight above Saint Brennick.", "{fighter_name} looks at the ring on his finger for a long time. He still doesn't know whose it was."],
      barbarian: ["You drag yourself out into the rain above Saint Brennick.", "Out of habit, {barbarian_name} cuts one more line into his arm. He still doesn't know what he's counting."],
      wizard: ["You climb out under an open sky above Saint Brennick.", "{wizard_name} finds one star she almost knows, and starts walking toward it."],
    },
    defeat: ["Your vision fades. The dark has another one.", "By the time the next delver comes, your body is gone. Maybe you'll turn up again, still wearing your pack.", "Somewhere in the dark, something starts saying your name."],
  };


  // ---------- hero name placeholders ({fighter_name} etc.) ----------
  // Defaults; a chosen name or title can override later via fillNames(text, { names, titles }).
  D.HERO_NAMES = { fighter: 'Bastian Crowe', barbarian: 'Torvald', wizard: 'Isolde Marrin' };
  D.HERO_TITLES = {};   // e.g. { barbarian: 'Unbroken' } -> "Torvald the Unbroken" (no title system yet)
  D.heroName = (id, o = {}) => {
    const n = (o.names && o.names[id]) || D.HERO_NAMES[id] || id;
    const t = (o.titles && o.titles[id]) || D.HERO_TITLES[id];
    return t ? `${n} the ${t}` : n;
  };
  D.fillNames = (text, o = {}) => typeof text !== 'string' ? text
    : text.replace(/\{(\w+)_name\}/g, (m, id) => (D.HERO_NAMES[id] || (o.names && o.names[id])) ? D.heroName(id, o) : m);

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
  G.FRAME_OVERRIDE = { junk_broken_bone: 'curse' };
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
