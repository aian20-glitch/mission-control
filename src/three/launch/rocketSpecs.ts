// Sizes of the three rockets, in meters (1 unit = 1 m), measured from the bottom of the engines.
// Plain numbers only: this file is also read by the 2D screens, so it must not import three.js.

export interface EngineSpec {
  x: number
  y: number
  radius: number
  length: number
  color: 'orange' | 'blue'
}

export interface RocketSpec {
  file: string
  // The model's painted texture is too rough to show: use plain white paint instead.
  plainPaint: boolean
  length: number
  // First stage on the pad: where the body starts and ends, and how wide it is (for the cold vapour).
  coreBottom: number
  coreHeight: number
  coreRadius: number
  // Widest point of the rocket on the pad, fins and boosters included.
  outerRadius: number
  // 'side' = boosters strapped to the sides, 'stage' = a whole first stage that drops before the core.
  boosters: 'none' | 'side' | 'stage'
  boosterOffset: number
  boosterRadius: number
  boosterTop: number
  upperBottom: number
  upperTop: number
  upperRadius: number
  fairingRadius: number
  fairingHeight: number
  payloadY: number
  payloadScale: number
  // Engines that burn at lift-off and drop with the boosters (or with the first stage).
  boosterEngines: EngineSpec[]
  // Engines of the core stage.
  coreEngines: EngineSpec[]
  // The core lights up only after the first stage is gone (three-stage rocket).
  coreStartsAfterBoosters: boolean
}

const SPECS: Record<string, RocketSpec> = {
  // Light: Jupiter-C, the rocket that launched the first US satellite (drawn larger than life).
  lv_light: {
    file: 'jupiter.glb',
    plainPaint: true,
    length: 33.2,
    coreBottom: 2,
    coreHeight: 15,
    coreRadius: 1.45,
    outerRadius: 2.3,
    boosters: 'none',
    boosterOffset: 0,
    boosterRadius: 0,
    boosterTop: 0,
    upperBottom: 17.17,
    upperTop: 23.16,
    upperRadius: 1.45,
    fairingRadius: 1.5,
    fairingHeight: 10,
    payloadY: 24.1,
    payloadScale: 0.8,
    boosterEngines: [],
    coreEngines: [{ x: 0, y: 0.6, radius: 1.5, length: 34, color: 'orange' }],
    coreStartsAfterBoosters: false,
  },
  // Medium: Space Launch System, an orange hydrogen core with two solid boosters.
  lv_medium: {
    file: 'sls.glb',
    plainPaint: false,
    length: 95.5,
    coreBottom: 5,
    coreHeight: 59,
    coreRadius: 4.2,
    outerRadius: 8.9,
    boosters: 'side',
    boosterOffset: 6.2,
    boosterRadius: 1.86,
    boosterTop: 53,
    upperBottom: 66.6,
    upperTop: 76.8,
    upperRadius: 2.55,
    fairingRadius: 2.75,
    fairingHeight: 18.6,
    payloadY: 78.4,
    payloadScale: 1.6,
    boosterEngines: [
      { x: -6.2, y: 0.8, radius: 2.3, length: 84, color: 'orange' },
      { x: 6.2, y: 0.8, radius: 2.3, length: 84, color: 'orange' },
    ],
    coreEngines: [{ x: 0, y: 1, radius: 2.6, length: 30, color: 'blue' }],
    coreStartsAfterBoosters: false,
  },
  // Heavy: Saturn V, three stages stacked on top of each other.
  lv_heavy: {
    file: 'saturn.glb',
    plainPaint: false,
    length: 110.6,
    coreBottom: 4,
    coreHeight: 62,
    coreRadius: 5.5,
    outerRadius: 8.6,
    boosters: 'stage',
    boosterOffset: 0,
    boosterRadius: 5.5,
    boosterTop: 42.5,
    upperBottom: 70.18,
    upperTop: 88.49,
    upperRadius: 3.65,
    fairingRadius: 3.45,
    fairingHeight: 22,
    payloadY: 90.2,
    payloadScale: 1.55,
    boosterEngines: [{ x: 0, y: 0.5, radius: 5.4, length: 100, color: 'orange' }],
    coreEngines: [{ x: 0, y: 43, radius: 3.6, length: 30, color: 'blue' }],
    coreStartsAfterBoosters: true,
  },
}

export function rocketSpec(launchVehicleId: string): RocketSpec {
  return SPECS[launchVehicleId] ?? SPECS.lv_light
}
