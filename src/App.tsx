import { useEffect, useState } from 'react'
import { SpaceStage } from './components/SpaceStage'
import { StepBar } from './components/StepBar'
import { Starfield } from './components/Starfield'
import { LANGUAGES, texts } from './logic/data'
import { Assembly } from './screens/Assembly'
import { Debrief } from './screens/Debrief'
import { Journey } from './screens/Journey'
import { Launch } from './screens/Launch'
import { LaunchWindow } from './screens/LaunchWindow'
import { Mission } from './screens/Mission'
import { Orbit } from './screens/Orbit'
import { useMission, type Screen } from './store/useMission'

const CALLSIGNS = ['CAPCOM', 'FLIGHT', 'FIDO', 'GUIDO', 'EECOM', 'INCO']

function renderScreen(screen: Screen) {
  switch (screen) {
    case 'title':
    case 'objective':
      // One screen for both: the trip from the Earth to the target.
      return <Journey />
    case 'orbit':
      return <Orbit />
    case 'assembly':
      return <Assembly />
    case 'window':
      return <LaunchWindow />
    case 'launch':
      // The launch film lives in its own layer (see App), so it can fade over the mission screen.
      return null
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

// EN / RU switch. Locked once the spacecraft has launched: the log and report are already written.
function LanguageSwitch({ locked }: { locked: boolean }) {
  const lang = useMission((s) => s.lang)
  const setLang = useMission((s) => s.setLang)
  return (
    <div className="lang-switch" role="group" aria-label={texts.ui.language} title={locked ? texts.ui.languageLocked : undefined}>
      {LANGUAGES.map((item) => (
        <button
          key={item.id}
          type="button"
          className={'lang-option' + (item.id === lang ? ' is-active' : '')}
          aria-pressed={item.id === lang}
          disabled={locked}
          onClick={() => setLang(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function App() {
  const screen = useMission((s) => s.screen)
  const sandbox = useMission((s) => s.sandbox)
  const goTo = useMission((s) => s.goTo)
  // Read here so the whole shell re-renders when the language changes.
  const lang = useMission((s) => s.lang)
  const elapsed = useElapsed()
  const cinematic = screen === 'launch'
  // The launch film stays on screen a little after the mission starts, while it fades out.
  const [launchFading, setLaunchFading] = useState(false)
  useEffect(() => {
    if (screen === 'launch') {
      setLaunchFading(true)
    }
  }, [screen])
  const showLaunch = screen === 'launch' || (launchFading && screen === 'mission')
  const languageLocked = screen === 'mission' || screen === 'debrief'
  // The first screens share one 3D picture behind them.
  const onStage = screen === 'title' || screen === 'objective' || screen === 'orbit'
  // The title and target screens are one component: it must not restart when the screen name changes.
  const screenKey = screen === 'title' || screen === 'objective' ? 'journey' : screen

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  return (
    <div className="app">
      <Starfield />
      <div className="app-vignette" />
      {onStage && <SpaceStage />}

      {!cinematic && (
        <header className="header">
          <button type="button" className="brand" onClick={() => goTo('title')} aria-label={texts.ui.backToTitle}>
            <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="17" fill="none" stroke="#5DCAA5" strokeWidth="3" />
              <ellipse cx="32" cy="32" rx="26" ry="9" fill="none" stroke="#5DCAA5" strokeWidth="2" opacity=".6" transform="rotate(-25 32 32)" />
              <circle cx="52" cy="22" r="3.5" fill="#E24B4A" />
            </svg>
            <span translate="no">{texts.game.title}</span>
            <span className="brand-station" translate="no">
              DSS-07
            </span>
          </button>
          {screen !== 'title' ? <StepBar current={screen} /> : <span />}
          <div className="header-right">
            {sandbox && screen !== 'title' && <span className="chip chip-warn">{texts.ui.sandbox}</span>}
            <span className="chip chip-approx">{texts.ui.approx}</span>
            <LanguageSwitch locked={languageLocked} />
          </div>
        </header>
      )}

      <main className={'main' + (onStage ? ' main-on-stage' : '')} key={screenKey + '-' + lang}>
        {renderScreen(screen)}
      </main>

      {showLaunch && <Launch onGone={() => setLaunchFading(false)} />}

      {!cinematic && (
        <footer className="footer">
          <span className="callsigns" translate="no">
            {CALLSIGNS.map((c, i) => (
              <span key={c} className={i === 0 ? 'callsign-active' : undefined}>
                {c}
              </span>
            ))}
          </span>
          <span>
            {texts.ui.met} {elapsed}
          </span>
        </footer>
      )}
    </div>
  )
}
