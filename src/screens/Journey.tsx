import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { HudButton } from '../components/HudButton'
import { Onboarding } from '../components/Onboarding'
import { Readout } from '../components/Readout'
import { stepLabel } from '../components/ScreenHeader'
import { fill, money, partsData, planetsData, texts } from '../logic/data'
import { useMission } from '../store/useMission'
import { stageView } from '../three/stageView'

// How long the camera takes to fly from one world to the next, in seconds.
const FLIGHT_SECONDS = 1.7
// After a flight starts, scrolling is ignored for this long, so one swipe moves one world.
const SCROLL_LOCK_MS = 1100

// The title screen and the target screen in one: the player scrolls away from the Earth,
// past the Moon, Mars and Europa, and picks one of them. The 3D picture is the SpaceStage behind.
export function Journey() {
  const screen = useMission((s) => s.screen)
  const destinationId = useMission((s) => s.destinationId)
  const sandbox = useMission((s) => s.sandbox)
  const onboardingSeen = useMission((s) => s.onboardingSeen)
  const startGame = useMission((s) => s.startGame)
  const goTo = useMission((s) => s.goTo)
  const chooseDestination = useMission((s) => s.chooseDestination)
  const finishOnboarding = useMission((s) => s.finishOnboarding)

  const destinations = planetsData.destinations
  const lastStop = destinations.length

  // Stop 0 is the Earth (title). Stops 1..3 are the targets, in the order of the data file.
  function startStop(): number {
    if (screen === 'title') {
      return 0
    }
    const index = destinations.findIndex((d) => d.id === destinationId)
    return index >= 0 ? index + 1 : 1
  }

  const [stop, setStop] = useState(startStop)
  const [briefOpen, setBriefOpen] = useState(false)
  const stopRef = useRef(stop)
  const lockUntil = useRef(0)
  const flight = useRef<gsap.core.Tween | null>(null)

  function fly(next: number) {
    const target = Math.min(lastStop, Math.max(0, next))
    if (target === stopRef.current) {
      return
    }
    const steps = Math.abs(target - stopRef.current)
    stopRef.current = target
    setStop(target)
    setBriefOpen(false)
    lockUntil.current = performance.now() + SCROLL_LOCK_MS
    flight.current?.kill()
    flight.current = gsap.to(stageView, { progress: target, duration: FLIGHT_SECONDS + (steps - 1) * 0.5, ease: 'power2.inOut' })

    // Leaving the Earth starts a game; coming back to it returns to the title.
    const current = useMission.getState().screen
    if (target === 0 && current !== 'title') {
      goTo('title')
    }
    if (target > 0 && current === 'title') {
      startGame(false)
    }
  }

  function begin(asSandbox: boolean) {
    startGame(asSandbox)
    fly(1)
  }

  // On arrival: put the camera where this screen starts.
  useEffect(() => {
    stageView.mode = 'journey'
    stageView.orbitId = null
    flight.current?.kill()
    flight.current = gsap.to(stageView, { progress: stopRef.current, duration: 0.9, ease: 'power2.out' })
    return () => {
      flight.current?.kill()
    }
  }, [])

  // The header logo sends the player back to the title: fly home too.
  useEffect(() => {
    if (screen === 'title' && stopRef.current !== 0) {
      fly(0)
    }
    // Only when the screen changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  // Scroll wheel, arrow keys, and clicks on the planets in the 3D picture.
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      if (performance.now() < lockUntil.current || Math.abs(event.deltaY) < 12) {
        return
      }
      fly(stopRef.current + (event.deltaY > 0 ? 1 : -1))
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        fly(stopRef.current + 1)
      }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        fly(stopRef.current - 1)
      }
      if (event.key === 'Escape') {
        setBriefOpen(false)
      }
    }
    stageView.onPick = (picked) => {
      if (picked === stopRef.current && picked > 0) {
        setBriefOpen(true)
      } else {
        fly(picked)
      }
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      stageView.onPick = null
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
    // The handlers read the current stop from a ref, so they never go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = texts.ui.journey
  const destination = stop > 0 ? destinations[stop - 1] : null
  const stopNames = [t.earth, ...destinations.map((d) => d.name)]

  function choose() {
    if (!destination) {
      return
    }
    chooseDestination(destination.id)
    goTo('orbit')
  }

  return (
    <section className="journey">
      {destination === null && (
        <div className="journey-panel journey-hero" key="hero">
          <span className="eyebrow">
            {texts.game.station} · {texts.ui.title.online}
          </span>
          <h1 className="journey-title">{texts.game.title}</h1>
          <p className="journey-lead">{texts.game.tagline}</p>
          <div className="journey-actions">
            <HudButton onClick={() => begin(false)}>{texts.ui.title.start}</HudButton>
            <HudButton variant="ghost" onClick={() => begin(true)}>
              {texts.ui.title.sandbox}
            </HudButton>
            <HudButton variant="quiet" disabled title={texts.ui.title.soon}>
              {texts.ui.title.team}
            </HudButton>
          </div>
          {/* The game in four numbers */}
          <dl className="journey-stats">
            <div className="journey-stat">
              <dt>{texts.ui.title.targets}</dt>
              <dd>{String(destinations.length).padStart(2, '0')}</dd>
              <span className="journey-stat-note">{destinations.map((d) => d.name).join(' · ')}</span>
            </div>
            <div className="journey-stat">
              <dt>{texts.ui.title.parts}</dt>
              <dd>{String(partsData.parts.length).padStart(2, '0')}</dd>
            </div>
            <div className="journey-stat">
              <dt>{texts.ui.title.resources}</dt>
              <dd>06</dd>
            </div>
            <div className="journey-stat">
              <dt>{texts.ui.title.oneMission}</dt>
              <dd>{texts.ui.title.duration}</dd>
            </div>
          </dl>
        </div>
      )}

      {destination !== null && (
        <div className="journey-panel" key={destination.id}>
          <span className="eyebrow">
            {stepLabel(1, 'objective')} · {String(stop).padStart(2, '0')} / {String(lastStop).padStart(2, '0')}
          </span>
          <div className="journey-heading">
            <h2 className="journey-name">{destination.name}</h2>
            <span className={'chip' + (destination.difficulty === 'Hard' ? ' chip-danger' : destination.difficulty === 'Tutorial' ? ' chip-accent' : '')}>
              {texts.ui.difficulty[destination.difficulty]}
            </span>
            {sandbox && <span className="chip chip-warn">{texts.ui.sandbox}</span>}
          </div>
          <span className="journey-subtitle">{destination.subtitle}</span>
          <p className="journey-goal">{destination.objective.title}</p>

          {!briefOpen && (
            <>
              <p className="journey-text">{destination.objective.explain}</p>
              <div className="journey-actions">
                <HudButton onClick={() => setBriefOpen(true)}>{t.openBrief}</HudButton>
              </div>
              <p className="journey-hint">{t.clickHint}</p>
            </>
          )}

          {briefOpen && (
            <div className="journey-brief">
              <Readout
                rows={[
                  { label: texts.ui.objective.budget, value: money(destination.budget) },
                  { label: texts.ui.objective.distance, value: destination.distance },
                  { label: texts.ui.objective.signalDelay, value: destination.signalDelay },
                  {
                    label: texts.ui.objective.sunlight,
                    value: fill(texts.ui.objective.sunlightValue, { n: (Math.round(destination.sunlight * 1000) / 10).toLocaleString(texts.units.locale) }),
                  },
                  { label: texts.ui.objective.trip, value: destination.transfer.label },
                ]}
              />
              <p className="fact">
                <span className="eyebrow">{texts.ui.objective.fact}</span>
                {destination.fact}
              </p>
              <div className="journey-actions">
                <HudButton onClick={choose}>{fill(t.choose, { name: destination.name })}</HudButton>
                <HudButton variant="quiet" onClick={() => setBriefOpen(false)}>
                  {t.closeBrief}
                </HudButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The worlds on the way, as a column of dots on the right edge */}
      <nav className="journey-stops" aria-label={t.stops}>
        {stopNames.map((name, i) => (
          <button key={name} type="button" className={'journey-stop' + (i === stop ? ' is-current' : '')} aria-current={i === stop ? 'step' : undefined} onClick={() => fly(i)}>
            <span className="journey-stop-name">{name}</span>
            <span className="journey-stop-dot" />
          </button>
        ))}
      </nav>

      {stop === 0 && (
        <div className="journey-scroll" aria-hidden="true">
          <span className="journey-scroll-line" />
          {t.scroll}
        </div>
      )}

      {stop > 0 && (
        <div className="journey-steps">
          <HudButton variant="quiet" small onClick={() => fly(stop - 1)}>
            {t.previous}
          </HudButton>
          <HudButton variant="quiet" small disabled={stop >= lastStop} onClick={() => fly(stop + 1)}>
            {t.next}
          </HudButton>
        </div>
      )}

      {stop > 0 && !onboardingSeen && <Onboarding onClose={finishOnboarding} />}
    </section>
  )
}
