import type { Severity } from '../logic/types'

export interface ReadoutRow {
  label: string
  value: string
  status?: Severity
}

// Retro mono panel: "MASS ........ 3,200 KG".
export function Readout({ rows }: { rows: ReadoutRow[] }) {
  return (
    <div className="readout">
      {rows.map((row) => (
        <div key={row.label} className={'readout-row' + (row.status && row.status !== 'ok' ? ' is-' + row.status : '')}>
          <span className="readout-label">{row.label}</span>
          <span className="readout-dots" />
          <span className="readout-value">{row.value}</span>
        </div>
      ))}
    </div>
  )
}
