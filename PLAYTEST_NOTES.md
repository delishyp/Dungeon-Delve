# Dungeon Delve: Play-test Notes (v2 content update, on top of the iPhone app version)

## What's new in v2 (content update): bigger map, real art, story

**Map**
- Each floor is 13 rows × 7 columns plus the boss. Paths branch and merge, and lines never cross.
- On a phone the map scrolls with your finger.
- Room types: Monsters, Elite, **? Unknown**, Merchant, Rest Site, Treasure (always the middle row), and the Boss.
- A **?** room is usually an event (70%). It can secretly be a fight (15%), treasure (8%) or a merchant (7%). Once you know, the icon changes.
- Every map has at least 2 elites, 4 '?' rooms and 1 merchant.

**Events** (15, each with art and choices):
- Shrine of Tymora, Talking Skull, Trapped Chest, Lost Adventurer, Wishing Well, Sleeping Wyrmling, Deck of Many Things, Mimic or Not?, Wandering Merchant, Cursed Altar, The Yawning Portal, Forgotten Library.
- Floor 2 only: Purifying Fountain, Illithid Tadpole, Myconid Circle.
- Outcomes include gold, HP, max HP, relics, potions, upgrades, card removal, rare cards, **curses** and surprise fights. The fights are a Wyrmling elite, a Mimic, or undead at the altar.

**Merchant**
- Sells 5 cards, 3 relics and 3 potions. Prices are about 48/72/135 gold for common/uncommon/rare cards, ~145 for relics and ~50 for potions.
- **Card removal** costs 75 gold, plus 25 more each time you've used it.
- The Smiling Mask relic gives 20% off.

**Potions**
- You have 3 slots (top bar). Tap a flask to drink it or throw it away.
- Six kinds: Healing, Fire, Giant Strength, Speed, Stoneskin, Antitoxin.
- Normal fights drop one 35% of the time. Elites and bosses always drop one.

**Curses**
- Five of them: Regret, Rot, Hex, Whispers, Guilt.
- They're unplayable cards that clog your hand, and some cost HP at the end of your turn. Removal or the Purifying Fountain gets rid of them.

**New relics**
- Smiling Mask (can drop anywhere).
- Event-only: Illithid Tadpole, Tymora's Lucky Coin, Wyrmling Scale.

**Art** (painted fantasy style, one consistent look):
- Portraits of the 3 heroes and all 21 monsters, including the new Wyrmling and Mimic.
- Backgrounds for both floors and the title screen, plus art for every event, the merchant, the campfire and treasure.
- Cards have frames per class (Fighter steel, Barbarian leather, Wizard arcane, curse purple) and per type (attack/skill/power windows), with parchment text boxes.
- Stone and parchment panels, painted-style map icons, and bronze relic medallions.

**Animations** (Slay the Spire style):
- Everyone "breathes" with a slow squash-and-stretch, each on their own rhythm. Bosses breathe bigger.
- Attackers lunge at their target. Whoever gets hit flinches and flashes.
- Block and buffs glow. The dead tilt, sink and fade.
- If your phone or computer is set to "reduce motion", the animations turn off.

**Story** (short, tap or click to continue; there's a Skip button):
- Each hero has an opening scene, and there's narration when you enter each floor.
- The DM adds a line of flavor when you enter a room, and monsters taunt you in speech bubbles.
- Bosses (Owlbear, Beholder) get an intro and a dying speech.
- Each class has a victory epilogue, and there's a defeat epilogue. The events double as roleplay scenes.

**Drag to play** (fixes "I picked a card, forgot to press Play, and hit End Turn"):
- *Attacks:* drag the card up. A curved arrow follows your finger and snaps onto a monster. Let go on the monster to hit it.
- *Skills/powers:* drag the card above the glowing line and let go.
- *Changed your mind?* Drag it back down into your hand.
- *Tapping still works:* tap a card, then tap a monster (or the Play button).
- **End Turn safety:** while a card is picked up or selected, the End Turn button turns into **"Cancel card"**. Tapping it only puts the card back and never ends your turn.

**Balance** (auto-player, 300 full runs per class):
- Fighter 80%, Barbarian 72%, Wizard 67%.
- Changes: Fighter 66 HP, Wizard 72 HP, Shield Block gives 4 Block, and monsters get a bit tougher higher up each floor.
- Real humans usually do worse than the bot on the first runs, and better once they know the cards.

**Your old save:** v2 starts a fresh save, because the map format changed. A run from the previous version won't continue.

**How the art is packed:**
- `index.html` (the double-click file) has all the art **built into the file** (about 2.7 MB), so it still works as one file with no folder.
- The iPhone/web version (`dist/`) keeps the art as separate files in `dist/assets/` (about 2.2 MB total), and the app stores them for offline play.

**Known v2 limitations**
- Card pictures, monster intent icons and status icons are still emoji, just tinted and framed.
- Relic icons are emoji in bronze medallions, not painted.
- There's no "you still have playable cards, end turn?" confirm, only the Cancel-card guard.
- On small phones, 7+ cards in hand get narrow. Tap one to see it bigger.
- Monster art is a painted portrait, not an animated rig. The motion comes from the CSS squash, lunge and flash effects.

## How to start
Double-click **index.html**. It's one self-contained file, so it works offline with nothing to install. Chrome, Edge or Firefox recommended, on a desktop or laptop.
Click **Begin the Descent**, pick a hero, then click a glowing room on the map.
**Controls:** click a card to play it. For a single-target attack when there are several monsters, click the card and then the monster (right-click or Esc cancels).
Keys: **1-9** plays a card, **E** ends your turn. Hover over anything (highlighted words, monster intents, status icons, relics, map rooms) for an explanation.

## Playing on iPhone (v3)
- **Install:** once the `dist/` folder is hosted (e.g. GitHub Pages), open the link in **Safari**, tap **Share → Add to Home Screen**. It opens full-screen like an app, with a gold d20 icon, and works offline after the first visit.
- **Touch controls:**
  - **Drag** a card up to play it: onto a monster for attacks (follow the arrow), or above the glowing line for everything else. Drag it back into your hand to cancel.
  - Or tap a card to **select** it (it pops up bigger so you can read it).
  - Then tap a **monster** to attack it, or tap the red **▶ Play** button for cards that don't need a target. With only one monster left, either works.
  - Tap the selected card again, or tap empty space, to **cancel**.
  - **Long-press** any card, monster intent, status icon, relic or map room for its explanation (this replaces mouse-hover tooltips).
- **Autosave:** the run saves after every action. If the phone closes the app, the title screen shows **Continue** with your hero, floor and HP. Starting a new run replaces the save; winning or dying clears it.
- **Layouts:**
  - **iPhone portrait (main):** monsters at the top, hero below, then the controls row (draw pile, energy, discard, exhaust, big End Turn), then the hand. Cards shrink to fit up to 10 in a hand.
  - **iPhone SE size** and **landscape** both work.
  - **Desktop** keeps the original layout with mouse hover and keyboard shortcuts.
- **Feel:** pinch/double-tap zoom, text selection and the iOS long-press menu are disabled so taps don't misfire. Content stays clear of the notch and home bar.

## What's in it
- **Class select:** Fighter, Barbarian and Wizard, each with its own starter deck, reward pool and mechanic.
- **Two floors, each with a branching map** (6 rows of rooms, 3 lanes, then the boss):
  - **Floor 1, The Goblin Warrens.** Boss: the **Owlbear**.
  - **Floor 2, The Underdark.** Final boss: **Xanathar the Beholder**.
  - Room types: ⚔️ Monsters, 😈 Elite (harder, drops a relic), 🔥 Rest Site (heal 30% of max HP *or* upgrade a card), 💰 Treasure (relic + gold), 💀 Boss.
  - Beating the Owlbear gives a relic and a card, then you go down to Floor 2 and recover 75% of your missing HP.
- **Live card numbers:** card text updates with your buffs and debuffs. Hover over a monster and the numbers on your attack cards also show its Prone bonus. Green means stronger than printed, red means weaker.
- **Card upgrades** at rest sites. Upgraded cards get a "+" and green numbers: more damage, Block or status, or a lower cost.
- **12 relics**, gold (not spendable yet), HP that carries over between fights, and a win and game-over screen with restart.

## Status effects
| Status | Effect |
|---|---|
| 💫 Prone | takes +50% attack damage (lasts 1 turn per stack) |
| 😱 Frightened | deals 25% less attack damage |
| ☠️ Poisoned | loses that much HP each turn, then the poison goes down by 1 |
| 💪 Might | +damage on every hit, for the whole fight |
| 🔥 Rage (Barbarian) | +damage on every hit **and** take 2 less damage per hit; goes down by 1 each turn |
| 🔮 Arcane (Wizard) | +damage on every hit, for the whole fight; some spells scale with it |
| 🪖 Armor | gain that much Block at the start of every turn |
| 🌵 Retaliate | attackers take that much damage |
| 💚 Regenerate | heals each turn (the Troll has it) |

## Classes
### 🧔 Fighter: 66 HP, balanced tactician
- **Starter deck:** 5× Longsword Strike (6 dmg), 4× Shield Block (5 Block), 1× Second Wind (heal 4, draw 1, Exhaust).
- **Mechanic:** maneuvers that knock foes Prone or Frighten them, plus Might and Armor.
- **Reward pool (15):**
  - Cleave (8 to all)
  - Shield Bash (gain 4 Block, then hit for your Block)
  - Trip Attack, Menacing Attack
  - Precision Attack (0 cost)
  - Riposte, Rally
  - Great Weapon Smash (16)
  - Battle Cry (+2 Might)
  - Whirlwind Attack
  - Fighting Style: Defense (3 Armor)
  - Potion of Healing
  - Action Surge (+2 Energy)
  - Indomitable (14 Block + cleanse)
  - Sundering Blow

### 🧌 Barbarian: 85 HP, raging brute with little Block
- **Starter deck:** 4× Greataxe Chop (6), 4× Hide Armor (only 4 Block), 1× Rage (+3 Rage), 1× Reckless Attack (12 dmg, but you become Prone).
- **Mechanic:** Rage boosts every hit and cuts each incoming hit by 2. Reckless cards hit hard but make you take +50% damage.
- **Reward pool (14):**
  - Frenzied Strike (0 cost, +1 Rage)
  - Intimidating Presence (Frighten all)
  - Reckless Flurry (4×3)
  - Primal Roar
  - Thick Hide
  - Shove
  - Brutal Critical (12, +8 while raging)
  - Whirling Axe (10 to all)
  - Relentless Rage
  - Totem of the Bear (Armor)
  - Retaliation (Retaliate 3)
  - Mindless Rage (+2 Might)
  - Berserker Frenzy (4×4)
  - Persistent Rage (+5 Rage, draw 2)

### 🧙‍♀️ Wizard: 72 HP, fragile spell-slinger
- **Starter deck:** 4× Fire Bolt (7), 4× Shield (6 Block), 1× Magic Missile (3×3), 1× Arcane Focus (0 cost: +1 Arcane, draw 1).
- **Mechanic:** Arcane stacks up for the whole fight, so multi-hit spells like Magic Missile and Scorching Ray scale best. Strong area spells.
- **Reward pool (15):**
  - Burning Hands (6 to all)
  - Ray of Frost
  - Thunderwave (4 to all + Prone all)
  - Mage Armor
  - Misty Step
  - Chromatic Orb (9)
  - Poison Spray (6 Poison)
  - Fireball (13 to all)
  - Scorching Ray (5×3)
  - Arcane Recovery
  - Arcane Study (+2 Arcane)
  - Mirror Image
  - Disintegrate (3 cost, 30 dmg)
  - Chain Lightning
  - Arcane Torrent (4 dmg, +4 for each Arcane)

## Monsters
**Floor 1, The Goblin Warrens**
- **Early fights:** A Lurking Goblin; Rat Swarm (3 Giant Rats that poison); Kobold Trap Crew (2 Kobolds that buff each other with Pack Tactics).
- **Later fights:**
  - Goblin Ambush (Cutthroat, Archer with poison arrows, Hexer that frightens you and heals and buffs the others)
  - Restless Dead (2 Skeletons)
  - Gnoll Raiders (Gnoll that howls for Might, + Giant Rat)
- **Elites:**
  - **Bugbear:** opens with a 15-dmg Surprise Attack, then Brutal Grab (makes you Prone) and Morningstar, and hides to gain Might.
  - **Ogre:** Ground Smash (makes you Prone), then a 16-dmg Greatclub, and grows stronger every third turn.
- **Boss, Owlbear (96 HP):** Terrifying Screech, then Rend 6×2, Beak Peck (makes you Prone), Maul 18, and Feral Rage (+3 Might each cycle).

**Floor 2, The Underdark**
- **Early fights:** Ghoul Pack (Paralyzing Claw frightens you); Drow Patrol (a Drow Warrior with poisoned bolts + a Drow Mage casting 13-dmg Lightning Bolts and Spider Curse).
- **Later fights:**
  - Cave Troll (regenerates 5 HP a turn)
  - Gelatinous Cube (Engulf poisons you; gains Might)
  - Drow Patrol
- **Elites:**
  - **Mind Flayer:** Mind Blast makes you Frightened *and* Prone, then Tentacles, a 20-dmg Extract Brain, and Dominate.
  - **Treasure Mimic:** starts out playing dead behind 20 Block, then Adhesive Grip and a 19-dmg Chomp.
- **Final boss, Xanathar the Beholder (140 HP):** Fear Ray, Eye Rays 4×4, Disintegration Ray (22), Paralyzing Ray (makes you Prone), and Antimagic Cone (20 Block, +2 Might). It's a 5-turn cycle and it escalates.

## Relics (12)
| Relic | Effect |
|---|---|
| 👜 Bag of Holding | draw 2 extra cards at the start of each fight |
| 💍 Ring of Protection | start each fight with 10 Block |
| 🧪 Potion Belt | heal 6 after each fight |
| 🧤 Gauntlets of Ogre Power | start each fight with 1 Might |
| 👢 Boots of Speed | +1 Energy on the first turn |
| 📿 Amulet of Health | +12 max HP |
| 🦾 Bracers of Defense | start each fight with 2 Armor |
| 🪄 Wand of Magic Missiles | 5 dmg to all enemies at the start of each fight |
| 🩹 Periapt of Wound Closure | heal 1 HP each turn |
| 🍀 Stone of Good Luck | 4 card choices instead of 3 |
| 🧥 Cloak of Displacement | all enemies start Frightened |
| 💠 Ioun Stone of Insight | start each fight with 2 Retaliate |

## Balance (auto-player, 300 full 2-floor runs per class, v2)
| Class | Full run win | Clears floor 1 | Avg HP left on a win |
|---|---|---|---|
| Fighter | ~80% | ~96% | 53 |
| Barbarian | ~72% | ~97% | 58 |
| Wizard | ~67% | ~100% | 43 |

The Gelatinous Cube, the Drow patrol and the Troll are now the main run-enders. The bot shops, drinks potions and takes events, but it isn't clever about any of them.

## Things to try / look for while play-testing
1. **Class feel.** Does each class play differently? Try a Barbarian Rage + Reckless deck, and a Wizard that stacks Arcane and then fires Magic Missile or Scorching Ray.
2. **Difficulty.** Too easy or too hard overall? Which fight felt unfair? (Mind Flayer, Beholder?)
3. **Map choices.** Elites for relics or the safe path? How often do you gamble on **?** rooms? Is the merchant worth the detour?
7. **Events and story.** Which events were fun and which were confusing? Is the narration too much, too little, or just right?
8. **Drag to play.** Does dragging feel natural on the phone? Did the "Cancel card" guard ever get in your way?
4. **Clarity.** Are the monster intent icons, the live card numbers (green/red) and the tooltips easy to read? Anything confusing?
5. **Cards.** Any card that's useless or too strong? Any card or monster you wish existed?
6. **Pacing.** Are the animations too slow or too fast? Does the run length (about 14 fights) feel right?

## Known limitations
- Card pictures, intent icons, status icons and relic icons are still emoji (framed and tinted), so they look a little different on Windows, Mac and iPhone. No sound or music.
- iPhone testing was done in Chrome's iPhone emulation (iPhone viewport and real touch events), not on a real iPhone. Safari may differ slightly, especially around the notch and home bar.
- A Home Screen app and Safari keep **separate saves** on iOS, so a run started in Safari won't appear in the installed app.
- During the enemy turn, hits, Block and heals animate one at a time, but new status icons appear once the turn finishes.
- Card upgrades follow one general rule (more damage, Block or status, or −1 cost), and a few descriptions keep fixed numbers.
- Only one saved run at a time. Saves from the previous version don't carry over.
- Balance is tuned with a simple bot, so real play may feel different.

## For later: multiplayer-ready structure
- All game state is one plain object that can be saved as text, with a seeded random-number generator stored inside it.
- Rules (`src/engine.js`) are fully separate from the screen (`src/ui.js`). Every change goes through `Engine.dispatch(state, action)` with actions like `CHOOSE_NODE`, `PLAY_CARD`, `END_TURN`, `CHOOSE_REWARD`, `REST` and `LEAVE`.
- Players are a list rather than a single hero: each has their own deck, rewards and relics, every enemy intent targets a specific player, and the turn only passes once all players have ended theirs.
- **Co-op** would mean more than one player in the same state.
- **Race mode** would be two states with the same seed, joined for a shared boss fight.

## Deploying (GitHub Pages)
1. Run `node build.js`. This rebuilds `index.html` (the single file you can double-click) **and** `dist/`.
2. Put the **contents of `dist/`** at the root of a GitHub repo, or in a `/docs` folder: `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `assets/`, `.nojekyll`.
3. Repo → Settings → Pages → deploy from that branch/folder. It'll be at `https://<user>.github.io/<repo>/`.
   - All paths are relative, so it works from a sub-folder.
   - HTTPS is required for the offline service worker, and Pages provides it.
4. Every build stamps a new cache version into `sw.js`. Installed copies update the next time they're opened online, though the new version may only show after the app is closed and reopened.
5. Make the repo **public** for free Pages. Anyone with the link could play it, but it isn't listed anywhere.

## Files (developer)
- `index.html`: the playable single-file game (built from `src/`, double-click to play).
- `dist/`: the installable app version to upload (`index.html` + `manifest.webmanifest` + `sw.js` + `icons/` + `assets/` art).
- `assets/*.webp`: the compressed art (43 files, ~1.9 MB). `art/` holds the original generated pictures, and `tools/key_sprite.py` cuts out the character sprites.
- `icons/`, `tools/make_icons.py`: the d20 app icons (180, 192, 512, maskable 512, favicon) and the script that draws them.
- `src/data.js`: classes, cards, relics, monsters and encounters.
- `src/content.js`: v2 content (events, potions, curses, shop prices, map settings, new monsters/relics and all the story text).
- `src/engine.js`: the game rules.
- `src/ui.js`, `src/style.css`, `src/shell.html`: the screen and input.
- `node build.js`: rebuilds `index.html` after you change anything in `src/`.
- `node test/sim.js 500`: headless balance and bug check (auto-plays full runs for every class).
- `index.html#selftest`: clicks through 3 full runs per class in a browser, plus a save/continue check (the result appears in the tab title).
- `node test/mobile.js`: iPhone test in headless Chrome. It needs `python3 -m http.server 8123` running in `dist/` and runs:
  - the selftest in touch mode;
  - a real-touch test (story tap-through, map swipe, touch drag onto a monster, drag above the play line, drag cancelled in hand, tap-select, End Turn "Cancel card" guard, long-press, reload + Continue);
  - manifest, service worker and offline-reload checks (including the art);
  - layout checks and screenshots (saved in `shots/`) at 390×844, 375×667, landscape and desktop;
  - the desktop single-file selftest.
- `node test/selftest.js`: the desktop single-file selftest on its own.
- `index.html#demo-classes`, `#demo-map-<hero>`, `#demo-combat-<hero>`, `#demo-event-<hero>-<eventId>`, `#demo-shop-<hero>`, `#demo-boss-<hero>`: the screens used for the screenshots. Open `index.html#touch` to try touch mode on a computer.

## What's new: painted cards & PC polish (Nov 2026)

**Cards**
- All **60 cards** (18 fighter, 18 barbarian, 19 wizard, 5 curses) have their own painted illustration (`assets/card_<id>.webp`, sources in `art/cards/`).
- Frames are **separate, reusable SVG overlays**, one per card category (`assets/frame_<type>.svg`, generated by `tools/make_frames.py`). The art is a separate image layer underneath and is never baked into the frame.
- **Frame color = what the card mainly does** (rule in `GameData.frameOf`, `src/content.js`; per-card exceptions go in `GameData.FRAME_OVERRIDE`):

  | Frame | Color | Rule | Cards |
  |---|---|---|---|
  | attack | red | deals damage | 29 |
  | defense | blue | Block / armor / cleanse | 11 |
  | buff | green | buffs yourself (powers, Rage, Might…) | 8 |
  | debuff | purple | weakens enemies without dealing damage | 3 |
  | utility | gold | draw / energy / healing | 4 |
  | curse | dark grey / black | curses | 5 |

- **Cost gem color = rarity:** steel (starter), pearl (common), sapphire (uncommon), gold (rare, plus a gold glow on the frame).
- **Upgraded cards** get a green inner trim and a green name.
- The class shows as a small emblem in the top-right socket.

**PC polish (desktop, 1280–1920 wide)**
- The emoji are gone. Intents, statuses, relics, HP, gold, deck, piles, energy and the shop's card removal all use vector icons (`src/icons.js`).
- **Hand fan:** the hand is fanned in an arc. Hovering raises and enlarges a card and spreads its neighbours. Mouse drag-to-play and the targeting arrow still work.
- **Sound:** all effects and music are synthesized live with WebAudio (`src/audio.js`), so there are no audio files and no licensing issues. There are effects for card play, hit, big hit, block, buff, debuff, heal, death, gold, potion, UI clicks, turn banners, victory and errors. Music is one loop per floor plus a boss theme.
  - A **mute button and volume slider** sit in the top-right corner. Settings are remembered in the browser (`dungeon-delve-audio`).
  - Sound starts after your first click, which is a browser rule.
- **Juice:** floating damage and Block numbers (big hits of 12 or more are larger and shake the screen), played cards fly to the discard or exhaust pile, and drawn cards fly in from the draw pile. Motion is reduced if the OS asks for reduced motion.

**Known limitations**
- iPhone/phone layout is on hold. Nothing was deliberately broken, but the new card faces and the fan were tuned and checked only on desktop.
- The music is a simple procedural loop, not composed tracks.
- The icons are flat vector art, not painted.
- `index.html` is now about 4.5 MB because all the art is embedded.

## What's new: main menu, settings & Windows app (v2.2)

**Main menu** (replaces the old title screen)
- Painted key art: the party at a torch-lit dungeon gate with the beholder's eye glowing inside. It has torch flicker, drifting embers and dust, fog, a slow pan, mouse parallax, and its own menu music.
- Buttons:
  - **Continue** shows class · floor · HP and appears only when a save exists.
  - **New Run** asks before replacing a save.
  - **Compendium**, **Settings**, **Credits** and **Quit**. In the desktop app, Quit closes the game; in a browser it shows a farewell.
- **Compendium** tabs:
  - all 60 cards, filterable by class, with a "Show upgraded" toggle;
  - relics and monsters, shown as locked silhouettes until you've seen them;
  - all 6 potions.
  - What you've seen is stored in `dungeon-delve-seen-v1`.

**Pause menu:** Esc, or the gear in the top bar (there's a quick-mute button next to it). It has Resume, Settings, Deck, Save & Quit to Main Menu, and Abandon Run (asks first).

**Settings** (key `dungeon-delve-settings-v1`; all changes apply immediately):
- **Audio:** mute, plus master, music and sound-effect volumes. These stay in `dungeon-delve-audio`; old saved {muted, vol} values carry over.
- **Gameplay:** game speed (Normal / Fast / Instant), confirm End Turn while you still have Energy (the dialog also has a "Don't ask again" button), tooltips, skip DM narration, damage numbers.
- **Visuals:** screen shake, reduced motion, fullscreen (also F11), and UI scale (90 / 100 / 110 / 125 %).
- **Controls:** a list of the keys.
  - 1–9 and 0 pick cards, E ends your turn, Esc cancels or pauses, Tab or D shows your deck, F11 toggles fullscreen, Enter confirms.
  - Dragging and click-to-target still work.
- **Data:** reset settings, delete the saved run, reset the compendium. Each asks first.

**Windows desktop app:** see `release/README-WINDOWS.txt`. Rebuild with `sh tools/package.sh`.

## What's new in v2.3: sharp on big and ultrawide screens

- **Automatic scaling.** The game is laid out for a 1080-pixel-tall screen and scales the whole UI to your window height: heroes, monsters, cards, hand, top bar, menus, map, panels and text.
  - Formula: `zoom = clamp(min(height / 1080, width / 1500), 0.75…3) × UI-scale setting`. 3840×1600 → 1.48×, 2560×1080 and 1920×1080 → 1×, 1440×900 → 0.83×, portrait 1440×2560 → 0.96×.
  - Ultrawide screens get the same proportions as 16:9. The extra width becomes more background, and the fight stays in a centred stage.
  - Phones and windows under 1000×600 keep their own layout (scale 1).
  - UI scale now goes up to **150%** and **175%**, on top of the automatic scaling.
  - Text and icons are vectors, so they're sharp at any zoom and pixel density.
  - Drag-to-play, targeting, the targeting arrow, the hand fan, tooltips, floating numbers and card flights are all scale-aware. Tested at 3840×1600, 2560×1080, 1920×1080, 1440×900 and 1440×2560.
- **Desktop sprites are 25% bigger.**
- **Sharper art:**
  - The combat backgrounds and the main menu were upscaled 4× with Real-ESRGAN (x4plus model, run on CPU) and saved at 3840×2160.
  - The 17 event and scene pictures were upscaled with Real-ESRGAN general-x4v3 and saved at 1440×1080.
  - Hero and monster sprites were re-cut from the 1024px originals at up to 900px (previously 420px).
  - Card art is now 600×800 (previously 330×440).
  - Upscaled masters are in `art/hires/`; the upscaler script is `tools/upscale.py`.
- `index.html` is now about 16.7 MB with all the art embedded.

## v2.4: auto-updates (Windows app)
- On launch the installed game checks GitHub for a newer version. If there is one, the main menu asks
  "A new version is available, download and restart?". A progress bar fills, then the game restarts on the new version.
- Settings → Data → **Check for updates** checks on demand and shows your version. The version is also in the main-menu corner and in Credits.
- No internet? Nothing happens (a manual check shows a small "couldn't check" note).
- Your saved run and settings survive updates.
- To try: install 2.4.0 once by hand. Later releases come in by themselves.

## v2.4.1
- Installer: no more "Not responding" at the end. "Play now" (checked by default) now hands the launch to Windows Explorer
  instead of starting the game from the installer window, which used to freeze while Windows Defender scanned the new game exe.
  It also shows what it's doing ("Closing the game…", "Copying game files…").
- Map: no scrollbar any more (nor anywhere else). Scroll with the mouse wheel, by dragging the map, or with arrow keys / PageUp / PageDown / Home / End.
  The edges fade when there's more map that way.
- Settings → Display (Windows app): window mode (Windowed / Borderless / Fullscreen), window size, monitor, VSync (applies after restart).
  Mode and size changes ask "Keep these display settings?" and undo themselves after 10 s. F11 switches the mode too. Everything is remembered.
