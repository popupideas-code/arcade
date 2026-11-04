# Breakneck Baller

An endless, portrait-mode, neon-vector runner. You're a bouncing ball in a trench: steer with your
thumb, smash what glows, dodge what doesn't. One zone (Neon Alley), difficulty ramps with distance.

Open `index.html` in a browser (needs internet for Three.js r128 from cdnjs). Plain JS, no build step.
Progress (best score, coins, upgrades, settings) is stored in `localStorage` only.

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Steer | Drag anywhere (relative) | ← → / A D |
| Jump (tap twice = double jump) | JUMP (top) | Space / ↑ / W |
| Dash (forward lunge, 3 charges) | DASH (middle) | Shift / J / X |
| Slam (in the air) / Slide (low) | SLAM·SLIDE (bottom) | ↓ / S / K / C |
| Pause | ❚❚ | Esc / P |

The button column can be moved to the left or right hand side from the menu or the pause screen.

## Rules of the trench

- **Glowing, translucent, hatched = smashable.** Dash through it (or slam it from above).
  A dash fired at the last moment is a **PERFECT** and refunds the charge.
- **Solid red brick, striped gates and spikes = deadly.** Jump spikes and low brick, steer through gaps in tall walls.
- **Gates** have a glowing magenta lip, a floating SLIDE sign and magenta floor chevrons: slide under them.
- **Windows** are glass set into brick: line up and dash through.
- **Beetles**: jump high, then SLAM their glowing back. **Drones**: dash into the glowing core (refunds a charge).
- **Holes** cost a heart. Side walls only scrape (small slowdown).
- **Meteors**: a growing red shadow marks where one will land. Move out of it (a well-timed dash also beats it).
- **Speed tubes** (green chevrons): the ball rolls round the inside of a pipe at 1.45x speed. Drag to steer
  all the way round; brick rings have a gap to rotate to, or JUMP them. The far end launches you out.
- **Lava runs** (orange chevrons): the floor is lava. Hop between obsidian stones: gaps need a real JUMP, a plain
  bounce falls short. Touching lava is a heavy hit and bounces you back up (it never drops you out of the world).
  Obsidian is slippery, so steering drifts and overshoots. Every new stone you land on adds to a **hop chain** that
  pays more each time, with coin arcs over each gap. Lava bubbles rise mid-gap: **DASH through them** for points and a
  refunded charge, or jump over them.
- Hits drain the **shield** first (regenerates after a few seconds); when it's gone they cost a **heart**.
- Chain smashes for a combo multiplier (up to x8). Coins buy upgrades on the menu screen.
- The sky cycles through six looks every 1000 m (Neon Dusk, Midnight, Dawn Break, Golden Hour, Acid Rain,
  Vaporwave). Obstacle colours never change, so the rules stay readable.

## Files

- `index.html` — page shell, HUD, menus, styles
- `game.js` — everything else: renderer, pattern generator, physics, input, synthesised audio

Add `?debug` to the URL to expose `window.__bb` (used for automated testing).
