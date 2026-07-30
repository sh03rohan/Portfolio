import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, PointsMaterial, Color } from 'three'
import { zoneById } from '../data/world.js'
import { terrainHeight, makeRandom } from './heightfield.js'
import { uTime, uWindStrength } from './wind.js'
import { useStore } from '../store.js'

/**
 * Woodsmoke off the cabin chimney.
 *
 * Built on `PointsMaterial` extended through `onBeforeCompile` rather than a
 * bare ShaderMaterial, which is what gets this fog, tone mapping, output
 * colour space and size attenuation for free — all four of which a raw shader
 * would have to reimplement, and would get subtly wrong in the fog preset.
 *
 * The soft round edge is analytic (a smoothstep on `gl_PointCoord`), so there
 * is no sprite texture to download.
 */

/** Where the chimney actually is, derived from the structure rather than typed in. */
function chimneyPosition() {
  const zone = zoneById.about
  const [x, , z] = zone.position
  const r = zone.rotation
  // Structures.jsx puts the cabin's chimney at local [1.5, 3.9, -0.9] as a
  // 1.6-tall box, so its lip is at 4.7. The group is rotated about Y.
  const lx = 1.5
  const lz = -0.9
  return [
    x + lx * Math.cos(r) + lz * Math.sin(r),
    terrainHeight(x, z) + 4.8,
    z - lx * Math.sin(r) + lz * Math.cos(r),
  ]
}

function makeGeometry(count, seed = 91) {
  const random = makeRandom(seed)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    // A little scatter across the flue so the column doesn't start as a line.
    positions[i * 3 + 0] = (random() - 0.5) * 0.22
    positions[i * 3 + 1] = (random() - 0.5) * 0.12
    positions[i * 3 + 2] = (random() - 0.5) * 0.22
    seeds[i] = random()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1))
  return geometry
}

function useSmokeMaterial() {
  return useMemo(() => {
    const material = new PointsMaterial({
      color: new Color('#cfc7bd'),
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      // Smoke over smoke should thicken, not brighten — additive would turn
      // the plume into a searchlight the moment two puffs overlapped.
      depthWrite: false,
      opacity: 0.5,
      fog: true,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uWindStrength = uWindStrength

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          uniform float uWindStrength;
          attribute float aSeed;
          varying float vLife;
          varying float vSizeMul;
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          // Each puff runs its own 0..1 life on a slightly different clock, so
          // the column never pulses as one.
          float life = fract( uTime * ( 0.13 + aSeed * 0.05 ) + aSeed );
          vLife = life;
          float spread = 0.25 + life * 1.9;
          // Wind pushes harder the higher it gets — near the lip the plume is
          // still coherent, and it only starts to lean once it's clear.
          transformed.x += sin( uTime * 0.6 + aSeed * 33.0 ) * spread + life * life * uWindStrength * 3.4;
          transformed.z += cos( uTime * 0.47 + aSeed * 19.0 ) * spread * 0.8;
          transformed.y += life * 6.5;
          vSizeMul = 0.35 + life * 2.8;
          `,
        )
        // Size is assigned between project_vertex and here, so this is the
        // first point at which it can be scaled per particle.
        .replace('#include <fog_vertex>', 'gl_PointSize *= vSizeMul;\n#include <fog_vertex>')

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vLife;\nvarying float vSizeMul;',
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `
          #include <color_fragment>
          float d = length( gl_PointCoord - 0.5 );
          // Thins out over most of its life rather than at the very end, so it
          // dissolves into the sky instead of switching off.
          float fade = smoothstep( 0.0, 0.05, vLife ) * ( 1.0 - smoothstep( 0.3, 1.0, vLife ) );
          diffuseColor.a *= smoothstep( 0.5, 0.05, d ) * fade;
          `,
        )
    }

    material.customProgramCacheKey = () => 'smoke-v1'
    return material
  }, [])
}

export default function Smoke() {
  const quality = useStore((s) => s.quality)
  // Enough that the column stays continuous near the lip — too few and the
  // plume reads as separate puffs floating clear of the chimney.
  const count = quality === 'high' ? 46 : quality === 'medium' ? 30 : 16

  const position = useMemo(chimneyPosition, [])
  const geometry = useMemo(() => makeGeometry(count), [count])
  const material = useSmokeMaterial()

  return <points key={count} position={position} args={[geometry, material]} frustumCulled={false} />
}
