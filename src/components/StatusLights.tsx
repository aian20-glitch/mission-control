import type { ResourceBarData } from '../logic/types'
import { Tooltip } from './Tooltip'

// Row of station lamps, one per resource.
export function StatusLights({ bars }: { bars: ResourceBarData[] }) {
  return (
    <div className="lights">
      {bars.map((bar) => (
        <Tooltip key={bar.key} text={bar.label + ': ' + bar.display}>
          <span className={'light light-' + bar.status} aria-label={bar.label + ' ' + bar.status} />
        </Tooltip>
      ))}
    </div>
  )
}
