// Resource model: turns the player's choices into the six resources.
// Pure functions only — no React, no store.
import { bus, fill, getDestination, getOrbit, getPart, texts } from './data'
import type { Design, Destination, DestinationId, Issue, MissionContext, OrbitId, ResourceBarData, ResourceReport, Severity } from './types'

export const WINDOW_MONTHS = 36 // launch window slider: Jan 2027 .. Dec 2029
const GOOD_WINDOW_FACTOR = 0.9
const MAX_DATA_REFERENCE = 17 // GB/day of the three most data-hungry instruments, for the bar scale

// ---------- Launch window ----------

// How close a month is to the best launch month: 1 = perfect, 0 = worst.
function windowWeight(destination: Destination, month: number): number {
  const w = destination.window
  if (w.alwaysOpen) {
    return 1
  }
  const period = w.periodMonths
  const shifted = (((month - w.bestMonth) % period) + period) % period
  const distance = Math.min(shifted, period - shifted)
  const width = period * 0.12
  return Math.exp(-(distance / width) * (distance / width))
}

// Share of the rocket's capacity available in this month.
export function windowFactor(destination: Destination, month: number): number {
  const weight = windowWeight(destination, month)
  const worst = destination.window.worstFactor
  return worst + (1 - worst) * weight
}

export function isGoodWindow(destination: Destination, month: number): boolean {
  return windowFactor(destination, month) >= GOOD_WINDOW_FACTOR
}

export function transferMonths(destination: Destination, month: number): number {
  const weight = windowWeight(destination, month)
  const t = destination.transfer
  return t.bestMonths + (t.worstMonths - t.bestMonths) * (1 - weight)
}

export function bestWindowMonth(destination: Destination): number {
  let best = 0
  for (let m = 0; m < WINDOW_MONTHS; m++) {
    if (windowFactor(destination, m) > windowFactor(destination, best)) {
      best = m
    }
  }
  return best
}

// ---------- Context ----------

export function buildContext(
  destinationId: DestinationId,
  orbitId: OrbitId,
  design: Design,
  launchMonth: number | null,
  sandbox: boolean,
): MissionContext {
  const destination = getDestination(destinationId)
  // Before the player picks a date we assume the best window.
  const month = launchMonth === null ? bestWindowMonth(destination) : launchMonth
  return {
    destination,
    orbit: getOrbit(destination, orbitId),
    design,
    launchVehicle: getPart(design.launchVehicle),
    powerSource: getPart(design.power),
    instruments: design.instruments.map(getPart),
    comms: getPart(design.comms),
    extras: design.extras.map(getPart),
    windowFactor: windowFactor(destination, month),
    sandbox,
  }
}

export function hasPart(ctx: MissionContext, partId: string): boolean {
  const d = ctx.design
  return (
    d.launchVehicle === partId ||
    d.power === partId ||
    d.comms === partId ||
    d.instruments.includes(partId) ||
    d.extras.includes(partId)
  )
}

// An instrument works only if the chosen orbit allows it (e.g. seismometer needs a lander).
export function instrumentWorks(ctx: MissionContext, instrumentId: string): boolean {
  const part = getPart(instrumentId)
  if (!part.requiresOrbit) {
    return true
  }
  return part.requiresOrbit.includes(ctx.orbit.id)
}

// ---------- Main calculation ----------

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function computeResources(ctx: MissionContext): ResourceReport {
  const { destination, orbit, launchVehicle, powerSource, instruments, comms, extras } = ctx
  const issues: Issue[] = []

  // --- Time (needed first: operations cost depends on it) ---
  let lifetime = orbit.lifetimeMonths
  for (const extra of extras) {
    if (extra.lifetimeMult) {
      lifetime = lifetime * extra.lifetimeMult
    }
  }
  const isSolar = powerSource.powerType === 'solar'
  if (isSolar && orbit.solarLifetimeCapMonths !== undefined) {
    lifetime = Math.min(lifetime, orbit.solarLifetimeCapMonths)
  }
  const requiredMonths = destination.objective.requiredMonths
  const timeShare = clamp01(lifetime / requiredMonths)

  // --- Budget ---
  const operationsMonths = Math.min(lifetime, requiredMonths)
  const operationsCost = Math.round(operationsMonths * destination.opsCostPerMonth)
  const costBreakdown: { label: string; cost: number }[] = [
    { label: bus.name, cost: bus.cost },
    { label: launchVehicle.name, cost: launchVehicle.cost },
    { label: powerSource.name, cost: powerSource.cost },
  ]
  for (const instrument of instruments) {
    costBreakdown.push({ label: instrument.name, cost: instrument.cost })
  }
  costBreakdown.push({ label: comms.name, cost: comms.cost })
  for (const extra of extras) {
    costBreakdown.push({ label: extra.name, cost: extra.cost })
  }
  costBreakdown.push({ label: 'Operations (' + Math.round(operationsMonths) + ' months)', cost: operationsCost })
  const cost = costBreakdown.reduce((sum, item) => sum + item.cost, 0)
  const budgetLimit = destination.budget

  // --- Mass ---
  let dryMass = bus.mass + powerSource.mass + comms.mass
  for (const part of [...instruments, ...extras]) {
    dryMass = dryMass + part.mass
  }
  const totalMass = Math.round(dryMass * orbit.propellantFactor)
  const baseCapacity = launchVehicle.capacity ? launchVehicle.capacity[destination.id] : 0
  const massCapacity = Math.round(baseCapacity * ctx.windowFactor)

  // --- Power ---
  const output = powerSource.output ?? 0
  const powerAvailable = Math.round(isSolar ? output * destination.sunlight : output)
  let baseNeed = bus.power + comms.power
  for (const extra of extras) {
    baseNeed = baseNeed + extra.power
  }
  let instrumentPower = 0
  for (const instrument of instruments) {
    instrumentPower = instrumentPower + instrument.power
  }
  const powerNeeded = baseNeed + instrumentPower
  const powerMargin = powerAvailable / powerNeeded - 1
  const instrumentUptime = instrumentPower === 0 ? 1 : clamp01((powerAvailable - baseNeed) / instrumentPower)

  // --- Data & comms ---
  let rawData = 0
  for (const instrument of instruments) {
    if (instrumentWorks(ctx, instrument.id)) {
      rawData = rawData + (instrument.data ?? 0)
    }
  }
  const dataGenerated = round1(rawData * orbit.dutyCycle * instrumentUptime)
  const downlink = round1((comms.downlink ?? 0) * destination.linkFactor * orbit.commsFactor)
  const deliveredShare = dataGenerated <= 0 ? 1 : clamp01(downlink / dataGenerated)

  // --- Issues (most serious first) ---
  const issueText = texts.issues
  if (!ctx.sandbox && cost > budgetLimit) {
    issues.push({ resource: 'budget', severity: 'over', critical: false, text: fill(issueText.budgetOver, { over: cost - budgetLimit }) })
  }
  if (totalMass > massCapacity) {
    issues.push({
      resource: 'mass',
      severity: 'over',
      critical: false,
      text: fill(issueText.massOver, {
        over: formatNumber(totalMass - massCapacity),
        rocket: launchVehicle.name,
        capacity: formatNumber(massCapacity),
        destination: destination.name,
      }),
    })
  }
  if (orbit.requires) {
    for (const requiredId of orbit.requires) {
      if (!hasPart(ctx, requiredId)) {
        issues.push({
          resource: 'mass',
          severity: 'over',
          critical: true,
          text: fill(issueText.requiredPart, { orbit: orbit.name, part: getPart(requiredId).name }),
        })
      }
    }
  }
  if (powerAvailable < baseNeed) {
    issues.push({
      resource: 'power',
      severity: 'over',
      critical: true,
      text: fill(issueText.powerDead, { available: powerAvailable, bus: baseNeed, destination: destination.name }),
    })
  } else if (instrumentUptime < 1) {
    issues.push({ resource: 'power', severity: 'warn', critical: false, text: fill(issueText.powerLow, { uptime: Math.round(instrumentUptime * 100) }) })
  }
  if (isSolar && destination.sunlight < 0.2) {
    issues.push({
      resource: 'power',
      severity: 'warn',
      critical: false,
      text: fill(issueText.solarFar, { destination: destination.name, sunlight: Math.round(destination.sunlight * 1000) / 10, available: powerAvailable }),
    })
  }
  if (isSolar && orbit.solarLifetimeCapMonths !== undefined) {
    issues.push({ resource: 'time', severity: 'warn', critical: false, text: issueText.lunarNight })
  }
  if (instruments.length === 0) {
    issues.push({ resource: 'data', severity: 'warn', critical: false, text: issueText.noInstruments })
  }
  for (const instrument of instruments) {
    if (!instrumentWorks(ctx, instrument.id)) {
      issues.push({ resource: 'data', severity: 'warn', critical: false, text: fill(issueText.orbitInstrument, { part: instrument.name }) })
    }
  }
  if (deliveredShare < 0.8) {
    issues.push({ resource: 'comms', severity: 'warn', critical: false, text: fill(issueText.commsLow, { share: Math.round(deliveredShare * 100) }) })
  }
  if (timeShare < 1 && orbit.solarLifetimeCapMonths === undefined) {
    issues.push({
      resource: 'time',
      severity: 'warn',
      critical: false,
      text: fill(issueText.timeShort, { months: Math.round(lifetime), required: requiredMonths }),
    })
  }

  const blocking = issues.some((issue) => issue.severity === 'over' && !issue.critical)

  // --- Bars for the HUD ---
  const r = texts.resources
  const budgetStatus: Severity = ctx.sandbox ? 'ok' : cost > budgetLimit ? 'over' : cost > budgetLimit * 0.9 ? 'warn' : 'ok'
  const massStatus: Severity = totalMass > massCapacity ? 'over' : totalMass > massCapacity * 0.9 ? 'warn' : 'ok'
  const powerStatus: Severity = powerAvailable < baseNeed ? 'over' : powerNeeded > powerAvailable ? 'warn' : 'ok'
  const dataStatus: Severity = dataGenerated <= 0 ? 'warn' : 'ok'
  const commsStatus: Severity = deliveredShare < 0.8 ? 'warn' : 'ok'
  const timeStatus: Severity = timeShare < 1 ? 'warn' : 'ok'

  const bars: ResourceBarData[] = [
    {
      key: 'budget',
      label: r.budget.label,
      value: cost,
      limit: budgetLimit,
      unit: '$M',
      display: ctx.sandbox ? '$' + cost + 'M · no limit' : '$' + cost + 'M / ' + budgetLimit,
      status: budgetStatus,
      explain: r.budget.explain,
    },
    {
      key: 'mass',
      label: r.mass.label,
      value: totalMass,
      limit: massCapacity,
      unit: 'kg',
      display: formatNumber(totalMass) + ' / ' + formatNumber(massCapacity) + ' kg',
      status: massStatus,
      explain: r.mass.explain,
    },
    {
      key: 'power',
      label: r.power.label,
      value: powerNeeded,
      limit: powerAvailable,
      unit: 'W',
      display: powerNeeded + ' / ' + powerAvailable + ' W',
      status: powerStatus,
      explain: r.power.explain,
    },
    {
      key: 'data',
      label: r.data.label,
      value: dataGenerated,
      limit: MAX_DATA_REFERENCE,
      unit: 'GB/day',
      display: dataGenerated.toFixed(1) + ' GB/day',
      status: dataStatus,
      explain: r.data.explain,
    },
    {
      key: 'comms',
      label: r.comms.label,
      value: deliveredShare * 100,
      limit: 100,
      unit: '%',
      display: downlink.toFixed(1) + ' GB/day · ' + Math.round(deliveredShare * 100) + '% sent',
      status: commsStatus,
      explain: r.comms.explain,
    },
    {
      key: 'time',
      label: r.time.label,
      value: lifetime,
      limit: requiredMonths,
      unit: 'months',
      display: formatLifetime(lifetime) + ' / ' + requiredMonths + ' mo',
      status: timeStatus,
      explain: r.time.explain,
    },
  ]

  return {
    cost,
    costBreakdown,
    budgetLimit,
    dryMass,
    totalMass,
    massCapacity,
    powerNeeded,
    powerAvailable,
    powerMargin,
    instrumentUptime,
    dataGenerated,
    downlink,
    deliveredShare,
    lifetimeMonths: lifetime,
    requiredMonths,
    timeShare,
    bars,
    issues,
    canLaunch: !blocking,
  }
}

export function formatLifetime(months: number): string {
  if (months < 1) {
    return Math.max(1, Math.round(months * 30)) + ' days'
  }
  return Math.round(months) + ' mo'
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Month index 0 = January 2027.
export function monthLabel(month: number): string {
  const year = 2027 + Math.floor(month / 12)
  return MONTH_NAMES[month % 12] + ' ' + year
}

// Ideal (Hohmann) transfer from Earth's orbit (1 AU) to a circular orbit of `orbitAU`.
// Returns the trip time in months and how far ahead of Earth the target must be at launch.
export function hohmann(orbitAU: number): { months: number; leadAngle: number } {
  const transferYears = 0.5 * Math.pow((1 + orbitAU) / 2, 1.5)
  const targetPeriodYears = Math.pow(orbitAU, 1.5)
  const leadAngle = Math.PI - (2 * Math.PI * transferYears) / targetPeriodYears
  return { months: transferYears * 12, leadAngle }
}
