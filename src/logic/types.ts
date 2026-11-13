// Shared types for game data (src/data/*.json) and game logic.
// Data files must follow these shapes — see docs/DATA_SCHEMA.md.

export type DestinationId = 'moon' | 'mars' | 'europa'
export type OrbitId = 'flyby' | 'orbiter' | 'lander'
export type SlotId = 'launchVehicle' | 'power' | 'instruments' | 'comms' | 'extras'
export type PowerType = 'solar' | 'rtg'
export type Severity = 'ok' | 'warn' | 'over'
export type Quality = 'good' | 'ok' | 'bad' | 'info'
export type MissionPhase = 'launch' | 'cruise' | 'arrival' | 'operations'

// ---------- Parts ----------

export interface Part {
  id: string
  slot: SlotId
  name: string
  short: string
  explain: string
  cost: number // $M
  mass: number // kg
  power: number // W consumed
  output?: number // W produced at Earth's distance (power sources)
  powerType?: PowerType
  capacity?: Record<DestinationId, number> // kg a rocket can send there
  stages?: string
  similarTo?: string
  data?: number // GB/day generated (instruments)
  science?: number // base science points (instruments)
  requiresOrbit?: OrbitId[]
  downlink?: number // GB/day at Mars distance (antennas)
  lifetimeMult?: number
}

export interface SlotInfo {
  id: SlotId
  label: string
  hint: string
  max: number
  optional: boolean
}

export interface PartsFile {
  bus: Part
  slots: SlotInfo[]
  parts: Part[]
  defaultDesign: Design
}

export interface Design {
  launchVehicle: string
  power: string
  instruments: string[]
  comms: string
  extras: string[]
}

// ---------- Destinations ----------

export interface OrbitOption {
  id: OrbitId
  name: string
  summary: string
  explain: string
  lifetimeMonths: number
  scienceMult: number
  dutyCycle: number // share of time the instruments can observe
  commsFactor: number
  propellantFactor: number // total mass = dry mass × this
  requires?: string[]
  solarLifetimeCapMonths?: number
}

export interface Destination {
  id: DestinationId
  name: string
  subtitle: string
  difficulty: 'Tutorial' | 'Standard' | 'Hard'
  objective: {
    title: string
    explain: string
    favorites: string[]
    requiredMonths: number
  }
  budget: number
  sunlight: number // share of Earth's sunlight
  linkFactor: number // radio link strength vs Mars
  opsCostPerMonth: number
  distance: string
  signalDelay: string
  fact: string
  transfer: { label: string; bestMonths: number; worstMonths: number }
  window: {
    alwaysOpen: boolean
    periodMonths: number
    bestMonth: number // month index from January 2027
    worstFactor: number
    note: string
  }
  map: { orbitAU: number; color: string }
  look: { kind: 'rocky' | 'mars' | 'icy' | 'earth'; dark: string; base: string; light: string; atmosphere: string }
  orbits: OrbitOption[]
  realMission: { name: string; year: number; text: string; lesson: string }
  alternatives: { label: string; orbit: OrbitId; design: Design }[]
}

export interface PlanetsFile {
  earth: { look: Destination['look'] }
  destinations: Destination[]
}

// ---------- Events ----------

export interface Condition {
  destination?: DestinationId[]
  orbit?: OrbitId[]
  has?: string[]
  lacks?: string[]
  powerType?: PowerType[]
  minPowerMargin?: number // (available / needed - 1) at least this
  commsBottleneck?: boolean // less than 80% of data reaches Earth
}

export interface Effects {
  scienceMult?: number
  lifetimeMult?: number
  downlinkMult?: number
  lost?: boolean
}

export interface Outcome {
  when?: Condition
  quality: Quality
  log: string
  why: string
  effects: Effects
}

export interface Choice {
  label: string
  hint: string
  outcomes: Outcome[] // first matching outcome wins
}

export interface MissionEvent {
  id: string
  phase: Exclude<MissionPhase, 'launch'>
  kind: 'choice' | 'auto'
  priority: number
  when: Condition
  callsign: string
  title: string
  text: string
  choices?: Choice[]
  defaultChoice?: number
  outcomes?: Outcome[]
}

export interface EventsFile {
  maxChoiceEvents: number
  events: MissionEvent[]
}

// ---------- Derived game state ----------

export interface MissionContext {
  destination: Destination
  orbit: OrbitOption
  design: Design
  launchVehicle: Part
  powerSource: Part
  instruments: Part[]
  comms: Part
  extras: Part[]
  windowFactor: number
  sandbox: boolean
}

export interface Issue {
  resource: ResourceKey
  severity: 'warn' | 'over'
  critical: boolean // red: the mission will likely fail
  text: string
}

export type ResourceKey = 'budget' | 'mass' | 'power' | 'data' | 'comms' | 'time'

export interface ResourceBarData {
  key: ResourceKey
  label: string
  value: number
  limit: number
  unit: string
  display: string
  status: Severity
  explain: string
}

export interface ResourceReport {
  cost: number
  costBreakdown: { label: string; cost: number }[]
  budgetLimit: number
  dryMass: number
  totalMass: number
  massCapacity: number
  powerNeeded: number
  powerAvailable: number
  powerMargin: number
  instrumentUptime: number
  dataGenerated: number
  downlink: number
  deliveredShare: number
  lifetimeMonths: number
  requiredMonths: number
  timeShare: number
  bars: ResourceBarData[]
  issues: Issue[]
  canLaunch: boolean
}

export interface ResolvedEvent {
  event: MissionEvent
  choiceIndex: number | null // null for auto events
  timedOut: boolean
  outcome: Outcome
}

export interface PlanStep {
  phase: MissionPhase
  callsign: string
  text: string
  event?: MissionEvent
}

export interface Note {
  title: string
  text: string
}

export interface MissionResult {
  lost: boolean
  lostReason: string
  science: number
  efficiency: number
  decisions: number
  total: number
  stars: number
  missionMonths: number
  deliveredShare: number
  helped: Note[]
  hurt: Note[]
}
