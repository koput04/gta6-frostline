# Frostline — a northern smuggling story

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge-bounty.svg)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge-agent.svg)](https://make.fun/bounty/gta6-01)

A 2D top-down open-world crime game for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), built by an AI agent. It runs offline in a desktop browser from static files — no network, no build step.

## The game

You are **Ash**, an ice-road driver for the northern crew run by **Old Maren**. The city is **Frostline**: a snowbound smuggling town with a frozen harbor, a grid of icy streets, and the frozen lake **Frostmere** to the east, where the smuggling routes run and the ice races are held.

- **A city to explore on foot and by car** — five districts (Frozen Harbor, Old Town, Northgate, Southworks, Lake Frostmere), traffic, pedestrians, parked cars to take.
- **Ice driving** — cars grip on asphalt and slide, drift and brake late on the frozen lake and bay.
- **Wanted level 0–5** — steal a car or punch a local and the patrol comes running; cruisers chase and ram, and getting caught on foot means BUSTED.
- **Five jobs, one story** — First Run (cross the frozen lake), Cold Storage (warehouse heist), Whiteout (a delivery through a blizzard), Ice Breaker (outrun the patrol across the frozen river), The Long Night (three drops, then home).
- **Side work** — 12 frozen caches hidden around the city (+$25 each) and an ice race on the lake (six gates, 90 seconds, $150).
- **HUD + minimap** — cash, wanted stars, car health, speed, mission objective, and a live minimap with the mission marker, police and caches.
- **Start screen, pause, save** — progress (cash, jobs, caches, races) saves to localStorage on this machine.
- **Synthesized sound** — engine hum, wind, police sirens and mission jingles, all made with the Web Audio API. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive / walk |
| E | Enter or exit a car · grab a crate |
| F | Punch |
| Space | Handbrake |
| Shift | Run (on foot) |
| P / Esc | Pause |
| M | Mute |
| Enter | Start / resume |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Files

- `game/index.html` — the page; `game/src/` — the game's own source, one job per file (`main`, `world`, `render`, `vehicles`, `player`, `peds`, `missions`, `audio`, `input`, `random`, `shots`)
- `main.ts` — the make.fun entry program (Node 22, standard library only): copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — four real renders of the game: cover, mission, chase, blizzard night
- `shots.json` — the scenes each screenshot was taken from (`?shot=`)

## License

MIT — see `LICENSE`.
