import { useEffect, useMemo, useRef, useState } from 'react'
import { HudButton } from '../components/HudButton'
import { MissionLog, type LogLine, type LogTone } from '../components/MissionLog'
import { ScreenHeader } from '../components/ScreenHeader'
import { texts, fill } from '../logic/data'
import { buildMissionPlan, resolveAuto, resolveChoice } from '../logic/events'
import { formatLifetime, transferMonths, bestWindowMonth } from '../logic/resources'
import { evaluateMission } from '../logic/scoring'
import type { MissionEvent, MissionPhase, Outcome, PlanStep, Quality } from '../logic/types'
import { useMission, useMissionReport } from '../store/useMission'

const STEP_MS = 1500
const DECISION_SECONDS = 15
const PHASES: MissionPhase[] = ['launch', 'cruise', 'arrival', 'operations']
const LAUNCH_TIMES = ['T+00:00', 'T+00:08', 'T+01:12', 'T+02:40', 'T+08:30', 'T+45:00', 'T+52:00']

function toneFor(quality: Quality, lost: boolean): LogTone {
  if (lost) {
    return 'lost'
  }
  if (quality === 'good') {
    return 'good'
  }
  if (quality === 'bad') {
    return 'bad'
  }
  return 'normal'
}

// Mission time label for a step, e.g. "T+02:40" during launch or "DAY 214" later.
function timeLabel(plan: PlanStep[], index: number, transferDays: number): string {
  const step = plan[index]
  let indexInPhase = 0
  let phaseLength = 0
  for (let i = 0; i < plan.length; i++) {
    if (plan[i].phase === step.phase) {
      if (i < index) {
        indexInPhase = indexInPhase + 1
      }
      phaseLength = phaseLength + 1
    }
  }
  if (step.phase === 'launch') {
    return LAUNCH_TIMES[Math.min(indexInPhase, LAUNCH_TIMES.length - 1)]
  }
  if (step.phase === 'cruise') {
    return 'DAY ' + Math.max(1, Math.round((transferDays * (indexInPhase + 1)) / (phaseLength + 1)))
  }
  if (step.phase === 'arrival') {
    return 'DAY ' + Math.round(transferDays)
  }
  return 'DAY ' + Math.round(transferDays + 20 * (indexInPhase + 1))
}

interface WhyNote {
  title: string
  outcome: Outcome
}

function DecisionModal({
  event,
  timed,
  onChoose,
}: {
  event: MissionEvent
  timed: boolean
  onChoose: (index: number, timedOut: boolean) => void
}) {
  const [left, setLeft] = useState(DECISION_SECONDS)
  const choices = event.choices ?? []
  const defaultChoice = event.defaultChoice ?? 0
  const onChooseRef = useRef(onChoose)
  onChooseRef.current = onChoose

  useEffect(() => {
    if (!timed) {
      return
    }
    if (left <= 0) {
      onChooseRef.current(defaultChoice, true)
      return
    }
    const timer = window.setTimeout(() => setLeft(left - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left, timed, defaultChoice])

  const ringLength = 2 * Math.PI * 18

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="event-title">
      <div className="modal event-modal">
        <div className="event-head">
          <span className="capcom-sign">{event.callsign} · DECISION NEEDED</span>
          {timed && (
            <svg className="timer-ring" viewBox="0 0 44 44" aria-label={left + ' seconds left'}>
              <circle cx="22" cy="22" r="18" className="timer-track" />
              <circle
                cx="22"
                cy="22"
                r="18"
                className={'timer-fill' + (left <= 3 ? ' is-low' : '')}
                strokeDasharray={ringLength}
                strokeDashoffset={ringLength * (1 - left / DECISION_SECONDS)}
              />
              <text x="22" y="27" textAnchor="middle" className="timer-text">
                {left}
              </text>
            </svg>
          )}
        </div>
        <h3 id="event-title" className="event-title">
          {event.title}
        </h3>
        <p className="event-text">{event.text}</p>
        <div className="event-choices">
          {choices.map((choice, index) => (
            <button key={choice.label} type="button" className="choice-card" onClick={() => onChoose(index, false)}>
              <span className="choice-label">{choice.label}</span>
              <span className="choice-hint">{choice.hint}</span>
            </button>
          ))}
        </div>
        <p className="event-foot">
          {timed ? 'No decision in time = ' + choices[defaultChoice].label + '. Not deciding is also a decision.' : 'Take your time, Director.'}
        </p>
      </div>
    </div>
  )
}

// Point on the cubic curve M60,150 C200,20 420,20 560,110 at parameter t (0..1).
function bezierPoint(t: number): { x: number; y: number } {
  const u = 1 - t
  const x = u * u * u * 60 + 3 * u * u * t * 200 + 3 * u * t * t * 420 + t * t * t * 560
  const y = u * u * u * 150 + 3 * u * u * t * 20 + 3 * u * t * t * 20 + t * t * t * 110
  return { x, y }
}

function Trajectory({ progress, phase, destinationName, delay, color }: { progress: number; phase: MissionPhase; destinationName: string; delay: string; color: string }) {
  const path = 'M60,150 C200,20 420,20 560,110'
  const showSignal = phase === 'operations'
  const craft = bezierPoint(progress)
  return (
    <svg className="trajectory" viewBox="0 0 620 200" role="img" aria-label={'Spacecraft path to ' + destinationName}>
      <path d={path} fill="none" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 6" />
      <path d={path} fill="none" stroke="#5dcaa5" strokeWidth="1.6" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} className="trajectory-done" />
      <circle cx="60" cy="150" r="12" fill="#4f9be8" />
      <text x="60" y="185" textAnchor="middle" className="map-label">
        Earth
      </text>
      <circle cx="560" cy="110" r="14" fill={color} />
      <text x="560" y="150" textAnchor="middle" className="map-label">
        {destinationName}
      </text>
      <circle cx={craft.x} cy={craft.y} r="5" fill="#ffffff" className="trajectory-craft" />
      {showSignal &&
        [0, 1, 2].map((i) => (
          <circle key={i} r="3" fill="#5dcaa5">
            <animateMotion dur="3s" begin={i + 's'} repeatCount="indefinite" path="M560,110 C420,170 200,190 60,150" />
          </circle>
        ))}
      {showSignal && (
        <text x="310" y="196" textAnchor="middle" className="map-label">
          signal delay: {delay}
        </text>
      )}
    </svg>
  )
}

export function Mission() {
  const data = useMissionReport()
  const launchMonth = useMission((s) => s.launchMonth)
  const resolved = useMission((s) => s.resolved)
  const recordEvent = useMission((s) => s.recordEvent)
  const finishMission = useMission((s) => s.finishMission)
  const sandbox = useMission((s) => s.sandbox)

  const [index, setIndex] = useState(0)
  const [lines, setLines] = useState<LogLine[]>([])
  const [pending, setPending] = useState<MissionEvent | null>(null)
  const [lost, setLost] = useState(false)
  const [done, setDone] = useState(false)
  const [fast, setFast] = useState(false)
  const [why, setWhy] = useState<WhyNote | null>(null)
  const lineId = useRef(0)

  const plan = useMemo(() => (data ? buildMissionPlan(data.ctx, data.report, launchMonth) : []), [data, launchMonth])

  const transferDays = useMemo(() => {
    if (!data) {
      return 0
    }
    const month = launchMonth ?? bestWindowMonth(data.ctx.destination)
    return transferMonths(data.ctx.destination, month) * 30.4
  }, [data, launchMonth])

  function addLine(callsign: string, text: string, tone: LogTone, time: string) {
    lineId.current = lineId.current + 1
    const line: LogLine = { id: lineId.current, time, callsign, text, tone }
    setLines((current) => [...current, line])
  }

  // Play the plan one step at a time; pause on decisions; stop if the mission is lost.
  useEffect(() => {
    if (!data || pending || done || lost) {
      return
    }
    if (index >= plan.length) {
      const end = texts.log.end
      addLine(end.callsign, fill(end.text, { months: formatLifetime(data.report.lifetimeMonths) }), 'good', 'END')
      setDone(true)
      return
    }
    const timer = window.setTimeout(
      () => {
        const step = plan[index]
        const time = timeLabel(plan, index, transferDays)
        if (!step.event) {
          addLine(step.callsign, step.text, 'normal', time)
          setIndex(index + 1)
          return
        }
        const event = step.event
        addLine(event.callsign, event.title.toUpperCase() + ' ' + event.text, 'event', time)
        if (event.kind === 'choice') {
          setPending(event)
          return
        }
        const result = resolveAuto(event, data.ctx, data.report)
        recordEvent(result)
        const isLost = Boolean(result.outcome.effects.lost)
        addLine(event.callsign, result.outcome.log, toneFor(result.outcome.quality, isLost), time)
        if (result.outcome.quality !== 'info') {
          setWhy({ title: event.title, outcome: result.outcome })
        }
        if (isLost) {
          addLine(texts.log.lost.callsign, texts.log.lost.text, 'lost', time)
          setLost(true)
          return
        }
        setIndex(index + 1)
      },
      fast ? STEP_MS / 4 : STEP_MS,
    )
    return () => window.clearTimeout(timer)
    // addLine only appends; leaving it out keeps the effect from restarting every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, plan, index, pending, done, lost, fast, transferDays, recordEvent])

  if (!data) {
    return null
  }
  const { ctx, report } = data

  function choose(choiceIndex: number, timedOut: boolean) {
    if (!pending || !data) {
      return
    }
    const result = resolveChoice(pending, choiceIndex, timedOut, data.ctx, data.report)
    recordEvent(result)
    const time = timeLabel(plan, index, transferDays)
    const choice = (pending.choices ?? [])[choiceIndex]
    addLine('FLIGHT', (timedOut ? 'No decision. Default: ' : 'Director: ') + choice.label, 'normal', time)
    addLine(pending.callsign, result.outcome.log, toneFor(result.outcome.quality, false), time)
    setWhy({ title: pending.title, outcome: result.outcome })
    setPending(null)
    setIndex(index + 1)
  }

  const currentPhase: MissionPhase = index > 0 ? plan[Math.min(index, plan.length) - 1].phase : 'launch'
  const phaseIndex = PHASES.indexOf(currentPhase)
  let progress = 0
  if (currentPhase === 'cruise') {
    const cruiseSteps = plan.filter((s) => s.phase === 'cruise').length
    const before = plan.slice(0, index).filter((s) => s.phase === 'cruise').length
    progress = 0.08 + 0.8 * (before / Math.max(1, cruiseSteps))
  } else if (currentPhase === 'arrival' || currentPhase === 'operations') {
    progress = 1
  } else {
    progress = 0.04
  }

  const live = evaluateMission(ctx, report, resolved)
  const timed = ctx.destination.difficulty !== 'Tutorial' && !sandbox

  return (
    <section className="screen">
      <ScreenHeader
        step="Step 6 of 6 · Mission"
        title={ctx.destination.name + ' mission in progress'}
        capcom={texts.capcom.mission}
        right={
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setFast(!fast)} aria-pressed={fast}>
            {fast ? 'Speed ×4' : 'Speed ×1'}
          </button>
        }
      />

      <div className="mission-layout">
        <div className="mission-left">
          <div className="phase-track panel">
            {PHASES.map((phase, i) => (
              <div key={phase} className={'phase' + (i < phaseIndex || done ? ' is-done' : '') + (i === phaseIndex && !done ? ' is-current' : '')}>
                <span className="phase-dot" />
                <span className="phase-name">{texts.phases[phase]}</span>
              </div>
            ))}
          </div>

          <div className="panel trajectory-panel">
            <Trajectory progress={progress} phase={currentPhase} destinationName={ctx.destination.name} delay={ctx.destination.signalDelay} color={ctx.destination.map.color} />
          </div>

          <div className="live-stats">
            <div className="live-stat panel">
              <span className="eyebrow">Power</span>
              <span className="live-value mono">
                {report.powerNeeded}/{report.powerAvailable} W
              </span>
            </div>
            <div className="live-stat panel">
              <span className="eyebrow">Data home</span>
              <span className="live-value mono">{Math.round(live.deliveredShare * 100)}%</span>
            </div>
            <div className="live-stat panel">
              <span className="eyebrow">Science forecast</span>
              <span className="live-value mono">{live.science}/100</span>
            </div>
          </div>

          {why && (
            <div className={'why-card panel tone-' + why.outcome.quality} key={why.title}>
              <span className="eyebrow">Why it matters · {why.title}</span>
              <p>{why.outcome.why}</p>
            </div>
          )}
        </div>

        <MissionLog lines={lines} />
      </div>

      <div className="screen-actions">
        <span className="faint mono small">
          {ctx.launchVehicle.name.toUpperCase()} · {ctx.orbit.name.toUpperCase()} · {ctx.instruments.length} INSTRUMENTS
        </span>
        {(done || lost) && (
          <HudButton onClick={() => finishMission(ctx, report)}>{lost ? 'Investigate: mission report' : 'Mission report'}</HudButton>
        )}
      </div>

      {pending && <DecisionModal event={pending} timed={timed} onChoose={choose} />}
    </section>
  )
}
