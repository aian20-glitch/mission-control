import { useEffect } from 'react'
import { HudButton } from '../components/HudButton'
import { OrbitMap } from '../components/OrbitMap'
import { Readout } from '../components/Readout'
import { ScreenHeader } from '../components/ScreenHeader'
import { StatusLights } from '../components/StatusLights'
import { texts } from '../logic/data'
import { WINDOW_MONTHS, isGoodWindow, monthLabel, transferMonths, windowFactor } from '../logic/resources'
import { useMission, useMissionReport } from '../store/useMission'

const YEARS = [2027, 2028, 2029]

export function LaunchWindow() {
  const data = useMissionReport()
  const launchMonth = useMission((s) => s.launchMonth)
  const setLaunchMonth = useMission((s) => s.setLaunchMonth)
  const goTo = useMission((s) => s.goTo)

  const destination = data ? data.ctx.destination : null

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
  const tripLabel = destination.window.alwaysOpen ? destination.transfer.label : trip >= 24 ? (trip / 12).toFixed(1) + ' years' : Math.round(trip) + ' months'
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
      <ScreenHeader step="Step 4 of 6 · Launch window" title="Pick a launch date" capcom={texts.capcom.window} />

      <div className="window-layout">
        <div className="window-map panel">
          <OrbitMap destination={destination} month={month} good={good} />
        </div>

        <div className="window-side">
          <div className="panel panel-pad">
            <div className="window-date">
              <span className="eyebrow">Launch date</span>
              <span className="window-date-value mono">{monthLabel(month)}</span>
              <span className={'chip ' + (good ? 'chip-accent' : 'chip-warn')}>{good ? 'WINDOW OPEN' : 'POOR WINDOW'}</span>
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
                aria-label="Launch month"
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
              { label: 'Window', value: good ? 'OPEN' : 'POOR', status: good ? 'ok' : 'warn' },
              { label: 'Rocket lift', value: report.massCapacity.toLocaleString('en-US') + ' KG (' + Math.round(factor * 100) + '%)', status: factor < 0.9 ? 'warn' : 'ok' },
              { label: 'Spacecraft', value: report.totalMass.toLocaleString('en-US') + ' KG', status: massOk ? 'ok' : 'over' },
              { label: 'Trip time', value: tripLabel },
              { label: 'Arrival', value: destination.window.alwaysOpen ? monthLabel(month) : monthLabel(month + Math.round(trip)) },
            ]}
          />

          <div className="launch-console panel">
            <div>
              <span className="eyebrow">Go / No-go</span>
              <StatusLights bars={report.bars} />
            </div>
            <HudButton variant="launch" disabled={!report.canLaunch} onClick={() => goTo('launch')}>
              Launch
            </HudButton>
          </div>
          {blockingIssue && <p className="note note-over">{blockingIssue.text}</p>}
        </div>
      </div>

      <div className="screen-actions">
        <HudButton variant="quiet" onClick={() => goTo('assembly')}>
          Back to build
        </HudButton>
      </div>
    </section>
  )
}
