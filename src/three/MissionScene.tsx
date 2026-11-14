import { Environment, Lightformer, Line } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { Line2 } from 'three-stdlib'
import { texts } from '../logic/data'
import type { Design, MissionPhase, OrbitId } from '../logic/types'
import { createDirector } from './launch/director'
import { Stars } from './launch/Sky'
import { Spacecraft3D } from './launch/Spacecraft3D'
import { createGlowTexture } from './launch/textures'
import { missionView } from './missionView'
import { createAtmosphereMaterial, createEarthMaterial, createJupiterMaterial, createMarsMaterial, createMoonMaterial } from './planets'

export interface MissionSceneProps {
  destinationId: string
  destinationName: string
  progress: number // 0 = at Earth, 1 = at the target
  glideMs: number // how long the spacecraft takes to reach a new `progress`
  phase: MissionPhase
  design: Design
  orbitId: OrbitId
}

const FOV = 30
// Same Sun direction as in the launch film, so the Earth is lit the same way in both.
const SUN = new THREE.Vector3(0.55, 0.4, 0.73).normalize()
const EARTH_POSITION = new THREE.Vector3(-7.2, -1.1, 0)
const EARTH_RADIUS = 1.35
const TARGET_POSITION = new THREE.Vector3(7.2, 0.5, 0)

// Size of the target, its own small moon (Europa goes round Jupiter), and how the spacecraft path ends.
function targetLook(destinationId: string) {
  if (destinationId === 'europa') {
    return { radius: 1.7, kind: 'jupiter' as const }
  }
  if (destinationId === 'moon') {
    return { radius: 0.8, kind: 'moon' as const }
  }
  return { radius: 0.95, kind: 'mars' as const }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

interface PlanetProps {
  material: THREE.Material
  radius: number
  position: THREE.Vector3
  spin: number
  segments?: number
}

function Planet({ material, radius, position, spin, segments = 72 }: PlanetProps) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y = mesh.current.rotation.y + Math.min(delta, 0.05) * spin
    }
  })
  return (
    <mesh ref={mesh} position={position} material={material} rotation={[0.35, 0, 0.2]}>
      <sphereGeometry args={[radius, segments, segments / 2]} />
    </mesh>
  )
}

// A small moon going round its planet on a tilted circle.
interface OrbitingMoonProps {
  center: THREE.Vector3
  distance: number
  radius: number
  speed: number
  material: THREE.Material
  group: RefObject<THREE.Group | null>
}

function OrbitingMoon({ center, distance, radius, speed, material, group }: OrbitingMoonProps) {
  useFrame((state) => {
    if (group.current) {
      const angle = state.clock.elapsedTime * speed + 0.8
      group.current.position.set(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance * 0.7, center.z + Math.sin(angle) * distance * 0.6)
    }
  })
  const ring = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) {
      const angle = (i / 96) * Math.PI * 2
      points.push(new THREE.Vector3(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance * 0.7, center.z + Math.sin(angle) * distance * 0.6))
    }
    return points
  }, [center, distance])

  return (
    <>
      <Line points={ring} color="#ffffff" transparent opacity={0.12} lineWidth={1} />
      <group ref={group}>
        <mesh material={material}>
          <sphereGeometry args={[radius, 40, 20]} />
        </mesh>
      </group>
    </>
  )
}

// HTML labels drawn over the 3D picture; the scene moves them to follow the planets.
interface SceneLabels {
  earth: HTMLSpanElement | null
  moon: HTMLSpanElement | null
  target: HTMLSpanElement | null
  europa: HTMLSpanElement | null
}

function MissionContent({ destinationId, progress, glideMs, phase, design, orbitId, labels }: MissionSceneProps & { labels: RefObject<SceneLabels> }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const target = targetLook(destinationId)
  const moon = useRef<THREE.Group>(null)
  const europa = useRef<THREE.Group>(null)

  const materials = useMemo(
    () => ({
      earth: createEarthMaterial(SUN),
      atmosphere: createAtmosphereMaterial(SUN),
      moon: createMoonMaterial(SUN),
      mars: createMarsMaterial(SUN),
      jupiter: createJupiterMaterial(SUN),
      signal: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 1.2) }),
      halo: new THREE.SpriteMaterial({
        map: createGlowTexture(),
        color: new THREE.Color(0.45, 1, 0.8),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    }),
    [],
  )

  // The spacecraft path: from just outside the Earth, up in an arc, to the target.
  const path = useMemo(() => {
    const start = EARTH_POSITION.clone().add(new THREE.Vector3(1.1, 1.0, 0.3))
    const end = TARGET_POSITION.clone().add(new THREE.Vector3(-target.radius - 0.35, 0.25, 0.3))
    const curve = new THREE.CubicBezierCurve3(start, new THREE.Vector3(-3, 4.4, 0.8), new THREE.Vector3(3, 4.4, 0.8), end)
    const back = new THREE.CubicBezierCurve3(end, new THREE.Vector3(3, -3.6, 1.2), new THREE.Vector3(-3, -3.6, 1.2), start)
    return { curve, back, points: curve.getSpacedPoints(120) }
  }, [target.radius])

  // Stars from the launch film; this stub keeps them fully visible.
  const starDirector = useMemo(() => {
    const d = createDirector()
    d.act = 2
    return d
  }, [])
  // The spacecraft model reads its unfolding and engine from here: panels open, engine on during launch.
  const craftDirector = useMemo(() => {
    const d = createDirector()
    d.deploy = 1
    return d
  }, [])
  const glowTexture = useMemo(() => createGlowTexture(), [])

  const craft = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Sprite>(null)
  const done = useRef<Line2>(null)
  const signals = useRef<(THREE.Mesh | null)[]>([])
  const glide = useRef({ from: progress, to: progress, start: 0, shown: progress })
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), tangent: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), roll: new THREE.Quaternion() }), [])

  // A new step: glide from where the spacecraft is now to the new place.
  useEffect(() => {
    const g = glide.current
    g.from = g.shown
    g.to = progress
    g.start = performance.now()
  }, [progress])

  useEffect(() => {
    return () => {
      missionView.earth = null
    }
  }, [])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    // Camera: far enough to fit the whole scene in this wide panel, drifting very slowly.
    const half = Math.tan(((FOV / 2) * Math.PI) / 180)
    const aspect = size.width / Math.max(1, size.height)
    const distance = Math.max(10.4 / (half * aspect), 4.6 / half)
    camera.position.set(Math.sin(time * 0.1) * 0.6, 0.9 + distance * 0.2, distance)
    camera.lookAt(0, 0.7, 0)

    // Spacecraft position along the path.
    const g = glide.current
    const k = glideMs > 0 ? Math.min(1, (performance.now() - g.start) / glideMs) : 1
    g.shown = g.from + (g.to - g.from) * easeInOut(k)
    const u = Math.min(1, Math.max(0, g.shown))
    path.curve.getPointAt(u, scratch.point)
    path.curve.getTangentAt(u, scratch.tangent)
    if (craft.current) {
      craft.current.position.copy(scratch.point)
      craft.current.quaternion.setFromUnitVectors(scratch.up, scratch.tangent)
      scratch.roll.setFromAxisAngle(scratch.up, time * 0.4)
      craft.current.quaternion.multiply(scratch.roll)
    }
    if (halo.current) {
      halo.current.position.copy(scratch.point)
      const pulse = 1.3 + Math.sin(time * 2.4) * 0.25
      halo.current.scale.set(pulse, pulse, 1)
    }
    craftDirector.craftEngine = phase === 'launch' ? 0.8 : 0

    // The finished part of the path is drawn in teal.
    if (done.current) {
      const segments = path.points.length - 1
      done.current.geometry.instanceCount = Math.max(0, Math.round(u * segments))
    }

    // Data on its way home: dots running from the target back to Earth.
    signals.current.forEach((dot, i) => {
      if (!dot) {
        return
      }
      dot.visible = phase === 'operations'
      const s = (time / 3 + i / 3) % 1
      path.back.getPointAt(s, dot.position)
    })

    // Labels follow their planets. A moon's label hides while the moon is behind its planet.
    const placeLabel = (label: HTMLSpanElement | null, position: THREE.Vector3, below: number, hidden: boolean) => {
      if (!label) {
        return
      }
      scratch.point.copy(position)
      scratch.point.y = scratch.point.y - below
      scratch.point.project(camera)
      const x = ((scratch.point.x + 1) / 2) * size.width
      const y = ((1 - scratch.point.y) / 2) * size.height
      label.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) translate(-50%, 0)'
      label.style.opacity = hidden ? '0' : '1'
    }
    const l = labels.current
    placeLabel(l.earth, EARTH_POSITION, EARTH_RADIUS + 0.25, false)
    placeLabel(l.target, TARGET_POSITION, target.radius + 0.25, false)
    if (moon.current) {
      placeLabel(l.moon, moon.current.position, 0.6, moon.current.position.z < EARTH_POSITION.z - 0.2)
    }
    if (europa.current) {
      placeLabel(l.europa, europa.current.position, 0.45, europa.current.position.z < TARGET_POSITION.z - 0.3)
    }

    // Tell the launch film where our Earth is on the screen.
    const box = gl.domElement.getBoundingClientRect()
    scratch.point.copy(EARTH_POSITION).project(camera)
    const earthDistance = camera.position.distanceTo(EARTH_POSITION)
    missionView.earth = {
      x: box.left + ((scratch.point.x + 1) / 2) * box.width,
      y: box.top + ((1 - scratch.point.y) / 2) * box.height,
      r: (EARTH_RADIUS / (earthDistance * half)) * (box.height / 2),
    }
  })

  const isMoonTarget = target.kind === 'moon'
  const targetMaterial = target.kind === 'jupiter' ? materials.jupiter : target.kind === 'moon' ? materials.moon : materials.mars

  return (
    <>
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.4} color="#fff1e0" position={[0, 6, 9]} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#86a8ff" position={[0, 10, -7]} scale={[16, 4, 1]} />
      </Environment>
      <directionalLight position={SUN.clone().multiplyScalar(30)} intensity={2.6} color="#fff4e6" />
      <ambientLight intensity={0.25} />
      <Stars director={starDirector} />

      {/* Earth, its air, and its Moon (unless the Moon is where we are going) */}
      <Planet material={materials.earth} radius={EARTH_RADIUS} position={EARTH_POSITION} spin={0.12} segments={96} />
      <mesh position={EARTH_POSITION} material={materials.atmosphere}>
        <sphereGeometry args={[EARTH_RADIUS * 1.06, 64, 32]} />
      </mesh>
      {!isMoonTarget && <OrbitingMoon center={EARTH_POSITION} distance={2.5} radius={0.36} speed={0.25} material={materials.moon} group={moon} />}

      {/* The target */}
      <Planet material={targetMaterial} radius={target.radius} position={TARGET_POSITION} spin={target.kind === 'jupiter' ? 0.3 : 0.08} />
      {target.kind === 'jupiter' && <OrbitingMoon center={TARGET_POSITION} distance={2.7} radius={0.2} speed={0.45} material={materials.moon} group={europa} />}

      {/* Path: whole route dashed, the part already flown in teal */}
      <Line points={path.points} color="#ffffff" transparent opacity={0.22} dashed dashSize={0.18} gapSize={0.22} lineWidth={1} />
      <Line ref={done} points={path.points} color="#5dcaa5" lineWidth={2.2} />

      {/* The player's own spacecraft, with a soft glow so it is easy to spot */}
      <sprite ref={halo} material={materials.halo} />
      <group ref={craft}>
        <group scale={0.36}>
          <Spacecraft3D design={design} orbitId={orbitId} director={craftDirector} glowTexture={glowTexture} />
        </group>
      </group>

      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          material={materials.signal}
          visible={false}
          ref={(m) => {
            signals.current[i] = m
          }}
        >
          <sphereGeometry args={[0.07, 12, 8]} />
        </mesh>
      ))}
    </>
  )
}

// The mission map in 3D: the Earth and its Moon, the target, the path, and the spacecraft flying it.
export default function MissionScene(props: MissionSceneProps) {
  const labels = useRef<SceneLabels>({ earth: null, moon: null, target: null, europa: null })
  const t = texts.ui.window
  const kind = targetLook(props.destinationId).kind
  return (
    <div className="mission-scene">
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} camera={{ fov: FOV, near: 0.1, far: 3000, position: [0, 3, 30] }}>
        <MissionContent {...props} labels={labels} />
      </Canvas>
      <span className="scene-label" ref={(el) => void (labels.current.earth = el)}>
        {t.earth}
      </span>
      {kind !== 'moon' && (
        <span className="scene-label scene-label-faint" ref={(el) => void (labels.current.moon = el)}>
          {t.moon}
        </span>
      )}
      <span className="scene-label scene-label-strong" ref={(el) => void (labels.current.target = el)}>
        {kind === 'jupiter' ? t.jupiter : props.destinationName}
      </span>
      {kind === 'jupiter' && (
        <span className="scene-label scene-label-faint" ref={(el) => void (labels.current.europa = el)}>
          {props.destinationName}
        </span>
      )}
    </div>
  )
}
