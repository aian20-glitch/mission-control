import { useId, type CSSProperties } from 'react'
import type { Destination } from '../logic/types'

type Look = Destination['look']

interface PlanetOrbProps {
  look: Look
  size: number
  seed?: number
  spinSeconds?: number
}

// "#rrggbb" -> [r, g, b] in 0..1
function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ]
}

function table(colors: string[], channel: 0 | 1 | 2): string {
  return colors.map((c) => rgb(c)[channel].toFixed(3)).join(' ')
}

interface SurfaceRecipe {
  type: 'fractalNoise' | 'turbulence'
  frequency: string
  octaves: number
  contrast: number
  ramp: string[]
  discrete: boolean
}

function recipeFor(look: Look): SurfaceRecipe {
  if (look.kind === 'earth') {
    return { type: 'fractalNoise', frequency: '0.011 0.016', octaves: 5, contrast: 1.9, ramp: [look.dark, look.base, look.base, look.base, look.light, '#7c6f4a'], discrete: true }
  }
  if (look.kind === 'mars') {
    return { type: 'fractalNoise', frequency: '0.014 0.02', octaves: 5, contrast: 2.2, ramp: [look.dark, look.base, look.base, look.light], discrete: false }
  }
  if (look.kind === 'icy') {
    return { type: 'turbulence', frequency: '0.022 0.03', octaves: 3, contrast: 1.8, ramp: [look.light, look.light, look.base, look.dark], discrete: false }
  }
  return { type: 'fractalNoise', frequency: '0.016 0.02', octaves: 5, contrast: 2.4, ramp: [look.dark, look.base, look.base, look.light], discrete: false }
}

// A procedural planet drawn with SVG noise. Stand-in until the 3D scenes arrive.
export function PlanetOrb({ look, size, seed = 4, spinSeconds = 120 }: PlanetOrbProps) {
  const rawId = useId()
  const id = 'orb' + rawId.replace(/[^a-zA-Z0-9]/g, '')
  const recipe = recipeFor(look)
  const intercept = 0.5 - recipe.contrast / 2
  const funcType = recipe.discrete ? 'discrete' : 'table'
  const hasAtmosphere = look.atmosphere !== '#000000'

  const style: CSSProperties = {
    width: size,
    aspectRatio: '1',
    boxShadow: hasAtmosphere
      ? '0 0 ' + size * 0.12 + 'px ' + look.atmosphere + '55, inset 0 0 ' + size * 0.05 + 'px ' + look.atmosphere + '66'
      : '0 0 ' + size * 0.1 + 'px rgba(255,255,255,0.06)',
  }

  return (
    <div className="orb" style={style}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <filter id={id + 's'} filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="200">
            <feTurbulence type={recipe.type} baseFrequency={recipe.frequency} numOctaves={recipe.octaves} seed={seed} stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" />
            <feComponentTransfer>
              <feFuncR type="linear" slope={recipe.contrast} intercept={intercept} />
              <feFuncG type="linear" slope={recipe.contrast} intercept={intercept} />
              <feFuncB type="linear" slope={recipe.contrast} intercept={intercept} />
            </feComponentTransfer>
            <feComponentTransfer>
              <feFuncR type={funcType} tableValues={table(recipe.ramp, 0)} />
              <feFuncG type={funcType} tableValues={table(recipe.ramp, 1)} />
              <feFuncB type={funcType} tableValues={table(recipe.ramp, 2)} />
            </feComponentTransfer>
          </filter>
          {look.kind === 'earth' && (
            <filter id={id + 'c'} filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="200">
              <feTurbulence type="fractalNoise" baseFrequency="0.02 0.045" numOctaves={4} seed={seed + 7} stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -1.25" />
            </filter>
          )}
          <filter id={id + 'b'}>
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <clipPath id={id + 'k'}>
            <circle cx="100" cy="100" r="100" />
          </clipPath>
        </defs>
        <g clipPath={'url(#' + id + 'k)'}>
          <g className="orb-surface" style={{ ['--orb-speed' as string]: spinSeconds + 's' }}>
            <rect x="0" y="0" width="600" height="200" filter={'url(#' + id + 's)'} />
          </g>
          {look.kind === 'mars' && (
            <>
              <ellipse cx="100" cy="2" rx="46" ry="14" fill="#f3ece4" opacity="0.85" filter={'url(#' + id + 'b)'} />
              <ellipse cx="100" cy="199" rx="34" ry="10" fill="#f3ece4" opacity="0.7" filter={'url(#' + id + 'b)'} />
            </>
          )}
          {look.kind === 'earth' && (
            <g className="orb-surface" style={{ ['--orb-speed' as string]: spinSeconds * 0.7 + 's' }}>
              <rect x="0" y="0" width="600" height="200" filter={'url(#' + id + 'c)'} />
            </g>
          )}
        </g>
      </svg>
      <div className="orb-shade" />
    </div>
  )
}
