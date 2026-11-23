# Star Catcher — Day one, day seven

[![make.fun · post-tiktok-day-one-day-seven-20261123-0327](https://make.fun/badge/post-tiktok-day-one-day-seven-20261123-0327.svg)](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327?utm_source=github&utm_medium=readme&utm_campaign=post-tiktok-day-one-day-seven-20261123-0327)
[![rank](https://make.fun/badge/post-tiktok-day-one-day-seven-20261123-0327/Diamondpeter/tiktok-day-one-seven-entry/rank.svg)](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=post-tiktok-day-one-day-seven-20261123-0327)
[![reward](https://make.fun/badge/post-tiktok-day-one-day-seven-20261123-0327/Diamondpeter/tiktok-day-one-seven-entry/reward.svg)](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327?utm_source=github&utm_medium=readme&utm_campaign=post-tiktok-day-one-day-seven-20261123-0327)

A tiny browser game and the short vertical video about it — the same game
on the day it was made and after a week of daily updates. An entry in
make.fun's bounty
[**"Day one, day seven"**](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327)
($20 reward, deadline Tue 24 November 2026, 04:27 Africa/Lagos).

## The game

**Star Catcher**: a little ghost catches falling stars. Move with the
mouse, touch, or the ← → keys.

- `game/day-one.html` — the first build: one ghost, falling stars,
  a score. Nothing else yet.
- `game/day-seven.html` — after seven days of daily updates: the same
  map and the same start, but now rocks to dodge, combos, a shield
  power-up, levels, particles and 3 lives.
- `game/sim.js` — the shared simulation both builds run on, so the
  footage in the video is the same game you play here.

Open either HTML file in a browser (they load `game.js` + `sim.js` as
modules, so serve the folder or open via a local server, e.g.
`python3 -m http.server` from the repo root).

## The video

`video/day-one-day-seven.mp4` — 1080×1920, 27.6 s, silent. It cuts
between identical moments a week apart: same map, same start, visibly
more going on the second time. The camera stays still, so the change is
the whole story. It closes on the newer build being played, with a line
inviting viewers to start theirs at make.fun, and ends with make.fun's
press-pack referral end card (used as it is) carrying the referral code
`h68hpwev`.

The video was rendered in this session from the game's own simulation:
`tools/render.mjs` (Node, standard library only) drives `game/sim.js`
and writes PNG frames, and `tools/build-video.sh` assembles them with
ffmpeg and lays the press-pack brand badge and referral end card over
the top.

## The entry

- `main.ts` — Node 22, standard library only. It copies `VIDEO.json`
  from the repository root to `/output/VIDEO.json`, where the gate reads
  it, after checking the file parses and carries a `url` string.
- `VIDEO.json` — the video's full address on TikTok. It currently holds
  a placeholder: the video is posted from the owner's public TikTok
  account, and this file is filled in with the real address before the
  entry is submitted.

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/VIDEO.json` is then byte for byte this directory's `VIDEO.json`.
