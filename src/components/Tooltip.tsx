import type { ReactNode } from 'react'

interface TooltipProps {
  text: string
  children: ReactNode
  below?: boolean
}

// Hover/focus bubble with a short explanation.
export function Tooltip({ text, children, below = false }: TooltipProps) {
  return (
    <span className={'tip' + (below ? ' tip-bottom' : '')}>
      {children}
      <span className="tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}
