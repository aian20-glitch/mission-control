import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Design, OrbitId } from '../logic/types'
import { createDirector } from './launch/director'
import { Spacecraft3D } from './launch/Spacecraft3D'
import { createGlowTexture } from './launch/textures'

export interface CraftSceneProps {
  design: Design
  orbitId: OrbitId
}

function CraftContent({ design, orbitId }: CraftSceneProps) {
  const holder = useRef<THREE.Group>(null)
  const glowTexture = useMemo(() => createGlowTexture(), [])
  // The spacecraft is shown fully unfolded, as it will fly.
  const director = useMemo(() => {
    const d = createDirector()
    d.act = 2
    d.deploy = 1
    return d
  }, [])

  useFrame((state) => {
    // It floats a little, like something weightless.
    if (holder.current) {
      holder.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.06
      holder.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.45) * 0.03
    }
  })

  return (
    <>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff4e6" position={[-6, 5, 7]} scale={[10, 8, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#7fe0bf" position={[7, 1, -5]} scale={[8, 6, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#9db4ff" position={[0, -6, 2]} scale={5} />
      </Environment>
      <directionalLight position={[-6, 7, 8]} intensity={2.6} color="#fff4e6" />
      <directionalLight position={[7, -2, -6]} intensity={0.9} color="#5dcaa5" />
      <ambientLight intensity={0.6} />
      <group ref={holder} rotation={[0.18, 0, 0]}>
        <Spacecraft3D design={design} orbitId={orbitId} director={director} glowTexture={glowTexture} />
      </group>
      {/* Drag to look around; it keeps turning slowly by itself */}
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.1} minPolarAngle={0.7} maxPolarAngle={2.2} />
    </>
  )
}

// The player's spacecraft in 3D on the build screen: it turns slowly and changes as parts are chosen.
export default function CraftScene(props: CraftSceneProps) {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ fov: 30, near: 0.1, far: 100, position: [3.2, 1.5, 5.1] }}>
      <CraftContent {...props} />
    </Canvas>
  )
}
