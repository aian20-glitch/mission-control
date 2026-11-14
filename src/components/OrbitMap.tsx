import type { ReactNode } from 'react'
import { texts } from '../logic/data'
import { hohmann } from '../logic/resources'
import type { Destination } from '../logic/types'

interface OrbitMapProps {
  destination: Destination
  month: number
  good: boolean
}

const CENTER = 200
const EARTH_R = 78

function point(radius: number, angle: number): { x: number; y: number } {
  return { x: CENTER + radius * Math.cos(angle), y: CENTER - radius * Math.sin(angle) }
}

// Earth's angle around the Sun for a month index (0 = Jan 2027).
function earthAngle(month: number): number {
  return Math.PI * 0.75 + (2 * Math.PI * month) / 12
}

// Top-down map of the inner solar system: where Earth and the target are at launch,
// the transfer path, and where the target will be when the spacecraft arrives.
export function OrbitMap({ destination, month, good }: OrbitMapProps) {
  if (destination.window.alwaysOpen) {
    return <MoonMap />
  }

  const orbitAU = destination.map.orbitAU
  const targetR = orbitAU > 3 ? 172 : 128
  const ideal = hohmann(orbitAU)
  const periodMonths = Math.pow(orbitAU, 1.5) * 12

  // Target angle is set so that at the best month it leads Earth by the ideal angle.
  const best = destination.window.bestMonth
  const targetAt = (m: number) => earthAngle(best) + ideal.leadAngle + (2 * Math.PI * (m - best)) / periodMonths

  const launchAngle = earthAngle(month)
  const earth = point(EARTH_R, launchAngle)
  const targetNow = point(targetR, targetAt(month))
  const arrivalPoint = point(targetR, launchAngle + Math.PI)
  const targetAtArrival = point(targetR, targetAt(month + ideal.months))

  // Half an ellipse with the Sun at one focus: from Earth (closest) to the target orbit (farthest).
  const a = (EARTH_R + targetR) / 2
  const e = (targetR - EARTH_R) / (targetR + EARTH_R)
  const transferPoints: string[] = []
  for (let i = 0; i <= 48; i++) {
    const phi = (Math.PI * i) / 48
    const r = (a * (1 - e * e)) / (1 - e * Math.cos(phi + Math.PI))
    const p = point(r, launchAngle + phi)
    transferPoints.push(p.x.toFixed(1) + ',' + p.y.toFixed(1))
  }

  const accent = good ? '#5dcaa5' : '#ef9f27'
  const t = texts.ui.window
  const ticks: ReactNode[] = []
  for (let i = 0; i < 12; i++) {
    const p1 = point(EARTH_R - 4, earthAngle(i))
    const p2 = point(EARTH_R + 4, earthAngle(i))
    ticks.push(<line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.18)" />)
  }

  return (
    <svg className="orbit-map" viewBox="0 0 400 400" role="img" aria-label={t.mapLabel}>
      <defs>
        <radialGradient id="sunGlow">
          <stop offset="0%" stopColor="#ffe9b0" />
          <stop offset="35%" stopColor="#ffb648" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff8a00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={CENTER} cy={CENTER} r="26" fill="url(#sunGlow)" />
      <circle cx={CENTER} cy={CENTER} r="7" fill="#fff2cc" />
      <circle cx={CENTER} cy={CENTER} r={EARTH_R} fill="none" stroke="rgba(111,183,255,0.35)" />
      <circle cx={CENTER} cy={CENTER} r={targetR} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="2 5" />
      {ticks}

      <polyline key={month} className="transfer-path" points={transferPoints.join(' ')} fill="none" stroke={accent} strokeWidth="1.6" />

      {!good && (
        <line
          x1={arrivalPoint.x}
          y1={arrivalPoint.y}
          x2={targetAtArrival.x}
          y2={targetAtArrival.y}
          stroke="#ef9f27"
          strokeDasharray="3 4"
          strokeWidth="1.2"
        />
      )}
      <circle cx={targetAtArrival.x} cy={targetAtArrival.y} r="7" fill="none" stroke={destination.map.color} strokeDasharray="2 2" opacity="0.8" />
      <circle cx={arrivalPoint.x} cy={arrivalPoint.y} r="3" fill={accent} />

      <circle cx={targetNow.x} cy={targetNow.y} r="7" fill={destination.map.color} />
      <text x={targetNow.x + 11} y={targetNow.y + 4} className="map-label">
        {destination.id === 'europa' ? t.jupiter : destination.name}
      </text>

      <circle cx={earth.x} cy={earth.y} r="6" fill="#4f9be8" />
      <text x={earth.x + 10} y={earth.y + 4} className="map-label">
        {t.earth}
      </text>

      <g className="map-legend" transform="translate(16 372)">
        <circle cx="4" cy="-4" r="4" fill="none" stroke={destination.map.color} strokeDasharray="2 2" />
        <text x="14" y="0" className="map-label">
          {t.whereLater}
        </text>
      </g>
    </svg>
  )
}

function MoonMap() {
  const t = texts.ui.window
  return (
    <svg className="orbit-map" viewBox="0 0 400 400" role="img" aria-label={t.earth + ' · ' + t.moon}>
      <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="2 5" />
      <circle cx="200" cy="200" r="22" fill="#4f9be8" />
      <text x="228" y="204" className="map-label">
        {t.earth}
      </text>
      <g className="moon-orbit">
        <circle cx="350" cy="200" r="9" fill="#b9b5ae" />
        <text x="320" y="225" className="map-label">
          {t.moon}
        </text>
      </g>
      <path className="transfer-path" d="M222,200 C260,120 330,130 345,190" fill="none" stroke="#5dcaa5" strokeWidth="1.6" />
      <text x="200" y="380" textAnchor="middle" className="map-label">
        {t.moonTrip}
      </text>
    </svg>
  )
}
