import { rocketSpec } from './launch/rocketSpecs'

// The 3D scenes are separate downloads (three.js is large). Calling these early,
// on the launch window screen, means they are ready by the time the player presses Launch.
export function loadLaunchScene() {
  return import('./LaunchScene')
}

export function loadMissionScene() {
  return import('./MissionScene')
}

// Ask the browser for the rocket model ahead of time, so it is already in its cache when the film starts.
export function warmRocketModel(launchVehicleId: string) {
  void fetch(import.meta.env.BASE_URL + 'models/' + rocketSpec(launchVehicleId).file).catch(() => undefined)
}
