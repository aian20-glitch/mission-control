import * as THREE from 'three'

// Planet surfaces drawn by small shader programs (no image files): the Earth with clouds and city
// lights, its thin blue air, and simpler rocky (Moon, Mars) and banded (Jupiter) worlds.
// Used by the launch film and by the mission screen, so the Earth looks the same in both.

// Value noise and fractal noise (several layers of noise added together).
export const NOISE = /* glsl */ `
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
    float ice = smoothstep(0.92, 0.97, abs(p.y));
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
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
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
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
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

const ROCKY_FRAGMENT = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uLight;
  uniform vec3 uDark;
  uniform float uCaps;
  uniform float uScale;
  varying vec3 vObject;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  ${NOISE}

  void main() {
    vec3 p = normalize(vObject);
    // Big light and dark regions, finer texture, and small dark crater spots.
    float regions = smoothstep(0.42, 0.62, fbm(p * uScale + 1.7));
    vec3 color = mix(uDark, uLight, regions);
    color *= 0.8 + 0.4 * fbm(p * uScale * 6.0);
    float craters = smoothstep(0.72, 0.8, noise(p * uScale * 11.0));
    color *= 1.0 - craters * 0.35;
    float cap = smoothstep(0.94, 0.98, abs(p.y)) * uCaps;
    color = mix(color, vec3(0.92, 0.9, 0.88), cap);
    float sun = max(dot(normalize(vWorldNormal), uSun), 0.0);
    color *= 0.03 + 1.3 * sun;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const JUPITER_FRAGMENT = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vObject;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  ${NOISE}

  void main() {
    vec3 p = normalize(vObject);
    // Cloud bands that run around the planet, bent a little by turbulence, and the Great Red Spot.
    float turbulence = fbm(p * 3.0) * 0.6;
    float band = sin((p.y + turbulence * 0.15) * 22.0);
    vec3 color = mix(vec3(0.5, 0.34, 0.22), vec3(0.86, 0.78, 0.62), band * 0.5 + 0.5);
    color = mix(color, vec3(0.95, 0.9, 0.8), smoothstep(0.6, 0.9, fbm(p * 8.0)) * 0.3);
    vec2 spot = vec2(atan(p.z, p.x) - 0.6, p.y + 0.22);
    color = mix(color, vec3(0.75, 0.35, 0.22), smoothstep(0.2, 0.1, length(spot * vec2(1.0, 2.4))));
    float sun = max(dot(normalize(vWorldNormal), uSun), 0.0);
    color *= 0.03 + 1.3 * sun;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createEarthMaterial(sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun }, uTime: { value: 0 } },
    vertexShader: EARTH_VERTEX,
    fragmentShader: EARTH_FRAGMENT,
  })
}

export function createAtmosphereMaterial(sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun } },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function createMoonMaterial(sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun },
      uLight: { value: new THREE.Color(0.62, 0.6, 0.57) },
      uDark: { value: new THREE.Color(0.28, 0.27, 0.26) },
      uCaps: { value: 0 },
      uScale: { value: 2.2 },
    },
    vertexShader: EARTH_VERTEX,
    fragmentShader: ROCKY_FRAGMENT,
  })
}

// Europa: bright water ice with long reddish-brown cracks.
export function createEuropaMaterial(sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun },
      uLight: { value: new THREE.Color(0.86, 0.84, 0.78) },
      uDark: { value: new THREE.Color(0.5, 0.36, 0.27) },
      uCaps: { value: 0 },
      uScale: { value: 3.4 },
    },
    vertexShader: EARTH_VERTEX,
    fragmentShader: ROCKY_FRAGMENT,
  })
}

export function createMarsMaterial(sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun },
      uLight: { value: new THREE.Color(0.78, 0.38, 0.2) },
      uDark: { value: new THREE.Color(0.4, 0.17, 0.09) },
      uCaps: { value: 1 },
      uScale: { value: 2.6 },
    },
    vertexShader: EARTH_VERTEX,
    fragmentShader: ROCKY_FRAGMENT,
  })
}

export function createJupiterMaterial(sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun } },
    vertexShader: EARTH_VERTEX,
    fragmentShader: JUPITER_FRAGMENT,
  })
}
