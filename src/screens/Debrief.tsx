import { useMemo } from 'react'
import { HudButton } from '../components/HudButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Stars } from '../components/Stars'
import { getOrbit, getPart, texts } from '../logic/data'
import { formatLifetime } from '../logic/resources'
import { evaluateDesign } from '../logic/scoring'
import type { Design, Note } from '../logic/types'
import { useMission, useMissionReport } from '../store/useMission'

function verdictFor(lost: boolean, stars: number): string {
  if (lost) {
    return 'Mission lost'
  }
  if (stars === 3) {
    return 'Outstanding mission'
  }
  if (stars === 2) {
    return 'Mission success'
  }
  if (stars === 1) {
    return 'Partial success'
  }
  return 'Goal not reached'
}

function partNames(design: Design): string {
  const ids = [design.power, ...design.instruments, design.comms, ...design.extras]
  return ids.map((id) => getPart(id).name).join(' · ')
}

function ScoreTile({ label, weight, value, explain }: { label: string; weight: string; value: number; explain: string }) {
  return (
    <div className="score-tile panel">
      <div className="score-tile-head">
        <span className="eyebrow">{label}</span>
        <span className="faint mono">{weight}</span>
      </div>
      <span className="score-tile-value mono">{value}</span>
      <div className="resource-track">
        <div className="resource-fill" style={{ width: value + '%' }} />
      </div>
      <p className="score-tile-explain">{explain}</p>
    </div>
  )
}

function NotesCard({ title, notes, tone, empty }: { title: string; notes: Note[]; tone: 'good' | 'bad'; empty: string }) {
  return (
    <div className={'notes-card panel panel-pad tone-' + tone}>
      <span className="eyebrow">{title}</span>
      {notes.length === 0 && <p className="dim">{empty}</p>}
      <ul>
        {notes.map((note) => (
          <li key={note.title + note.text}>
            <span className="note-title">{note.title}</span>
            <span className="note-text">{note.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Debrief() {
  const data = useMissionReport()
  const result = useMission((s) => s.result)
  const retry = useMission((s) => s.retry)
  const newMission = useMission((s) => s.newMission)

  const destination = data ? data.ctx.destination : null
  const alternatives = useMemo(() => {
    if (!destination) {
      return []
    }
    return destination.alternatives.map((alt) => ({
      ...alt,
      evaluation: evaluateDesign(destination.id, alt.orbit, alt.design, null, false),
    }))
  }, [destination])

  if (!data || !result || !destination) {
    return null
  }
  const { ctx, report } = data

  return (
    <section className="screen">
      <ScreenHeader step="Debrief" title="Mission report" capcom={texts.capcom.debrief} />

      <div className={'debrief-hero panel' + (result.lost ? ' is-lost' : '')}>
        <Stars count={result.stars} />
        <div className="debrief-verdict">
          <h3>{verdictFor(result.lost, result.stars)}</h3>
          <p className="dim">
            {destination.name} · {ctx.orbit.name} · {destination.objective.title}
          </p>
          <p className="faint mono small">
            Worked {formatLifetime(result.missionMonths)} · {Math.round(result.deliveredShare * 100)}% of data reached Earth · ${report.cost}M spent
          </p>
        </div>
        <div className="debrief-total mono">
          <span className="debrief-total-value">{result.total}</span>
          <span className="faint">/100</span>
        </div>
      </div>

      <div className="score-tiles">
        <ScoreTile label="Science" weight="60%" value={result.science} explain="How much of the goal's science reached Earth." />
        <ScoreTile label="Efficiency" weight="20%" value={result.efficiency} explain="Money left over and a rocket that fits the job." />
        <ScoreTile label="Decisions" weight="20%" value={result.decisions} explain="How you handled problems during the flight." />
      </div>

      <div className="debrief-grid">
        <NotesCard title="What helped" notes={result.helped} tone="good" empty="Nothing stood out this time." />
        <NotesCard title="What hurt" notes={result.hurt} tone="bad" empty="Nothing went wrong. Textbook mission." />
      </div>

      <div className="debrief-grid">
        <div className="panel panel-pad real-mission">
          <span className="eyebrow">Real mission · {destination.realMission.year}</span>
          <h4>{destination.realMission.name}</h4>
          <p className="dim">{destination.realMission.text}</p>
          <p className="real-lesson">{destination.realMission.lesson}</p>
        </div>
        <div className="panel panel-pad alternatives">
          <span className="eyebrow">Other designs that work</span>
          <p className="dim small">There is rarely one perfect answer. These also reach the goal:</p>
          <ul>
            {alternatives.map((alt) => (
              <li key={alt.label}>
                <div className="alt-head">
                  <span className="alt-name">{alt.label}</span>
                  <Stars count={alt.evaluation.result.stars} size={16} />
                </div>
                <span className="alt-parts">
                  {getPart(alt.design.launchVehicle).name} · {getOrbit(destination, alt.orbit).name} · {partNames(alt.design)}
                </span>
                <span className="alt-meta mono faint">
                  ${alt.evaluation.report.cost}M · {alt.evaluation.report.totalMass.toLocaleString('en-US')} kg · science {alt.evaluation.result.science}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel panel-pad design-summary">
        <span className="eyebrow">Your design</span>
        <p>
          {ctx.launchVehicle.name} · {ctx.orbit.name} · {partNames(ctx.design)}
        </p>
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={newMission}>
          New target
        </HudButton>
        <HudButton onClick={retry}>Try again with changes</HudButton>
      </div>
    </section>
  )
}
