import { HudButton } from '../components/HudButton'
import { PlanetOrb } from '../components/PlanetOrb'
import { Readout } from '../components/Readout'
import { partsData, planetsData, texts } from '../logic/data'
import { useMission } from '../store/useMission'

export function Title() {
  const startGame = useMission((s) => s.startGame)
  const t = texts.ui.title

  return (
    <section className="screen title-screen">
      <div className="porthole">
        <div className="porthole-frame" aria-hidden="true" />
        <PlanetOrb look={planetsData.earth.look} size={420} seed={11} spinSeconds={180} />
      </div>
      <div className="title-copy">
        <span className="eyebrow">
          {texts.game.station} · {t.online}
        </span>
        <h1 className="title-name">{texts.game.title}</h1>
        <p className="title-lead">{texts.game.tagline}</p>
        <div className="title-actions">
          <HudButton onClick={() => startGame(false)}>{t.start}</HudButton>
          <HudButton variant="ghost" onClick={() => startGame(true)}>
            {t.sandbox}
          </HudButton>
          <HudButton variant="quiet" disabled title={t.soon}>
            {t.team}
          </HudButton>
        </div>
        <Readout
          rows={[
            { label: t.targets, value: planetsData.destinations.map((d) => d.name).join(' · ') },
            { label: t.parts, value: String(partsData.parts.length) },
            { label: t.resources, value: '6' },
            { label: t.oneMission, value: t.duration },
          ]}
        />
      </div>
    </section>
  )
}
