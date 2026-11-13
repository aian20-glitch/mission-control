import { useTypewriter } from './useTypewriter'

interface CapcomProps {
  text: string
  callsign?: string
}

// One line from Mission Control, typed out like a teletype.
export function Capcom({ text, callsign = 'CAPCOM' }: CapcomProps) {
  const { shown, done } = useTypewriter(text)
  return (
    <div className="capcom" aria-live="polite">
      <span className="capcom-sign">{callsign}</span>
      <span className="capcom-text">
        {shown}
        {!done && <span className="cursor" />}
      </span>
    </div>
  )
}
