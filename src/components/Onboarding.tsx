import { useCallback, useEffect, useState } from 'react'
import { texts } from '../logic/data'
import { useTypewriter } from './useTypewriter'

const RESOURCE_KEYS = ['budget', 'mass', 'power', 'data', 'comms', 'time'] as const

function Line({ text, onDone }: { text: string; onDone: () => void }) {
  const { shown, done } = useTypewriter(text, 60)
  useEffect(() => {
    if (done) {
      const timer = window.setTimeout(onDone, 350)
      return () => window.clearTimeout(timer)
    }
  }, [done, onDone])
  return (
    <p className="onboard-line">
      {shown}
      {!done && <span className="cursor" />}
    </p>
  )
}

// First-run briefing from CAPCOM: four short lines and the six resources lighting up.
export function Onboarding({ onClose }: { onClose: () => void }) {
  const lines = texts.onboarding
  const [visible, setVisible] = useState(1)
  const [lit, setLit] = useState(0)

  const showResources = visible >= 3
  const advance = useCallback(() => setVisible((v) => Math.min(v + 1, lines.length + 1)), [lines.length])

  useEffect(() => {
    if (!showResources || lit >= RESOURCE_KEYS.length) {
      return
    }
    const timer = window.setTimeout(() => setLit(lit + 1), 380)
    return () => window.clearTimeout(timer)
  }, [showResources, lit])

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={texts.ui.onboarding.label}>
      <div className="modal onboard">
        <div className="onboard-head">
          <span className="capcom-sign">{texts.ui.onboarding.incoming}</span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>
            {texts.ui.skip}
          </button>
        </div>
        <div className="onboard-body mono">
          {lines.slice(0, visible).map((text, index) =>
            index === visible - 1 && visible <= lines.length ? (
              <Line key={index} text={text} onDone={advance} />
            ) : (
              <p key={index} className="onboard-line">
                {text}
              </p>
            ),
          )}
        </div>
        <div className="onboard-resources">
          {RESOURCE_KEYS.map((key, index) => (
            <div key={key} className={'onboard-resource' + (index < lit ? ' is-lit' : '')}>
              <span className="light light-ok" />
              <span className="onboard-resource-name">{texts.resources[key].label}</span>
              <span className="onboard-resource-text">{texts.resources[key].explain}</span>
            </div>
          ))}
        </div>
        <div className="onboard-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {texts.ui.onboarding.ok}
          </button>
        </div>
      </div>
    </div>
  )
}
