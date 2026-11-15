import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Design, OrbitId } from '../../logic/types'
import type { LaunchDirector } from './director'
import { Flame } from './Flame'
import type { EngineSpec, RocketSpec } from './rocketSpecs'
import { Spacecraft3D } from './Spacecraft3D'

// The rockets are real NASA models (NASA 3D Resources), simplified and cut into stages
// by scripts/models/*.py. Every file holds the same named parts:
//   stage1 (only the three-stage rocket), core, boosterL / boosterR (only the rocket with boosters),
//   upper, fairingL / fairingR (the two halves of the nose).
// Sizes are in meters (1 unit = 1 m), measured from the bottom of the engines.

const MODEL_FOLDER = import.meta.env.BASE_URL + 'models/'
// The models are packed with Draco; the unpacker is served from our own site, not a CDN.
const DRACO_FOLDER = import.meta.env.BASE_URL + 'draco/'

// Points on the scene that the camera and the smoke need to know about.
export interface RocketMarkers {
  coreNozzle: THREE.Object3D | null
  interstage: THREE.Object3D | null
  craft: THREE.Object3D | null
}

// An engine bell, hanging down from y = 0.
function bellGeometry(exitRadius: number, length: number): THREE.LatheGeometry {
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const r = exitRadius * (0.38 + 0.62 * Math.pow(t, 0.7))
    points.push(new THREE.Vector2(r, -t * length))
  }
  return new THREE.LatheGeometry(points, 28)
}

interface Part {
  object: THREE.Object3D
  // Where the middle of the part sits when the rocket is whole.
  rest: THREE.Vector3
}

type PartName = 'stage1' | 'core' | 'boosterL' | 'boosterR' | 'upper' | 'fairingL' | 'fairingR'

const PART_NAMES: PartName[] = ['stage1', 'core', 'boosterL', 'boosterR', 'upper', 'fairingL', 'fairingR']

// Take the named parts out of the loaded file. Each part is moved to its own origin,
// so the group that holds it can be placed, pushed away and tumbled around its middle.
function takeParts(scene: THREE.Object3D, plainPaint: boolean): Partial<Record<PartName, Part>> {
  const copy = scene.clone(true)
  const parts: Partial<Record<PartName, Part>> = {}
  for (const name of PART_NAMES) {
    const object = copy.getObjectByName(name)
    if (!object) {
      continue
    }
    const rest = object.position.clone()
    object.position.set(0, 0, 0)
    object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) {
        return
      }
      mesh.frustumCulled = false
      const material = (mesh.material as THREE.MeshStandardMaterial).clone()
      // The nose halves are open shells: their inside must be drawn too.
      if (name === 'fairingL' || name === 'fairingR') {
        material.side = THREE.DoubleSide
      }
      material.envMapIntensity = 1.15
      if (plainPaint && material.map) {
        material.map = null
        material.color.set('#e9e7e1')
        material.roughness = 0.45
      }
      mesh.material = material
    })
    parts[name] = { object, rest }
  }
  return parts
}

interface RocketProps {
  spec: RocketSpec
  design: Design
  orbitId: OrbitId
  director: LaunchDirector
  glowTexture: THREE.Texture
  markers: RocketMarkers
}

// The whole rocket. Its parts move apart when the director's separation values go from 0 to 1.
// All motion here is relative to the rocket: a dropped stage "falls behind" because the rest keeps speeding up.
export function Rocket({ spec, design, orbitId, director, glowTexture, markers }: RocketProps) {
  const L = spec.length
  const gltf = useGLTF(MODEL_FOLDER + spec.file, DRACO_FOLDER)
  const parts = useMemo(() => takeParts(gltf.scene, spec.plainPaint), [gltf.scene, spec.plainPaint])

  const stage1 = useRef<THREE.Group>(null)
  const core = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const payload = useRef<THREE.Group>(null)
  const boosters = useRef<(THREE.Group | null)[]>([])
  const fairings = useRef<(THREE.Group | null)[]>([])

  const extras = useMemo(
    () => ({
      metal: new THREE.MeshStandardMaterial({ color: '#555a62', roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }),
      upperBell: bellGeometry(spec.upperRadius * 0.5, spec.upperRadius * 0.9),
    }),
    [spec.upperRadius],
  )

  useFrame(() => {
    const d = director
    const p = d.boosterSep

    // Side boosters: drift outward, fall behind and tumble.
    const sideParts = [parts.boosterL, parts.boosterR]
    boosters.current.forEach((group, i) => {
      const part = sideParts[i]
      if (!group || !part) {
        return
      }
      const side = i === 0 ? -1 : 1
      group.position.set(part.rest.x + side * (p * L * 0.1 + p * p * L * 0.35), part.rest.y - p * p * L * 0.9, part.rest.z)
      group.rotation.set(p * 0.3, 0, -side * p * 0.9)
      group.visible = p < 0.995
    })

    // A whole first stage (three-stage rocket): falls straight behind and slowly turns over.
    if (stage1.current && parts.stage1) {
      const rest = parts.stage1.rest
      stage1.current.position.set(rest.x - p * L * 0.03, rest.y - (p * L * 0.05 + p * p * L * 1.1), rest.z)
      stage1.current.rotation.set(p * 0.2, 0, -p * 0.4)
      stage1.current.visible = p < 0.995
    }

    // Core stage: falls behind and slowly turns over.
    if (core.current && parts.core) {
      const q = d.stageSep
      const rest = parts.core.rest
      core.current.position.set(rest.x + q * L * 0.04, rest.y - (q * L * 0.05 + q * q * L * 0.9), rest.z)
      core.current.rotation.set(q * 0.25, 0, q * 0.45)
      core.current.visible = q < 0.995
    }

    // Nose halves: open like a clam shell and drift away.
    fairings.current.forEach((pivot, i) => {
      if (!pivot) {
        return
      }
      const side = i === 0 ? -1 : 1
      const f = d.fairingSep
      pivot.position.set(side * (spec.fairingRadius + f * L * 0.06 + f * f * L * 0.3), spec.upperTop - f * f * L * 0.35, 0)
      pivot.rotation.z = -side * (Math.min(1, f * 1.8) * 0.8 + f * 0.6)
      pivot.visible = f < 0.995
    })

    // Upper stage: after the spacecraft is let go, it falls behind.
    if (upper.current && parts.upper) {
      const c = d.craftSep
      upper.current.position.set(parts.upper.rest.x, parts.upper.rest.y - c * c * L * 0.3, parts.upper.rest.z)
      upper.current.rotation.z = -c * 0.35
    }

    // Spacecraft: pushed forward a little, then flies away on its own.
    if (payload.current) {
      const c = d.craftSep
      const u = d.depart
      // Forward along the nose, curving a little toward the planet: in the last shot
      // it ends up above and to the right of the Earth.
      const forward = c * 3 + u * u * 13900
      const curve = u * u * 3200
      payload.current.position.set(curve, spec.payloadY + forward, 0)
    }
  })

  // Flames of the engines that leave with the boosters or with the first stage.
  function boosterFlame(engine: EngineSpec, rest: THREE.Vector3) {
    return (
      <group position={[engine.x - rest.x, engine.y - rest.y, -rest.z]}>
        <Flame
          radius={engine.radius}
          length={engine.length}
          intensity={() => (director.boosterSep > 0 ? 0 : director.engine)}
          vacuum={() => (director.act === 2 ? 1 : 0)}
          glowTexture={glowTexture}
          color={engine.color}
        />
      </group>
    )
  }

  function coreIntensity(): number {
    if (spec.coreStartsAfterBoosters && director.boosterSep < 0.06) {
      return 0
    }
    return director.engine
  }

  const sideParts = [parts.boosterL, parts.boosterR]
  const fairingParts = [parts.fairingL, parts.fairingR]

  return (
    <group>
      {/* The place of the engines at lift-off: smoke trail and engine light start here */}
      <object3D
        position={[0, 0.2, 0]}
        ref={(o) => {
          markers.coreNozzle = o
        }}
      />

      {/* First stage of the three-stage rocket */}
      {parts.stage1 && (
        <group ref={stage1} position={parts.stage1.rest}>
          <primitive object={parts.stage1.object} />
          {spec.boosterEngines.map((engine, i) => (
            <group key={i}>{boosterFlame(engine, parts.stage1!.rest)}</group>
          ))}
        </group>
      )}

      {/* Side boosters */}
      {sideParts.map((part, i) => {
        if (!part) {
          return null
        }
        const engine = spec.boosterEngines[i]
        return (
          <group
            key={i}
            position={part.rest}
            ref={(g) => {
              boosters.current[i] = g
            }}
          >
            <primitive object={part.object} />
            {engine && boosterFlame(engine, part.rest)}
          </group>
        )
      })}

      {/* Core stage */}
      {parts.core && (
        <group ref={core} position={parts.core.rest}>
          <primitive object={parts.core.object} />
          <object3D
            position={[-parts.core.rest.x, spec.upperBottom - parts.core.rest.y, -parts.core.rest.z]}
            ref={(o) => {
              markers.interstage = o
            }}
          />
          {spec.coreEngines.map((engine, i) => (
            <group key={i} position={[engine.x - parts.core!.rest.x, engine.y - parts.core!.rest.y, -parts.core!.rest.z]}>
              <Flame
                radius={engine.radius}
                length={engine.length}
                intensity={coreIntensity}
                vacuum={() => (director.act === 2 ? 1 : 0)}
                glowTexture={glowTexture}
                color={engine.color}
              />
            </group>
          ))}
        </group>
      )}

      {/* Upper stage, with its engine hidden inside the rocket until the core drops */}
      {parts.upper && (
        <group ref={upper} position={parts.upper.rest}>
          <primitive object={parts.upper.object} />
          <group position={[-parts.upper.rest.x, spec.upperBottom - parts.upper.rest.y + 0.3, -parts.upper.rest.z]}>
            <mesh geometry={extras.upperBell} material={extras.metal} />
            <group position={[0, -spec.upperRadius * 0.85, 0]}>
              <Flame
                radius={spec.upperRadius * 0.5}
                length={spec.upperRadius * 6}
                intensity={() => director.upperEngine}
                vacuum={() => 1}
                glowTexture={glowTexture}
                color="blue"
              />
            </group>
          </group>
        </group>
      )}

      {/* The spacecraft inside the nose */}
      <group
        ref={(g) => {
          payload.current = g
          markers.craft = g
        }}
        position={[0, spec.payloadY, 0]}
      >
        <group scale={spec.payloadScale}>
          <Spacecraft3D design={design} orbitId={orbitId} director={director} glowTexture={glowTexture} />
        </group>
      </group>

      {/* Nose halves, each turning on a hinge at its base */}
      {fairingParts.map((part, i) => {
        if (!part) {
          return null
        }
        const side = i === 0 ? -1 : 1
        return (
          <group
            key={'fairing' + i}
            ref={(g) => {
              fairings.current[i] = g
            }}
            position={[side * spec.fairingRadius, spec.upperTop, 0]}
          >
            <primitive object={part.object} position={[part.rest.x - side * spec.fairingRadius, part.rest.y - spec.upperTop, part.rest.z]} />
          </group>
        )
      })}
    </group>
  )
}
