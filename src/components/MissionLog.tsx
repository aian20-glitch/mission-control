import { useEffect, useRef } from 'react'
import { texts } from '../logic/data'
import { useTypewriter } from './useTypewriter'

export type LogTone = 'normal' | 'good' | 'bad' | 'lost' | 'event' | 'why' | 'boot'

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

// The status word at the end of each line, like on a control-room terminal.
function tagFor(tone: LogTone): string {
  const t = texts.ui.mission
  if (tone === 'event') {
    return t.tagActive
  }
  if (tone === 'good') {
    return t.tagResolved
  }
  if (tone === 'bad') {
    return t.tagDegraded
  }
  if (tone === 'lost') {
    return t.tagLost
  }
  if (tone === 'boot') {
    return t.tagOnline
  }
  return t.tagOk
}

// Mission alert feed: every message is a terminal line with a time, a callsign and a status.
// Problems arrive as ALERT lines. The newest line types out, older lines are static.
export function MissionLog({ lines, title = texts.ui.mission.log }: { lines: LogLine[]; title?: string }) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const body = bodyRef.current
    if (body) {
      body.scrollTop = body.scrollHeight
    }
  }, [lines.length])

  return (
    <div className="log panel feed">
      <div className="panel-title feed-title">
        <span className="eyebrow">{title}</span>
        <span className="chip chip-accent">{texts.ui.mission.live}</span>
      </div>
      <div className="log-body" ref={bodyRef} aria-live="polite">
        {lines.map((line, index) => (
          <div key={line.id} className={'feed-line tone-' + line.tone}>
            <div className="feed-head">
              <span className="feed-time">{line.time}</span>
              <span className="feed-sign">{line.callsign}</span>
              {line.tone === 'event' && <span className="feed-alert">{texts.ui.mission.alert}</span>}
              <span className="feed-tag">[{tagFor(line.tone)}]</span>
            </div>
            <div className="feed-text">{index === lines.length - 1 ? <TypedText text={line.text} /> : line.text}</div>
          </div>
        ))}
        <span className="cursor" />
      </div>
    </div>
  )
}
