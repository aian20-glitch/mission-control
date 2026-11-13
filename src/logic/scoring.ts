// Mission evaluation: science, efficiency, decisions -> stars, plus the "why" notes.
// Pure functions only.
import { fill, partsData, texts } from './data'
import { buildContext, computeResources, instrumentWorks } from './resources'
import { resolveAuto, selectEvents } from './events'
import type { Design, MissionContext, MissionResult, Note, OrbitId, Quality, ResolvedEvent, ResourceReport } from './types'

const FAVORITE_BONUS = 1.5
const QUALITY_POINTS: Record<Quality, number> = { good: 100, ok: 65, bad: 25, info: 0 }
const TIMEOUT_PENALTY = 10
const NO_DECISIONS_SCORE = 75

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function starsFor(total: number): number {
  if (total >= 80) {
    return 3
  }
  if (total >= 60) {
    return 2
  }
  if (total >= 35) {
    return 1
  }
  return 0
}

// Raw science the instruments could deliver if everything went perfectly.
function rawScience(ctx: MissionContext): number {
  let sum = 0
  for (const instrument of ctx.instruments) {
    if (!instrumentWorks(ctx, instrument.id)) {
      continue
    }
    const isFavorite = ctx.destination.objective.favorites.includes(instrument.id)
    sum = sum + (instrument.science ?? 0) * (isFavorite ? FAVORITE_BONUS : 1)
  }
  return sum
}

// Is there a cheaper rocket that would also carry this spacecraft?
function cheaperRocketSaving(ctx: MissionContext, report: ResourceReport): number {
  let bestSaving = 0
  for (const part of partsData.parts) {
    if (part.slot !== 'launchVehicle' || !part.capacity) {
      continue
    }
    const capacity = part.capacity[ctx.destination.id] * ctx.windowFactor
    const saving = ctx.launchVehicle.cost - part.cost
    if (capacity >= report.totalMass && saving > bestSaving) {
      bestSaving = saving
    }
  }
  return bestSaving
}

export function evaluateMission(ctx: MissionContext, report: ResourceReport, resolved: ResolvedEvent[]): MissionResult {
  // 1. Combine the effects of everything that happened.
  let scienceMult = 1
  let lifetimeMult = 1
  let downlinkMult = 1
  let lost = false
  let lostReason = ''
  for (const item of resolved) {
    const effects = item.outcome.effects
    scienceMult = scienceMult * (effects.scienceMult ?? 1)
    lifetimeMult = lifetimeMult * (effects.lifetimeMult ?? 1)
    downlinkMult = downlinkMult * (effects.downlinkMult ?? 1)
    if (effects.lost && !lost) {
      lost = true
      lostReason = item.outcome.why
    }
  }

  // 2. Science.
  const missionMonths = report.lifetimeMonths * lifetimeMult
  const timeShare = clamp(missionMonths / report.requiredMonths, 0, 1)
  const downlink = report.downlink * downlinkMult
  const deliveredShare = report.dataGenerated <= 0 ? 1 : clamp(downlink / report.dataGenerated, 0, 1)
  // Even with a slow link, the best data is sent first, so 30% of the value always arrives.
  const commsFactor = 0.3 + 0.7 * deliveredShare
  const rawValue = rawScience(ctx) * ctx.orbit.scienceMult * report.instrumentUptime * commsFactor * timeShare * scienceMult
  const science = lost ? 0 : Math.round(clamp(rawValue, 0, 100))

  // 3. Efficiency: money left, and not paying for a rocket you don't need.
  const budgetLeftShare = ctx.sandbox ? 0.1 : (report.budgetLimit - report.cost) / report.budgetLimit
  const rocketSaving = cheaperRocketSaving(ctx, report)
  const massUse = report.totalMass / report.massCapacity
  const oversized = rocketSaving > 0 && massUse < 0.5
  let efficiency = 60 + budgetLeftShare * 200
  if (oversized) {
    efficiency = efficiency - 15
  }
  efficiency = Math.round(clamp(efficiency, 0, 100))

  // 4. Decisions.
  const choices = resolved.filter((item) => item.choiceIndex !== null)
  let decisions = NO_DECISIONS_SCORE
  if (choices.length > 0) {
    let sum = 0
    for (const item of choices) {
      const points = QUALITY_POINTS[item.outcome.quality] - (item.timedOut ? TIMEOUT_PENALTY : 0)
      sum = sum + points
    }
    decisions = Math.round(clamp(sum / choices.length, 0, 100))
  }

  // 5. Total and stars.
  const total = lost ? 0 : Math.round(science * 0.6 + efficiency * 0.2 + decisions * 0.2)
  const stars = lost ? 0 : starsFor(total)

  // 6. Why notes.
  const n = texts.notes
  const helped: Note[] = []
  const hurt: Note[] = []

  if (lost) {
    hurt.push({ title: 'Mission lost', text: lostReason })
  }
  for (const item of resolved) {
    if (item.outcome.quality === 'bad' && !item.outcome.effects.lost) {
      hurt.push({ title: item.event.title, text: item.outcome.why })
    }
  }
  if (deliveredShare < 0.8) {
    hurt.push({ title: n.lowDownlink.title, text: fill(n.lowDownlink.text, { share: Math.round(deliveredShare * 100) }) })
  }
  if (report.instrumentUptime < 0.95) {
    hurt.push({ title: n.lowPower.title, text: fill(n.lowPower.text, { uptime: Math.round(report.instrumentUptime * 100) }) })
  }
  if (timeShare < 1 && !lost) {
    hurt.push({
      title: n.shortLife.title,
      text: fill(n.shortLife.text, { months: Math.max(0.5, Math.round(missionMonths * 10) / 10), required: report.requiredMonths }),
    })
  }
  for (const instrument of ctx.instruments) {
    if (!instrumentWorks(ctx, instrument.id)) {
      hurt.push({ title: n.deadWeight.title, text: fill(n.deadWeight.text, { part: instrument.name }) })
    }
  }
  const favorites = ctx.instruments.filter(
    (i) => ctx.destination.objective.favorites.includes(i.id) && instrumentWorks(ctx, i.id),
  )
  if (favorites.length === 0 && ctx.instruments.length > 0) {
    hurt.push({ title: n.noFavorite.title, text: n.noFavorite.text })
  }
  if (oversized) {
    hurt.push({ title: n.oversized.title, text: fill(n.oversized.text, { use: Math.round(massUse * 100), save: rocketSaving }) })
  }

  if (favorites.length > 0) {
    const names = favorites.map((f) => f.name).join(' and ')
    helped.push({ title: n.favorite.title, text: fill(n.favorite.text, { part: names }) })
  }
  for (const item of resolved) {
    if (item.outcome.quality === 'good') {
      helped.push({ title: item.event.title, text: item.outcome.why })
    }
  }
  if (deliveredShare >= 0.99 && report.dataGenerated > 0) {
    helped.push({ title: n.fullDownlink.title, text: n.fullDownlink.text })
  }
  if (timeShare >= 1 && !lost) {
    helped.push({ title: n.longLife.title, text: fill(n.longLife.text, { months: Math.round(missionMonths) }) })
  }
  if (!ctx.sandbox && budgetLeftShare >= 0.15) {
    helped.push({ title: n.budgetLeft.title, text: fill(n.budgetLeft.text, { left: report.budgetLimit - report.cost }) })
  }

  return {
    lost,
    lostReason,
    science,
    efficiency,
    decisions,
    total,
    stars,
    missionMonths,
    deliveredShare,
    helped: helped.slice(0, 3),
    hurt: hurt.slice(0, 3),
  }
}

// Quick evaluation of a design without player decisions (used for "other good designs").
export function evaluateDesign(
  destinationId: MissionContext['destination']['id'],
  orbitId: OrbitId,
  design: Design,
  launchMonth: number | null,
  sandbox: boolean,
): { ctx: MissionContext; report: ResourceReport; result: MissionResult } {
  const ctx = buildContext(destinationId, orbitId, design, launchMonth, sandbox)
  const report = computeResources(ctx)
  const autos = selectEvents(ctx, report).filter((e) => e.kind === 'auto')
  const resolved = autos.map((e) => resolveAuto(e, ctx, report))
  const result = evaluateMission(ctx, report, resolved)
  return { ctx, report, result }
}
