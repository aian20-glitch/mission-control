import { useRef, useState } from 'react'
import { HudButton } from '../components/HudButton'
import { PartCard } from '../components/PartCard'
import { ResourcePanel } from '../components/ResourceBar'
import { ScreenHeader, stepLabel } from '../components/ScreenHeader'
import { SpacecraftSchematic } from '../components/SpacecraftSchematic'
import { StatusLights } from '../components/StatusLights'
import { fill, getPart, num, partsData, partsForSlot, texts } from '../logic/data'
import { instrumentWorks } from '../logic/resources'
import type { Design, Issue, Part, SlotId } from '../logic/types'
import { useMission, useMissionReport } from '../store/useMission'

function isSelected(design: Design, part: Part): boolean {
  if (part.slot === 'instruments') {
    return design.instruments.includes(part.id)
  }
  if (part.slot === 'extras') {
    return design.extras.includes(part.id)
  }
  return design[part.slot] === part.id
}

function countInSlot(design: Design, slot: SlotId): number {
  if (slot === 'instruments') {
    return design.instruments.length
  }
  if (slot === 'extras') {
    return design.extras.length
  }
  return 1
}

function FlightNotes({ issues }: { issues: Issue[] }) {
  return (
    <div className="flight-notes">
      <span className="eyebrow">{texts.ui.assembly.notes}</span>
      {issues.length === 0 && <p className="note note-ok">{texts.ui.assembly.allGood}</p>}
      {issues.map((issue) => (
        <p key={issue.text} className={'note ' + (issue.severity === 'over' ? 'note-over' : 'note-warn')}>
          {issue.text}
        </p>
      ))}
    </div>
  )
}

export function Assembly() {
  const data = useMissionReport()
  const design = useMission((s) => s.design)
  const selectPart = useMission((s) => s.selectPart)
  const goTo = useMission((s) => s.goTo)
  // The catalog is a row of pages, one per slot, that scrolls left and right. `slot` is the page in view.
  const [slot, setSlot] = useState<SlotId>('launchVehicle')
  const [hotPart, setHotPart] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // While a tab click scrolls the list, the scroll handler must not move the highlight.
  const jumpTarget = useRef<SlotId | null>(null)

  if (!data) {
    return null
  }
  const { ctx, report } = data
  const deadParts = design.instruments.filter((id) => !instrumentWorks(ctx, id))
  const blockingIssue = report.issues.find((issue) => issue.severity === 'over' && !issue.critical)
  const t = texts.ui.assembly

  const slotIds = partsData.slots.map((s) => s.id)
  const slotIndex = slotIds.indexOf(slot)

  function jumpTo(target: SlotId) {
    const list = listRef.current
    if (!list) {
      return
    }
    jumpTarget.current = target
    setSlot(target)
    list.scrollTo({ left: slotIds.indexOf(target) * list.clientWidth })
  }

  // Every page is as wide as the list, so the page in view is scrollLeft / width.
  function onListScroll() {
    const list = listRef.current
    if (!list) {
      return
    }
    const inView = slotIds[Math.round(list.scrollLeft / list.clientWidth)]
    if (jumpTarget.current) {
      if (inView === jumpTarget.current) {
        jumpTarget.current = null
      }
      return
    }
    if (inView && inView !== slot) {
      setSlot(inView)
    }
  }

  // Clicking a part on the drawing opens its page in the catalog.
  function pickFromDrawing(partId: string) {
    const part = getPart(partId)
    if (part) {
      jumpTo(part.slot)
    }
  }

  function warningFor(part: Part): string | null {
    if (part.requiresOrbit && !part.requiresOrbit.includes(ctx.orbit.id)) {
      return t.landerOnly
    }
    if (ctx.orbit.requires && ctx.orbit.requires.includes(part.id) && !isSelected(design, part)) {
      return t.required
    }
    if (part.powerType === 'solar' && ctx.destination.sunlight < 0.2) {
      return t.weakFar
    }
    if (part.capacity && part.capacity[ctx.destination.id] * ctx.windowFactor < report.totalMass) {
      return t.tooSmall
    }
    return null
  }

  return (
    <section className="screen">
      <ScreenHeader
        step={stepLabel(3, 'assembly')}
        title={t.heading}
        capcom={texts.capcom.assembly}
      />

      <ResourcePanel bars={report.bars} />

      <div className="assembly-layout">
        <div className="assembly-stage panel">
          <div className="stage-chips">
            <span className="chip">
              {ctx.destination.name} · {ctx.orbit.name}
            </span>
            <span className="chip">{ctx.launchVehicle.name.toUpperCase()}</span>
            <span className="chip">{ctx.launchVehicle.stages}</span>
            <span className="chip chip-accent">
              {fill(t.massChip, { dry: num(report.dryMass), total: num(report.totalMass) })}
            </span>
          </div>
          <SpacecraftSchematic design={design} orbitId={ctx.orbit.id} hotPartId={hotPart} deadPartIds={deadParts} onHover={setHotPart} onPick={pickFromDrawing} />
          <FlightNotes issues={report.issues} />
        </div>

        <div className="catalog panel">
          <div className="slot-bar">
            <nav className="slot-tabs" aria-label={t.slots}>
              {partsData.slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-current={s.id === slot ? 'true' : undefined}
                  className={'slot-tab' + (s.id === slot ? ' is-active' : '')}
                  onClick={() => jumpTo(s.id)}
                >
                  {s.label}
                  <span className="slot-count mono">
                    {countInSlot(design, s.id)}
                    {s.max > 1 ? '/' + s.max : ''}
                  </span>
                </button>
              ))}
            </nav>
            <div className="slot-arrows">
              <button
                type="button"
                className="icon-btn"
                aria-label={t.prevSlot}
                disabled={slotIndex <= 0}
                onClick={() => jumpTo(slotIds[slotIndex - 1])}
              >
                ‹
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t.nextSlot}
                disabled={slotIndex >= slotIds.length - 1}
                onClick={() => jumpTo(slotIds[slotIndex + 1])}
              >
                ›
              </button>
            </div>
          </div>
          <div className="part-list" ref={listRef} onScroll={onListScroll}>
            {partsData.slots.map((s) => (
              <section key={s.id} className="part-section" aria-label={s.label} inert={s.id !== slot ? true : undefined}>
                <header className="part-section-head">
                  <span className="part-section-hint">{s.hint}</span>
                </header>
                <div className="part-section-body">
                  {partsForSlot(s.id).map((part) => (
                    <PartCard
                      key={part.id}
                      part={part}
                      destination={ctx.destination}
                      selected={isSelected(design, part)}
                      favorite={ctx.destination.objective.favorites.includes(part.id)}
                      warning={warningFor(part)}
                      onSelect={() => selectPart(s.id, part.id)}
                      onHover={setHotPart}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={() => goTo('orbit')}>
          {texts.ui.back}
        </HudButton>
        <div className="screen-actions-right">
          {blockingIssue && (
            <span className="action-reason" title={blockingIssue.text}>
              {blockingIssue.text}
            </span>
          )}
          <StatusLights bars={report.bars} />
          <HudButton disabled={!report.canLaunch} onClick={() => goTo('window')}>
            {t.next}
          </HudButton>
        </div>
      </div>
    </section>
  )
}
