import { useEffect, useRef } from 'react'
import { useTypewriter } from './useTypewriter'

export type LogTone = 'normal' | 'good' | 'bad' | 'lost' | 'event' | 'why'

export interface LogLine {
  id: number
  time: string
  callsign: string
  text: string
  tone: LogTone
}

function TypedText({ text }: { text: string }) {
  const { shown, done } = useTypewriter(text, 70)
  return (
    <>
      {shown}
      {!done && <span className="cursor" />}
    </>
  )
}

// Mission Control log: newest line types out, older lines are static.
export function MissionLog({ lines, title = 'Mission log' }: { lines: LogLine[]; title?: string }) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const body = bodyRef.current
    if (body) {
      body.scrollTop = body.scrollHeight
    }
  }, [lines.length])

  return (
    <div className="log panel">
      <div className="panel-title" style={{ padding: '14px 16px 0', marginBottom: 0 }}>
        <span className="eyebrow">{title}</span>
        <span className="chip chip-accent">LIVE</span>
      </div>
      <div className="log-body" ref={bodyRef} aria-live="polite">
        {lines.map((line, index) => (
          <div key={line.id} className={'log-line tone-' + line.tone}>
            <span className="log-time">{line.time}</span>
            <span className="log-sign">{line.callsign}</span>
            <span className="log-text">{index === lines.length - 1 ? <TypedText text={line.text} /> : line.text}</span>
          </div>
        ))}
        {lines.length === 0 && <span className="cursor" />}
      </div>
    </div>
  )
}
