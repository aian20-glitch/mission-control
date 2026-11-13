// Mission events: which events happen for a design, and what each choice leads to.
// Pure functions only.
import { bus, eventsData, fill, texts } from './data'
import { formatLifetime, hasPart, transferMonths, bestWindowMonth } from './resources'
import type { Condition, MissionContext, MissionEvent, MissionPhase, Outcome, PlanStep, ResolvedEvent, ResourceReport } from './types'

const PHASE_ORDER: MissionPhase[] = ['launch', 'cruise', 'arrival', 'operations']

export function matches(condition: Condition | undefined, ctx: MissionContext, report: ResourceReport): boolean {
  if (!condition) {
    return true
  }
  if (condition.destination && !condition.destination.includes(ctx.destination.id)) {
    return false
  }
  if (condition.orbit && !condition.orbit.includes(ctx.orbit.id)) {
    return false
  }
  if (condition.has) {
    for (const id of condition.has) {
      if (!hasPart(ctx, id)) {
        return false
      }
    }
  }
  if (condition.lacks) {
    for (const id of condition.lacks) {
      if (hasPart(ctx, id)) {
        return false
      }
    }
  }
  if (condition.powerType) {
    const type = ctx.powerSource.powerType
    if (!type || !condition.powerType.includes(type)) {
      return false
    }
  }
  if (condition.minPowerMargin !== undefined && report.powerMargin < condition.minPowerMargin) {
    return false
  }
  if (condition.commsBottleneck !== undefined) {
    const bottleneck = report.deliveredShare < 0.8
    if (bottleneck !== condition.commsBottleneck) {
      return false
    }
  }
  return true
}

// The spacecraft cannot survive if power is below what the bus needs.
// This is a built-in event (texts come from texts.json).
function powerLossEvent(ctx: MissionContext, report: ResourceReport): MissionEvent {
  const values = { destination: ctx.destination.name, available: report.powerAvailable }
  return {
    id: 'power_lost',
    phase: 'arrival',
    kind: 'auto',
    priority: 100,
    when: {},
    callsign: 'EECOM',
    title: 'Power failure',
    text: fill(texts.issues.powerCheck, values),
    outcomes: [
      {
        quality: 'bad',
        log: fill(texts.issues.lostPower, values),
        why: texts.issues.lostPowerWhy,
        effects: { lost: true },
      },
    ],
  }
}

export function isPowerDead(report: ResourceReport, ctx: MissionContext): boolean {
  let baseNeed = bus.power + ctx.comms.power
  for (const extra of ctx.extras) {
    baseNeed = baseNeed + extra.power
  }
  return report.powerAvailable < baseNeed
}

// Picks the events for this mission: all matching automatic events,
// plus up to N choice events (highest priority first, spread across phases).
export function selectEvents(ctx: MissionContext, report: ResourceReport): MissionEvent[] {
  const all = eventsData.events.filter((e) => matches(e.when, ctx, report))
  const autos = all.filter((e) => e.kind === 'auto')
  const choices = all.filter((e) => e.kind === 'choice').sort((a, b) => b.priority - a.priority)

  const picked: MissionEvent[] = []
  while (picked.length < eventsData.maxChoiceEvents && picked.length < choices.length) {
    const usedPhases = picked.map((e) => e.phase)
    const fresh = choices.find((e) => !picked.includes(e) && !usedPhases.includes(e.phase))
    const any = choices.find((e) => !picked.includes(e))
    const next = fresh ?? any
    if (!next) {
      break
    }
    picked.push(next)
  }

  const result = [...autos, ...picked]
  if (isPowerDead(report, ctx)) {
    result.push(powerLossEvent(ctx, report))
  }
  return result.sort((a, b) => {
    const phaseDiff = PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase)
    if (phaseDiff !== 0) {
      return phaseDiff
    }
    return b.priority - a.priority
  })
}

function firstMatching(outcomes: Outcome[], ctx: MissionContext, report: ResourceReport): Outcome {
  const found = outcomes.find((o) => matches(o.when, ctx, report))
  return found ?? outcomes[outcomes.length - 1]
}

export function resolveChoice(
  event: MissionEvent,
  choiceIndex: number,
  timedOut: boolean,
  ctx: MissionContext,
  report: ResourceReport,
): ResolvedEvent {
  const choices = event.choices ?? []
  const choice = choices[choiceIndex]
  return {
    event,
    choiceIndex,
    timedOut,
    outcome: firstMatching(choice.outcomes, ctx, report),
  }
}

export function resolveAuto(event: MissionEvent, ctx: MissionContext, report: ResourceReport): ResolvedEvent {
  return {
    event,
    choiceIndex: null,
    timedOut: false,
    outcome: firstMatching(event.outcomes ?? [], ctx, report),
  }
}

// The full script of a mission: log lines and events in order.
export function buildMissionPlan(ctx: MissionContext, report: ResourceReport, launchMonth: number | null): PlanStep[] {
  const month = launchMonth === null ? bestWindowMonth(ctx.destination) : launchMonth
  const transfer = transferMonths(ctx.destination, month)
  const transferLabel = ctx.destination.window.alwaysOpen
    ? ctx.destination.transfer.label
    : transfer >= 24
      ? (transfer / 12).toFixed(1) + ' years'
      : Math.round(transfer) + ' months'

  const values: Record<string, string | number> = {
    rocket: ctx.launchVehicle.name,
    destination: ctx.destination.name,
    power: ctx.powerSource.name,
    powerAvailable: ctx.powerSource.output ?? 0,
    transfer: transferLabel,
    delay: ctx.destination.signalDelay,
    data: report.dataGenerated.toFixed(1),
    share: Math.round(report.deliveredShare * 100),
    need: report.powerNeeded,
    available: report.powerAvailable,
    months: formatLifetime(report.lifetimeMonths),
  }

  const events = selectEvents(ctx, report)
  const steps: PlanStep[] = []
  const log = texts.log

  for (const phase of PHASE_ORDER) {
    const lines = log[phase]
    for (const line of lines) {
      steps.push({ phase, callsign: line.callsign, text: fill(line.text, values) })
    }
    for (const event of events) {
      if (event.phase === phase) {
        steps.push({ phase, callsign: event.callsign, text: event.title, event })
      }
    }
  }
  return steps
}
