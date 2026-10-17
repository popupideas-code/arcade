# Wonderdeep (working title) — 3D voxel metroidvania

A 3D voxel metroidvania slice: **Crash Hollow**, 14 hand-built rooms, 4 abilities with matching gates,
3 Twist Seed events, a 3-phase boss, Beacons (save + fast travel), map, shop, badges, outfits, photo mode.

Open `index.html` in a browser (needs internet for Three.js r128 from cdnjs). Plain JS, no build step.
Gamepad (standard mapping) and keyboard; all actions remappable under Options > Controls.

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / camera | WASD / Q E or mouse drag | Left / right stick |
| Jump (hold = higher) | Space | B (bottom) |
| Run | Shift | Y |
| Shoot (tap / hold to charge) | J | X |
| Spin Bonk / interact | K | A |
| Aim (free aim, or Assist auto-aim) | L | ZR |
| Crouch / Roll ball / Ground pound (air) | C | ZL |
| Ability wheel (slows time) | R (hold) + arrows or 1-4 | R (hold) |
| Twist Burst | F | L + R |
| Map / Menu | M / Esc | + / - |
| Camera zoom | Z | R-stick click |
| Bit scan (markers + objective arrow) | B | L-stick click |
| Pick axe (pick it on the wheel, then Bonk) | K | A |

Abilities: Double Hop, Wall Kick, Roll Ball, Spark Dash (select on the wheel, press Run to dash). Ground Pound is always available.
Twist Seeds (violet): Enemy Parade (Glow Cavern), Gravity Waltz (Spore Shaft), Giant Mode (Moss Cellar).

Layout: `js/data.js` rooms + enemy data, `engine.js` input/audio/save, `world.js` voxel rooms,
`player.js` movement + camera, `enemies.js` enemies + boss, `twist.js` Twist system, `ui.js` HUD + menus.

## Added in v2
* Pulse Blaster and Pick Axe are both in the first room. Mine brown rock and gold ore; some nooks hide pearls.
* Double Hop and ball form were retuned; ledges are lower and the ball slides into 1-wide tunnels.
* Traps: timed spikes, wall dart turrets, crumbling stones.
* Bit: snarky or helpful commentary (Options > Bit chatter), scan (B), stun-zaps enemies winding up to hit you, vacuums tokens.
* Mini map fills in as you explore (saved per slot). Notices sit in a narrow column at the edge so they never cover the play area.
* Vector-style critters, wall murals, spores, soft glow (High graphics). Wardrobe: hats, suit/trim colours, capes.
* iPhone / touch: Options > Controls / UI (auto, right-handed, left-handed, compact). Graphics Auto picks Low on phones.
* Audio: drop files into `assets/audio/` and list them in `js/audio-manifest.js`.

## Added in v3: Brook Burrows
* Second biome south of Old Mossback's Den: 13 rooms, waterfalls, swimmable pools, updrafts, flooded ball tunnels.
* **Bubble Float**: hold Jump in the air after your last jump (or in water). Rides updraft vents. New orb in the Spillway.
* **Slide flumes (ball form)**: Sonic-style tracks with boost pads and rings. Roll into the glowing entry ring; steer left/right, Jump to leave. Flumes in Glow Cavern, Moss Cellar, Reed Cavern and Sluice. First run of each pays +10 tokens.
* Enemies: Rollers (charge, bounce off walls) and Mimics (platforms that bite). Mini-boss Shellbert; boss Queen Bubblefin (the water rises each phase).
* Twist events: Paper World (Crouch slips behind paper walls), Reverse Run (mandatory: outrun the dark, or pay 25 tokens at the Tide Gate), Bouncy Cavern.
* Things that block your view (pillars, ceilings, decor) now dither away around Nova. Toggle under Options > See through blockers.
* New hats, badges and a map that covers both biomes.
