# Data schema

All game numbers and texts live in `src/data/*.json`. TypeScript types for every file are in `src/logic/types.ts`, so a wrong field breaks `npm run build`.

| File | What | Type |
|---|---|---|
| `parts.json` | spacecraft bus, 5 slots, 16 parts, default design | `PartsFile` |
| `planets.json` | Earth look + 3 destinations (objective, budget, sunlight, link, window, orbits, real mission, alternative designs) | `PlanetsFile` |
| `events.json` | mission events: condition (`when`), choices, outcomes with effects and a plain-language `why` | `EventsFile` |
| `texts.json` | game title, CAPCOM lines, onboarding, resource explanations, issue and log templates (`{placeholders}`), `units` (number format, unit names, month names) and `ui` (every button, label and heading on screen) | — |
| `ru/*.json` | Russian translation: same structure as the English file, texts only | — |

## Languages
- English files hold all numbers and texts. `src/data/ru/` holds only the Russian texts, with the same structure.
- `setDataLanguage()` in `src/logic/data.ts` lays the translation over the English data. List items are matched by `id`, or by position when there is no `id` (choices, outcomes, log lines). Numbers and ids are never taken from a translation.
- After adding or changing any English text, add the Russian one and run `npm run i18n`: it lists missing, untranslated and extra keys.
- Callsigns (CAPCOM, FLIGHT…) and real mission names stay in English on purpose.
- Russian templates avoid declining names: write «к цели «{destination}»» or «{name}: …», not «к {destination}».

## Units
- cost: millions of USD · mass: kg · power: W · data/downlink: GB per day · time: months.
- `output` of solar panels is at Earth's distance. The game multiplies it by the destination's `sunlight`.
- `downlink` of antennas is at Mars distance. The game multiplies it by the destination's `linkFactor`.

## Event conditions (`when`)
`destination`, `orbit`, `has` (part ids), `lacks`, `powerType` (`solar` / `rtg`), `minPowerMargin`, `commsBottleneck`. All listed keys must match. Outcomes are checked in order, and the first one that matches wins.

## Effects
`scienceMult`, `lifetimeMult`, `downlinkMult`, `lost`.

After changing numbers, run `npm run balance` and check that each target still has at least one ★★★ design.
