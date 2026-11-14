import { useState } from 'react'
import { money, num, texts } from '../logic/data'
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

interface Stat {
  label: string
  value: string
  tone?: 'plus' | 'minus'
}

// The numbers that matter when choosing: cost, mass, power, data, link home.
// Power: "+" (green) = the part makes electricity here, "−" (amber) = the part uses it.
function statsFor(part: Part, destination: Destination): Stat[] {
  const t = texts.ui.assembly
  const u = texts.units
  const stats: Stat[] = [{ label: t.statCost, value: money(part.cost) }]
  if (part.capacity) {
    stats.push({ label: t.statLifts, value: num(part.capacity[destination.id]) + ' ' + u.kg })
    return stats
  }
  stats.push({ label: t.statMass, value: num(part.mass) + ' ' + u.kg })
  if (part.output) {
    const here = part.powerType === 'solar' ? Math.round(part.output * destination.sunlight) : part.output
    stats.push({ label: t.statPower, value: '+' + here + ' ' + u.watt, tone: 'plus' })
  } else if (part.power > 0) {
    stats.push({ label: t.statPower, value: '−' + part.power + ' ' + u.watt, tone: 'minus' })
  }
  if (part.data !== undefined) {
    stats.push({ label: t.statData, value: part.data.toLocaleString(u.locale) + ' ' + u.gbDay })
  }
  if (part.downlink !== undefined) {
    stats.push({ label: t.statLink, value: decimal(part.downlink * destination.linkFactor) + ' ' + u.gbDay })
  }
  return stats
}

// One part in the catalog. The numbers are big; the long explanation hides behind the "i" button.
export function PartCard({ part, destination, selected, favorite, warning, onSelect, onHover }: PartCardProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const t = texts.ui.assembly

  let className = 'part-card'
  if (selected) {
    className = className + ' is-selected'
  }
  if (infoOpen) {
    className = className + ' is-info-open'
  }

  return (
    <div className={className} onMouseEnter={() => onHover(part.id)} onMouseLeave={() => onHover(null)}>
      <button
        type="button"
        className="part-select"
        aria-pressed={selected}
        onClick={onSelect}
        onFocus={() => onHover(part.id)}
        onBlur={() => onHover(null)}
      >
        <span className="part-head">
          <span className="part-check" aria-hidden="true" />
          <span className="part-name">{part.name}</span>
          {favorite && <span className="chip chip-accent">{t.fitsGoal}</span>}
          {warning && <span className="chip chip-warn">{warning}</span>}
        </span>
        <span className="part-stats">
          {statsFor(part, destination).map((stat) => (
            <span key={stat.label} className={'part-stat' + (stat.tone ? ' is-' + stat.tone : '')}>
              <span className="part-stat-label">{stat.label}</span>
              <span className="part-stat-value mono">{stat.value}</span>
            </span>
          ))}
        </span>
        <span className="part-short">{part.short}</span>
      </button>

      <button
        type="button"
        className="part-info-btn"
        aria-expanded={infoOpen}
        aria-label={t.info}
        title={t.info}
        onClick={() => setInfoOpen(!infoOpen)}
      >
        i
      </button>

      <div className="part-explain" aria-hidden={!infoOpen}>
        <p>
          {part.explain}
          {part.similarTo && (
            <em className="part-similar">
              {' '}
              {part.similarTo}. {t.approx}
            </em>
          )}
        </p>
      </div>
    </div>
  )
}
