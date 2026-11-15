# Mission Control (working title)

NASA Space Apps Challenge 2026 · **Space Mission Design Game**

You are the director of a small space mission. Pick a target, choose how to meet it, build the spacecraft, find a launch window, launch, handle problems in flight, and get a report that explains **why** your mission worked or failed, plus how the real NASA mission solved the same problem.

Made for students with no background in space engineering: every part, orbit and event explains itself in plain words.

## Run
```bash
npm install
npm run dev       # local game
npm run build     # production build in dist/ (relative paths, works on any static host)
npm run balance   # prints resources and score for test designs
```

## How it maps to the challenge
| Challenge asks for | In the game |
|---|---|
| Define a mission objective first | Target screen: each target comes with a science goal |
| Spacecraft, instruments, launch vehicle, orbit | Orbit screen + Build screen (16 parts in 5 slots) |
| Budget, mass, power, data, communications, lifetime | Six live resource bars, each with a "?" explanation |
| Mass + orbit compatible with the launch vehicle | Fuel to brake into orbit is added to the mass; the rocket's lift depends on target and launch date |
| Consequences and trade-offs | Every part changes several bars; warnings say why |
| Mission simulation, random events | Mission screen: phases, live log, decisions with a timer |
| Evaluation and feedback | Debrief: stars, score breakdown, what helped / hurt and why, real NASA mission, other designs that work |
| No single right answer | Debrief shows alternative designs that also succeed |
| Difficulty levels, sandbox | Moon = tutorial, Mars = standard, Europa = hard; Sandbox mode |

## Sources and credits
- Challenge text: see `docs/CHALLENGE.md`.
- Real missions in the debrief: NASA mission pages for Lunar Reconnaissance Orbiter, Mars Reconnaissance Orbiter and Europa Clipper (science.nasa.gov).
- Physics used in simplified form: sunlight falls with the square of the distance from the Sun (Mars ≈ 43%, Jupiter ≈ 3.7% of Earth's), Earth–Mars launch windows about every 26 months, Hohmann transfer geometry, signal delay at light speed.
- All prices, masses and powers are **approximate game values** chosen for balance, not official figures.
- Fonts: Inter and JetBrains Mono (SIL Open Font License), bundled locally.
- 3D rockets in the launch film: NASA 3D Resources (github.com/nasa/NASA-3D-Resources): Space Launch System Block 1, Saturn V and Explorer Jupiter-C. They were simplified and cut into stages with Blender (`scripts/models/`). The SLS source file has no tank or booster casings, so those plain cylinders were added by the script. Files: `public/models/*.glb`, 1.1 MB in total.
- Draco mesh decoder (`public/draco/`): from three.js, Apache License 2.0.
- No NASA logo is used.
