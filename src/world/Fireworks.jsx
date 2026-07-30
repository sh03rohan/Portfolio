import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  PointsMaterial,
  Sphere,
  Vector3,
} from 'three'
import { makeRandom } from './heightfield.js'
import { uTime } from './wind.js'
import { attenuateFog } from './glow.js'
import { useStore } from '../store.js'

/**
 * The reward for finding all twelve sparks: a handful of shells over the island.
 *
 * Rockets rise, burst, and fall — all of it from one start time in a vertex
 * shader, so firing the whole display costs a single uniform write. Like the
 * pickup burst it is mounted from the first frame and simply sits invisible,
 * because a material created at the moment of celebration would compile its
 * shader right then and stutter through the one moment that shouldn't.
 */

const SHELL_GAP = 0.8 // seconds between launches
const RISE = 1.0 // seconds from the ground to the burst
const FALL = 1.8 // seconds of burning embers

function makeGeometry(shells, perShell, seed = 77) {
  const random = makeRandom(seed)
  const count = shells * perShell
  const positions = new Float32Array(count * 3)
  const dirs = new Float32Array(count * 3)
  const bursts = new Float32Array(count * 3)
  const index = new Float32Array(count)

  for (let s = 0; s < shells; s++) {
    // Spread the shells across the island and stagger their heights, so the
    // display has some depth instead of going off in one plane.
    const theta = random() * Math.PI * 2
    const radius = 8 + random() * 26
    const burst = [Math.cos(theta) * radius, 26 + random() * 16, Math.sin(theta) * radius]

    for (let p = 0; p < perShell; p++) {
      const i = s * perShell + p
      // Evenly on a sphere — a firework really is isotropic, unlike the pickup
      // burst which is meant to lift away.
      const y = random() * 2 - 1
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const phi = random() * Math.PI * 2
      const speed = 0.55 + random() * 0.75

      dirs[i * 3 + 0] = Math.cos(phi) * r * speed
      dirs[i * 3 + 1] = y * speed
      dirs[i * 3 + 2] = Math.sin(phi) * r * speed
      bursts[i * 3 + 0] = burst[0]
      bursts[i * 3 + 1] = burst[1]
      bursts[i * 3 + 2] = burst[2]
      index[i] = s
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aDir', new Float32BufferAttribute(dirs, 3))
  geometry.setAttribute('aBurst', new Float32BufferAttribute(bursts, 3))
  geometry.setAttribute('aShell', new Float32BufferAttribute(index, 1))
  geometry.boundingSphere = new Sphere(new Vector3(0, 30, 0), 120)
  return geometry
}

function useFireworkMaterial(uStart) {
  return useMemo(() => {
    const material = new PointsMaterial({
      color: new Color('#ffffff'),
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uStart = uStart

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          uniform float uStart;
          attribute vec3 aDir;
          attribute vec3 aBurst;
          attribute float aShell;
          varying float vAlpha;
          varying vec3 vTint;
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          float t = uTime - uStart - aShell * ${SHELL_GAP.toFixed(2)};
          float rise = clamp( t / ${RISE.toFixed(2)}, 0.0, 1.0 );
          float boom = t - ${RISE.toFixed(2)};
          float life = clamp( boom / ${FALL.toFixed(2)}, 0.0, 1.0 );

          // Straight up from directly beneath the burst.
          vec3 launch = vec3( aBurst.x, 1.5, aBurst.z );
          // Decelerating climb, so the rocket visibly runs out of push.
          vec3 pos = mix( launch, aBurst, 1.0 - pow( 1.0 - rise, 2.0 ) );

          if ( boom > 0.0 ) {
            float travel = 1.0 - pow( 1.0 - life, 3.0 );
            pos = aBurst + aDir * travel * 7.0 - vec3( 0.0, 4.5 * life * life, 0.0 );
          }
          transformed = pos;

          // Before launch and after the embers die, alpha is zero — which is
          // what keeps the whole cloud invisible until it's fired.
          float twinkle = 0.65 + 0.35 * sin( uTime * 26.0 + aDir.x * 37.0 + aShell * 11.0 );
          float trail = step( 0.0001, rise ) * ( 1.0 - step( 0.0, boom ) ) * 0.55;
          float embers = step( 0.0, boom ) * ( 1.0 - life ) * twinkle;
          vAlpha = ( trail + embers ) * step( 0.0001, t );

          // A different hue per shell, from the shell index alone.
          vTint = 0.55 + 0.45 * cos( 6.2831853 * ( aShell * 0.19 ) + vec3( 0.0, 2.1, 4.2 ) );
          `,
        )
        .replace(
          '#include <fog_vertex>',
          'gl_PointSize *= mix( 1.4, 0.5, life );\n#include <fog_vertex>',
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vAlpha;\nvarying vec3 vTint;',
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `
          #include <color_fragment>
          float d = length( gl_PointCoord - 0.5 );
          diffuseColor.a *= smoothstep( 0.5, 0.0, d ) * vAlpha;
          diffuseColor.rgb *= vTint * 2.2;
          `,
        )

      attenuateFog(shader)
    }

    material.customProgramCacheKey = () => 'fireworks-v1'
    return material
  }, [uStart])
}

/**
 * `?celebrate=1` in dev fires the display without finding all twelve sparks
 * first. Reviewing a reward shouldn't cost a lap of the island.
 */
function useCelebrationFlag() {
  const ready = useStore((s) => s.ready)
  useEffect(() => {
    if (!import.meta.env.DEV || !ready) return
    if (!new URLSearchParams(window.location.search).has('celebrate')) return
    useStore.setState({ celebrating: true })
  }, [ready])
}

export default function Fireworks() {
  const quality = useStore((s) => s.quality)
  const celebrating = useStore((s) => s.celebrating)
  const endCelebration = useStore((s) => s.endCelebration)
  useCelebrationFlag()

  const shells = quality === 'high' ? 8 : quality === 'medium' ? 5 : 0
  const perShell = quality === 'high' ? 70 : 46

  const uStart = useRef({ value: -999 }).current
  const geometry = useMemo(() => makeGeometry(shells, perShell), [shells, perShell])
  const material = useFireworkMaterial(uStart)

  useEffect(() => {
    if (!celebrating) return
    uStart.value = uTime.value

    // Clear the flag once the last ember is out, so the toast leaves with it
    // and a later reload doesn't replay the display.
    const total = (shells * SHELL_GAP + RISE + FALL + 1) * 1000
    const id = setTimeout(endCelebration, total)
    return () => clearTimeout(id)
  }, [celebrating, endCelebration, shells, uStart])

  if (!shells) return null

  return <points key={shells} args={[geometry, material]} frustumCulled={false} />
}
