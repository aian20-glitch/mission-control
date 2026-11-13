import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Readout } from '../components/Readout'
import { texts } from '../logic/data'
import { useMission, useMissionReport } from '../store/useMission'

type RocketSize = 'light' | 'medium' | 'heavy'

function rocketSize(partId: string): RocketSize {
  if (partId === 'lv_heavy') {
    return 'heavy'
  }
  if (partId === 'lv_medium') {
    return 'medium'
  }
  return 'light'
}

// Upper stage + payload fairing.
function UpperStage() {
  return (
    <svg viewBox="0 0 40 120" className="rocket-upper-svg" aria-hidden="true">
      <path d="M20,0 C30,14 33,30 33,46 L33,70 L7,70 L7,46 C7,30 10,14 20,0 Z" fill="#eceae4" />
      <rect x="7" y="58" width="26" height="3" fill="#1b2026" />
      <rect x="9" y="70" width="22" height="50" fill="#e4e2dc" />
      <rect x="9" y="100" width="22" height="4" fill="#1b2026" />
    </svg>
  )
}

// First stage, plus side boosters or side cores.
function LowerStage({ size }: { size: RocketSize }) {
  return (
    <svg viewBox="0 0 120 220" className="rocket-lower-svg" aria-hidden="true">
      {size === 'medium' && (
        <>
          <path d="M34,90 L42,78 L42,200 L34,200 Z" fill="#d9d6ce" />
          <path d="M86,90 L78,78 L78,200 L86,200 Z" fill="#d9d6ce" />
        </>
      )}
      {size === 'heavy' && (
        <>
          <path d="M22,40 C22,30 26,24 31,20 C36,24 40,30 40,40 L40,206 L22,206 Z" fill="#e4e2dc" />
          <path d="M80,40 C80,30 84,24 89,20 C94,24 98,30 98,40 L98,206 L80,206 Z" fill="#e4e2dc" />
          <rect x="22" y="60" width="18" height="4" fill="#1b2026" />
          <rect x="80" y="60" width="18" height="4" fill="#1b2026" />
        </>
      )}
      <rect x="49" y="0" width="22" height="210" fill="#efede7" />
      <rect x="49" y="40" width="22" height="5" fill="#1b2026" />
      <rect x="49" y="150" width="22" height="3" fill="#1b2026" />
      <path d="M49,210 L71,210 L74,220 L46,220 Z" fill="#3b4048" />
    </svg>
  )
}

interface Telemetry {
  time: number
  altitude: number
  speed: number
}

// ~10 second launch cinematic: countdown, lift-off, camera follow, stage separation, orbit.
export function Launch() {
  const data = useMissionReport()
  const beginMission = useMission((s) => s.beginMission)
  const [countdown, setCountdown] = useState('T-5')
  const [caption, setCaption] = useState('')
  const [telemetry, setTelemetry] = useState<Telemetry>({ time: 0, altitude: 0, speed: 0 })

  const rootRef = useRef<HTMLElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const finishedRef = useRef(false)

  const size = data ? rocketSize(data.ctx.launchVehicle.id) : 'light'

  function finish() {
    if (finishedRef.current) {
      return
    }
    finishedRef.current = true
    timelineRef.current?.kill()
    beginMission()
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const q = gsap.utils.selector(root)
    const telemetryProxy = { time: 0, altitude: 0, speed: 0 }
    const pushTelemetry = () => setTelemetry({ ...telemetryProxy })

    const tl = gsap.timeline({ onComplete: finish })
    timelineRef.current = tl

    // Countdown T-5 .. T-0
    for (let i = 5; i >= 0; i--) {
      tl.call(() => setCountdown(i === 0 ? 'IGNITION' : 'T-' + i), [], (5 - i) * 0.55)
    }
    tl.addLabel('ignition', 2.75)
    tl.to(q('.rocket-lower .flame'), { scaleY: 1, opacity: 1, duration: 0.4, ease: 'power2.out' }, 'ignition')
    tl.to(q('.smoke-puff'), { scale: 1, opacity: 0.9, duration: 1.6, stagger: 0.04, ease: 'power2.out' }, 'ignition')
    tl.fromTo(q('.launch-rocket'), { x: -1.5 }, { x: 1.5, duration: 0.05, repeat: 30, yoyo: true, ease: 'none' }, 'ignition')

    // Lift-off and climb: the world drops away (camera follows the rocket).
    tl.addLabel('liftoff', 'ignition+=0.7')
    tl.call(() => {
      setCountdown('LIFT-OFF')
      setCaption(texts.log.launch[1].text.replace('{rocket}', data ? data.ctx.launchVehicle.name : 'rocket'))
    }, [], 'liftoff')
    tl.to(q('.launch-rocket'), { y: '-22vh', duration: 2.2, ease: 'power2.in' }, 'liftoff')
    tl.to(q('.launch-world'), { y: '140vh', duration: 6.5, ease: 'power2.in' }, 'liftoff+=0.6')
    tl.to(q('.launch-sky'), { opacity: 0, duration: 5, ease: 'power1.in' }, 'liftoff+=1')
    tl.to(telemetryProxy, { time: 160, altitude: 70, speed: 2300, duration: 3.4, ease: 'power2.in', onUpdate: pushTelemetry }, 'liftoff')

    tl.call(() => setCaption('MAX Q: strongest air pressure on the rocket'), [], 'liftoff+=1.6')

    // Stage separation: the empty first stage falls away.
    tl.addLabel('separation', 'liftoff+=3.4')
    tl.call(() => {
      setCountdown('STAGE SEP')
      setCaption('First stage empty and dropped: a lighter rocket climbs faster')
    }, [], 'separation')
    tl.to(q('.rocket-lower'), { y: '60vh', rotation: -18, opacity: 0, duration: 2.4, ease: 'power1.in' }, 'separation')
    tl.to(q('.flame-upper'), { scaleY: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }, 'separation+=0.4')
    tl.to(telemetryProxy, { time: 480, altitude: 180, speed: 7500, duration: 2.4, ease: 'power1.inOut', onUpdate: pushTelemetry }, 'separation')

    // Orbit: tilt over and zoom out.
    tl.addLabel('orbit', 'separation+=2')
    tl.to(q('.launch-rocket'), { rotation: 62, scale: 0.45, y: '-30vh', x: '18vw', duration: 2.4, ease: 'power2.inOut' }, 'orbit')
    tl.to(telemetryProxy, { time: 530, altitude: 200, speed: 7800, duration: 1.6, ease: 'power1.out', onUpdate: pushTelemetry }, 'orbit+=0.4')
    tl.to(q('.launch-earth'), { opacity: 1, duration: 2.2, ease: 'power1.out' }, 'orbit')
    tl.to(q('.flame-upper'), { scaleY: 0, opacity: 0, duration: 0.4 }, 'orbit+=1.6')
    tl.call(() => {
      setCountdown('ORBIT')
      setCaption('In orbit at 7.8 km/s. Next stop: ' + (data ? data.ctx.destination.name : 'space'))
    }, [], 'orbit+=1.4')
    tl.to({}, { duration: 1.2 })

    return () => {
      tl.kill()
    }
    // The timeline is built once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const minutes = Math.floor(telemetry.time / 60)
  const seconds = Math.floor(telemetry.time % 60)
  const smoke = []
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1
    smoke.push(
      <span
        key={i}
        className="smoke-puff"
        style={{
          left: 50 + side * (4 + (i * 7) % 26) + '%',
          bottom: (i % 5) * 10 - 10 + 'px',
          width: 90 + (i % 4) * 40 + 'px',
          height: 90 + (i % 4) * 40 + 'px',
        }}
      />,
    )
  }

  return (
    <section className="launch-screen" ref={rootRef}>
      <div className="launch-sky" />
      <div className="launch-world">
        <div className="launch-ground" />
        <div className="launch-tower" />
        <div className="launch-smoke">{smoke}</div>
      </div>

      <div className="launch-earth" />
      <div className={'launch-rocket size-' + size}>
        <div className="rocket-upper">
          <UpperStage />
          <div className="flame flame-upper" />
        </div>
        <div className="rocket-lower">
          <LowerStage size={size} />
          <div className="flame" />
        </div>
      </div>

      <div className="launch-hud">
        <div className="launch-countdown mono">{countdown}</div>
        <div className="launch-telemetry">
          <Readout
            rows={[
              { label: 'MET', value: 'T+' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') },
              { label: 'Altitude', value: Math.round(telemetry.altitude) + ' KM' },
              { label: 'Speed', value: Math.round(telemetry.speed * 3.6).toLocaleString('en-US') + ' KM/H' },
            ]}
          />
        </div>
        <p className="launch-caption mono" key={caption}>
          {caption}
        </p>
      </div>

      <button type="button" className="btn btn-quiet btn-sm launch-skip" onClick={finish}>
        Skip
      </button>
    </section>
  )
}
