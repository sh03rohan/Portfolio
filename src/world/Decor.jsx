import { useMemo, useRef, useLayoutEffect } from 'react'
import { Box3, Object3D, Mesh } from 'three'
import { MODELS, useModel } from './assets.js'
import { scatter, alongPath } from './scatter.js'
import { pathNodes } from '../data/world.js'
import { terrainHeight } from './heightfield.js'
import { applyWindSway } from './wind.js'
import { useStore } from '../store.js'

/**
 * Every repeated CC0 prop on the island, drawn with instancing — one draw call
 * per mesh no matter how many copies are placed.
 */

/** Pull the renderable meshes out of a loaded glTF scene. */
function useMeshes(url) {
  const { scene } = useModel(url)
  return useMemo(() => {
    const found = []
    scene.updateMatrixWorld(true)
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return

      const geometry = child.geometry.clone()
      geometry.applyMatrix4(child.matrixWorld) // bake the node transform

      const material = child.material.clone()
      // Poly Haven exports foliage as BLEND; cutout sorts correctly and casts
      // proper shadows, which matters far more here than soft leaf edges.
      if (material.transparent) {
        material.transparent = false
        material.alphaTest = 0.4
        material.depthWrite = true
      }
      material.envMapIntensity = 1

      found.push({ geometry, material, name: child.name })
    })
    return found
  }, [scene])
}

/** Places one glTF's meshes at a shared set of transforms. */
function InstancedModel({ url, points, castShadow = true, meshIndex, yOffset = 0, sway = 0 }) {
  const meshes = useMeshes(url)
  const refs = useRef([])

  const selected = useMemo(
    () => (meshIndex == null ? meshes : [meshes[meshIndex % meshes.length]].filter(Boolean)),
    [meshes, meshIndex],
  )

  // Bend the plants in the shared gust. The material clones are private to
  // this component (useMeshes clones per instance), so patching them in place
  // can't leak into another prop. Amplitude is in world units at the very top
  // of the model, and the sway height comes from the geometry rather than a
  // guess — the same 0.1 looks like a breeze on a fern and a gale on a tuft.
  useMemo(() => {
    if (!sway) return
    const box = new Box3()
    selected.forEach((mesh, i) => {
      if (!mesh) return
      box.setFromBufferAttribute(mesh.geometry.attributes.position)
      applyWindSway(mesh.material, {
        height: box.max.y,
        amount: sway,
        key: `decor-sway-v1-${url}-${meshIndex ?? 'all'}-${i}`,
      })
    })
  }, [selected, sway, url, meshIndex])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    points.forEach(([x, y, z, yaw, scale], i) => {
      dummy.position.set(x, y + yOffset, z)
      dummy.rotation.set(0, yaw, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      refs.current.forEach((ref) => ref?.setMatrixAt(i, dummy.matrix))
    })
    refs.current.forEach((ref) => {
      if (!ref) return
      ref.instanceMatrix.needsUpdate = true
      ref.computeBoundingSphere()
    })
  }, [points, selected, yOffset])

  if (!points.length || !selected.length) return null

  return (
    <>
      {selected.map((mesh, i) => (
        <instancedMesh
          key={`${url}-${mesh.name}-${i}`}
          // Block body, not a concise arrow: React 19 treats whatever a ref
          // callback returns as its cleanup function, and `(el) => (arr[i] = el)`
          // returns the mesh — which the reconciler then tries to call on
          // detach, throwing "refCleanup is not a function" and taking the
          // whole canvas down with it.
          ref={(el) => {
            refs.current[i] = el
          }}
          args={[mesh.geometry, mesh.material, points.length]}
          castShadow={castShadow}
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </>
  )
}

export default function Decor() {
  const quality = useStore((s) => s.quality)
  const dense = quality === 'high'

  // Six distinct rocks live in the one glTF; scatter each with its own seed so
  // outcrops read as varied rather than repeated.
  const rockSets = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => ({
        index: i,
        points: scatter({
          count: dense ? 9 : 5,
          seed: 300 + i * 17,
          minSpacing: 5,
          maxSlope: 0.5,
          clearPath: 1.2,
          scale: [0.7, 1.9],
          maxRadius: 42,
          sink: 0.25,
        }),
      })),
    [dense],
  )

  const grass = useMemo(
    () =>
      scatter({
        count: dense ? 620 : 260,
        seed: 1201,
        minSpacing: 1.05,
        maxSlope: 0.36,
        clearPath: 0.9,
        clearZones: 0.6,
        scale: [0.8, 1.7],
        maxRadius: 39,
        sink: 0.06,
      }),
    [dense],
  )

  const ferns = useMemo(
    () =>
      scatter({
        count: dense ? 120 : 55,
        seed: 515,
        minSpacing: 2.4,
        maxSlope: 0.3,
        clearPath: 1.2,
        scale: [0.8, 1.5],
        maxRadius: 37,
        sink: 0.08,
      }),
    [dense],
  )

  const bushes = useMemo(
    () =>
      scatter({
        count: dense ? 54 : 26,
        seed: 877,
        minSpacing: 4.2,
        maxSlope: 0.28,
        clearPath: 1.4,
        scale: [0.9, 1.6],
        maxRadius: 37,
        sink: 0.1,
      }),
    [dense],
  )

  const stumps = useMemo(
    () =>
      scatter({
        count: 9,
        seed: 4242,
        minSpacing: 9,
        maxSlope: 0.22,
        clearPath: 1.3,
        scale: [0.8, 1.25],
        maxRadius: 34,
        sink: 0.12,
      }),
    [],
  )

  // Lanterns line the path, so the route between zones reads as designed.
  const lanterns = useMemo(
    () => alongPath(pathNodes, 11, 3).map(([x, y, z, yaw]) => [x, y, z, yaw, 1]),
    [],
  )

  return (
    <group>
      {rockSets.map(({ index, points }) => (
        <InstancedModel key={index} url={MODELS.rocks} points={points} meshIndex={index} />
      ))}

      {/* Blades travel furthest, ferns bend from the frond, bushes barely
          move — a bush that sways like grass reads as tissue paper. Stumps,
          rocks and lanterns are rigid, so they take no sway at all. */}
      <InstancedModel url={MODELS.grassTuft} points={grass} castShadow={false} sway={0.14} />
      <InstancedModel url={MODELS.fern} points={ferns} castShadow={false} sway={0.1} />
      <InstancedModel url={MODELS.bush} points={bushes} sway={0.05} />
      <InstancedModel url={MODELS.stump} points={stumps} />
      <InstancedModel url={MODELS.lantern} points={lanterns} />
    </group>
  )
}

/** Terrain-aware helper, re-exported for zone structures. */
export { terrainHeight }
