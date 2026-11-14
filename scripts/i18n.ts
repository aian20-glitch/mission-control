// Translation check: every English text must have a translation, and nothing extra.
// Run: npm run i18n
import partsEn from '../src/data/parts.json'
import planetsEn from '../src/data/planets.json'
import eventsEn from '../src/data/events.json'
import textsEn from '../src/data/texts.json'
import partsRu from '../src/data/ru/parts.json'
import planetsRu from '../src/data/ru/planets.json'
import eventsRu from '../src/data/ru/events.json'
import textsRu from '../src/data/ru/texts.json'

// Keys in planets/parts/events whose strings are ids, colors or game rules, never shown as text.
// texts.json is all text, so it is checked without this filter.
const NOT_TEXT = new Set([
  'id', 'slot', 'kind', 'phase', 'quality', 'callsign', 'powerType', 'difficulty',
  'dark', 'base', 'light', 'atmosphere', 'color', 'requires', 'favorites', 'requiresOrbit',
  'has', 'orbit', 'launchVehicle', 'power', 'comms', 'instruments', 'extras', 'when', 'effects', 'design', 'look', 'map',
])

// Proper names that stay the same in every language (matched by the end of the path).
const SAME_EVERYWHERE = ['game.title', 'realMission.name']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function twinOf(list: unknown[], item: unknown, index: number): unknown {
  if (isObject(item) && typeof item.id === 'string') {
    return list.find((other) => isObject(other) && other.id === item.id)
  }
  return list[index]
}

const problems: string[] = []

function compare(english: unknown, translation: unknown, path: string, skip: Set<string>) {
  if (typeof english === 'string') {
    if (SAME_EVERYWHERE.some((ending) => path.endsWith(ending))) {
      return
    }
    if (typeof translation !== 'string') {
      problems.push('missing   ' + path)
    } else if (translation === english && /[a-z]{3}/.test(english)) {
      problems.push('untranslated ' + path + ': ' + english)
    }
    return
  }
  if (Array.isArray(english)) {
    const list = Array.isArray(translation) ? translation : []
    english.forEach((item, index) => compare(item, twinOf(list, item, index), path + '[' + index + ']', skip))
    return
  }
  if (isObject(english)) {
    const other = isObject(translation) ? translation : {}
    for (const key of Object.keys(english)) {
      if (!skip.has(key)) {
        compare(english[key], other[key], path ? path + '.' + key : key, skip)
      }
    }
    for (const key of Object.keys(other)) {
      if (!(key in english)) {
        problems.push('extra     ' + (path ? path + '.' + key : key))
      }
    }
  }
}

compare(textsEn, textsRu, '', new Set(['callsign', 'locale']))
compare(planetsEn, planetsRu, 'planets', NOT_TEXT)
compare(partsEn, partsRu, 'parts', NOT_TEXT)
compare(eventsEn, eventsRu, 'events', NOT_TEXT)

if (problems.length === 0) {
  console.log('RU translation: complete.')
} else {
  console.log('RU translation: ' + problems.length + ' problem(s)')
  for (const problem of problems) {
    console.log('  ' + problem)
  }
  throw new Error('RU translation is incomplete')
}
