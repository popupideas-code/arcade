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
- **Stairs** (lime chevrons): hovering steel slabs climbing 1.25 m a step. JUMP up them; running into a low step is a
  bonk (light hit, shoved back), higher steps hover so you can also run underneath. **Spring pads** (yellow) fire you
  about 8 m up to skip steps. Each new step adds to a chain that pays more each time, and the camera climbs with you.
- **Wall cannons**: a muzzle ring on the wall charges up and a red laser shows the height of the shot, aimed where you
  stand. Low **saws**: JUMP. High **orbs**: SLIDE under them. The wall is raised around high cannons.
- **Swinging blade**: JUMP it (or time your lane). **Crushers**: three lanes slam down on a cycle, their red pad
  flashes first. Take a lane whose pad is calm. A jump into a plate that is mid-slam still gets crushed.
- **Spike rollers** patrol the lane: JUMP over them (pairs are spaced by speed so you can land and jump again).
  **Hoppers**: DASH or SLAM them for points; running into them is a light hit.
- The wall height changes along the track, with gantry arches, holographic billboards, blinking pylons, searchlights,
  tall spires, light strips along the wall bases and drifting dust to break up the corridor. Scenery takes the palette's colours.
- Hits drain the **shield** first (regenerates after a few seconds); when it's gone they cost a **heart**.
- Chain smashes for a combo multiplier (up to x8). Coins buy upgrades on the menu screen.
- The sky cycles through six looks every 1000 m (Neon Dusk, Midnight, Dawn Break, Golden Hour, Acid Rain,
  Vaporwave). Obstacle colours never change, so the rules stay readable.

## Visual styles

Menu or pause screen > **Style** cycles four looks. All of them are the same game: the obstacle rules, shapes and
patterns never change, only how the picture is drawn.

- **Neon** (default): glowing vector lines on a synthwave sky. Draws straight to the canvas.
- **Pixel**: a 240 px art grid. The scene is rendered at 2x and each chunky pixel averages its 2x2 block, so thin lines
  fade between pixels instead of popping on and off, with 7 levels per channel and light ordered dithering.
- **Comic**: flat poster colours (few levels per channel), light halftone dots in the shadows, black ink outlines, and
  old offset-print misregistration: the colour plates sit a pixel or two apart and the black plate slips the other way.
- **Watercolor**: the dark neon scene inverted into soft pigment washes on grainy paper, with pooled colour at the
  edges and thin lines kept as crisp colour strokes. Completely static: nothing animates on its own, no wobble or hatching.
  The paper warms and cools with the time of day. (Replaces the earlier Pencil style; old saves migrate automatically.)

Pixel/Comic/Watercolor draw the scene into a render target and restyle it in one full-screen shader (`POST_FRAG` in
`game.js`); the HUD and menus are restyled with CSS (`body[data-style=...]`). Comic and Watercolor use a depth texture for
silhouette outlines and fall back to no outlines where depth textures aren't available. The choice is saved locally.

## Tips

Each on-screen tip (the banner that explains an obstacle, and the "drag to steer" strip) is shown **once, ever**. It is
remembered the moment it appears, so dying before you reach the obstacle doesn't bring it back, and several patterns of
the same kind in one run only show the tip once. Old saves carry over (anything already seen stays dismissed). The
tips live under `seen` in the `breakneckBaller.v1` localStorage entry.

## Files

- `index.html` — page shell, HUD, menus, styles
- `game.js` — everything else: renderer, pattern generator, physics, input, synthesised audio

Add `?debug` to the URL to expose `window.__bb` (used for automated testing).
