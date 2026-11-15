# MISSION CONTROL — NASA Space Apps 2026

Educational game for the challenge "Space Mission Design Game".
Style (new look, 15 Nov): references are edolus.com (scroll-driven 3D title), igloo.inc (mono type, 3D object in a small window) and usavionix.com (terminal alert feed). Dark, thin lines, square corners, uppercase mono headings. Real NASA 3D rocket models; cinematic night launch.
Full design: `docs/GDD.md` (idea). Agreed decisions that override the GDD: `docs/DECISIONS.md` (read it first). Challenge text: `docs/CHALLENGE.md`.
Deadline: 2026-11-15 inclusive. The team brainstorms and gives tasks; Claude writes everything (code, data, texts, assets). Audience: students with zero space background — explain every term in plain words.
Status: full playable loop in the new look. 3D: the stage behind title/target/orbit (`src/three/StageScene.tsx`), the spacecraft on the build screen (`CraftScene.tsx`), the launch film (`LaunchScene.tsx` + `launch/`, NASA rocket models in `public/models/`). The mission screen is a 2D flight chart with an alert feed. Work is on the local branch `new-style`.

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
  App.tsx                (screen router: title + objective (one Journey screen) → orbit → assembly → window → launch → mission → debrief)
  store/useMission.ts    (Zustand: choices + results; useMissionReport() derives resources)
  logic/                 types.ts, data.ts, resources.ts, events.ts, scoring.ts  (pure functions, no UI)
  screens/               Journey (title + target), Orbit, Assembly, LaunchWindow, Launch, Mission, Debrief
  three/                 StageScene (planets, camera trip, orbit view), CraftScene (build screen), LaunchScene + launch/ (director, Rocket, rocketSpecs, sets, particles); stageView.ts and missionView.ts are plain objects the screens write and the scenes read
  components/            ResourceBar, PartCard, MissionLog, HudButton, Tooltip, PlanetOrb, SpacecraftSchematic, OrbitMap, ...
  styles/                tokens.css, global.css, screens.css
  data/                  planets.json, parts.json, events.json, texts.json (English: all numbers + texts)
  data/ru/               Russian texts only, same structure (merged in logic/data.ts)
scripts/balance.ts       (npm run balance)
scripts/i18n.ts          (npm run i18n: every English text has a Russian one)
public/models/ (NASA rockets, GLB)  public/draco/ (mesh decoder)
scripts/models/          (Blender scripts that simplify the NASA models and cut them into stages)
docs/GDD.md, DECISIONS.md, DATA_SCHEMA.md, CHALLENGE.md
```

## Data
- Game numbers and texts: `src/data/*.json`, typed in `src/logic/types.ts`, described in `docs/DATA_SCHEMA.md`.
- After changing numbers run `npm run balance`: every target needs at least one ★★★ design.
- Two languages (EN, RU). No text in components: put it in `texts.json` → `ui`, add the Russian in `data/ru/`, run `npm run i18n`.

## Rules
- Readable, plain code. No clever one-liners or compact tricks.
- Game rules live in `logic/` as pure functions; components only display and call them.
- 3D only in these scenes: stage (planets + orbit view), spacecraft, launch. Keep models light (< 5 MB total), lazy-load. Nothing in a 2D screen may import three.js directly.
- UI: dark (#05080D), translucent panels with backdrop blur, one accent per screen (teal #5DCAA5), amber for warnings and alerts, red only for critical + launch. IBM Plex Mono for headings, buttons, labels, numbers and the feed; Inter for long explanations. Thin 1px lines, 3–6px radius, lots of whitespace.
- Motion: soft spring/ease transitions (150–400 ms UI, ≤10 s cinematics with Skip). UI text in English + Russian.
- Desktop screens fit the window with no page scroll (block "Fit to screen" at the end of screens.css); long lists scroll inside their panel.
- Before a big feature: short plan. After each working step: `npm run build` passes → check in browser → commit.
- Keep answers short; show only changed parts, not whole files.
- Priorities: P0 → P1 → P2 (docs/DECISIONS.md, "Отложено"). Do not start P2 while P0 is broken.
- Desktop first; mobile later.
