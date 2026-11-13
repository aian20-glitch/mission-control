// The one game store: what the player chose and where they are.
// All calculations live in src/logic — the store only keeps choices and results.
import { create } from 'zustand'
import { useMemo } from 'react'
import { copyDesign, getPart, partsData } from '../logic/data'
import { buildContext, computeResources } from '../logic/resources'
import { evaluateMission } from '../logic/scoring'
import type { Design, DestinationId, MissionContext, MissionResult, OrbitId, ResolvedEvent, ResourceReport, SlotId } from '../logic/types'

export type Screen = 'title' | 'objective' | 'orbit' | 'assembly' | 'window' | 'launch' | 'mission' | 'debrief'

export const SCREEN_ORDER: Screen[] = ['title', 'objective', 'orbit', 'assembly', 'window', 'launch', 'mission', 'debrief']

interface MissionStore {
  screen: Screen
  sandbox: boolean
  onboardingSeen: boolean
  muted: boolean
  destinationId: DestinationId | null
  orbitId: OrbitId | null
  design: Design
  launchMonth: number | null
  resolved: ResolvedEvent[]
  result: MissionResult | null
  attempts: number

  goTo: (screen: Screen) => void
  startGame: (sandbox: boolean) => void
  finishOnboarding: () => void
  toggleMute: () => void
  chooseDestination: (id: DestinationId) => void
  chooseOrbit: (id: OrbitId) => void
  selectPart: (slot: SlotId, partId: string) => void
  setLaunchMonth: (month: number) => void
  beginMission: () => void
  recordEvent: (item: ResolvedEvent) => void
  finishMission: (ctx: MissionContext, report: ResourceReport) => void
  retry: () => void
  newMission: () => void
}

function toggleInList(list: string[], id: string, max: number): string[] {
  if (list.includes(id)) {
    return list.filter((item) => item !== id)
  }
  if (list.length >= max) {
    // Full: replace the oldest choice so the click always does something.
    return [...list.slice(1), id]
  }
  return [...list, id]
}

export const useMission = create<MissionStore>((set) => ({
  screen: 'title',
  sandbox: false,
  onboardingSeen: false,
  muted: false,
  destinationId: null,
  orbitId: null,
  design: copyDesign(partsData.defaultDesign),
  launchMonth: null,
  resolved: [],
  result: null,
  attempts: 0,

  goTo: (screen) => set({ screen }),

  startGame: (sandbox) =>
    set({
      sandbox,
      screen: 'objective',
      destinationId: null,
      orbitId: null,
      design: copyDesign(partsData.defaultDesign),
      launchMonth: null,
      resolved: [],
      result: null,
    }),

  finishOnboarding: () => set({ onboardingSeen: true }),

  toggleMute: () => set((state) => ({ muted: !state.muted })),

  chooseDestination: (id) => set({ destinationId: id, orbitId: null, launchMonth: null }),

  chooseOrbit: (id) => set({ orbitId: id }),

  selectPart: (slot, partId) =>
    set((state) => {
      const design = copyDesign(state.design)
      const slotInfo = partsData.slots.find((s) => s.id === slot)
      const max = slotInfo ? slotInfo.max : 1
      if (slot === 'instruments') {
        design.instruments = toggleInList(design.instruments, partId, max)
      } else if (slot === 'extras') {
        design.extras = toggleInList(design.extras, partId, max)
      } else if (slot === 'launchVehicle') {
        design.launchVehicle = partId
      } else if (slot === 'power') {
        design.power = partId
      } else if (slot === 'comms') {
        design.comms = partId
      }
      // Make sure the part exists (throws on typos in data).
      getPart(partId)
      return { design }
    }),

  setLaunchMonth: (month) => set({ launchMonth: month }),

  beginMission: () => set({ screen: 'mission', resolved: [], result: null }),

  recordEvent: (item) => set((state) => ({ resolved: [...state.resolved, item] })),

  finishMission: (ctx, report) =>
    set((state) => ({
      result: evaluateMission(ctx, report, state.resolved),
      screen: 'debrief',
    })),

  retry: () =>
    set((state) => ({
      screen: 'assembly',
      resolved: [],
      result: null,
      attempts: state.attempts + 1,
    })),

  newMission: () =>
    set((state) => ({
      screen: 'objective',
      destinationId: null,
      orbitId: null,
      design: copyDesign(partsData.defaultDesign),
      launchMonth: null,
      resolved: [],
      result: null,
      attempts: state.attempts + 1,
    })),
}))

// Context + resource report for the current choices (null until target and orbit are chosen).
export function useMissionReport(): { ctx: MissionContext; report: ResourceReport } | null {
  const destinationId = useMission((s) => s.destinationId)
  const orbitId = useMission((s) => s.orbitId)
  const design = useMission((s) => s.design)
  const launchMonth = useMission((s) => s.launchMonth)
  const sandbox = useMission((s) => s.sandbox)

  return useMemo(() => {
    if (!destinationId || !orbitId) {
      return null
    }
    const ctx = buildContext(destinationId, orbitId, design, launchMonth, sandbox)
    const report = computeResources(ctx)
    return { ctx, report }
  }, [destinationId, orbitId, design, launchMonth, sandbox])
}
