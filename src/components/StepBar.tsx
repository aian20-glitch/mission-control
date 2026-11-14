import { texts } from '../logic/data'
import { SCREEN_ORDER, type Screen } from '../store/useMission'

const STEPS: Exclude<Screen, 'title'>[] = ['objective', 'orbit', 'assembly', 'window', 'launch', 'mission', 'debrief']

export function StepBar({ current }: { current: Screen }) {
  const currentIndex = SCREEN_ORDER.indexOf(current)
  return (
    <nav className="stepbar" aria-label={texts.ui.steps.label}>
      {STEPS.map((step, i) => {
        const index = SCREEN_ORDER.indexOf(step)
        let className = 'step'
        if (index === currentIndex) {
          className = className + ' step-current'
        } else if (index < currentIndex) {
          className = className + ' step-done'
        }
        return (
          <span key={step} style={{ display: 'contents' }}>
            {i > 0 && <span className="step-line" />}
            <span className={className} aria-current={index === currentIndex ? 'step' : undefined}>
              <span className="step-dot" />
              <span className="step-name">{texts.ui.steps[step]}</span>
            </span>
          </span>
        )
      })}
    </nav>
  )
}
