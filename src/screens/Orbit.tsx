import { HudButton } from '../components/HudButton'
import { OrbitDiagram } from '../components/OrbitDiagram'
import { ScreenHeader } from '../components/ScreenHeader'
import { getDestination, getPart, texts } from '../logic/data'
import { formatLifetime } from '../logic/resources'
import { useMission } from '../store/useMission'

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

export function Orbit() {
  const destinationId = useMission((s) => s.destinationId)
  const orbitId = useMission((s) => s.orbitId)
  const chooseOrbit = useMission((s) => s.chooseOrbit)
  const goTo = useMission((s) => s.goTo)

  if (!destinationId) {
    return null
  }
  const destination = getDestination(destinationId)

  return (
    <section className="screen">
      <ScreenHeader step="Step 2 of 6 · Orbit" title={'How do we meet ' + destination.name + '?'} capcom={texts.capcom.orbit} />

      <div className="orbit-grid" role="radiogroup" aria-label="Orbit type">
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
            >
              <OrbitDiagram orbitId={orbit.id} destination={destination} active={selected} />
              <span className="orbit-name">{orbit.name}</span>
              <span className="orbit-summary">{orbit.summary}</span>
              <span className="orbit-stats">
                <Meter label="Science" share={orbit.scienceMult / 1.5} display={'×' + orbit.scienceMult} />
                <Meter label="Lifetime" share={orbit.lifetimeMonths / 48} display={formatLifetime(orbit.lifetimeMonths)} />
                <Meter label="Braking fuel" share={(orbit.propellantFactor - 1) / 2.2} display={'+' + Math.round((orbit.propellantFactor - 1) * 100) + '% mass'} />
                <Meter label="Link home" share={orbit.commsFactor} display={orbit.commsFactor >= 1 ? 'good' : 'weak'} />
              </span>
              {orbit.requires && (
                <span className="chip chip-warn">Needs: {orbit.requires.map((id) => getPart(id).name).join(', ')}</span>
              )}
              <span className="orbit-explain">{orbit.explain}</span>
            </button>
          )
        })}
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={() => goTo('objective')}>
          Back
        </HudButton>
        <HudButton disabled={!orbitId} onClick={() => goTo('assembly')}>
          Build the spacecraft
        </HudButton>
      </div>
    </section>
  )
}
