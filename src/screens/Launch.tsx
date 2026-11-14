import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Readout } from '../components/Readout'
import { fill, num, texts } from '../logic/data'
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

// ~10 second launch cinematic: countdown, lift-off, camera follow, stage separation, orbit, departure.
// It ends by fading into the mission screen, which is already drawn underneath.
// `onGone` is called when the film has fully faded out.
export function Launch({ onGone }: { onGone: () => void }) {
  const data = useMissionReport()
  const beginMission = useMission((s) => s.beginMission)
  const [countdown, setCountdown] = useState('T-5')
  const [caption, setCaption] = useState('')
  const [telemetry, setTelemetry] = useState<Telemetry>({ time: 0, altitude: 0, speed: 0 })

  const rootRef = useRef<HTMLElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const fadeRef = useRef<gsap.core.Tween | null>(null)
  const finishedRef = useRef(false)

  const size = data ? rocketSize(data.ctx.launchVehicle.id) : 'light'
  const t = texts.ui.launch

  // Start the mission under the film, then dissolve the film (gently zooming in, like flying into the screen).
  function finish(skipped: boolean) {
    if (finishedRef.current) {
      return
    }
    finishedRef.current = true
    if (skipped) {
      timelineRef.current?.kill()
    }
    beginMission()
    const root = rootRef.current
    if (!root) {
      onGone()
      return
    }
    root.style.pointerEvents = 'none'
    fadeRef.current = gsap.to(root, {
      opacity: 0,
      scale: 1.08,
      filter: 'blur(8px)',
      duration: skipped ? 0.6 : 1.3,
      ease: 'power2.inOut',
      onComplete: onGone,
    })
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const q = gsap.utils.selector(root)
    const telemetryProxy = { time: 0, altitude: 0, speed: 0 }
    const pushTelemetry = () => setTelemetry({ ...telemetryProxy })

    const tl = gsap.timeline({ onComplete: () => finish(false) })
    timelineRef.current = tl

    // Countdown T-5 .. T-0
    for (let i = 5; i >= 0; i--) {
      tl.call(() => setCountdown(i === 0 ? t.ignition : 'T-' + i), [], (5 - i) * 0.45)
    }
    tl.addLabel('ignition', 2.25)
    tl.to(q('.rocket-lower .flame'), { scaleY: 1, opacity: 1, duration: 0.4, ease: 'power2.out' }, 'ignition')
    tl.to(q('.smoke-puff'), { scale: 1, opacity: 0.9, duration: 1.6, stagger: 0.04, ease: 'power2.out' }, 'ignition')
    tl.fromTo(q('.launch-rocket'), { x: -1.5 }, { x: 1.5, duration: 0.05, repeat: 30, yoyo: true, ease: 'none' }, 'ignition')

    // Lift-off and climb: the world drops away (camera follows the rocket).
    tl.addLabel('liftoff', 'ignition+=0.7')
    tl.call(() => {
      setCountdown(t.liftoff)
      setCaption(fill(texts.log.launch[1].text, { rocket: data ? data.ctx.launchVehicle.name : '' }))
    }, [], 'liftoff')
    tl.to(q('.launch-rocket'), { y: '-22vh', duration: 2.2, ease: 'power2.in' }, 'liftoff')
    tl.to(q('.launch-world'), { y: '140vh', duration: 6.5, ease: 'power2.in' }, 'liftoff+=0.6')
    tl.to(q('.launch-sky'), { opacity: 0, duration: 5, ease: 'power1.in' }, 'liftoff+=1')
    tl.to(telemetryProxy, { time: 160, altitude: 70, speed: 2300, duration: 3.4, ease: 'power2.in', onUpdate: pushTelemetry }, 'liftoff')

    tl.call(() => setCaption(t.maxQ), [], 'liftoff+=1.6')

    // Stage separation: the empty first stage falls away.
    tl.addLabel('separation', 'liftoff+=3.4')
    tl.call(() => {
      setCountdown(t.stageSep)
      setCaption(t.separation)
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
      setCountdown(t.orbit)
      setCaption(fill(t.inOrbit, { destination: data ? data.ctx.destination.name : '' }))
    }, [], 'orbit+=1.4')

    // Departure: the upper stage fires again and the spacecraft heads off to the upper right,
    // the same way it starts on the mission map. The film dissolves into the mission while it flies.
    tl.addLabel('depart', 'orbit+=2')
    tl.to(q('.flame-upper'), { scaleY: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }, 'depart')
    tl.to(q('.launch-rocket'), { x: '46vw', y: '-58vh', scale: 0.08, rotation: 58, duration: 2, ease: 'power2.in' }, 'depart')
    tl.to(q('.launch-earth'), { y: '6vh', duration: 2.2, ease: 'power1.in' }, 'depart')
    tl.to(q('.launch-hud'), { opacity: 0, duration: 0.6, ease: 'power1.out' }, 'depart+=0.5')
    tl.call(() => finish(false), [], 'depart+=0.8')

    return () => {
      tl.kill()
      fadeRef.current?.kill()
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
              { label: t.met, value: 'T+' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') },
              { label: t.altitude, value: Math.round(telemetry.altitude) + ' ' + texts.units.km.toUpperCase() },
              { label: t.speed, value: num(telemetry.speed * 3.6) + ' ' + texts.units.kmh.toUpperCase() },
            ]}
          />
        </div>
        <p className="launch-caption mono" key={caption}>
          {caption}
        </p>
      </div>

      <button type="button" className="btn btn-quiet btn-sm launch-skip" onClick={() => finish(true)}>
        {texts.ui.skip}
      </button>
    </section>
  )
}
