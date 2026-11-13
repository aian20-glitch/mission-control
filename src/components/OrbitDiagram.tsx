import type { Destination, OrbitId } from '../logic/types'

interface OrbitDiagramProps {
  orbitId: OrbitId
  destination: Destination
  active: boolean
}

// Small animated sketch of how the spacecraft meets the target.
export function OrbitDiagram({ orbitId, destination, active }: OrbitDiagramProps) {
  const color = destination.map.color
  const pathStroke = active ? '#5dcaa5' : 'rgba(255,255,255,0.35)'
  const isTour = destination.id === 'europa' && orbitId === 'flyby'

  let path = ''
  if (orbitId === 'flyby') {
    path = 'M6,118 C60,6 140,6 194,118'
  } else if (orbitId === 'orbiter') {
    path = 'M100,40 A62,26 0 1,1 99.9,40 Z'
  } else {
    path = 'M184,10 C150,14 112,22 100,47'
  }

  return (
    <svg className="orbit-diagram" viewBox="0 0 200 130" aria-hidden="true">
      <defs>
        <radialGradient id={'g' + destination.id} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
      </defs>
      {orbitId === 'orbiter' && (
        <ellipse cx="100" cy="66" rx="62" ry="26" fill="none" stroke={pathStroke} strokeWidth="1" strokeDasharray="3 4" transform="rotate(-12 100 66)" />
      )}
      <circle cx="100" cy="75" r="28" fill={'url(#g' + destination.id + ')'} />
      {isTour && (
        <>
          <path d="M20,124 C70,30 130,30 180,124" fill="none" stroke={pathStroke} strokeOpacity="0.5" strokeDasharray="3 4" />
          <path d="M34,126 C80,52 120,52 166,126" fill="none" stroke={pathStroke} strokeOpacity="0.35" strokeDasharray="3 4" />
        </>
      )}
      {orbitId !== 'orbiter' && <path d={path} fill="none" stroke={pathStroke} strokeWidth="1" strokeDasharray="3 4" />}
      {orbitId === 'lander' && (
        <g transform="translate(100 47)">
          <path d="M-5,0 L5,0 L3,-6 L-3,-6 Z" fill={active ? '#5dcaa5' : '#d7d4cc'} />
          <line x1="-5" y1="0" x2="-7" y2="3" stroke="#d7d4cc" />
          <line x1="5" y1="0" x2="7" y2="3" stroke="#d7d4cc" />
        </g>
      )}
      {orbitId !== 'lander' && (
        <g transform={orbitId === 'orbiter' ? 'rotate(-12 100 66)' : undefined}>
          <circle r="3.5" fill={active ? '#5dcaa5' : '#ffffff'}>
            <animateMotion
              dur={orbitId === 'orbiter' ? '5s' : '3.5s'}
              repeatCount="indefinite"
              path={orbitId === 'orbiter' ? 'M100,40 A62,26 0 1,1 99.9,40 Z' : path}
            />
          </circle>
        </g>
      )}
    </svg>
  )
}
