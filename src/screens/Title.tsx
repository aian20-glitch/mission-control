import { HudButton } from '../components/HudButton'
import { PlanetOrb } from '../components/PlanetOrb'
import { Readout } from '../components/Readout'
import { partsData, planetsData, texts } from '../logic/data'
import { useMission } from '../store/useMission'

export function Title() {
  const startGame = useMission((s) => s.startGame)

  return (
    <section className="screen title-screen">
      <div className="porthole">
        <div className="porthole-frame" aria-hidden="true" />
        <PlanetOrb look={planetsData.earth.look} size={420} seed={11} spinSeconds={180} />
      </div>
      <div className="title-copy">
        <span className="eyebrow">{texts.game.station} · systems online</span>
        <h1 className="title-name">{texts.game.title}</h1>
        <p className="title-lead">{texts.game.tagline}</p>
        <div className="title-actions">
          <HudButton onClick={() => startGame(false)}>Start mission</HudButton>
          <HudButton variant="ghost" onClick={() => startGame(true)}>
            Sandbox
          </HudButton>
          <HudButton variant="quiet" disabled title="Coming soon">
            Team mode · soon
          </HudButton>
        </div>
        <Readout
          rows={[
            { label: 'Targets', value: planetsData.destinations.map((d) => d.name).join(' · ') },
            { label: 'Parts', value: String(partsData.parts.length) },
            { label: 'Resources', value: '6' },
            { label: 'One mission', value: '~5 MIN' },
          ]}
        />
      </div>
    </section>
  )
}
