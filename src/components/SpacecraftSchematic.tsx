import type { ReactNode } from 'react'
import { getPart } from '../logic/data'
import type { Design, OrbitId } from '../logic/types'

interface SchematicProps {
  design: Design
  orbitId: OrbitId
  hotPartId: string | null
  deadPartIds: string[]
  onHover: (partId: string | null) => void
}

const BODY = '#d7d4cc'
const BODY_DARK = '#9d998f'
const LINE = '#0b1218'
const PANEL = '#1f3c63'
const PANEL_LINE = 'rgba(200, 225, 255, 0.28)'

// Each part is drawn by its own small function, so adding a part = adding a drawing.
function SolarWing({ x, width, height }: { x: number; width: number; height: number }) {
  const y = 200 - height / 2
  const cells: ReactNode[] = []
  const columns = Math.round(width / 16)
  for (let i = 1; i < columns; i++) {
    const cx = x + (width / columns) * i
    cells.push(<line key={'c' + i} x1={cx} y1={y} x2={cx} y2={y + height} stroke={PANEL_LINE} strokeWidth="0.8" />)
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="2" fill={PANEL} stroke="#5d7fa8" strokeWidth="0.8" />
      <line x1={x} y1={200} x2={x + width} y2={200} stroke={PANEL_LINE} strokeWidth="0.8" />
      {cells}
    </g>
  )
}

function drawPart(partId: string): ReactNode {
  switch (partId) {
    case 'solar_s':
      return (
        <>
          <line x1="158" y1="200" x2="170" y2="200" stroke={BODY_DARK} strokeWidth="3" />
          <line x1="230" y1="200" x2="242" y2="200" stroke={BODY_DARK} strokeWidth="3" />
          <SolarWing x={92} width={66} height={26} />
          <SolarWing x={242} width={66} height={26} />
        </>
      )
    case 'solar_l':
      return (
        <>
          <line x1="160" y1="200" x2="170" y2="200" stroke={BODY_DARK} strokeWidth="3" />
          <line x1="230" y1="200" x2="240" y2="200" stroke={BODY_DARK} strokeWidth="3" />
          <SolarWing x={58} width={102} height={36} />
          <SolarWing x={240} width={102} height={36} />
        </>
      )
    case 'rtg':
      return (
        <>
          <line x1="172" y1="226" x2="134" y2="258" stroke={BODY_DARK} strokeWidth="2.5" />
          <circle cx="126" cy="266" r="16" fill="rgba(239, 159, 39, 0.12)" />
          <rect x="117" y="248" width="18" height="36" rx="4" fill="#5b5f63" stroke={LINE} strokeWidth="0.8" />
          {[254, 262, 270, 278].map((y) => (
            <g key={y}>
              <line x1="110" y1={y} x2="117" y2={y} stroke="#7d8287" strokeWidth="2" />
              <line x1="135" y1={y} x2="142" y2={y} stroke="#7d8287" strokeWidth="2" />
            </g>
          ))}
        </>
      )
    case 'antenna_small':
      return (
        <>
          <line x1="200" y1="170" x2="200" y2="154" stroke={BODY_DARK} strokeWidth="2.5" />
          <path d="M184,146 Q200,162 216,146 Z" fill={BODY} stroke={LINE} strokeWidth="0.8" />
          <line x1="200" y1="154" x2="200" y2="141" stroke={BODY_DARK} strokeWidth="1.2" />
        </>
      )
    case 'antenna_hga':
      return (
        <>
          <line x1="200" y1="170" x2="200" y2="150" stroke={BODY_DARK} strokeWidth="3" />
          <path d="M156,128 Q200,172 244,128 Q200,146 156,128 Z" fill={BODY} stroke={LINE} strokeWidth="0.8" />
          <line x1="164" y1="132" x2="200" y2="110" stroke={BODY_DARK} strokeWidth="1" />
          <line x1="236" y1="132" x2="200" y2="110" stroke={BODY_DARK} strokeWidth="1" />
          <circle cx="200" cy="110" r="3" fill={BODY_DARK} />
        </>
      )
    case 'camera':
      return (
        <>
          <rect x="174" y="230" width="16" height="14" rx="2" fill={BODY} stroke={LINE} strokeWidth="0.8" />
          <circle cx="182" cy="249" r="6" fill="#0d1820" stroke={BODY_DARK} strokeWidth="1.5" />
          <circle cx="180" cy="247" r="1.6" fill="#5dcaa5" />
        </>
      )
    case 'spectrometer':
      return (
        <>
          <rect x="210" y="230" width="16" height="13" rx="2" fill={BODY} stroke={LINE} strokeWidth="0.8" />
          <rect x="213" y="243" width="10" height="5" fill="#0d1820" />
          <line x1="214" y1="245.5" x2="222" y2="245.5" stroke="#b58cff" strokeWidth="1" />
        </>
      )
    case 'radar':
      return (
        <>
          <line x1="170" y1="224" x2="64" y2="224" stroke={BODY} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="230" y1="224" x2="336" y2="224" stroke={BODY} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="64" cy="224" r="2.5" fill={BODY_DARK} />
          <circle cx="336" cy="224" r="2.5" fill={BODY_DARK} />
        </>
      )
    case 'seismometer':
      return (
        <>
          <path d="M192,246 A8,8 0 0 1 208,246 Z" fill="#c7a55a" stroke={LINE} strokeWidth="0.8" />
          <line x1="192" y1="246" x2="208" y2="246" stroke={LINE} strokeWidth="1" />
        </>
      )
    case 'magnetometer':
      return (
        <>
          <line x1="230" y1="172" x2="306" y2="104" stroke={BODY_DARK} strokeWidth="1.5" />
          <rect x="302" y="96" width="10" height="10" rx="2" fill={BODY} stroke={LINE} strokeWidth="0.8" />
        </>
      )
    case 'heat_shield':
      return <path d="M126,276 Q200,318 274,276 L266,272 Q200,306 134,272 Z" fill="#a8643a" stroke="#6b3a1d" strokeWidth="1" />
    case 'redundancy':
      return (
        <>
          <rect x="156" y="178" width="14" height="22" rx="2" fill={BODY} stroke={LINE} strokeWidth="0.8" />
          <line x1="163" y1="184" x2="163" y2="192" stroke={LINE} strokeWidth="1.4" />
          <line x1="159" y1="188" x2="167" y2="188" stroke={LINE} strokeWidth="1.4" />
          <circle cx="163" cy="196" r="1.4" fill="#5dcaa5" />
        </>
      )
    case 'battery':
      return (
        <>
          <rect x="230" y="178" width="14" height="22" rx="2" fill="#3b4a55" stroke={LINE} strokeWidth="0.8" />
          <line x1="232" y1="184" x2="242" y2="184" stroke="#ef9f27" strokeWidth="1.2" />
          <line x1="232" y1="189" x2="242" y2="189" stroke="#ef9f27" strokeWidth="1.2" />
          <line x1="232" y1="194" x2="242" y2="194" stroke="#5f6f7a" strokeWidth="1.2" />
        </>
      )
    default:
      return null
  }
}

function Reticle() {
  const ticks: ReactNode[] = []
  for (let angle = 0; angle < 360; angle += 10) {
    const rad = (angle * Math.PI) / 180
    const inner = angle % 90 === 0 ? 172 : 179
    ticks.push(
      <line
        key={angle}
        x1={200 + Math.cos(rad) * inner}
        y1={200 + Math.sin(rad) * inner}
        x2={200 + Math.cos(rad) * 186}
        y2={200 + Math.sin(rad) * 186}
        stroke="rgba(93, 202, 165, 0.5)"
        strokeWidth="1"
      />,
    )
  }
  return (
    <g className="reticle">
      <circle cx="200" cy="200" r="186" fill="none" stroke="rgba(93, 202, 165, 0.55)" strokeWidth="1" />
      <circle cx="200" cy="200" r="152" fill="none" stroke="rgba(93, 202, 165, 0.35)" strokeWidth="1" strokeDasharray="6 8" className="reticle-spin" />
      <line x1="200" y1="22" x2="200" y2="60" stroke="rgba(93, 202, 165, 0.25)" />
      <line x1="200" y1="340" x2="200" y2="378" stroke="rgba(93, 202, 165, 0.25)" />
      <line x1="22" y1="200" x2="44" y2="200" stroke="rgba(93, 202, 165, 0.25)" />
      <line x1="356" y1="200" x2="378" y2="200" stroke="rgba(93, 202, 165, 0.25)" />
      {ticks}
    </g>
  )
}

// Blueprint-style drawing of the spacecraft. New parts pop into place.
export function SpacecraftSchematic({ design, orbitId, hotPartId, deadPartIds, onHover }: SchematicProps) {
  const partIds = [design.power, ...design.extras, design.comms, ...design.instruments]
  const isLander = orbitId === 'lander'
  const hotPart = hotPartId ? getPart(hotPartId) : null

  return (
    <div className="schematic">
      <svg viewBox="0 0 400 400" role="img" aria-label="Spacecraft schematic">
        <Reticle />
        {isLander && (
          <g className="sc-part" key={'legs'}>
            <line x1="174" y1="228" x2="146" y2="266" stroke={BODY_DARK} strokeWidth="2.5" />
            <line x1="226" y1="228" x2="254" y2="266" stroke={BODY_DARK} strokeWidth="2.5" />
            <ellipse cx="144" cy="268" rx="9" ry="3" fill={BODY_DARK} />
            <ellipse cx="256" cy="268" rx="9" ry="3" fill={BODY_DARK} />
          </g>
        )}
        {partIds.map((id) => {
          let className = 'sc-part'
          if (id === hotPartId) {
            className = className + ' is-hot'
          }
          if (deadPartIds.includes(id)) {
            className = className + ' is-dead'
          }
          return (
            <g key={id} className={className} onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)}>
              {drawPart(id)}
            </g>
          )
        })}
        <g className="sc-bus" onMouseEnter={() => onHover(null)}>
          <rect x="170" y="170" width="60" height="60" rx="5" fill={BODY} stroke={LINE} strokeWidth="1" />
          <rect x="178" y="178" width="44" height="44" rx="3" fill="none" stroke={BODY_DARK} strokeWidth="0.8" />
          <line x1="178" y1="200" x2="222" y2="200" stroke={BODY_DARK} strokeWidth="0.6" />
          <line x1="200" y1="178" x2="200" y2="222" stroke={BODY_DARK} strokeWidth="0.6" />
        </g>
      </svg>
      <div className="schematic-caption mono">
        {hotPart ? (
          <>
            <span className="schematic-caption-name">▸ {hotPart.name.toUpperCase()}</span>
            <span>
              {hotPart.mass} KG · {hotPart.power} W · ${hotPart.cost}M
            </span>
          </>
        ) : (
          <span className="faint">HOVER A PART TO INSPECT</span>
        )}
      </div>
    </div>
  )
}
