// What the big 3D stage behind the first screens should show right now.
// A plain object, not React state: the screens write to it, the 3D scene reads it every frame.

export interface StageView {
  // Where the camera is on the trip away from Earth: 0 = Earth, 1 = Moon, 2 = Mars, 3 = Europa.
  progress: number
  // 'journey' = flying between the planets, 'orbit' = close view of one planet with the spacecraft.
  mode: 'journey' | 'orbit'
  // Orbit view: which planet (1..3) and which way of meeting it (flyby, orbiter or lander).
  focus: number
  orbitId: string | null
  // Set by the screen on top: called when the player clicks a planet in the 3D picture.
  onPick: ((stop: number) => void) | null
}

export const stageView: StageView = {
  progress: 0,
  mode: 'journey',
  focus: 1,
  orbitId: null,
  onPick: null,
}

// The stops of the trip, in order. Stop 0 is the Earth (the title screen).
export const STAGE_STOPS = ['earth', 'moon', 'mars', 'europa']
