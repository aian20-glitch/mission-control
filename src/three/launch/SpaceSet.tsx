import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createAtmosphereMaterial, createEarthMaterial } from '../planets'

// In act 2 the rocket flies 260 units above an Earth with a radius of 6000 units.
// Not to scale (at real scale the rocket would be a speck): the picture is what matters here.
export const EARTH_RADIUS = 6000
export const SPACE_ALTITUDE = 260
export const EARTH_CENTER = new THREE.Vector3(0, -EARTH_RADIUS - SPACE_ALTITUDE, 0)
export const SPACE_SUN = new THREE.Vector3(0.55, 0.4, 0.73).normalize()

// Act 2: the Earth below, its thin blue air, and the Sun.
export function SpaceSet() {
  const earth = useRef<THREE.Mesh>(null)

  const materials = useMemo(
    () => ({
      earth: createEarthMaterial(SPACE_SUN),
      atmosphere: createAtmosphereMaterial(SPACE_SUN),
    }),
    [],
  )

  useFrame((state, delta) => {
    materials.earth.uniforms.uTime.value = state.clock.elapsedTime
    // The ground slides by underneath: the rocket is racing along its orbit.
    if (earth.current) {
      earth.current.rotation.z = earth.current.rotation.z + Math.min(delta, 0.05) * 0.006
    }
  })

  return (
    <group>
      <directionalLight position={SPACE_SUN.clone().multiplyScalar(100)} intensity={3.2} color="#fff4e6" />
      <hemisphereLight args={['#1b2a44', '#2f5c99', 0.5]} />
      <mesh ref={earth} position={EARTH_CENTER} material={materials.earth}>
        <sphereGeometry args={[EARTH_RADIUS, 160, 120]} />
      </mesh>
      <mesh position={EARTH_CENTER} material={materials.atmosphere}>
        <sphereGeometry args={[EARTH_RADIUS * 1.025, 128, 96]} />
      </mesh>
    </group>
  )
}
