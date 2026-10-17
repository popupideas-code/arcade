# Audio drop-in

1. Put files in `music/`, `voice/` or `sfx/` (mp3, ogg, wav or m4a all decode in browsers; m4a/mp3 are safest on iPhone).
2. List them in `js/audio-manifest.js`.

* Music styles: `cave` (exploring), `boss`, `twist` (Twist Seed events). Each loops.
* Voice groups: `bit` (the floating helper), `hero` (Nova), `enemy`, `boss`. Short gibberish-style clips work best; one is picked at random per line.
* SFX names you can override: jump, hop, kick, roll, dash, land, shoot, charge, wave, bonk, hit, hurt, die, sparkle, pickup, pearl, fanfare, beacon, door, twist, twistEnd, bubble, pound, crack, roar, warn, menu, flip, mine, zap, scan.

Volumes follow the Music / Effects / Voice sliders in Options.
