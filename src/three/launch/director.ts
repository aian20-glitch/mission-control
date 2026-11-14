// Numbers that the launch film timeline (GSAP, in screens/Launch.tsx) changes over time
// and the 3D scene reads every frame. A plain object, not React state: changing it
// never re-renders anything, the scene simply picks up the new values on the next frame.

export interface ScreenCircle {
  x: number
  y: number
  r: number
}

export interface LaunchDirector {
  // Which set is on screen: 1 = launch pad and sky, 2 = space above the Earth.
  act: number

  // ---- Act 1: the launch pad ----
  rocketY: number // height of the rocket above the pad, in rocket lengths
  pitch: number // how far the rocket has tilted over, radians
  camDistance: number // camera distance from the rocket, in rocket lengths
  camHeight: number // camera height above the ground, in rocket lengths
  camOrbit: number // camera angle around the rocket, radians
  lookAt: number // the camera aims at this height on the rocket (0 = base, 1 = nose)
  follow: number // 0 = camera stays on the ground, 1 = camera climbs with the rocket
  sky: number // 0 = morning sky, 1 = black space
  shake: number // camera shake strength
  engine: number // main engine flame, 0..1
  groundSmoke: number // smoke rolling out at the pad, 0..1
  vapor: number // white vapour from the cold tanks before launch, 0..1
  arms: number // tower arms swing away from the rocket, 0..1

  // ---- Act 2: space ----
  spaceOrbit: number // camera angle around the rocket in space, radians
  spaceDistance: number // camera distance in space, in rocket lengths
  boosterSep: number // side boosters falling away, 0..1
  stageSep: number // first stage falling away, 0..1
  upperEngine: number // upper stage flame, 0..1
  fairingSep: number // nose cone halves opening and drifting away, 0..1
  craftSep: number // spacecraft pushed off the upper stage, 0..1
  deploy: number // solar panels and booms unfolding, 0..1
  craftEngine: number // the spacecraft's own departure burn, 0..1
  depart: number // spacecraft flies off and the camera pulls far back, 0..1

  // ---- Both acts ----
  morph: number // 0..1: the picture shrinks into the path panel of the mission screen
  morphEarth: ScreenCircle | null // where the Earth is drawn on that 2D map, in window pixels
}

// 0..1 with a soft start and end. The film's HTML parts and the 3D scene use the same curve,
// so the shrinking frame and the 3D picture inside it stay in step.
export function smoothStep(x: number): number {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

export function createDirector(): LaunchDirector {
  return {
    act: 1,
    rocketY: 0,
    pitch: 0,
    camDistance: 1.9,
    camHeight: 0.1,
    camOrbit: 0.42,
    lookAt: 0.45,
    follow: 0,
    sky: 0,
    shake: 0,
    engine: 0,
    groundSmoke: 0,
    vapor: 1,
    arms: 0,
    spaceOrbit: -0.55,
    spaceDistance: 1.5,
    boosterSep: 0,
    stageSep: 0,
    upperEngine: 0,
    fairingSep: 0,
    craftSep: 0,
    deploy: 0,
    craftEngine: 0,
    depart: 0,
    morph: 0,
    morphEarth: null,
  }
}
