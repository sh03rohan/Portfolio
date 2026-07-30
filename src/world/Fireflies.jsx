import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  PointsMaterial,
  Sphere,
  Vector3,
} from 'three'
import { WEATHER } from '../data/weather.js'
import { allTreePoints } from './trees.js'
import { makeRandom, terrainHeight } from './heightfield.js'
import { uTime, uAnimate } from './wind.js'
import { attenuateFog } from './glow.js'
import { useStore } from '../store.js'

/**
 * Fireflies in the undergrowth after dark.
 *
 * The existing dust motes (Atmosphere.jsx) fill a box evenly, which is right
 * for airborne dust and wrong for insects — these cluster on the trees the
 * forest actually drew, at the height of the undergrowth rather than the
 * canopy, so walking into a stand of trees walks you into the swarm.
 *
 * Same technique as the smoke: PointsMaterial extended in place, so they fog
 * and tone-map with the rest of the scene. Additive and pushed above the bloom
 * threshold, so the post stack gives each one its halo instead of a sprite.
 */

/** How far above the bloom cutoff (0.95) the glow sits. */
const GLOW_BOOST = 2.4

function makeGeometry(count, seed = 707) {
  const trees = allTreePoints()
  if (!trees.length) return null

  const random = makeRandom(seed)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const [tx, , tz] = trees[Math.floor(random() * trees.length) % trees.length]
    // A ring around the trunk, sampled by area so they don't bunch at the
    // base, and kept low — fireflies live in the undergrowth, not the crown.
    const r = 0.9 + Math.sqrt(random()) * 2.6
    const theta = random() * Math.PI * 2
    const x = tx + Math.cos(theta) * r
    const z = tz + Math.sin(theta) * r

    positions[i * 3 + 0] = x
    positions[i * 3 + 1] = terrainHeight(x, z) + 0.35 + random() * 1.9
    positions[i * 3 + 2] = z
    seeds[i] = random()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1))
  // The shader wanders each point around its base; widen the bounds to match
  // or three culls the swarm early at the edges of the island.
  geometry.boundingSphere = new Sphere(new Vector3(0, 3, 0), 46)
  return geometry
}

function useFireflyMaterial(presence) {
  return useMemo(() => {
    const material = new PointsMaterial({
      color: new Color('#ffdf9a'),
      size: 0.09,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      // Left out of tone mapping so the boost below survives to the bloom pass
      // instead of being rolled back off by ACES.
      toneMapped: false,
      fog: true,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uAnimate = uAnimate
      shader.uniforms.uPresence = presence

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          uniform float uAnimate;
          attribute float aSeed;
          varying float vGlow;
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          float t = uTime * ( 0.22 + aSeed * 0.25 );
          transformed.x += sin( t * 1.7 + aSeed * 41.0 ) * 0.85;
          transformed.y += sin( t * 1.13 + aSeed * 17.0 ) * 0.45;
          transformed.z += cos( t * 1.31 + aSeed * 29.0 ) * 0.85;
          // Sharply peaked, so most are dark most of the time and the field
          // reads as blinking rather than as a string of fairy lights.
          float blink = pow( max( 0.0, sin( uTime * ( 1.1 + aSeed * 2.4 ) + aSeed * 61.0 ) ), 3.0 );
          vGlow = mix( 0.62, 0.18 + 0.82 * blink, uAnimate );
          `,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uPresence;
          varying float vGlow;
          `,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `
          #include <color_fragment>
          float d = length( gl_PointCoord - 0.5 );
          diffuseColor.a *= smoothstep( 0.5, 0.02, d ) * vGlow * uPresence;
          diffuseColor.rgb *= ${GLOW_BOOST.toFixed(1)};
          `,
        )

      attenuateFog(shader)
    }

    material.customProgramCacheKey = () => 'fireflies-v1'
    return material
  }, [presence])
}

export default function Fireflies() {
  const quality = useStore((s) => s.quality)
  const points = useRef()
  const count = quality === 'high' ? 240 : quality === 'medium' ? 120 : 0

  const presence = useRef({ value: 0 }).current
  const geometry = useMemo(() => makeGeometry(count), [count])
  const material = useFireflyMaterial(presence)

  useFrame((_, delta) => {
    const { weatherIndex, ready } = useStore.getState()
    const target = WEATHER[weatherIndex].fireflies
    presence.value += (target - presence.value) * Math.min(1, delta * 0.6)
    // Visible through warmup, or the shader compiles the first time night falls.
    if (points.current) points.current.visible = presence.value > 0.01 || !ready
  })

  if (!count || !geometry) return null

  return <points key={count} ref={points} args={[geometry, material]} frustumCulled={false} />
}
