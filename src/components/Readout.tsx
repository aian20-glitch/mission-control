import type { Severity } from '../logic/types'

export interface ReadoutRow {
  label: string
  value: string
  status?: Severity
}

// A short list of facts: label on the left, value on the right.
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
