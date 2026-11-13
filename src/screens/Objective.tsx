import { useState } from 'react'
import { HudButton } from '../components/HudButton'
import { Onboarding } from '../components/Onboarding'
import { PlanetOrb } from '../components/PlanetOrb'
import { Readout } from '../components/Readout'
import { ScreenHeader } from '../components/ScreenHeader'
import { getDestination, planetsData, texts } from '../logic/data'
import type { DestinationId } from '../logic/types'
import { useMission } from '../store/useMission'

export function Objective() {
  const destinationId = useMission((s) => s.destinationId)
  const chooseDestination = useMission((s) => s.chooseDestination)
  const goTo = useMission((s) => s.goTo)
  const sandbox = useMission((s) => s.sandbox)
  const onboardingSeen = useMission((s) => s.onboardingSeen)
  const finishOnboarding = useMission((s) => s.finishOnboarding)
  const [hovered, setHovered] = useState<DestinationId | null>(null)

  const shown = getDestination(hovered ?? destinationId ?? 'mars')

  return (
    <section className="screen">
      <ScreenHeader
        step="Step 1 of 6 · Target"
        title="Choose a target"
        capcom={texts.capcom.objective}
        right={sandbox ? <span className="chip chip-warn">SANDBOX · NO BUDGET LIMIT</span> : undefined}
      />

      <div className="objective-layout">
        <div className="objective-stage panel">
          <div className="stage-orb" key={shown.id}>
            <PlanetOrb look={shown.look} size={300} seed={shown.id.length * 3} />
          </div>
          <div className="stage-info">
            <span className="eyebrow">{shown.subtitle}</span>
            <h3 className="stage-name">{shown.name}</h3>
            <p className="stage-goal">{shown.objective.title}</p>
            <p className="dim">{shown.objective.explain}</p>
            <Readout
              rows={[
                { label: 'Budget', value: '$' + shown.budget + 'M' },
                { label: 'Distance', value: shown.distance },
                { label: 'Signal delay', value: shown.signalDelay },
                { label: 'Sunlight', value: Math.round(shown.sunlight * 1000) / 10 + '% of Earth' },
                { label: 'Trip', value: shown.transfer.label },
              ]}
            />
            <p className="fact">
              <span className="eyebrow">Did you know</span>
              {shown.fact}
            </p>
          </div>
        </div>

        <div className="target-list" role="radiogroup" aria-label="Targets">
          {planetsData.destinations.map((d) => {
            const selected = d.id === destinationId
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={'target-card' + (selected ? ' is-selected' : '')}
                onClick={() => chooseDestination(d.id)}
                onMouseEnter={() => setHovered(d.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <PlanetOrb look={d.look} size={64} seed={d.id.length * 3} spinSeconds={60} />
                <span className="target-text">
                  <span className="target-row">
                    <span className="target-name">{d.name}</span>
                    <span className={'chip' + (d.difficulty === 'Hard' ? ' chip-danger' : d.difficulty === 'Tutorial' ? ' chip-accent' : '')}>
                      {d.difficulty}
                    </span>
                  </span>
                  <span className="target-goal">{d.objective.title}</span>
                  <span className="target-meta mono">
                    ${d.budget}M · {d.transfer.label}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={() => goTo('title')}>
          Back
        </HudButton>
        <HudButton disabled={!destinationId} onClick={() => goTo('orbit')}>
          Continue
        </HudButton>
      </div>

      {!onboardingSeen && <Onboarding onClose={finishOnboarding} />}
    </section>
  )
}
