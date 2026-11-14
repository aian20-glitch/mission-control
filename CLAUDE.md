# MISSION CONTROL — NASA Space Apps 2026

Educational game for the challenge "Space Mission Design Game".
Style: the player sits at a space-station computer. Modern sci-fi HUD + Apple-like minimalism + a small dose of Apollo-era retro (mono log, callsigns). Real NASA 3D models; cinematic 3D rocket launch with camera follow and zoom.
Full design: `docs/GDD.md` (idea). Agreed decisions that override the GDD: `docs/DECISIONS.md` (read it first). Challenge text: `docs/CHALLENGE.md`.
Deadline: 2026-11-15 inclusive. The team brainstorms and gives tasks; Claude writes everything (code, data, texts, assets). Audience: students with zero space background — explain every term in plain words.
Status: v0.1 draft — full playable loop with 2D stand-ins (SVG planets, spacecraft schematic, 2D launch). Next: real 3D scenes.

## Stack
- Vite + React + TypeScript. 2D UI (panels, cards, bars, logs) = HTML/CSS.
- 3D scenes = React Three Fiber + @react-three/drei + @react-three/postprocessing.
  Look: HDR environment light, subtle bloom on engines and stars, particle smoke, smooth GSAP camera moves.
- 3D models: NASA 3D Resources (GLB) in `public/models/`, credits in README.
- GSAP for motion, Howler.js for sound, Zustand for state.
- Deploy: static build with relative paths (`vite.config.ts` base = './'), works on GitHub Pages or any host. No GitHub repo yet — local git only, push only when the user says so.
- Game data in `src/data/*.json`, never hardcoded in components.

## Structure
```
src/
  App.tsx                (screen router: title → objective → orbit → assembly → window → launch → mission → debrief)
  store/useMission.ts    (Zustand: choices + results; useMissionReport() derives resources)
  logic/                 types.ts, data.ts, resources.ts, events.ts, scoring.ts  (pure functions, no UI)
  screens/               Title, Objective, Orbit, Assembly, LaunchWindow, Launch, Mission, Debrief
  three/                 (next) SceneCanvas, PlanetScene, SpacecraftScene, LaunchScene, OrbitScene
  components/            ResourceBar, PartCard, MissionLog, HudButton, Tooltip, PlanetOrb, SpacecraftSchematic, OrbitMap, ...
  styles/                tokens.css, global.css, screens.css
  data/                  planets.json, parts.json, events.json, texts.json (English: all numbers + texts)
  data/ru/               Russian texts only, same structure (merged in logic/data.ts)
scripts/balance.ts       (npm run balance)
scripts/i18n.ts          (npm run i18n: every English text has a Russian one)
public/ (models/ sfx/ later)
docs/GDD.md, DECISIONS.md, DATA_SCHEMA.md, CHALLENGE.md
```

## Data
- Game numbers and texts: `src/data/*.json`, typed in `src/logic/types.ts`, described in `docs/DATA_SCHEMA.md`.
- After changing numbers run `npm run balance`: every target needs at least one ★★★ design.
- Two languages (EN, RU). No text in components: put it in `texts.json` → `ui`, add the Russian in `data/ru/`, run `npm run i18n`.

## Rules
- Readable, plain code. No clever one-liners or compact tricks.
- Game rules live in `logic/` as pure functions; components only display and call them.
- 3D only in 4 scenes (planet, spacecraft, launch, orbit). Keep models light (< 5 MB total), lazy-load.
- UI: dark (#05080D), translucent panels with backdrop blur, one accent per screen (teal #5DCAA5), amber for warnings, red only for critical + launch. Inter for UI, JetBrains Mono for numbers and log. Thin 1px lines, 12–16px radius, lots of whitespace.
- Motion: soft spring/ease transitions (150–400 ms UI, ≤10 s cinematics with Skip). UI text in English + Russian.
- Desktop screens fit the window with no page scroll (block "Fit to screen" at the end of screens.css); long lists scroll inside their panel.
- Before a big feature: short plan. After each working step: `npm run build` passes → check in browser → commit.
- Keep answers short; show only changed parts, not whole files.
- Priorities: P0 → P1 → P2 (docs/DECISIONS.md, "Отложено"). Do not start P2 while P0 is broken.
- Desktop first; mobile later.
