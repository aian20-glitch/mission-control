import { useEffect, useRef, useState } from 'react'

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// Glides a number from its current value to `target` over `durationMs`,
// instead of jumping. Used for the spacecraft on the trajectory and the live numbers.
export function useSmoothValue(target: number, durationMs: number): number {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)

  useEffect(() => {
    const from = shownRef.current
    if (from === target) {
      return
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || durationMs <= 0) {
      shownRef.current = target
      setShown(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const value = from + (target - from) * easeInOut(t)
      shownRef.current = value
      setShown(value)
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return shown
}
