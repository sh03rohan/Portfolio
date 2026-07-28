import { useMemo, useEffect } from 'react'
import { RigidBody, HeightfieldCollider, CuboidCollider, useRapier } from '@react-three/rapier'
import { island } from '../data/world.js'
import { terrainHeight } from './heightfield.js'

/**
 * The physics surface of the island.
 *
 * A heightfield rather than a trimesh: Rapier can resolve it analytically, so
 * a 128x128 collision surface costs a fraction of the equivalent 32k-triangle
 * mesh and there are no cracks between triangles to fall through.
 *
 * Crucially it samples the same `terrainHeight()` the visual mesh does, so the
 * ground you see and the ground you stand on cannot drift apart.
 */
const SEGMENTS = 128

/**
 * Dev-only: drops a ray from high above a point and reports where the physics
 * world says the ground is, so the collider can be checked against
 * `terrainHeight()` rather than eyeballed.
 */
function useGroundProbe() {
  const { world, rapier } = useRapier()

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__probeGround = (x, z) => {
      const ray = new rapier.Ray({ x, y: 120, z }, { x: 0, y: -1, z: 0 })
      const hit = world.castRay(ray, 400, true)
      return hit ? 120 - hit.timeOfImpact : null
    }
    return () => delete window.__probeGround
  }, [world, rapier])
}

export default function TerrainCollider() {
  useGroundProbe()

  const heights = useMemo(() => {
    const size = island.radius * 2
    const n = SEGMENTS + 1
    const values = new Float32Array(n * n)

    // Rapier stores the height matrix column-major, and — this is the part
    // that's easy to get backwards — parry maps the *row* index to Z and the
    // *column* index to X. Transposing these drops the player through the
    // floor onto a mirrored copy of the island.
    for (let col = 0; col < n; col++) {
      for (let row = 0; row < n; row++) {
        const x = (col / SEGMENTS - 0.5) * size
        const z = (row / SEGMENTS - 0.5) * size
        values[col * n + row] = terrainHeight(x, z)
      }
    }
    return values
  }, [])

  const size = island.radius * 2

  return (
    <RigidBody type="fixed" colliders={false} friction={1} restitution={0}>
      {/* scale.y is 1 because the heights above are already world units. */}
      <HeightfieldCollider args={[SEGMENTS, SEGMENTS, heights, { x: size, y: 1, z: size }]} />

      {/* A floor far below the sea catches anything that escapes the island,
          so a stray fall ends in a respawn rather than an endless drop. */}
      <CuboidCollider args={[400, 1, 400]} position={[0, -60, 0]} sensor={false} />
    </RigidBody>
  )
}
