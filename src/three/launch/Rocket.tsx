import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Design, OrbitId } from '../../logic/types'
import type { LaunchDirector } from './director'
import { Flame } from './Flame'
import { Spacecraft3D } from './Spacecraft3D'

// Sizes in meters (1 unit = 1 m). Close to the real rockets in each class.
export interface RocketSpec {
  coreRadius: number
  coreHeight: number
  coreColor: string
  boosters: 'none' | 'solid' | 'cores'
  boosterRadius: number
  boosterHeight: number
  boosterOffset: number
  upperRadius: number
  upperHeight: number
  fairingRadius: number
  fairingCylinder: number
  fairingNose: number
  bellLength: number
}

const INTERSTAGE = 1.4

const SPECS: Record<string, RocketSpec> = {
  // Delta II class: one core, small upper stage.
  lv_light: {
    coreRadius: 1.25,
    coreHeight: 24,
    coreColor: '#e8e6e0',
    boosters: 'none',
    boosterRadius: 0,
    boosterHeight: 0,
    boosterOffset: 0,
    upperRadius: 1.25,
    upperHeight: 6,
    fairingRadius: 1.5,
    fairingCylinder: 3.8,
    fairingNose: 4.6,
    bellLength: 1.8,
  },
  // Atlas V class: bronze core with solid boosters strapped on.
  lv_medium: {
    coreRadius: 1.9,
    coreHeight: 31,
    coreColor: '#c98e58',
    boosters: 'solid',
    boosterRadius: 0.8,
    boosterHeight: 18,
    boosterOffset: 2.85,
    upperRadius: 1.6,
    upperHeight: 11,
    fairingRadius: 2.5,
    fairingCylinder: 6,
    fairingNose: 6.5,
    bellLength: 2.2,
  },
  // Falcon Heavy class: three cores side by side.
  lv_heavy: {
    coreRadius: 1.8,
    coreHeight: 41,
    coreColor: '#eeece6',
    boosters: 'cores',
    boosterRadius: 1.8,
    boosterHeight: 41,
    boosterOffset: 3.75,
    upperRadius: 1.8,
    upperHeight: 12,
    fairingRadius: 2.6,
    fairingCylinder: 6.5,
    fairingNose: 6.8,
    bellLength: 1.7,
  },
}

export function rocketSpec(launchVehicleId: string): RocketSpec {
  return SPECS[launchVehicleId] ?? SPECS.lv_light
}

// Heights along the rocket, measured from the bottom of the engines.
export function rocketLayout(spec: RocketSpec) {
  const coreBottom = spec.bellLength
  const coreTop = coreBottom + spec.coreHeight
  const upperBottom = coreTop + INTERSTAGE
  const upperTop = upperBottom + spec.upperHeight
  const boattail = spec.fairingRadius > spec.upperRadius + 0.05 ? 1.4 : 0
  const fairingTop = upperTop + boattail + spec.fairingCylinder + spec.fairingNose
  const payloadScale = spec.fairingRadius * 0.62
  const payloadY = upperTop + boattail + payloadScale * 0.95
  return { coreBottom, coreTop, upperBottom, upperTop, boattail, fairingTop, payloadScale, payloadY, length: fairingTop }
}

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

// Half of the nose cone (fairing). side 1 = the +X half, side -1 = the -X half.
function fairingGeometry(spec: RocketSpec, boattail: number, side: number): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [new THREE.Vector2(spec.upperRadius, 0)]
  if (boattail > 0) {
    points.push(new THREE.Vector2(spec.fairingRadius, boattail))
  }
  points.push(new THREE.Vector2(spec.fairingRadius, boattail + spec.fairingCylinder))
  for (let i = 1; i <= 12; i++) {
    const t = i / 12
    const r = spec.fairingRadius * Math.pow(Math.cos((t * Math.PI) / 2), 0.75)
    points.push(new THREE.Vector2(Math.max(0.01, r), boattail + spec.fairingCylinder + t * spec.fairingNose))
  }
  return new THREE.LatheGeometry(points, 24, side > 0 ? 0 : Math.PI, Math.PI)
}

// Where the engine bells sit under one core, and how wide each one is.
function bellCluster(spec: RocketSpec, radius: number): { x: number; z: number; r: number }[] {
  if (spec.boosters === 'cores') {
    const bells = [{ x: 0, z: 0, r: radius * 0.24 }]
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4
      bells.push({ x: Math.cos(angle) * radius * 0.64, z: Math.sin(angle) * radius * 0.64, r: radius * 0.22 })
    }
    return bells
  }
  if (spec.boosters === 'solid') {
    return [
      { x: -radius * 0.42, z: 0, r: radius * 0.4 },
      { x: radius * 0.42, z: 0, r: radius * 0.4 },
    ]
  }
  return [{ x: 0, z: 0, r: radius * 0.72 }]
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
  const layout = rocketLayout(spec)
  const L = layout.length
  const core = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const payload = useRef<THREE.Group>(null)
  const boosters = useRef<(THREE.Group | null)[]>([])
  const fairings = useRef<(THREE.Group | null)[]>([])

  const materials = useMemo(
    () => ({
      white: new THREE.MeshStandardMaterial({ color: '#eeece6', roughness: 0.45, metalness: 0.05 }),
      core: new THREE.MeshStandardMaterial({ color: spec.coreColor, roughness: 0.55, metalness: 0.05 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1b1e23', roughness: 0.6, metalness: 0.2 }),
      metal: new THREE.MeshStandardMaterial({ color: '#555a62', roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }),
      fairing: new THREE.MeshStandardMaterial({ color: '#f3f2ee', roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide }),
    }),
    [spec.coreColor],
  )

  const geometries = useMemo(
    () => ({
      fairingPlus: fairingGeometry(spec, layout.boattail, 1),
      fairingMinus: fairingGeometry(spec, layout.boattail, -1),
      upperBell: bellGeometry(spec.upperRadius * 0.62, 2.2),
    }),
    [spec, layout.boattail],
  )

  const coreCenter = layout.coreBottom + spec.coreHeight / 2
  const upperCenter = layout.upperBottom + spec.upperHeight / 2
  const boosterBase = spec.boosters === 'solid' ? 1.2 : layout.coreBottom
  const boosterCenter = boosterBase + spec.boosterHeight / 2

  useFrame(() => {
    const d = director
    const sides = [-1, 1]

    // Boosters: drift outward, fall behind and tumble.
    boosters.current.forEach((group, i) => {
      if (!group) {
        return
      }
      const side = sides[i]
      const p = d.boosterSep
      group.position.set(side * (spec.boosterOffset + p * L * 0.1 + p * p * L * 0.35), boosterCenter - p * p * L * 0.9, 0)
      group.rotation.set(p * 0.3, 0, -side * p * 0.9)
      group.visible = p < 0.995
    })

    // First stage: falls behind and slowly turns over.
    if (core.current) {
      const q = d.stageSep
      core.current.position.set(q * L * 0.04, coreCenter - (q * L * 0.05 + q * q * L * 0.9), 0)
      core.current.rotation.set(q * 0.25, 0, q * 0.45)
      core.current.visible = q < 0.995
    }

    // Nose cone halves: open like a clam shell and drift away.
    fairings.current.forEach((pivot, i) => {
      if (!pivot) {
        return
      }
      const side = i === 0 ? 1 : -1
      const f = d.fairingSep
      pivot.position.set(side * (spec.fairingRadius + f * L * 0.06 + f * f * L * 0.3), layout.upperTop - f * f * L * 0.35, 0)
      pivot.rotation.z = -side * (Math.min(1, f * 1.8) * 0.8 + f * 0.6)
      pivot.visible = f < 0.995
    })

    // Upper stage: after the spacecraft is let go, it falls behind.
    if (upper.current) {
      const c = d.craftSep
      upper.current.position.set(0, upperCenter - c * c * L * 0.3, 0)
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
      payload.current.position.set(curve, layout.payloadY + forward, 0)
    }
  })

  const clusterCore = bellCluster(spec, spec.coreRadius)
  const bellLength = spec.bellLength

  function bells(cluster: { x: number; z: number; r: number }[]) {
    return cluster.map((bell, i) => (
      <mesh key={i} position={[bell.x, 0, bell.z]} geometry={bellGeometry(bell.r, bellLength)} material={materials.metal} />
    ))
  }

  // One full core: bells, body, black bands. Used for the centre core and for side cores.
  function coreBody(withNose: boolean) {
    const r = spec.coreRadius
    return (
      <group position={[0, -spec.coreHeight / 2 - layout.coreBottom, 0]}>
        <group position={[0, layout.coreBottom, 0]}>{bells(clusterCore)}</group>
        <mesh position={[0, layout.coreBottom + spec.coreHeight / 2, 0]} material={materials.core}>
          <cylinderGeometry args={[r, r, spec.coreHeight, 40]} />
        </mesh>
        <mesh position={[0, layout.coreBottom + 0.5, 0]} material={materials.dark}>
          <cylinderGeometry args={[r * 1.01, r * 1.04, 1, 40]} />
        </mesh>
        <mesh position={[0, layout.coreBottom + spec.coreHeight * 0.62, 0]} material={materials.dark}>
          <cylinderGeometry args={[r * 1.005, r * 1.005, 0.5, 40]} />
        </mesh>
        {withNose && (
          <mesh position={[0, layout.coreBottom + spec.coreHeight + r * 1.2, 0]} material={materials.white}>
            <coneGeometry args={[r, r * 2.4, 40]} />
          </mesh>
        )}
      </group>
    )
  }

  return (
    <group>
      {/* First stage (with the interstage ring on top) */}
      <group ref={core}>
        {coreBody(false)}
        <mesh position={[0, spec.coreHeight / 2 + INTERSTAGE / 2, 0]} material={materials.dark}>
          <cylinderGeometry args={[spec.upperRadius * 1.02, spec.coreRadius, INTERSTAGE, 40]} />
        </mesh>
        <object3D
          position={[0, spec.coreHeight / 2 + INTERSTAGE, 0]}
          ref={(o) => {
            markers.interstage = o
          }}
        />
        <group position={[0, -spec.coreHeight / 2 - layout.coreBottom + 0.1, 0]}>
          <object3D
            ref={(o) => {
              markers.coreNozzle = o
            }}
          />
          <Flame
            radius={spec.coreRadius * 0.95}
            length={spec.coreRadius * 16}
            intensity={() => director.engine}
            vacuum={() => (director.act === 2 ? 1 : 0)}
            glowTexture={glowTexture}
          />
        </group>
      </group>

      {/* Side boosters or side cores */}
      {spec.boosters !== 'none' &&
        [-1, 1].map((side, i) => (
          <group
            key={side}
            ref={(g) => {
              boosters.current[i] = g
            }}
          >
            {spec.boosters === 'cores' ? (
              coreBody(true)
            ) : (
              <group>
                <mesh material={materials.white}>
                  <cylinderGeometry args={[spec.boosterRadius, spec.boosterRadius, spec.boosterHeight, 28]} />
                </mesh>
                <mesh position={[0, spec.boosterHeight / 2 + spec.boosterRadius * 1.3, 0]} material={materials.white}>
                  <coneGeometry args={[spec.boosterRadius, spec.boosterRadius * 2.6, 28]} />
                </mesh>
                <mesh position={[0, -spec.boosterHeight / 2, 0]} geometry={bellGeometry(spec.boosterRadius * 0.75, 1.2)} material={materials.metal} />
              </group>
            )}
            <group position={[0, -spec.boosterHeight / 2 - (spec.boosters === 'cores' ? layout.coreBottom : 1.1), 0]}>
              <Flame
                radius={spec.boosterRadius * 0.9}
                length={spec.boosterRadius * 15}
                intensity={() => (director.boosterSep > 0 ? 0 : director.engine)}
                vacuum={() => (director.act === 2 ? 1 : 0)}
                glowTexture={glowTexture}
              />
            </group>
          </group>
        ))}

      {/* Upper stage, with its own engine hidden inside the interstage until the first stage drops */}
      <group ref={upper}>
        <mesh material={materials.white}>
          <cylinderGeometry args={[spec.upperRadius, spec.upperRadius, spec.upperHeight, 40]} />
        </mesh>
        <mesh position={[0, -spec.upperHeight / 2 + 0.3, 0]} material={materials.dark}>
          <cylinderGeometry args={[spec.upperRadius * 1.01, spec.upperRadius * 1.01, 0.6, 40]} />
        </mesh>
        <group position={[0, -spec.upperHeight / 2, 0]}>
          <mesh geometry={geometries.upperBell} material={materials.metal} />
          <group position={[0, -2.1, 0]}>
            <Flame
              radius={spec.upperRadius * 0.6}
              length={spec.upperRadius * 6}
              intensity={() => director.upperEngine}
              vacuum={() => 1}
              glowTexture={glowTexture}
              color="blue"
            />
          </group>
        </group>
      </group>

      {/* The spacecraft inside the nose cone */}
      <group
        ref={(g) => {
          payload.current = g
          markers.craft = g
        }}
        position={[0, layout.payloadY, 0]}
      >
        <group scale={layout.payloadScale}>
          <Spacecraft3D design={design} orbitId={orbitId} director={director} glowTexture={glowTexture} />
        </group>
      </group>

      {/* Nose cone halves, each turning on a hinge at its base */}
      {[1, -1].map((side, i) => (
        <group
          key={'fairing' + side}
          ref={(g) => {
            fairings.current[i] = g
          }}
          position={[side * spec.fairingRadius, layout.upperTop, 0]}
        >
          <mesh
            position={[-side * spec.fairingRadius, 0, 0]}
            geometry={side > 0 ? geometries.fairingPlus : geometries.fairingMinus}
            material={materials.fairing}
          />
        </group>
      ))}
    </group>
  )
}
