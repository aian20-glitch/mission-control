import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  text: string
  children: ReactNode
  below?: boolean
}

interface Position {
  left: number
  top: number
}

const GAP = 10
const EDGE = 8

// Hover/focus bubble with a short explanation.
// The bubble is drawn on top of the whole page (a portal), so a panel that scrolls
// or hides overflow can never cut it. It also stays inside the window.
export function Tooltip({ text, children, below = false }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const anchor = anchorRef.current
    const bubble = bubbleRef.current
    if (!anchor || !bubble) {
      return
    }
    const a = anchor.getBoundingClientRect()
    const b = bubble.getBoundingClientRect()
    let left = a.left + a.width / 2 - b.width / 2
    left = Math.max(EDGE, Math.min(window.innerWidth - b.width - EDGE, left))
    const above = a.top - b.height - GAP
    const under = a.bottom + GAP
    let top = below ? under : above
    if (!below && above < EDGE) {
      top = under
    }
    if (below && under + b.height > window.innerHeight - EDGE) {
      top = above
    }
    setPosition({ left, top })
  }, [open, below, text])

  return (
    <span
      className="tip"
      ref={anchorRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            id={id}
            role="tooltip"
            className={'tip-bubble' + (position ? ' is-open' : '')}
            style={position ? { left: position.left, top: position.top } : undefined}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
