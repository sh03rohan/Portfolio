import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PointsMaterial,
  Sphere,
  Vector3,
} from 'three'
import {
  collectibles,
  collectibleCount,
  COLLECT_RADIUS,
  HOVER_HEIGHT,
} from '../data/collectibles.js'
import { terrainHeight, isPlantable, makeRandom } from './heightfield.js'
import { playerPosition } from './player-position.js'
import { uTime, uAnimate } from './wind.js'
import { attenuateFog } from './glow.js'
import { sfx } from './sfx.js'
import { useStore } from '../store.js'

/**
 * Twelve sparks hidden around the island.
 *
 * One instanced mesh for the crystals and one Points cloud for their haloes —
 * two draw calls for the whole set, however many there are. The bob and the
 * spin live in the vertex shader on the shared clock, so collecting is the only
 * thing that ever touches the CPU here.
 *
 * Collected ones are hidden by zeroing their instance matrix rather than by
 * re-rendering with a shorter list: rebuilding the geometry to remove one item
 * would drop the whole set's shader and rebuild it mid-walk.
 */

const SPARK_COLOUR = '#ffd98a'

/** Per-instance phase, derived from position so it needs no extra attribute. */
const PHASE_FROM_INSTANCE = /* glsl */ `
  #ifdef USE_INSTANCING
    float phase = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.51;
  #else
    float phase = 0.0;
  #endif
`

/** Spin about Y and bob, both on the shared clock. */
const SPARK_MOTION = /* glsl */ `
  float spinA = uTime * 1.15 * uAnimate + phase;
  float sc = cos( spinA );
  float ss = sin( spinA );
  mat2 spin = mat2( sc, -ss, ss, sc );
`

function useSparkMaterial() {
  return useMemo(() => {
    const material = new MeshStandardMaterial({
      color: new Color(SPARK_COLOUR),
      emissive: new Color(SPARK_COLOUR),
      // Over the bloom pass's 0.95 threshold, so the post stack gives each one
      // its halo instead of a sprite.
      emissiveIntensity: 2.6,
      roughness: 0.25,
      metalness: 0,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uAnimate = uAnimate
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>\nuniform float uTime;\nuniform float uAnimate;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          #include <beginnormal_vertex>
          ${PHASE_FROM_INSTANCE}
          ${SPARK_MOTION}
          objectNormal.xz = spin * objectNormal.xz;
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          transformed.xz = spin * transformed.xz;
          transformed.y += sin( uTime * 1.7 * uAnimate + phase ) * 0.14;
          `,
        )
    }

    material.customProgramCacheKey = () => 'spark-v1'
    return material
  }, [])
}

/**
 * The soft halo around each spark. A separate additive Points cloud rather than
 * a bigger emissive shell, because a shell would occlude the crystal inside it.
 */
function useHaloMaterial() {
  return useMemo(() => {
    const material = new PointsMaterial({
      color: new Color('#ffe6b0'),
      size: 0.85,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      fog: true,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uAnimate = uAnimate
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          uniform float uAnimate;
          attribute float aPhase;
          attribute float aFound;
          varying float vAlive;
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          transformed.y += sin( uTime * 1.7 * uAnimate + aPhase ) * 0.14;
          vAlive = 1.0 - aFound;
          `,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlive;')
        .replace(
          '#include <color_fragment>',
          /* glsl */ `
          #include <color_fragment>
          float d = length( gl_PointCoord - 0.5 );
          diffuseColor.a *= smoothstep( 0.5, 0.0, d ) * 0.55 * vAlive;
          diffuseColor.rgb *= 1.8;
          `,
        )

      attenuateFog(shader)
    }

    material.customProgramCacheKey = () => 'spark-halo-v1'
    return material
  }, [])
}

/**
 * The puff of light a spark leaves behind.
 *
 * Mounted from the first frame and driven by a start time rather than being
 * created on collection — a fresh material at the moment of pickup would
 * compile its shader right then, which is a visible hitch precisely when
 * something good is meant to be happening. It compiles during warmup with
 * everything else and simply sits at zero opacity until it's needed.
 */
function CollectBurst({ api }) {
  const points = useRef()

  const geometry = useMemo(() => {
    const count = 26
    const random = makeRandom(4242)
    const positions = new Float32Array(count * 3)
    const dirs = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Sampled on a sphere, biased upward — a burst that goes evenly in all
      // directions reads as an explosion, not as something lifting away.
      const theta = random() * Math.PI * 2
      const y = 0.15 + random() * 0.85
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const speed = 0.6 + random() * 1.5
      dirs[i * 3 + 0] = Math.cos(theta) * r * speed
      dirs[i * 3 + 1] = y * speed * 1.5
      dirs[i * 3 + 2] = Math.sin(theta) * r * speed
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(positions, 3))
    g.setAttribute('aDir', new Float32BufferAttribute(dirs, 3))
    g.boundingSphere = new Sphere(new Vector3(), 60)
    return g
  }, [])

  const uOrigin = useRef({ value: new Vector3(0, -999, 0) }).current
  const uStart = useRef({ value: -999 }).current

  const material = useMemo(() => {
    const m = new PointsMaterial({
      color: new Color('#ffe3a6'),
      size: 0.4,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uOrigin = uOrigin
      shader.uniforms.uStart = uStart
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          uniform vec3 uOrigin;
          uniform float uStart;
          attribute vec3 aDir;
          varying float vLife;
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          float life = clamp( ( uTime - uStart ) / 0.9, 0.0, 1.0 );
          vLife = life;
          // Ease out and fall: fast off the mark, then gravity takes over.
          float travel = 1.0 - pow( 1.0 - life, 2.5 );
          transformed = uOrigin + aDir * travel - vec3( 0.0, 1.6 * life * life, 0.0 );
          `,
        )
        .replace('#include <fog_vertex>', 'gl_PointSize *= 1.0 - vLife * 0.55;\n#include <fog_vertex>')

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLife;')
        .replace(
          '#include <color_fragment>',
          /* glsl */ `
          #include <color_fragment>
          float d = length( gl_PointCoord - 0.5 );
          // Dead at life 1 and at life 0, so the cloud is invisible until fired.
          diffuseColor.a *= smoothstep( 0.5, 0.0, d ) * ( 1.0 - vLife ) * step( 0.0001, vLife );
          diffuseColor.rgb *= 1.7;
          `,
        )

      attenuateFog(shader)
    }

    m.customProgramCacheKey = () => 'collect-burst-v1'
    return m
  }, [uOrigin, uStart])

  // Handed back to the parent so a pickup can fire it without a re-render.
  useEffect(() => {
    api.current = (position) => {
      uOrigin.value.copy(position)
      uStart.value = uTime.value
    }
  }, [api, uOrigin, uStart])

  return <points ref={points} args={[geometry, material]} frustumCulled={false} />
}

export default function Collectibles() {
  const sparks = useRef()
  const halos = useRef()
  const fire = useRef(() => {})
  const sparkMaterial = useSparkMaterial()
  const haloMaterial = useHaloMaterial()

  /** Resolved once: XZ from the data file, Y from the heightfield. */
  const placed = useMemo(
    () =>
      collectibles.map((item) => {
        const [x, z] = item.position
        if (import.meta.env.DEV && !isPlantable(x, z)) {
          console.warn(
            `[collectibles] "${item.id}" at ${x},${z} is on a cliff or under the tide — ` +
              'it will be unreachable.',
          )
        }
        return { ...item, world: new Vector3(x, terrainHeight(x, z) + HOVER_HEIGHT, z) }
      }),
    [],
  )

  const geometry = useMemo(() => new OctahedronGeometry(0.24, 0), [])

  const haloGeometry = useMemo(() => {
    const positions = new Float32Array(placed.length * 3)
    const phases = new Float32Array(placed.length)
    const found = new Float32Array(placed.length)
    placed.forEach((item, i) => {
      positions[i * 3 + 0] = item.world.x
      positions[i * 3 + 1] = item.world.y
      positions[i * 3 + 2] = item.world.z
      // The same expression the instanced shader derives, so a crystal and its
      // halo bob in lockstep.
      phases[i] = item.world.x * 0.7 + item.world.z * 0.51
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new Float32BufferAttribute(phases, 1))
    g.setAttribute('aFound', new Float32BufferAttribute(found, 1))
    g.boundingSphere = new Sphere(new Vector3(0, 2, 0), 50)
    return g
  }, [placed])

  /** Hide one, in both the mesh and the halo cloud. */
  const hide = (index) => {
    const dummy = new Object3D()
    dummy.scale.setScalar(0)
    dummy.updateMatrix()
    sparks.current?.setMatrixAt(index, dummy.matrix)
    if (sparks.current) sparks.current.instanceMatrix.needsUpdate = true

    const attribute = halos.current?.geometry.getAttribute('aFound')
    if (attribute) {
      attribute.setX(index, 1)
      attribute.needsUpdate = true
    }
  }

  // Place everything, then immediately hide whatever was found on a past visit.
  useLayoutEffect(() => {
    const dummy = new Object3D()
    const alreadyFound = useStore.getState().found
    placed.forEach((item, i) => {
      dummy.position.copy(item.world)
      dummy.scale.setScalar(alreadyFound.includes(item.id) ? 0 : 1)
      dummy.updateMatrix()
      sparks.current?.setMatrixAt(i, dummy.matrix)
    })
    if (sparks.current) sparks.current.instanceMatrix.needsUpdate = true

    const attribute = halos.current?.geometry.getAttribute('aFound')
    if (attribute) {
      placed.forEach((item, i) => attribute.setX(i, alreadyFound.includes(item.id) ? 1 : 0))
      attribute.needsUpdate = true
    }
  }, [placed])

  useFrame(() => {
    const { entered, found, markFound } = useStore.getState()
    if (!entered || found.length >= collectibleCount) return

    const player = playerPosition.get()
    for (let i = 0; i < placed.length; i++) {
      const item = placed[i]
      if (found.includes(item.id)) continue
      // Horizontal distance only: reaching one on a slope shouldn't need the
      // player's feet at exactly its height.
      const dx = player.x - item.world.x
      const dz = player.z - item.world.z
      if (dx * dx + dz * dz > COLLECT_RADIUS * COLLECT_RADIUS) continue

      hide(i)
      fire.current(item.world)
      // `found.length` is the count *before* this one, which is the index the
      // pickup note should be pitched at.
      sfx.emit('pickup', found.length)
      markFound(item.id)
      if (found.length + 1 >= collectibleCount) sfx.emit('complete')
      break
    }
  })

  return (
    <group>
      <instancedMesh
        ref={sparks}
        args={[geometry, sparkMaterial, placed.length]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
      <points ref={halos} args={[haloGeometry, haloMaterial]} frustumCulled={false} />
      <CollectBurst api={fire} />
    </group>
  )
}
