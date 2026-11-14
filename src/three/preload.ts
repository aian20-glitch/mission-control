// The 3D scenes are separate downloads (three.js is large). Calling these early,
// on the launch window screen, means they are ready by the time the player presses Launch.
export function loadLaunchScene() {
  return import('./LaunchScene')
}

export function loadMissionScene() {
  return import('./MissionScene')
}
