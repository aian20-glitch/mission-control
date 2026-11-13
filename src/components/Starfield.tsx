import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  base: number
  speed: number
  phase: number
}

// Full-screen canvas of softly twinkling stars behind the UI.
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    let stars: Star[] = []
    let frame = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      if (!canvas || !context) {
        return
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round((window.innerWidth * window.innerHeight) / 5000)
      stars = []
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          r: Math.random() < 0.92 ? Math.random() * 0.8 + 0.2 : Math.random() * 1.2 + 0.8,
          base: Math.random() * 0.5 + 0.2,
          speed: Math.random() * 0.8 + 0.2,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    function draw(time: number) {
      if (!context) {
        return
      }
      context.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const star of stars) {
        const twinkle = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(time * 0.001 * star.speed + star.phase)
        context.globalAlpha = star.base * twinkle
        context.fillStyle = star.r > 1 ? '#dff6ee' : '#ffffff'
        context.beginPath()
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        context.fill()
      }
      frame = window.requestAnimationFrame(draw)
    }

    resize()
    frame = window.requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />
}
