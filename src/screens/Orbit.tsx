import { useEffect, useState } from 'react'
import { HudButton } from '../components/HudButton'
import { ScreenHeader, stepLabel } from '../components/ScreenHeader'
import { fill, getDestination, getPart, planetsData, texts } from '../logic/data'
import { formatLifetime } from '../logic/resources'
import type { OrbitId } from '../logic/types'
import { useMission } from '../store/useMission'
import { stageView } from '../three/stageView'

function Meter({ label, share, display }: { label: string; share: number; display: string }) {
  const clamped = Math.max(0.04, Math.min(1, share))
  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: clamped * 100 + '%' }} />
      </span>
      <span className="meter-value mono">{display}</span>
    </div>
  )
}

// Step 2: how the spacecraft meets the planet. The 3D picture behind (SpaceStage) shows the way
// the player points at: flying past, circling, or landing.
export function Orbit() {
  const destinationId = useMission((s) => s.destinationId)
  const orbitId = useMission((s) => s.orbitId)
  const chooseOrbit = useMission((s) => s.chooseOrbit)
  const goTo = useMission((s) => s.goTo)
  const [hovered, setHovered] = useState<OrbitId | null>(null)

  // What the 3D picture shows: the card under the mouse, else the chosen one, else an orbiter.
  const shown: OrbitId = hovered ?? orbitId ?? 'orbiter'

  // Move the 3D camera to a close view of the chosen planet.
  useEffect(() => {
    const index = planetsData.destinations.findIndex((d) => d.id === destinationId)
    stageView.focus = index + 1
    stageView.progress = index + 1
    stageView.mode = 'orbit'
  }, [destinationId])

  useEffect(() => {
    stageView.orbitId = shown
    stageView.onOrbitChange?.()
  }, [shown])

  if (!destinationId) {
    return null
  }
  const destination = getDestination(destinationId)
  const t = texts.ui.orbit
  const pathNotes: Record<OrbitId, string> = {
    flyby: texts.ui.journey.pathFlyby,
    orbiter: texts.ui.journey.pathOrbiter,
    lander: texts.ui.journey.pathLander,
  }
  const shownOrbit = destination.orbits.find((orbit) => orbit.id === shown)

  return (
    <section className="screen orbit-screen">
      <ScreenHeader step={stepLabel(2, 'orbit')} title={fill(t.heading, { name: destination.name })} capcom={texts.capcom.orbit} />

      <div className="orbit-layout">
        {/* The left half is the 3D picture; this caption names what it shows */}
        <div className="orbit-view">
          {shownOrbit && (
            <p className="orbit-caption" key={shown}>
              <span className="eyebrow">{shownOrbit.name}</span>
              {pathNotes[shown]}
            </p>
          )}
        </div>

        <div className="orbit-list" role="radiogroup" aria-label={t.group}>
          {destination.orbits.map((orbit) => {
            const selected = orbit.id === orbitId
            return (
              <button
                key={orbit.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={'orbit-card' + (selected ? ' is-selected' : '')}
                onClick={() => chooseOrbit(orbit.id)}
                onMouseEnter={() => setHovered(orbit.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(orbit.id)}
                onBlur={() => setHovered(null)}
              >
                <span className="orbit-head">
                  <span className="orbit-name">{orbit.name}</span>
                  {orbit.requires && (
                    <span className="chip chip-warn">{fill(t.needs, { parts: orbit.requires.map((id) => getPart(id).name).join(', ') })}</span>
                  )}
                </span>
                <span className="orbit-summary">{orbit.summary}</span>
                <span className="orbit-stats">
                  <Meter label={t.science} share={orbit.scienceMult / 1.5} display={'×' + orbit.scienceMult.toLocaleString(texts.units.locale)} />
                  <Meter label={t.lifetime} share={orbit.lifetimeMonths / 48} display={formatLifetime(orbit.lifetimeMonths)} />
                  <Meter label={t.fuel} share={(orbit.propellantFactor - 1) / 2.2} display={fill(t.fuelValue, { n: Math.round((orbit.propellantFactor - 1) * 100) })} />
                  <Meter label={t.link} share={orbit.commsFactor} display={orbit.commsFactor >= 1 ? t.good : t.weak} />
                </span>
                <span className="orbit-explain">{orbit.explain}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={() => goTo('objective')}>
          {texts.ui.back}
        </HudButton>
        <HudButton disabled={!orbitId} onClick={() => goTo('assembly')}>
          {t.next}
        </HudButton>
      </div>
    </section>
  )
}
