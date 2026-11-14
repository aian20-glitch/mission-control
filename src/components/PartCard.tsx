import { fill, money, num, texts } from '../logic/data'
import { decimal } from '../logic/resources'
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
  const t = texts.ui.assembly
  const u = texts.units
  const stats: string[] = [money(part.cost)]
  if (part.capacity) {
    stats.push(fill(t.lifts, { n: num(part.capacity[destination.id]) }))
    return stats
  }
  stats.push(num(part.mass) + ' ' + u.kg)
  if (part.output) {
    const here = part.powerType === 'solar' ? Math.round(part.output * destination.sunlight) : part.output
    stats.push(fill(t.powerHere, { n: here }))
  } else if (part.power > 0) {
    stats.push(part.power + ' ' + u.watt)
  }
  if (part.data !== undefined) {
    stats.push(part.data.toLocaleString(u.locale) + ' ' + u.gbDay)
  }
  if (part.downlink !== undefined) {
    stats.push(fill(t.home, { n: decimal(part.downlink * destination.linkFactor) }))
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
        {favorite && <span className="chip chip-accent">{texts.ui.assembly.fitsGoal}</span>}
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
          {part.similarTo && (
            <em className="part-similar">
              {' '}
              {part.similarTo}. {texts.ui.assembly.approx}
            </em>
          )}
        </span>
      </span>
    </button>
  )
}
