import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  Object3D,
  MeshStandardMaterial,
  DoubleSide,
  SRGBColorSpace,
  Color,
} from 'three'
import { useTextureSet } from './assets.js'
import { makeTree } from './tree-geometry.js'
import { scatter } from './scatter.js'
import { useStore } from '../store.js'

// Wide, overlapping scale ranges are what stop an instanced forest reading as
// an orchard — the same trunk at 0.6x and 1.5x looks like two different trees.
const VARIANTS = [
  { seed: 11, tall: false, count: 24, spacing: 7.0, scale: [0.75, 1.45] },
  { seed: 47, tall: true, count: 16, spacing: 8.4, scale: [0.7, 1.3] },
  { seed: 93, tall: false, count: 22, spacing: 6.4, scale: [0.55, 1.1] },
]

/** Leaves need alpha cutout, double sides, and a bit of wind. */
function useCanopyMaterial() {
  const map = useTexture('/textures/canopy.webp')
  const reducedMotion = useStore((s) => s.reducedMotion)
  const wind = useRef({ value: 0 })

  const material = useMemo(() => {
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8

    const mat = new MeshStandardMaterial({
      map,
      alphaTest: 0.42,
      side: DoubleSide,
      roughness: 0.88,
      metalness: 0,
      // White here so the per-instance tint set in TreeVariant is what shows;
      // instanceColor multiplies this.
      color: new Color('#ffffff'),
    })

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = wind.current
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uWind;\nattribute float aSway;',
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          // Sway the outer canopy more than the inner; offset per instance so
          // the whole forest doesn't move as one.
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.27;
          #else
            float phase = 0.0;
          #endif
          float gust = sin( uWind + phase ) * 0.5 + sin( uWind * 1.7 + phase * 2.1 ) * 0.5;
          transformed.x += gust * aSway * 0.16;
          transformed.z += cos( uWind * 0.8 + phase ) * aSway * 0.11;
          `,
        )
    }
    mat.customProgramCacheKey = () => 'canopy-wind-v1'
    return mat
  }, [map])

  useFrame((_, delta) => {
    if (!reducedMotion) wind.current.value += delta * 0.9
  })

  return material
}

function useBarkMaterial() {
  const bark = useTextureSet('bark')
  return useMemo(
    () =>
      new MeshStandardMaterial({
        map: bark.albedo,
        normalMap: bark.normal,
        roughnessMap: bark.arm,
        aoMap: bark.arm,
        roughness: 1,
        metalness: 0,
        // The scan is pale for a dusk scene; darken it so trunks read as wood
        // rather than bleached bone against the sky.
        color: new Color('#7d6650'),
      }),
    [bark],
  )
}

/** One tree variant, instanced across its scatter positions. */
function TreeVariant({ variant, barkMaterial, canopyMaterial, index }) {
  const trunkRef = useRef()
  const canopyRef = useRef()

  const { trunk, canopy } = useMemo(
    () => makeTree(variant.seed, { tall: variant.tall }),
    [variant.seed, variant.tall],
  )

  const points = useMemo(
    () =>
      scatter({
        count: variant.count,
        seed: variant.seed * 31 + 7,
        minSpacing: variant.spacing,
        maxSlope: 0.3,
        scale: variant.scale,
        maxRadius: 38,
        sink: 0.15,
        clumping: 0.85,
        // Keep the canopies well clear of the structures — a tree in front of
        // the cabin hides the thing the player walked over to look at.
        clearZones: 1.75,
      }),
    [variant],
  )

  useLayoutEffect(() => {
    const dummy = new Object3D()
    const tint = new Color()

    points.forEach(([x, y, z, yaw, scale], i) => {
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, yaw, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      trunkRef.current?.setMatrixAt(i, dummy.matrix)
      canopyRef.current?.setMatrixAt(i, dummy.matrix)

      // Nudge each canopy's hue and lightness. Identical green across a whole
      // forest is the giveaway that everything came from one mesh; a few
      // percent of drift is enough to break it up. Derived from the position
      // so it's stable across reloads.
      const noise = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
      tint.setHSL(0.23 + (noise - 0.5) * 0.06, 0.28 + noise * 0.18, 0.3 + noise * 0.14)
      canopyRef.current?.setColorAt(i, tint)
    })

    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true
    if (canopyRef.current) {
      canopyRef.current.instanceMatrix.needsUpdate = true
      if (canopyRef.current.instanceColor) canopyRef.current.instanceColor.needsUpdate = true
    }
  }, [points])

  if (!points.length) return null

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[trunk, barkMaterial, points.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={canopyRef}
        args={[canopy, canopyMaterial, points.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </group>
  )
}

/**
 * The island's trees. Three hand-seeded variants, each instanced — so the
 * whole forest is six draw calls regardless of how many trees are on screen.
 */
export default function Foliage() {
  const barkMaterial = useBarkMaterial()
  const canopyMaterial = useCanopyMaterial()
  const quality = useStore((s) => s.quality)

  const variants = quality === 'low' ? VARIANTS.slice(0, 2) : VARIANTS

  return (
    <group>
      {variants.map((variant, i) => (
        <TreeVariant
          key={variant.seed}
          index={i}
          variant={variant}
          barkMaterial={barkMaterial}
          canopyMaterial={canopyMaterial}
        />
      ))}
    </group>
  )
}
