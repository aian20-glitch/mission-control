import type { ReactNode } from 'react'
import { fill, texts } from '../logic/data'
import { Capcom } from './Capcom'

type StepKey = keyof typeof texts.ui.steps

// "Step 2 of 6 · Orbit"
export function stepLabel(n: number, step: StepKey): string {
  return fill(texts.ui.stepOf, { n, name: texts.ui.steps[step] })
}

interface ScreenHeaderProps {
  step: string
  title: string
  capcom?: string
  right?: ReactNode
}

export function ScreenHeader({ step, title, capcom, right }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <div className="screen-title">
        <span className="eyebrow">{step}</span>
        <h2>{title}</h2>
      </div>
      {capcom && <Capcom text={capcom} />}
      {right && <div className="screen-header-right">{right}</div>}
    </header>
  )
}
