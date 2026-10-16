# PopUpIdeas Arcade

One repo, one folder per game. Cloudflare Pages serves it as a static site.

- `index.html` is the arcade home page. `embed.html` is the same grid for Squarespace.
- `games.json` lists the games, in the order they appear (top of the file = first in the gallery). Both pages read it, so a new entry shows up everywhere on the next deploy.
- `squarespace-snippet.html` is the paste-in code for Squarespace (set it up once).

## Add a game
1. Make a folder (e.g. `warpath/`) with `index.html` and any assets (music, `thumb.png`).
2. `python3 tools/add_game.py warpath "Warpath" "One-line pitch"`
3. `git add -A && git commit -m "Add Warpath" && git push`

Cloudflare redeploys in about a minute.

## Cloudflare Pages settings
Framework: None. Build command: (empty). Build output directory: `/` (root).
