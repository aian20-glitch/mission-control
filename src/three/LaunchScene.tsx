import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Design, OrbitId } from '../logic/types'
import { smoothStep, type LaunchDirector } from './launch/director'
import { PAD_TOP, PadSet } from './launch/PadSet'
import { ParticlePool, type SpawnOptions } from './launch/particles'
import { Rocket, rocketLayout, rocketSpec, type RocketMarkers, type RocketSpec } from './launch/Rocket'
import { DAWN_SUN, HORIZON_COLOR, SPACE_HORIZON_COLOR, SkyDome, Stars } from './launch/Sky'
import { EARTH_CENTER, EARTH_RADIUS, SpaceSet } from './launch/SpaceSet'
import { createGlowTexture, createPuffTexture } from './launch/textures'

export interface LaunchSceneProps {
  director: LaunchDirector
  launchVehicleId: string
  design: Design
  orbitId: OrbitId
  onReady: () => void
}

const FOV = 40
// In space the rocket flies nose to the right, a little above the horizon.
const SPACE_PITCH = 1.15
// Last shot: the Earth seen from far away, the spacecraft heading off up and to the right.
const FINAL_DIRECTION = new THREE.Vector3(0.08, 0.2, 1).normalize()
const FINAL_DISTANCE = 30000
// While the film shrinks into the mission screen, the camera backs off to this distance.
const MORPH_DISTANCE = 42000

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

const smooth = smoothStep

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

// Cold, white vapour sliding down the side of the full tanks before launch.
function vapourPuff(spec: RocketSpec, point: THREE.Vector3, outward: THREE.Vector3): SpawnOptions {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    vx: outward.x * randomBetween(0.6, 1.4),
    vy: randomBetween(-1.6, -0.6),
    vz: outward.z * randomBetween(0.6, 1.4),
    life: randomBetween(1.8, 2.8),
    startSize: spec.coreRadius * 0.6,
    endSize: spec.coreRadius * 3,
    alpha: 0.3,
    drag: 0.6,
    rise: -0.5,
    r: 0.95,
    g: 0.96,
    b: 0.98,
    hot: 0,
  }
}

// Smoke pushed out of the flame trench and rolling over the ground.
function groundPuff(L: number): SpawnOptions {
  const alongTrench = Math.random() < 0.72
  const direction = alongTrench ? (Math.random() < 0.5 ? 0 : Math.PI) + randomBetween(-0.35, 0.35) : Math.random() * Math.PI * 2
  const speed = randomBetween(0.35, 0.8) * L
  return {
    x: randomBetween(-2, 2),
    y: PAD_TOP * 0.6,
    z: randomBetween(-2, 2),
    vx: Math.cos(direction) * speed,
    vy: randomBetween(0.03, 0.12) * L,
    vz: Math.sin(direction) * speed,
    life: randomBetween(4.5, 7),
    startSize: L * 0.1,
    endSize: L * randomBetween(0.45, 0.75),
    alpha: 0.55,
    drag: 0.55,
    rise: L * 0.02,
    r: 0.8,
    g: 0.79,
    b: 0.77,
    hot: 0.85,
  }
}

// Exhaust left behind in the air as the rocket climbs.
function trailPuff(L: number, point: THREE.Vector3): SpawnOptions {
  return {
    x: point.x + randomBetween(-0.4, 0.4),
    y: point.y,
    z: point.z + randomBetween(-0.4, 0.4),
    vx: randomBetween(-1.5, 1.5),
    vy: randomBetween(-8, -3),
    vz: randomBetween(-1.5, 1.5),
    life: randomBetween(3, 4.2),
    startSize: L * 0.07,
    endSize: L * randomBetween(0.3, 0.45),
    alpha: 0.5,
    drag: 0.4,
    rise: 0.4,
    r: 0.88,
    g: 0.87,
    b: 0.85,
    hot: 0.9,
  }
}

// A quick white puff around a separation point (springs and small thrusters).
function separationPuff(point: THREE.Vector3, axis: THREE.Vector3, scale: number): SpawnOptions {
  const sideways = new THREE.Vector3(randomBetween(-1, 1), randomBetween(-1, 1), randomBetween(-1, 1))
  sideways.addScaledVector(axis, -sideways.dot(axis)).normalize()
  const speed = randomBetween(3, 9) * scale
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    vx: sideways.x * speed - axis.x * 3 * scale,
    vy: sideways.y * speed - axis.y * 3 * scale,
    vz: sideways.z * speed - axis.z * 3 * scale,
    life: randomBetween(1.2, 2),
    startSize: 0.5 * scale,
    endSize: randomBetween(3, 5) * scale,
    alpha: 0.55,
    drag: 1.4,
    rise: 0,
    r: 0.95,
    g: 0.95,
    b: 0.96,
    hot: 0,
  }
}

function SceneContent({ director, launchVehicleId, design, orbitId, onReady }: LaunchSceneProps) {
  const spec = useMemo(() => rocketSpec(launchVehicleId), [launchVehicleId])
  const layout = rocketLayout(spec)
  const L = layout.length
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)

  const textures = useMemo(() => ({ puff: createPuffTexture(), glow: createGlowTexture() }), [])
  const smoke = useMemo(() => new ParticlePool(1300, textures.puff, false), [textures])
  const puffs = useMemo(() => new ParticlePool(220, textures.puff, false), [textures])
  const fog = useMemo(() => new THREE.FogExp2(HORIZON_COLOR.clone(), 0.001), [])
  const markers = useMemo<RocketMarkers>(() => ({ coreNozzle: null, interstage: null, craft: null }), [])

  const rocket = useRef<THREE.Group>(null)
  const act1 = useRef<THREE.Group>(null)
  const act2 = useRef<THREE.Group>(null)
  const engineLight = useRef<THREE.PointLight>(null)
  const craftGlow = useRef<THREE.Sprite>(null)
  const frames = useRef(0)
  const previous = useRef({ boosterSep: 0, stageSep: 0, fairingSep: 0, craftSep: 0 })
  const lastNozzle = useRef<THREE.Vector3 | null>(null)
  const emitDebt = useRef({ vapour: 0, ground: 0 })

  const trail = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(200 * 3), 3))
    geometry.setDrawRange(0, 0)
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(0.5, 1.7, 1.25), transparent: true, opacity: 0.85 })
    const line = new THREE.Line(geometry, material)
    line.frustumCulled = false
    return { line, count: 0 }
  }, [])

  const glowMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: textures.glow,
        color: new THREE.Color(3, 3.3, 3.8),
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    [textures],
  )

  // Scratch vectors, reused every frame.
  const v = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      look: new THREE.Vector3(),
      focus: new THREE.Vector3(),
      craft: new THREE.Vector3(),
      axis: new THREE.Vector3(),
      direction: new THREE.Vector3(),
    }),
    [],
  )

  useEffect(() => {
    scene.fog = fog
    return () => {
      scene.fog = null
      smoke.dispose()
      puffs.dispose()
    }
  }, [scene, fog, smoke, puffs])

  useFrame((state, delta) => {
    const d = director
    const dt = Math.min(delta, 1 / 20)
    const time = state.clock.elapsedTime
    const root = rocket.current
    if (!root) {
      return
    }

    // Tell the film it can start once a few frames are drawn (shaders are ready by then).
    frames.current = frames.current + 1
    if (frames.current === 3) {
      onReady()
    }

    if (act1.current) {
      act1.current.visible = d.act === 1
    }
    if (act2.current) {
      act2.current.visible = d.act === 2
    }

    // ---- Where the rocket is ----
    if (d.act === 1) {
      root.position.set(d.rocketY * L * Math.sin(d.pitch) * 0.45, PAD_TOP + d.rocketY * L, 0)
      root.rotation.set(0, 0, -d.pitch)
    } else {
      root.position.set(0, 0, 0)
      root.rotation.set(Math.sin(time * 0.6) * 0.015, 0, -SPACE_PITCH + Math.sin(time * 0.8) * 0.01)
    }
    root.updateMatrixWorld(true)
    v.axis.set(0, 1, 0).applyQuaternion(root.quaternion)

    // ---- Smoke and vapour ----
    if (d.act === 1) {
      emitDebt.current.vapour = emitDebt.current.vapour + dt * 26 * d.vapor
      while (emitDebt.current.vapour >= 1) {
        emitDebt.current.vapour = emitDebt.current.vapour - 1
        const angle = Math.random() * Math.PI * 2
        const height = layout.coreBottom + spec.coreHeight * randomBetween(0.3, 0.92)
        v.a.set(Math.cos(angle) * spec.coreRadius, height, Math.sin(angle) * spec.coreRadius)
        root.localToWorld(v.a)
        v.b.set(Math.cos(angle), 0, Math.sin(angle))
        smoke.spawn(vapourPuff(spec, v.a, v.b))
      }

      emitDebt.current.ground = emitDebt.current.ground + dt * 95 * d.groundSmoke
      while (emitDebt.current.ground >= 1) {
        emitDebt.current.ground = emitDebt.current.ground - 1
        smoke.spawn(groundPuff(L))
      }

      // Exhaust trail: one puff every few meters along the way the nozzle moved this frame.
      if (markers.coreNozzle) {
        markers.coreNozzle.getWorldPosition(v.a)
        const last = lastNozzle.current
        if (last && d.engine > 0.3 && d.rocketY > 0.03) {
          const step = Math.max(2, L * 0.07)
          const distance = last.distanceTo(v.a)
          const count = Math.min(40, Math.floor(distance / step))
          for (let i = 1; i <= count; i++) {
            v.b.copy(last).lerp(v.a, i / count)
            smoke.spawn(trailPuff(L, v.b))
          }
          if (count > 0) {
            last.copy(v.a)
          }
        } else {
          lastNozzle.current = v.a.clone()
        }
      }
      smoke.material.uniforms.uLight.value = 1 - d.sky * 0.45
    } else {
      // Puffs when parts let go of each other.
      const before = previous.current
      if (before.boosterSep === 0 && d.boosterSep > 0 && spec.boosters !== 'none') {
        for (const side of [-1, 1]) {
          for (let i = 0; i < 18; i++) {
            v.a.set(side * (spec.boosterOffset - spec.boosterRadius), layout.coreBottom + spec.coreHeight * randomBetween(0.2, 0.7), 0)
            root.localToWorld(v.a)
            puffs.spawn(separationPuff(v.a, v.axis, L / 50))
          }
        }
      }
      if (before.stageSep === 0 && d.stageSep > 0 && markers.interstage) {
        markers.interstage.getWorldPosition(v.a)
        for (let i = 0; i < 40; i++) {
          puffs.spawn(separationPuff(v.a, v.axis, L / 50))
        }
      }
      if (before.fairingSep === 0 && d.fairingSep > 0) {
        for (let i = 0; i < 30; i++) {
          v.a.set(0, layout.upperTop + randomBetween(0, spec.fairingCylinder + spec.fairingNose), 0)
          root.localToWorld(v.a)
          puffs.spawn(separationPuff(v.a, v.axis, L / 70))
        }
      }
      if (before.craftSep === 0 && d.craftSep > 0 && markers.craft) {
        markers.craft.getWorldPosition(v.a)
        for (let i = 0; i < 14; i++) {
          puffs.spawn(separationPuff(v.a, v.axis, L / 140))
        }
      }
    }
    previous.current = { boosterSep: d.boosterSep, stageSep: d.stageSep, fairingSep: d.fairingSep, craftSep: d.craftSep }
    smoke.update(dt)
    puffs.update(dt)

    // Orange light from the engines on the pad, the tower and the smoke.
    if (engineLight.current && markers.coreNozzle) {
      markers.coreNozzle.getWorldPosition(engineLight.current.position)
      engineLight.current.position.y = engineLight.current.position.y - L * 0.05
      engineLight.current.intensity = d.act === 1 ? d.engine * 2.2 * L * L : 0
    }

    // ---- Camera ----
    let distance = 0
    if (d.act === 1) {
      const orbitDistance = d.camDistance * L
      const shake = d.shake * L * 0.005
      camera.position.set(
        root.position.x * d.follow + Math.sin(d.camOrbit) * orbitDistance + Math.sin(time * 37.1) * Math.sin(time * 13.3) * shake,
        d.camHeight * L + d.follow * d.rocketY * L + Math.sin(time * 41.7 + 1.3) * shake,
        Math.cos(d.camOrbit) * orbitDistance,
      )
      v.look.set(0, d.lookAt * L, 0)
      root.localToWorld(v.look)
      camera.lookAt(v.look)
      distance = camera.position.distanceTo(v.look)

      // Thick air near the ground hides the far landscape; it thins out higher up.
      const height = camera.position.y
      fog.density = lerp(0.0011, 0.00012, clamp01(height / (L * 22))) * (1 - d.sky * 0.7)
      fog.color.copy(HORIZON_COLOR).lerp(SPACE_HORIZON_COLOR, d.sky)
    } else {
      fog.density = 0

      // What the camera looks at: the whole rocket, then the upper stage, then the spacecraft.
      const upperCenter = layout.upperBottom + spec.upperHeight * 0.75
      let focusHeight = lerp(L * 0.5, upperCenter, smooth(d.stageSep))
      focusHeight = lerp(focusHeight, layout.payloadY, smooth(d.fairingSep))
      v.focus.set(0, focusHeight, 0)
      root.localToWorld(v.focus)
      if (markers.craft) {
        markers.craft.getWorldPosition(v.craft)
        v.focus.lerp(v.craft, smooth(d.craftSep))
      }

      const elevation = 0.16
      v.direction.set(Math.sin(d.spaceOrbit) * Math.cos(elevation), Math.sin(elevation), Math.cos(d.spaceOrbit) * Math.cos(elevation))

      // Departure: the camera pulls far back until the whole Earth is in view.
      const pull = smooth(d.depart)
      v.direction.lerp(FINAL_DIRECTION, pull).normalize()
      distance = Math.exp(lerp(Math.log(d.spaceDistance * L), Math.log(FINAL_DISTANCE), pull))
      // Aim between the spacecraft and the Earth, so both end up in the picture.
      // The aim never strays further from the spacecraft than the picture can show.
      v.b.copy(v.craft).add(EARTH_CENTER).multiplyScalar(0.5).sub(v.craft)
      const maxOffset = distance * 0.25
      if (v.b.length() > maxOffset) {
        v.b.setLength(maxOffset)
      }
      v.look.copy(v.focus).addScaledVector(v.b, smooth(d.depart / 0.2))

      // Shrinking into the mission screen: aim at the Earth itself.
      const morph = smooth(d.morph)
      if (morph > 0) {
        v.look.lerp(EARTH_CENTER, morph)
        distance = lerp(distance, MORPH_DISTANCE, morph)
      }
      camera.position.copy(v.look).addScaledVector(v.direction, distance)
      camera.lookAt(v.look)

      // The spacecraft as a bright dot, and the line of its path.
      if (craftGlow.current) {
        craftGlow.current.position.copy(v.craft)
        craftGlow.current.visible = d.depart > 0.02
        glowMaterial.opacity = smooth(d.depart / 0.15)
      }
      if (d.depart > 0 && trail.count < 200) {
        const positions = trail.line.geometry.getAttribute('position') as THREE.BufferAttribute
        const last = trail.count > 0 ? v.a.fromBufferAttribute(positions, trail.count - 1) : null
        if (!last || last.distanceTo(v.craft) > distance * 0.004) {
          positions.setXYZ(trail.count, v.craft.x, v.craft.y, v.craft.z)
          trail.count = trail.count + 1
          positions.needsUpdate = true
          trail.line.geometry.setDrawRange(0, trail.count)
        }
      }
    }

    camera.near = Math.max(0.5, distance * 0.003)
    camera.far = distance * 3 + 20000

    // ---- Shrinking into the path panel of the mission screen ----
    // The camera keeps the same picture but draws it into a smaller rectangle
    // (a "view offset"), ending with the 3D Earth exactly on top of the Earth of the 2D map.
    const width = size.width
    const height = size.height
    const earthSpot = d.morphEarth
    if (d.morph > 0 && earthSpot) {
      const angularRadius = Math.asin(EARTH_RADIUS / MORPH_DISTANCE)
      const fullHeight = (2 * earthSpot.r * Math.tan(((FOV / 2) * Math.PI) / 180)) / Math.tan(angularRadius)
      const fullWidth = fullHeight * (width / height)
      const m = smooth(d.morph)
      const w = lerp(width, fullWidth, m)
      const h = lerp(height, fullHeight, m)
      const x = lerp(0, earthSpot.x - fullWidth / 2, m)
      const y = lerp(0, earthSpot.y - fullHeight / 2, m)
      camera.setViewOffset(w, h, -x, -y, width, height)
    } else if (camera.view) {
      camera.clearViewOffset()
    }
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  })

  return (
    <>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.4} color="#fff1e0" position={[0, 6, 9]} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#86a8ff" position={[0, 10, -7]} scale={[16, 4, 1]} />
        <Lightformer form="ring" intensity={2.2} color="#ffb070" position={[-9, 1, -4]} scale={3} />
      </Environment>

      <Stars director={director} />

      <group ref={act1}>
        <SkyDome director={director} />
        <hemisphereLight args={['#a9b9dd', '#3b3027', 0.9]} />
        <directionalLight position={[60, 55, 90]} intensity={2.1} color="#fff0de" />
        <directionalLight position={DAWN_SUN.clone().multiplyScalar(100)} intensity={1.4} color="#ffb27a" />
        <pointLight ref={engineLight} color="#ff9a45" distance={0} decay={2} intensity={0} />
        <PadSet spec={spec} director={director} puffTexture={textures.puff} />
        <primitive object={smoke.mesh} />
      </group>

      <group ref={act2}>
        <SpaceSet />
        <primitive object={puffs.mesh} />
        <primitive object={trail.line} />
        <sprite ref={craftGlow} material={glowMaterial} scale={[0.05, 0.05, 1]} visible={false} />
      </group>

      <group ref={rocket}>
        <Rocket spec={spec} design={design} orbitId={orbitId} director={director} glowTexture={textures.glow} markers={markers} />
      </group>
    </>
  )
}

// The 3D launch film: rocket on the pad, lift-off, climb through the clouds, stage separation in space,
// the spacecraft unfolding and leaving Earth. The timeline lives in screens/Launch.tsx.
export default function LaunchScene(props: LaunchSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV, near: 0.5, far: 30000, position: [0, 8, 60] }}
    >
      <color attach="background" args={['#05080d']} />
      <SceneContent {...props} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1} luminanceSmoothing={0.3} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  )
}
