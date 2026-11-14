// The 3D launch film is a separate download (three.js is large). Calling this early,
// on the launch window screen, means it is ready by the time the player presses Launch.
export function loadLaunchScene() {
  return import('./LaunchScene')
}
