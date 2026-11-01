# PopUpIdeas Arcade for Roku

One sideloadable channel with a game menu (Up/Down, OK). Only Rollabout is ported so far; the rest show as "coming soon".
To add a game: put its code in `source/`, mark it ready in `initGame()` and launch it from `handleKey()` in `main.brs`.

## Rollabout

A BrightScript port of the web game in `../../rollabout/`. **Stage 1: level 1 (Meadow Roll) is playable end to end**
(ball physics, bricks/? blocks, power blocks, springs, conveyors, speed pads, spikes, swinging chain, moving platform,
key + door vault, 3 gems, checkpoints, bugs, dragonfly, boss, goal). Loops, rails, water, lava, flippers, the other
levels, level select and saved progress come in the next stages.

## Install (sideload)
1. TV in developer mode (Home x3, Up x2, Right, Left, Right, Left, Right). Note the IP and the dev password.
2. `python3 tools/build_zip.py` (or use the prebuilt `popupideas-arcade.zip`).
3. Open `http://<TV-IP>` in a browser, log in as `rokudev`, choose the zip under *Upload*, click *Install*.
4. Debug output: `telnet <TV-IP> 8085`.

## Controls
| Remote | Action |
|---|---|
| Left / Right | roll |
| OK or Up | jump (hold for higher) |
| Down in the air | ground pound |
| Hold Down on ground, tap OK, release Down | spin dash |
| OK on a chain | let go (touch the chain tip to grab it) |
| Back | pause (Back again on title exits) |

## Layout
- `source/level.brs` constants + level builder (level 1 is a straight port of the web `DEFS[0]`)
- `source/game.brs` all game logic, no drawing (can be run headless with the `brs` interpreter)
- `source/render.brs` drawing, `source/audio.brs` sound, `source/main.brs` loop and remote input
- `tools/gen_assets.py` regenerates every PNG/WAV/`sprites.json` (needs Pillow)

## Notes
- 1280x720 (`ui_resolutions=hd`); the 600-unit-high world is scaled 1.2x.
- Rotating sprites (ball, spiky ball) are pre-rotated frames, because `DrawRotatedObject` is slow and 90-degree-only on older Rokus.
- BrightScript names are case-insensitive and string `=` ignores case, so tiles are stored as ASCII codes (`u` spring vs `U` used block).
