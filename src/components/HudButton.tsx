import type { ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'quiet' | 'launch'

interface HudButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  small?: boolean
  disabled?: boolean
  title?: string
}

export function HudButton({ children, onClick, variant = 'primary', small = false, disabled = false, title }: HudButtonProps) {
  const className = 'btn btn-' + variant + (small ? ' btn-sm' : '')
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}
