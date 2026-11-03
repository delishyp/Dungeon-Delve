# Placeholder card art

Anna (Nov 3, 05:31): until a card art style is settled, nobody waits on Palette for card art. Cards with no art get a
generated flat placeholder (frame colour by card type + the card name). Made by `python3 tools/make_placeholders.py`.
Palette: never use these as a reference or starting point for any artwork.
To swap one out: add the real `assets/card_<card id>.webp` (it wins automatically), then delete the placeholder and its row.

| File | Card id | What it is for |
|---|---|---|
| `placeholder_the_wall_holds.webp` | `the_wall_holds` | The Wall Holds: fighter legendary power card illustration (attack frame) |
| `placeholder_read_the_opening.webp` | `read_the_opening` | Read the Opening: fighter legendary power card illustration (attack frame) |
| `placeholder_form_and_repeat.webp` | `form_and_repeat` | Form and Repeat: fighter rare skill card illustration (defense frame) |
| `placeholder_ten_thousand_drills.webp` | `ten_thousand_drills` | Ten Thousand Drills: fighter rare power card illustration (buff frame) |
| `placeholder_hilt_to_the_teeth.webp` | `hilt_to_the_teeth` | Hilt to the Teeth: fighter common attack card illustration (attack frame) |
| `placeholder_give_ground.webp` | `give_ground` | Give Ground: fighter common skill card illustration (defense frame) |
| `placeholder_wait_for_it.webp` | `wait_for_it` | Wait for It: fighter common skill card illustration (utility frame) |
| `placeholder_no_wasted_motion.webp` | `no_wasted_motion` | No Wasted Motion: fighter legendary power card illustration (utility frame) |
| `placeholder_field_dressing.webp` | `field_dressing` | Field Dressing: fighter rare skill card illustration (utility frame) |
| `placeholder_old_scars.webp` | `old_scars` | Old Scars: fighter rare power card illustration (defense frame) |
| `placeholder_headbutt.webp` | `headbutt` | Headbutt: barbarian common attack card illustration (attack frame) |
| `placeholder_wild_swing.webp` | `wild_swing` | Wild Swing: barbarian common attack card illustration (attack frame) |
| `placeholder_goad.webp` | `goad` | Goad: barbarian uncommon attack card illustration (attack frame) |
| `placeholder_bloodied_knuckles.webp` | `bloodied_knuckles` | Split Knuckles: barbarian uncommon attack card illustration (attack frame) |
| `placeholder_blood_up.webp` | `blood_up` | Blood Up: barbarian rare power card illustration (buff frame) |
| `placeholder_enraged.webp` | `enraged` | Enraged: barbarian legendary attack card illustration (attack frame) |
| `placeholder_last_tally.webp` | `last_tally` | The Last Tally: barbarian legendary power card illustration (buff frame) |
| `placeholder_scar_tissue.webp` | `scar_tissue` | Scar Tissue: barbarian rare power card illustration (defense frame) |
| `placeholder_bear_beneath.webp` | `bear_beneath` | The Bear Beneath: barbarian legendary power card illustration (defense frame) |
| `placeholder_acid.webp` | `acid` | Acid: curse status card illustration (status frame); also Acid Splash (`acid_splash`, wizard common attack, `art: 'acid'`, pool 34) |
| `placeholder_burn_through.webp` | `burn_through` | Burn Through: barbarian common skill card illustration (defense frame) |
| `placeholder_kindling.webp` | `kindling` | Kindling: barbarian uncommon power card illustration (buff frame) |
| `placeholder_whats_left.webp` | `whats_left` | What's Left: barbarian rare attack card illustration (attack frame) |
| `placeholder_worn_grip.webp` | `worn_grip` | Worn Grip: barbarian common attack card illustration (attack frame) |
| `placeholder_ember_hide.webp` | `ember_hide` | Ember Hide: barbarian common skill card illustration (defense frame) |
| `placeholder_blood_in_mouth.webp` | `blood_in_mouth` | Blood in the Mouth: barbarian common attack card illustration (attack frame) |
| `placeholder_last_one_standing.webp` | `last_one_standing` | Last One Standing: barbarian uncommon skill card illustration (buff frame) |
| `placeholder_fireball_starter.webp` | `fireball_starter` | Fireball: wizard starter attack card illustration (attack frame) |
| `placeholder_echo.webp` | `echo` | Echo: curse status card illustration (status frame) |
| `placeholder_sweeping_attack.webp` | `sweeping_attack` | Sweeping Attack: fighter common attack card illustration (attack frame) |
| `placeholder_evasive_footwork.webp` | `evasive_footwork` | Evasive Footwork: fighter common skill card illustration (defense frame) |
| `placeholder_extra_attack.webp` | `extra_attack` | Extra Attack: fighter uncommon attack card illustration (attack frame) |
| `placeholder_eldritch_strike.webp` | `eldritch_strike` | Eldritch Strike: fighter uncommon attack card illustration (attack frame) |
| `placeholder_shield_wall.webp` | `shield_wall` | Shield Wall: fighter uncommon skill card illustration (defense frame) |
| `placeholder_feinting_attack.webp` | `feinting_attack` | Feinting Attack: fighter uncommon attack card illustration (attack frame) |
| `placeholder_shocking_grasp.webp` | `shocking_grasp` | Shocking Grasp: wizard common attack card illustration (attack frame) |
| `placeholder_grease.webp` | `grease` | Grease: wizard common skill card illustration (debuff frame) |
| `placeholder_ice_knife.webp` | `ice_knife` | Ice Knife: wizard common attack card illustration (attack frame) |
| `placeholder_absorb_elements.webp` | `absorb_elements` | Absorb Elements: wizard common skill card illustration (defense frame) |
| `placeholder_lightning_bolt.webp` | `lightning_bolt` | Lightning Bolt: wizard uncommon attack card illustration (attack frame) |
| `placeholder_counterspell.webp` | `counterspell` | Counterspell: wizard uncommon skill card illustration (debuff frame) |
| `placeholder_vampiric_touch.webp` | `vampiric_touch` | Vampiric Touch: wizard uncommon attack card illustration (attack frame) |
| `placeholder_cloudkill.webp` | `cloudkill` | Cloudkill: wizard uncommon skill card illustration (debuff frame) |
| `placeholder_cone_of_cold.webp` | `cone_of_cold` | Cone of Cold: wizard rare attack card illustration (attack frame) |
| `placeholder_wall_of_force.webp` | `wall_of_force` | Wall of Force: wizard rare skill card illustration (defense frame) |
| `placeholder_blight.webp` | `blight` | Blight: wizard rare attack card illustration (attack frame) |
| `placeholder_meteor_swarm.webp` | `meteor_swarm` | Meteor Swarm: wizard legendary attack card illustration (attack frame) |
| `placeholder_time_stop.webp` | `time_stop` | Time Stop: wizard legendary skill card illustration (utility frame) |

Not placeholders: Wish (`wish`) uses the finished `assets/card_arcane_focus.webp` (`art: 'arcane_focus'`; no other card uses it since Arcane Focus was cut).
