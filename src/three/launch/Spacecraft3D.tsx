import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Design, OrbitId } from '../../logic/types'
import type { LaunchDirector } from './director'
import { Flame } from './Flame'
import { createSolarTexture } from './textures'

interface SpacecraftProps {
  design: Design
  orbitId: OrbitId
  director: LaunchDirector
  glowTexture: THREE.Texture
}

// 0..1 with a soft start and end.
function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

// The player's own spacecraft, built from the parts they chose.
// Size: the body is about 1 unit; "up" (+Y) is the direction of flight.
// Solar wings, booms and the big dish start folded and open when `director.deploy` goes 0 -> 1.
export function Spacecraft3D({ design, orbitId, director, glowTexture }: SpacecraftProps) {
  const unfolding = useRef<THREE.Group[]>([])
  const dish = useRef<THREE.Group>(null)
  const legs = useRef<THREE.Group[]>([])
  const parts = new Set<string>([design.power, design.comms, ...design.instruments, ...design.extras])
  const isLander = orbitId === 'lander'

  const materials = useMemo(
    () => ({
      gold: new THREE.MeshStandardMaterial({ color: '#d6a640', roughness: 0.32, metalness: 1 }),
      white: new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.5, metalness: 0.1 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2e35', roughness: 0.55, metalness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: '#9aa1aa', roughness: 0.3, metalness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: '#0b1a26', roughness: 0.1, metalness: 0.6 }),
      panel: new THREE.MeshStandardMaterial({ map: createSolarTexture(), roughness: 0.3, metalness: 0.4, side: THREE.DoubleSide }),
      shield: new THREE.MeshStandardMaterial({ color: '#8c5a3a', roughness: 0.8, metalness: 0.05 }),
      rtg: new THREE.MeshStandardMaterial({ color: '#3d3f43', roughness: 0.6, metalness: 0.5, emissive: '#5a2a0c', emissiveIntensity: 0.6 }),
    }),
    [],
  )

  const dishGeometry = useMemo(() => {
    const points: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      points.push(new THREE.Vector2(Math.max(0.001, t), t * t * 0.3))
    }
    return new THREE.LatheGeometry(points, 32)
  }, [])

  useFrame(() => {
    const k = smooth(director.deploy)
    for (const group of unfolding.current) {
      group.scale.x = 0.06 + 0.94 * k
    }
    if (dish.current) {
      dish.current.rotation.x = 1.25 * (1 - k)
    }
    for (const leg of legs.current) {
      leg.rotation.z = 0.15 + 0.5 * k
    }
  })

  function keepUnfolding(group: THREE.Group | null) {
    if (group && !unfolding.current.includes(group)) {
      unfolding.current.push(group)
    }
  }

  function keepLeg(group: THREE.Group | null) {
    if (group && !legs.current.includes(group)) {
      legs.current.push(group)
    }
  }

  // A solar wing on one side (side = 1 or -1). It unfolds outward from the body like an accordion.
  function wing(side: number, width: number, height: number, panels: number) {
    const gap = 0.04
    const panelWidth = (width - gap * (panels - 1)) / panels
    const boxes = []
    for (let i = 0; i < panels; i++) {
      const x = side * (0.38 + panelWidth / 2 + i * (panelWidth + gap))
      boxes.push(
        <mesh key={i} position={[x, 0, 0]} material={materials.panel}>
          <boxGeometry args={[panelWidth, height, 0.025]} />
        </mesh>,
      )
    }
    return (
      <group key={'wing' + side} position={[side * 0.52, 0.1, 0]} ref={keepUnfolding}>
        <mesh position={[side * 0.19, 0, 0]} material={materials.metal}>
          <boxGeometry args={[0.38, 0.05, 0.05]} />
        </mesh>
        {boxes}
      </group>
    )
  }

  return (
    <group>
      {/* Body wrapped in gold foil, with a white top deck */}
      <mesh material={materials.gold}>
        <boxGeometry args={[1, 1.1, 1]} />
      </mesh>
      <mesh position={[0, 0.57, 0]} material={materials.white}>
        <boxGeometry args={[1.04, 0.05, 1.04]} />
      </mesh>
      <mesh position={[0, -0.62, 0]} material={materials.dark}>
        <cylinderGeometry args={[0.36, 0.4, 0.14, 24]} />
      </mesh>
      <mesh position={[0, -0.74, 0]} material={materials.metal}>
        <cylinderGeometry args={[0.07, 0.15, 0.16, 16, 1, true]} />
      </mesh>
      <group position={[0, -0.82, 0]}>
        <Flame radius={0.13} length={1.6} intensity={() => director.craftEngine} vacuum={() => 1} glowTexture={glowTexture} color="blue" />
      </group>

      {/* Power */}
      {parts.has('solar_s') && (
        <>
          {wing(1, 1.8, 0.85, 2)}
          {wing(-1, 1.8, 0.85, 2)}
        </>
      )}
      {parts.has('solar_l') && (
        <>
          {wing(1, 3.4, 1.15, 3)}
          {wing(-1, 3.4, 1.15, 3)}
        </>
      )}
      {parts.has('rtg') && (
        <group position={[-0.32, -0.55, -0.62]} rotation={[0.7, 0, 0.3]}>
          <mesh material={materials.rtg}>
            <cylinderGeometry args={[0.12, 0.12, 0.6, 16]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} position={[Math.cos((i * Math.PI) / 2) * 0.16, 0, -Math.sin((i * Math.PI) / 2) * 0.16]} material={materials.dark}>
              <boxGeometry args={[0.14, 0.52, 0.02]} />
            </mesh>
          ))}
        </group>
      )}

      {/* Radio */}
      {parts.has('antenna_small') && (
        <group position={[0, 0.6, 0]}>
          <mesh position={[0, 0.14, 0]} material={materials.metal}>
            <cylinderGeometry args={[0.025, 0.025, 0.28, 8]} />
          </mesh>
          <mesh position={[0, 0.28, 0]} scale={[0.3, 0.3, 0.3]} geometry={dishGeometry} material={materials.white} />
        </group>
      )}
      {parts.has('antenna_hga') && (
        <group position={[0, 0.6, 0]} ref={dish}>
          <mesh position={[0, 0.1, 0]} scale={[0.78, 0.78, 0.78]} geometry={dishGeometry} material={materials.white} />
          <mesh position={[0, 0.36, 0]} material={materials.metal}>
            <cylinderGeometry args={[0.018, 0.018, 0.5, 6]} />
          </mesh>
        </group>
      )}

      {/* Science instruments */}
      {parts.has('camera') && (
        <group position={[0.24, -0.25, 0.52]}>
          <mesh material={materials.white}>
            <boxGeometry args={[0.24, 0.2, 0.16]} />
          </mesh>
          <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]} material={materials.glass}>
            <cylinderGeometry args={[0.07, 0.08, 0.1, 20]} />
          </mesh>
        </group>
      )}
      {parts.has('spectrometer') && (
        <group position={[-0.22, -0.28, 0.52]}>
          <mesh material={materials.white}>
            <boxGeometry args={[0.3, 0.18, 0.16]} />
          </mesh>
          <mesh position={[0, 0, 0.085]} material={materials.glass}>
            <boxGeometry args={[0.16, 0.06, 0.02]} />
          </mesh>
        </group>
      )}
      {parts.has('radar') &&
        [1, -1].map((side) => (
          <group key={'radar' + side} position={[side * 0.5, -0.45, 0.3]} ref={keepUnfolding}>
            <mesh position={[side * 1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.white}>
              <cylinderGeometry args={[0.02, 0.02, 2.6, 6]} />
            </mesh>
          </group>
        ))}
      {parts.has('magnetometer') && (
        <group position={[-0.5, 0.4, 0.2]} rotation={[0, 0, 0.55]} ref={keepUnfolding}>
          <mesh position={[-1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.metal}>
            <cylinderGeometry args={[0.015, 0.015, 2.2, 6]} />
          </mesh>
          <mesh position={[-2.25, 0, 0]} material={materials.white}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
          </mesh>
        </group>
      )}
      {parts.has('seismometer') && (
        <mesh position={[0.25, -0.56, 0.25]} material={materials.gold}>
          <sphereGeometry args={[0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      )}

      {/* Extras */}
      {parts.has('heat_shield') && (
        <mesh position={[0, -0.72, 0]} rotation={[Math.PI, 0, 0]} material={materials.shield}>
          <coneGeometry args={[0.95, 0.32, 40, 1, true]} />
        </mesh>
      )}
      {parts.has('redundancy') && (
        <mesh position={[0.53, 0.25, -0.2]} material={materials.white}>
          <boxGeometry args={[0.08, 0.3, 0.3]} />
        </mesh>
      )}
      {parts.has('battery') && (
        <mesh position={[0.53, -0.15, 0.22]} material={materials.dark}>
          <boxGeometry args={[0.08, 0.26, 0.26]} />
        </mesh>
      )}

      {/* Landing legs */}
      {isLander &&
        [0, 1, 2, 3].map((i) => {
          const angle = (i * Math.PI) / 2 + Math.PI / 4
          return (
            <group key={'leg' + i} rotation={[0, angle, 0]}>
              <group position={[0.45, -0.5, 0]} ref={keepLeg}>
                <mesh position={[0, -0.4, 0]} material={materials.metal}>
                  <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
                </mesh>
                <mesh position={[0, -0.82, 0]} material={materials.metal}>
                  <cylinderGeometry args={[0.12, 0.12, 0.03, 12]} />
                </mesh>
              </group>
            </group>
          )
        })}
    </group>
  )
}
