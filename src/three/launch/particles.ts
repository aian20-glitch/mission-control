import * as THREE from 'three'

// A pool of soft round sprites that always face the camera: smoke, vapour, puffs.
// Each particle has a position, speed, size and colour; `update` moves them every frame.

export interface SpawnOptions {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number // seconds
  startSize: number
  endSize: number
  alpha: number
  drag: number // how quickly it slows down (per second)
  rise: number // upward push per second; negative = sinks
  r: number // colour once cooled down
  g: number
  b: number
  hot: number // 0..1: starts lit orange by the engine flame and cools to its colour
}

const VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aSpin;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(aCenter, 1.0);
    float c = cos(aSpin);
    float s = sin(aSpin);
    vec2 corner = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
    mvPosition.xy += corner * aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uLight;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float alpha = tex.a * vAlpha;
    if (alpha < 0.002) {
      discard;
    }
    gl_FragColor = vec4(vColor * uLight, alpha);
  }
`

const WARM = { r: 1.7, g: 1.0, b: 0.5 }

export class ParticlePool {
  readonly mesh: THREE.Mesh
  readonly material: THREE.ShaderMaterial
  private readonly count: number
  private next = 0
  private readonly alive: Uint8Array
  private readonly velocity: Float32Array
  private readonly age: Float32Array
  private readonly life: Float32Array
  private readonly startSize: Float32Array
  private readonly endSize: Float32Array
  private readonly startAlpha: Float32Array
  private readonly drag: Float32Array
  private readonly rise: Float32Array
  private readonly hot: Float32Array
  private readonly baseColor: Float32Array
  private readonly spinSpeed: Float32Array
  private readonly center: THREE.InstancedBufferAttribute
  private readonly size: THREE.InstancedBufferAttribute
  private readonly alpha: THREE.InstancedBufferAttribute
  private readonly color: THREE.InstancedBufferAttribute
  private readonly spin: THREE.InstancedBufferAttribute

  constructor(count: number, texture: THREE.Texture, additive: boolean) {
    this.count = count
    this.alive = new Uint8Array(count)
    this.velocity = new Float32Array(count * 3)
    this.age = new Float32Array(count)
    this.life = new Float32Array(count)
    this.startSize = new Float32Array(count)
    this.endSize = new Float32Array(count)
    this.startAlpha = new Float32Array(count)
    this.drag = new Float32Array(count)
    this.rise = new Float32Array(count)
    this.hot = new Float32Array(count)
    this.baseColor = new Float32Array(count * 3)
    this.spinSpeed = new Float32Array(count)

    const plane = new THREE.PlaneGeometry(1, 1)
    const geometry = new THREE.InstancedBufferGeometry()
    geometry.index = plane.index
    geometry.setAttribute('position', plane.getAttribute('position'))
    geometry.setAttribute('uv', plane.getAttribute('uv'))
    this.center = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
    this.spin = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    for (const attribute of [this.center, this.size, this.alpha, this.color, this.spin]) {
      attribute.setUsage(THREE.DynamicDrawUsage)
    }
    geometry.setAttribute('aCenter', this.center)
    geometry.setAttribute('aSize', this.size)
    geometry.setAttribute('aAlpha', this.alpha)
    geometry.setAttribute('aColor', this.color)
    geometry.setAttribute('aSpin', this.spin)
    geometry.instanceCount = count

    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uLight: { value: 1 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.frustumCulled = false
  }

  spawn(o: SpawnOptions) {
    // The oldest slot is reused when the pool is full.
    const i = this.next
    this.next = (this.next + 1) % this.count
    this.alive[i] = 1
    this.center.setXYZ(i, o.x, o.y, o.z)
    this.velocity[i * 3] = o.vx
    this.velocity[i * 3 + 1] = o.vy
    this.velocity[i * 3 + 2] = o.vz
    this.age[i] = 0
    this.life[i] = o.life
    this.startSize[i] = o.startSize
    this.endSize[i] = o.endSize
    this.startAlpha[i] = o.alpha
    this.drag[i] = o.drag
    this.rise[i] = o.rise
    this.hot[i] = o.hot
    this.baseColor[i * 3] = o.r
    this.baseColor[i * 3 + 1] = o.g
    this.baseColor[i * 3 + 2] = o.b
    this.spin.setX(i, Math.random() * Math.PI * 2)
    this.spinSpeed[i] = (Math.random() - 0.5) * 0.6
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.alive[i] === 0) {
        continue
      }
      this.age[i] = this.age[i] + dt
      if (this.age[i] >= this.life[i]) {
        this.alive[i] = 0
        this.size.setX(i, 0)
        this.alpha.setX(i, 0)
        continue
      }
      const slow = Math.max(0, 1 - this.drag[i] * dt)
      const vx = this.velocity[i * 3] * slow
      const vy = this.velocity[i * 3 + 1] * slow + this.rise[i] * dt
      const vz = this.velocity[i * 3 + 2] * slow
      this.velocity[i * 3] = vx
      this.velocity[i * 3 + 1] = vy
      this.velocity[i * 3 + 2] = vz
      this.center.setXYZ(i, this.center.getX(i) + vx * dt, this.center.getY(i) + vy * dt, this.center.getZ(i) + vz * dt)

      const t = this.age[i] / this.life[i]
      const grow = 1 - (1 - t) * (1 - t)
      this.size.setX(i, this.startSize[i] + (this.endSize[i] - this.startSize[i]) * grow)
      const fadeIn = Math.min(1, t / 0.08)
      const fadeOut = Math.pow(1 - t, 1.5)
      this.alpha.setX(i, this.startAlpha[i] * fadeIn * fadeOut)

      const heat = this.hot[i] * Math.max(0, 1 - t * 3)
      const r = this.baseColor[i * 3]
      const g = this.baseColor[i * 3 + 1]
      const b = this.baseColor[i * 3 + 2]
      this.color.setXYZ(i, r + (WARM.r - r) * heat, g + (WARM.g - g) * heat, b + (WARM.b - b) * heat)
      this.spin.setX(i, this.spin.getX(i) + this.spinSpeed[i] * dt)
    }
    this.center.needsUpdate = true
    this.size.needsUpdate = true
    this.alpha.needsUpdate = true
    this.color.needsUpdate = true
    this.spin.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
