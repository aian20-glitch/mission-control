import { useMemo } from 'react'
import { HudButton } from '../components/HudButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Stars } from '../components/Stars'
import { Tooltip } from '../components/Tooltip'
import { fill, getOrbit, getPart, money, num, texts } from '../logic/data'
import { formatLifetime } from '../logic/resources'
import { evaluateDesign } from '../logic/scoring'
import type { Design, Note } from '../logic/types'
import { useMission, useMissionReport } from '../store/useMission'

function verdictFor(lost: boolean, stars: number): string {
  const t = texts.ui.debrief
  if (lost) {
    return t.lost
  }
  if (stars === 3) {
    return t.outstanding
  }
  if (stars === 2) {
    return t.success
  }
  if (stars === 1) {
    return t.partial
  }
  return t.failed
}

function partNames(design: Design): string {
  const ids = [design.power, ...design.instruments, design.comms, ...design.extras]
  return ids.map((id) => getPart(id).name).join(' · ')
}

// One part of the total score. The explanation shows on hover or focus.
function ScoreTile({ label, weight, value, explain }: { label: string; weight: string; value: number; explain: string }) {
  return (
    <Tooltip text={explain} below>
      <div className="score-tile" tabIndex={0}>
        <div className="score-tile-head">
          <span className="eyebrow">{label}</span>
          <span className="faint mono small">{weight}</span>
        </div>
        <span className="score-tile-value mono">{value}</span>
        <div className="resource-track">
          <div className="resource-fill" style={{ width: value + '%' }} />
        </div>
      </div>
    </Tooltip>
  )
}

function NotesList({ title, notes, tone, empty }: { title: string; notes: Note[]; tone: 'good' | 'bad'; empty: string }) {
  return (
    <div className={'notes-card tone-' + tone}>
      <span className="eyebrow">{title}</span>
      {notes.length === 0 && <p className="dim small">{empty}</p>}
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

  const t = texts.ui.debrief

  return (
    <section className="screen">
      <ScreenHeader step={t.step} title={t.heading} capcom={texts.capcom.debrief} />

      <div className={'debrief-hero panel' + (result.lost ? ' is-lost' : '')}>
        <Stars count={result.stars} />
        <div className="debrief-verdict">
          <h3>{verdictFor(result.lost, result.stars)}</h3>
          <p className="dim">
            {destination.name} · {ctx.orbit.name} · {destination.objective.title}
          </p>
          <p className="faint mono small">
            {fill(t.summary, { months: formatLifetime(result.missionMonths), share: Math.round(result.deliveredShare * 100), cost: money(report.cost) })}
          </p>
        </div>
        <div className="score-tiles">
          <ScoreTile label={t.science} weight="60%" value={result.science} explain={t.scienceExplain} />
          <ScoreTile label={t.efficiency} weight="20%" value={result.efficiency} explain={t.efficiencyExplain} />
          <ScoreTile label={t.decisions} weight="20%" value={result.decisions} explain={t.decisionsExplain} />
        </div>
        <div className="debrief-total mono">
          <span className="debrief-total-value">{result.total}</span>
          <span className="faint">/100</span>
        </div>
      </div>

      <div className="debrief-grid">
        <div className="panel panel-pad debrief-column">
          <NotesList title={t.helped} notes={result.helped} tone="good" empty={t.helpedEmpty} />
          <NotesList title={t.hurt} notes={result.hurt} tone="bad" empty={t.hurtEmpty} />
        </div>

        <div className="panel panel-pad debrief-column real-mission">
          <span className="eyebrow">{fill(t.real, { year: destination.realMission.year })}</span>
          <h4>{destination.realMission.name}</h4>
          <p className="dim">{destination.realMission.text}</p>
          <p className="real-lesson">{destination.realMission.lesson}</p>
          <div className="design-summary">
            <span className="eyebrow">{t.yours}</span>
            <p>
              {ctx.launchVehicle.name} · {ctx.orbit.name} · {partNames(ctx.design)}
            </p>
          </div>
        </div>

        <div className="panel panel-pad debrief-column alternatives">
          <span className="eyebrow">{t.others}</span>
          <p className="dim small">{t.othersLead}</p>
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
                  {fill(t.altMeta, { cost: money(alt.evaluation.report.cost), mass: num(alt.evaluation.report.totalMass), science: alt.evaluation.result.science })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={newMission}>
          {t.newTarget}
        </HudButton>
        <HudButton onClick={retry}>{t.retry}</HudButton>
      </div>
    </section>
  )
}
