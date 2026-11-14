// Typed access to the JSON game data. Components and logic read data only through here.
//
// Languages: the English JSON files hold all numbers and texts. A translation lives in
// src/data/<lang>/ and holds only texts, with the same structure. setDataLanguage() merges
// the translation over the English data. The exports below are `let`, so every module that
// imports them sees the new language right away (ES modules share live bindings).
import partsJson from '../data/parts.json'
import planetsJson from '../data/planets.json'
import eventsJson from '../data/events.json'
import textsJson from '../data/texts.json'
import partsRu from '../data/ru/parts.json'
import planetsRu from '../data/ru/planets.json'
import eventsRu from '../data/ru/events.json'
import textsRu from '../data/ru/texts.json'
import type { Design, Destination, DestinationId, EventsFile, OrbitId, OrbitOption, Part, PartsFile, PlanetsFile, SlotId } from './types'

export type Language = 'en' | 'ru'

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'ru', label: 'RU' },
]

type Texts = typeof textsJson

const englishParts = partsJson as unknown as PartsFile
const englishPlanets = planetsJson as unknown as PlanetsFile
const englishEvents = eventsJson as unknown as EventsFile

export let partsData: PartsFile = englishParts
export let planetsData: PlanetsFile = englishPlanets
export let eventsData: EventsFile = englishEvents
export let texts: Texts = textsJson
export let bus: Part = partsData.bus
export let language: Language = 'en'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Finds the translated twin of a list item: by `id` when the item has one, otherwise by position.
function findTwin(list: unknown[], item: unknown, index: number): unknown {
  if (isPlainObject(item) && typeof item.id === 'string') {
    return list.find((other) => isPlainObject(other) && other.id === item.id)
  }
  return list[index]
}

// Copies the English data and replaces only texts that the translation has.
// Numbers, ids and keys missing in English are never changed, so a translation can't break the game rules.
function mergeTexts<T>(english: T, translation: unknown): T {
  if (Array.isArray(english) && Array.isArray(translation)) {
    const result = english.map((item, index) => {
      const twin = findTwin(translation, item, index)
      return twin === undefined ? item : mergeTexts(item, twin)
    })
    return result as T
  }
  if (isPlainObject(english) && isPlainObject(translation)) {
    const result: Record<string, unknown> = { ...english }
    for (const key of Object.keys(translation)) {
      if (key !== 'id' && key in english) {
        result[key] = mergeTexts(english[key], translation[key])
      }
    }
    return result as T
  }
  if (typeof english === 'string' && typeof translation === 'string') {
    return translation as T
  }
  return english
}

export function setDataLanguage(next: Language) {
  language = next
  if (next === 'ru') {
    partsData = mergeTexts(englishParts, partsRu)
    planetsData = mergeTexts(englishPlanets, planetsRu)
    eventsData = mergeTexts(englishEvents, eventsRu)
    texts = mergeTexts(textsJson, textsRu)
  } else {
    partsData = englishParts
    planetsData = englishPlanets
    eventsData = englishEvents
    texts = textsJson
  }
  bus = partsData.bus
}

// Whole number with the language's thousands separator: 1,728 (EN) or 1 728 (RU).
export function num(value: number): string {
  return Math.round(value).toLocaleString(texts.units.locale)
}

// Money in millions of dollars: "$421M" (EN) or "$421 млн" (RU).
export function money(millions: number): string {
  return fill(texts.units.money, { n: num(millions) })
}

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
