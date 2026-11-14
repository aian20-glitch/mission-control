import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

// In act 2 the rocket flies 260 units above an Earth with a radius of 6000 units.
// Not to scale (at real scale the rocket would be a speck): the picture is what matters here.
export const EARTH_RADIUS = 6000
export const SPACE_ALTITUDE = 260
export const EARTH_CENTER = new THREE.Vector3(0, -EARTH_RADIUS - SPACE_ALTITUDE, 0)
export const SPACE_SUN = new THREE.Vector3(0.55, 0.4, 0.73).normalize()

// Value noise and fractal noise (several layers of noise added together).
const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }
`

const EARTH_VERTEX = /* glsl */ `
  varying vec3 vObject;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vObject = position;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const EARTH_FRAGMENT = /* glsl */ `
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vObject;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  ${NOISE}

  void main() {
    vec3 p = normalize(vObject);
    vec3 n = normalize(vWorldNormal);
    vec3 view = normalize(cameraPosition - vWorldPosition);

    // Land and sea.
    float height = fbm(p * 2.4 + vec3(3.1, 1.7, 0.4));
    float land = smoothstep(0.5, 0.53, height);
    float hills = smoothstep(0.55, 0.72, height);
    vec3 ocean = mix(vec3(0.005, 0.03, 0.10), vec3(0.02, 0.11, 0.28), smoothstep(0.3, 0.5, height));
    vec3 ground = mix(vec3(0.07, 0.15, 0.05), vec3(0.36, 0.30, 0.18), hills);
    vec3 surface = mix(ocean, ground, land);
    float ice = smoothstep(0.84, 0.92, abs(p.y));
    surface = mix(surface, vec3(0.8, 0.85, 0.9), ice);

    // Clouds, slowly drifting.
    float cloudNoise = fbm(p * 7.0 + vec3(uTime * 0.003, 0.0, uTime * 0.002));
    float clouds = smoothstep(0.5, 0.74, cloudNoise);

    // Day and night.
    float sun = dot(n, uSun);
    float day = smoothstep(-0.1, 0.25, sun);
    vec3 color = surface * (0.02 + 1.6 * max(sun, 0.0));
    color = mix(color, vec3(1.0) * (0.02 + 1.7 * max(sun, 0.0)), clouds * 0.92);

    // Sunlight glinting on the ocean.
    vec3 halfway = normalize(uSun + view);
    float glint = pow(max(dot(n, halfway), 0.0), 400.0) * (1.0 - land) * (1.0 - clouds);
    color += vec3(1.0, 0.85, 0.6) * glint * 0.6 * day;

    // City lights on the night side.
    float cities = smoothstep(0.6, 0.8, fbm(p * 38.0));
    color += vec3(1.0, 0.68, 0.32) * cities * land * (1.0 - clouds) * (1.0 - day) * 1.6;

    // Blue haze of the air toward the edge of the disc.
    float rim = pow(1.0 - max(dot(n, view), 0.0), 2.5);
    color = mix(color, vec3(0.28, 0.55, 1.1) * (0.1 + day * 1.2), rim * 0.7);

    gl_FragColor = vec4(color, 1.0);
  }
`

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 view = normalize(cameraPosition - vWorldPosition);
    // The shell is seen from inside its far half: brightest right next to the planet's edge.
    float edge = clamp(-dot(n, view) / 0.22, 0.0, 1.0);
    float glow = pow(edge, 2.4);
    float lit = clamp(dot(n, uSun) + 0.35, 0.0, 1.0);
    vec3 color = vec3(0.3, 0.6, 1.25) * glow * (0.15 + lit * 1.6);
    gl_FragColor = vec4(color, glow);
  }
`

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

// Act 2: the Earth below, its thin blue air, and the Sun.
export function SpaceSet() {
  const earth = useRef<THREE.Mesh>(null)

  const materials = useMemo(
    () => ({
      earth: new THREE.ShaderMaterial({
        uniforms: { uSun: { value: SPACE_SUN }, uTime: { value: 0 } },
        vertexShader: EARTH_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
      }),
      atmosphere: new THREE.ShaderMaterial({
        uniforms: { uSun: { value: SPACE_SUN } },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
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
