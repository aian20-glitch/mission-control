import type { ReactNode } from 'react'
import { Capcom } from './Capcom'

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
        {capcom && <Capcom text={capcom} />}
      </div>
      {right}
    </header>
  )
}
