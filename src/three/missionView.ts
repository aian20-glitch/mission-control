import type { ScreenCircle } from './launch/director'

// The mission screen's 3D scene writes here, every frame, where its Earth is on the screen.
// The launch film reads it to land its own Earth exactly on top of that one.
export const missionView: { earth: ScreenCircle | null } = { earth: null }
