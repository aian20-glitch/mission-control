import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { Readout } from '../components/Readout'
import { SceneBoundary } from '../components/SceneBoundary'
import { fill, num, texts } from '../logic/data'
import { useMission, useMissionReport } from '../store/useMission'
import { createDirector, smoothStep } from '../three/launch/director'
import { missionView } from '../three/missionView'
import { loadLaunchScene } from '../three/preload'

const LaunchScene = lazy(loadLaunchScene)

// When each part of the film happens, in seconds from the start.
const AT = {
  ignition: 1.7,
  liftoff: 2.3,
  climb: 4.5,
  maxQ: 4.9,
  haze: 5.7,
  space: 6.15,
  boosters: 6.9,
  meco: 7.5,
  stage: 7.7,
  upper: 8.1,
  fairing: 8.6,
  upperOff: 9.8,
  craft: 10.0,
  deploy: 10.4,
  depart: 11.6,
  morph: 13.6,
}

const MORPH_SECONDS = 1.8

type MilestoneKey = 'liftoff' | 'maxQ' | 'boosters' | 'stage' | 'fairing' | 'craft' | 'depart'

interface Telemetry {
  time: number
  altitude: number
  speed: number
}

// The launch film (3D): countdown, lift-off, climb through the clouds, stage separation in space,
// the spacecraft unfolding and leaving Earth. At the end the picture shrinks into the path panel
// of the mission screen, which is already drawn underneath. `onGone` is called when it has faded out.
export function Launch({ onGone }: { onGone: () => void }) {
  const data = useMissionReport()
  const design = useMission((s) => s.design)
  const beginMission = useMission((s) => s.beginMission)
  const director = useMemo(() => createDirector(), [])

  const [ready, setReady] = useState(false)
  const [countdown, setCountdown] = useState('T-5')
  const [caption, setCaption] = useState('')
  const [reached, setReached] = useState(0)
  const [telemetry, setTelemetry] = useState<Telemetry>({ time: 0, altitude: 0, speed: 0 })
  const [leaving, setLeaving] = useState(false)

  const rootRef = useRef<HTMLElement>(null)
  const hazeRef = useRef<HTMLDivElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const tweensRef = useRef<gsap.core.Tween[]>([])
  const finishedRef = useRef(false)

  const t = texts.ui.launch
  const hasBoosters = data ? data.ctx.launchVehicle.id !== 'lv_light' : false
  const milestones: MilestoneKey[] = hasBoosters
    ? ['liftoff', 'maxQ', 'boosters', 'stage', 'fairing', 'craft', 'depart']
    : ['liftoff', 'maxQ', 'stage', 'fairing', 'craft', 'depart']
  const milestoneLabels: Record<MilestoneKey, string> = {
    liftoff: t.msLiftoff,
    maxQ: t.msMaxQ,
    boosters: t.msBoosters,
    stage: t.msStage,
    fairing: t.msFairing,
    craft: t.msCraft,
    depart: t.msDepart,
  }

  function reach(key: MilestoneKey) {
    setReached(milestones.indexOf(key) + 1)
  }

  function fadeOut(seconds: number) {
    const root = rootRef.current
    if (!root) {
      onGone()
      return
    }
    tweensRef.current.push(gsap.to(root, { opacity: 0, duration: seconds, ease: 'power1.out', onComplete: onGone }))
  }

  // Skip: start the mission at once and fade the film away.
  function skip() {
    if (finishedRef.current) {
      return
    }
    finishedRef.current = true
    timelineRef.current?.kill()
    setLeaving(true)
    beginMission()
    fadeOut(0.5)
  }

  // The end of the film: the mission screen appears underneath and the picture shrinks
  // into its path panel, with the 3D Earth landing on the Earth of the 2D map. Then it fades.
  function shrinkIntoMission() {
    if (finishedRef.current) {
      return
    }
    finishedRef.current = true
    setLeaving(true)
    beginMission()
    const root = rootRef.current
    if (!root) {
      onGone()
      return
    }
    const startShrink = () => {
      const panel = document.querySelector('.trajectory-panel')
      if (!panel) {
        fadeOut(0.6)
        return
      }
      const progress = { value: 0 }
      tweensRef.current.push(
        gsap.to(progress, {
          value: 1,
          duration: MORPH_SECONDS,
          ease: 'none',
          onUpdate: () => {
            // Measured every frame: the mission screen is still settling into place.
            const box = panel.getBoundingClientRect()
            // The 3D Earth of the mission map; the flat map's Earth if 3D is not there.
            const earth = document.querySelector('.trajectory-earth')
            if (missionView.earth) {
              director.morphEarth = missionView.earth
            } else if (earth) {
              const e = earth.getBoundingClientRect()
              director.morphEarth = { x: e.left + e.width / 2, y: e.top + e.height / 2, r: e.width / 2 }
            }
            director.morph = progress.value
            const m = smoothStep(progress.value)
            const top = box.top * m
            const left = box.left * m
            const right = (window.innerWidth - box.right) * m
            const bottom = (window.innerHeight - box.bottom) * m
            root.style.clipPath = 'inset(' + top + 'px ' + right + 'px ' + bottom + 'px ' + left + 'px round ' + 16 * m + 'px)'
          },
          onComplete: () => fadeOut(0.9),
        }),
      )
    }

    // Wait until the mission screen is on the page and its 3D Earth is drawn (at most ~1.2 s),
    // so there is something to land on.
    const waitStart = performance.now()
    const waitForEarth = () => {
      if (!missionView.earth && performance.now() - waitStart < 1200) {
        requestAnimationFrame(waitForEarth)
        return
      }
      startShrink()
    }
    requestAnimationFrame(waitForEarth)
  }

  // The whole film as one timeline. It changes `director` (read by the 3D scene every frame)
  // and the HTML overlay (countdown, captions, telemetry).
  function startFilm() {
    if (timelineRef.current || !data) {
      return
    }
    const d = director
    const rocketName = data.ctx.launchVehicle.name
    const destination = data.ctx.destination.name
    const solar = data.ctx.powerSource.powerType === 'solar'
    const numbers: Telemetry = { time: 0, altitude: 0, speed: 0 }
    const pushNumbers = () => setTelemetry({ ...numbers })
    const tl = gsap.timeline()
    timelineRef.current = tl

    // Countdown. The camera drifts slowly around the rocket; the tower arms swing away.
    for (let i = 5; i >= 1; i--) {
      tl.call(() => setCountdown('T-' + i), [], (5 - i) * 0.34)
    }
    tl.to(d, { camOrbit: 0.3, camDistance: 1.55, duration: AT.liftoff, ease: 'sine.inOut' }, 0)
    tl.to(d, { arms: 1, duration: 1.2, ease: 'power2.inOut' }, 0.5)

    // Ignition: flame, smoke rolling out of the trench, the ground shakes.
    tl.call(
      () => {
        setCountdown(t.ignition)
        setCaption(t.ignitionCaption)
      },
      [],
      AT.ignition,
    )
    tl.to(d, { engine: 1, duration: 0.5, ease: 'power2.out' }, AT.ignition)
    tl.to(d, { groundSmoke: 1, shake: 1, duration: 0.4 }, AT.ignition)
    tl.to(d, { vapor: 0, duration: 0.8 }, AT.ignition)

    // Lift-off: slow at first. The camera stays on the ground and looks up.
    tl.call(
      () => {
        setCountdown(t.liftoff)
        setCaption(fill(texts.log.launch[1].text, { rocket: rocketName }))
        reach('liftoff')
      },
      [],
      AT.liftoff,
    )
    tl.to(d, { rocketY: 1.3, duration: AT.climb - AT.liftoff, ease: 'power2.in' }, AT.liftoff)
    tl.to(d, { camDistance: 2, camHeight: 0.22, lookAt: 0.4, duration: AT.climb - AT.liftoff, ease: 'sine.inOut' }, AT.liftoff)
    tl.to(d, { shake: 0.45, duration: 1.5 }, AT.liftoff + 0.4)
    tl.to(numbers, { time: 40, altitude: 3, speed: 150, duration: AT.climb - AT.liftoff, ease: 'power2.in', onUpdate: pushNumbers }, AT.liftoff)

    // Climb: the camera rises with the rocket and pulls back; the sky darkens.
    const climb = AT.space - AT.climb
    tl.to(d, { rocketY: 34, duration: climb, ease: 'power2.in' }, AT.climb)
    tl.to(d, { follow: 0.93, duration: climb, ease: 'power1.inOut' }, AT.climb)
    tl.to(d, { camDistance: 7, camOrbit: 0.55, duration: climb, ease: 'power1.in' }, AT.climb)
    tl.to(d, { lookAt: 0.6, duration: 1 }, AT.climb)
    tl.to(d, { pitch: 0.38, duration: climb, ease: 'sine.in' }, AT.climb)
    tl.to(d, { sky: 0.6, duration: climb, ease: 'power1.in' }, AT.climb)
    tl.to(d, { groundSmoke: 0.25, duration: 1.2 }, AT.climb)
    tl.to(d, { shake: 0.15, duration: 1 }, AT.climb + 0.5)
    tl.call(
      () => {
        setCaption(t.maxQ)
        reach('maxQ')
      },
      [],
      AT.maxQ,
    )
    tl.to(numbers, { time: 80, altitude: 60, speed: 1700, duration: climb, ease: 'power2.in', onUpdate: pushNumbers }, AT.climb)

    // Through the clouds. The haze hides the change from the pad to space.
    if (hazeRef.current) {
      tl.to(hazeRef.current, { opacity: 1, duration: AT.space - AT.haze, ease: 'power1.in' }, AT.haze)
      tl.to(hazeRef.current, { opacity: 0, duration: 0.8, ease: 'power1.out' }, AT.space)
    }
    tl.call(
      () => {
        d.act = 2
        d.shake = 0
      },
      [],
      AT.space,
    )
    tl.call(
      () => {
        setCountdown(t.space)
        setCaption(t.spaceCaption)
      },
      [],
      AT.space + 0.2,
    )
    tl.to(d, { spaceOrbit: -0.3, duration: AT.depart - AT.space, ease: 'sine.inOut' }, AT.space)
    tl.to(numbers, { time: 300, altitude: 140, speed: 5200, duration: AT.upperOff - 0.6 - AT.space, ease: 'none', onUpdate: pushNumbers }, AT.space)

    // Boosters fall away (only rockets that have them).
    if (hasBoosters) {
      tl.call(
        () => {
          setCountdown(t.boosterSep)
          setCaption(t.boosterCaption)
          reach('boosters')
        },
        [],
        AT.boosters,
      )
      tl.to(d, { boosterSep: 1, duration: 2.6, ease: 'none' }, AT.boosters)
    }
    tl.to(d, { spaceDistance: 0.95, duration: 1.4, ease: 'sine.inOut' }, AT.boosters)

    // Main engine off, first stage drops, the upper stage takes over.
    tl.to(d, { engine: 0, duration: 0.25 }, AT.meco)
    tl.call(
      () => {
        setCountdown(t.stageSep)
        setCaption(t.separation)
        reach('stage')
      },
      [],
      AT.stage,
    )
    tl.to(d, { stageSep: 1, duration: 2.6, ease: 'none' }, AT.stage)
    tl.to(d, { spaceDistance: 0.6, duration: 1.6, ease: 'sine.inOut' }, AT.stage)
    tl.to(d, { upperEngine: 1, duration: 0.4, ease: 'power2.out' }, AT.upper)

    // The nose cone opens and shows the spacecraft.
    tl.call(
      () => {
        setCountdown(t.fairingSep)
        setCaption(t.fairingCaption)
        reach('fairing')
      },
      [],
      AT.fairing,
    )
    tl.to(d, { fairingSep: 1, duration: 2.3, ease: 'none' }, AT.fairing)
    tl.to(d, { spaceDistance: 0.34, duration: 1.6, ease: 'sine.inOut' }, AT.fairing + 0.3)

    // In orbit.
    tl.to(d, { upperEngine: 0, duration: 0.3 }, AT.upperOff)
    tl.to(numbers, { time: 520, altitude: 200, speed: 7800, duration: 0.6, ease: 'power1.out', onUpdate: pushNumbers }, AT.upperOff - 0.6)
    tl.call(
      () => {
        setCountdown(t.orbit)
        setCaption(fill(t.inOrbit, { destination }))
      },
      [],
      AT.upperOff,
    )

    // The spacecraft is let go and unfolds.
    tl.call(
      () => {
        setCountdown(t.craftSep)
        setCaption(t.craftCaption)
        reach('craft')
      },
      [],
      AT.craft,
    )
    tl.to(d, { craftSep: 1, duration: 1.8, ease: 'power1.out' }, AT.craft)
    tl.to(d, { spaceDistance: 0.24, duration: 1.6, ease: 'sine.inOut' }, AT.craft)
    tl.to(d, { deploy: 1, duration: 1.4, ease: 'power2.inOut' }, AT.deploy)
    tl.call(() => setCaption(solar ? t.deploySolar : t.deployRtg), [], AT.deploy + 0.3)

    // Departure: one last push, and the camera pulls back until we see the whole Earth.
    tl.call(
      () => {
        setCountdown(fill(t.depart, { destination: destination.toUpperCase() }))
        setCaption(fill(t.departCaption, { destination }))
        reach('depart')
      },
      [],
      AT.depart,
    )
    tl.to(d, { craftEngine: 1, duration: 0.3 }, AT.depart)
    tl.to(d, { depart: 1, duration: AT.morph - AT.depart + 0.5, ease: 'none' }, AT.depart)
    tl.to(numbers, { time: 900, altitude: 9000, speed: 11200, duration: 2, ease: 'power1.in', onUpdate: pushNumbers }, AT.depart)
    tl.to(d, { craftEngine: 0, duration: 0.6 }, AT.morph)
    if (hudRef.current) {
      tl.to(hudRef.current, { opacity: 0, duration: 0.6 }, AT.morph - 0.5)
    }
    tl.call(shrinkIntoMission, [], AT.morph)
  }

  useEffect(() => {
    if (ready) {
      startFilm()
    }
    // The film starts once, when the 3D scene is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    return () => {
      timelineRef.current?.kill()
      for (const tween of tweensRef.current) {
        tween.kill()
      }
    }
  }, [])

  if (!data) {
    return null
  }

  const minutes = Math.floor(telemetry.time / 60)
  const seconds = Math.floor(telemetry.time % 60)

  return (
    <section className="launch-screen" ref={rootRef}>
      <div className={'launch-canvas' + (ready ? ' is-ready' : '')}>
        <SceneBoundary onError={skip}>
          <Suspense fallback={null}>
            <LaunchScene
              director={director}
              launchVehicleId={data.ctx.launchVehicle.id}
              design={design}
              orbitId={data.ctx.orbit.id}
              onReady={() => setReady(true)}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="launch-haze" ref={hazeRef} aria-hidden="true" />
      {!ready && <p className="launch-loading mono">{t.loading}</p>}

      <div className="launch-hud" ref={hudRef}>
        <div className="launch-countdown mono">{countdown}</div>
        <ol className="launch-track" aria-label={t.track}>
          {milestones.map((key, i) => (
            <li key={key} className={i < reached ? 'is-done' : undefined}>
              <span className="launch-track-dot" />
              {milestoneLabels[key]}
            </li>
          ))}
        </ol>
        <div className="launch-telemetry">
          <Readout
            rows={[
              { label: t.met, value: 'T+' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') },
              { label: t.altitude, value: num(Math.round(telemetry.altitude)) + ' ' + texts.units.km.toUpperCase() },
              { label: t.speed, value: num(Math.round((telemetry.speed * 3.6) / 10) * 10) + ' ' + texts.units.kmh.toUpperCase() },
            ]}
          />
        </div>
        <p className="launch-caption" key={caption}>
          {caption}
        </p>
      </div>

      {!leaving && (
        <button type="button" className="btn btn-quiet btn-sm launch-skip" onClick={skip}>
          {texts.ui.skip}
        </button>
      )}
    </section>
  )
}
