import { useEffect, useRef, useState } from 'react'
import type { ResourceBarData } from '../logic/types'
import { Tooltip } from './Tooltip'

interface ResourceBarProps {
  bar: ResourceBarData
  highlight?: boolean
}

export function ResourceBar({ bar, highlight = false }: ResourceBarProps) {
  const fill = bar.limit > 0 ? Math.min(1, bar.value / bar.limit) : 0
  const [shaking, setShaking] = useState(false)
  const previousStatus = useRef(bar.status)

  // Shake once when a bar goes over its limit.
  useEffect(() => {
    if (bar.status === 'over' && previousStatus.current !== 'over') {
      setShaking(true)
      const timer = window.setTimeout(() => setShaking(false), 450)
      previousStatus.current = bar.status
      return () => window.clearTimeout(timer)
    }
    previousStatus.current = bar.status
  }, [bar.status])

  let className = 'resource is-' + bar.status
  if (highlight) {
    className = className + ' is-highlight'
  }
  if (shaking) {
    className = className + ' is-shaking'
  }

  return (
    <div className={className}>
      <div className="resource-head">
        <span className="resource-label">{bar.label}</span>
        <Tooltip text={bar.explain} below>
          <button type="button" className="resource-help" aria-label={'What is ' + bar.label + '?'}>
            ?
          </button>
        </Tooltip>
      </div>
      <span className="resource-value">{bar.display}</span>
      <div className="resource-track">
        <div className="resource-fill" style={{ width: fill * 100 + '%' }} />
      </div>
    </div>
  )
}

interface ResourcePanelProps {
  bars: ResourceBarData[]
  highlightKey?: string | null
}

export function ResourcePanel({ bars, highlightKey = null }: ResourcePanelProps) {
  return (
    <div className="resource-panel">
      {bars.map((bar) => (
        <ResourceBar key={bar.key} bar={bar} highlight={bar.key === highlightKey} />
      ))}
    </div>
  )
}
