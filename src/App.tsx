import { useEffect, useState } from 'react'
import { StepBar } from './components/StepBar'
import { Starfield } from './components/Starfield'
import { texts } from './logic/data'
import { Assembly } from './screens/Assembly'
import { Debrief } from './screens/Debrief'
import { Launch } from './screens/Launch'
import { LaunchWindow } from './screens/LaunchWindow'
import { Mission } from './screens/Mission'
import { Objective } from './screens/Objective'
import { Orbit } from './screens/Orbit'
import { Title } from './screens/Title'
import { useMission, type Screen } from './store/useMission'

const CALLSIGNS = ['CAPCOM', 'FLIGHT', 'FIDO', 'GUIDO', 'EECOM', 'INCO']

function renderScreen(screen: Screen) {
  switch (screen) {
    case 'title':
      return <Title />
    case 'objective':
      return <Objective />
    case 'orbit':
      return <Orbit />
    case 'assembly':
      return <Assembly />
    case 'window':
      return <LaunchWindow />
    case 'launch':
      return <Launch />
    case 'mission':
      return <Mission />
    case 'debrief':
      return <Debrief />
  }
}

// Mission elapsed time since the page opened: a small station-clock detail.
function useElapsed(): string {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return h + ':' + m + ':' + s
}

export function App() {
  const screen = useMission((s) => s.screen)
  const sandbox = useMission((s) => s.sandbox)
  const goTo = useMission((s) => s.goTo)
  const elapsed = useElapsed()
  const cinematic = screen === 'launch'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  return (
    <div className="app">
      <Starfield />
      <div className="app-vignette" />

      {!cinematic && (
        <header className="header">
          <button type="button" className="brand" onClick={() => goTo('title')} aria-label="Back to title">
            <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="17" fill="none" stroke="#5DCAA5" strokeWidth="3" />
              <ellipse cx="32" cy="32" rx="26" ry="9" fill="none" stroke="#5DCAA5" strokeWidth="2" opacity=".6" transform="rotate(-25 32 32)" />
              <circle cx="52" cy="22" r="3.5" fill="#E24B4A" />
            </svg>
            <span>{texts.game.title}</span>
            <span className="brand-station">DSS-07</span>
          </button>
          {screen !== 'title' ? <StepBar current={screen} /> : <span />}
          <div className="header-right">
            {sandbox && screen !== 'title' && <span className="chip chip-warn">SANDBOX</span>}
            <span className="chip">APPROX. VALUES</span>
          </div>
        </header>
      )}

      <main className="main" key={screen}>
        {renderScreen(screen)}
      </main>

      {!cinematic && (
        <footer className="footer">
          <span className="callsigns">
            {CALLSIGNS.map((c, i) => (
              <span key={c} className={i === 0 ? 'callsign-active' : undefined}>
                {c}
              </span>
            ))}
          </span>
          <span>MET {elapsed}</span>
        </footer>
      )}
    </div>
  )
}
