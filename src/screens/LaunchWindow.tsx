import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { HudButton } from '../components/HudButton'
import { OrbitMap } from '../components/OrbitMap'
import { Readout } from '../components/Readout'
import { SceneBoundary } from '../components/SceneBoundary'
import { ScreenHeader, stepLabel } from '../components/ScreenHeader'
import { StatusLights } from '../components/StatusLights'
import { num, texts } from '../logic/data'
import { WINDOW_MONTHS, formatTrip, isGoodWindow, monthLabel, transferMonths, windowFactor } from '../logic/resources'
import { useMission, useMissionReport } from '../store/useMission'
import { loadCraftScene, loadLaunchScene, warmRocketModel } from '../three/preload'

const CraftScene = lazy(loadCraftScene)

// How long the 3D spacecraft takes to shrink onto the map, in seconds.
const ARRIVE_SECONDS = 1.7

const YEARS = [2027, 2028, 2029]

export function LaunchWindow() {
  const data = useMissionReport()
  const launchMonth = useMission((s) => s.launchMonth)
  const setLaunchMonth = useMission((s) => s.setLaunchMonth)
  const goTo = useMission((s) => s.goTo)
  const design = useMission((s) => s.design)
  // The screen opens with the 3D spacecraft from the build screen. It pulls away, gets small
  // and lands on the Earth of the flat map: from here on the spacecraft is a dot on a drawing.
  const [arriving, setArriving] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)
  const craftRef = useRef<HTMLDivElement>(null)

  const destination = data ? data.ctx.destination : null

  useEffect(() => {
    const map = mapRef.current
    const craft = craftRef.current
    if (!map || !craft) {
      setArriving(false)
      return
    }
    // Where the Earth is drawn on the map, measured from the middle of the panel.
    const earth = map.querySelector('.map-earth')
    const box = map.getBoundingClientRect()
    let x = 0
    let y = 0
    if (earth) {
      const spot = earth.getBoundingClientRect()
      x = spot.left + spot.width / 2 - (box.left + box.width / 2)
      y = spot.top + spot.height / 2 - (box.top + box.height / 2)
    }
    const timeline = gsap.timeline({ onComplete: () => setArriving(false) })
    timeline.to(craft, { scale: 0.04, x, y, duration: ARRIVE_SECONDS, ease: 'power2.inOut' }, 0.35)
    timeline.to(craft, { opacity: 0, duration: 0.35, ease: 'power1.in' }, 0.35 + ARRIVE_SECONDS - 0.35)
    return () => {
      timeline.kill()
    }
  }, [])

  // Download the 3D launch film in the background while the player picks a date.
  useEffect(() => {
    void loadLaunchScene()
    if (data) {
      warmRocketModel(data.ctx.launchVehicle.id)
    }
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start the slider away from the best window, so the player has to find it.
  useEffect(() => {
    if (destination && launchMonth === null) {
      const w = destination.window
      const start = w.alwaysOpen ? 0 : (w.bestMonth + Math.round(w.periodMonths / 2)) % WINDOW_MONTHS
      setLaunchMonth(start)
    }
  }, [destination, launchMonth, setLaunchMonth])

  if (!data || !destination) {
    return null
  }
  const { report } = data
  const month = launchMonth ?? 0
  const good = isGoodWindow(destination, month)
  const factor = windowFactor(destination, month)
  const trip = transferMonths(destination, month)
  const tripLabel = destination.window.alwaysOpen ? destination.transfer.label : formatTrip(trip)
  const t = texts.ui.window
  const kg = texts.units.kg.toUpperCase()
  const massOk = report.totalMass <= report.massCapacity
  const blockingIssue = report.issues.find((issue) => issue.severity === 'over' && !issue.critical)

  const cells = []
  for (let m = 0; m < WINDOW_MONTHS; m++) {
    const f = windowFactor(destination, m)
    const strength = (f - destination.window.worstFactor) / (1 - destination.window.worstFactor || 1)
    cells.push(
      <span
        key={m}
        className={'window-cell' + (isGoodWindow(destination, m) ? ' is-good' : '')}
        style={{ opacity: destination.window.alwaysOpen ? 1 : 0.25 + strength * 0.75 }}
      />,
    )
  }

  return (
    <section className="screen">
      <ScreenHeader step={stepLabel(4, 'window')} title={t.heading} capcom={texts.capcom.window} />

      <div className="window-layout">
        <div className={'window-map panel' + (arriving ? ' is-arriving' : '')} ref={mapRef}>
          <OrbitMap destination={destination} month={month} good={good} />
          {arriving && (
            <div className="window-craft" ref={craftRef} aria-hidden="true">
              <SceneBoundary>
                <Suspense fallback={null}>
                  <CraftScene design={design} orbitId={data.ctx.orbit.id} />
                </Suspense>
              </SceneBoundary>
            </div>
          )}
        </div>

        <div className="window-side">
          <div className="panel panel-pad">
            <div className="window-date">
              <span className="eyebrow">{t.date}</span>
              <span className="window-date-value mono">{monthLabel(month)}</span>
              <span className={'chip ' + (good ? 'chip-accent' : 'chip-warn')}>{good ? t.open : t.poor}</span>
            </div>
            <div className="window-slider">
              <div className="window-strip" aria-hidden="true">
                {cells}
              </div>
              <input
                type="range"
                min={0}
                max={WINDOW_MONTHS - 1}
                step={1}
                value={month}
                onChange={(e) => setLaunchMonth(Number(e.target.value))}
                aria-label={t.month}
                aria-valuetext={monthLabel(month)}
              />
              <div className="window-years mono">
                {YEARS.map((y) => (
                  <span key={y}>{y}</span>
                ))}
              </div>
            </div>
            <p className="window-note">{destination.window.note}</p>
          </div>

          <Readout
            rows={[
              { label: t.lift, value: num(report.massCapacity) + ' ' + kg + ' (' + Math.round(factor * 100) + '%)', status: factor < 0.9 ? 'warn' : 'ok' },
              { label: t.spacecraft, value: num(report.totalMass) + ' ' + kg, status: massOk ? 'ok' : 'over' },
              { label: t.trip, value: tripLabel },
              { label: t.arrival, value: destination.window.alwaysOpen ? monthLabel(month) : monthLabel(month + Math.round(trip)) },
            ]}
          />

          <div className="launch-console panel">
            <div>
              <span className="eyebrow">{t.goNoGo}</span>
              <StatusLights bars={report.bars} />
            </div>
            <HudButton variant="launch" disabled={!report.canLaunch} onClick={() => goTo('launch')}>
              {t.launch}
            </HudButton>
          </div>
        </div>
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={() => goTo('assembly')}>
          {t.back}
        </HudButton>
        <div className="screen-actions-right">
          {blockingIssue && (
            <span className="action-reason" title={blockingIssue.text}>
              {blockingIssue.text}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
