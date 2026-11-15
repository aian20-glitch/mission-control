import type { ReactNode } from 'react'
import { fill, texts } from '../logic/data'
import { hohmann } from '../logic/resources'
import type { Destination } from '../logic/types'
import { useSmoothValue } from './useSmoothValue'

interface OrbitMapProps {
  destination: Destination
  month: number
  good: boolean
}

const CENTER = 200
const EARTH_R = 78
const ARC_R = 44

// Other planets, on the same squeezed scale as Earth: radius on the map, months per orbit,
// and where they start (an angle), so they sit in different places.
const VENUS = { r: 56, period: 7.4, start: 4.2 }
const MARS_SMALL = { r: 110, period: 22.6, start: 2.5 }

// The asteroid belt goes round once in about 4.6 years.
const BELT_PERIOD = 55

function point(radius: number, angle: number): { x: number; y: number } {
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER - radius * Math.sin(angle),
  }
}

// Where to put a label: just outside the given radius, on the side away from the Sun.
function labelAt(radius: number, angle: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const p = point(radius, angle)
  const cos = Math.cos(angle)
  let anchor: 'start' | 'middle' | 'end' = 'middle'
  if (cos > 0.35) {
    anchor = 'start'
  } else if (cos < -0.35) {
    anchor = 'end'
  }
  return { x: p.x, y: p.y + 4, anchor }
}

// Earth's angle around the Sun for a month index (0 = Jan 2027). Months can be fractions.
function earthAngle(month: number): number {
  return Math.PI * 0.75 + (2 * Math.PI * month) / 12
}

// An angle brought into the range -180°..180°.
function wrapAngle(angle: number): number {
  let a = angle % (2 * Math.PI)
  if (a > Math.PI) {
    a = a - 2 * Math.PI
  }
  if (a <= -Math.PI) {
    a = a + 2 * Math.PI
  }
  return a
}

// The same "random" numbers on every render, so the asteroid belt does not flicker.
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function AsteroidBelt({ inner, outer, month }: { inner: number; outer: number; month: number }) {
  const rocks: ReactNode[] = []
  for (let i = 0; i < 150; i++) {
    const r = inner + (outer - inner) * seeded(i)
    const angle = seeded(i + 500) * 2 * Math.PI + (2 * Math.PI * month) / BELT_PERIOD
    const p = point(r, angle)
    rocks.push(<circle key={i} cx={p.x} cy={p.y} r={0.5 + seeded(i + 900) * 0.9} />)
  }
  return <g className="map-belt">{rocks}</g>
}

function SmallPlanet({ r, angle, color, size, label }: { r: number; angle: number; color: string; size: number; label: string }) {
  const p = point(r, angle)
  return (
    <g>
      <circle cx={CENTER} cy={CENTER} r={r} fill="none" stroke="rgba(255,255,255,0.08)" />
      <circle cx={p.x} cy={p.y} r={size} fill={color} />
      <text x={p.x} y={p.y - size - 4} textAnchor="middle" className="map-label map-label-tiny">
        {label}
      </text>
    </g>
  )
}

// The Sun: a soft glow that breathes and a slow ring of rays.
function Sun({ label }: { label: string }) {
  const rays: ReactNode[] = []
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6
    const p1 = point(11, angle)
    const p2 = point(i % 2 === 0 ? 20 : 16, angle)
    rays.push(<line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />)
  }
  return (
    <g>
      <circle cx={CENTER} cy={CENTER} r="30" fill="url(#sunGlow)" className="map-sun-glow" />
      <g className="map-sun-rays">{rays}</g>
      <circle cx={CENTER} cy={CENTER} r="7" fill="#fff2cc" />
      <text x={CENTER} y={CENTER + 28} textAnchor="middle" className="map-label map-label-faint">
        {label}
      </text>
    </g>
  )
}

// Thin ring of degree marks around the whole map, like an instrument dial.
function DialRing({ radius }: { radius: number }) {
  const ticks: ReactNode[] = []
  for (let i = 0; i < 72; i++) {
    const angle = (i * Math.PI) / 36
    const long = i % 18 === 0
    const p1 = point(radius - (long ? 7 : 3), angle)
    const p2 = point(radius, angle)
    ticks.push(<line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={long ? 'is-long' : undefined} />)
  }
  return (
    <g className="map-dial">
      <circle cx={CENTER} cy={CENTER} r={radius} fill="none" />
      {ticks}
    </g>
  )
}

// SVG arc around the Sun from angle `from` turning by `turn` (counterclockwise when positive).
function arcPath(radius: number, from: number, turn: number): string {
  const start = point(radius, from)
  const end = point(radius, from + turn)
  const large = Math.abs(turn) > Math.PI ? 1 : 0
  const sweep = turn > 0 ? 0 : 1
  return 'M' + start.x.toFixed(1) + ',' + start.y.toFixed(1) + ' A' + radius + ',' + radius + ' 0 ' + large + ' ' + sweep + ' ' + end.x.toFixed(1) + ',' + end.y.toFixed(1)
}

// Top-down map of the inner solar system: where Earth and the target are at launch,
// the transfer path, and where the target will be when the spacecraft arrives.
// When the date changes, the planets glide to their new places instead of jumping.
export function OrbitMap({ destination, month, good }: OrbitMapProps) {
  const shownMonth = useSmoothValue(month, 450)

  if (destination.window.alwaysOpen) {
    return <MoonMap />
  }

  const t = texts.ui.window
  const orbitAU = destination.map.orbitAU
  const toJupiter = orbitAU > 3
  const targetR = toJupiter ? 172 : 128
  const ideal = hohmann(orbitAU)
  const periodMonths = Math.pow(orbitAU, 1.5) * 12
  const targetName = toJupiter ? t.jupiter : destination.name

  // Target angle is set so that at the best month it leads Earth by the ideal angle.
  const best = destination.window.bestMonth
  const targetAt = (m: number) => earthAngle(best) + ideal.leadAngle + (2 * Math.PI * (m - best)) / periodMonths

  const launchAngle = earthAngle(shownMonth)
  const earth = point(EARTH_R, launchAngle)
  const targetNow = point(targetR, targetAt(shownMonth))
  const arrivalPoint = point(targetR, launchAngle + Math.PI)
  const targetAtArrival = point(targetR, targetAt(shownMonth + ideal.months))

  // How far ahead of Earth the target is at launch, and how far ahead it should be.
  const lead = wrapAngle(targetAt(shownMonth) - launchAngle)
  const leadDegrees = Math.round((Math.abs(lead) * 180) / Math.PI)
  const bestDegrees = Math.round((ideal.leadAngle * 180) / Math.PI)
  const leadMid = point(ARC_R + 11, launchAngle + lead / 2)
  // Ghost ring: where the target should be at launch for the shortest, cheapest trip.
  const bestPlace = point(targetR, launchAngle + ideal.leadAngle)

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
  const color = destination.map.color

  // Path of the spacecraft, as an SVG path (used for the line and for the moving dot).
  const transferPath = 'M' + transferPoints.join(' L')

  // How far the target moves along its orbit while the spacecraft flies.
  const moveFrom = targetAt(shownMonth)
  const moveTo = targetAt(shownMonth + ideal.months)
  const movePoints: string[] = []
  for (let i = 0; i <= 32; i++) {
    const p = point(targetR, moveFrom + ((moveTo - moveFrom) * i) / 32)
    movePoints.push(p.x.toFixed(1) + ',' + p.y.toFixed(1))
  }

  // Crop the picture to the orbits, so it fills the panel. The legend lives outside the SVG.
  const margin = targetR + 58
  const viewBox = [CENTER - margin, CENTER - margin, margin * 2, margin * 2].join(' ')
  const targetLabel = labelAt(targetR + 16, targetAt(shownMonth))
  const arrivalLabel = labelAt(targetR + 18, launchAngle + Math.PI)

  const ticks: ReactNode[] = []
  for (let i = 0; i < 12; i++) {
    const p1 = point(EARTH_R - 4, earthAngle(i))
    const p2 = point(EARTH_R + 4, earthAngle(i))
    ticks.push(<line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.18)" />)
  }

  const leadText = fill(lead >= 0 ? t.ahead : t.behind, { name: targetName, n: leadDegrees })

  return (
    <>
      <svg className="orbit-map" viewBox={viewBox} role="img" aria-label={t.mapLabel}>
        <defs>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#ffe9b0" />
            <stop offset="35%" stopColor="#ffb648" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff8a00" stopOpacity="0" />
          </radialGradient>
          <marker id="moveArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L8,5 L0,9" fill="none" stroke={color} strokeWidth="1.6" />
          </marker>
        </defs>

        <DialRing radius={margin - 6} />

        {/* Other planets and the asteroid belt: everything moves, not only Earth and the target. */}
        <SmallPlanet r={VENUS.r} angle={VENUS.start + (2 * Math.PI * shownMonth) / VENUS.period} color="#e3c48a" size={3} label={t.venus} />
        {toJupiter && (
          <SmallPlanet r={MARS_SMALL.r} angle={MARS_SMALL.start + (2 * Math.PI * shownMonth) / MARS_SMALL.period} color="#c1663f" size={3} label={t.mars} />
        )}
        {toJupiter ? <AsteroidBelt inner={128} outer={150} month={shownMonth} /> : <AsteroidBelt inner={152} outer={174} month={shownMonth} />}

        <Sun label={t.sun} />
        <circle cx={CENTER} cy={CENTER} r={EARTH_R} fill="none" stroke="rgba(111,183,255,0.35)" />
        <circle cx={CENTER} cy={CENTER} r={targetR} fill="none" stroke="rgba(255,255,255,0.14)" strokeDasharray="2 5" />
        {ticks}

        {/* The angle between Earth and the target at launch: the key to a good launch window. */}
        <g className="map-angle-arc">
          <line x1={CENTER} y1={CENTER} x2={earth.x} y2={earth.y} stroke="rgba(255,255,255,0.16)" strokeDasharray="2 3" />
          <line x1={CENTER} y1={CENTER} x2={targetNow.x} y2={targetNow.y} stroke="rgba(255,255,255,0.16)" strokeDasharray="2 3" />
          <path d={arcPath(ARC_R, launchAngle, lead)} fill="none" stroke={accent} strokeWidth="1.4" />
          <text x={leadMid.x} y={leadMid.y + 3} textAnchor="middle" className="map-label map-angle-value" style={{ fill: accent }}>
            {leadDegrees}°
          </text>
        </g>

        {/* The target keeps moving while we fly: this arc is the lesson of the launch window. */}
        <polyline
          className="target-move"
          points={movePoints.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="1 5"
          strokeLinecap="round"
          markerEnd="url(#moveArrow)"
        />

        {/* Spacecraft path */}
        <path className="transfer-path" d={transferPath} fill="none" stroke={accent} strokeWidth="1.8" />
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

        {/* The spacecraft flies the path again and again, with a short comet tail. */}
        <g className="map-craft">
          {[0.16, 0.08].map((lag, i) => (
            <circle key={lag} r={i === 0 ? 1.6 : 2.4} fill="#ffffff" opacity={i === 0 ? 0.3 : 0.55}>
              <animateMotion key={'tail' + month} dur="4s" begin={-lag + 's'} repeatCount="indefinite" path={transferPath} />
            </circle>
          ))}
          <circle r="3.5" fill="#ffffff">
            <animateMotion key={'craft' + month} dur="4s" repeatCount="indefinite" path={transferPath} />
          </circle>
        </g>

        {/* Target: now (solid) and at arrival (dashed ring) */}
        <circle cx={targetAtArrival.x} cy={targetAtArrival.y} r="9" fill="none" stroke={color} strokeDasharray="2 2" />
        <circle cx={arrivalPoint.x} cy={arrivalPoint.y} r="3" fill={accent} />
        <circle cx={arrivalPoint.x} cy={arrivalPoint.y} r="3" fill="none" stroke={accent} className="map-arrival-pulse" />
        <text x={arrivalLabel.x} y={arrivalLabel.y} textAnchor={arrivalLabel.anchor} className="map-label">
          {t.arrivalPoint}
        </text>
        <circle cx={bestPlace.x} cy={bestPlace.y} r="12" className={'map-best-ring' + (good ? ' is-good' : '')} />
        <circle cx={targetNow.x} cy={targetNow.y} r="13" fill={color} opacity="0.15" />
        <circle cx={targetNow.x} cy={targetNow.y} r="8" fill={color} />
        <text x={targetLabel.x} y={targetLabel.y} textAnchor={targetLabel.anchor} className="map-label map-label-strong">
          {targetName}
        </text>

        {/* Earth at launch */}
        <circle cx={earth.x} cy={earth.y} r="11" fill="rgba(79,155,232,0.18)" />
        <circle cx={earth.x} cy={earth.y} r="6" fill="#4f9be8" className="map-earth" />
        <text x={earth.x} y={earth.y - 16} textAnchor="middle" className="map-label map-label-strong">
          {t.earth}
          <tspan className="map-label-faint"> · {t.launchPoint}</tspan>
        </text>
      </svg>

      <div className="map-angle">
        <span className="eyebrow">{t.angleTitle}</span>
        <span className="map-angle-text mono" style={{ color: accent }}>
          {leadText}
        </span>
        <span className="map-angle-best mono">{fill(t.angleBest, { n: bestDegrees })}</span>
      </div>

      <ul className="map-legend">
        <li>
          <svg viewBox="0 0 16 8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke={accent} strokeWidth="2" />
          </svg>
          {t.legendPath}
        </li>
        <li>
          <svg viewBox="0 0 16 8" aria-hidden="true">
            <line x1="1" y1="4" x2="15" y2="4" stroke={color} strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" />
          </svg>
          {t.legendMove}
        </li>
        <li>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5" fill="none" stroke={color} strokeDasharray="2 2" />
          </svg>
          {t.whereLater}
        </li>
      </ul>
    </>
  )
}

function MoonMap() {
  const t = texts.ui.window
  return (
    <svg className="orbit-map" viewBox="0 0 400 400" role="img" aria-label={t.earth + ' · ' + t.moon}>
      <DialRing radius={186} />
      <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="2 5" />
      <circle cx="200" cy="200" r="34" fill="rgba(79,155,232,0.12)" />
      <circle cx="200" cy="200" r="22" fill="#4f9be8" className="map-earth" />
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
