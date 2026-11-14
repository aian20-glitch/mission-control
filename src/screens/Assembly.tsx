import { useRef, useState } from 'react'
import { HudButton } from '../components/HudButton'
import { PartCard } from '../components/PartCard'
import { ResourcePanel } from '../components/ResourceBar'
import { ScreenHeader, stepLabel } from '../components/ScreenHeader'
import { SpacecraftSchematic } from '../components/SpacecraftSchematic'
import { StatusLights } from '../components/StatusLights'
import { fill, money, num, partsData, partsForSlot, texts } from '../logic/data'
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
  // The catalog is one scrolling list with a section per slot. `slot` is the section in view.
  const [slot, setSlot] = useState<SlotId>('launchVehicle')
  const [hotPart, setHotPart] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<SlotId, HTMLElement | null>>>({})
  // While a tab click scrolls the list, the scroll handler must not move the highlight.
  const jumpTarget = useRef<SlotId | null>(null)

  if (!data) {
    return null
  }
  const { ctx, report } = data
  const deadParts = design.instruments.filter((id) => !instrumentWorks(ctx, id))
  const blockingIssue = report.issues.find((issue) => issue.severity === 'over' && !issue.critical)
  const t = texts.ui.assembly

  function jumpTo(target: SlotId) {
    const list = listRef.current
    const section = sectionRefs.current[target]
    if (!list || !section) {
      return
    }
    jumpTarget.current = target
    setSlot(target)
    list.scrollTo({ top: section.offsetTop - 4 })
  }

  // Highlight the tab of the last section whose top has scrolled past the top of the list.
  function onListScroll() {
    const list = listRef.current
    if (!list) {
      return
    }
    if (jumpTarget.current) {
      const section = sectionRefs.current[jumpTarget.current]
      const arrived = !section || Math.abs(list.scrollTop - (section.offsetTop - 4)) < 4
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 2
      if (arrived || atBottom) {
        jumpTarget.current = null
      }
      return
    }
    let inView: SlotId = partsData.slots[0].id
    for (const s of partsData.slots) {
      const section = sectionRefs.current[s.id]
      if (section && section.offsetTop - 24 <= list.scrollTop) {
        inView = s.id
      }
    }
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 2) {
      inView = partsData.slots[partsData.slots.length - 1].id
    }
    setSlot(inView)
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
        right={
          <div className="header-stat">
            <span className="eyebrow">
              {ctx.destination.name} · {ctx.orbit.name}
            </span>
            <span className="header-stat-value mono">
              {money(report.cost)} <span className="faint">/ {ctx.sandbox ? '∞' : num(report.budgetLimit)}</span>
            </span>
          </div>
        }
      />

      <ResourcePanel bars={report.bars} />

      <div className="assembly-layout">
        <div className="assembly-stage panel">
          <div className="stage-chips">
            <span className="chip">{ctx.launchVehicle.name.toUpperCase()}</span>
            <span className="chip">{ctx.launchVehicle.stages}</span>
            <span className="chip chip-accent">
              {fill(t.massChip, { dry: num(report.dryMass), total: num(report.totalMass) })}
            </span>
          </div>
          <SpacecraftSchematic design={design} orbitId={ctx.orbit.id} hotPartId={hotPart} deadPartIds={deadParts} onHover={setHotPart} />
          <FlightNotes issues={report.issues} />
        </div>

        <div className="catalog panel">
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
          <div className="part-list" ref={listRef} onScroll={onListScroll}>
            {partsData.slots.map((s) => (
              <section
                key={s.id}
                className="part-section"
                aria-label={s.label}
                ref={(element) => {
                  sectionRefs.current[s.id] = element
                }}
              >
                <header className="part-section-head">
                  <span className="part-section-name">
                    {s.label}
                    <span className="slot-count mono">
                      {countInSlot(design, s.id)}
                      {s.max > 1 ? '/' + s.max : ''}
                    </span>
                  </span>
                  <span className="part-section-hint">{s.hint}</span>
                </header>
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
