import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

interface FlameProps {
  radius: number // radius at the nozzle
  length: number
  // Read every frame: 0 = off, 1 = full thrust.
  intensity: () => number
  // Read every frame: 0 = in the air, 1 = in space, where the plume spreads wide.
  vacuum?: () => number
  glowTexture: THREE.Texture
  color?: 'orange' | 'blue'
}

const VERTEX = /* glsl */ `
  uniform float uLength;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vAlong = clamp(-position.y / uLength, 0.0, 1.0);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uIntensity;
  uniform float uTime;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    // Bright where we look straight through the plume, soft at its edges.
    float facing = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.3);
    float tip = 1.0 - smoothstep(0.25, 1.0, vAlong);
    float flicker = 0.82 + 0.18 * sin(uTime * 47.0 + vAlong * 14.0) * sin(uTime * 23.0);
    vec3 color = mix(uCore, uEdge, smoothstep(0.0, 0.55, vAlong));
    float alpha = facing * tip * flicker * uIntensity;
    gl_FragColor = vec4(color, alpha);
  }
`

// A plume shape: widens a little after the nozzle, then narrows to a point.
function plumeGeometry(radius: number, length: number, spread: number): THREE.LatheGeometry {
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const r = radius * (1 + spread * t) * Math.sqrt(Math.max(0.0001, 1 - t))
    points.push(new THREE.Vector2(Math.max(0.001, r), -t * length))
  }
  return new THREE.LatheGeometry(points, 24)
}

function flameMaterial(length: number, core: THREE.Color, edge: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLength: { value: length },
      uCore: { value: core },
      uEdge: { value: edge },
      uIntensity: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

// Engine flame: a bright inner core, a wider outer plume and a glow at the nozzle.
// Colours are brighter than white on purpose, so the bloom effect makes them shine.
export function Flame({ radius, length, intensity, vacuum, glowTexture, color = 'orange' }: FlameProps) {
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Sprite>(null)

  const parts = useMemo(() => {
    const blue = color === 'blue'
    const outerCore = blue ? new THREE.Color(2.2, 2.6, 4.0) : new THREE.Color(4.0, 2.6, 1.2)
    const outerEdge = blue ? new THREE.Color(0.3, 0.45, 1.2) : new THREE.Color(1.6, 0.45, 0.08)
    const innerCore = new THREE.Color(7.0, 6.2, 5.0)
    const innerEdge = blue ? new THREE.Color(2.0, 2.6, 4.5) : new THREE.Color(4.5, 2.8, 1.0)
    return {
      outerGeometry: plumeGeometry(radius * 1.05, length, 0.9),
      innerGeometry: plumeGeometry(radius * 0.55, length * 0.55, 0.3),
      outerMaterial: flameMaterial(length, outerCore, outerEdge),
      innerMaterial: flameMaterial(length * 0.55, innerCore, innerEdge),
      glowMaterial: new THREE.SpriteMaterial({
        map: glowTexture,
        color: blue ? new THREE.Color(2.5, 3.0, 5.0) : new THREE.Color(5.0, 3.0, 1.4),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    }
  }, [radius, length, glowTexture, color])

  useFrame((state) => {
    const power = intensity()
    const space = vacuum ? vacuum() : 0
    const time = state.clock.elapsedTime
    parts.outerMaterial.uniforms.uIntensity.value = power * (0.75 - space * 0.4)
    parts.innerMaterial.uniforms.uIntensity.value = power
    parts.outerMaterial.uniforms.uTime.value = time
    parts.innerMaterial.uniforms.uTime.value = time
    if (group.current) {
      const flicker = 0.94 + 0.06 * Math.sin(time * 31) + 0.04 * Math.sin(time * 57)
      const width = 1 + space * 0.9
      group.current.visible = power > 0.01
      group.current.scale.set(width, (0.25 + 0.75 * power) * flicker * (1 + space * 0.2), width)
    }
    if (glow.current) {
      const size = radius * 7 * power
      glow.current.scale.set(size, size, 1)
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={parts.outerGeometry} material={parts.outerMaterial} />
      <mesh geometry={parts.innerGeometry} material={parts.innerMaterial} />
      <sprite ref={glow} material={parts.glowMaterial} position={[0, -radius * 0.4, 0]} />
    </group>
  )
}
