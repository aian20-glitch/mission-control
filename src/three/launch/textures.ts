import * as THREE from 'three'

// Small textures drawn on a canvas at start-up, so the launch scene needs no image files.

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

// Repeatable "random" numbers, so the textures look the same every time.
function makeRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

// A soft, lumpy puff of smoke or cloud: many overlapping round blobs.
export function createPuffTexture(): THREE.Texture {
  const size = 128
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const random = makeRandom(7)
    for (let i = 0; i < 16; i++) {
      const x = size / 2 + (random() - 0.5) * size * 0.38
      const y = size / 2 + (random() - 0.5) * size * 0.38
      const r = size * (0.14 + random() * 0.2)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
      gradient.addColorStop(0, 'rgba(255,255,255,0.34)')
      gradient.addColorStop(0.6, 'rgba(255,255,255,0.14)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Fade the outside, so the square edge of the picture never shows.
    ctx.globalCompositeOperation = 'destination-in'
    const edge = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2)
    edge.addColorStop(0, 'rgba(0,0,0,1)')
    edge.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

// A round glow: bright middle, soft edge. Used for engine glow, the Sun and far-away dots.
export function createGlowTexture(): THREE.Texture {
  const size = 64
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.65)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

// Dark blue solar cells with thin silver lines between them.
export function createSolarTexture(): THREE.Texture {
  const width = 256
  const height = 128
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const base = ctx.createLinearGradient(0, 0, width, height)
    base.addColorStop(0, '#1b3a6b')
    base.addColorStop(0.5, '#10264a')
    base.addColorStop(1, '#1a3564')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(190, 210, 240, 0.45)'
    ctx.lineWidth = 1.5
    for (let x = 0; x <= width; x += 16) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y <= height; y += 16) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
