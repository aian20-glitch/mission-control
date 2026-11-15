import { useEffect, useMemo, useRef, useState } from 'react'
import { HudButton } from '../components/HudButton'
import { MissionLog, type LogLine, type LogTone } from '../components/MissionLog'
import { ScreenHeader, stepLabel } from '../components/ScreenHeader'
import { useSmoothValue } from '../components/useSmoothValue'
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
  const day = texts.ui.mission.day
  if (step.phase === 'cruise') {
    return fill(day, { n: Math.max(1, Math.round((transferDays * (indexInPhase + 1)) / (phaseLength + 1))) })
  }
  if (step.phase === 'arrival') {
    return fill(day, { n: Math.round(transferDays) })
  }
  return fill(day, { n: Math.round(transferDays + 20 * (indexInPhase + 1)) })
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
  const t = texts.ui.mission

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="event-title">
      <div className="modal event-modal">
        <div className="event-head">
          <span className="capcom-sign">{fill(t.decision, { callsign: event.callsign })}</span>
          {timed && (
            <svg className="timer-ring" viewBox="0 0 44 44" aria-label={fill(t.secondsLeft, { n: left })}>
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
          {timed ? fill(t.timedFoot, { choice: choices[defaultChoice].label }) : t.untimedFoot}
        </p>
      </div>
    </div>
  )
}

// The flight path on the chart: a curve from the Earth (bottom left) to the target (top right).
const PATH = { x0: 110, y0: 300, x1: 300, y1: 60, x2: 600, y2: 40, x3: 780, y3: 130 }
const PATH_D = 'M110,300 C300,60 600,40 780,130'
const PATH_BACK_D = 'M780,130 C600,210 300,330 110,300'

// Point on that curve at parameter t (0..1).
function pathPoint(t: number): { x: number; y: number } {
  const u = 1 - t
  const x = u * u * u * PATH.x0 + 3 * u * u * t * PATH.x1 + 3 * u * t * t * PATH.x2 + t * t * t * PATH.x3
  const y = u * u * u * PATH.y0 + 3 * u * u * t * PATH.y1 + 3 * u * t * t * PATH.y2 + t * t * t * PATH.y3
  return { x, y }
}

interface FlightChartProps {
  progress: number
  glideMs: number
  phase: MissionPhase
  destinationName: string
  delay: string
  color: string
}

// The flight chart: a flat drawing in thin lines, like a tracking screen in mission control.
// The spacecraft glides along the path; each log step moves it a little further.
function FlightChart({ progress, glideMs, phase, destinationName, delay, color }: FlightChartProps) {
  const t = texts.ui.mission
  const showSignal = phase === 'operations'
  const shown = useSmoothValue(progress, glideMs)
  const craft = pathPoint(shown)
  const percent = Math.round(shown * 100)
  const marks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  return (
    <svg className="trajectory chart" viewBox="0 0 900 400" role="img" aria-label={fill(t.path, { name: destinationName })}>
      <defs>
        <pattern id="chart-grid" width="45" height="45" patternUnits="userSpaceOnUse">
          <path d="M45,0 L0,0 L0,45" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="900" height="400" fill="url(#chart-grid)" />

      {/* Corner brackets and the chart's own captions */}
      <path d="M14,34 L14,14 L34,14 M866,14 L886,14 L886,34 M886,366 L886,386 L866,386 M34,386 L14,386 L14,366" className="chart-bracket" />
      <text x="32" y="44" className="chart-text">
        {fill(t.chartTitle, { name: destinationName }).toUpperCase()}
      </text>
      <text x="868" y="44" textAnchor="end" className="chart-text chart-text-accent">
        {fill(t.chartPhase, { phase: texts.phases[phase] }).toUpperCase()}
      </text>
      <text x="32" y="370" className="chart-text">
        {fill(t.chartWay, { n: percent }).toUpperCase()}
      </text>
      {showSignal && (
        <text x="868" y="370" textAnchor="end" className="chart-text chart-text-accent">
          {fill(t.signal, { delay }).toUpperCase()}
        </text>
      )}

      {/* The Earth with the Moon's orbit around it */}
      <circle cx={PATH.x0} cy={PATH.y0} r="38" className="chart-ring" />
      <circle cx={PATH.x0 + 38} cy={PATH.y0} r="3" fill="#b9bdc4" />
      <circle cx={PATH.x0} cy={PATH.y0} r="15" fill="#4f9be8" className="trajectory-earth" />
      <text x={PATH.x0 + 56} y={PATH.y0 + 6} className="chart-text">
        {texts.ui.window.earth.toUpperCase()}
      </text>

      {/* The target */}
      <circle cx={PATH.x3} cy={PATH.y3} r="34" className="chart-ring" />
      <circle cx={PATH.x3} cy={PATH.y3} r="19" fill={color} className={shown > 0.97 ? 'trajectory-target is-reached' : 'trajectory-target'} />
      <text x={PATH.x3} y={PATH.y3 + 64} textAnchor="middle" className="chart-text">
        {destinationName.toUpperCase()}
      </text>

      {/* The path: all of it dashed, the part already flown in solid teal, a mark every tenth of the way */}
      <path d={PATH_D} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="2 7" />
      <path d={PATH_D} fill="none" stroke="#5dcaa5" strokeWidth="1.6" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - shown} />
      {marks.map((mark) => {
        const point = pathPoint(mark)
        return <circle key={mark} cx={point.x} cy={point.y} r="2.2" className={mark <= shown ? 'chart-mark is-passed' : 'chart-mark'} />
      })}

      {/* The spacecraft inside a round sight */}
      <g transform={'translate(' + craft.x + ' ' + craft.y + ')'}>
        <circle r="15" className="trajectory-halo" />
        <circle r="13" className="chart-sight" />
        <path d="M-21,0 L-13,0 M13,0 L21,0 M0,-21 L0,-13 M0,13 L0,21" className="chart-sight" />
        <circle r="4" fill="#ffffff" className="trajectory-craft" />
        <text x="28" y="-8" className="chart-text chart-text-strong">
          {t.chartCraft}
        </text>
        <text x="28" y="14" className="chart-text chart-text-accent">
          {percent}%
        </text>
      </g>

      {showSignal && (
        <g className="trajectory-signal">
          {[0, 1, 2].map((i) => (
            <circle key={i} r="3" fill="#5dcaa5">
              <animateMotion dur="3s" begin={i + 's'} repeatCount="indefinite" path={PATH_BACK_D} />
            </circle>
          ))}
        </g>
      )}
    </svg>
  )
}

// Three live numbers under the path. Data and science count up or down instead of jumping.
function LiveStats({ power, delivered, science }: { power: string; delivered: number; science: number }) {
  const shownDelivered = useSmoothValue(delivered, 700)
  const shownScience = useSmoothValue(science, 700)
  const t = texts.ui.mission
  return (
    <div className="live-stats">
      <div className="live-stat panel">
        <span className="eyebrow">{t.power}</span>
        <span className="live-value mono">
          {power} {texts.units.watt}
        </span>
      </div>
      <div className="live-stat panel">
        <span className="eyebrow">{t.dataHome}</span>
        <span className="live-value mono">{Math.round(shownDelivered)}%</span>
      </div>
      <div className="live-stat panel">
        <span className="eyebrow">{t.forecast}</span>
        <span className="live-value mono">{Math.round(shownScience)}/100</span>
      </div>
    </div>
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
  // The feed starts with three system lines, like a terminal waking up.
  const [lines, setLines] = useState<LogLine[]>(() => {
    const m = texts.ui.mission
    return [m.boot1, m.boot2, m.boot3].map((text, i) => ({ id: -3 + i, time: m.bootTime, callsign: m.bootSign, text, tone: 'boot' as LogTone }))
  })
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
      addLine(end.callsign, fill(end.text, { months: formatLifetime(data.report.lifetimeMonths) }), 'good', texts.ui.mission.end)
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
    addLine('FLIGHT', fill(timedOut ? texts.ui.mission.defaultChoice : texts.ui.mission.directorChoice, { choice: choice.label }), 'normal', time)
    addLine(pending.callsign, result.outcome.log, toneFor(result.outcome.quality, false), time)
    setWhy({ title: pending.title, outcome: result.outcome })
    setPending(null)
    setIndex(index + 1)
  }

  const currentPhase: MissionPhase = index > 0 ? plan[Math.min(index, plan.length) - 1].phase : 'launch'
  const phaseIndex = PHASES.indexOf(currentPhase)
  // Where the spacecraft is on the path (0 = Earth, 1 = target). It moves a little with every step.
  let progress = 0
  if (currentPhase === 'launch') {
    const launchSteps = plan.filter((s) => s.phase === 'launch').length
    const before = plan.slice(0, index).filter((s) => s.phase === 'launch').length
    progress = 0.06 * (before / Math.max(1, launchSteps))
  } else if (currentPhase === 'cruise') {
    const cruiseSteps = plan.filter((s) => s.phase === 'cruise').length
    const before = plan.slice(0, index).filter((s) => s.phase === 'cruise').length
    progress = 0.08 + 0.88 * (before / Math.max(1, cruiseSteps))
  } else {
    progress = 1
  }
  // One step lasts this long, so the spacecraft never stops between steps.
  const glideMs = fast ? STEP_MS / 4 : STEP_MS
  // The bar under the phases fills smoothly from phase to phase.
  const phaseFill = done ? 1 : (phaseIndex + 0.5) / PHASES.length

  const live = evaluateMission(ctx, report, resolved)
  const timed = ctx.destination.difficulty !== 'Tutorial' && !sandbox
  const t = texts.ui.mission
  return (
    <section className="screen">
      <ScreenHeader
        step={stepLabel(6, 'mission')}
        title={fill(t.heading, { name: ctx.destination.name })}
        capcom={texts.capcom.mission}
        right={
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setFast(!fast)} aria-pressed={fast}>
            {fill(t.speed, { n: fast ? 4 : 1 })}
          </button>
        }
      />

      <div className="mission-layout">
        <div className="mission-left">
          <div className="phase-track panel">
            <span className="phase-progress" style={{ transform: 'scaleX(' + phaseFill + ')' }} aria-hidden="true" />
            {PHASES.map((phase, i) => (
              <div key={phase} className={'phase' + (i < phaseIndex || done ? ' is-done' : '') + (i === phaseIndex && !done ? ' is-current' : '')}>
                <span className="phase-dot" />
                <span className="phase-name">{texts.phases[phase]}</span>
              </div>
            ))}
          </div>

          <div className="panel trajectory-panel">
            <FlightChart progress={progress} glideMs={glideMs} phase={currentPhase} destinationName={ctx.destination.name} delay={ctx.destination.signalDelay} color={ctx.destination.map.color} />
          </div>

          <LiveStats power={report.powerNeeded + '/' + report.powerAvailable} delivered={live.deliveredShare * 100} science={live.science} />

          {why && (
            <div className={'why-card panel tone-' + why.outcome.quality} key={why.title}>
              <span className="eyebrow">{fill(t.why, { title: why.title })}</span>
              <p>{why.outcome.why}</p>
            </div>
          )}
        </div>

        <MissionLog lines={lines} />
      </div>

      <div className="screen-actions">
        <span className="faint mono small">
          {fill(t.summary, { rocket: ctx.launchVehicle.name, orbit: ctx.orbit.name, n: ctx.instruments.length }).toUpperCase()}
        </span>
        {(done || lost) && (
          <HudButton onClick={() => finishMission(ctx, report)}>{lost ? t.investigate : t.report}</HudButton>
        )}
      </div>

      {pending && <DecisionModal event={pending} timed={timed} onChoose={choose} />}
    </section>
  )
}
