import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LaunchDirector } from './director'

// Morning Sun, low over the horizon behind the pad.
export const DAWN_SUN = new THREE.Vector3(-0.62, 0.08, -0.78).normalize()

// Sky colours the fog fades into, near the ground and high up.
export const HORIZON_COLOR = new THREE.Color(1.05, 0.66, 0.46)
export const SPACE_HORIZON_COLOR = new THREE.Color(0.02, 0.04, 0.1)

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uSun;
  uniform float uSpace;
  varying vec3 vDirection;

  void main() {
    vec3 d = normalize(vDirection);
    float h = d.y;
    // Morning sky: warm at the horizon, blue overhead.
    vec3 horizon = vec3(1.05, 0.66, 0.46);
    vec3 low = vec3(0.55, 0.6, 0.85);
    vec3 zenith = vec3(0.07, 0.17, 0.45);
    vec3 color = mix(horizon, low, smoothstep(0.0, 0.14, h));
    color = mix(color, zenith, smoothstep(0.12, 0.65, h));
    color = mix(color, vec3(0.32, 0.27, 0.25), smoothstep(0.0, -0.15, h));
    float sun = max(dot(d, uSun), 0.0);
    color += vec3(1.0, 0.55, 0.25) * pow(sun, 6.0) * 0.7;
    color += vec3(30.0, 22.0, 14.0) * pow(sun, 900.0);

    // Higher up the air thins out and the sky turns black, with a thin blue line at the horizon.
    vec3 space = mix(vec3(0.0, 0.0, 0.008), vec3(0.06, 0.12, 0.32), smoothstep(0.25, -0.05, h) * 0.8);
    color = mix(color, space, uSpace);
    gl_FragColor = vec4(color, 1.0);
  }
`

// A big ball around the camera with the sky painted inside it (act 1 only).
export function SkyDome({ director }: { director: LaunchDirector }) {
  const dome = useRef<THREE.Mesh>(null)
  const camera = useThree((state) => state.camera)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSun: { value: DAWN_SUN }, uSpace: { value: 0 } },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  )

  useFrame(() => {
    material.uniforms.uSpace.value = director.sky
    if (dome.current) {
      dome.current.position.copy(camera.position)
    }
  })

  return (
    <mesh ref={dome} material={material} renderOrder={-2} frustumCulled={false}>
      <sphereGeometry args={[1500, 48, 24]} />
    </mesh>
  )
}

// Stars, always far away: the group moves with the camera. They fade in as the sky darkens.
export function Stars({ director }: { director: LaunchDirector }) {
  const group = useRef<THREE.Points>(null)
  const camera = useThree((state) => state.camera)

  const { geometry, material } = useMemo(() => {
    const count = 2200
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    let seed = 3
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1
      const angle = random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      positions[i * 3] = Math.cos(angle) * r * 1200
      positions[i * 3 + 1] = u * 1200
      positions[i * 3 + 2] = Math.sin(angle) * r * 1200
      // A few bright stars, most of them faint; slightly blue or warm.
      const bright = random() < 0.06 ? 2.2 : 0.5 + random() * 0.6
      const warm = random()
      colors[i * 3] = bright * (0.85 + warm * 0.15)
      colors[i * 3 + 1] = bright * 0.92
      colors[i * 3 + 2] = bright * (1.0 - warm * 0.12)
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const starMaterial = new THREE.PointsMaterial({
      size: 1.7,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      fog: false,
    })
    return { geometry: starGeometry, material: starMaterial }
  }, [])

  useFrame(() => {
    // Fade in as the sky darkens; fade out while the film shrinks into the mission screen
    // (the shrinking picture would squeeze the stars into a dense crowd).
    const inSky = director.act === 2 ? 1 : Math.max(0, (director.sky - 0.25) / 0.75)
    const visible = inSky * Math.max(0, 1 - director.morph * 2.5)
    material.opacity = visible
    if (group.current) {
      group.current.position.copy(camera.position)
      group.current.visible = visible > 0.01
    }
  })

  return <points ref={group} geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />
}
