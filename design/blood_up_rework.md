# Blood Up rework - PROPOSAL for Anna (Gamedev, Nov 3; nothing built, measured on /tmp copies of 1f6900e)
~~Recommended (candidate D):~~ **REJECTED by Anna (Nov 3 10:39): no 4th-hit Block line, no Rage-attack trim.** Was: Blood Up (rare Power, cost 1): "Whenever one of your attacks hits an enemy, gain 1 Rage (up to 3 a turn). Your Rage no longer fades. Every 4th attack hit each turn, gain Block equal to your Rage." Upgraded: costs 0 (unchanged).
Engine: one per-turn attack-hit counter in the existing on-hit hook; on every 4th hit, gain Block equal to current Rage. Rage still adds no damage; Rage attacks untouched.
Why: it pays the normal-attack route directly (many full-damage hits), which is what Route 1 lacked; more Rage alone (A, B) barely helped.
| Candidate | Route 1 (Blood Up) | Route 2 (Rage attacks) | Gap | Smart | Random |
|---|---|---|---|---|---|
| Now (1f6900e), 2,400 runs | 40.8% | 61.7% | 20.9 | 78.0% | 43.5% |
| A: no 3-a-turn cap | 41.8% | 63.1% | 21.3 | 78.9% | 45.0% |
| B: cap kept, +3 Rage when played | 42.7% | 63.1% | 20.4 | 79.1% | 45.8% |
| C: every 3rd hit, Block = Rage | 58.6% | 63.1% | 4.5 | 79.3% | 53.4% |
| C2: every 3rd hit, Block = half Rage, 2,400 runs | 53.2% | 61.7% | 8.5 | 78.2% | 48.5% |
| **D: every 4th hit, Block = Rage, 2,400 runs** | **48.5%** | **61.7%** | **13.2** | **78.2%** | **46.1%** |
| (C/D at cost 2: Route 1 falls to 36-40%, so cost is not the lever) | | | | | |
A-C and the cost-2 rows: 1,200 runs. Route bots are steered smart bots (Route 1: takes Blood Up, never Rage attacks; Route 2: the reverse; both always take Enraged).
Risk: any Blood Up strong enough to close the gap also lifts the random-pick bot (it holds Blood Up in ~1/3 of runs); D sits 1 point over the 45% line, C closes the gap but random goes to 53%. Fully closing the gap likely also needs Route 2 trimmed a little, which is outside a Blood Up rework. Block grows with Rage that never fades, so long fights could turn into a stall (Tester to watch the Watcher). The smart bot's valuation doesn't know the new line, so smart may be understated for players who build around it.

## Decision (Anna, Nov 3 10:39) and what was built
Base Blood Up unchanged. Blood Up+ made stronger instead (data only, no engine change):
- Old Blood Up+ (cost 0): "Whenever one of your attacks hits an enemy, gain 1 Rage (up to 3 a turn). Your Rage no longer fades."
- **New Blood Up+ (cost 0): "Gain 4 Might. Whenever one of your attacks hits an enemy, gain 1 Rage (up to 3 a turn). Your Rage no longer fades."**
Measured on Tester's bot (qa_tune3/qa_bv2/qa_smartbot2) on /tmp copies of 53a8fff (after the enemy pass). Route bots now value the upgrade (route steering keeps the card's own value, so the bot upgrades Blood Up).
| Blood Up+ candidate (all cost 0) | Route 1 (Blood Up) | Route 2 (Rage attacks) | Gap | Smart | Random |
|---|---|---|---|---|---|
| Now (cost 0 only), 2,400 runs | 38.9% | 61.0% | 22.1 | 77.0% | 39.3% |
| + Gain 2 Might, 2,400 | 46.2% | 61.0% | 14.8 | 77.6% | 43.4% |
| + Gain 3 Might, 2,400 | 49.5% | 61.0% | 11.5 | 77.7% | 42.5% |
| **+ Gain 4 Might, 2,400 (built)** | **52.2%** | **61.0%** | **8.8** | **77.9%** | **42.5%** |
| + Gain 5 Might, 2,400 | 53.1% | 61.0% | 7.9 | 77.8% | 41.6% |
| + 1 Might at the start of each turn, 1,200 | 45.5% | 60.8% | 15.3 | 77.7% | 42.3% |
| + 4 Block at the start of each turn, 1,200 | 39.7% | 60.8% | 21.1 | 77.4% | 42.3% |
| cap 5 a turn + Draw 1, 1,200 | 38.3% | 60.8% | 22.5 | 77.8% | 41.8% |
Out of band: Barbarian random is 42.5%, under Anna's 45%. It was already 39.3% after the enemy pass, and no Blood Up+ version gets it above ~43-44% (the random bot rarely holds an upgraded Blood Up). Lifting random to 45% needs something outside Blood Up+.
