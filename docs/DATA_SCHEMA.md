# Data schema

All game numbers and texts live in `src/data/*.json`. TypeScript types for every file are in `src/logic/types.ts`, so a wrong field breaks `npm run build`.

| File | What | Type |
|---|---|---|
| `parts.json` | spacecraft bus, 5 slots, 16 parts, default design | `PartsFile` |
| `planets.json` | Earth look + 3 destinations (objective, budget, sunlight, link, window, orbits, real mission, alternative designs) | `PlanetsFile` |
| `events.json` | mission events: condition (`when`), choices, outcomes with effects and a plain-language `why` | `EventsFile` |
| `texts.json` | game title, CAPCOM lines, onboarding, resource explanations, issue and log templates (`{placeholders}`) | — |

## Units
- cost: millions of USD · mass: kg · power: W · data/downlink: GB per day · time: months.
- `output` of solar panels is at Earth's distance. The game multiplies it by the destination's `sunlight`.
- `downlink` of antennas is at Mars distance. The game multiplies it by the destination's `linkFactor`.

## Event conditions (`when`)
`destination`, `orbit`, `has` (part ids), `lacks`, `powerType` (`solar` / `rtg`), `minPowerMargin`, `commsBottleneck`. All listed keys must match. Outcomes are checked in order, and the first one that matches wins.

## Effects
`scienceMult`, `lifetimeMult`, `downlinkMult`, `lost`.

After changing numbers, run `npm run balance` and check that each target still has at least one ★★★ design.
