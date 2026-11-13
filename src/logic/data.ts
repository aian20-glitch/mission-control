// Typed access to the JSON game data. Components and logic read data only through here.
import partsJson from '../data/parts.json'
import planetsJson from '../data/planets.json'
import eventsJson from '../data/events.json'
import textsJson from '../data/texts.json'
import type { Design, Destination, DestinationId, EventsFile, OrbitId, OrbitOption, Part, PartsFile, PlanetsFile, SlotId } from './types'

export const partsData = partsJson as unknown as PartsFile
export const planetsData = planetsJson as unknown as PlanetsFile
export const eventsData = eventsJson as unknown as EventsFile
export const texts = textsJson

export const bus: Part = partsData.bus

export function getDestination(id: DestinationId): Destination {
  const found = planetsData.destinations.find((d) => d.id === id)
  if (!found) {
    throw new Error('Unknown destination: ' + id)
  }
  return found
}

export function getOrbit(destination: Destination, id: OrbitId): OrbitOption {
  const found = destination.orbits.find((o) => o.id === id)
  if (!found) {
    throw new Error('Unknown orbit: ' + id)
  }
  return found
}

export function getPart(id: string): Part {
  const found = partsData.parts.find((p) => p.id === id)
  if (!found) {
    throw new Error('Unknown part: ' + id)
  }
  return found
}

export function partsForSlot(slot: SlotId): Part[] {
  return partsData.parts.filter((p) => p.slot === slot)
}

export function copyDesign(design: Design): Design {
  return {
    launchVehicle: design.launchVehicle,
    power: design.power,
    instruments: [...design.instruments],
    comms: design.comms,
    extras: [...design.extras],
  }
}

// Replaces {name} placeholders in a text template.
export function fill(template: string, values: Record<string, string | number>): string {
  let result = template
  for (const key of Object.keys(values)) {
    result = result.split('{' + key + '}').join(String(values[key]))
  }
  return result
}
