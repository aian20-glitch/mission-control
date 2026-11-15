import { Environment, Lightformer, Line } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Design, OrbitId } from '../logic/types'
import { createDirector } from './launch/director'
import { Stars } from './launch/Sky'
import { Spacecraft3D } from './launch/Spacecraft3D'
import { createGlowTexture } from './launch/textures'
import {
  createAtmosphereMaterial,
  createEarthMaterial,
  createEuropaMaterial,
  createJupiterMaterial,
  createMarsMaterial,
  createMoonMaterial,
} from './planets'
import { stageView } from './stageView'

export interface StageSceneProps {
  design: Design
  // Called when the player clicks a planet: 0 = Earth, 1 = Moon, 2 = Mars, 3 = Europa.
  onPick: (stop: number) => void
}

const FOV = 40
const SUN = new THREE.Vector3(-0.62, 0.38, 0.69).normalize()

// The trip leads away from the Earth, and the camera always looks back toward it.
// So the Earth shrinks behind each new world: at Mars it is only a pale blue dot.
// Distances are not to scale (the real ones would leave every planet a single pixel).
interface World {
  center: THREE.Vector3
  radius: number
  // Camera place and aim at this stop, measured from the planet's middle, in planet radii.
  camera: THREE.Vector3
  aim: THREE.Vector3
}

const WORLDS: World[] = [
  { center: new THREE.Vector3(0, 0, 0), radius: 2, camera: new THREE.Vector3(-0.75, 0.2, 2.75), aim: new THREE.Vector3(-0.95, 0.05, 0) },
  { center: new THREE.Vector3(3.2, 0.6, 15), radius: 0.75, camera: new THREE.Vector3(-1.5, 0.3, 4.4), aim: new THREE.Vector3(-1.45, 0.05, 0) },
  { center: new THREE.Vector3(4.2, -0.6, 46), radius: 1.35, camera: new THREE.Vector3(-1.3, 0.25, 4.1), aim: new THREE.Vector3(-1.4, 0.05, 0) },
  { center: new THREE.Vector3(5, 1, 92), radius: 0.85, camera: new THREE.Vector3(-1.7, 0.2, 4.6), aim: new THREE.Vector3(-1.2, 0.5, 0) },
]
const JUPITER_CENTER = new THREE.Vector3(13.5, 5, 78)
const JUPITER_RADIUS = 7.5

// Orbit view: the planet sits in the left half of the picture, the cards are on the right.
const ORBIT_CAMERA = new THREE.Vector3(0.9, 0.9, 5.6)
const ORBIT_AIM = new THREE.Vector3(1.75, 0, 0)

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function ease(x: number): number {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

// Where the spacecraft is on its way past, around or down to the planet.
// t runs 0..1 and then repeats. The result is in planet radii, measured from the planet's middle.
function craftPlace(orbitId: string, t: number, out: THREE.Vector3): THREE.Vector3 {
  if (orbitId === 'flyby') {
    // One fast pass: comes in from the left, bends a little around the planet, leaves to the right.
    const u = t * 2 - 1
    return out.set(u * 4.4, 0.35 - u * 0.25, 1.55 + u * u * 1.2)
  }
  if (orbitId === 'lander') {
    // Down from orbit to the ground, then it stays there.
    const fall = ease(t / 0.72)
    const angle = -2.4 + fall * 2.75
    const distance = 2.1 - fall * 1.05
    return out.set(Math.sin(angle) * distance, 0.28 * distance, Math.cos(angle) * distance)
  }
  // Orbiter: round and round on a tilted circle.
  const angle = t * Math.PI * 2
  const x = Math.cos(angle) * 1.8
  const flat = Math.sin(angle) * 1.8
  return out.set(x, flat * Math.sin(0.42), flat * Math.cos(0.42))
}

function pathPoints(orbitId: string): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const end = orbitId === 'lander' ? 0.72 : 1
  for (let i = 0; i <= 96; i++) {
    points.push(craftPlace(orbitId, (i / 96) * end, new THREE.Vector3()))
  }
  return points
}

const PATHS: Record<string, THREE.Vector3[]> = {
  flyby: pathPoints('flyby'),
  orbiter: pathPoints('orbiter'),
  lander: pathPoints('lander'),
}
// Seconds for one pass, one lap, or one landing (with a pause on the ground).
const PATH_SECONDS: Record<string, number> = { flyby: 7, orbiter: 9, lander: 9 }

function StageContent({ design, onPick }: StageSceneProps) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const director = useMemo(() => {
    const d = createDirector()
    d.act = 2
    d.deploy = 1
    return d
  }, [])

  const materials = useMemo(
    () => ({
      earth: createEarthMaterial(SUN),
      atmosphere: createAtmosphereMaterial(SUN),
      moon: createMoonMaterial(SUN),
      mars: createMarsMaterial(SUN),
      europa: createEuropaMaterial(SUN),
      jupiter: createJupiterMaterial(SUN),
    }),
    [],
  )
  const glowTexture = useMemo(() => createGlowTexture(), [])

  const globes = useRef<(THREE.Mesh | null)[]>([])
  const jupiter = useRef<THREE.Mesh>(null)
  const craft = useRef<THREE.Group>(null)
  const pathGroup = useRef<THREE.Group>(null)
  const orbitBlend = useRef(0)
  const shownOrbit = useRef<string>('orbiter')
  const pathClock = useRef(0)

  const curves = useMemo(() => {
    const places = WORLDS.map((w) => w.center.clone().addScaledVector(w.camera, w.radius))
    const aims = WORLDS.map((w) => w.center.clone().addScaledVector(w.aim, w.radius))
    return {
      place: new THREE.CatmullRomCurve3(places, false, 'catmullrom', 0.35),
      aim: new THREE.CatmullRomCurve3(aims, false, 'catmullrom', 0.35),
    }
  }, [])

  const v = useMemo(
    () => ({
      place: new THREE.Vector3(),
      aim: new THREE.Vector3(),
      orbitPlace: new THREE.Vector3(),
      orbitAim: new THREE.Vector3(),
      now: new THREE.Vector3(),
      next: new THREE.Vector3(),
      up: new THREE.Vector3(),
      y: new THREE.Vector3(0, 1, 0),
      turn: new THREE.Quaternion(),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    materials.earth.uniforms.uTime.value = state.clock.elapsedTime

    // The planets turn slowly.
    globes.current.forEach((globe, i) => {
      if (globe) {
        globe.rotation.y = globe.rotation.y + dt * (i === 0 ? 0.035 : 0.05)
      }
    })
    if (jupiter.current) {
      jupiter.current.rotation.y = jupiter.current.rotation.y + dt * 0.03
    }

    // Camera on the trip between the worlds.
    const t = clamp01(stageView.progress / (WORLDS.length - 1))
    curves.place.getPoint(t, v.place)
    curves.aim.getPoint(t, v.aim)

    // Close view of one world, for choosing how to meet it. The camera glides between the two views.
    const wanted = stageView.mode === 'orbit' ? 1 : 0
    orbitBlend.current = orbitBlend.current + (wanted - orbitBlend.current) * Math.min(1, dt * 3.2)
    const blend = ease(orbitBlend.current)
    const world = WORLDS[Math.min(WORLDS.length - 1, Math.max(1, stageView.focus))]
    if (blend > 0.001) {
      v.orbitPlace.copy(world.center).addScaledVector(ORBIT_CAMERA, world.radius)
      v.orbitAim.copy(world.center).addScaledVector(ORBIT_AIM, world.radius)
      v.place.lerp(v.orbitPlace, blend)
      v.aim.lerp(v.orbitAim, blend)
    }

    // A slow, small drift, so the picture is never completely still.
    const time = state.clock.elapsedTime
    v.place.x = v.place.x + Math.sin(time * 0.21) * 0.035
    v.place.y = v.place.y + Math.sin(time * 0.17 + 1.3) * 0.025
    camera.position.copy(v.place)
    camera.lookAt(v.aim)

    // The spacecraft and its path, shown only in the close view.
    if (stageView.orbitId) {
      shownOrbit.current = stageView.orbitId
    }
    const orbitId = shownOrbit.current
    const visible = blend > 0.35
    if (pathGroup.current) {
      pathGroup.current.visible = visible
      pathGroup.current.position.copy(world.center)
      pathGroup.current.scale.setScalar(world.radius)
      pathGroup.current.children.forEach((child) => {
        child.visible = child.name === orbitId
      })
    }
    if (craft.current) {
      craft.current.visible = visible
      pathClock.current = (pathClock.current + dt / (PATH_SECONDS[orbitId] ?? 8)) % 1
      const at = pathClock.current
      craftPlace(orbitId, at, v.now)
      craftPlace(orbitId, Math.min(1, at + 0.01), v.next)
      craft.current.position.copy(world.center).addScaledVector(v.now, world.radius)
      craft.current.scale.setScalar(world.radius * 0.17)
      // The spacecraft's top points where it is going; a lander's top points away from the ground.
      if (orbitId === 'lander') {
        v.up.copy(v.now).normalize()
      } else {
        v.up.copy(v.next).sub(v.now).normalize()
      }
      if (v.up.lengthSq() > 0.0001) {
        v.turn.setFromUnitVectors(v.y, v.up)
        craft.current.quaternion.slerp(v.turn, Math.min(1, dt * 6))
      }
    }
  })

  const worldMaterials = [materials.earth, materials.moon, materials.mars, materials.europa]

  return (
    <>
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.3} color="#fff4e6" position={[-8, 5, 9]} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#7fa2ff" position={[6, 3, -8]} scale={[10, 4, 1]} />
      </Environment>
      <directionalLight position={SUN.clone().multiplyScalar(100)} intensity={3} color="#fff4e6" />
      <hemisphereLight args={['#22304d', '#0b0f18', 0.45]} />
      <Stars director={director} />

      {WORLDS.map((world, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            globes.current[i] = mesh
          }}
          position={world.center}
          rotation={[0.3, i * 1.7, 0.12]}
          material={worldMaterials[i]}
          onClick={(event) => {
            event.stopPropagation()
            onPick(i)
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = ''
          }}
        >
          <sphereGeometry args={[world.radius, 96, 48]} />
        </mesh>
      ))}
      <mesh position={WORLDS[0].center} material={materials.atmosphere}>
        <sphereGeometry args={[WORLDS[0].radius * 1.025, 72, 36]} />
      </mesh>
      <mesh ref={jupiter} position={JUPITER_CENTER} rotation={[0.1, 0, 0.06]} material={materials.jupiter}>
        <sphereGeometry args={[JUPITER_RADIUS, 96, 48]} />
      </mesh>

      {/* The three ways to meet a planet, drawn as thin lines around it */}
      <group ref={pathGroup} visible={false}>
        {Object.keys(PATHS).map((id) => (
          <group key={id} name={id}>
            <Line points={PATHS[id]} color="#5dcaa5" transparent opacity={0.75} lineWidth={1.4} dashed dashSize={0.09} gapSize={0.06} />
          </group>
        ))}
      </group>

      <group ref={craft} visible={false}>
        <Spacecraft3D design={design} orbitId={(stageView.orbitId ?? 'orbiter') as OrbitId} director={director} glowTexture={glowTexture} />
      </group>
    </>
  )
}

// The 3D stage behind the first screens: the Earth, the Moon, Mars, and Europa with Jupiter.
// The title and target screens fly the camera from world to world; the orbit screen shows
// the spacecraft passing, circling or landing.
export default function StageScene(props: StageSceneProps) {
  return (
    <Canvas dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }} camera={{ fov: FOV, near: 0.1, far: 4000, position: [-1.5, 0.4, 5.5] }}>
      <color attach="background" args={['#05080d']} />
      <StageContent {...props} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={1} luminanceSmoothing={0.3} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.25} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  )
}
