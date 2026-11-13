import { SCREEN_ORDER, type Screen } from '../store/useMission'

const STEPS: { screen: Screen; name: string }[] = [
  { screen: 'objective', name: 'Target' },
  { screen: 'orbit', name: 'Orbit' },
  { screen: 'assembly', name: 'Build' },
  { screen: 'window', name: 'Window' },
  { screen: 'launch', name: 'Launch' },
  { screen: 'mission', name: 'Mission' },
  { screen: 'debrief', name: 'Debrief' },
]

export function StepBar({ current }: { current: Screen }) {
  const currentIndex = SCREEN_ORDER.indexOf(current)
  return (
    <nav className="stepbar" aria-label="Mission steps">
      {STEPS.map((step, i) => {
        const index = SCREEN_ORDER.indexOf(step.screen)
        let className = 'step'
        if (index === currentIndex) {
          className = className + ' step-current'
        } else if (index < currentIndex) {
          className = className + ' step-done'
        }
        return (
          <span key={step.screen} style={{ display: 'contents' }}>
            {i > 0 && <span className="step-line" />}
            <span className={className} aria-current={index === currentIndex ? 'step' : undefined}>
              <span className="step-dot" />
              <span className="step-name">{step.name}</span>
            </span>
          </span>
        )
      })}
    </nav>
  )
}
