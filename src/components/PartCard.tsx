import type { Destination, Part } from '../logic/types'

interface PartCardProps {
  part: Part
  destination: Destination
  selected: boolean
  favorite: boolean
  warning: string | null
  onSelect: () => void
  onHover: (partId: string | null) => void
}

function statsFor(part: Part, destination: Destination): string[] {
  const stats: string[] = ['$' + part.cost + 'M']
  if (part.capacity) {
    stats.push('lifts ' + part.capacity[destination.id].toLocaleString('en-US') + ' kg')
    return stats
  }
  stats.push(part.mass + ' kg')
  if (part.output) {
    const here = part.powerType === 'solar' ? Math.round(part.output * destination.sunlight) : part.output
    stats.push('+' + here + ' W here')
  } else if (part.power > 0) {
    stats.push(part.power + ' W')
  }
  if (part.data !== undefined) {
    stats.push(part.data + ' GB/day')
  }
  if (part.downlink !== undefined) {
    stats.push(Math.round(part.downlink * destination.linkFactor * 10) / 10 + ' GB/day home')
  }
  return stats
}

export function PartCard({ part, destination, selected, favorite, warning, onSelect, onHover }: PartCardProps) {
  let className = 'part-card'
  if (selected) {
    className = className + ' is-selected'
  }
  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      onClick={onSelect}
      onMouseEnter={() => onHover(part.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(part.id)}
      onBlur={() => onHover(null)}
    >
      <span className="part-head">
        <span className="part-check" aria-hidden="true" />
        <span className="part-name">{part.name}</span>
        {favorite && <span className="chip chip-accent">★ fits goal</span>}
        {warning && <span className="chip chip-warn">{warning}</span>}
      </span>
      <span className="part-short">{part.short}</span>
      <span className="part-stats mono">
        {statsFor(part, destination).map((s) => (
          <span key={s}>{s}</span>
        ))}
      </span>
      <span className="part-explain">
        <span>
          {part.explain}
          {part.similarTo && <em className="part-similar"> {part.similarTo}. Approx. values.</em>}
        </span>
      </span>
    </button>
  )
}
