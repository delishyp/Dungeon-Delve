/* ============================================================
 * GAME DATA — classes, cards, relics, monsters, encounters, map.
 * Pure data: no logic here. Add content by adding entries.
 *
 * Card text: {0}, {1}, ... are replaced by the live value of
 * effect #0, #1 ... (damage includes Might/Arcane/Prone etc.; Rage adds no damage).
 *
 * Card effects (run in order by the engine):
 *  damage {n, times, rageBonus, scale:{status,per}, timesFrom, ragePerUnblocked} – hit the chosen enemy
 *    timesFrom: 'rage' = hit X times, X = your Rage when played (not spent); ragePerUnblocked: Rage per hit not fully Blocked
 *  loseHp {n} – lose HP (ignores Block) | goad – a targeted enemy not planning to attack switches to an attack
 *  damageAll {n, times}       – hit every enemy
 *  damageFromBlock            – hit chosen enemy for your current Block
 *  block {n} | heal {n} | draw {n} | energy {n} | cleanse
 *  status {status, n, to: 'target'|'all'|'self'}
 *
 * Card flags: rageAttack (an attack that gives Rage; Anna 04:20), upgrade {...} (hand-written upgraded version, merged over
 *  the card instead of the generic rest-site upgrade), power {...} (whole-fight hooks of a Power while it is in play):
 *  rageOnHit n + rageOnHitPerTurn cap (every attack hit on an enemy), rageNoFade, turnStart [effects] (start of each of
 *  your turns), onHpLossEnemyTurn {block, rage} (the first time you lose HP to damage in each enemy turn).
 *
 * Monster move effects: attack {n, times} | block {n} | status | healAllies | healSelf | addCards
 *  summon {monster, max} – sew a minion in front (at most `max` alive) | healMinions {monster, n}
 *  blockLeader {leader, n} – give Block to the summoner | wait – does nothing (a freshly sewn minion)
 *  stripBlock – remove all the target's Block | addCards {card, n, to:'discard'} (default: hand)
 * Monster phase: phase {at, status:{might:n}, moves:{<id>:{attack:{times}}}, pattern:[...]} – once per fight, the
 *  first time it drops to at*maxHp or lower: gains the statuses and switches to the overridden moves/pattern.
 * Monster flags: minion (its summoned id; minions die with it), guardedBy (untargetable by single-target
 *  cards while one of those is alive), ai.summoner (see Engine chooseIntent).
 * ============================================================ */
(function (root) {
  const STATUSES = {
    prone:      { name: 'Prone', debuff: true,  decays: true,
                  tip: 'Prone: takes 50% more damage from attacks. Goes down by 1 at the end of its turn.' },
    frightened: { name: 'Frightened', debuff: true,  decays: true,
                  tip: 'Frightened: deals 25% less attack damage. Goes down by 1 at the end of its turn.' },
    poisoned:   { name: 'Poisoned', debuff: true,  decays: false,
                  tip: 'Poisoned: loses HP equal to its Poison at the start of its turn (ignores Block), then Poison goes down by 1.' },
    might:      { name: 'Might', debuff: false, decays: false,
                  tip: 'Might: each hit deals extra damage equal to Might. Lasts the whole fight.' },
    rage:       { name: 'Rage', debuff: false, decays: true,
                  tip: 'Rage: while you have any Rage, you take 25% less damage from attacks, however many stacks you have. Rage adds no damage; some cards count your stacks. Goes down by 1 at the end of your turn.' },
    arcane:     { name: 'Arcane Focus', debuff: false, decays: false,
                  tip: "Arcane Focus: each stack adds 2 to the damage and Block of your spells, on every hit. Cantrips don't get it. Lasts the whole fight." },
    armor:      { name: 'Armor', debuff: false, decays: false,
                  tip: 'Armor: gain this much Block at the start of every turn. Lasts the whole fight.' },
    thorns:     { name: 'Retaliate', debuff: false, decays: false,
                  tip: 'Retaliate: whenever an enemy hits you with an attack, it takes this much damage.' },
    regen:      { name: 'Regenerate', debuff: false, decays: false,
                  tip: 'Regenerate: heals this much HP at the end of its turn.' },
    held:       { name: 'Held Together', debuff: false, decays: false, noCount: true,
                  tip: "He can't be targeted while a Sewn stands." },
  };

  const KEYWORDS = {
    Block:      'Block: absorbs incoming damage. Block disappears at the start of your next turn.',
    Exhaust:    'Exhaust: after you play this card it is removed for the rest of the fight.',
    Energy:     'Energy: you get 3 each turn. Each card costs the number in its corner.',
    Upgrade:    'Upgraded cards (marked +) have better numbers. Upgrade cards at rest sites.',
    // Keyword lines (Anna 11:17), wording from lore/text/how_to_play_v1.md section 3 (Lorekeeper).
    Spell:      "Spell: Arcane Focus makes this card stronger. Cards without Spell are cantrips: cheap and quick, and Arcane Focus doesn't affect them.",
    Retain:     "Retain: the card stays in your hand until you play it. It isn't discarded at the end of your turn.",
    Vanish:     "Vanish: if you don't play the card this turn and it would be discarded at the end of your turn, it's removed for the rest of the fight instead.",
    Repeat:     'Repeat X: the card\'s effect happens X times. "Deal 4 damage. Repeat 3." deals 12 in total.',
    Replay:     "Replay: the card is played one more time. A card with Replay and Repeat 3 does its effect 6 times. If it also has Exhaust or Vanish, it's played both times before it's removed.",
    Eternal:    'Eternal: the card can never be removed from your deck, in any way. Shops, events, the Silver Spring and card effects can\'t take it, though you can still upgrade it.',
    Fading:     "Fading: each time you play it this fight, its numbers drop by 1. At 0, it Exhausts. It's back to full in the next fight.",
    'Last Word': 'Last Word: when this card Exhausts or Vanishes, its Last Word line happens.',
    Bloodied:   "Bloodied: the Bloodied line only counts while you're at half your HP or less.",
  };
  for (const k in STATUSES) KEYWORDS[STATUSES[k].name] = STATUSES[k].tip;

  const CARDS = {
    // ================= FIGHTER =================
    // Number pass (Nov 3, Producer 06:38; random-pick runs were 73.5%): Shield Block 6->5, Trip Attack Prone 2->1, Riposte 5/5->4/4,
    // Rally 7->5 Block, Battle Cry 2->1 Might, Defense 3->2 Armor, Indomitable 14->11, Sundering Blow 10->8. Wizard: Ray of Frost 7->5.
    strike: { cls: 'fighter', name: 'Longsword Strike', cost: 1, type: 'attack', rarity: 'starter', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 6 }] },
    defend: { cls: 'fighter', name: 'Shield Block', cost: 1, type: 'skill', rarity: 'starter', target: 'none',
      desc: 'Gain {0} Block.', effects: [{ t: 'block', n: 5 }] },
    second_wind: { cls: 'fighter', name: 'Second Wind', cost: 1, type: 'skill', rarity: 'starter', target: 'none', exhaust: true,
      desc: 'Heal {0} HP. Draw {1} card. Exhaust.', effects: [{ t: 'heal', n: 4 }, { t: 'draw', n: 1 }] },
    cleave: { cls: 'fighter', name: 'Cleave', cost: 1, type: 'attack', rarity: 'common', target: 'none',
      desc: 'Deal {0} damage to ALL enemies.', effects: [{ t: 'damageAll', n: 10 }] },
    shield_bash: { cls: 'fighter', name: 'Shield Bash', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Gain {0} Block, then deal damage equal to your Block ({1}).', effects: [{ t: 'block', n: 6 }, { t: 'damageFromBlock' }] },
    trip_attack: { cls: 'fighter', name: 'Trip Attack', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage. Apply {1} Prone.', effects: [{ t: 'damage', n: 7 }, { t: 'status', status: 'prone', n: 1, to: 'target' }] },
    menacing_attack: { cls: 'fighter', name: 'Menacing Attack', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage. Apply {1} Frightened.', effects: [{ t: 'damage', n: 8 }, { t: 'status', status: 'frightened', n: 2, to: 'target' }] },
    precision_attack: { cls: 'fighter', name: 'Precision Attack', cost: 0, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage. Draw {1} card.', effects: [{ t: 'damage', n: 4 }, { t: 'draw', n: 1 }] },
    riposte: { cls: 'fighter', name: 'Riposte', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Gain {0} Block. Deal {1} damage.', effects: [{ t: 'block', n: 5 }, { t: 'damage', n: 4 }] },
    rally: { cls: 'fighter', name: 'Rally', cost: 1, type: 'skill', rarity: 'common', target: 'none',
      desc: 'Gain {0} Block. Draw {1} card.', effects: [{ t: 'block', n: 5 }, { t: 'draw', n: 1 }] },
    great_weapon: { cls: 'fighter', name: 'Great Weapon Smash', cost: 2, type: 'attack', rarity: 'uncommon', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 16 }] },
    battle_cry: { cls: 'fighter', name: 'Battle Cry', cost: 1, type: 'power', rarity: 'uncommon', target: 'none',
      desc: 'Gain {0} Might.', effects: [{ t: 'status', status: 'might', n: 1, to: 'self' }] },
    whirlwind: { cls: 'fighter', name: 'Whirlwind Attack', cost: 2, type: 'attack', rarity: 'uncommon', target: 'none',
      desc: 'Deal {0} damage to ALL enemies twice.', effects: [{ t: 'damageAll', n: 5, times: 2 }] },
    defense_style: { cls: 'fighter', name: 'Fighting Style: Defense', cost: 1, type: 'power', rarity: 'uncommon', target: 'none',
      desc: 'Gain {0} Armor.', effects: [{ t: 'status', status: 'armor', n: 2, to: 'self' }] },
    healing_potion: { cls: 'fighter', name: 'Potion of Healing', cost: 0, type: 'skill', rarity: 'uncommon', target: 'none', exhaust: true,
      desc: 'Heal {0} HP. Exhaust.', effects: [{ t: 'heal', n: 10 }] },
    // Action Surge (Anna 15:18-15:19): a Fighter starter card (replaces the old rare 2 Energy + draw version). Starter rarity,
    // so it never shows up in rewards, the shop or events. The upgrade keeps the effect and cost and drops Exhaust.
    action_surge: { cls: 'fighter', name: 'Action Surge', cost: 0, type: 'skill', rarity: 'starter', target: 'none', exhaust: true,
      desc: 'Gain {0} Energy. Exhaust.', effects: [{ t: 'energy', n: 1 }],
      upgrade: { exhaust: false, desc: 'Gain {0} Energy.' } },
    indomitable: { cls: 'fighter', name: 'Indomitable', cost: 2, type: 'skill', rarity: 'rare', target: 'none',
      desc: 'Gain {0} Block. Remove all your debuffs.', effects: [{ t: 'block', n: 11 }, { t: 'cleanse' }] },
    sundering_blow: { cls: 'fighter', name: 'Sundering Blow', cost: 2, type: 'attack', rarity: 'rare', target: 'enemy',
      desc: 'Deal {0} damage. Apply {1} Prone and {2} Frightened.',
      effects: [{ t: 'damage', n: 8 }, { t: 'status', status: 'prone', n: 2, to: 'target' }, { t: 'status', status: 'frightened', n: 2, to: 'target' }] },
    // ---- Fighter deck styles F1-F5 (lore/text/deck_styles_v1.md, approved by Anna Nov 3 10:41). Retain is a shared keyword (10:42),
    // a `retain: true` flag that the card face writes as its own 'Retain.' line after the effect (Anna 11:17, no tag pills); the
    // desc itself never says Retain. ----
    // F1 Shieldwall
    the_wall_holds: { cls: 'fighter', name: 'The Wall Holds', cost: 2, type: 'power', rarity: 'legendary', target: 'none',
      desc: 'At the end of your turn, deal damage equal to half your Block to ALL enemies.',
      effects: [], power: { endTurnBlockToAll: 0.5 }, upgrade: { cost: 1 } },
    // F2 Maneuvers
    // Cost 3 (upgraded 2), not the planned 2/1: it simmed about 8 points above the other styles at cost 2 (Gamedev, Nov 3).
    read_the_opening: { cls: 'fighter', name: 'Read the Opening', cost: 3, type: 'power', rarity: 'legendary', target: 'none',
      desc: 'The first hit you land each turn on a Prone or Frightened enemy deals double damage.',
      effects: [], power: { openingDouble: true }, upgrade: { cost: 2 } },
    // F3 Drill
    form_and_repeat: { cls: 'fighter', name: 'Form and Repeat', cost: 0, type: 'skill', rarity: 'rare', target: 'none',
      desc: 'Gain {0} Block. Draw {1} card.', effects: [{ t: 'block', n: 4 }, { t: 'draw', n: 1 }],
      upgrade: { effects: [{ t: 'block', n: 6 }, { t: 'draw', n: 1 }] } },
    // Cost 3 (upgraded 2), not the planned 2/1: about 6 points above the other styles at cost 2.
    ten_thousand_drills: { cls: 'fighter', name: 'Ten Thousand Drills', cost: 3, type: 'power', rarity: 'legendary', target: 'none',
      desc: 'Whenever you play your third card in a turn, gain 1 Might (up to 5 a fight).',
      effects: [], power: { thirdCardMight: 1, thirdCardMightCap: 5 }, upgrade: { cost: 2 } },
    // F4 Tempo: three 0-cost commons (names and text by Lorekeeper) and the legendary. Hilt and Give Ground 5 (upgraded 7), not the
    // planned 3/5: at 3 they diluted random-pick decks (random 43.5% -> 32.7%).
    hilt_to_the_teeth: { cls: 'fighter', name: 'Hilt to the Teeth', cost: 0, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 5 }], upgrade: { effects: [{ t: 'damage', n: 7 }] } },
    give_ground: { cls: 'fighter', name: 'Give Ground', cost: 0, type: 'skill', rarity: 'common', target: 'none',
      desc: 'Gain {0} Block.', effects: [{ t: 'block', n: 6 }], upgrade: { effects: [{ t: 'block', n: 8 }] } },
    wait_for_it: { cls: 'fighter', name: 'Wait for It', cost: 0, type: 'skill', rarity: 'common', target: 'none', retain: true,
      desc: 'Draw {0} cards.', effects: [{ t: 'draw', n: 2 }],
      upgrade: { effects: [{ t: 'draw', n: 3 }] } },
    no_wasted_motion: { cls: 'fighter', name: 'No Wasted Motion', cost: 2, type: 'power', rarity: 'legendary', target: 'none',
      desc: 'Whenever you play a 0-cost card, draw 1 card (up to 3 a turn).',
      effects: [], power: { zeroCostDraw: 1, zeroCostDrawPerTurn: 3 }, upgrade: { cost: 1 } },
    // F5 Old Soldier (healing)
    field_dressing: { cls: 'fighter', name: 'Field Dressing', cost: 1, type: 'skill', rarity: 'rare', target: 'none', retain: true, exhaust: true,
      desc: 'Heal {0} HP. Exhaust.', effects: [{ t: 'heal', n: 8 }], upgrade: { effects: [{ t: 'heal', n: 11 }] } },
    old_scars: { cls: 'fighter', name: 'Old Scars', cost: 2, type: 'power', rarity: 'legendary', target: 'none',
      desc: 'Whenever you heal, gain that much Block.',
      effects: [], power: { healToBlock: true }, upgrade: { cost: 1 } },

    // ================= BARBARIAN =================
    // Number pass after the Rage rework (Nov 3, Producer): Greataxe Chop 6->8, Frenzied Strike 6->7, Reckless Flurry 5x3->8x3,
    // Shove 5->7, Mindless Rage 2->3 Might. Rage attacks stay below a normal attack's hit (Anna 04:20).
    greataxe: { cls: 'barbarian', name: 'Greataxe Chop', cost: 1, type: 'attack', rarity: 'starter', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 7 }] },
    parry: { cls: 'barbarian', name: 'Hide Armor', cost: 1, type: 'skill', rarity: 'starter', target: 'none',
      desc: 'Gain {0} Block.', effects: [{ t: 'block', n: 4 }] },
    rage: { cls: 'barbarian', name: 'Rage', cost: 1, type: 'skill', rarity: 'starter', target: 'none',
      desc: 'Gain {0} Rage.', effects: [{ t: 'status', status: 'rage', n: 3, to: 'self' }] },
    reckless_attack: { cls: 'barbarian', name: 'Reckless Attack', cost: 1, type: 'attack', rarity: 'starter', target: 'enemy',
      desc: 'Deal {0} damage. You become {1} Prone.', effects: [{ t: 'damage', n: 8 }, { t: 'status', status: 'prone', n: 1, to: 'self' }] },
    frenzied_strike: { cls: 'barbarian', name: 'Frenzied Strike', cost: 0, type: 'attack', rarity: 'common', target: 'enemy', rageAttack: true,
      desc: 'Deal {0} damage. Gain {1} Rage.', effects: [{ t: 'damage', n: 6 }, { t: 'status', status: 'rage', n: 1, to: 'self' }] },
    intimidating_presence: { cls: 'barbarian', name: 'Intimidating Presence', cost: 1, type: 'skill', rarity: 'common', target: 'none',
      desc: 'Apply {0} Frightened to ALL enemies.', effects: [{ t: 'status', status: 'frightened', n: 2, to: 'all' }] },
    reckless_flurry: { cls: 'barbarian', name: 'Reckless Flurry', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage 3 times. You become {1} Prone.', effects: [{ t: 'damage', n: 10, times: 3 }, { t: 'status', status: 'prone', n: 1, to: 'self' }] },
    primal_roar: { cls: 'barbarian', name: 'Primal Roar', cost: 1, type: 'skill', rarity: 'common', target: 'none',
      desc: 'Gain {0} Rage. Apply {1} Frightened to ALL enemies.', effects: [{ t: 'status', status: 'rage', n: 2, to: 'self' }, { t: 'status', status: 'frightened', n: 1, to: 'all' }] },
    thick_hide: { cls: 'barbarian', name: 'Thick Hide', cost: 1, type: 'skill', rarity: 'common', target: 'none',
      desc: 'Gain {0} Block.', effects: [{ t: 'block', n: 12 }] },
    shove: { cls: 'barbarian', name: 'Shove', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage. Apply {1} Prone.', effects: [{ t: 'damage', n: 7 }, { t: 'status', status: 'prone', n: 2, to: 'target' }] },
    brutal_critical: { cls: 'barbarian', name: 'Brutal Critical', cost: 2, type: 'attack', rarity: 'uncommon', target: 'enemy',
      desc: 'Deal {0} damage. Deals 8 more while you have Rage.', effects: [{ t: 'damage', n: 15, rageBonus: 8 }] },
    whirling_axe: { cls: 'barbarian', name: 'Whirling Axe', cost: 2, type: 'attack', rarity: 'uncommon', target: 'none',
      desc: 'Deal {0} damage to ALL enemies.', effects: [{ t: 'damageAll', n: 13 }] },
    relentless_rage: { cls: 'barbarian', name: 'Relentless Rage', cost: 1, type: 'skill', rarity: 'uncommon', target: 'none', exhaust: true,
      desc: 'Heal {0} HP. Gain {1} Rage. Exhaust.', effects: [{ t: 'heal', n: 10 }, { t: 'status', status: 'rage', n: 2, to: 'self' }] },
    bear_totem: { cls: 'barbarian', name: 'Bearskin', cost: 1, type: 'power', rarity: 'uncommon', target: 'none',
      desc: 'Gain {0} Armor.', effects: [{ t: 'status', status: 'armor', n: 4, to: 'self' }] },
    retaliation: { cls: 'barbarian', name: 'Retaliation', cost: 1, type: 'power', rarity: 'uncommon', target: 'none',
      desc: 'Gain {0} Retaliate.', effects: [{ t: 'status', status: 'thorns', n: 3, to: 'self' }] },
    mindless_rage: { cls: 'barbarian', name: 'Mindless Rage', cost: 1, type: 'power', rarity: 'rare', target: 'none',
      desc: 'Gain {0} Might.', effects: [{ t: 'status', status: 'might', n: 3, to: 'self' }] },
    berserker_frenzy: { cls: 'barbarian', name: 'Berserker Frenzy', cost: 2, type: 'attack', rarity: 'rare', target: 'enemy',
      desc: 'Deal {0} damage 4 times.', effects: [{ t: 'damage', n: 4, times: 4 }] },
    persistent_rage: { cls: 'barbarian', name: 'Persistent Rage', cost: 1, type: 'skill', rarity: 'rare', target: 'none', exhaust: true,
      desc: 'Gain {0} Rage. Draw {1} cards. Exhaust.', effects: [{ t: 'status', status: 'rage', n: 5, to: 'self' }, { t: 'draw', n: 2 }] },
    // ---- Barbarian deck styles B1-B3 (lore/text/deck_styles_v1.md, approved by Anna Nov 3). Art: placeholders (assets/placeholder/). ----
    // B1 Rage Burst: Rage attacks (weaker hits that give Rage), Blood Up (the other route), Enraged (the payoff).
    headbutt: { cls: 'barbarian', name: 'Headbutt', cost: 1, type: 'attack', rarity: 'common', target: 'enemy', rageAttack: true,
      desc: 'Deal {0} damage. Gain {1} Rage. Lose {2} HP.',
      effects: [{ t: 'damage', n: 5 }, { t: 'status', status: 'rage', n: 2, to: 'self' }, { t: 'loseHp', n: 2 }],
      upgrade: { effects: [{ t: 'damage', n: 7 }, { t: 'status', status: 'rage', n: 2, to: 'self' }, { t: 'loseHp', n: 2 }] } },
    wild_swing: { cls: 'barbarian', name: 'Wild Swing', cost: 1, type: 'attack', rarity: 'common', target: 'none', rageAttack: true,
      desc: 'Deal {0} damage to ALL enemies. Gain {1} Rage.',
      effects: [{ t: 'damageAll', n: 4 }, { t: 'status', status: 'rage', n: 1, to: 'self' }],
      upgrade: { effects: [{ t: 'damageAll', n: 6 }, { t: 'status', status: 'rage', n: 1, to: 'self' }] } },
    goad: { cls: 'barbarian', name: 'Goad', cost: 1, type: 'attack', rarity: 'uncommon', target: 'enemy', rageAttack: true,
      desc: "Deal {0} damage. Gain {1} Rage. If the enemy isn't planning to attack, it switches to an attack.",
      effects: [{ t: 'damage', n: 6 }, { t: 'status', status: 'rage', n: 1, to: 'self' }, { t: 'goad' }],
      upgrade: { cost: 0 } },
    bloodied_knuckles: { cls: 'barbarian', name: 'Split Knuckles', cost: 1, type: 'attack', rarity: 'uncommon', target: 'enemy', rageAttack: true,
      desc: "Deal {0} damage twice. Gain 1 Rage for each hit that isn't fully Blocked.",
      effects: [{ t: 'damage', n: 4, times: 2, ragePerUnblocked: 1 }],
      upgrade: { effects: [{ t: 'damage', n: 5, times: 2, ragePerUnblocked: 1 }] } },
    blood_up: { cls: 'barbarian', name: 'Blood Up', cost: 1, type: 'power', rarity: 'rare', target: 'none',
      desc: 'Whenever one of your attacks hits an enemy, gain 1 Rage (up to 3 a turn). Your Rage no longer fades.',
      effects: [], power: { rageOnHit: 1, rageOnHitPerTurn: 3, rageNoFade: true },
      // Blood Up+ (Anna 10:39): base card unchanged; the upgrade adds 4 Might so the Blood Up route pays off once upgraded.
      upgrade: { cost: 0, desc: 'Gain 4 Might. Whenever one of your attacks hits an enemy, gain 1 Rage (up to 3 a turn). Your Rage no longer fades.',
        effects: [{ t: 'status', status: 'might', n: 4, to: 'self' }] } },
    enraged: { cls: 'barbarian', name: 'Enraged', cost: 2, type: 'attack', rarity: 'legendary', target: 'enemy', exhaust: true,
      desc: "Deal {0} damage X times, where X is your Rage. Doesn't spend Rage. Exhaust.",
      effects: [{ t: 'damage', n: 6, timesFrom: 'rage' }],
      upgrade: { effects: [{ t: 'damage', n: 8, timesFrom: 'rage' }] } },
    // B2 The Long Grind (Might): no Might cap (Anna 04:00).
    last_tally: { cls: 'barbarian', name: 'The Last Tally', cost: 2, type: 'power', rarity: 'legendary', target: 'none',
      desc: 'At the start of each of your turns, gain 1 Might.',
      effects: [], power: { turnStart: [{ t: 'status', status: 'might', n: 1, to: 'self' }] },
      upgrade: { cost: 1 } },
    // B3 Iron Hide: Armor and Retaliate; one "lost HP in the enemy turn" hook serves both cards.
    scar_tissue: { cls: 'barbarian', name: 'Scar Tissue', cost: 1, type: 'power', rarity: 'rare', target: 'none',
      desc: 'Whenever you take HP damage, gain 4 Block (once per enemy turn).',
      effects: [], power: { onHpLossEnemyTurn: { block: 4 } },
      upgrade: { desc: 'Whenever you take HP damage, gain 6 Block (once per enemy turn).', power: { onHpLossEnemyTurn: { block: 6 } } } },
    bear_beneath: { cls: 'barbarian', name: 'The Bear Beneath', cost: 2, type: 'power', rarity: 'legendary', target: 'none',
      desc: 'Gain {0} Armor and {1} Retaliate. Whenever you take HP damage, gain 1 Rage (once per enemy turn).',
      effects: [{ t: 'status', status: 'armor', n: 3, to: 'self' }, { t: 'status', status: 'thorns', n: 3, to: 'self' }],
      power: { onHpLossEnemyTurn: { rage: 1 } },
      upgrade: { effects: [{ t: 'status', status: 'armor', n: 4, to: 'self' }, { t: 'status', status: 'thorns', n: 4, to: 'self' }] } },
    // Burn It Down (Exhaust deck style, keyword_use_v2 part 2; Anna 11:54 "build everything"). Upgrades: Lorekeeper's
    // written lines (keyword_use_v2, 14:20). Back in the pools (Producer 15:09, option a): the four former commons are
    // uncommon (they only pay off inside their deck styles) with a numbers pass (Barbarian sims, Tester's qa_bv2).
    // A card or relic can still be switched out of every pool with inPool: false (cardInPool / relicInPool).
    burn_through: { cls: 'barbarian', name: 'Burn Through', cost: 1, type: 'skill', rarity: 'uncommon', target: 'none', exhaust: true,
      desc: 'Gain {0} Block. Exhaust.', effects: [{ t: 'block', n: 9 }],
      upgrade: { effects: [{ t: 'block', n: 12 }] } },
    kindling: { cls: 'barbarian', name: 'Kindling', cost: 1, type: 'power', rarity: 'uncommon', target: 'none',
      desc: 'Whenever a card Exhausts, gain 1 Rage.', effects: [], power: { onExhaust: [{ t: 'status', status: 'rage', n: 1, to: 'self' }] },
      upgrade: { cost: 0 } },
    whats_left: { cls: 'barbarian', name: "What's Left", cost: 2, type: 'attack', rarity: 'uncommon', target: 'enemy',
      desc: 'Deal {0} damage for each card Exhausted this fight.', effects: [{ t: 'damagePerExhausted', n: 3 }],
      upgrade: { effects: [{ t: 'damagePerExhausted', n: 4 }] } },
    // New keyword cards (keyword_use_v2 part 3): Fading, Last Word, Bloodied.
    worn_grip: { cls: 'barbarian', name: 'Worn Grip', cost: 1, type: 'attack', rarity: 'uncommon', target: 'enemy', fading: true,
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 12 }],
      upgrade: { effects: [{ t: 'damage', n: 15 }] } },
    ember_hide: { cls: 'barbarian', name: 'Ember Hide', cost: 1, type: 'skill', rarity: 'uncommon', target: 'none', exhaust: true,
      desc: 'Gain {0} Block. Exhaust.', effects: [{ t: 'block', n: 8 }],
      lastWord: { desc: 'Gain {0} Rage.', effects: [{ t: 'status', status: 'rage', n: 2, to: 'self' }] },
      upgrade: { effects: [{ t: 'block', n: 11 }] } },
    // Blood in the Mouth when Bloodied is ONE hit, Might counts once (Lorekeeper 13:25): addTo joins the first hit.
    // Upgraded: the Bloodied part goes 8 -> 11 (still one combined 21 hit).
    blood_in_mouth: { cls: 'barbarian', name: 'Blood in the Mouth', cost: 1, type: 'attack', rarity: 'uncommon', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 10 }],
      bloodied: { desc: 'Deal {0} more.', effects: [{ t: 'damage', n: 8, addTo: 0 }] },
      upgrade: { effects: [{ t: 'damage', n: 10 }], bloodied: { desc: 'Deal {0} more.', effects: [{ t: 'damage', n: 11, addTo: 0 }] } } },
    last_one_standing: { cls: 'barbarian', name: 'Last One Standing', cost: 1, type: 'skill', rarity: 'uncommon', target: 'none',
      desc: 'Gain {0} Might.', effects: [{ t: 'status', status: 'might', n: 2, to: 'self' }],
      bloodied: { desc: 'Gain {0} more Might and draw {1} card.', effects: [{ t: 'status', status: 'might', n: 2, to: 'self' }, { t: 'draw', n: 1 }] },
      upgrade: { effects: [{ t: 'status', status: 'might', n: 3, to: 'self' }] } },

    // ================= WIZARD =================
    fire_bolt: { cls: 'wizard', kind: 'cantrip', name: 'Fire Bolt', cost: 0, type: 'attack', rarity: 'starter', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 3 }],
      upgrade: { effects: [{ t: 'damage', n: 5 }] } },
    shield_spell: { cls: 'wizard', kind: 'spell', name: 'Shield', cost: 1, type: 'skill', rarity: 'starter', target: 'none',
      desc: 'Gain {0} Block.', effects: [{ t: 'block', n: 5 }] },
    magic_missile: { cls: 'wizard', kind: 'spell', name: 'Magic Missile', cost: 2, type: 'attack', rarity: 'starter', target: 'enemy',
      desc: 'Deal {0} damage 3 times.', effects: [{ t: 'damage', n: 4, times: 3 }] },
    // Starter Fireball (Anna 15:18/15:21): spell, cost 2, 6 to ALL; Fireball+ 10 to ALL, same cost.
    // The old uncommon Fireball (id `fireball`) is now named Wildfire.
    fireball_starter: { cls: 'wizard', kind: 'spell', name: 'Fireball', cost: 2, type: 'attack', rarity: 'starter', target: 'none',
      desc: 'Deal {0} damage to ALL enemies.', effects: [{ t: 'damageAll', n: 6 }],
      upgrade: { effects: [{ t: 'damageAll', n: 10 }] } },
    burning_hands: { cls: 'wizard', kind: 'spell', name: 'Burning Hands', cost: 2, type: 'attack', rarity: 'common', target: 'none',
      desc: 'Deal {0} damage to ALL enemies.', effects: [{ t: 'damageAll', n: 15 }] },
    ray_of_frost: { cls: 'wizard', kind: 'cantrip', name: 'Ray of Frost', cost: 0, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage. Apply {1} Frightened.', effects: [{ t: 'damage', n: 2 }, { t: 'status', status: 'frightened', n: 1, to: 'target' }] },
    thunderwave: { cls: 'wizard', kind: 'spell', name: 'Thunderwave', cost: 2, type: 'attack', rarity: 'common', target: 'none',
      desc: 'Deal {0} damage to ALL enemies. Apply {1} Prone to ALL.', effects: [{ t: 'damageAll', n: 10 }, { t: 'status', status: 'prone', n: 1, to: 'all' }] },
    mage_armor: { cls: 'wizard', kind: 'spell', name: 'Mage Armor', cost: 1, type: 'power', rarity: 'common', target: 'none',
      desc: 'Gain {0} Armor.', effects: [{ t: 'status', status: 'armor', n: 2, to: 'self' }] },
    misty_step: { cls: 'wizard', kind: 'cantrip', name: 'Misty Step', cost: 0, type: 'skill', rarity: 'common', target: 'none',
      desc: 'Gain {0} Block. Draw {1} card.', effects: [{ t: 'block', n: 3 }, { t: 'draw', n: 1 }] },
    chromatic_orb: { cls: 'wizard', kind: 'spell', name: 'Chromatic Orb', cost: 2, type: 'attack', rarity: 'common', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 18 }] },
    poison_spray: { cls: 'wizard', kind: 'cantrip', name: 'Poison Spray', cost: 1, type: 'skill', rarity: 'common', target: 'enemy',
      desc: 'Apply {0} Poisoned.', effects: [{ t: 'status', status: 'poisoned', n: 7, to: 'target' }] },
    fireball: { cls: 'wizard', kind: 'spell', name: 'Wildfire', cost: 3, type: 'attack', rarity: 'uncommon', target: 'none',
      desc: 'Deal {0} damage to ALL enemies.', effects: [{ t: 'damageAll', n: 20 }] },
    scorching_ray: { cls: 'wizard', kind: 'spell', name: 'Scorching Ray', cost: 2, type: 'attack', rarity: 'uncommon', target: 'enemy',
      desc: 'Deal {0} damage 3 times.', effects: [{ t: 'damage', n: 4, times: 3 }] },
    arcane_recovery: { cls: 'wizard', kind: 'cantrip', name: 'Arcane Recovery', cost: 0, type: 'skill', rarity: 'uncommon', target: 'none', exhaust: true,
      desc: 'Gain {0} Energy. Draw {1} cards. Exhaust.', effects: [{ t: 'energy', n: 1 }, { t: 'draw', n: 2 }] },
    arcane_study: { cls: 'wizard', kind: 'cantrip', name: 'Arcane Study', cost: 2, type: 'power', rarity: 'uncommon', target: 'none',
      desc: 'Gain {0} Arcane Focus.', effects: [{ t: 'status', status: 'arcane', n: 2, to: 'self' }],
      upgrade: { cost: 1 } },
    mirror_image: { cls: 'wizard', kind: 'spell', name: 'Mirror Image', cost: 2, type: 'skill', rarity: 'uncommon', target: 'none',
      desc: 'Gain {0} Block. Draw {1} card.', effects: [{ t: 'block', n: 10 }, { t: 'draw', n: 1 }] },
    disintegrate: { cls: 'wizard', kind: 'spell', name: 'Disintegrate', cost: 3, type: 'attack', rarity: 'rare', target: 'enemy',
      desc: 'Deal {0} damage.', effects: [{ t: 'damage', n: 28 }] },
    chain_lightning: { cls: 'wizard', kind: 'spell', name: 'Chain Lightning', cost: 3, type: 'attack', rarity: 'rare', target: 'none',
      desc: 'Deal {0} damage to ALL enemies. Draw {1} card.', effects: [{ t: 'damageAll', n: 12 }, { t: 'draw', n: 1 }] },
    arcane_torrent: { cls: 'wizard', kind: 'spell', name: 'Arcane Torrent', cost: 2, type: 'attack', rarity: 'rare', target: 'enemy',
      desc: 'Deal {0} damage. Arcane Focus counts three times on this card.', effects: [{ t: 'damage', n: 6, scale: { status: 'arcane', per: 4 } }] },
  };

  const RARITY_WEIGHTS = { common: 60, uncommon: 32, rare: 8 };

  const HEROES = {
    fighter: {
      name: 'Fighter', maxHp: 66, energy: 3, handSize: 5,
      blurb: 'A disciplined warrior. Solid attacks and Block, with tactical maneuvers that knock foes Prone or Frighten them.',
      mechanic: 'Balanced: maneuvers (Prone / Frightened), Might, Armor.',
      deck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'second_wind', 'action_surge'],   // Anna 15:19: 8 basics + 2 unique
    },
    barbarian: {
      name: 'Barbarian', maxHp: 85, energy: 3, handSize: 5,
      blurb: 'A furious brute. Little Block, but while he has any Rage he takes 25% less damage. Rage attacks build stacks for big payoffs. Reckless attacks hit huge but leave you Prone.',
      mechanic: 'Rage: any Rage = 25% less damage taken (adds no damage); stacks feed payoff cards; fades by 1 each turn.',
      deck: ['greataxe', 'greataxe', 'greataxe', 'greataxe', 'parry', 'parry', 'parry', 'parry', 'rage', 'reckless_attack'],
    },
    wizard: {
      name: 'Wizard', maxHp: 72, energy: 3, handSize: 5,
      blurb: 'A frail scholar who came down for the books. Cheap cantrips buy time while Arcane Focus builds, then the spells take whole rooms apart.',
      mechanic: "Arcane Focus: each stack adds 2 to every spell's damage and Block, on every hit. Cantrips don't get it.",
      deck: ['fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'shield_spell', 'shield_spell', 'shield_spell', 'shield_spell', 'magic_missile', 'fireball_starter'],
    },
  };

  /* Relics: passive items. hook = when they fire.
   *  pickup (once), combatStart (turn 1, after drawing), turnStart, combatEnd.
   *  effects use the card effect vocabulary (+ maxHp {n}, damageAllRaw {n}). */
  const RELICS = {
    bag_of_holding:   { name: 'Bag of Holding', hook: 'combatStart', effects: [{ t: 'draw', n: 2 }], desc: 'At the start of each fight, draw 2 extra cards.' },
    ring_protection:  { name: 'Ring of Protection', hook: 'combatStart', effects: [{ t: 'block', n: 10 }], desc: 'Start each fight with 10 Block.' },
    potion_belt:      { name: 'Potion Belt', hook: 'combatEnd', effects: [{ t: 'heal', n: 6 }], desc: 'After each fight, heal 6 HP.' },
    gauntlets_ogre:   { name: 'Gauntlets of Ogre Power', hook: 'combatStart', effects: [{ t: 'status', status: 'might', n: 1, to: 'self' }], desc: 'Start each fight with 1 Might.' },
    boots_speed:      { name: 'Boots of Speed', hook: 'combatStart', effects: [{ t: 'energy', n: 1 }], desc: 'Gain 1 extra Energy on the first turn of each fight.' },
    amulet_health:    { name: 'Amulet of Health', hook: 'pickup', effects: [{ t: 'maxHp', n: 12 }], desc: 'Raise your max HP by 12 (and heal 12).' },
    bracers_defense:  { name: 'Bracers of Defense', hook: 'combatStart', effects: [{ t: 'status', status: 'armor', n: 2, to: 'self' }], desc: 'Start each fight with 2 Armor.' },
    wand_missiles:    { name: 'Wand of Magic Missiles', hook: 'combatStart', effects: [{ t: 'damageAllRaw', n: 5 }], desc: 'At the start of each fight, deal 5 damage to ALL enemies.' },
    periapt:          { name: 'Periapt of Wound Closure', hook: 'turnStart', effects: [{ t: 'heal', n: 1 }], desc: 'Heal 1 HP at the start of each turn.' },
    luckstone:        { name: 'Stone of Good Luck', hook: 'passive', effects: [], desc: 'Card rewards offer 4 choices instead of 3.' },
    cloak_displacement: { name: 'Cloak of Displacement', hook: 'combatStart', effects: [{ t: 'status', status: 'frightened', n: 1, to: 'all' }], desc: 'At the start of each fight, apply 1 Frightened to ALL enemies.' },
    ioun_stone:       { name: 'Ioun Stone of Insight', hook: 'combatStart', effects: [{ t: 'status', status: 'thorns', n: 2, to: 'self' }], desc: 'Start each fight with 2 Retaliate.' },
  };

  /* Monster moves: attack {n, times} | block {n} | healAllies {n} | healSelf {n}
   *  status {status, n, to: 'target'(the hero) | 'self' | 'allies'}
   * AI: optional `opener`, then `pattern` (cycled) or random `weights` (noRepeat). */
  const MONSTERS = {
    // ---------- Floor 1 ----------
    goblin: { name: 'Goblin', hp: [16, 19],
      moves: {
        scimitar: { name: 'Scimitar Slash', intent: 'attack', effects: [{ t: 'attack', n: 5 }] },
        stab:     { name: 'Dirty Stab', intent: 'attack_debuff', effects: [{ t: 'attack', n: 3 }, { t: 'status', status: 'prone', n: 1, to: 'target' }] },
        nimble:   { name: 'Nimble Escape', intent: 'attack_defend', effects: [{ t: 'block', n: 6 }, { t: 'attack', n: 2 }] },
      }, ai: { weights: { scimitar: 45, stab: 30, nimble: 25 }, noRepeat: true } },
    goblin_cutter: { name: 'Goblin Cutthroat', hp: [10, 12],
      moves: {
        slash: { name: 'Slash', intent: 'attack', effects: [{ t: 'attack', n: 8 }] },
        flurry: { name: 'Flurry', intent: 'attack', effects: [{ t: 'attack', n: 5, times: 2 }] },
      }, ai: { weights: { slash: 50, flurry: 50 }, noRepeat: true } },
    goblin_archer: { name: 'Goblin Archer', hp: [8, 10],
      moves: {
        arrow:  { name: 'Shortbow', intent: 'attack', effects: [{ t: 'attack', n: 7 }] },
        poison: { name: 'Poison Arrow', intent: 'attack_debuff', effects: [{ t: 'attack', n: 2 }, { t: 'status', status: 'poisoned', n: 3, to: 'target' }] },
      }, ai: { opener: 'poison', pattern: ['arrow', 'arrow', 'poison'] } },
    goblin_shaman: { name: 'Goblin Hexer', hp: [9, 10],
      moves: {
        hex:  { name: 'Hex', intent: 'debuff', effects: [{ t: 'status', status: 'frightened', n: 2, to: 'target' }] },
        mend: { name: 'Mending Chant', intent: 'buff', effects: [{ t: 'healAllies', n: 5 }, { t: 'status', status: 'might', n: 1, to: 'allies' }] },
        zap:  { name: 'Spark', intent: 'attack', effects: [{ t: 'attack', n: 4 }] },
      }, ai: { opener: 'hex', pattern: ['zap', 'mend', 'hex'] } },
    kobold: { name: 'Kobold', hp: [9, 10],
      moves: {
        spear: { name: 'Spear Jab', intent: 'attack', effects: [{ t: 'attack', n: 5 }] },
        pack:  { name: 'Pack Tactics', intent: 'buff', effects: [{ t: 'status', status: 'might', n: 1, to: 'allies' }, { t: 'block', n: 4 }] },
        sling: { name: 'Sling', intent: 'attack', effects: [{ t: 'attack', n: 2, times: 2 }] },
      }, ai: { weights: { spear: 45, pack: 20, sling: 35 }, noRepeat: true } },
    giant_rat: { name: 'Giant Rat', hp: [6, 8],
      moves: {
        bite:   { name: 'Diseased Bite', intent: 'attack_debuff', effects: [{ t: 'attack', n: 2 }, { t: 'status', status: 'poisoned', n: 2, to: 'target' }] },
        scurry: { name: 'Scurry', intent: 'attack', effects: [{ t: 'attack', n: 5 }] },
      }, ai: { weights: { bite: 50, scurry: 50 }, noRepeat: true } },
    skeleton: { name: 'Skeleton', hp: [26, 30],
      moves: {
        sword:  { name: 'Shortsword', intent: 'attack', effects: [{ t: 'attack', n: 8 }] },
        rattle: { name: 'Rattling Guard', intent: 'attack_defend', effects: [{ t: 'block', n: 7 }, { t: 'attack', n: 4 }] },
        bow:    { name: 'Bone Arrows', intent: 'attack', effects: [{ t: 'attack', n: 3, times: 3 }] },
      }, ai: { pattern: ['sword', 'rattle', 'bow'] } },
    // Guardians of the Altar on Floor 1 (last balance pass Nov 3): its own lighter copies. Floor 2 still uses skeleton/ghoul.
    skeleton_altar: { name: 'Skeleton', sprite: 'skeleton', variantOf: 'skeleton', hp: [16, 19],
      moves: {
        sword:  { name: 'Shortsword', intent: 'attack', effects: [{ t: 'attack', n: 6 }] },
        rattle: { name: 'Rattling Guard', intent: 'attack_defend', effects: [{ t: 'block', n: 7 }, { t: 'attack', n: 3 }] },
        bow:    { name: 'Bone Arrows', intent: 'attack', effects: [{ t: 'attack', n: 2, times: 3 }] },
      }, ai: { pattern: ['sword', 'rattle', 'bow'] } },
    // Guardians of the Altar on Floor 2 (Producer, Nov 3 04:58): its own tougher copies, so the shared skeleton (Floor 1) stays as is.
    skeleton_altar_f2: { name: 'Skeleton', sprite: 'skeleton', variantOf: 'skeleton', hp: [42, 47],
      moves: {
        sword:  { name: 'Shortsword', intent: 'attack', effects: [{ t: 'attack', n: 10 }] },
        rattle: { name: 'Rattling Guard', intent: 'attack_defend', effects: [{ t: 'block', n: 7 }, { t: 'attack', n: 7 }] },
        bow:    { name: 'Bone Arrows', intent: 'attack', effects: [{ t: 'attack', n: 5, times: 3 }] },
      }, ai: { pattern: ['sword', 'rattle', 'bow'] } },
    gnoll: { name: 'Gnoll', hp: [35, 42],
      moves: {
        rampage: { name: 'Rampage', intent: 'attack', effects: [{ t: 'attack', n: 5, times: 2 }] },
        bite:    { name: 'Savage Bite', intent: 'attack', effects: [{ t: 'attack', n: 12 }] },
        howl:    { name: 'Blood Howl', intent: 'buff', effects: [{ t: 'status', status: 'might', n: 2, to: 'self' }, { t: 'block', n: 5 }] },
      }, ai: { opener: 'howl', weights: { rampage: 50, bite: 50 }, noRepeat: true } },
    bugbear: { name: 'Bugbear', hp: [81, 87], elite: true,
      moves: {
        surprise: { name: 'Surprise Attack', intent: 'attack', effects: [{ t: 'attack', n: 22 }] },
        morning:  { name: 'Morningstar', intent: 'attack', effects: [{ t: 'attack', n: 16 }] },
        grab:     { name: 'Brutal Grab', intent: 'attack_debuff', effects: [{ t: 'attack', n: 9 }, { t: 'status', status: 'prone', n: 2, to: 'target' }] },
        lurk:     { name: 'Lurk in Shadows', intent: 'defend', effects: [{ t: 'block', n: 12 }, { t: 'status', status: 'might', n: 2, to: 'self' }] },
      }, ai: { opener: 'surprise', pattern: ['grab', 'morning', 'lurk'] } },
    ogre: { name: 'Ogre', hp: [81, 86], elite: true,
      moves: {
        club:   { name: 'Greatclub', intent: 'attack', effects: [{ t: 'attack', n: 16 }] },
        smash:  { name: 'Ground Smash', intent: 'attack_debuff', effects: [{ t: 'attack', n: 8 }, { t: 'status', status: 'prone', n: 2, to: 'target' }] },
        bellow: { name: 'Dim-witted Bellow', intent: 'buff', effects: [{ t: 'status', status: 'might', n: 3, to: 'self' }, { t: 'block', n: 8 }] },
      }, ai: { pattern: ['smash', 'club', 'bellow'] } },
    // Palette's repainted boss-canvas file (full fur, no cubs; Tester passed md5 9b1bf260 at 15:18). owlbear.webp stays for
    // rollback and is the fallback if the new file is missing.
    owlbear: { name: 'The Beast of Saint Brennick', hp: [245, 245], boss: true, sprite: 'enemy_owlbear_idle',
      // Grand Slam (Anna, Nov 3 2026): slams on turns 3, 7, 11... Each slam puts 2 combat-only junk cards in your hand;
      // a single card that takes 6+ (HP + Block) off her shoves one off (exhausts it): "she stays on you until you push back".
      // Telegraphed (Producer, demo.2): `telegraph` shows the slam and its hint a turn ahead, over her Rear Up intent.
      // Hint word for word from lore/text/events_merchant_v1.md (Slam hint, CANON, Anna 15:12).
      shove: { card: 'junk_broken_bone', at: 6 },
      moves: {
        screech: { name: 'Terrifying Screech', intent: 'debuff', effects: [{ t: 'status', status: 'frightened', n: 2, to: 'target' }, { t: 'block', n: 8 }] },
        rend:    { name: 'Rend', intent: 'attack', effects: [{ t: 'attack', n: 7, times: 2 }] },   // demo.2: 9x2 -> 7x2 (the slam carries the weight)
        beak:    { name: 'Beak Peck', intent: 'attack_debuff', effects: [{ t: 'attack', n: 10 }, { t: 'status', status: 'prone', n: 2, to: 'target' }] },
        rearup:  { name: 'Rear Up', intent: 'defend', effects: [{ t: 'block', n: 10 }] },
        slam:    { name: 'Grand Slam', intent: 'attack_debuff', effects: [{ t: 'attack', n: 26 }, { t: 'addCards', card: 'junk_broken_bone', n: 2 }],   // demo.2: 20 -> 26, telegraphed
          telegraph: true, hint: 'She rears up over you. Brace. She comes down with everything, and she stays on you until you push back.' },
      }, ai: { opener: 'screech', pattern: ['rearup', 'slam', 'rend', 'beak'] } },

    // ---------- demo.2 bosses (Producer, Nov 3): movesets drafted from the approved designs (LORE 1j, boss_cutscenes_v2.md),
    // built only from mechanics already in the engine. Move names marked (ph) are placeholders for Lorekeeper.
    // The Crier (Floor 1 boss, 50/50 with the Beast). Anna's pick B, Echoes: her calls put Echo cards in your hand (at most 3
    // of them in the fight at once). Each one still in hand at the end of your turn costs 3 HP; playing one (1 Energy) silences it.
    crier: { name: 'The Crier', hp: [228, 228], boss: true, sprite: 'enemy_crier_idle',
      moves: {
        call:   { name: 'Call', intent: 'debuff', effects: [{ t: 'addCards', card: 'echo', n: 1, max: 3 }, { t: 'block', n: 8 }] },                       // (ph) pose `call`
        reach:  { name: 'Reach', intent: 'attack', effects: [{ t: 'attack', n: 14 }] },                                                                  // (ph) pose `reach`
        voice:  { name: 'Borrowed Voice', intent: 'attack_debuff', effects: [{ t: 'attack', n: 6, times: 2 }, { t: 'addCards', card: 'echo', n: 1, max: 3 }] },   // (ph)
        listen: { name: 'Listen', intent: 'defend', effects: [{ t: 'block', n: 12 }, { t: 'status', status: 'might', n: 2, to: 'self' }] },             // (ph) pose `listen`
      }, ai: { opener: 'call', pattern: ['reach', 'voice', 'listen', 'call'] } },
    // The Toll of the Narrows (Floor 2 trial boss, 50/50 with the Brood). The gate itself; it sends what it owns: the Kneeling
    // Penitent holds it up (while she kneels the gate can't be hit), the risen bones come through on its Breath (they fall when the
    // gate opens), and the Count cuts a tally (all its things grow stronger) and lets the Tally-Scratcher through.
    toll: { name: 'The Toll of the Narrows', hp: [185, 185], boss: true, sprite: 'enemy_toll_idle', minion: 'toll_bones', guardedBy: 'toll_penitent',
      moves: {
        kneel:  { name: 'The Penitent Kneels', intent: 'summon', effects: [{ t: 'summon', monster: 'toll_penitent', max: 1 }, { t: 'block', n: 10 }] },   // (ph)
        breath: { name: 'Breath', intent: 'summon', effects: [{ t: 'summon', monster: 'toll_bones', max: 2 }] },                                      // (ph) pose `breath`: dust
        narrow: { name: 'The Narrows Close', intent: 'attack', effects: [{ t: 'attack', n: 30 }] },                                                   // (ph)
        count:  { name: 'The Count', intent: 'buff', effects: [{ t: 'status', status: 'might', n: 2, to: 'allies' }, { t: 'summon', monster: 'toll_tally', max: 1 }] },   // (ph) pose `count`
        shut:   { name: 'Shut', intent: 'defend', effects: [{ t: 'block', n: 12 }] },                                                                 // (ph) pose `shut`
      }, ai: { opener: 'kneel', pattern: ['narrow', 'breath', 'count', 'shut'] } },
    toll_penitent: { name: 'Kneeling Penitent', hp: [44, 44], sprite: 'ghoul',
      moves: {
        hold:    { name: 'Holds Them Up', intent: 'buff', effects: [{ t: 'blockLeader', leader: 'toll', n: 10 }] },   // (ph)
        penance: { name: 'Penance', intent: 'attack', effects: [{ t: 'attack', n: 16 }] },                          // (ph)
      }, ai: { pattern: ['hold', 'penance'] } },
    toll_bones: { name: 'Risen Bones', hp: [16, 18], sprite: 'skeleton',   // (ph) name; LORE: "the bones of those who stopped, standing back up"
      moves: {
        wait:   { name: 'Standing Back Up', intent: 'wait', effects: [{ t: 'wait' }] },   // (ph)
        hack:   { name: 'Hack', intent: 'attack', effects: [{ t: 'attack', n: 15 }] },     // (ph)
        rattle: { name: 'Rattle', intent: 'attack', effects: [{ t: 'attack', n: 7, times: 2 }] },   // (ph)
      }, ai: { opener: 'wait', pattern: ['hack', 'rattle'] } },
    toll_tally: { name: 'Tally-Scratcher', hp: [30, 30], sprite: 'goblin_shaman',   // (ph) name; LORE: "scratches a new tally on itself every turn and gets stronger"
      moves: {
        scratch: { name: 'Another Mark', intent: 'attack', effects: [{ t: 'status', status: 'might', n: 1, to: 'self' }, { t: 'attack', n: 11 }] },   // (ph)
      }, ai: { pattern: ['scratch'] } },
    // The Brood (Floor 2 trial boss): the grey spore wall. Its Split grows a Husk that is still in its pod for a turn ("burst them
    // before they ripen": a fresh Husk has low HP and does nothing that turn); the Mossed Shell gives the wall Block; the Pulse
    // breathes spore dust (Poisoned). The Husks go still when the wall goes dormant.
    brood: { name: 'The Brood', hp: [160, 160], boss: true, sprite: 'enemy_brood_idle', minion: 'brood_husk',
      moves: {
        seal:  { name: 'Sealed', intent: 'summon', effects: [{ t: 'summon', monster: 'brood_shell', max: 1 }, { t: 'block', n: 12 }] },   // (ph) pose `sealed`
        split: { name: 'Split', intent: 'summon', effects: [{ t: 'summon', monster: 'brood_husk', max: 2 }] },                           // (ph) pose `split`
        pulse: { name: 'Pulse', intent: 'debuff', effects: [{ t: 'status', status: 'poisoned', n: 8, to: 'target' }, { t: 'block', n: 8 }] },   // (ph) pose `pulse`
        rot:   { name: 'Slow Rot', intent: 'attack_debuff', effects: [{ t: 'attack', n: 28 }, { t: 'status', status: 'poisoned', n: 3, to: 'target' }] },   // (ph)
      }, ai: { opener: 'seal', pattern: ['split', 'rot', 'pulse', 'split'] } },
    brood_husk: { name: 'Husk', hp: [11, 13], sprite: 'ghoul',
      moves: {
        wait:  { name: 'Still in the Pod', intent: 'wait', effects: [{ t: 'wait' }] },   // (ph)
        claw:  { name: 'Grey Hands', intent: 'attack', effects: [{ t: 'attack', n: 10 }] },     // (ph)
        grasp: { name: 'Grasp', intent: 'attack', effects: [{ t: 'attack', n: 5, times: 2 }] },   // (ph)
      }, ai: { opener: 'wait', pattern: ['claw', 'grasp'] } },
    brood_shell: { name: 'Mossed Shell', hp: [36, 36], sprite: 'troll',
      moves: {
        shelter: { name: 'Shelter', intent: 'buff', effects: [{ t: 'blockLeader', leader: 'brood', n: 6 }] },   // (ph)
        bump:    { name: 'Lean In', intent: 'attack', effects: [{ t: 'attack', n: 10 }] },                       // (ph)
      }, ai: { pattern: ['shelter', 'bump'] } },

    // ---------- Floor 2: the Underdark ----------
    ghoul: { name: 'Ghoul', hp: [22, 25],
      moves: {
        claw:  { name: 'Paralyzing Claw', intent: 'attack_debuff', effects: [{ t: 'attack', n: 11 }, { t: 'status', status: 'frightened', n: 1, to: 'target' }] },
        bite:  { name: 'Ravenous Bite', intent: 'attack', effects: [{ t: 'attack', n: 17 }] },
        hunger: { name: 'Grave Hunger', intent: 'attack', effects: [{ t: 'attack', n: 10, drain: true }] },
      }, ai: { weights: { claw: 35, bite: 40, hunger: 25 }, noRepeat: true } },
    // Floor 1 Altar copy of the ghoul (see skeleton_altar).
    ghoul_altar: { name: 'Ghoul', sprite: 'ghoul', variantOf: 'ghoul', hp: [12, 13],
      moves: {
        claw:  { name: 'Paralyzing Claw', intent: 'attack_debuff', effects: [{ t: 'attack', n: 6 }, { t: 'status', status: 'frightened', n: 1, to: 'target' }] },
        bite:  { name: 'Ravenous Bite', intent: 'attack', effects: [{ t: 'attack', n: 11 }] },
      }, ai: { weights: { claw: 45, bite: 55 }, noRepeat: true } },
    drow: { name: 'Drow Warrior', hp: [30, 36],
      moves: {
        crossbow: { name: 'Poisoned Bolt', intent: 'attack_debuff', effects: [{ t: 'attack', n: 10 }, { t: 'status', status: 'poisoned', n: 5, to: 'target' }] },
        blades:   { name: 'Twin Blades', intent: 'attack', effects: [{ t: 'attack', n: 9, times: 2 }] },
        darkness: { name: 'Faerie Darkness', intent: 'attack_defend', effects: [{ t: 'block', n: 10 }, { t: 'attack', n: 10 }] },
      }, ai: { opener: 'crossbow', pattern: ['blades', 'darkness', 'crossbow'] } },
    drow_mage: { name: 'Drow Mage', hp: [26, 30],
      moves: {
        bolt:  { name: 'Lightning Bolt', intent: 'attack', effects: [{ t: 'attack', n: 18 }] },
        fear:  { name: 'Spider Curse', intent: 'debuff', effects: [{ t: 'status', status: 'frightened', n: 2, to: 'target' }, { t: 'status', status: 'prone', n: 1, to: 'target' }] },
        ward:  { name: 'Arcane Ward', intent: 'buff', effects: [{ t: 'block', n: 8, }, { t: 'status', status: 'might', n: 2, to: 'allies' }] },
      }, ai: { opener: 'fear', pattern: ['bolt', 'ward', 'bolt', 'fear'] } },
    // Early-row Floor 2 Drow Patrol (balance pass Nov 3): a little lighter than the later-row Drow above, no poison.
    drow_early: { name: 'Drow Warrior', sprite: 'drow', variantOf: 'drow', hp: [28, 33],
      moves: {
        crossbow: { name: 'Crossbow Bolt', intent: 'attack', effects: [{ t: 'attack', n: 10 }] },   // no poison: Poisoned Bolt is the later-row Drow's
        blades:   { name: 'Twin Blades', intent: 'attack', effects: [{ t: 'attack', n: 9, times: 2 }] },
        darkness: { name: 'Faerie Darkness', intent: 'attack_defend', effects: [{ t: 'block', n: 10 }, { t: 'attack', n: 9 }] },
      }, ai: { opener: 'crossbow', pattern: ['blades', 'darkness', 'crossbow'] } },
    drow_mage_early: { name: 'Drow Mage', sprite: 'drow_mage', variantOf: 'drow_mage', hp: [24, 28],
      moves: {
        bolt:  { name: 'Lightning Bolt', intent: 'attack', effects: [{ t: 'attack', n: 17 }] },
        fear:  { name: 'Spider Curse', intent: 'debuff', effects: [{ t: 'status', status: 'frightened', n: 2, to: 'target' }, { t: 'status', status: 'prone', n: 1, to: 'target' }] },
        ward:  { name: 'Arcane Ward', intent: 'buff', effects: [{ t: 'block', n: 8, }, { t: 'status', status: 'might', n: 2, to: 'allies' }] },
      }, ai: { opener: 'fear', pattern: ['bolt', 'ward', 'bolt', 'fear'] } },
    troll: { name: 'Troll', hp: [72, 75], startStatus: { regen: 7 },
      moves: {
        claws: { name: 'Claw Flurry', intent: 'attack', effects: [{ t: 'attack', n: 8, times: 2 }] },
        bite:  { name: 'Bite', intent: 'attack', effects: [{ t: 'attack', n: 16 }] },
        hunch: { name: 'Hunker Down', intent: 'defend', effects: [{ t: 'block', n: 14 }] },
        rip:   { name: 'Rip Apart', intent: 'attack_debuff', effects: [{ t: 'stripBlock' }, { t: 'attack', n: 13 }] },
      }, ai: { pattern: ['claws', 'bite', 'hunch', 'rip'] } },
    gelatinous_cube: { name: 'Gelatinous Cube', hp: [78, 82],
      moves: {
        engulf: { name: 'Engulf', intent: 'attack_debuff', effects: [{ t: 'attack', n: 13 }, { t: 'status', status: 'poisoned', n: 6, to: 'target' }, { t: 'addCards', card: 'acid', n: 1, to: 'discard' }] },
        pseudo: { name: 'Pseudopod', intent: 'attack', effects: [{ t: 'attack', n: 13 }] },
        quiver: { name: 'Quiver', intent: 'defend', effects: [{ t: 'block', n: 15 }, { t: 'status', status: 'might', n: 2, to: 'self' }] },
      }, ai: { pattern: ['pseudo', 'engulf', 'quiver'] } },
    // The Surgeon (Floor 2 elite; key kept as mind_flayer so saves and encounter tables still work). Lines: content.js STORY.enemyLines.
    mind_flayer: { name: 'The Surgeon', hp: [66, 66], elite: true, sprite: 'mind_flayer', minion: 'sewn', guardedBy: 'sewn',
      moves: {
        stitch:   { name: 'Fresh Stitches', intent: 'summon', effects: [{ t: 'summon', monster: 'sewn', max: 1 }] },
        incision: { name: 'The Incision', intent: 'attack_debuff', effects: [{ t: 'attack', n: 15 }, { t: 'status', status: 'frightened', n: 1, to: 'target' }] },
        steady:   { name: 'Steady Hands', intent: 'defend', effects: [{ t: 'block', n: 10 }, { t: 'healMinions', monster: 'sewn', n: 6 }] },
      }, ai: { summoner: true, opener: 'stitch', whileUp: ['incision', 'steady'], exposedMove: 'incision', summonMove: 'stitch' },
      phase: { at: 0.5, moves: { incision: { attack: { times: 2 } } } } },
    sewn: { name: 'The Sewn', hp: [30, 30], sprite: 'ogre',
      moves: {
        wait:  { name: 'Still Knitting', intent: 'wait', effects: [{ t: 'wait' }] },
        heavy: { name: 'Heavy Hands', intent: 'attack', effects: [{ t: 'attack', n: 15 }] },
        guard: { name: 'Stand Guard', intent: 'buff', effects: [{ t: 'blockLeader', leader: 'mind_flayer', n: 6 }] },
        lurch: { name: 'Lurch', intent: 'attack', effects: [{ t: 'attack', n: 9, times: 2 }] },
      }, ai: { opener: 'wait', pattern: ['heavy', 'guard', 'lurch'] } },
    mimic: { name: 'Mimic', hp: [101, 106], elite: true,
      moves: {
        adhesive: { name: 'Adhesive Grip', intent: 'attack_debuff', effects: [{ t: 'attack', n: 13 }, { t: 'status', status: 'prone', n: 2, to: 'target' }] },
        chomp:    { name: 'Chomp', intent: 'attack', effects: [{ t: 'attack', n: 27 }] },
        disguise: { name: 'Play Dead', intent: 'defend', effects: [{ t: 'block', n: 20 }] },
      }, ai: { opener: 'disguise', pattern: ['adhesive', 'chomp', 'disguise'] },
      phase: { at: 0.5, status: { might: 2 }, pattern: ['adhesive', 'chomp'] } },
    // Vessa the Unsleeping (Floor 2 boss). Her design was approved by Anna at 15:04; Palette's game file is enemy_beholder_idle.webp
    // (boss canvas). The old beholder.webp stays in assets/ for rollback, and the fight falls back to it if the new file is
    // missing. LORE: "The Watcher" was a placeholder until her art existed, so her name goes on now.
    beholder: { name: 'Vessa the Unsleeping', hp: [330, 330], boss: true, sprite: 'enemy_beholder_idle',
      moves: {
        fear:     { name: 'I Saw That', intent: 'attack_debuff', effects: [{ t: 'attack', n: 9 }, { t: 'status', status: 'frightened', n: 3, to: 'target' }] },
        rays:     { name: 'Every Eye Opens', intent: 'attack', effects: [{ t: 'attack', n: 4, times: 4 }] },
        paralyze: { name: 'Held in Her Stare', intent: 'attack_debuff', effects: [{ t: 'attack', n: 5 }, { t: 'status', status: 'prone', n: 2, to: 'target' }] },
        disint:   { name: 'Seen Through', intent: 'attack', effects: [{ t: 'attack', n: 30 }] },
        antimagic:{ name: 'She Watches', intent: 'buff', effects: [{ t: 'block', n: 20 }, { t: 'status', status: 'might', n: 2, to: 'self' }] },
      }, ai: { pattern: ['fear', 'rays', 'disint', 'paralyze', 'antimagic'] },
      phase: { at: 0.5, status: { might: 2 }, moves: { rays: { attack: { times: 5 } } } } },
  };

  // Encounters by floor and node type. `easy` used on the first rows, `hard` later.
  const ENCOUNTERS = {
    lone_goblin:  { name: 'A Lurking Goblin', enemies: ['goblin'], scene: 'Dungeon Entrance' },
    rat_swarm:    { name: 'Rat Swarm', enemies: ['giant_rat', 'giant_rat', 'giant_rat'], scene: 'Flooded Cellar' },
    kobolds:      { name: 'Kobold Trap Crew', enemies: ['kobold', 'kobold'], scene: 'Trapped Corridor' },
    goblin_pack:  { name: 'Goblin Ambush', enemies: ['goblin_cutter', 'goblin_archer', 'goblin_shaman'], scene: 'Collapsed Hall' },
    skeletons:    { name: 'Restless Dead', enemies: ['skeleton', 'skeleton'], scene: 'Ossuary' },
    gnolls:       { name: 'Gnoll Raiders', enemies: ['gnoll', 'giant_rat'], scene: 'Bone-strewn Camp' },
    bugbear:      { name: 'Bugbear Ambusher', enemies: ['bugbear'], scene: 'Dark Alcove', elite: true },
    ogre:         { name: 'Ogre Brute', enemies: ['ogre'], scene: 'Ogre Larder', elite: true },
    owlbear:      { name: 'The Beast of Saint Brennick', enemies: ['owlbear'], scene: 'The Bone Nest', boss: true },   // Lorekeeper, events_merchant_v1 A
    ghouls:       { name: 'Ghoul Pack', enemies: ['ghoul', 'ghoul'], scene: 'Charnel Pit' },
    drow_patrol:  { name: 'Drow Patrol', enemies: ['drow', 'drow_mage'], scene: 'Deep Tunnels' },
    drow_patrol_early: { name: 'Drow Patrol', sameAs: 'drow_patrol', enemies: ['drow_early', 'drow_mage_early'], scene: 'Deep Tunnels' },
    troll:        { name: 'Cave Troll', enemies: ['troll'], scene: 'Troll Bridge' },
    cube:         { name: 'Gelatinous Cube', enemies: ['gelatinous_cube'], scene: 'Suspiciously Clean Hall' },
    mind_flayer:  { name: 'The Surgeon', enemies: ['mind_flayer'], scene: 'The Long Table', elite: true },
    mimic:        { name: 'Treasure Mimic', enemies: ['mimic'], scene: 'Treasure Vault?', elite: true },
    beholder:     { name: 'Vessa the Unsleeping', enemies: ['beholder'], scene: 'The Watching Cavern', boss: true },
    crier:        { name: 'The Crier', enemies: ['crier'], scene: 'The Quiet Dark', boss: true },             // scene (ph)
    toll:         { name: 'The Toll of the Narrows', enemies: ['toll'], scene: 'The Narrows', boss: true },   // scene (ph)
    brood:        { name: 'The Brood', enemies: ['brood'], scene: 'The Spore Wall', boss: true },           // scene (ph)
  };

  // bossPool (demo.2, from ROADMAP/LORE): each floor's boss is picked per run when its map is made (map.boss). Floor 1: the Crier or
  // the Beast, 50/50 (Anna, Nov 2). Floor 2: Vessa or the survival trial, 50/50, and the trial is the Toll or the Brood, 50/50
  // (Anna, Nov 3; Producer's reading, a three-way split is still open). `boss` stays the default for saves from before the pool.
  const FLOORS = [
    { name: 'The Bottom of the Fall', slainPrep: 'at', easy: ['lone_goblin', 'rat_swarm', 'kobolds'], hard: ['goblin_pack', 'skeletons', 'gnolls'],
      elites: ['bugbear', 'ogre'], boss: 'owlbear', bossPool: { owlbear: 1, crier: 1 }, gold: { fight: [10, 18], elite: [28, 36], boss: [60, 75] } },
    { name: 'The Hanging Town', slainPrep: 'in', easy: ['ghouls', 'drow_patrol_early'], hard: ['troll', 'cube', 'drow_patrol'],
      elites: ['mind_flayer', 'mimic'], boss: 'beholder', bossPool: { beholder: 2, toll: 1, brood: 1 }, gold: { fight: [16, 24], elite: [36, 46], boss: [100, 120] } },
  ];

  // Map layout: one entry per row (bottom to top), weights of node types. Boss row is added after.
  const MAP_ROWS = [
    { fight: 1 },
    { fight: 3, treasure: 1 },
    { fight: 3, elite: 1, rest: 1 },
    { fight: 2, elite: 1, treasure: 1, rest: 1 },
    { fight: 2, elite: 2, treasure: 1 },
    { rest: 1 },
  ];
  const MAP_COLS = 3;
  const REST_HEAL = 0.3;          // fraction of max HP healed at a rest site
  const FLOOR_HEAL = 0.75;         // fraction of missing HP healed when descending

  const NODE_TYPES = {
    fight:    { name: 'Monsters', tip: 'A fight. Win for gold and a card.' },
    elite:    { name: 'Elite', tip: 'A dangerous elite monster. Win for more gold, a card, and a relic.' },
    rest:     { name: 'Rest Site', tip: 'Rest (heal 30% of max HP) or train (upgrade a card).' },
    treasure: { name: 'Treasure', tip: 'A chest with a relic and some gold.' },
    boss:     { name: 'Boss', tip: 'The floor boss.' },
  };

  const GameData = { STATUSES, KEYWORDS, CARDS, RARITY_WEIGHTS, HEROES, RELICS, MONSTERS, ENCOUNTERS, FLOORS,
    MAP_ROWS, MAP_COLS, REST_HEAL, FLOOR_HEAL, NODE_TYPES };
  root.GameData = GameData;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameData;
})(typeof window !== 'undefined' ? window : globalThis);
