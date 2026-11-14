import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LaunchDirector } from './director'
import { rocketLayout, type RocketSpec } from './Rocket'

export const PAD_TOP = 3

// Cloud layer height, in rocket lengths. The camera flies through it on the way up.
export const CLOUD_LAYER = 26

interface PadSetProps {
  spec: RocketSpec
  director: LaunchDirector
  puffTexture: THREE.Texture
}

// A lattice tower: four posts, a ring of beams every few meters and cross braces. One merged mesh.
function towerGeometry(height: number, width: number): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = []
  const half = width / 2
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ]
  for (const [x, z] of corners) {
    const post = new THREE.BoxGeometry(0.4, height, 0.4)
    post.translate(x, height / 2, z)
    pieces.push(post)
  }
  const step = 4
  for (let y = step; y < height; y += step) {
    for (let side = 0; side < 4; side++) {
      const [x1, z1] = corners[side]
      const [x2, z2] = corners[(side + 1) % 4]
      const beam = new THREE.BoxGeometry(width, 0.25, 0.25)
      beam.rotateY(side % 2 === 0 ? 0 : Math.PI / 2)
      beam.translate((x1 + x2) / 2, y, (z1 + z2) / 2)
      pieces.push(beam)

      const brace = new THREE.BoxGeometry(Math.hypot(width, step), 0.16, 0.16)
      brace.rotateZ(Math.atan2(step, width) * (side < 2 ? 1 : -1))
      brace.rotateY(side % 2 === 0 ? 0 : Math.PI / 2)
      brace.translate((x1 + x2) / 2, y - step / 2, (z1 + z2) / 2)
      pieces.push(brace)
    }
  }
  const merged = mergeGeometries(pieces)
  for (const piece of pieces) {
    piece.dispose()
  }
  return merged ?? new THREE.BoxGeometry(1, 1, 1)
}

// Repeatable "random" numbers for placing clouds.
function seeded(i: number): number {
  const x = Math.sin(i * 91.3458) * 47453.5453
  return x - Math.floor(x)
}

// Act 1: the ground, the launch mount, the service tower and a layer of clouds high above.
export function PadSet({ spec, director, puffTexture }: PadSetProps) {
  const layout = rocketLayout(spec)
  const L = layout.length
  const outerRadius = spec.boosters === 'none' ? spec.coreRadius : spec.boosterOffset + spec.boosterRadius
  const towerWidth = 5
  const towerX = -(outerRadius + 4 + towerWidth / 2)
  const towerHeight = L + PAD_TOP + 8
  const arms = useRef<(THREE.Group | null)[]>([])

  const parts = useMemo(() => {
    const clouds: { x: number; y: number; z: number; size: number }[] = []
    for (let i = 0; i < 70; i++) {
      clouds.push({
        x: (seeded(i) - 0.5) * 70 * L,
        y: (CLOUD_LAYER + (seeded(i + 100) - 0.5) * 3) * L,
        z: (seeded(i + 200) - 0.5) * 70 * L,
        size: (10 + seeded(i + 300) * 16) * L,
      })
    }
    return {
      tower: towerGeometry(towerHeight, towerWidth),
      ground: new THREE.MeshStandardMaterial({ color: '#3a4231', roughness: 1, metalness: 0 }),
      concrete: new THREE.MeshStandardMaterial({ color: '#8d8b85', roughness: 0.95, metalness: 0 }),
      steel: new THREE.MeshStandardMaterial({ color: '#5d6168', roughness: 0.6, metalness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: '#202327', roughness: 0.9, metalness: 0.1 }),
      building: new THREE.MeshStandardMaterial({ color: '#6c7077', roughness: 0.9, metalness: 0 }),
      cloud: new THREE.SpriteMaterial({ map: puffTexture, color: new THREE.Color(1.15, 1.12, 1.1), transparent: true, opacity: 0.85, depthWrite: false }),
      clouds,
    }
  }, [L, towerHeight])

  useFrame(() => {
    // The arms swing away from the rocket just before lift-off.
    arms.current.forEach((arm, i) => {
      if (arm) {
        arm.rotation.y = (i === 0 ? 1 : -1) * director.arms * 1.25
      }
    })
  })

  // Arms reach the upper stage and the nose cone: high enough to pass over any side boosters.
  const towerFace = -towerX - towerWidth / 2
  const armList = [
    { height: PAD_TOP + layout.upperTop - 1.2, length: towerFace - spec.upperRadius + 0.3 },
    { height: PAD_TOP + layout.upperTop + layout.boattail + spec.fairingCylinder * 0.5, length: towerFace - spec.fairingRadius + 0.3 },
  ]

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={parts.ground}>
        <circleGeometry args={[40000, 64]} />
      </mesh>

      {/* Launch mount with a flame trench under the engines */}
      <mesh position={[0, PAD_TOP / 2, 0]} material={parts.concrete}>
        <cylinderGeometry args={[L * 0.42, L * 0.5, PAD_TOP, 48]} />
      </mesh>
      <mesh position={[0, PAD_TOP + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={parts.dark}>
        <planeGeometry args={[outerRadius * 2.6, L * 0.8]} />
      </mesh>

      {/* Service tower and its swing arms */}
      <mesh position={[towerX, 0, 0]} geometry={parts.tower} material={parts.steel} />
      <mesh position={[towerX, towerHeight + 3, 0]} material={parts.steel}>
        <cylinderGeometry args={[0.15, 0.15, 6, 6]} />
      </mesh>
      {armList.map((arm, i) => (
        <group
          key={i}
          position={[towerX + towerWidth / 2, arm.height, 0]}
          ref={(g) => {
            arms.current[i] = g
          }}
        >
          <mesh position={[arm.length / 2, 0, 0]} material={parts.steel}>
            <boxGeometry args={[arm.length, 1.1, 1.6]} />
          </mesh>
        </group>
      ))}

      {/* Lightning masts around the pad, on the far side from the camera */}
      {[3.5, 4.5, 5.5].map((angle) => (
        <mesh key={angle} position={[Math.cos(angle) * L * 0.8, (L * 1.3) / 2, Math.sin(angle) * L * 0.8]} material={parts.steel}>
          <cylinderGeometry args={[0.25, 0.6, L * 1.3, 8]} />
        </mesh>
      ))}

      {/* A big assembly building far away, and a second pad on the horizon */}
      <mesh position={[-700, 110, -1600]} material={parts.building}>
        <boxGeometry args={[170, 220, 150]} />
      </mesh>
      <mesh position={[900, 45, -2600]} material={parts.building}>
        <boxGeometry args={[14, 90, 14]} />
      </mesh>

      {/* Cloud layer */}
      {parts.clouds.map((cloud, i) => (
        <sprite key={i} position={[cloud.x, cloud.y, cloud.z]} scale={[cloud.size, cloud.size * 0.55, 1]} material={parts.cloud} />
      ))}
    </group>
  )
}
