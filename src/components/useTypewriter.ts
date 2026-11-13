import { useEffect, useState } from 'react'

// Reveals text letter by letter. Returns the visible part and whether typing is done.
export function useTypewriter(text: string, charsPerSecond = 55): { shown: string; done: boolean } {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(0)
    if (!text) {
      return
    }
    const intervalMs = 1000 / charsPerSecond
    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current >= text.length) {
          window.clearInterval(timer)
          return current
        }
        return current + 1
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [text, charsPerSecond])

  return { shown: text.slice(0, count), done: count >= text.length }
}
